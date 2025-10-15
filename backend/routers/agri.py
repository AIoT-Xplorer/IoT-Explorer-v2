from fastapi import Query

from fastapi import APIRouter, Depends, Request
from db import fetch_all, execute

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
    rows = await fetch_all(q, {"signal": signal, "tenant": tenant})
    if rows:
        return {"value": rows[0]["value"]}
    return {"value": None}

@router.get("/history")
async def agri_history(limit: int = 10):
    rows = await fetch_all("""
        SELECT topic, payload, received_at
        FROM device_data
        WHERE app_name = 'agri' AND tenant_id = 'default'
        ORDER BY received_at DESC
        LIMIT $1
    """, {"limit": limit})
    return [dict(r) for r in rows]

@router.post("/selectPlant")
async def choose_plant(request: Request):
    """
    Primește body text simplu (ex: ficus)
    și publică pe MQTT la topicul:
    tenants/Alpha/agri/esp32_Alpha/selectPlant
    """
    plant = (await request.body()).decode("utf-8").strip()
    if not plant:
        return {"ok": False, "error": "Missing plant name"}

    topic = "tenants/Alpha/agri/esp32_Alpha/selectPlant"
    payload = plant

    MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
    MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

    try:
        async with aiomqtt.Client(MQTT_HOST, MQTT_PORT) as client:
            await client.publish(topic, payload.encode("utf-8"))
        print(f"[MQTT] Published to {topic}: {payload}")
        return {"ok": True, "topic": topic, "payload": payload}
    except Exception as e:
        print(f"[MQTT ERROR] {e}")
        return {"ok": False, "error": str(e)}