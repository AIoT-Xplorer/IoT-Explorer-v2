import os, json, asyncpg
from typing import Optional, Mapping, Any

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://app:pass@db:5432/appdb")
_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            command_timeout=10,   # safety
        )
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

async def write_measurement(
    tenant_id: str,
    app_id: str,
    device_id: str,
    signal: str,
    ts,                       # str/datetime/None
    value,                    # str/float/None
    extra: Any                # dict/str/None
):
    # normalize value & extra
    v = None if value is None or value == "" else value
    if isinstance(v, str):
        try:
            v = float(v)
        except ValueError:
            v = None

    extra_str: str
    if isinstance(extra, (dict, list)):
        extra_str = json.dumps(extra)
    elif isinstance(extra, str):
        extra_str = extra
    else:
        extra_str = "{}"

    pool = await get_pool()
    async with pool.acquire() as conn:
        # o singură tranzacție pentru ambele operații
        async with conn.transaction():
            # (opțional) limitează cât poate sta blocat
            await conn.execute("SET LOCAL statement_timeout = 5000")

            # UPSERT pe measurements (sau DO NOTHING, după nevoie)
            await conn.execute(
                """
                INSERT INTO measurements(tenant_id, app_id, device_id, signal, ts, value, extra)
                VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), ($6)::double precision, $7::jsonb)
                ON CONFLICT (tenant_id, app_id, device_id, signal, ts)
                DO UPDATE SET value = EXCLUDED.value, extra = EXCLUDED.extra
                """,
                tenant_id, app_id, device_id, signal, ts, v, extra_str
            )

            # auto-register device (DO NOTHING dacă există)
            await conn.execute(
                """
                INSERT INTO devices(tenant_id, app_id, device_id, meta)
                VALUES ($1, $2, $3, '{}'::jsonb)
                ON CONFLICT (tenant_id, app_id, device_id) DO NOTHING
                """,
                tenant_id, app_id, device_id
            )
