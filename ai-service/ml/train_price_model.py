import pandas as pd
import numpy as np
import logging
import json
import os
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
from ml.preprocessing import DataPreprocessor
from ml.feature_engineering import FeatureEngineer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def chronological_split(df: pd.DataFrame, train_ratio=0.7, val_ratio=0.15):
    """
    Splits the dataset strictly by time to prevent future data leakage.
    Ensures that Test dates are strictly after Val dates, which are strictly after Train dates.
    """
    logger.info("Performing chronological train/val/test split...")
    
    # Sort and get unique dates
    unique_dates = np.sort(df['date'].unique())
    n_dates = len(unique_dates)
    
    train_end = int(n_dates * train_ratio)
    val_end = int(n_dates * (train_ratio + val_ratio))
    
    train_dates = unique_dates[:train_end]
    val_dates = unique_dates[train_end:val_end]
    test_dates = unique_dates[val_end:]
    
    train_df = df[df['date'].isin(train_dates)].copy()
    val_df = df[df['date'].isin(val_dates)].copy()
    test_df = df[df['date'].isin(test_dates)].copy()
    
    logger.info(f"Split complete. Train dates: {pd.to_datetime(train_dates[0]).date()} to {pd.to_datetime(train_dates[-1]).date()}")
    if len(val_dates) > 0:
        logger.info(f"Val dates: {pd.to_datetime(val_dates[0]).date()} to {pd.to_datetime(val_dates[-1]).date()}")
    if len(test_dates) > 0:
        logger.info(f"Test dates: {pd.to_datetime(test_dates[0]).date()} to {pd.to_datetime(test_dates[-1]).date()}")
        
    return train_df, val_df, test_df

def evaluate_baseline(df: pd.DataFrame, split_name: str) -> dict:
    """
    Evaluates the Naive/Persistence baseline.
    Prediction for today = Price from yesterday (lag_1).
    """
    # Drop rows where lag_1 is missing (though our feature engineer should have dropped them)
    eval_df = df.dropna(subset=['modal_price', 'lag_1'])
    
    y_true = eval_df['modal_price']
    y_pred = eval_df['lag_1']
    
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = mean_absolute_percentage_error(y_true, y_pred) * 100
    
    logger.info(f"--- Baseline Metrics ({split_name}) ---")
    logger.info(f"MAE:  ₹{mae:.2f}")
    logger.info(f"RMSE: ₹{rmse:.2f}")
    logger.info(f"MAPE: {mape:.2f}%")
    
    return {
        "split": split_name,
        "rows": len(eval_df),
        "mae": float(round(mae, 4)),
        "rmse": float(round(rmse, 4)),
        "mape": float(round(mape, 4))
    }

import joblib
from xgboost import XGBRegressor
from sklearn.preprocessing import OrdinalEncoder

def prepare_features(train_df, val_df, test_df):
    """Encodes categorical features and drops unused columns."""
    logger.info("Preparing features for XGBoost...")
    
    cat_cols = ['commodity', 'market']
    drop_cols = ['date', 'min_price', 'max_price', 'variety', 'grade', 'temperature', 'rainfall', 'humidity']
    
    # Save encoder
    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    
    # Separate features and target
    X_train = train_df.drop(columns=['modal_price'] + drop_cols).copy()
    y_train = train_df['modal_price']
    
    X_val = val_df.drop(columns=['modal_price'] + drop_cols).copy()
    y_val = val_df['modal_price']
    
    X_test = test_df.drop(columns=['modal_price'] + drop_cols).copy()
    y_test = test_df['modal_price']
    
    # Encode categorical columns
    X_train[cat_cols] = encoder.fit_transform(X_train[cat_cols])
    
    if not X_val.empty:
        X_val[cat_cols] = encoder.transform(X_val[cat_cols])
    if not X_test.empty:
        X_test[cat_cols] = encoder.transform(X_test[cat_cols])
        
    return X_train, y_train, X_val, y_val, X_test, y_test, encoder, X_train.columns.tolist()

def train_xgboost(X_train, y_train, X_val, y_val):
    """Trains the XGBoost Regressor with early stopping."""
    logger.info("Training XGBoost Regressor...")
    model = XGBRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        early_stopping_rounds=20
    )
    
    if not X_val.empty:
        eval_set = [(X_train, y_train), (X_val, y_val)]
        model.fit(X_train, y_train, eval_set=eval_set, verbose=False)
    else:
        model.fit(X_train, y_train)
        
    return model

def evaluate_model(model, X, y, split_name):
    """Evaluates the XGBoost model."""
    if X.empty:
        return {}
        
    y_pred = model.predict(X)
    mae = mean_absolute_error(y, y_pred)
    rmse = np.sqrt(mean_squared_error(y, y_pred))
    mape = mean_absolute_percentage_error(y, y_pred) * 100
    
    logger.info(f"--- XGBoost Metrics ({split_name}) ---")
    logger.info(f"MAE:  ₹{mae:.2f}")
    logger.info(f"RMSE: ₹{rmse:.2f}")
    logger.info(f"MAPE: {mape:.2f}%")
    
    return {
        "mae": float(round(mae, 4)),
        "rmse": float(round(rmse, 4)),
        "mape": float(round(mape, 4))
    }

def run_pipeline(data_path: str):
    """Loads data, generates features, splits, trains baseline & XGBoost, and saves artifacts."""
    preprocessor = DataPreprocessor()
    engineer = FeatureEngineer()
    
    # 1. Process data
    df_clean = preprocessor.process(data_path)
    df_features = engineer.create_features(df_clean)
    
    # 2. Chronological Split
    train_df, val_df, test_df = chronological_split(df_features)
    
    # 3. Evaluate Baseline
    logger.info("\n========== BASELINE EVALUATION ==========")
    baseline_metrics = {
        "train": evaluate_baseline(train_df, "Train"),
        "val": evaluate_baseline(val_df, "Validation"),
        "test": evaluate_baseline(test_df, "Test")
    }
    
    # 4. Prepare Features & Encode
    X_train, y_train, X_val, y_val, X_test, y_test, encoder, feature_names = prepare_features(train_df, val_df, test_df)
    
    # 5. Train XGBoost
    logger.info("\n========== XGBOOST EVALUATION ==========")
    xgb_model = train_xgboost(X_train, y_train, X_val, y_val)
    
    # 6. Evaluate XGBoost
    xgb_metrics = {
        "train": evaluate_model(xgb_model, X_train, y_train, "Train"),
        "val": evaluate_model(xgb_model, X_val, y_val, "Validation"),
        "test": evaluate_model(xgb_model, X_test, y_test, "Test")
    }
    
    # 7. Feature Importance
    importance_dict = dict(zip(feature_names, map(float, xgb_model.feature_importances_)))
    top_features = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)[:5]
    
    logger.info("--- Top 5 Important Features ---")
    for feat, imp in top_features:
        logger.info(f"{feat}: {imp:.4f}")
    
    # 8. Save Artifacts
    os.makedirs("models/price_model", exist_ok=True)
    
    joblib.dump(xgb_model, "models/price_model/model.pkl")
    joblib.dump(encoder, "models/price_model/preprocessor.pkl")
    
    metadata = {
        "model_version": "1.0.0",
        "model_type": "XGBoostRegressor",
        "target": "modal_price",
        "trained_at": pd.Timestamp.now().isoformat(),
        "training_start": str(train_df['date'].min().date()),
        "training_end": str(train_df['date'].max().date()),
        "features": feature_names,
        "categorical_features": ['commodity', 'market'],
        "top_features": [f[0] for f in top_features],
        "metrics": {
            "baseline": baseline_metrics,
            "xgboost": xgb_metrics
        }
    }
    
    with open("models/price_model/metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    logger.info("\n========================================")
    logger.info("PRICE MODEL TRAINING COMPLETE")
    logger.info("Artifacts saved to models/price_model/")
    logger.info("========================================")

if __name__ == "__main__":
    # Test using the dummy data generated in Phase 2
    test_csv = "data/test_raw_feat.csv"
    if os.path.exists(test_csv):
        run_pipeline(test_csv)
    else:
        logger.error(f"Test data {test_csv} not found. Run feature_engineering.py first.")
