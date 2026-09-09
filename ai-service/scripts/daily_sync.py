import logging
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load env variables
load_dotenv()

import os
from supabase import create_client, Client
from services.price_ingestion import PriceDataSourceManager

def main():
    logger.info("Starting price sync process...")
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials missing. Exiting.")
        return
        
    supabase: Client = create_client(supabase_url, supabase_key)

    manager = PriceDataSourceManager(supabase)

    # List of commodities/markets to sync
    targets = [
        ("Tomato", "Bangalore"),
        ("Onion", "Bangalore")
    ]

    for commodity, market in targets:
        manager.fetch_and_publish(commodity, market)
        
    logger.info("Daily sync completed.")

if __name__ == "__main__":
    main()
