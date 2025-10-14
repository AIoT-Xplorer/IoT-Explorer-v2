from fastapi import APIRouter, Depends, Request, Query
from db import fetch_all

router = APIRouter()

def get_tenant(request: Request) -> str | None:
    return getattr(request.state, "tenant", None)

@router.get("/latest")
async def latest_energy(signal: str = Query("power"), limit: int = Query(50, ge=1, le=1000), request: Request = None):
    tenant = getattr(request.state, "tenant", None)
    q = """
    SELECT device_id, signal, ts, value, extra
    FROM measurements
    WHERE app_id = 'energy' AND signal = $1 AND ($2::text IS NULL OR tenant_id = $2)
    ORDER BY ts DESC
    LIMIT $3
    """
    rows = await fetch_all(q, {"signal": signal, "tenant": tenant, "limit": limit})
    return [dict(r) for r in rows]
