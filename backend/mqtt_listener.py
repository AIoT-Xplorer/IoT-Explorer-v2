# # backend/mqtt_listener.py
# import asyncio
# from asyncio_mqtt import Client
# import logging

# logger = logging.getLogger(__name__)

# MQTT_HOST = "mosquitto"  # numele serviciului din docker-compose
# MQTT_PORT = 1883

# # cache simplu în memorie
# latest_messages = {}

# async def handle_messages():
#     """
#     Ascultă topicuri MQTT și salvează ultimul payload în latest_messages.
#     """
#     async with Client(MQTT_HOST, MQTT_PORT) as client:
#         # ascultă toate mesajele sub "devices/"
#         await client.subscribe("devices/#")
#         await client.subscribe("glove/#")

#         async with client.unfiltered_messages() as messages:
#             async for message in messages:
#                 payload = message.payload.decode()
#                 topic = message.topic
#                 logger.info(f"[MQTT] {topic} -> {payload}")
#                 latest_messages[topic] = payload

# backend/mqtt_listener.py
import asyncio
import json
from asyncio_mqtt import Client
import logging
import db  #

logger = logging.getLogger(__name__)

MQTT_HOST = "mosquitto"  # numele serviciului din docker-compose
MQTT_PORT = 1883

# cache simplu în memorie (ultimul mesaj per topic)
latest_messages = {}

async def handle_messages():
    """
    Ascultă topicuri MQTT și salvează ultimul payload atât în cache, cât și în DB.
    """
    async with Client(MQTT_HOST, MQTT_PORT) as client:
        # ascultă toate mesajele pentru toate aplicațiile
        await client.subscribe("#")

        async with client.unfiltered_messages() as messages:
            async for message in messages:
                payload = message.payload.decode()
                topic = message.topic
                logger.info(f"[MQTT] {topic} -> {payload}")

                # salvează în cache
                latest_messages[topic] = payload

                # derivează app_name din prefix topic (ex: "glove", "energy", "medical")
                app_name = topic.split("/")[0] if "/" in topic else "unknown"

                # salvează și în baza de date
                try:
                    await db.execute(
                        """
                        INSERT INTO device_data (tenant_id, app_name, topic, payload)
                        VALUES ($1, $2, $3, $4)
                        """,
                        {
                            "tenant_id": "default",   # pentru început, poți înlocui cu header din API gateway
                            "app_name": app_name,
                            "topic": topic,
                            "payload": json.loads(payload)
                        }
                    )
                except Exception as e:
                    logger.error(f"[DB ERROR] {e}")
