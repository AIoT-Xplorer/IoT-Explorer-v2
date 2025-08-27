import os, re, json, asyncio
import aiomqtt
from db import write_measurement

MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER")      # None când e anonim
MQTT_PASS = os.getenv("MQTT_PASS")
TOPIC_FILTER = os.getenv("TOPIC_FILTER", "$share/ingestors/tenants/+/+/+/+")

TOPIC_RE = re.compile(r"^tenants/(?P<tenant>[^/]+)/(?P<app>[^/]+)/(?P<device>[^/]+)/(?P<signal>[^/]+)$")

async def handle(topic: str, payload: bytes):
    m = TOPIC_RE.match(topic)
    if not m:
        return
    meta = m.groupdict()
    try:
        data = json.loads(payload.decode("utf-8"))
    except Exception:
        data = {"raw": payload.decode("utf-8", errors="replace")}

    await write_measurement(
        tenant_id=meta["tenant"],
        app_id=meta["app"],
        device_id=meta["device"],
        signal=meta["signal"],
        ts=data.get("ts"),
        value=data.get("value"),
        extra=json.dumps(data)
    )

async def main():
    print(f"[ingestor] MQTT {MQTT_HOST}:{MQTT_PORT} user={MQTT_USER or '-'}")
    kwargs = {}
    if MQTT_USER and MQTT_PASS:
        kwargs.update(dict(username=MQTT_USER, password=MQTT_PASS))

    async with aiomqtt.Client(MQTT_HOST, MQTT_PORT, **kwargs) as client:
        await client.subscribe(TOPIC_FILTER, qos=1)
        async with client.messages() as messages:
            async for message in messages:
                asyncio.create_task(handle(message.topic.value, message.payload))

if __name__ == "__main__":
    asyncio.run(main())
