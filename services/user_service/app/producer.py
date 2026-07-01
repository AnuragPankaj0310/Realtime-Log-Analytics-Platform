import json
import logging
from typing import Optional

from kafka import KafkaProducer

from .config import settings


class KafkaEventProducer:
    _instance: Optional["KafkaEventProducer"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.logger = logging.getLogger("user-service.producer")
            cls._instance.producer = None
        return cls._instance

    def initialize(self) -> None:
        if self.producer is None:
            try:
                self.producer = KafkaProducer(
                    bootstrap_servers=settings.kafka_bootstrap_servers.split(","),
                    value_serializer=lambda value: json.dumps(value, default=str).encode("utf-8"),
                    retries=3,
                )
                self.logger.info("Kafka producer initialized")
            except Exception as exc:  # pragma: no cover - defensive path
                self.logger.exception("Failed to initialize Kafka producer: %s", exc)

    def publish_event(self, event) -> None:
        self.initialize()
        if self.producer is None:
            self.logger.warning("Kafka producer is not available")
            return
        try:
            future = self.producer.send(
                settings.kafka_topic,
                event.model_dump(mode="json")
            )

            metadata = future.get(timeout=10)

            self.producer.flush()

            self.logger.info(
                f"Sent to topic={metadata.topic}, "
                f"partition={metadata.partition}, "
                f"offset={metadata.offset}"
            )
            self.logger.info("Queued event for Kafka", extra={"event": event.event})
        except Exception as exc:  # pragma: no cover - defensive path
            self.logger.exception("Failed to publish event: %s", exc)

    def close(self) -> None:
        if self.producer is not None:
            self.producer.close()
            self.producer = None
            self.logger.info("Kafka producer closed")


producer = KafkaEventProducer()
