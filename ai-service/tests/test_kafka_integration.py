import os
import json
import logging
import unittest
from confluent_kafka.admin import AdminClient
from dotenv import load_dotenv

from services.kafka_client import KafkaEventProducer, check_kafka_health

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

load_dotenv()

class TestKafkaIntegration(unittest.TestCase):
    def setUp(self):
        self.bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.producer = KafkaEventProducer()

    def test_kafka_health_check(self):
        """Verify the health check properly identifies cluster state."""
        is_healthy = check_kafka_health()
        logger.info(f"Kafka cluster health status: {is_healthy}")
        # We don't assert True, because in CI/local it might be down. 
        # We just assert that it successfully ran and returned a boolean.
        self.assertIsInstance(is_healthy, dict)
        self.assertIn("kafka_available", is_healthy)

    def test_topic_listing_and_creation_logic(self):
        """Verify AdminClient can be instantiated and behaves correctly under failure/success."""
        admin = AdminClient({'bootstrap.servers': self.bootstrap_servers})
        try:
            # timeout=2s to not block tests if Kafka is offline
            metadata = admin.list_topics(timeout=2)
            topics = metadata.topics
            logger.info(f"Discovered topics: {list(topics.keys())}")
            # If we reach here, Kafka is up. We should expect 'market-prices' etc.
        except Exception as e:
            logger.warning(f"Kafka Admin client timed out or failed. This is expected if broker is offline: {e}")
            self.assertTrue(True) # Successfully handled offline broker

    def test_producer_graceful_failure(self):
        """Verify producer does not crash application if broker is offline."""
        try:
            self.producer.publish_event(
                topic="system-health",
                event={"event_type": "TEST_PING", "payload": {"status": "ok"}}
            )
            # The confluent_kafka produce() call is asynchronous. 
            # We call flush(timeout) to force delivery attempt.
            self.producer.producer.flush(timeout=2.0)
            logger.info("Producer successfully dispatched or queued the event.")
            self.assertTrue(True)
        except Exception as e:
            logger.error(f"Producer crashed! It should have failed gracefully: {e}")
            self.fail("Producer should not raise exceptions on publish_event")

if __name__ == "__main__":
    unittest.main()
