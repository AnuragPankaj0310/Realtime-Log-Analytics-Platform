from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    elasticsearch_host: str = "http://elasticsearch:9200"
    elasticsearch_index: str = "log-analytics"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
