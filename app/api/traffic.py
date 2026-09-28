from fastapi import APIRouter, Query
from app.database.models import query_traffic_history

router = APIRouter()

@router.get("/traffic")
def get_traffic(
    interface: str = Query(default="all", description="Interface name or 'all'"),
    period: str = Query(default="15m", description="Period: 5m, 15m, 30m, 1h, 6h, 12h, 24h")
):
    data = query_traffic_history(interface_filter=interface, period_code=period)
    return {
        "interface": interface,
        "period": period,
        "data": data
    }
