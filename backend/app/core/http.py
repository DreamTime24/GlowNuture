"""Bound request bodies and apply browser security headers without exposing exception details."""
import logging
from starlette.responses import JSONResponse
from .config import get_settings
S=get_settings()
class SecurityMiddleware:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope["type"]!="http":return await self.app(scope,receive,send)
        if scope["method"] in {"POST","PUT","PATCH"}:
            maximum={"/api/admin/media":6_000_000,"/api/admin/catalog/uploads":1_200_000}.get(scope["path"],256_000)
            chunks=[];length=0
            while True:
                item=await receive()
                if item["type"]=="http.disconnect":return
                length+=len(item.get("body",b""))
                if length>maximum:return await JSONResponse({"detail":"Request is too large"},413)(scope,receive,send)
                chunks.append(item)
                if not item.get("more_body"):break
            async def bounded_receive():return chunks.pop(0) if chunks else await receive()
        else:bounded_receive=receive
        started=False
        async def protected_send(message):
            nonlocal started
            if message["type"]=="http.response.start":
                started=True;headers=list(message.get("headers",[]))
                policy={
                    "X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"strict-origin-when-cross-origin",
                    "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=()",
                    "Content-Security-Policy":"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; worker-src 'self'; manifest-src 'self'; connect-src 'self' https://apis.google.com https://*.googleapis.com https://*.firebaseapp.com https://*.firebasedatabase.app https://*.firebaseio.com https://*.google-analytics.com https://www.google.com; frame-src https://apis.google.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net https://www.facebook.com https://accounts.google.com; form-action 'self' https://sandbox.sslcommerz.com https://securepay.sslcommerz.com"+("; upgrade-insecure-requests" if S.app_env=="production" else "")
                }
                if scope["path"].startswith("/api/"):policy["Cache-Control"]="no-store"
                if S.app_env=="production":policy["Strict-Transport-Security"]="max-age=31536000"
                existing={key.lower() for key,_ in headers}
                headers.extend((key.lower().encode(),value.encode()) for key,value in policy.items() if key.lower().encode() not in existing)
                message={**message,"headers":headers}
            await send(message)
        try:await self.app(scope,bounded_receive,protected_send)
        except Exception as error:
            logging.getLogger("glownuture").error("Request failed: %s",type(error).__name__)
            if started:raise
            await JSONResponse({"detail":"The request could not be completed. Please try again."},500)(scope,bounded_receive,protected_send)
