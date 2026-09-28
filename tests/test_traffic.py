import pytest
from app.services.traffic_service import calculate_bandwidth_bps

def test_normal_traffic_calculation():
    # 10 MB in 5 seconds -> 10 * 1024 * 1024 * 8 / 5 = 16,777,216 bps
    prev = 100 * 1024 * 1024
    curr = 110 * 1024 * 1024
    elapsed = 5.0

    bps = calculate_bandwidth_bps(curr, prev, elapsed)
    assert bps == pytest.approx(16777216.0, rel=1e-3)

def test_zero_traffic():
    bps = calculate_bandwidth_bps(1000, 1000, 5.0)
    assert bps == 0.0

def test_counter_reset_prevention():
    # Counter reset (current < previous)
    prev = 5000000
    curr = 1000
    bps = calculate_bandwidth_bps(curr, prev, 5.0)
    assert bps == 0.0  # Must not return negative bandwidth

def test_zero_elapsed_time():
    bps = calculate_bandwidth_bps(2000, 1000, 0.0)
    assert bps == 0.0
