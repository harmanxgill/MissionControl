from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://mc:mc@localhost:5432/missioncontrol"
    redis_url: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"


settings = Settings()
