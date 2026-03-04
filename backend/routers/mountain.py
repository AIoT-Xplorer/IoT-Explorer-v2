from fastapi import APIRouter, Depends, Request, HTTPException, Header
from db import fetch_all, execute
from fastapi import Query
router = APIRouter()
APP = "mountain"

def get_tenant(x_tenant_id: str | None = Header(default=None)):
    if not x_tenant_id:
        raise HTTPException(400, "Missing X-Tenant-ID header")
    return x_tenant_id

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


@router.get("/value")
async def get_signal_value(
    request: Request,
    signal: str = Query(...),
    tenant: str | None = Depends(get_tenant)
):
    # Returnează ultima valoare pentru signal din measurements
    q = """
    SELECT value
    FROM measurements
    WHERE signal = $1 AND ($2::text IS NULL OR tenant_id = $2)
    ORDER BY ts DESC
    LIMIT 1
    """
    rows = await fetch_all(q, {"signal": signal, "tenant_id": tenant})
    if rows:
        return {"value": rows[0]["value"]}
    return {"value": None}

@router.get("/history")
async def agri_history(limit: int = 10):
    rows = await fetch_all("""
        SELECT topic, payload, received_at
        FROM device_data
        WHERE app_name = 'mountain' AND tenant_id = 'default'
        ORDER BY received_at DESC
        LIMIT $1
    """, {"limit": limit})
    return [dict(r) for r in rows]