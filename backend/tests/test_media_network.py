import io,socket
import pytest
from app.services import safe_network
from app.services.catalog_normalize import parse_upload,InvalidCatalog
from catalog_helpers import draft,photo_bytes

@pytest.mark.parametrize("url",[
    "http://example.com/a","https://127.0.0.1/image","https://169.254.169.254/latest/meta-data",
    "https://[::1]/a","https://[::ffff:127.0.0.1]/a","file:///etc/passwd",
    "https://name:password@example.com/a","https://localhost/a",
    "https://example.com:8443/a","https://example.com/a?access_token=not-a-real-secret"
])
def test_unsafe_urls_are_rejected_without_connecting(url):
    with pytest.raises(safe_network.ExternalFetchError):safe_network.validate_url(url)

def test_mixed_public_private_dns_answer_is_rejected(monkeypatch):
    monkeypatch.setattr(socket,"getaddrinfo",lambda *args,**kw:[(socket.AF_INET,socket.SOCK_STREAM,6,"",("8.8.8.8",443)),(socket.AF_INET,socket.SOCK_STREAM,6,"",("127.0.0.1",443))])
    with pytest.raises(safe_network.ExternalFetchError,match="NONPUBLIC_DESTINATION"):safe_network.public_addresses("example.com")

def test_connection_pins_validated_ip_and_keeps_original_tls_hostname(monkeypatch):
    calls=[]
    class Sock:
        def close(self):pass
    class Context:
        def wrap_socket(self,sock,server_hostname):
            calls.append(("tls",server_hostname))
            return sock
    monkeypatch.setattr(socket,"create_connection",lambda target,timeout:(calls.append(("connect",target)) or Sock()))
    connection=safe_network.PinnedHTTPSConnection("example.com","8.8.8.8",3)
    connection._context=Context()
    connection.connect()
    assert calls==[("connect",("8.8.8.8",443)),("tls","example.com")]

def test_redirect_and_response_bounds_are_not_followed(monkeypatch):
    class Response:
        status=302
        def getheader(self,*args):return ""
    class Connection:
        sock=None
        def __init__(self,*args):pass
        def request(self,*args,**kw):pass
        def getresponse(self):return Response()
        def close(self):pass
    monkeypatch.setattr(safe_network,"public_addresses",lambda host:["8.8.8.8"])
    monkeypatch.setattr(safe_network,"PinnedHTTPSConnection",Connection)
    with pytest.raises(safe_network.ExternalFetchError,match="HTTP_302"):safe_network.fetch("https://example.com/image")
    Response.status=200
    Response.getheader=lambda self,name,default=None:"9000000" if name=="Content-Length" else "image/png"
    with pytest.raises(safe_network.ExternalFetchError,match="RESPONSE_TOO_LARGE"):safe_network.fetch("https://example.com/image",maximum=100)

def test_upload_uses_real_decoder_and_rejects_mime_mismatch(make_client):
    owner=make_client("super_admin")
    product=draft(owner)
    mismatch=owner.post("/api/admin/media",data={"product_id":product["id"]},files={"file":("wrong.jpg",photo_bytes(),"image/jpeg")})
    assert mismatch.status_code==400
    svg=owner.post("/api/admin/media",files={"file":("bad.svg",b'<svg onload="alert(1)"></svg>',"image/svg+xml")})
    assert svg.status_code==415

def test_remote_image_copy_needs_owner_rights_and_is_ssrf_safe(make_client):
    owner=make_client("super_admin")
    product=draft(owner)
    payload={"product_id":product["id"],"url":"https://127.0.0.1/image.png","rights_holder":"QA author","license":"QA fixture","evidence":"Explicit isolated QA permission","redistribution_allowed":True,"matches_product":True}
    assert owner.post("/api/admin/media/from-url",json=payload).status_code==422
    payload["url"]="https://example.com/photo.png"
    payload["redistribution_allowed"]=False
    assert owner.post("/api/admin/media/from-url",json=payload).status_code==422

def test_feed_limits_and_bad_encoding_are_rejected():
    for raw,name in [(b"\xff\xff","bad.csv"),(b"{}","bad.json"),(b"a"*1_000_001,"large.csv")]:
        with pytest.raises(InvalidCatalog):parse_upload(raw,name)
