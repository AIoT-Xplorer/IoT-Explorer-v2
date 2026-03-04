from fastapi import APIRouter, Depends, Request, Query
from db import fetch_all, fetch_one
from datetime import datetime

router = APIRouter()

def get_tenant(request: Request) -> str | None:
    return getattr(request.state, "tenant", None)

# --- Endpoint pentru valoarea curentă ---
@router.get("/value")
async def get_latest_value(
    signal: str = Query(...),
    request: Request = None,
    tenant: str | None = Depends(get_tenant)
):
    q = """
        SELECT value, ts
        FROM measurements
        WHERE app_id = 'medical'
          AND signal = $1
          AND ($2::text IS NULL OR tenant_id = $2)
        ORDER BY ts DESC
        LIMIT 1
    """
    row = await fetch_one(q, {"signal": signal, "tenant": tenant})
    if row:
        return {"value": row["value"], "ts": row["ts"]}
    return {"value": None, "ts": None}

# --- Endpoint pentru istoric ---
@router.get("/history")
async def get_signal_history(
    signal: str = Query(...),
    from_ts: str | None = Query(None),
    to_ts: str | None = Query(None),
    step: str | None = Query(None),
    request: Request = None,
    tenant: str | None = Depends(get_tenant)
):
    q = """
        SELECT ts, value
        FROM measurements
        WHERE app_id = 'medical'
          AND signal = $1
          AND ($2::text IS NULL OR tenant_id = $2)
          AND ($3::timestamptz IS NULL OR ts >= $3)
          AND ($4::timestamptz IS NULL OR ts <= $4)
        ORDER BY ts ASC
        LIMIT 500
    """
    rows = await fetch_all(q, {"signal": signal, "tenant": tenant, "from_ts": from_ts, "to_ts": to_ts})
    return [dict(r) for r in rows]
