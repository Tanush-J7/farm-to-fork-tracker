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
# 4. Market Price Prediction
# ─────────────────────────────────────────────
@app.post("/predict/price")
def predict_price(data: CropData):
    """Predict market price per kg (mocked)."""
    base_prices = {
        "tomatoes": 1.5, "mangoes": 3.2, "avocados": 4.5, "apples": 2.1,
        "wheat": 0.4, "rice": 0.8, "grapes": 2.8
    }
    base = base_prices.get(data.crop_type.lower(), 2.0)
    variation = random.uniform(0.85, 1.25)
    predicted = round(base * variation, 2)
    return {
        "crop": data.crop_type,
        "predicted_price_per_kg": predicted,
        "price_trend": random.choice(["Rising", "Stable", "Falling"]),
        "market_demand": random.choice(["High", "Medium", "Low"]),
        "confidence": round(random.uniform(0.78, 0.95), 2)
    }


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
