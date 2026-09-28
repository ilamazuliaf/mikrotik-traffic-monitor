from fastapi import APIRouter
from app.database.models import get_app_state
from datetime import datetime, timezone

router = APIRouter()

@router.get("/status")
def get_status():
    status = get_app_state("mikrotik_status", "offline")
    last_update = get_app_state("last_update", datetime.now(timezone.utc).astimezone().isoformat())
    return {
        "mikrotik": status,
        "last_update": last_update
    }
