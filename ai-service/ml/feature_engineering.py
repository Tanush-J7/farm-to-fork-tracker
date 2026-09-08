import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

class FeatureEngineer:
    def __init__(self):
        pass

    def get_season(self, month: int) -> int:
        """
        Map month to a season integer.
        1: Winter (Dec, Jan, Feb)
        2: Spring (Mar, Apr, May)
        3: Summer/Monsoon (Jun, Jul, Aug)
        4: Autumn/Post-Monsoon (Sep, Oct, Nov)
        """
        if month in [12, 1, 2]:
            return 1
        elif month in [3, 4, 5]:
            return 2
        elif month in [6, 7, 8]:
            return 3
        else:
            return 4

    def expand_to_daily(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Ensures strict chronological continuity by expanding the dataset to daily frequency
        per commodity-market combination. This guarantees that a 7-day lag is exactly 7 days.
        """
        expanded_dfs = []
        df['date'] = pd.to_datetime(df['date'])
        
        for (commodity, market), group in df.groupby(['commodity', 'market']):
            group = group.set_index('date').sort_index()
            # Create a full daily date range for this group
            full_idx = pd.date_range(start=group.index.min(), end=group.index.max(), freq='D')
            
            # Reindex to full daily range
            group = group.reindex(full_idx)
            
            # Restore group identifiers
            group['commodity'] = commodity
            group['market'] = market
            
            # Forward fill prices (markets closed on weekends/holidays hold previous price)
            # Limit to 14 days to prevent filling massive gaps from missing data
            group['modal_price'] = group['modal_price'].ffill(limit=14)
            group['min_price'] = group['min_price'].ffill(limit=14)
            group['max_price'] = group['max_price'].ffill(limit=14)
            
            # Arrivals should be 0 on missing days (market closed means 0 arrivals)
            group['arrivals'] = group['arrivals'].fillna(0)
            
            expanded_dfs.append(group)
            
        if not expanded_dfs:
            return pd.DataFrame()
            
        full_df = pd.concat(expanded_dfs).rename_axis('date').reset_index()
        return full_df

    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generates lag, rolling, and time features strictly preventing future data leakage.
        """
        logger.info("Starting feature engineering. Expanding to daily frequency...")
        df = self.expand_to_daily(df)
        
        # Sort values securely
        df = df.sort_values(['commodity', 'market', 'date']).reset_index(drop=True)
        
        # ==========================================================
        # TIME FEATURES
        # ==========================================================
        df['day_of_week'] = df['date'].dt.dayofweek
        df['day_of_month'] = df['date'].dt.day
        df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
        df['month'] = df['date'].dt.month
        df['quarter'] = df['date'].dt.quarter
        df['day_of_year'] = df['date'].dt.dayofyear
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['season'] = df['month'].apply(self.get_season)

        # ==========================================================
        # TARGET VARIABLE
        # ==========================================================
        # The target is the current row's 'modal_price'. 
        # All features MUST be derived from shifted past values.
        
        grouped = df.groupby(['commodity', 'market'])
        
        logger.info("Generating lag and rolling features...")
        
        # Base shifted series (past values) to guarantee no leakage
        past_price = grouped['modal_price'].shift(1)
        past_arrivals = grouped['arrivals'].shift(1)
        
        # ==========================================================
        # PRICE LAGS
        # ==========================================================
        df['lag_1'] = past_price
        df['lag_3'] = grouped['modal_price'].shift(3)
        df['lag_7'] = grouped['modal_price'].shift(7)
        df['lag_14'] = grouped['modal_price'].shift(14)
        df['lag_30'] = grouped['modal_price'].shift(30)
        
        # ==========================================================
        # ARRIVALS FEATURES
        # ==========================================================
        df['arrival_lag_1'] = past_arrivals
        df['arrival_lag_7'] = grouped['arrivals'].shift(7)
        
        # ==========================================================
        # ROLLING FEATURES (Computed on past_price to prevent leakage)
        # ==========================================================
        df['rolling_mean_3'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(3, min_periods=1).mean().values
        df['rolling_mean_7'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(7, min_periods=1).mean().values
        df['rolling_mean_14'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(14, min_periods=1).mean().values
        df['rolling_mean_30'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(30, min_periods=1).mean().values
        
        df['rolling_std_7'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(7, min_periods=2).std().values
        df['rolling_std_14'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(14, min_periods=2).std().values
        df['rolling_std_30'] = past_price.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(30, min_periods=2).std().values
        
        df['arrival_rolling_mean_7'] = past_arrivals.groupby(df['commodity'].astype(str) + df['market'].astype(str)).rolling(7, min_periods=1).mean().values

        # ==========================================================
        # PRICE CHANGE FEATURES
        # ==========================================================
        df['price_change_1d'] = df['lag_1'] - df['lag_3'] # T-1 compared to T-3
        df['price_change_7d'] = df['lag_1'] - df['lag_7']
        df['price_change_30d'] = df['lag_1'] - df['lag_30']
        
        # Percentage changes (adding small epsilon to prevent div by zero)
        eps = 1e-6
        df['price_pct_change_1d'] = (df['price_change_1d'] / (df['lag_3'] + eps)) * 100
        df['price_pct_change_7d'] = (df['price_change_7d'] / (df['lag_7'] + eps)) * 100
        df['price_pct_change_30d'] = (df['price_change_30d'] / (df['lag_30'] + eps)) * 100
        
        # ==========================================================
        # WEATHER FEATURES (PLACEHOLDER)
        # ==========================================================
        # Set to NaNs or 0 so the model architecture is ready, but it doesn't break if absent.
        df['temperature'] = np.nan
        df['rainfall'] = np.nan
        df['humidity'] = np.nan

        # ==========================================================
        # DROP INVALID/INITIAL ROWS
        # ==========================================================
        # Since we use up to 30 days of lag, the first 30 days for each market-commodity 
        # pair will have NaNs in 'lag_30'. We drop rows missing strictly required features.
        
        logger.info(f"Shape before dropping NaNs: {df.shape}")
        
        # Target must exist
        df = df.dropna(subset=['modal_price'])
        
        # Required core features must exist
        core_features = ['lag_1', 'lag_7', 'lag_30', 'rolling_mean_7']
        df = df.dropna(subset=core_features)
        
        logger.info(f"Shape after dropping NaNs: {df.shape}")
        
        return df.reset_index(drop=True)

# Quick test routine
if __name__ == "__main__":
    from preprocessing import DataPreprocessor
    import os
    
    # Run the dummy data through preprocessor
    test_csv = "data/test_raw_feat.csv"
    os.makedirs("data", exist_ok=True)
    
    # Generate 40 days of dummy data to test 30-day lag
    dates = pd.date_range(start="2023-01-01", periods=40, freq='D')
    mock_data = pd.DataFrame({
        "Price Date": dates,
        "Commodity": ["Tomato"] * 40,
        "Market Name": ["Bangalore"] * 40,
        "Variety": ["Local"] * 40,
        "Grade": ["FAQ"] * 40,
        "Min Price (Rs./Quintal)": np.linspace(3000, 4000, 40),
        "Max Price (Rs./Quintal)": np.linspace(3500, 4500, 40),
        "Modal Price (Rs./Quintal)": np.linspace(3200, 4200, 40),
        "Arrivals (Tonnes)": np.random.randint(100, 200, 40)
    })
    # Drop one day to test daily expansion gap filling
    mock_data = mock_data.drop(5) 
    mock_data.to_csv(test_csv, index=False)
    
    preprocessor = DataPreprocessor()
    df_clean = preprocessor.process(test_csv)
    
    engineer = FeatureEngineer()
    df_features = engineer.create_features(df_clean)
    
    print("\nFeature Engineering Complete. Head:")
    print(df_features[['date', 'modal_price', 'lag_1', 'lag_7', 'rolling_mean_7', 'price_pct_change_7d']].head())
