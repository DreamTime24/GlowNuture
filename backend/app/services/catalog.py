"""Private-key upstream requests stay on the server; imports are unapproved drafts."""
import hashlib,re,time,json
from urllib.parse import urlsplit
import httpx
from fastapi import HTTPException
from sqlalchemy import select
from ..core.config import get_settings
from ..models.entities import Product,ImportLog
ENDPOINT="https://api.parse.bot/scraper/40173335-04fa-432e-90d9-cdea5deb7cd7/get_all_products"
def plain(v,default=""):return v.strip()[:12000] if isinstance(v,str) else default
def safe_url(v):
    if isinstance(v,dict):v=v.get("url") or v.get("src")
    if not isinstance(v,str):return ""
    try:p=urlsplit(v)
    except ValueError:return ""
    return v if p.scheme=="https" and p.hostname and not p.username and not p.password else ""
def ingredients(v):
    if isinstance(v,list):return [plain(x.get("name") if isinstance(x,dict) else x) for x in v if isinstance(x,(str,dict))][:80]
    return [plain(v)] if isinstance(v,str) and v else []
def extract(response):
    data=response.get("data") if isinstance(response,dict) else None
    products=data.get("products") if isinstance(data,dict) else data
    if not isinstance(products,list):raise HTTPException(502,"Catalog provider returned an invalid product list")
    return [p for p in products if isinstance(p,dict)][:12]
def public_record(item):
    raw=item.get("images") or []
    if not isinstance(raw,list):raw=[raw]
    images=[v for v in map(safe_url,raw+[item.get("image_url")]) if v][:8]
    price=item.get("price")
    if not isinstance(price,(int,float,str,dict,type(None))):price=None
    return {"brand":"The Ordinary","name":plain(item.get("name") or item.get("title"),"Untitled product"),"description":plain(item.get("description")),"images":images,"ingredients":ingredients(item.get("key_ingredients") or item.get("ingredients")),"price":price,"currency":plain(item.get("currency"))[:3],"available":True,"available_for_sale":False}
def fetch_page(start,client=None):
    S=get_settings()
    if not S.parse_api_key:raise HTTPException(503,"Catalog API connection is not configured")
    if client is None:
        if not S.parse_key_rotation_confirmed:raise HTTPException(503,"A rotated Parse key must be configured and confirmed")
        from . import safe_network
        try:
            response=safe_network.fetch(ENDPOINT,method="POST",headers={"X-API-Key":S.parse_api_key},payload={"start":start,"limit":12},maximum=2_000_000)
            if response.content_type not in {"application/json","text/json"} and not response.content_type.endswith("+json"):raise ValueError()
            return extract(json.loads(response.body))
        except safe_network.ExternalFetchError:raise HTTPException(502,"Catalog provider connection failed safely") from None
        except (ValueError,RecursionError):raise HTTPException(502,"Catalog provider returned invalid JSON") from None
    own=False
    try:
        for attempt in range(3):
            try:
                response=client.post(ENDPOINT,headers={"Content-Type":"application/json","X-API-Key":S.parse_api_key},json={"start":start,"limit":12})
                if response.status_code in {429,502,503,504} and attempt<2:time.sleep(.2*2**attempt);continue
                if response.status_code!=200:raise HTTPException(502,"Catalog provider request failed")
                if len(response.content)>2_000_000:raise HTTPException(502,"Catalog response is too large")
                return extract(response.json())
            except httpx.TransportError:
                if attempt==2:raise HTTPException(502,"Catalog provider connection timed out") from None
                time.sleep(.2*2**attempt)
            except ValueError:raise HTTPException(502,"Catalog provider returned invalid JSON") from None
    finally:
        if own:client.close()
def import_products(db,start=0,pages=1,client=None):
    if start%12:raise HTTPException(400,"Use offsets in multiples of 12")
    counts={"created":0,"updated":0,"pages":0};seen=set();complete=False
    try:
        for page in range(pages):
            items=fetch_page(start+page*12,client);counts["pages"]+=1
            for item in items:
                source=public_record(item);name=source["name"]
                if name=="Untitled product":continue
                ident=str(item.get("id") or item.get("product_id") or item.get("sku") or safe_url(item.get("url")) or name)[:200]
                if ident in seen:continue
                seen.add(ident);existing=db.scalar(select(Product).where(Product.source_id==ident))
                if existing:existing.source_json=source;counts["updated"]+=1
                else:
                    digest=hashlib.sha256(ident.encode()).hexdigest()[:12]
                    slug=re.sub(r"[^a-z0-9]+","-",name.lower()).strip("-")[:100] or "formula"
                    db.add(Product(sku="ORD-"+digest.upper(),slug=slug+"-"+digest,name=name,en=name,brand="The Ordinary",category="skincare",sub="serum" if re.search("serum|solution|acid|niacinamide|peptide",name,re.I) else "",description=source["description"],short=source["description"][:500],ingredients_json=source["ingredients"],images_json=source["images"],image_url=source["images"][0] if source["images"] else None,source_id=ident,source_json=source,price=0,stock=0,active=False,content_verified=False))
                    db.flush();counts["created"]+=1
            if len(items)<12:complete=True;break
        if start==0 and complete:
            for product in db.scalars(select(Product).where(Product.source_id.is_not(None))).all():
                if product.source_id not in seen:product.source_json={**product.source_json,"available":False}
        db.add(ImportLog(status="completed",counts_json=counts,message="Imported as drafts; local price, stock and approved content preserved"))
        db.commit();return counts
    except Exception:
        db.rollback();db.add(ImportLog(status="failed",message="Provider request or import validation failed"));db.commit();raise
