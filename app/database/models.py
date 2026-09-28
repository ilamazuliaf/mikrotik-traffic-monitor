import sqlite3
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from app.database.database import get_db_connection

def insert_traffic_record(timestamp_iso: str, interface_name: str, rx_bytes: int, tx_bytes: int, rx_bps: float, tx_bps: float):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO traffic_data (timestamp, interface_name, rx_bytes, tx_bytes, rx_bps, tx_bps)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (timestamp_iso, interface_name, rx_bytes, tx_bytes, rx_bps, tx_bps)
        )
        conn.commit()
    finally:
        conn.close()

def set_app_state(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).astimezone().isoformat()
    try:
        cursor.execute(
            """
            INSERT INTO app_state (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            """,
            (key, value, now_iso)
        )
        conn.commit()
    finally:
        conn.close()

def get_app_state(key: str, default: Optional[str] = None) -> Optional[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT value FROM app_state WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default
    finally:
        conn.close()

def get_latest_interface_traffic(monitored_interfaces: List[str]) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    result = []
    try:
        for iface in monitored_interfaces:
            cursor.execute(
                """
                SELECT interface_name, rx_bps, tx_bps, timestamp
                FROM traffic_data
                WHERE interface_name = ?
                ORDER BY id DESC LIMIT 1
                """,
                (iface,)
            )
            row = cursor.fetchone()
            if row:
                result.append({
                    "name": row["interface_name"],
                    "status": "running",
                    "rx_bps": row["rx_bps"],
                    "tx_bps": row["tx_bps"]
                })
            else:
                result.append({
                    "name": iface,
                    "status": "unknown",
                    "rx_bps": 0,
                    "tx_bps": 0
                })
    finally:
        conn.close()
    return result

def query_traffic_history(interface_filter: str, period_code: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    period_minutes_map = {
        "5m": 5,
        "15m": 15,
        "30m": 30,
        "1h": 60,
        "6h": 360,
        "12h": 720,
        "24h": 1440
    }
    minutes = period_minutes_map.get(period_code, 15)
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).astimezone().isoformat()

    try:
        if interface_filter != "all":
            cursor.execute(
                """
                SELECT timestamp, rx_bps, tx_bps
                FROM traffic_data
                WHERE interface_name = ? AND timestamp >= ?
                ORDER BY timestamp ASC
                """,
                (interface_filter, cutoff)
            )
            rows = cursor.fetchall()
            return [
                {
                    "timestamp": r["timestamp"],
                    "rx_bps": r["rx_bps"],
                    "tx_bps": r["tx_bps"]
                }
                for r in rows
            ]
        else:
            # Query all interfaces and group by timestamp
            cursor.execute(
                """
                SELECT timestamp, interface_name, rx_bps, tx_bps
                FROM traffic_data
                WHERE timestamp >= ?
                ORDER BY timestamp ASC
                """,
                (cutoff,)
            )
            rows = cursor.fetchall()
            grouped = {}
            for r in rows:
                ts = r["timestamp"]
                if ts not in grouped:
                    grouped[ts] = {"timestamp": ts}
                grouped[ts][r["interface_name"]] = {
                    "rx_bps": r["rx_bps"],
                    "tx_bps": r["tx_bps"]
                }
            return list(grouped.values())
    finally:
        conn.close()

def delete_old_traffic_records(hours: int = 24):
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).astimezone().isoformat()
    try:
        cursor.execute("DELETE FROM traffic_data WHERE timestamp < ?", (cutoff,))
        conn.commit()
    finally:
        conn.close()
