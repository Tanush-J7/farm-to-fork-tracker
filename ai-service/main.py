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
    return {
        "quality": "AI Inspection Unavailable",
        "score": 0.0,
        "confidence": 0.0,
        "analyzed_at": datetime.utcnow().isoformat()
    }


# ─────────────────────────────────────────────
# 2. Disease Detection
# ─────────────────────────────────────────────
@app.post("/predict/disease")
def predict_disease(data: CropData):
    """Detect crop disease from crop data (mocked)."""
    return {
        "disease_detected": False,
        "disease_name": "AI Service Unavailable",
        "severity": None,
        "confidence": 0.0,
        "recommendation": "Manual inspection required"
    }


# ─────────────────────────────────────────────
# 3. Shelf Life Prediction
# ─────────────────────────────────────────────
@app.post("/predict/shelf-life")
def predict_shelf_life(data: CropData):
    """Predict shelf life in days based on crop type and conditions (mocked)."""
    return {
        "shelf_life_days": 0,
        "expiry_date": None,
        "storage_recommendation": "AI Service Unavailable",
        "freshness_score": 0.0
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
    return {
        "product": data.product,
        "forecast_7_days": [],
        "recommended_stock": 0,
        "confidence": 0.0
    }


# ─────────────────────────────────────────────
# 6. Fraud Detection
# ─────────────────────────────────────────────
@app.post("/predict/fraud")
def detect_fraud(data: dict):
    """Detect duplicate or suspicious supply chain entries (mocked)."""
    return {
        "is_suspicious": False,
        "fraud_score": 0.0,
        "flags": [],
        "recommendation": "AI Service Unavailable"
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
