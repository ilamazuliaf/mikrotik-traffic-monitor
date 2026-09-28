import os
import tempfile
from datetime import datetime, timezone
from app.config import config
from app.database.database import init_db, get_db_connection
from app.database.models import (
    insert_traffic_record,
    set_app_state,
    get_app_state,
    get_latest_interface_traffic,
    query_traffic_history,
    delete_old_traffic_records
)

def setup_module(module):
    # Use temporary database file for testing
    temp_dir = tempfile.mkdtemp()
    test_db = os.path.join(temp_dir, "test_traffic.db")
    config.DATABASE_PATH = test_db
    init_db()

def test_database_insert_and_query():
    now_iso = datetime.now(timezone.utc).astimezone().isoformat()
    insert_traffic_record(now_iso, "ether1-BAROKAH", 1000, 2000, 100000.0, 50000.0)

    latest = get_latest_interface_traffic(["ether1-BAROKAH", "ether2-BIZ"])
    assert len(latest) == 2
    ether1 = next(i for i in latest if i["name"] == "ether1-BAROKAH")
    assert ether1["rx_bps"] == 100000.0
    assert ether1["tx_bps"] == 50000.0

def test_app_state():
    set_app_state("test_key", "test_val")
    val = get_app_state("test_key")
    assert val == "test_val"

def test_history_query():
    data = query_traffic_history("ether1-BAROKAH", "15m")
    assert isinstance(data, list)
    assert len(data) >= 1

def test_retention_cleanup():
    old_iso = "2020-01-01T00:00:00+00:00"
    insert_traffic_record(old_iso, "ether1-BAROKAH", 100, 100, 10.0, 10.0)
    
    delete_old_traffic_records(hours=24)
    data = query_traffic_history("ether1-BAROKAH", "24h")
    # Old record from 2020 must be deleted
    old_found = any(d["timestamp"] == old_iso for d in data)
    assert not old_found
