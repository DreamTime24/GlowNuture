"""Explicit supplier contracts; adding a provider never grants publishing permission."""
import json
from ..core.config import get_settings
from ..core.security import decrypt_text
from . import catalog,safe_network
from .catalog_normalize import rows_from_json,InvalidCatalog

PAGE_SIZE=12
OBF="https://world.openbeautyfacts.org/api/v2/search"

def fetch_page(source,start):
    if source.kind=="ordinary":
        settings=get_settings()
        if not settings.parse_api_key or not settings.parse_key_rotation_confirmed:
            raise safe_network.ExternalFetchError("ROTATED_PARSE_KEY_NOT_CONFIGURED")
        return catalog.fetch_page(start)
    headers={"Accept":"application/json"}
    if source.credential_blob:
        headers[source.auth_header]=decrypt_text(source.credential_blob,get_settings().pii_encryption_key)
    if source.kind=="openbeautyfacts":
        endpoint=OBF
        params={"page":start//PAGE_SIZE+1,"page_size":PAGE_SIZE,"fields":"code,product_name,product_name_en,brands,quantity,categories,ingredients_text,image_front_url,url,countries_tags,last_modified_t"}
        response=safe_network.fetch(endpoint,params=params,headers=headers)
    elif source.kind=="supplier_api":
        params={"start":start,"limit":PAGE_SIZE}
        response=safe_network.fetch(source.endpoint,method=source.method,headers=headers,payload=params if source.method=="POST" else None,params=params if source.method=="GET" else None)
    else:raise safe_network.ExternalFetchError("SOURCE_IS_NOT_A_REMOTE_API")
    if response.content_type not in {"application/json","text/json"} and not response.content_type.endswith("+json"):
        raise safe_network.ExternalFetchError("UNEXPECTED_CONTENT_TYPE")
    try:rows=rows_from_json(json.loads(response.body))
    except (ValueError,InvalidCatalog,RecursionError):raise safe_network.ExternalFetchError("INVALID_PRODUCT_RESPONSE") from None
    if len(rows)>PAGE_SIZE:raise safe_network.ExternalFetchError("PROVIDER_IGNORED_PAGE_LIMIT")
    return rows
