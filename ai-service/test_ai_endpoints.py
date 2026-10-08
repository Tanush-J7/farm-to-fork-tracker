import os
os.environ["CORS_ORIGINS"] = "http://localhost:3000,http://localhost:8000"

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "price_model" in data

def test_valid_quality_request():
    response = client.post("/predict/quality", json={"image_url": "http://example.com/image.jpg"})
    assert response.status_code == 200
    assert response.json()["quality"] == "AI Inspection Unavailable"

def test_invalid_quality_request():
    # missing image_url
    response = client.post("/predict/quality", json={})
    assert response.status_code == 422

def test_valid_shelf_life():
    response = client.post("/predict/shelf-life", json={
        "crop_type": "Tomato",
        "temperature": 25.0,
        "humidity": 60.0,
        "quantity": 100
    })
    assert response.status_code == 200
    assert response.json()["storage_recommendation"] == "AI Service Unavailable"

def test_invalid_shelf_life():
    response = client.post("/predict/shelf-life", json={
        "crop_type": "Tomato",
        "temperature": 100.0, # out of range (max 60)
        "humidity": 60.0,
        "quantity": 100
    })
    assert response.status_code == 422

def test_invalid_negative_quantity():
    response = client.post("/predict/shelf-life", json={
        "crop_type": "Tomato",
        "temperature": 25.0,
        "humidity": 60.0,
        "quantity": -10 # invalid
    })
    assert response.status_code == 422

def test_price_prediction_request():
    response = client.post("/api/farmer/price-prediction", json={
        "commodity": "Tomato",
        "market": "Bangalore",
        "forecast_days": 7
    })
    # No DB in test, should strictly return 503 VERIFIED_DATA_UNAVAILABLE
    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert data["error_code"] == "VERIFIED_DATA_UNAVAILABLE"

if __name__ == "__main__":
    test_health_endpoint()
    test_valid_quality_request()
    test_invalid_quality_request()
    test_valid_shelf_life()
    test_invalid_shelf_life()
    test_invalid_negative_quantity()
    test_price_prediction_request()
    print("ALL TESTS PASSED")
