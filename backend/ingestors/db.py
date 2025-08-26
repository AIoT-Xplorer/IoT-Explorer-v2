import os, asyncpg
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://app:pass@db:5432/appdb")
_pool: Optional[asyncpg.Pool] = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool

async def write_measurement(tenant_id: str, app_id: str, device_id: str, signal: str, ts, value, extra):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO measurements(tenant_id, app_id, device_id, signal, ts, value, extra)
            VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6, $7::jsonb)
            ON CONFLICT (tenant_id, app_id, device_id, signal, ts) DO NOTHING
            """,
            tenant_id, app_id, device_id, signal, ts, value, extra
        )
        # optional: auto-register device
        await conn.execute(
            """
            INSERT INTO devices(tenant_id, app_id, device_id, meta)
            VALUES ($1, $2, $3, '{}'::jsonb)
            ON CONFLICT (tenant_id, app_id, device_id) DO NOTHING
            """,
            tenant_id, app_id, device_id
        )
