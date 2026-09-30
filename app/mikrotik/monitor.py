import time
import threading
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.config import config
from app.mikrotik.client import MikrotikClient
from app.services.traffic_service import calculate_bandwidth_bps
from app.services.cleanup_service import run_retention_cleanup
from app.database.models import insert_traffic_record, set_app_state, get_app_state

logger = logging.getLogger("mikrotik_monitor")

class TrafficMonitorWorker:
    _instance: Optional['TrafficMonitorWorker'] = None
    _lock = threading.Lock()

    def __init__(self):
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.client = MikrotikClient(
            host=config.MIKROTIK_HOST,
            port=config.MIKROTIK_PORT,
            username=config.MIKROTIK_USERNAME,
            password=config.MIKROTIK_PASSWORD,
            use_ssl=config.MIKROTIK_USE_SSL,
            timeout=5.0
        )
        self.previous_readings: Dict[str, Dict[str, Any]] = {}
        self.cleanup_counter = 0

    @classmethod
    def get_instance(cls) -> 'TrafficMonitorWorker':
        with cls._lock:
            if cls._instance is None:
                cls._instance = TrafficMonitorWorker()
            return cls._instance

    def start(self):
        with self._lock:
            if self.running:
                logger.warning("Polling worker is already running.")
                return
            self.running = True
            self.thread = threading.Thread(target=self._run_loop, daemon=True, name="MikrotikPollWorker")
            self.thread.start()
            logger.info("Single MikroTik polling worker started.")

    def stop(self):
        with self._lock:
            self.running = False
        if self.client:
            self.client.disconnect()
        logger.info("MikroTik polling worker stopped.")

    def _run_loop(self):
        set_app_state("mikrotik_status", "connecting")

        while self.running:
            start_time = time.time()
            now_iso = datetime.now(timezone.utc).astimezone().isoformat()

            try:
                if not self.client.connected:
                    connected = self.client.connect()
                    if not connected:
                        set_app_state("mikrotik_status", "offline")
                        logger.warning(f"MikroTik unreachable at {config.MIKROTIK_HOST}:{config.MIKROTIK_PORT}. Retrying in {config.POLL_INTERVAL}s.")
                        time.sleep(config.POLL_INTERVAL)
                        continue

                # Fetch interfaces from RouterOS API
                raw_interfaces = self.client.get_interfaces()
                set_app_state("mikrotik_status", "online")
                set_app_state("last_update", now_iso)

                # Map interface array by name
                iface_map = {item.get("name"): item for item in raw_interfaces if item.get("name")}

                # Process ONLY configured monitored interfaces (PRD Section 4.1 B)
                for iface_name in config.MONITORED_INTERFACES:
                    iface_info = iface_map.get(iface_name)
                    if not iface_info:
                        logger.warning(f"Monitored interface {iface_name} NOT FOUND on MikroTik.")
                        continue

                    try:
                        rx_bytes = int(iface_info.get("rx-byte", 0))
                        tx_bytes = int(iface_info.get("tx-byte", 0))
                    except ValueError:
                        rx_bytes, tx_bytes = 0, 0

                    prev = self.previous_readings.get(iface_name)
                    rx_bps = 0.0
                    tx_bps = 0.0

                    if prev:
                        elapsed = start_time - prev["timestamp"]
                        rx_bps = calculate_bandwidth_bps(rx_bytes, prev["rx_bytes"], elapsed)
                        tx_bps = calculate_bandwidth_bps(tx_bytes, prev["tx_bytes"], elapsed)

                    # Update stored reading
                    self.previous_readings[iface_name] = {
                        "rx_bytes": rx_bytes,
                        "tx_bytes": tx_bytes,
                        "timestamp": start_time
                    }

                    # Store in SQLite database (PRD Section 14)
                    insert_traffic_record(
                        timestamp_iso=now_iso,
                        interface_name=iface_name,
                        rx_bytes=rx_bytes,
                        tx_bytes=tx_bytes,
                        rx_bps=rx_bps,
                        tx_bps=tx_bps
                    )

            except Exception as e:
                logger.error(f"Error during MikroTik polling loop: {e}")
                set_app_state("mikrotik_status", "offline")
                self.client.disconnect()

            # Cleanup old data every 100 cycles (~8-10 minutes)
            self.cleanup_counter += 1
            if self.cleanup_counter >= 100:
                self.cleanup_counter = 0
                run_retention_cleanup(retention_hours=config.get_max_period_hours())

            # Sleep remaining interval
            elapsed_loop = time.time() - start_time
            sleep_duration = max(0.1, config.POLL_INTERVAL - elapsed_loop)
            time.sleep(sleep_duration)

monitor_worker = TrafficMonitorWorker.get_instance()
