"""Bounded source, import and owner-review request contracts."""
from datetime import datetime
from typing import Literal
from pydantic import Field, field_validator
from .platform import Strict

CONFIRMATIONS={
    "authenticity","supplier","source_rights","identity","image_match","image_rights","description",
    "ingredients","instructions_warnings","condition","expiry","inventory","bdt_price","sku_category"
}
class ProductReviewIn(Strict):
    action:Literal["submit","verify","reject","publish","unpublish","archive","restore"]
    expected_revision:int=Field(ge=1,strict=True)
    supplier_id:int|None=Field(default=None,gt=0)
    confirmations:dict[str,bool]=Field(default_factory=dict,max_length=20)
    evidence:str=Field(default="",max_length=3000)
    reason:str=Field(default="",max_length=1000)

class SourceIn(Strict):
    key:str=Field(pattern=r"^[a-z][a-z0-9-]{1,59}$")
    name:str=Field(min_length=2,max_length=160)
    kind:Literal["file","supplier_api","ordinary","openbeautyfacts"]
    endpoint:str=Field(default="",max_length=2000)
    method:Literal["GET","POST"]="GET"
    auth_header:Literal["X-API-Key","Authorization"]="X-API-Key"
    credential:str=Field(default="",max_length=2000)
    license:str=Field(default="",max_length=300)
    attribution:str=Field(default="",max_length=500)
    owner_authorized:bool
    enabled:bool=True

class ImportJobIn(Strict):
    source_id:int=Field(gt=0)
    request_id:str=Field(pattern=r"^[a-f0-9]{32}$")
    start:int=Field(default=0,ge=0,le=10000)
    pages:int=Field(default=1,ge=1,le=5)

class MediaRightsIn(Strict):
    product_id:int=Field(gt=0)
    url:str=Field(min_length=10,max_length=2000)
    rights_holder:str=Field(min_length=2,max_length=200)
    license:str=Field(min_length=2,max_length=200)
    evidence:str=Field(min_length=10,max_length=2000)
    redistribution_allowed:bool
    matches_product:bool

class MediaMetadataIn(Strict):
    rights_holder:str=Field(min_length=2,max_length=200)
    license:str=Field(min_length=2,max_length=200)
    evidence:str=Field(min_length=10,max_length=2000)
    redistribution_allowed:bool
