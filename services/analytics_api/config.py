from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    elasticsearch_host: str = "http://elasticsearch:9200"
    elasticsearch_index: str = "application-logs"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
