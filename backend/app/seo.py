"""Crawler-facing routes. The storefront uses hash routes (#/p/x), which search
engines and AI crawlers cannot index, so every product also gets a real URL
(/p/<slug>) that returns server-rendered HTML with JSON-LD, then sends people
on to the app."""
import html
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .core.config import get_settings
from .db import get_db
from .models.entities import Product,Variant
from .services.commerce import expired_stock
from .services import product_policy

router = APIRouter()
S = get_settings()
SITE = S.allowed_origin.rstrip("/")
BRAND = "Glow Nuture"


def _ld(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


@router.get("/p/{slug}", response_class=HTMLResponse)
def product_page(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Product).where(Product.slug == slug, *product_policy.public_predicate()))
    if not product_policy.eligible(db,p):
        raise HTTPException(404, "Product not found")
    available=max(0,p.stock-expired_stock(db,p.id))
    variants=db.scalars(select(Variant).where(Variant.product_id==p.id,Variant.active.is_(True))).all()
    available+=sum(max(0,v.stock-expired_stock(db,p.id,v.id)) for v in variants)
    name = p.en or p.name
    desc = (p.short or p.description or name)[:300]
    url = f"{SITE}/p/{p.slug}"
    img = f"{SITE}{p.image_url}" if p.image_url and p.image_url.startswith("/") else p.image_url
    offers=[]
    for option in [p,*variants]:
        stock=max(0,option.stock-expired_stock(db,p.id,None if option is p else option.id))
        offers.append({"@type":"Offer","sku":option.sku,"priceCurrency":"BDT","price":str(option.price),"url":url,"availability":"https://schema.org/InStock" if stock else "https://schema.org/OutOfStock","seller":{"@type":"Organization","name":BRAND}})
    ld = {
        "@context": "https://schema.org", "@type": "Product", "name": name, "description": desc,
        "sku": p.sku, "brand": {"@type": "Brand", "name": p.brand or BRAND},
        "category": p.category, "url": url,
        **({"image": img} if img else {}),
        "offers":offers if variants else offers[0],
    }
    e = html.escape
    body = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{e(name)} | {BRAND}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="product"><meta property="og:title" content="{e(name)}">
<meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{e(url)}">
{f'<meta property="og:image" content="{e(img)}">' if img else ''}
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{_ld(ld)}</script>
<script src="/assets/p-redirect.js" defer></script>
</head><body><main><h1>{e(name)}</h1><p>{e(desc)}</p>
<p>Brand: {e(p.brand or BRAND)}. Price: BDT {p.price}. {'In stock.' if available > 0 else 'Out of stock.'}</p>
<p><a href="/#/p/{e(p.slug)}">Open in the store</a></p></main></body></html>"""
    return HTMLResponse(body)


@router.get("/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    urls = [f"{SITE}/"] + [f"{SITE}/p/{p.slug}" for p in db.scalars(select(Product).where(*product_policy.public_predicate())) if product_policy.eligible(db,p)]
    xml = "".join(f"<url><loc>{html.escape(u)}</loc></url>" for u in urls)
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{xml}</urlset>',
                    media_type="application/xml")


@router.get("/robots.txt", response_class=PlainTextResponse)
def robots():
    # AI crawlers are allowed on purpose: product answers in AI search send traffic.
    return (f"User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /#/admin\n\n"
            f"User-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n\n"
            f"Sitemap: {SITE}/sitemap.xml\n")


@router.get("/llms.txt", response_class=PlainTextResponse)
def llms(db: Session = Depends(get_db)):
    rows = db.scalars(select(Product).where(*product_policy.public_predicate()).limit(200)).all()
    lines = [f"# {BRAND}", "", "> Approved beauty product descriptions and local BDT catalog. Checkout availability is published by the seller.", "",
             "## Products"]
    lines += [f"- [{p.en or p.name}]({SITE}/p/{p.slug}): BDT {p.price}, {p.brand or BRAND}" for p in rows if product_policy.eligible(db,p)]
    return "\n".join(lines) + "\n"
