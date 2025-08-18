# backend/app.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"ok": True, "msg": "Backend FastAPI activ"}

@app.get("/health")
def health():
    return "ok"
