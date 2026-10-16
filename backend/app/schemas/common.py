from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator
import re
from typing import Literal

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=11, max_length=14)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v: str):
        n = re.sub(r"\D", "", v)
        if not re.fullmatch(r"01[3-9]\d{8}", n):
            raise ValueError("Invalid Bangladesh mobile number")
        return n

class LoginIn(BaseModel):
    phone: str
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None = None
    role: str
    firebase_uid: str | None = None
    email_verified: bool = False
    model_config = ConfigDict(from_attributes=True)

class ProductOut(BaseModel):
    id: int
    slug: str
    sku: str
    name: str
    en: str
    brand: str
    category: str
    sub: str
    short: str
    description: str
    price: float
    compare: int
    stock: int
    size: str
    origin: str
    image_url: str | None = None
    active: bool = True
    tags: list = []
    ingredients: list = []
    skin: list = []
    images: list = []
    usage: str = ""
    variants: list = []
    content_verified: bool = False
    archived: bool = False
    source: dict = {}

class AdminProductOut(ProductOut):
    acquisition_cost: float = 0

class OrderItemIn(BaseModel):
    product_id: int
    qty: int = Field(ge=1, le=99)

class CustomerIn(BaseModel):
    model_config=ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=120)
    phone: str
    phone2: str | None = None
    email: EmailStr | None = None
    division: str = Field(min_length=2, max_length=60)
    district: str = Field(min_length=2, max_length=80)
    upazila: str = Field(min_length=2, max_length=100)
    area: str | None = Field(default=None, max_length=120)
    address: str = Field(min_length=5, max_length=500)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("phone","phone2")
    @classmethod
    def phone_valid(cls,value):
        if not value:return value
        number=re.sub(r"[\s()+-]","",value)
        if number.startswith("880"):number=number[2:]
        if not re.fullmatch(r"01[3-9]\d{8}",number):raise ValueError("Enter a valid Bangladesh mobile number")
        return number

class OrderCreateIn(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    customer: CustomerIn
    coupon: str | None = None
    payment: Literal["cod"] = "cod"

class OrderOut(BaseModel):
    id: str
    total: float
    status: str
    payment: str
    created_at: str
