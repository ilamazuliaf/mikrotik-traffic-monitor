"""
Traffic Calculation Service (PRD Section 5 & 41)
Formula:
RX bps = (current_rx_bytes - previous_rx_bytes) * 8 / elapsed_seconds
TX bps = (current_tx_bytes - previous_tx_bytes) * 8 / elapsed_seconds
"""

def calculate_bandwidth_bps(current_bytes: int, previous_bytes: int, elapsed_seconds: float) -> float:
    if elapsed_seconds <= 0:
        return 0.0
    if current_bytes < 0 or previous_bytes < 0:
        return 0.0
    
    # Counter reset handling (PRD Section 41: if counter is smaller than previous, assume reset)
    if current_bytes < previous_bytes:
        return 0.0

    delta_bytes = current_bytes - previous_bytes
    bps = (delta_bytes * 8.0) / elapsed_seconds
    return max(0.0, bps)
