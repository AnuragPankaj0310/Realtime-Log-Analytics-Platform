from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_topic: str = "application-logs"
    checkpoint_location: str = "/data/checkpoints"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
