from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    json_data = response.json()
    assert "mikrotik" in json_data
    assert "last_update" in json_data

def test_api_interfaces():
    response = client.get("/api/interfaces")
    assert response.status_code == 200
    json_data = response.json()
    assert "interfaces" in json_data
    assert isinstance(json_data["interfaces"], list)

def test_api_traffic():
    response = client.get("/api/traffic?interface=all&period=15m")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["interface"] == "all"
    assert json_data["period"] == "15m"
    assert "data" in json_data
