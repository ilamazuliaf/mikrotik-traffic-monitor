import logging
from app.database.models import delete_old_traffic_records

logger = logging.getLogger("mikrotik_monitor")

def run_retention_cleanup(retention_hours: int = 24):
    try:
        delete_old_traffic_records(hours=retention_hours)
        logger.info(f"Data retention cleanup completed (deleted records older than {retention_hours}h).")
    except Exception as e:
        logger.error(f"Data retention cleanup failed: {e}")
