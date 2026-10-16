"""Explicitly isolated QA data; never seed these records in a deployed shop."""
import io
from PIL import Image,ImageDraw
from app.schemas.catalog import CONFIRMATIONS

def photo_bytes(size=(480,640)):
    image=Image.new("RGB",size,(239,233,224))
    ImageDraw.Draw(image).text((20,30),"QA ONLY - NOT A PRODUCT",fill=(40,50,40))
    output=io.BytesIO()
    image.save(output,format="PNG")
    return output.getvalue()

def draft(staff,suffix="one"):
    response=staff.post("/api/admin/products",json={"sku":"QA-"+suffix,"slug":"qa-"+suffix,"name":"Isolated QA image fixture "+suffix,"brand":"QA ONLY","size":"30 ml","category":"skincare","description":"Isolated acceptance image fixture, never a real sale product.","usage":"Read QA label; this is test-only data.","ingredients_json":["QA fixture"],"price":"250.25","acquisition_cost":"120.00","stock":5,"condition":"sealed","expiry_required":True,"unbatched_expires_at":"2031-01-01T00:00:00Z"})
    assert response.status_code==201,response.text
    return response.json()

def attach(staff,product):
    response=staff.post("/api/admin/media",files={"file":("qa.png",photo_bytes(),"image/png")},data={"product_id":product["id"],"rights_holder":"QA image author","license":"Owned isolated test image","evidence":"Generated inside an isolated test; never production merchandise.","redistribution_allowed":"true"})
    assert response.status_code==201,response.text
    asset=response.json()
    response=staff.patch("/api/admin/products/"+str(product["id"]),json={"revision":product["revision"],"image_url":asset["url"],"images_json":[asset["url"]]})
    assert response.status_code==200,response.text
    return response.json(),asset

def verify(staff,product,publish=True):
    supplier=staff.post("/api/admin/suppliers",json={"name":"Isolated QA supplier","contact":"Test-only supplier record"}).json()
    endpoint="/api/admin/products/"+str(product["id"])+"/review"
    revision=product["revision"]
    response=staff.post(endpoint,json={"action":"submit","expected_revision":revision})
    assert response.status_code==200,response.text
    response=staff.post(endpoint,json={"action":"verify","expected_revision":revision,"supplier_id":supplier["id"],"confirmations":{key:True for key in CONFIRMATIONS},"evidence":"Isolated QA assertions of supplier, sealed condition, physical count and expiry."})
    assert response.status_code==200,response.text
    if publish:
        response=staff.post(endpoint,json={"action":"publish","expected_revision":revision})
        assert response.status_code==200,response.text
    return response.json()
