import sqlite3
import os
import logging
from pathlib import Path
from app.config import config

logger = logging.getLogger("mikrotik_monitor")

def get_db_connection():
    db_path = Path(config.DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Table traffic_data
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS traffic_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                interface_name TEXT NOT NULL,
                rx_bytes INTEGER NOT NULL,
                tx_bytes INTEGER NOT NULL,
                rx_bps REAL NOT NULL,
                tx_bps REAL NOT NULL
            );
        """)

        # Table app_state
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Indexes (PRD Section 16)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_traffic_timestamp ON traffic_data(timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_traffic_interface ON traffic_data(interface_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_traffic_interface_timestamp ON traffic_data(interface_name, timestamp);")

        conn.commit()
        logger.info(f"Database initialized successfully at {config.DATABASE_PATH}")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        conn.rollback()
        raise e
    finally:
        conn.close()
