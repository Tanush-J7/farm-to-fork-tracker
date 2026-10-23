"""
Multi-commodity XGBoost training pipeline for publication-quality evaluation.
Trains a single model across all commodities and markets with encoded categorical features.
Produces MAE, RMSE, MAPE, and R² on a properly-sized chronological test set.
"""
import os
import json
import logging
import pickle
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error, r2_score
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

from ml.feature_engineering import FeatureEngineer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def calculate_metrics(y_true, y_pred) -> dict:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = mean_absolute_percentage_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    return {"MAE": round(float(mae), 4), "RMSE": round(float(rmse), 4),
            "MAPE": round(float(mape), 6), "R2": round(float(r2), 4)}


def train_multi_commodity_model():
    logger.info("Starting multi-commodity XGBoost training pipeline")

    # 1. Load full dataset
    csv_path = "data/test_raw_feat.csv"
    if not os.path.exists(csv_path):
        logger.error(f"Dataset not found at {csv_path}")
        return

    df_raw = pd.read_csv(csv_path)
    logger.info(f"Loaded {len(df_raw)} raw records")

    # Normalize column names
    col_map = {}
    for c in df_raw.columns:
        cl = c.strip().lower().replace(' ', '_')
        col_map[c] = cl
    df_raw.rename(columns=col_map, inplace=True)

    # Identify price and date columns
    if 'modal_price' not in df_raw.columns:
        # Try common alternatives
        for candidate in ['modal_price_(rs./quintal)', 'modal_price_(rs/kg)', 'price']:
            if candidate in df_raw.columns:
                df_raw.rename(columns={candidate: 'modal_price'}, inplace=True)
                break

    if 'date' not in df_raw.columns:
        for candidate in ['arrival_date', 'reported_date', 'price_date']:
            if candidate in df_raw.columns:
                df_raw.rename(columns={candidate: 'date'}, inplace=True)
                break

    if 'market' not in df_raw.columns:
        for candidate in ['market_name', 'market_center']:
            if candidate in df_raw.columns:
                df_raw.rename(columns={candidate: 'market'}, inplace=True)
                break

    if 'arrivals' not in df_raw.columns:
        for candidate in ['arrivals_(tonnes)', 'arrivals_tonnes']:
            if candidate in df_raw.columns:
                df_raw.rename(columns={candidate: 'arrivals'}, inplace=True)
                break
        else:
            df_raw['arrivals'] = 0.0

    required = ['date', 'modal_price', 'commodity', 'market']
    for col in required:
        if col not in df_raw.columns:
            logger.error(f"Missing required column: {col}. Available: {list(df_raw.columns)}")
            return

    # Drop rows with missing target
    df_raw = df_raw.dropna(subset=['modal_price'])
    df_raw['date'] = pd.to_datetime(df_raw['date'])
    df_raw = df_raw.sort_values('date').reset_index(drop=True)

    # Convert Rs/Quintal to Rs/Kg if needed
    if df_raw['modal_price'].mean() > 400:
        logger.info("Prices appear to be in Rs/Quintal. Converting to Rs/Kg.")
        for pcol in ['modal_price', 'min_price', 'max_price']:
            if pcol in df_raw.columns:
                df_raw[pcol] = df_raw[pcol] / 100.0

    # 2. Encode categorical features
    le_commodity = LabelEncoder()
    le_market = LabelEncoder()
    df_raw['commodity_encoded'] = le_commodity.fit_transform(df_raw['commodity'].str.strip().str.title())
    df_raw['market_encoded'] = le_market.fit_transform(df_raw['market'].str.strip().str.title())

    commodities = list(le_commodity.classes_)
    markets = list(le_market.classes_)
    logger.info(f"Commodities ({len(commodities)}): {commodities}")
    logger.info(f"Markets ({len(markets)}): {markets}")

    # 3. Generate features PER commodity-market group to avoid cross-contamination of lags
    fe = FeatureEngineer()
    all_featured = []

    for (commodity, market), group in df_raw.groupby(['commodity', 'market']):
        if len(group) < 35:
            logger.warning(f"Skipping {commodity}/{market}: only {len(group)} records (need 35+)")
            continue
        group = group.sort_values('date').reset_index(drop=True)
        featured = fe.create_features(group)
        featured['commodity_encoded'] = group['commodity_encoded'].iloc[0]
        featured['market_encoded'] = group['market_encoded'].iloc[0]
        all_featured.append(featured)

    if not all_featured:
        logger.error("No commodity-market groups had sufficient data")
        return

    df_features = pd.concat(all_featured, ignore_index=True)
    df_features = df_features.dropna().reset_index(drop=True)
    df_features = df_features.sort_values('date').reset_index(drop=True)

    logger.info(f"Total featured records after NaN drop: {len(df_features)}")

    # 4. Feature columns = original 28 + 2 encoded categoricals
    feature_cols = fe.get_feature_columns() + ['commodity_encoded', 'market_encoded']
    target_col = 'modal_price'

    # 5. Chronological split (80/20)
    split_idx = int(len(df_features) * 0.8)
    train_df = df_features.iloc[:split_idx]
    test_df = df_features.iloc[split_idx:]

    X_train = train_df[feature_cols]
    y_train = train_df[target_col]
    X_test = test_df[feature_cols]
    y_test = test_df[target_col]

    logger.info(f"Train: {len(train_df)} rows | Test: {len(test_df)} rows")

    # 6. Naive persistence baseline
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

    encoders_path = os.path.join(model_dir, "encoders.pkl")
    with open(encoders_path, "wb") as f:
        pickle.dump({"commodity": le_commodity, "market": le_market}, f)

    # 10. Save metadata
    metadata = {
        "model_version": "2.0.0",
        "model_type": "XGBoost Regressor (Multi-Commodity)",
        "target": "modal_price",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_start": str(train_df['date'].min().date()),
        "training_end": str(train_df['date'].max().date()),
        "test_start": str(test_df['date'].min().date()),
        "test_end": str(test_df['date'].max().date()),
        "training_rows": len(train_df),
        "test_rows": len(test_df),
        "commodities": commodities,
        "markets": markets,
        "total_records": len(df_features),
        "hyperparameters": {
            "n_estimators": 100,
            "learning_rate": 0.05,
            "max_depth": 5,
            "objective": "reg:squarederror",
            "random_state": 42
        },
        "xgboost_metrics": xgb_metrics,
        "baseline_metrics": baseline_metrics,
        "features": feature_cols,
        "num_features": len(feature_cols)
    }

    meta_path = os.path.join(model_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=4)

    # 11. Save baseline report
    baseline_report = {
        "naive_persistence": baseline_metrics,
        "xgboost": xgb_metrics,
        "improvement": {
            "MAE_reduction_pct": round((1 - xgb_metrics["MAE"] / baseline_metrics["MAE"]) * 100, 2) if baseline_metrics["MAE"] > 0 else 0,
            "RMSE_reduction_pct": round((1 - xgb_metrics["RMSE"] / baseline_metrics["RMSE"]) * 100, 2) if baseline_metrics["RMSE"] > 0 else 0,
        }
    }

    report_path = os.path.join(model_dir, "baseline_report.json")
    with open(report_path, "w") as f:
        json.dump(baseline_report, f, indent=4)

    logger.info(f"Model v2.0.0 and metadata saved to {model_dir}")
    logger.info(f"XGBoost vs Baseline - MAE: {xgb_metrics['MAE']} vs {baseline_metrics['MAE']}")
    logger.info(f"XGBoost vs Baseline - R2: {xgb_metrics['R2']} vs {baseline_metrics['R2']}")


if __name__ == "__main__":
    train_multi_commodity_model()
