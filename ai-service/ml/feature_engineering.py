import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

class FeatureEngineer:
    def __init__(self):
        pass

    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generates strict time-series features without future data leakage.
        Required columns: 'date', 'modal_price', 'arrivals'
        """
        logger.info("Generating XGBoost features...")
        df = df.copy()
        
        # Ensure date is datetime
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)

        # 1. Date/Time Features
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
        df['month'] = df['date'].dt.month
        df['quarter'] = df['date'].dt.quarter
        df['day_of_year'] = df['date'].dt.dayofyear

        # Ensure arrivals exists
        if 'arrivals' not in df.columns:
            df['arrivals'] = 0.0
            
        # We must shift EVERYTHING by 1 day minimum so today's prediction only uses up to yesterday's data.
        # But wait, the prompt says "tomorrow price = latest known price" and "target = modal_price".
        # Standard approach: features are calculated on today's row, and we shift the TARGET to be tomorrow's price.
        # Or, we shift the features so today's row has yesterday's features and today's target.
        # Let's shift features so row `t` has features from `t-1` and target from `t`.
        
        # Actually, using pandas `shift(1)` on the rolling/lag calculations inherently prevents leakage 
        # if we are predicting `modal_price` of row `t`.
        
        # 2. Lag Features (Price)
        df['lag_1'] = df['modal_price'].shift(1)
        df['lag_3'] = df['modal_price'].shift(3)
        df['lag_7'] = df['modal_price'].shift(7)
        df['lag_14'] = df['modal_price'].shift(14)
        df['lag_30'] = df['modal_price'].shift(30)

        # 3. Rolling Means (Price)
        # Shift(1) ensures we don't include today's price in today's rolling mean
        df['rolling_mean_3'] = df['modal_price'].shift(1).rolling(window=3).mean()
        df['rolling_mean_7'] = df['modal_price'].shift(1).rolling(window=7).mean()
        df['rolling_mean_14'] = df['modal_price'].shift(1).rolling(window=14).mean()
        df['rolling_mean_30'] = df['modal_price'].shift(1).rolling(window=30).mean()

        # 4. Rolling Std (Price)
        df['rolling_std_7'] = df['modal_price'].shift(1).rolling(window=7).std()
        df['rolling_std_14'] = df['modal_price'].shift(1).rolling(window=14).std()
        df['rolling_std_30'] = df['modal_price'].shift(1).rolling(window=30).std()

        # 5. Price Changes (Absolute)
        df['price_change_1d'] = df['lag_1'] - df['modal_price'].shift(2)
        df['price_change_7d'] = df['lag_1'] - df['lag_7']
        df['price_change_30d'] = df['lag_1'] - df['lag_30']

        # 6. Price Changes (Percentage)
        df['price_pct_change_1d'] = (df['price_change_1d'] / df['modal_price'].shift(2)).replace([np.inf, -np.inf], 0).fillna(0)
        df['price_pct_change_7d'] = (df['price_change_7d'] / df['lag_7']).replace([np.inf, -np.inf], 0).fillna(0)
        df['price_pct_change_30d'] = (df['price_change_30d'] / df['lag_30']).replace([np.inf, -np.inf], 0).fillna(0)

        # 7. Arrivals Features
        df['arrival_lag_1'] = df['arrivals'].shift(1)
        df['arrival_lag_7'] = df['arrivals'].shift(7)
        df['arrival_rolling_mean_7'] = df['arrivals'].shift(1).rolling(window=7).mean()

        return df

    def get_feature_columns(self) -> list:
        return [
            'lag_1', 'lag_3', 'lag_7', 'lag_14', 'lag_30',
            'rolling_mean_3', 'rolling_mean_7', 'rolling_mean_14', 'rolling_mean_30',
            'rolling_std_7', 'rolling_std_14', 'rolling_std_30',
            'price_change_1d', 'price_change_7d', 'price_change_30d',
            'price_pct_change_1d', 'price_pct_change_7d', 'price_pct_change_30d',
            'day_of_week', 'day_of_month', 'week_of_year', 'month', 'quarter', 'day_of_year',
            'arrivals', 'arrival_lag_1', 'arrival_lag_7', 'arrival_rolling_mean_7'
        ]
