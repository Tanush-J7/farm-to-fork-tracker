#!/usr/bin/env python3
"""
FarmChain AI - Expanded FastAPI Service
Provides mock ML endpoints for all AI modules.
"""

import random
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.price_prediction_service import PricePredictionService
from services.kafka_client import check_kafka_health

app = FastAPI(title="FarmChain AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────

class ImageInput(BaseModel):
    image_url: str

class CropData(BaseModel):
    crop_type: str
    temperature: float = 28.0
    humidity: float = 65.0
    quantity: float = 100.0

class SalesData(BaseModel):
    product: str
    historical_sales: list[float] = [42.0, 58.0, 73.0, 61.0, 95.0, 112.0]


# ─────────────────────────────────────────────
# 1. Crop Quality Classification
# ─────────────────────────────────────────────
@app.post("/predict/quality")
def predict_quality(data: ImageInput):
    """Classify crop quality from image URL (mocked)."""
    qualities = ["Excellent", "Good", "Average", "Poor"]
    weights = [0.45, 0.30, 0.18, 0.07]
    quality = random.choices(qualities, weights=weights)[0]
    return {
        "quality": quality,
        "score": round(random.uniform(0.6, 0.99), 2),
        "confidence": round(random.uniform(0.82, 0.99), 2),
        "analyzed_at": datetime.utcnow().isoformat()
    }


# ─────────────────────────────────────────────
# 2. Disease Detection
# ─────────────────────────────────────────────
@app.post("/predict/disease")
def predict_disease(data: CropData):
    """Detect crop disease from crop data (mocked)."""
    diseases = [None, "Leaf Blight", "Rust", "Powdery Mildew", "Fusarium Wilt"]
    disease = random.choices(diseases, weights=[0.6, 0.1, 0.1, 0.1, 0.1])[0]
    return {
        "disease_detected": disease is not None,
        "disease_name": disease or "None",
        "severity": random.choice(["Low", "Medium", "High"]) if disease else None,
        "confidence": round(random.uniform(0.75, 0.99), 2),
        "recommendation": "Apply fungicide" if disease else "No treatment needed"
    }


# ─────────────────────────────────────────────
# 3. Shelf Life Prediction
# ─────────────────────────────────────────────
@app.post("/predict/shelf-life")
def predict_shelf_life(data: CropData):
    """Predict shelf life in days based on crop type and conditions (mocked)."""
    base_days = {
        "tomatoes": 7, "mangoes": 10, "avocados": 5, "apples": 30,
        "wheat": 365, "rice": 730, "grapes": 14
    }
    days = base_days.get(data.crop_type.lower(), 10)
    # Adjust for temperature and humidity
    temp_factor = 1.0 - max(0, (data.temperature - 20) * 0.02)
    days_adjusted = int(days * temp_factor * random.uniform(0.85, 1.15))
    expiry = datetime.utcnow() + timedelta(days=days_adjusted)
    return {
        "shelf_life_days": days_adjusted,
        "expiry_date": expiry.strftime("%Y-%m-%d"),
        "storage_recommendation": f"Store at {'<10°C' if days_adjusted < 14 else 'room temperature'}",
        "freshness_score": round(random.uniform(0.75, 0.99), 2)
    }


# ─────────────────────────────────────────────
# 4. Market Price Prediction (XGBoost Real Pipeline)
# ─────────────────────────────────────────────
from services.price_prediction_service import PricePredictionService
from pydantic import Field
import pandas as pd
import os

# Load service strictly once at startup
price_service = PricePredictionService(model_dir="models/price_model")

class PricePredictionRequest(BaseModel):
    commodity: str
    market: str
    forecast_days: int = Field(default=7, ge=1, le=7)

@app.post("/api/farmer/price-prediction")
def predict_price_real(data: PricePredictionRequest):
    """
    Real AI Endpoint predicting multi-day prices using XGBoost.
    """
    # -------------------------------------------------------------
    # MOCK / REAL DATABASE FETCH
    # Fetches real Postgres historical data via Supabase if configured.
    # Automatically falls back to the local raw CSV if unreachable.
    # -------------------------------------------------------------
    from services.database import fetch_historical_prices
    try:
        df_history = fetch_historical_prices(data.commodity, data.market, limit=35)
    except Exception as e:
        return {"error": "DATABASE_ERROR", "message": f"Failed to retrieve history: {e}"}

    # Execute Prediction
    result = price_service.predict(
        commodity=data.commodity,
        market=data.market,
        recent_history_df=df_history,
        forecast_days=data.forecast_days
    )
    
    return result


# ─────────────────────────────────────────────
# 5. Demand Forecasting
# ─────────────────────────────────────────────
@app.post("/predict/demand")
def predict_demand(data: SalesData):
    """Forecast next-week demand from historical sales (mocked)."""
    if data.historical_sales:
        avg = sum(data.historical_sales) / len(data.historical_sales)
        forecast = [round(avg * random.uniform(0.9, 1.2)) for _ in range(7)]
    else:
        forecast = [random.randint(40, 120) for _ in range(7)]
    return {
        "product": data.product,
        "forecast_7_days": forecast,
        "recommended_stock": max(forecast),
        "confidence": round(random.uniform(0.80, 0.95), 2)
    }


# ─────────────────────────────────────────────
# 6. Fraud Detection
# ─────────────────────────────────────────────
@app.post("/predict/fraud")
def detect_fraud(data: dict):
    """Detect duplicate or suspicious supply chain entries (mocked)."""
    fraud_score = round(random.uniform(0.0, 0.3), 3)  # Generally low
    return {
        "is_suspicious": fraud_score > 0.25,
        "fraud_score": fraud_score,
        "flags": [] if fraud_score < 0.15 else ["Duplicate batch number detected"],
        "recommendation": "Approve" if fraud_score < 0.25 else "Manual Review Required"
#!/usr/bin/env python3
"""
FarmChain AI - Expanded FastAPI Service
Provides mock ML endpoints for all AI modules.
"""

import random
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.price_prediction_service import PricePredictionService
from services.kafka_client import check_kafka_health

app = FastAPI(title="FarmChain AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────

class ImageInput(BaseModel):
    image_url: str

class CropData(BaseModel):
    crop_type: str
    temperature: float = 28.0
    humidity: float = 65.0
    quantity: float = 100.0

class SalesData(BaseModel):
    product: str
    historical_sales: list[float] = [42.0, 58.0, 73.0, 61.0, 95.0, 112.0]


# ─────────────────────────────────────────────
# 1. Crop Quality Classification
# ─────────────────────────────────────────────
@app.post("/predict/quality")
def predict_quality(data: ImageInput):
    """Classify crop quality from image URL (mocked)."""
    qualities = ["Excellent", "Good", "Average", "Poor"]
    weights = [0.45, 0.30, 0.18, 0.07]
    quality = random.choices(qualities, weights=weights)[0]
    return {
        "quality": quality,
        "score": round(random.uniform(0.6, 0.99), 2),
        "confidence": round(random.uniform(0.82, 0.99), 2),
        "analyzed_at": datetime.utcnow().isoformat()
    }


# ─────────────────────────────────────────────
# 2. Disease Detection
# ─────────────────────────────────────────────
@app.post("/predict/disease")
def predict_disease(data: CropData):
    """Detect crop disease from crop data (mocked)."""
    diseases = [None, "Leaf Blight", "Rust", "Powdery Mildew", "Fusarium Wilt"]
    disease = random.choices(diseases, weights=[0.6, 0.1, 0.1, 0.1, 0.1])[0]
    return {
        "disease_detected": disease is not None,
        "disease_name": disease or "None",
        "severity": random.choice(["Low", "Medium", "High"]) if disease else None,
        "confidence": round(random.uniform(0.75, 0.99), 2),
        "recommendation": "Apply fungicide" if disease else "No treatment needed"
    }


# ─────────────────────────────────────────────
# 3. Shelf Life Prediction
# ─────────────────────────────────────────────
@app.post("/predict/shelf-life")
def predict_shelf_life(data: CropData):
    """Predict shelf life in days based on crop type and conditions (mocked)."""
    base_days = {
        "tomatoes": 7, "mangoes": 10, "avocados": 5, "apples": 30,
        "wheat": 365, "rice": 730, "grapes": 14
    }
    days = base_days.get(data.crop_type.lower(), 10)
    # Adjust for temperature and humidity
    temp_factor = 1.0 - max(0, (data.temperature - 20) * 0.02)
    days_adjusted = int(days * temp_factor * random.uniform(0.85, 1.15))
    expiry = datetime.utcnow() + timedelta(days=days_adjusted)
    return {
        "shelf_life_days": days_adjusted,
        "expiry_date": expiry.strftime("%Y-%m-%d"),
        "storage_recommendation": f"Store at {'<10°C' if days_adjusted < 14 else 'room temperature'}",
        "freshness_score": round(random.uniform(0.75, 0.99), 2)
    }


# ─────────────────────────────────────────────
# 4. Market Price Prediction (XGBoost Real Pipeline)
# ─────────────────────────────────────────────
from services.price_prediction_service import PricePredictionService
from pydantic import Field
import pandas as pd
import os

# Load service strictly once at startup
price_service = PricePredictionService(model_dir="models/price_model")

class PricePredictionRequest(BaseModel):
    commodity: str
    market: str
    forecast_days: int = Field(default=7, ge=1, le=7)

import uuid
from services.kafka_client import KafkaEventProducer

kafka_producer = KafkaEventProducer()

@app.post("/api/farmer/price-prediction")
def predict_price_real(data: PricePredictionRequest):
    """
    Real AI Endpoint predicting multi-day prices using XGBoost.
    """
    from services.database import fetch_historical_prices
    try:
        df_history = fetch_historical_prices(data.commodity, data.market, limit=40)
    except Exception as e:
        return {"error": "DATABASE_ERROR", "message": f"Failed to retrieve history: {e}"}

    result = price_service.predict(
        commodity=data.commodity,
        market=data.market,
        recent_history_df=df_history,
        forecast_days=data.forecast_days
    )
    
    # Optionally publish to Kafka if successful
    if "error" not in result:
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "PRICE_PREDICTION_CREATED",
            "event_version": "1.0",
            "event_timestamp": datetime.utcnow().isoformat() + "Z",
            "source": "price-prediction-service",
            "payload": {
                "commodity": result["commodity"],
                "market": result["market"],
                "predicted_price": result["predictions"][-1]["predicted_price"],
                "forecast_days": data.forecast_days,
                "data_source": result.get("data_source"),
                "model_version": result.get("model_version")
            }
        }
        topic = os.getenv("KAFKA_PRICE_PREDICTION_TOPIC", "price-predictions")
        kafka_producer.publish_event(topic, event)
    
    return result


# ─────────────────────────────────────────────
# 5. Demand Forecasting
# ─────────────────────────────────────────────
@app.post("/predict/demand")
def predict_demand(data: SalesData):
    """Forecast next-week demand from historical sales (mocked)."""
    if data.historical_sales:
        avg = sum(data.historical_sales) / len(data.historical_sales)
        forecast = [round(avg * random.uniform(0.9, 1.2)) for _ in range(7)]
    else:
        forecast = [random.randint(40, 120) for _ in range(7)]
    return {
        "product": data.product,
        "forecast_7_days": forecast,
        "recommended_stock": max(forecast),
        "confidence": round(random.uniform(0.80, 0.95), 2)
    }


# ─────────────────────────────────────────────
# 6. Fraud Detection
# ─────────────────────────────────────────────
@app.post("/predict/fraud")
def detect_fraud(data: dict):
    """Detect duplicate or suspicious supply chain entries (mocked)."""
    fraud_score = round(random.uniform(0.0, 0.3), 3)  # Generally low
    return {
        "is_suspicious": fraud_score > 0.25,
        "fraud_score": fraud_score,
        "flags": [] if fraud_score < 0.15 else ["Duplicate batch number detected"],
        "recommendation": "Approve" if fraud_score < 0.25 else "Manual Review Required"
    }


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "FarmChain AI", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/kafka/health")
def kafka_health():
    return check_kafka_health()
