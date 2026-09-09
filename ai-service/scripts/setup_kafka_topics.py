import logging
from services.kafka_client import create_topics

logging.basicConfig(level=logging.INFO)

TOPICS = [
    "market-prices",
    "shipment-events",
    "inventory-events",
    "traceability-events",
    "notification-events",
    "price-predictions",
    "data-source-status",
    "dead-letter-events"
]

if __name__ == "__main__":
    logging.info("Setting up Kafka topics...")
    create_topics(TOPICS)
    logging.info("Topic setup complete.")
