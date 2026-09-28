from fastapi import APIRouter
from app.config import config
from app.database.models import get_latest_interface_traffic

router = APIRouter()

@router.get("/interfaces")
def get_interfaces():
    interfaces = get_latest_interface_traffic(config.MONITORED_INTERFACES)
    return {
        "interfaces": interfaces
    }
