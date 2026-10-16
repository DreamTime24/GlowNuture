from datetime import datetime
from decimal import Decimal
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel,ConfigDict,Field,EmailStr,field_validator,model_validator
from .common import CustomerIn
class Strict(BaseModel):model_config=ConfigDict(extra="forbid")
Money=Decimal
class FirebaseSessionIn(Strict):
    id_token:str=Field(min_length=20,max_length=16000)
    name:str|None=Field(default=None,max_length=120)
    recaptcha_token:str|None=Field(default=None,max_length=4000)
class CheckoutItem(Strict):
    product_id:int=Field(gt=0)
    variant_id:int|None=Field(default=None,gt=0)
    qty:int=Field(ge=1,le=20)
class QuoteIn(Strict):
    items:list[CheckoutItem]=Field(min_length=1,max_length=30)
    coupon:str|None=Field(default=None,max_length=50)
    division:str=Field(default="ঢাকা",max_length=60)
    district:str=Field(default="ঢাকা",max_length=80)
    @model_validator(mode="after")
    def unique_lines(self):
        keys=[(item.product_id,item.variant_id) for item in self.items]
        if len(set(keys))!=len(keys):raise ValueError("Duplicate cart lines")
        return self
class CheckoutIn(Strict):
    items:list[CheckoutItem]=Field(min_length=1,max_length=30)
    customer:CustomerIn
    coupon:str|None=Field(default=None,max_length=50)
    payment:Literal["cod","online"]="cod"
    expected_total_minor:int=Field(ge=1,le=100000000)
    accept_terms:bool
    recaptcha_token:str|None=Field(default=None,max_length=4000)
    @model_validator(mode="after")
    def validate_checkout(self):
        keys=[(item.product_id,item.variant_id) for item in self.items]
        if len(set(keys))!=len(keys):raise ValueError("Duplicate cart lines")
        if not self.accept_terms:raise ValueError("Accept store terms before ordering")
        return self
class TrackIn(Strict):
    order_id:str=Field(min_length=5,max_length=32)
    token:str=Field(min_length=20,max_length=100)
class ProfileIn(Strict):
    name:str=Field(min_length=2,max_length=120)
    phone:str|None=Field(default=None,max_length=20)
    email:EmailStr|None=None
class PreferencesIn(Strict):
    marketing:bool=False
    email:bool=False
    push:bool=False
class CustomerStateIn(Strict):
    cart:list[CheckoutItem]=Field(default_factory=list,max_length=30)
    wishlist:list[int]=Field(default_factory=list,max_length=200)
    comparison:list[int]=Field(default_factory=list,max_length=4)
class ProductMutation(Strict):
    sku:str|None=Field(default=None,min_length=1,max_length=80)
    slug:str|None=Field(default=None,min_length=1,max_length=160,pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name:str|None=Field(default=None,min_length=1,max_length=300)
    en:str|None=Field(default=None,max_length=300)
    brand:str|None=Field(default=None,max_length=120)
    category:str|None=Field(default=None,max_length=80)
    sub:str|None=Field(default=None,max_length=80)
    short:str|None=Field(default=None,max_length=1000)
    description:str|None=Field(default=None,max_length=12000)
    usage:str|None=Field(default=None,max_length=3000)
    price:Money|None=Field(default=None,ge=0,le=1000000,max_digits=12,decimal_places=2)
    acquisition_cost:Money|None=Field(default=None,ge=0,le=1000000,max_digits=12,decimal_places=2)
    compare:int|None=Field(default=None,ge=0,le=1000000)
    stock:int|None=Field(default=None,ge=0,le=100000)
    size:str|None=Field(default=None,max_length=80)
    origin:str|None=Field(default=None,max_length=120)
    gtin:str|None=Field(default=None,max_length=32)
    warnings:str|None=Field(default=None,max_length=3000)
    condition:Literal["new","sealed","opened","damaged"]|None=None
    expiry_required:bool|None=None
    unbatched_expires_at:datetime|None=None
    revision:int|None=Field(default=None,ge=1)
    image_url:str|None=Field(default=None,max_length=2000)
    images_json:list[str]|None=Field(default=None,max_length=8)
    ingredients_json:list[str]|None=Field(default=None,max_length=80)
    tags_json:list[str]|None=Field(default=None,max_length=30)
    skin_json:list[str]|None=Field(default=None,max_length=10)
    active:bool|None=None
    archived:bool|None=None
    content_verified:bool|None=None
    @field_validator("image_url")
    @classmethod
    def image(cls,value):
        if not value:return value
        p=urlsplit(value)
        if p.scheme=="https" and p.hostname and not p.username and not p.password:return value
        if value.startswith("/media/") and ".." not in value and "\\" not in value:return value
        raise ValueError("Use HTTPS or a local media image")
    @field_validator("images_json")
    @classmethod
    def images(cls,values):return [cls.image(v) for v in values] if values else values
class VariantIn(Strict):
    sku:str=Field(min_length=1,max_length=100)
    label:str=Field(min_length=1,max_length=160)
    price:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
    stock:int=Field(default=0,ge=0,le=100000)
    active:bool=True
class CouponIn(Strict):
    code:str=Field(min_length=2,max_length=50,pattern=r"^[A-Za-z0-9_-]+$")
    kind:Literal["percent","fixed"]
    value:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
    minimum:Money=Field(default=0,ge=0,le=1000000)
    maximum_discount:Money|None=Field(default=None,ge=0,le=1000000)
    usage_limit:int|None=Field(default=None,ge=1)
    active:bool=True
    starts_at:datetime|None=None
    expires_at:datetime|None=None
    @model_validator(mode="after")
    def limits(self):
        if self.kind=="percent" and self.value>100:raise ValueError("Percentage cannot exceed 100")
        if self.starts_at and self.expires_at and self.expires_at<=self.starts_at:raise ValueError("Expiry must follow start")
        return self
class StatusIn(Strict):
    status:Literal["confirmed","processing","packed","shipped","delivered","failed_delivery","cancelled","returned"]
    reason:str=Field(default="",max_length=1000)
    restock:bool=False
class ShipmentIn(Strict):
    provider:Literal["manual","pathao","steadfast","redx"]="manual"
    tracking_number:str=Field(min_length=2,max_length=160)
    shipping_cost:Money=Field(default=0,ge=0,le=100000,max_digits=12,decimal_places=2)
class CodCollectionIn(Strict):
    amount:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
    reference:str=Field(min_length=3,max_length=160)
class ReasonIn(Strict):reason:str=Field(min_length=5,max_length=2000)
class RefundIn(ReasonIn):amount:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
class RefundRecordIn(Strict):
    provider_reference:str=Field(min_length=3,max_length=160)
    confirmed_amount:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
    operator_confirmed:bool
class ReviewIn(Strict):
    order_id:str=Field(min_length=5,max_length=32)
    rating:int=Field(ge=1,le=5)
    text:str=Field(min_length=5,max_length=3000)
class PushIn(Strict):
    token:str=Field(min_length=20,max_length=4096)
    consent:bool
    marketing:bool=False
class ContactIn(Strict):
    name:str=Field(min_length=2,max_length=120)
    email:EmailStr
    message:str=Field(min_length=10,max_length=4000)
    consent:bool
    website:str=Field(default="",max_length=200)
class NewsletterIn(Strict):
    email:EmailStr
    consent:bool
class ImportIn(Strict):
    start:int=Field(default=0,ge=0,le=480)
    pages:int=Field(default=1,ge=1,le=10)
class StaffRoleIn(Strict):
    role:Literal["super_admin","admin","operations_manager","inventory_manager","customer_support","customer"]
    is_active:bool=True
    confirm:bool
class ExpenseIn(Strict):
    amount:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
    reference:str=Field(min_length=3,max_length=180)
    description:str=Field(min_length=3,max_length=1000)
class SupplierIn(Strict):
    name:str=Field(min_length=2,max_length=160)
    contact:str=Field(default="",max_length=1000)
    active:bool=True
class PurchaseLineIn(Strict):
    product_id:int=Field(gt=0)
    variant_id:int|None=Field(default=None,gt=0)
    quantity:int=Field(ge=1,le=10000)
    unit_cost:Money=Field(gt=0,le=1000000,max_digits=12,decimal_places=2)
    batch_code:str=Field(min_length=1,max_length=100)
    expires_at:datetime|None=None
class PurchaseIn(Strict):
    supplier_id:int=Field(gt=0)
    reference:str=Field(min_length=3,max_length=160)
    items:list[PurchaseLineIn]=Field(min_length=1,max_length=100)
class ReceiveIn(Strict):inspected:bool
class BusinessRecordIn(Strict):
    title:str=Field(min_length=1,max_length=200)
    body:str=Field(default="",max_length=12000)
    image_url:str=Field(default="",max_length=2000)
    link:str=Field(default="",max_length=240)
    active:bool=False
    @field_validator("image_url")
    @classmethod
    def image(cls,value):return ProductMutation.image(value)
    @field_validator("link")
    @classmethod
    def link_valid(cls,value):
        if value and not value.startswith("#/"):raise ValueError("Use a store route beginning #/")
        return value
class ReturnDecisionIn(Strict):
    status:Literal["approved","rejected","received"]
    reason:str=Field(min_length=5,max_length=1000)
class GroundedQuestionIn(Strict):question:str=Field(min_length=2,max_length=500)
