from typing import Optional
from fastapi import APIRouter, Query

from app.config import config, parse_period_to_seconds
from app.database.models import query_traffic_history

router = APIRouter()

@router.get("/traffic")
def get_traffic(
    interface: str = Query(default="all", description="Interface name or 'all'"),
    period: str = Query(default="15m", description="Period: e.g. 5m, 15m, 30m, 1h, 6h, 12h, 24h"),
    mode: Optional[str] = Query(default=None, description="Mode: 'realtime' or 'historical'")
):
    """
    Returns traffic graph dataset for specified interface, period, and mode (PRD Section 17).
    """
    # Auto-resolve mode if not explicitly provided
    if not mode:
        realtime_max_sec = parse_period_to_seconds(config.GRAPH_REALTIME_MAX)
        period_sec = parse_period_to_seconds(period)
        mode = "realtime" if period_sec <= realtime_max_sec else "historical"

    data = query_traffic_history(interface_filter=interface, period_code=period, mode=mode)

    return {
        "interface": interface,
        "period": period,
        "mode": mode,
        "data": data
    }
