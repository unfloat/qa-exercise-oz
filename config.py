from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROXY_SERVICE_HOST: str = "127.0.0.1"
    PROXY_SERVICE_PORT: int = 8000
    PROXY_TARGET_HOST: str = "127.0.0.1"
    PROXY_TARGET_PORT: int = 8085


@lru_cache()
def get_settings():
    return Settings()
