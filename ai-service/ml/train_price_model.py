import os
import json
import logging
import pickle
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
import xgboost as xgb
from dotenv import load_dotenv

from services.database import fetch_historical_prices
from ml.feature_engineering import FeatureEngineer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

load_dotenv()

def calculate_metrics(y_true, y_pred) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = mean_absolute_percentage_error(y_true, y_pred)
    return {"MAE": float(mae), "RMSE": float(rmse), "MAPE": float(mape)}

def train_model(commodity: str, market: str):
    logger.info(f"Starting XGBoost training pipeline for {commodity} in {market}")
    
    # 1. Load normalized database data
    # We fetch a large chunk of historical prices to train on. 
    # The prompt says: "Load normalized database data. Validate. Sort chronologically."
    df = fetch_historical_prices(commodity, market, limit=2000)
    
    if df.empty or len(df) < 35:
        logger.error("Insufficient data for training. Need at least 35 records.")
        return
        
    # 2. Sort chronologically
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    # 3. Generate features
    fe = FeatureEngineer()
    df_features = fe.create_features(df)
    
    # 4. Remove invalid rows (NaNs created by lags up to 30 days)
    df_features = df_features.dropna().reset_index(drop=True)
    
    if len(df_features) < 5:
        logger.error("Insufficient data after dropping NaNs (need more historical days).")
        return
        
    feature_cols = fe.get_feature_columns()
    target_col = 'modal_price'
    
    # 5. Split chronologically (DO NOT use random train_test_split)
    # Let's use the last 20% for testing
    split_idx = int(len(df_features) * 0.8)
    
    train_df = df_features.iloc[:split_idx]
    test_df = df_features.iloc[split_idx:]
    
    X_train = train_df[feature_cols]
    y_train = train_df[target_col]
    X_test = test_df[feature_cols]
    y_test = test_df[target_col]
    
    # 6. Train naive baseline
    # Naive: "tomorrow price = latest known price"
    # For the test set, the prediction is exactly the `lag_1` feature (which is the previous day's price)
    naive_preds = test_df['lag_1']
    baseline_metrics = calculate_metrics(y_test, naive_preds)
    logger.info(f"Baseline Metrics: {baseline_metrics}")
    
    # 7. Train XGBoost
    logger.info("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(
        n_estimators=100,
        learning_rate=0.05,
        max_depth=5,
        random_state=42,
        objective='reg:squarederror'
    )
    
    model.fit(X_train, y_train)
    
    # 8. Evaluate
    xgb_preds = model.predict(X_test)
    xgb_metrics = calculate_metrics(y_test, xgb_preds)
    logger.info(f"XGBoost Metrics: {xgb_metrics}")
    
    # 9. Save artifacts
    model_dir = "models/price_model"
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, "model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
        
    preprocessor_path = os.path.join(model_dir, "preprocessor.pkl")
    with open(preprocessor_path, "wb") as f:
        pickle.dump(fe, f)
        
    # 10. Save metadata
    metadata = {
        "model_version": "1.0.0",
        "model_type": "XGBoost Regressor",
        "target": "modal_price",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_start": str(train_df['date'].min().date()),
        "training_end": str(train_df['date'].max().date()),
        "training_rows": len(train_df),
        "MAE": xgb_metrics["MAE"],
        "RMSE": xgb_metrics["RMSE"],
        "MAPE": xgb_metrics["MAPE"],
        "features": feature_cols,
        "baseline_MAE": baseline_metrics["MAE"]
    }
    
    meta_path = os.path.join(model_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=4)
        
    logger.info(f"Model and metadata saved to {model_dir}")

if __name__ == "__main__":
    train_model("Tomato", "Bangalore")
