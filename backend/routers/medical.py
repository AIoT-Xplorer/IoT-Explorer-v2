from fastapi import APIRouter, Depends, Request
from ..db import fetch_all, execute

router = APIRouter()

def get_tenant(request: Request) -> str | None:
    return getattr(request.state, "tenant", None)

@router.get("")
async def list_devices(request: Request, tenant: str | None = Depends(get_tenant)):
    q = "SELECT device_id, app_id, meta FROM devices WHERE ($1::text IS NULL OR tenant_id = $1) ORDER BY app_id, device_id"
    rows = await fetch_all(q, {"tenant": tenant})
    return [dict(r) for r in rows]

@router.post("")
async def upsert_device(device: dict, request: Request, tenant: str | None = Depends(get_tenant)):
    # expects device = {"app_id": "...", "device_id": "...", "meta": {...}}
    q = """
    INSERT INTO devices(tenant_id, app_id, device_id, meta)
    VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb))
    ON CONFLICT (tenant_id, app_id, device_id)
    DO UPDATE SET meta = EXCLUDED.meta
    """
    await execute(q, {"tenant": tenant, "app_id": device.get("app_id"), "device_id": device.get("device_id"), "meta": device.get("meta")})
    return {"ok": True}
