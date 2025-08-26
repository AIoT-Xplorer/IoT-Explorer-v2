# import os, asyncpg
# from typing import Optional

# _DB_POOL: Optional[asyncpg.Pool] = None
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://app:pass@db:5432/appdb")

# async def get_pool() -> asyncpg.Pool:
#     global _DB_POOL
#     if _DB_POOL is None:
#         _DB_POOL = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
#     return _DB_POOL

# async def fetch_all(query: str, args: dict = None):
#     pool = await get_pool()
#     async with pool.acquire() as conn:
#         if args is None:
#             return await conn.fetch(query)
#         return await conn.fetch(query, *args.values())

# async def fetch_one(query: str, args: dict = None):
#     pool = await get_pool()
#     async with pool.acquire() as conn:
#         if args is None:
#             return await conn.fetchrow(query)
#         return await conn.fetchrow(query, *args.values())

# async def execute(query: str, args: dict = None):
#     pool = await get_pool()
#     async with pool.acquire() as conn:
#         if args is None:
#             return await conn.execute(query)
#         return await conn.execute(query, *args.values())


import os, asyncpg, json
from typing import Optional

_DB_POOL: Optional[asyncpg.Pool] = None
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://app:pass@db:5432/appdb")

async def get_pool() -> asyncpg.Pool:
    global _DB_POOL
    if _DB_POOL is None:
        _DB_POOL = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
    return _DB_POOL

async def fetch_all(query: str, args: dict = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if args is None:
            return await conn.fetch(query)
        return await conn.fetch(query, *args.values())

async def fetch_one(query: str, args: dict = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if args is None:
            return await conn.fetchrow(query)
        return await conn.fetchrow(query, *args.values())

async def execute(query: str, args: dict = None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if args is None:
            return await conn.execute(query)

        processed_args = []
        for v in args.values():
            if isinstance(v, dict):
                # convertește dict în string JSON compatibil cu JSONB
                processed_args.append(json.dumps(v))
            else:
                processed_args.append(v)

        return await conn.execute(query, *processed_args)
