from fastapi import FastAPI
from middleware import TenantMiddleware
from routers import devices, env, energy, glove, medical, mountain, agri
import asyncio
from mqtt_listener import handle_messages, latest_messages
from db import fetch_all, execute

app = FastAPI(title="IoT Multi-tenant API", version="0.1.0")

app.add_middleware(TenantMiddleware)

app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(env.router,     prefix="/api/env",     tags=["env"])
app.include_router(energy.router,  prefix="/api/energy",  tags=["energy"])
app.include_router(glove.router,   prefix="/api/glove",   tags=["glove"])
app.include_router(medical.router, prefix="/api/medical", tags=["medical"])
app.include_router(mountain.router,prefix="/api/mountain",tags=["mountain"])
app.include_router(agri.router,    prefix="/api/agri",    tags=["agri"])

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(handle_messages())

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/api/devices/latest")
async def get_latest():
    """
    Ultimul payload primit pe fiecare topic MQTT.
    """
    return latest_messages

#De Test
@app.get("/api/glove/history")
async def glove_history(limit: int = 10):
    rows = await fetch_all("""
        SELECT topic, payload, received_at
        FROM device_data
        WHERE app_name = 'glove'
        ORDER BY received_at DESC
        LIMIT $1
    """, {"limit": limit})
    return [dict(r) for r in rows]