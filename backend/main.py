from fastapi import FastAPI
from middleware import TenantMiddleware
from routers import devices, env, energy, glove, medical, mountain, agri

app = FastAPI(title="IoT Multi-tenant API", version="0.1.0")

# Attach tenant resolution (header-based for starter)
app.add_middleware(TenantMiddleware)

# Routers per "app"
app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(env.router,     prefix="/api/agri",     tags=["agri"])
app.include_router(energy.router,  prefix="/api/energy",  tags=["energy"])

app.include_router(glove.router,  prefix="/api/glove",  tags=["glove"])
app.include_router(medical.router,  prefix="/api/medical",  tags=["medical"])
app.include_router(mountain.router,  prefix="/api/mountain",  tags=["mountain"])
app.include_router(agri.router,  prefix="/api/agri",  tags=["agri"])

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
