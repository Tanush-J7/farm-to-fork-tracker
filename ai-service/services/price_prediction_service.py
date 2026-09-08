import os
import json
import joblib
import logging
import pandas as pd
import numpy as np
from datetime import timedelta
from ml.feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)

class PricePredictionService:
    def __init__(self, model_dir="models/price_model"):
        self.model_dir = model_dir
        self.model = None
        self.encoder = None
        self.metadata = None
        self.engineer = FeatureEngineer()
        self._load_artifacts()

    def _load_artifacts(self):
        """Loads the trained model, encoder, and metadata into memory safely."""
        model_path = os.path.join(self.model_dir, "model.pkl")
        encoder_path = os.path.join(self.model_dir, "preprocessor.pkl")
        meta_path = os.path.join(self.model_dir, "metadata.json")

        if not all(os.path.exists(p) for p in [model_path, encoder_path, meta_path]):
            logger.warning("Price prediction artifacts missing. Model must be trained first.")
            return

        try:
            self.model = joblib.load(model_path)
            self.encoder = joblib.load(encoder_path)
            with open(meta_path, 'r') as f:
                self.metadata = json.load(f)
            logger.info(f"Loaded XGBoost price model v{self.metadata.get('model_version')}")
        except Exception as e:
            logger.error(f"Failed to load price model artifacts: {e}")

    def _validate_input(self, commodity: str, market: str) -> str:
        """Validates if the commodity and market are supported by the encoder."""
        if not self.encoder:
            return "Model not loaded."
            
        # The OrdinalEncoder stores categories in categories_ (a list of arrays)
        # categories_[0] is commodity, categories_[1] is market
        supported_commodities = self.encoder.categories_[0]
        supported_markets = self.encoder.categories_[1]

        if commodity.upper() not in supported_commodities:
            return f"Commodity '{commodity}' not supported by current model."
        if market.upper() not in supported_markets:
            return f"Market '{market}' not supported by current model."
            
        return None

    def predict(self, commodity: str, market: str, recent_history_df: pd.DataFrame, forecast_days: int = 7) -> dict:
        """
        Recursively forecasts the price up to 'forecast_days' into the future.
        """
        if not self.model or not self.metadata:
            return {
                "error": "MODEL_UNAVAILABLE",
                "message": "Price prediction model is currently unavailable."
            }

        if forecast_days < 1 or forecast_days > 14:
            return {
                "error": "INVALID_FORECAST_DAYS",
                "message": "Forecast days must be between 1 and 14."
            }

        validation_error = self._validate_input(commodity, market)
        if validation_error:
            return {
                "error": "PRICE_DATA_NOT_AVAILABLE",
                "message": validation_error
            }

        if recent_history_df.empty or len(recent_history_df) < 30:
            return {
                "error": "INSUFFICIENT_DATA",
                "message": "At least 30 days of historical data are required to generate the necessary lags."
            }

        # Work on a copy of the historical data
        df = recent_history_df.copy()
        
        # Ensure dates are datetime
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        
        current_price = df.iloc[-1]['modal_price']
        current_date = df.iloc[-1]['date']
        
        predictions = []
        
        # Recursive Multi-Step Forecasting
        for step in range(1, forecast_days + 1):
            target_date = current_date + timedelta(days=step)
            
            # Append a dummy row for the target date to calculate features
            dummy_row = pd.DataFrame({
                'date': [target_date],
                'commodity': [commodity.upper()],
                'market': [market.upper()],
                'variety': ['UNKNOWN'],
                'grade': ['UNKNOWN'],
                'min_price': [current_price],
                'max_price': [current_price],
                'modal_price': [-1.0],  # Dummy value to survive dropna; features use shift(1)
                'arrivals': [df.iloc[-1]['arrivals']] # Assume arrivals remain constant or decay
            })
            df = pd.concat([df, dummy_row], ignore_index=True)
            
            # Generate features
            df_features = self.engineer.create_features(df.copy())
            
            # Extract the features for the target date (the last row)
            target_features = df_features[df_features['date'] == target_date]
            if target_features.empty:
                logger.error(f"Failed to generate features for {target_date}")
                break
                
            X_next = target_features[self.metadata['features']].copy()
            
            # Apply Categorical Encoding
            cat_cols = self.metadata.get('categorical_features', ['commodity', 'market'])
            X_next[cat_cols] = self.encoder.transform(X_next[cat_cols])
            
            # Predict
            pred = float(self.model.predict(X_next)[0])
            
            # Sanity Check: Prices cannot be negative
            pred = max(pred, 0.1)
            
            # Update the DataFrame with the predicted value so the NEXT iteration's lag_1 uses it
            df.loc[df.index[-1], 'modal_price'] = pred
            df.loc[df.index[-1], 'min_price'] = pred
            df.loc[df.index[-1], 'max_price'] = pred
            
            predictions.append({
                "date": target_date.strftime("%Y-%m-%d"),
                "predicted_price": round(pred, 2)
            })

        # Trend calculation
        if predictions:
            final_pred = predictions[-1]['predicted_price']
            pct_change = ((final_pred - current_price) / current_price) * 100
            
            if pct_change >= 3.0:
                trend = "INCREASING"
            elif pct_change <= -3.0:
                trend = "DECREASING"
            else:
                trend = "STABLE"
        else:
            trend = "UNKNOWN"
            pct_change = 0.0

        return {
            "commodity": commodity.title(),
            "market": market.title(),
            "current_price": round(float(current_price), 2),
            "predictions": predictions,
            "trend": trend,
            "expected_change_pct": round(pct_change, 2),
            "model_version": self.metadata.get("model_version", "unknown"),
            "model_info": {
                "type": self.metadata.get("model_type", "XGBoost"),
                "last_trained": self.metadata.get("trained_at", "unknown"),
                "evaluation_mae": self.metadata.get("metrics", {}).get("xgboost", {}).get("test", {}).get("mae")
            }
        }

if __name__ == "__main__":
    # Test Routine
    import sys
    logging.basicConfig(level=logging.INFO)
    
    # Create mock recent history (last 35 days)
    dates = pd.date_range(end=pd.Timestamp.today().date(), periods=35)
    mock_history = pd.DataFrame({
        'date': dates,
        'commodity': ['TOMATO'] * 35,
        'market': ['BANGALORE'] * 35,
        'variety': ['LOCAL'] * 35,
        'grade': ['FAQ'] * 35,
        'min_price': np.linspace(30, 40, 35),
        'max_price': np.linspace(35, 45, 35),
        'modal_price': np.linspace(32, 42, 35),
        'arrivals': np.random.randint(100, 200, 35)
    })
    
    service = PricePredictionService()
    result = service.predict("Tomato", "Bangalore", mock_history, forecast_days=7)
    
    print("\n--- PREDICTION RESULT ---")
    print(json.dumps(result, indent=2))
