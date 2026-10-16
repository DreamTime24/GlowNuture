"""Owner verification must be a server transition, never a forged checkbox."""
def test_inventory_manager_cannot_publish_by_forging_legacy_flags(make_client):
    staff=make_client("inventory_manager")
    response=staff.post("/api/admin/products",json={"sku":"QA-FORGE","slug":"qa-forge","name":"Isolated approval fixture","price":"250.00","stock":1,"active":True,"content_verified":True})
    assert response.status_code in {403,409,422},response.text


import pytest
from sqlalchemy import select
from app.models.entities import Product,MediaAsset,Session
from app.services import media
from catalog_helpers import draft,attach,verify,photo_bytes
from conftest import checkout_payload

def test_owner_workflow_and_private_draft_images(client,make_client,customer,db):
    staff=make_client("super_admin")
    product,asset=attach(staff,draft(staff))
    assert client.get(asset["url"]).status_code==404
    assert staff.get(asset["preview_url"]).status_code==200
    assert client.get("/api/products").json()==[]
    assert client.get("/p/"+product["slug"]).status_code==404
    response=client.post("/api/checkout/quote",json={"items":[{"product_id":product["id"],"qty":1}]})
    assert response.status_code==409
    product=verify(staff,product)
    visible=client.get("/api/products").json()
    assert [row["id"] for row in visible]==[product["id"]]
    assert client.get(asset["url"]).status_code==200
    assert client.get(asset["url"]).headers["content-type"].startswith("image/webp")
    assert client.get("/p/"+product["slug"]).status_code==200
    assert product["slug"] in client.get("/sitemap.xml").text
    quote=client.post("/api/checkout/quote",json={"items":[{"product_id":product["id"],"qty":1}]}).json()
    assert quote["total_minor"]==31025

def test_only_reviewer_can_verify_and_publish(make_client,db):
    owner=make_client("super_admin")
    inventory=make_client("inventory_manager")
    product,asset=attach(owner,draft(owner))
    url="/api/admin/products/"+str(product["id"])+"/review"
    assert inventory.post(url,json={"action":"submit","expected_revision":product["revision"]}).status_code==200
    assert inventory.post(url,json={"action":"verify","expected_revision":product["revision"]}).status_code==403
    assert owner.post(url,json={"action":"verify","expected_revision":product["revision"]}).status_code==422
    assert owner.post(url,json={"action":"publish","expected_revision":product["revision"]}).status_code==409
    assert not db.get(Product,product["id"]).active

def test_stale_review_cannot_publish_material_edit(client,make_client):
    owner=make_client("admin")
    product,asset=attach(owner,draft(owner))
    product=verify(owner,product,publish=False)
    changed=owner.patch("/api/admin/products/"+str(product["id"]),json={"name":"Changed QA name","revision":product["revision"]})
    assert changed.status_code==200,changed.text
    assert changed.json()["publication_state"]=="DRAFT"
    assert changed.json()["revision"]==product["revision"]+1
    result=owner.post("/api/admin/products/"+str(product["id"])+"/review",json={"action":"publish","expected_revision":product["revision"]})
    assert result.status_code==409
    assert client.get("/api/products").json()==[]

def test_forging_internal_approval_fields_is_rejected(make_client):
    staff=make_client("super_admin")
    product=draft(staff)
    for data in [{"active":True,"content_verified":True},{"legacy_approved":True},{"publication_state":"PUBLISHED"},{"approved_revision":1}]:
        response=staff.patch("/api/admin/products/"+str(product["id"]),json=data)
        assert response.status_code in {409,422},response.text

def test_missing_real_image_and_rights_prevent_verification(make_client):
    owner=make_client("super_admin")
    product=draft(owner)
    owner.post("/api/admin/products/"+str(product["id"])+"/review",json={"action":"submit","expected_revision":product["revision"]})
    from app.schemas.catalog import CONFIRMATIONS
    supplier=owner.post("/api/admin/suppliers",json={"name":"QA supplier"}).json()
    result=owner.post("/api/admin/products/"+str(product["id"])+"/review",json={"action":"verify","expected_revision":product["revision"],"supplier_id":supplier["id"],"evidence":"Isolated explicit QA verification record","confirmations":{key:True for key in CONFIRMATIONS}})
    assert result.status_code==422
    assert "image" in str(result.json()).lower()

def test_variant_material_change_revokes_approval(client,make_client):
    owner=make_client("super_admin")
    product,asset=attach(owner,draft(owner))
    product=verify(owner,product)
    response=owner.post("/api/admin/products/"+str(product["id"])+"/variants",json={"sku":"QA-60","label":"60 ml","price":"400.00","stock":2})
    assert response.status_code==201,response.text
    assert client.get("/api/products").json()==[]
    assert client.post("/api/checkout/quote",json={"items":[{"product_id":product["id"],"variant_id":response.json()["id"],"qty":1}]}).status_code==409

def test_wrong_product_image_is_not_attachable(make_client):
    owner=make_client("super_admin")
    first,asset=attach(owner,draft(owner))
    second=draft(owner,"other")
    result=owner.patch("/api/admin/products/"+str(second["id"]),json={"image_url":asset["url"]})
    assert result.status_code==409

def test_health_inspector_detects_missing_derivative_and_blocks_checkout(client,make_client,db):
    owner=make_client("super_admin")
    product,asset=attach(owner,draft(owner))
    product=verify(owner,product)
    item=db.get(MediaAsset,asset["id"])
    media.local_path(item.variants_json[1]["url"]).unlink()
    check=owner.post("/api/admin/products/"+str(product["id"])+"/image-health")
    assert check.status_code==200
    assert "missing_or_invalid" in str(check.json())
    assert client.get("/api/products").json()==[]
    assert client.post("/api/checkout/quote",json={"items":[{"product_id":product["id"],"qty":1}]}).status_code==409

def test_staff_mfa_protects_the_approval_routes(make_client,db):
    owner=make_client("super_admin")
    product=draft(owner)
    session=db.scalar(select(Session).where(Session.user_id==owner.get("/api/auth/me").json()["id"]))
    session.mfa_verified=False
    db.commit()
    assert owner.post("/api/admin/products/"+str(product["id"])+"/review",json={"action":"submit","expected_revision":product["revision"]}).status_code==403
