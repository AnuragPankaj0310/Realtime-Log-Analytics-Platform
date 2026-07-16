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
            cls._instance.logger = logging.getLogger("payment-service.producer")
            cls._instance.producer = None
        return cls._instance

    def initialize(self) -> None:
        if self.producer is None:
            try:
                self.producer = KafkaProducer(
                    bootstrap_servers=settings.kafka_bootstrap_servers.split(","),
                    value_serializer=lambda value: json.dumps(value).encode("utf-8"),
                    retries=3,
                )
            except Exception as exc:
                self.logger.exception("Kafka producer initialization failed: %s", exc)

    def publish_event(self, event) -> None:
        self.initialize()
        if self.producer is None:
            return
        try:
            self.producer.send(settings.kafka_topic, event.model_dump(mode="json"))
        except Exception as exc:
            self.logger.exception("Kafka publish failed: %s", exc)

    def close(self) -> None:
        if self.producer is not None:
            self.producer.close()
            self.producer = None


producer = KafkaEventProducer()
