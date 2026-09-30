import sqlite3
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from app.config import config, parse_period_to_seconds
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

def query_traffic_history(interface_filter: str, period_code: str, mode: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Queries traffic history with automatic downsampling/aggregation for historical periods (PRD Section 18-20, 38-40).
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    period_seconds = parse_period_to_seconds(period_code)
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=period_seconds)).astimezone().isoformat()

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
            rows = [dict(r) for r in cursor.fetchall()]
        else:
            # Query all monitored interfaces in single SQL request (PRD Section 30-31)
            placeholders = ",".join(["?"] * len(config.MONITORED_INTERFACES))
            query = f"""
                SELECT timestamp, interface_name, rx_bps, tx_bps
                FROM traffic_data
                WHERE timestamp >= ? AND interface_name IN ({placeholders})
                ORDER BY timestamp ASC
            """
            cursor.execute(query, [cutoff] + config.MONITORED_INTERFACES)
            rows = [dict(r) for r in cursor.fetchall()]

        # Perform downsampling if row count exceeds max_points
        return downsample_traffic_points(
            rows=rows,
            interface_filter=interface_filter,
            period_seconds=period_seconds,
            max_points=config.GRAPH_MAX_POINTS
        )
    finally:
        conn.close()

def downsample_traffic_points(
    rows: List[dict],
    interface_filter: str,
    period_seconds: int,
    max_points: int = 500
) -> List[Dict[str, Any]]:
    if not rows:
        return []

    # If row count is within max_points, return raw points (payload optimized)
    if len(rows) <= max_points:
        if interface_filter != "all":
            return [
                {
                    "timestamp": r["timestamp"],
                    "rx_bps": round(float(r["rx_bps"]), 2),
                    "tx_bps": round(float(r["tx_bps"]), 2)
                }
                for r in rows
            ]
        else:
            grouped = {}
            for r in rows:
                ts = r["timestamp"]
                if ts not in grouped:
                    grouped[ts] = {"timestamp": ts}
                grouped[ts][r["interface_name"]] = {
                    "rx_bps": round(float(r["rx_bps"]), 2),
                    "tx_bps": round(float(r["tx_bps"]), 2)
                }
            return list(grouped.values())

    # Perform Time Bucket Averaging downsampling
    def parse_ts(ts_str: str) -> float:
        try:
            return datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            return 0.0

    bucket_size = max(1.0, float(period_seconds) / max_points)

    if interface_filter != "all":
        buckets = {}
        for r in rows:
            ts_val = parse_ts(r["timestamp"])
            bucket_key = int(ts_val // bucket_size) * bucket_size
            if bucket_key not in buckets:
                buckets[bucket_key] = {
                    "count": 0,
                    "rx_total": 0.0,
                    "tx_total": 0.0,
                    "sample_ts": r["timestamp"]
                }
            b = buckets[bucket_key]
            b["count"] += 1
            b["rx_total"] += float(r["rx_bps"])
            b["tx_total"] += float(r["tx_bps"])

        result = []
        for b_key in sorted(buckets.keys()):
            b = buckets[b_key]
            cnt = b["count"]
            result.append({
                "timestamp": b["sample_ts"],
                "rx_bps": round(b["rx_total"] / cnt, 2),
                "tx_bps": round(b["tx_total"] / cnt, 2)
            })
        return result

    else:
        # Group by (bucket_key, interface_name)
        buckets = {}
        for r in rows:
            ts_val = parse_ts(r["timestamp"])
            iface = r["interface_name"]
            bucket_key = int(ts_val // bucket_size) * bucket_size

            if bucket_key not in buckets:
                buckets[bucket_key] = {
                    "sample_ts": r["timestamp"],
                    "ifaces": {}
                }
            iface_buckets = buckets[bucket_key]["ifaces"]
            if iface not in iface_buckets:
                iface_buckets[iface] = {"count": 0, "rx_total": 0.0, "tx_total": 0.0}
            ib = iface_buckets[iface]
            ib["count"] += 1
            ib["rx_total"] += float(r["rx_bps"])
            ib["tx_total"] += float(r["tx_bps"])

        result = []
        for b_key in sorted(buckets.keys()):
            b = buckets[b_key]
            entry = {"timestamp": b["sample_ts"]}
            for iface_name, data in b["ifaces"].items():
                cnt = data["count"]
                entry[iface_name] = {
                    "rx_bps": round(data["rx_total"] / cnt, 2),
                    "tx_bps": round(data["tx_total"] / cnt, 2)
                }
            result.append(entry)
        return result

def delete_old_traffic_records(hours: int = 24):
    conn = get_db_connection()
    cursor = conn.cursor()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).astimezone().isoformat()
    try:
        cursor.execute("DELETE FROM traffic_data WHERE timestamp < ?", (cutoff,))
        conn.commit()
    finally:
        conn.close()
