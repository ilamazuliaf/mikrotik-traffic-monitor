import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if present
BASE_DIR = Path(__file__).resolve().parent.parent
env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)

class Config:
    MIKROTIK_HOST: str = os.getenv("MIKROTIK_HOST", "192.168.88.1")
    MIKROTIK_PORT: int = int(os.getenv("MIKROTIK_PORT", "8728"))
    MIKROTIK_USERNAME: str = os.getenv("MIKROTIK_USERNAME", "monitor")
    MIKROTIK_PASSWORD: str = os.getenv("MIKROTIK_PASSWORD", "password")
    MIKROTIK_USE_SSL: bool = os.getenv("MIKROTIK_USE_SSL", "false").lower() in ("true", "1", "yes")

    # Monitored interfaces split into list
    _monitored_str: str = os.getenv("MONITORED_INTERFACES", "ether1-BAROKAH,ether2-BIZ,ether3-WAHED")
    MONITORED_INTERFACES: list[str] = [i.strip() for i in _monitored_str.split(",") if i.strip()]

    POLL_INTERVAL: int = int(os.getenv("POLL_INTERVAL", "5"))
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "traffic.db"))

    WEB_HOST: str = os.getenv("WEB_HOST", "0.0.0.0")
    WEB_PORT: int = int(os.getenv("WEB_PORT", "8080"))

config = Config()
