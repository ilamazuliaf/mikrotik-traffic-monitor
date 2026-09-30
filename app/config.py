import os
import re
import logging
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger("mikrotik_monitor")

BASE_DIR = Path(__file__).resolve().parent.parent
env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)

def parse_period_to_seconds(period_str: str) -> int:
    """Converts time string like 5m, 1h, 24h, 7d into seconds."""
    if not period_str:
        return 900
    period_str = str(period_str).strip().lower()
    match = re.match(r"^(\d+)([mhd])$", period_str)
    if not match:
        return 900
    val = int(match.group(1))
    unit = match.group(2)
    if unit == 'm':
        return val * 60
    elif unit == 'h':
        return val * 3600
    elif unit == 'd':
        return val * 86400
    return 900

def get_period_label(period_str: str) -> str:
    """Generates human readable label for period string."""
    period_str = str(period_str).strip().lower()
    match = re.match(r"^(\d+)([mhd])$", period_str)
    if not match:
        return period_str
    val = match.group(1)
    unit = match.group(2)
    if unit == 'm':
        return f"{val} Menit"
    elif unit == 'h':
        return f"{val} Jam"
    elif unit == 'd':
        return f"{val} Hari"
    return period_str

class Config:
    MIKROTIK_HOST: str = os.getenv("MIKROTIK_HOST", "192.168.88.1")
    MIKROTIK_PORT: int = int(os.getenv("MIKROTIK_PORT", "8728"))
    MIKROTIK_USERNAME: str = os.getenv("MIKROTIK_USERNAME", "monitor")
    MIKROTIK_PASSWORD: str = os.getenv("MIKROTIK_PASSWORD", "password")
    MIKROTIK_USE_SSL: bool = os.getenv("MIKROTIK_USE_SSL", "false").lower() in ("true", "1", "yes")

    # Monitored interfaces split into list (Single source of truth)
    _monitored_str: str = os.getenv("MONITORED_INTERFACES", "ether1-BAROKAH,ether2-BIZ,ether3-WAHED")
    MONITORED_INTERFACES: list[str] = [i.strip() for i in _monitored_str.split(",") if i.strip()]

    POLL_INTERVAL: int = int(os.getenv("POLL_INTERVAL", "5"))
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "traffic.db"))

    WEB_HOST: str = os.getenv("WEB_HOST", "0.0.0.0")
    WEB_PORT: int = int(os.getenv("WEB_PORT", "8080"))

    # New PRD v1.1.0 Graph Configs
    _periods_str: str = os.getenv("GRAPH_PERIODS", "5m,15m,30m,1h,6h,12h,24h")
    GRAPH_PERIODS: list[str] = [p.strip() for p in _periods_str.split(",") if p.strip()]

    GRAPH_DEFAULT_PERIOD: str = os.getenv("GRAPH_DEFAULT_PERIOD", "15m").strip()
    GRAPH_REALTIME_MAX: str = os.getenv("GRAPH_REALTIME_MAX", "30m").strip()
    GRAPH_REFRESH_INTERVAL: int = int(os.getenv("GRAPH_REFRESH_INTERVAL", "5000"))
    GRAPH_MAX_POINTS: int = int(os.getenv("GRAPH_MAX_POINTS", "500"))

    def validate_config(self):
        """Validates configuration at application startup (PRD Section 35 & 36)."""
        if self.GRAPH_DEFAULT_PERIOD not in self.GRAPH_PERIODS:
            logger.warning(
                f"Invalid GRAPH_DEFAULT_PERIOD='{self.GRAPH_DEFAULT_PERIOD}'. "
                f"Must be one of {self.GRAPH_PERIODS}. Falling back to '{self.GRAPH_PERIODS[0]}'."
            )
            self.GRAPH_DEFAULT_PERIOD = self.GRAPH_PERIODS[0]

        realtime_max_sec = parse_period_to_seconds(self.GRAPH_REALTIME_MAX)
        logger.info(
            f"Config loaded: MONITORED_INTERFACES={self.MONITORED_INTERFACES}, "
            f"GRAPH_PERIODS={self.GRAPH_PERIODS}, DEFAULT={self.GRAPH_DEFAULT_PERIOD}, "
            f"REALTIME_MAX={self.GRAPH_REALTIME_MAX} ({realtime_max_sec}s)"
        )

    def get_parsed_periods(self) -> list[dict]:
        """Returns structured period configuration for /api/config."""
        realtime_max_sec = parse_period_to_seconds(self.GRAPH_REALTIME_MAX)
        result = []
        for p in self.GRAPH_PERIODS:
            p_sec = parse_period_to_seconds(p)
            mode = "realtime" if p_sec <= realtime_max_sec else "historical"
            result.append({
                "value": p,
                "label": get_period_label(p),
                "mode": mode
            })
        return result

    def get_max_period_hours(self) -> int:
        """Returns maximum retention hours needed based on GRAPH_PERIODS."""
        max_sec = 86400 # default 24h
        for p in self.GRAPH_PERIODS:
            sec = parse_period_to_seconds(p)
            if sec > max_sec:
                max_sec = sec
        # Add 2 hours safety buffer
        return int((max_sec / 3600) + 2)

config = Config()

