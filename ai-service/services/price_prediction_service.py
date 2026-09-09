import os
import json
import pickle
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

class PricePredictionService:
    def __init__(self, model_dir="models/price_model"):
        self.model_dir = model_dir
        self.model = None
        self.fe = None
        self.metadata = {}
        self._load_artifacts()

    def _load_artifacts(self):
        model_path = os.path.join(self.model_dir, "model.pkl")
        fe_path = os.path.join(self.model_dir, "preprocessor.pkl")
        meta_path = os.path.join(self.model_dir, "metadata.json")

        if not all(os.path.exists(p) for p in [model_path, fe_path, meta_path]):
            logger.warning("Price prediction artifacts missing. Ensure training has occurred.")
            return

        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            with open(fe_path, "rb") as f:
                self.fe = pickle.load(f)
            with open(meta_path, "r") as f:
                self.metadata = json.load(f)
            logger.info(f"Loaded Price Prediction Model version {self.metadata.get('model_version')}")
        except Exception as e:
            logger.error(f"Failed to load artifacts: {e}")

    def predict(self, commodity: str, market: str, recent_history_df: pd.DataFrame, forecast_days: int) -> dict:
        if self.model is None or self.fe is None:
            return {"error": "MODEL_NOT_LOADED", "message": "The AI model is not currently available."}

        if recent_history_df.empty or len(recent_history_df) < 30:
            return {"error": "INSUFFICIENT_DATA", "message": "At least 30 days of history required for prediction."}

        # Format historical df
        df = recent_history_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)

        current_price = float(df.iloc[-1]['modal_price'])
        data_as_of = df.iloc[-1]['date']
        data_source = df.iloc[-1].get('source', 'DATABASE_CACHE')
        
        # Calculate data age
        age = (datetime.now().date() - data_as_of.date()).days
        data_age_days = max(0, age)

        predictions = []
        
        # Recursive prediction loop
        current_df = df.copy()
        for i in range(forecast_days):
            # We want to predict for `next_date`
            next_date = current_df.iloc[-1]['date'] + timedelta(days=1)
            
            # Create a dummy row for the target date so the feature engineer can process it.
            # We copy the last row, update the date, and set 'modal_price' and 'arrivals' 
            # to NaN or last known since the features are mostly shifted.
            last_arrivals = current_df.iloc[-1]['arrivals']
            dummy_row = pd.DataFrame([{
                'date': next_date,
                'commodity': commodity,
                'market': market,
                'modal_price': current_price, # placeholder, feature engine shifts it anyway
                'arrivals': last_arrivals
            }])
            
            temp_df = pd.concat([current_df, dummy_row], ignore_index=True)
            
            # Generate features
            features_df = self.fe.create_features(temp_df)
            latest_features = features_df.iloc[[-1]]
            
            # Extract the exact feature columns required by model
            X = latest_features[self.metadata.get("features", [])]
            
            # Predict
            pred_price = float(self.model.predict(X)[0])
            
            # Format single prediction
            predictions.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "predicted_price": round(pred_price, 2)
            })
            
            # Update current_df with the prediction so next iteration can use it as lag_1
            # We actually replace the dummy row's modal_price with the prediction to become history
            temp_df.loc[temp_df.index[-1], 'modal_price'] = pred_price
            current_df = temp_df

        # Determine trend based on first vs last prediction
        start_price = current_price
        end_price = predictions[-1]["predicted_price"]
        if end_price > start_price * 1.02:
            trend = "INCREASING"
        elif end_price < start_price * 0.98:
            trend = "DECREASING"
        else:
            trend = "STABLE"

        return {
            "commodity": commodity,
            "market": market,
            "current_price": round(current_price, 2),
            "predictions": predictions,
            "trend": trend,
            "data_source": data_source,
            "data_as_of": data_as_of.strftime("%Y-%m-%d"),
            "data_age_days": data_age_days,
            "model_version": self.metadata.get("model_version", "unknown")
        }
