"""Pinned public-IP HTTPS. Redirects, environment proxies and DNS rebinding are rejected."""
import http.client
import ipaddress
import json
import socket
import ssl
import time
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

class ExternalFetchError(Exception):
    def __init__(self,code,retryable=False):
        self.code,self.retryable=code,retryable
        super().__init__(code)

def is_public(address):
    mapped=getattr(address,"ipv4_mapped",None)
    if mapped:return is_public(mapped)
    return address.is_global and not (address.is_multicast or address.is_reserved or address.is_loopback or address.is_link_local or address.is_unspecified)

def validate_url(value):
    if not isinstance(value,str) or not value or len(value)>2000 or any(ord(c)<33 for c in value) or "\\" in value:
        raise ExternalFetchError("INVALID_URL")
    try:
        parts=urlsplit(value)
        if parts.scheme!="https" or not parts.hostname or parts.username or parts.password or parts.fragment or parts.port not in {None,443}:
            raise ValueError()
        host=parts.hostname.encode("idna").decode("ascii")
        if "%" in host or host.rstrip(".").lower() in {"localhost","localhost.localdomain"}:raise ValueError()
        try:address=ipaddress.ip_address(host)
        except ValueError:address=None
        if address and not is_public(address):raise ValueError()
        secret_keys={"key","api_key","apikey","token","access_token","password","secret","signature","credential"}
        for key,_ in parse_qsl(parts.query):
            key=key.casefold().replace("-","_")
            if key in secret_keys or key.startswith(("x_amz_","x_goog_")) or any(key.endswith("_"+suffix) for suffix in secret_keys):raise ValueError()
    except (ValueError,UnicodeError):
        raise ExternalFetchError("UNSAFE_URL") from None
    return parts,host

def public_addresses(host):
    try:
        found=list(dict.fromkeys(row[4][0] for row in socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)))
        if not found or any(not is_public(ipaddress.ip_address(address)) for address in found):
            raise ExternalFetchError("NONPUBLIC_DESTINATION")
        return found
    except ExternalFetchError:raise
    except (OSError,ValueError):raise ExternalFetchError("DNS_FAILURE",True) from None

class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self,host,address,timeout):
        super().__init__(host,443,timeout=timeout,context=ssl.create_default_context())
        self.pinned_address=address
    def connect(self):
        raw=socket.create_connection((self.pinned_address,443),self.timeout)
        try:self.sock=self._context.wrap_socket(raw,server_hostname=self.host)
        except BaseException:raw.close();raise

@dataclass
class Fetched:
    body:bytes
    content_type:str
    status:int

def fetch(url,*,method="GET",headers=None,payload=None,params=None,maximum=2_000_000,timeout=15):
    parts,host=validate_url(url)
    if method not in {"GET","POST"}:raise ExternalFetchError("UNSUPPORTED_METHOD")
    addresses=public_addresses(host)
    query=dict(parse_qsl(parts.query,keep_blank_values=True))
    query.update({str(k):str(v) for k,v in (params or {}).items()})
    target=urlunsplit(("","",parts.path or "/",urlencode(query),""))
    outgoing={"User-Agent":"GlowNuture/4.0 (https://glownuture.com)","Accept":"application/json","Accept-Encoding":"identity"}
    for key,value in (headers or {}).items():
        if key.casefold() in {"host","connection","transfer-encoding","content-length"} or any(c in key+str(value) for c in "\r\n"):
            raise ExternalFetchError("UNSAFE_HEADER")
        outgoing[key]=str(value)
    raw=None
    if payload is not None:
        raw=json.dumps(payload,separators=(",",":")).encode()
        outgoing["Content-Type"]="application/json"
    deadline=time.monotonic()+30
    connection=PinnedHTTPSConnection(host,addresses[0],timeout)
    try:
        connection.request(method,target,body=raw,headers=outgoing)
        response=connection.getresponse()
        if response.status!=200:
            raise ExternalFetchError("HTTP_"+str(response.status),response.status in {429,500,502,503,504})
        length=response.getheader("Content-Length")
        if length:
            try:
                if int(length)<0 or int(length)>maximum:raise ExternalFetchError("RESPONSE_TOO_LARGE")
            except ValueError:raise ExternalFetchError("INVALID_CONTENT_LENGTH") from None
        body=bytearray()
        while True:
            remaining=deadline-time.monotonic()
            if remaining<=0:raise ExternalFetchError("TOTAL_TIMEOUT",True)
            if connection.sock:connection.sock.settimeout(min(timeout,remaining))
            chunk=response.read(min(65536,maximum+1-len(body)))
            if not chunk:break
            body.extend(chunk)
            if len(body)>maximum:raise ExternalFetchError("RESPONSE_TOO_LARGE")
        return Fetched(bytes(body),response.getheader("Content-Type","").split(";")[0].strip().lower(),response.status)
    except ExternalFetchError:raise
    except (OSError,http.client.HTTPException,ssl.SSLError):
        raise ExternalFetchError("NETWORK_OR_TLS_FAILURE",True) from None
    finally:connection.close()
