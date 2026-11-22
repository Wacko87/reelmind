import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings

def _get_or_create_secret_key(data_dir: str) -> str:
    env_secret = os.getenv("SECRET_KEY")
    if env_secret:
        return env_secret
    key_file = os.path.join(data_dir, ".secret_key")
    if os.path.exists(key_file):
        try:
            with open(key_file, "r", encoding="utf-8") as f:
                saved = f.read().strip()
                if saved:
                    return saved
        except Exception:
            pass
    new_key = secrets.token_hex(32)
    try:
        os.makedirs(data_dir, exist_ok=True)
        # Escribir con permisos restrictivos (0600) para blindar la clave secreta
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        mode = 0o600
        fd = os.open(key_file, flags, mode)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(new_key)
    except Exception:
        pass
    return new_key

class Settings(BaseSettings):
    APP_NAME: str = "ReelMind"
    DATA_DIR: str = os.getenv("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data"))
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # Seguridad y autenticación
    AUTH_PIN: str = os.getenv("AUTH_PIN", "3004")  # PIN de acceso por defecto: 3004 (configurable vía .env)
    SERVICE_API_KEY: str = os.getenv("SERVICE_API_KEY", "reelmind_sync_internal_service_key_2026")  # Token de servicio estático para demonios (ej. sync-reelmind-obsidian)
    SECRET_KEY: str = ""
    MAX_VIDEO_DURATION_SECONDS: int = int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "600")) # 10 min
    MAX_FILESIZE_BYTES: int = 50 * 1024 * 1024 # 50 MB

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY:
            self.SECRET_KEY = _get_or_create_secret_key(self.DATA_DIR)

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.DATA_DIR, "temp"), exist_ok=True)
