from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "aiotdb")
DB_USER = os.getenv("DB_USER", "aiot")
DB_PASS = os.getenv("DB_PASS", "tmgVCRphbUcc")
DB_PORT = os.getenv("DB_PORT", "5432")


def get_measurements():
    query = """
        SELECT tenant_id, device_id, signal, value, ts
        FROM measurements
        WHERE tenant_id = 'gamma'
          AND signal IN ('tmp007', 'oxygen', 'gsr')
        ORDER BY ts DESC
        LIMIT 500;
    """
    conn = psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


@app.get("/api/data")
def read_data():
    return get_measurements()
