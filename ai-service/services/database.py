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
    If the database is unconfigured or fails, it throws an error.
    It NEVER falls back to unverified local CSVs.
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
                logger.warning(f"Insufficient records in Supabase ({len(data) if data else 0} < 30).")
                raise ValueError("Insufficient verified historical data.")
        except Exception as e:
            logger.error(f"Database connection failed: {e}.")
            raise RuntimeError("VERIFIED_DATA_UNAVAILABLE")
    else:
        logger.info("Supabase credentials not found in env. Cannot fetch verified data.")
        raise RuntimeError("VERIFIED_DATA_UNAVAILABLE")
