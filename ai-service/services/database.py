import os
import pandas as pd
import logging
from ml.preprocessing import DataPreprocessor

logger = logging.getLogger(__name__)

# Safely import supabase. If not installed/configured, it won't crash.
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def fetch_historical_prices(commodity: str, market: str, limit: int = 35) -> pd.DataFrame:
    """
    Fetches historical market prices directly from the Supabase database.
    If the database is unconfigured (missing credentials) or fails, 
    safely falls back to the local CSV dataset.
    """
    if SUPABASE_AVAILABLE and SUPABASE_URL and SUPABASE_KEY:
        try:
            logger.info(f"Querying Supabase database for {commodity} in {market}...")
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            
            response = supabase.table("market_prices") \
                .select("*") \
                .ilike("commodity", commodity) \
                .ilike("market", market) \
                .order("date", desc=True) \
                .limit(limit) \
                .execute()
                
            data = response.data
            if data and len(data) >= 30:
                df = pd.DataFrame(data)
                # Sort chronologically for the ML features
                df = df.sort_values("date").reset_index(drop=True)
                logger.info(f"Successfully retrieved {len(df)} records from Supabase.")
                return df
            else:
                logger.warning(f"Insufficient records in Supabase ({len(data) if data else 0} < 30). Falling back to CSV.")
        except Exception as e:
            logger.error(f"Database connection failed: {e}. Falling back to CSV.")
    else:
        logger.info("Supabase credentials not found in env. Falling back to local CSV.")

    return _fetch_from_csv(commodity, market, limit)

def _fetch_from_csv(commodity: str, market: str, limit: int) -> pd.DataFrame:
    """Fallback logic using the local CSV."""
    history_path = "data/test_raw_feat.csv"
    if not os.path.exists(history_path):
        raise FileNotFoundError("Historical CSV data unavailable and Database unreachable.")
        
    preprocessor = DataPreprocessor()
    df_all = preprocessor.process(history_path)
    
    # Ensure column types
    df_all['commodity'] = df_all['commodity'].astype(str)
    df_all['market'] = df_all['market'].astype(str)
    
    # Filter
    mask = (df_all['commodity'].str.upper() == commodity.upper()) & \
           (df_all['market'].str.upper() == market.upper())
    df_history = df_all[mask].copy()
    
    return df_history.tail(limit)
