from fastapi import APIRouter
from app.config import config

router = APIRouter()

@router.get("/config")
def get_config():
    """Returns dynamic configuration for frontend UI initialization (PRD Section 6 & 32)."""
    return {
        "interfaces": config.MONITORED_INTERFACES,
        "graph_periods": config.get_parsed_periods(),
        "default_period": config.GRAPH_DEFAULT_PERIOD,
        "realtime_max": config.GRAPH_REALTIME_MAX,
        "poll_interval": config.POLL_INTERVAL
    }
