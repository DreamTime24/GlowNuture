"""One bounded, plain-text catalog DTO. Source prices/stock never become store inventory."""
import csv
import hashlib
import io
import json
import re
from html import unescape
from html.parser import HTMLParser
from .safe_network import validate_url,ExternalFetchError

class InvalidCatalog(ValueError):pass
class Plain(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts=[]
    def handle_data(self,data):self.parts.append(data)

def text(value,maximum=12000):
    if value is None:return ""
    if not isinstance(value,(str,int,float)):return ""
    parser=Plain()
    parser.feed(str(value))
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]","",unescape(" ".join(parser.parts))).strip()[:maximum]

def url(value):
    if not isinstance(value,str):return ""
    try:validate_url(value)
    except (ExternalFetchError,ValueError):return ""
    return value

def array(value):
    if isinstance(value,list):return value
    if isinstance(value,str):
        if value.strip().startswith("["):
            try:
                parsed=json.loads(value)
                if isinstance(parsed,list):return parsed
            except ValueError:pass
        return [part.strip() for part in re.split(r"[\n;]",value) if part.strip()]
    return []

def gtin(value):
    digits=str(value or "").strip()
    if len(digits) not in {8,12,13,14} or not digits.isascii() or not digits.isdigit():return ""
    total=sum(int(digit)*(3 if index%2==0 else 1) for index,digit in enumerate(reversed(digits[:-1])))
    return digits if (10-total%10)%10==int(digits[-1]) else ""

def normalize(row,source):
    if not isinstance(row,dict):raise InvalidCatalog("Product row must be an object")
    barcode=gtin(row.get("gtin") or row.get("barcode") or row.get("code"))
    external=row.get("external_id") or row.get("id") or row.get("product_id") or row.get("sku") or barcode or row.get("url")
    name=text(row.get("name_bn") or row.get("name") or row.get("title") or row.get("product_name") or row.get("name_en"),300)
    if not external and source.kind=="ordinary":external=name
    if not isinstance(external,(str,int)) or not str(external).strip() or len(str(external))>200 or not name:
        raise InvalidCatalog("Stable external ID/SKU/GTIN and a product name are required")
    images=[]
    raw=array(row.get("image_candidates") or row.get("images"))
    raw.extend([row.get("image_url"),row.get("image_front_url")])
    for image in raw:
        image=image if isinstance(image,dict) else {"url":image}
        candidate=url(image.get("url") or image.get("src"))
        if candidate and candidate not in [item["url"] for item in images]:
            images.append({"url":candidate,"reported_license":text(image.get("reported_license") or image.get("license"),200),"rights_verified":False})
    ingredients=array(row.get("key_ingredients") or row.get("ingredients") or row.get("ingredients_text") or row.get("ingredients_text_en"))
    ingredients=[text(item.get("name") if isinstance(item,dict) else item,500) for item in ingredients][:80]
    variants=[]
    for item in array(row.get("variants"))[:30]:
        if isinstance(item,dict):
            variants.append({"external_id":text(item.get("external_id") or item.get("id") or item.get("sku"),200),"sku":text(item.get("sku"),100),"label":text(item.get("label") or item.get("size") or item.get("name"),160),"size":text(item.get("size"),80),"gtin":gtin(item.get("gtin") or item.get("barcode"))})
    return {"provider":source.key,"external_id":str(external).strip(),"gtin":barcode,"name":name,"en":text(row.get("name_en") or row.get("en") or row.get("product_name_en"),300),"brand":text(row.get("brand") or row.get("brands"),120),"size":text(row.get("size") or row.get("quantity"),80),"unit":text(row.get("unit"),30),"category":text(row.get("category") or row.get("categories"),80),"description":text(row.get("description") or row.get("long_description")),"short":text(row.get("short_description") or row.get("short"),1000),"ingredients":list(filter(None,ingredients)),"usage":text(row.get("instructions") or row.get("usage") or row.get("directions"),3000),"warnings":text(row.get("warnings"),3000),"origin":text(row.get("origin") or row.get("country_of_origin"),120),"url":url(row.get("source_url") or row.get("url")),"image_candidates":images[:8],"variants":variants,"attribution":source.attribution,"license":source.license,"reference_only":source.kind=="openbeautyfacts"}

def rows_from_json(payload):
    data=payload.get("data",payload) if isinstance(payload,dict) else payload
    if isinstance(data,dict):data=data.get("products",data.get("items"))
    if not isinstance(data,list):raise InvalidCatalog("Expected a product array in data.products, data, products or items")
    return data

def parse_upload(raw,filename):
    if len(raw)>1_000_000:raise InvalidCatalog("Feed maximum size is 1 MB")
    try:value=raw.decode("utf-8-sig")
    except UnicodeDecodeError:raise InvalidCatalog("Use a UTF-8 CSV or JSON file") from None
    try:
        if filename.lower().endswith(".json"):rows=rows_from_json(json.loads(value))
        elif filename.lower().endswith(".csv"):
            csv.field_size_limit(20000)
            reader=csv.DictReader(io.StringIO(value))
            if not reader.fieldnames or len(set(reader.fieldnames))!=len(reader.fieldnames) or len(reader.fieldnames)>60:
                raise InvalidCatalog("CSV headers must be unique and bounded")
            rows=[]
            for row in reader:
                if None in row:raise InvalidCatalog("CSV contains extra columns")
                rows.append(row)
                if len(rows)>500:raise InvalidCatalog("Maximum 500 products per file")
        else:raise InvalidCatalog("Use a .csv or .json catalog file")
    except (ValueError,csv.Error,RecursionError) as error:
        if isinstance(error,InvalidCatalog):raise
        raise InvalidCatalog("Malformed catalog file") from None
    if not rows or len(rows)>500:raise InvalidCatalog("Supply between 1 and 500 products")
    return rows

def digest(snapshot):
    return hashlib.sha256(json.dumps(snapshot,sort_keys=True,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()
