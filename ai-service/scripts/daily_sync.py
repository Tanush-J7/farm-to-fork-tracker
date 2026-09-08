import os
import requests
import pandas as pd
from datetime import datetime, timedelta
import logging
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load env variables (ensures script works when run standalone)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATA_GOV_API_KEY = os.getenv("DATA_GOV_API_KEY")

# The specific Data.gov.in Resource ID for Agmarknet Mandi Prices.
# Note: They occasionally rotate this ID. Check data.gov.in if it expires.
AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"

def get_supabase_client():
    from supabase import create_client, Client
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase credentials missing. Check your .env file.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_latest_db_date(supabase, commodity: str, market: str) -> str:
    """Finds the most recent date we have data for so we only fetch what's missing."""
    response = supabase.table("market_prices") \
        .select("date") \
        .ilike("commodity", commodity) \
        .ilike("market", market) \
        .order("date", desc=True) \
        .limit(1) \
        .execute()
        
    if response.data and len(response.data) > 0:
        return response.data[0]["date"]
    
    # If no data exists, let's just fetch the last 30 days
    return (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

def fetch_agmarknet_prices(api_key: str, commodity: str, market: str) -> pd.DataFrame:
    """Fetches real-time price data from the Indian Gov Agmarknet API."""
    url = f"https://api.data.gov.in/resource/{AGMARKNET_RESOURCE_ID}"
    
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": 100,
        "filters[commodity]": commodity.capitalize(),
        "filters[market]": market.capitalize()
    }
    
    logger.info(f"Fetching live Agmarknet data for {commodity} in {market}...")
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        logger.error(f"Failed to fetch data. API Status: {response.status_code}")
        logger.error(response.text)
        return pd.DataFrame()
        
    data = response.json()
    records = data.get("records", [])
    
    if not records:
        logger.warning("No records returned from API for this query.")
        return pd.DataFrame()
        
    # Map their API schema to our DB schema
    formatted_data = []
    for row in records:
        try:
            # Agmarknet dates are usually DD/MM/YYYY
            raw_date = row.get("arrival_date", "")
            iso_date = datetime.strptime(raw_date, "%d/%m/%Y").strftime("%Y-%m-%d")
            
            formatted_data.append({
                "date": iso_date,
                "commodity": str(row.get("commodity")).upper(),
                "market": str(row.get("market")).upper(),
                "variety": str(row.get("variety", "LOCAL")),
                "grade": str(row.get("grade", "FAQ")),
                "min_price": float(row.get("min_price", 0)),
                "max_price": float(row.get("max_price", 0)),
                "modal_price": float(row.get("modal_price", 0)),
                "arrivals": float(row.get("arrivals", 0)) if row.get("arrivals") else None
            })
        except Exception as e:
            logger.warning(f"Skipping malformed row: {e}")
            continue
            
    df = pd.DataFrame(formatted_data)
    # Sort chronologically
    df = df.sort_values("date").reset_index(drop=True)
    return df

def sync_market_data(commodity: str, market: str):
    logger.info(f"--- Starting Daily Sync for {commodity} / {market} ---")
    
    if not DATA_GOV_API_KEY:
        logger.error("Missing DATA_GOV_API_KEY in .env file! Exiting.")
        return
        
    supabase = get_supabase_client()
    
    # 1. See what we already have
    latest_date_in_db = fetch_latest_db_date(supabase, commodity, market)
    logger.info(f"Latest record in Database is up to: {latest_date_in_db}")
    
    # 2. Fetch fresh data
    df_live = fetch_agmarknet_prices(DATA_GOV_API_KEY, commodity, market)
    if df_live.empty:
        logger.info("Nothing to sync. Exiting.")
        return
        
    # 3. Filter out records we already have
    # (We only want rows strictly newer than latest_date_in_db)
    df_new = df_live[df_live['date'] > latest_date_in_db]
    
    if df_new.empty:
        logger.info("Database is fully up to date. No new records to insert.")
        return
        
    logger.info(f"Found {len(df_new)} new records to insert into Supabase.")
    
    # 4. Insert into Supabase
    records_to_insert = df_new.to_dict(orient="records")
    try:
        response = supabase.table("market_prices").insert(records_to_insert).execute()
        logger.info(f"✅ Successfully inserted {len(response.data)} records!")
    except Exception as e:
        logger.error(f"❌ Failed to insert into Supabase: {e}")

if __name__ == "__main__":
    # You can add multiple commodities/markets here
    sync_market_data("Tomato", "Bangalore")
    sync_market_data("Onion", "Bangalore")
