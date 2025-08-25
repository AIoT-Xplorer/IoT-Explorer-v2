import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

REQUIRE_TENANT = os.getenv("REQUIRE_TENANT_HEADER", "true").lower() == "true"

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant = request.headers.get("X-Tenant-ID")
        # keep it permissive for demo (allow None); tighten in prod
        if REQUIRE_TENANT and not tenant:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Missing X-Tenant-ID header")
        request.state.tenant = tenant
        response = await call_next(request)
        return response