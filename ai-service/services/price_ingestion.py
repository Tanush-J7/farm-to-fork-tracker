import os
import uuid
import requests
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from services.kafka_client import KafkaEventProducer

logger = logging.getLogger(__name__)

PRICE_DATA_MAX_STALENESS_DAYS = 2

class MarketPriceSource:
    def __init__(self):
        self.name = "UNKNOWN"

    def fetch_data(self, commodity: str, market: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

class DataGovSource(MarketPriceSource):
    def __init__(self, api_key: str):
        super().__init__()
        self.name = "DATA_GOV"
        self.api_key = api_key
        self.resource_id = "9ef84268-d588-465a-a308-a864a43d0070"

    def fetch_data(self, commodity: str, market: str) -> List[Dict[str, Any]]:
        if not self.api_key:
            logger.warning("DATA_GOV_API_KEY not set.")
            return []
            
        url = f"https://api.data.gov.in/resource/{self.resource_id}"
        params = {
            "api-key": self.api_key,
            "format": "json",
            "limit": 50,
            "filters[commodity]": commodity.capitalize(),
            "filters[market]": market.capitalize()
        }
        
        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return data.get("records", [])
        except Exception as e:
            logger.error(f"DataGovSource fetch failed: {e}")
            return []

class CedaAgmarknetSource(MarketPriceSource):
    def __init__(self):
        super().__init__()
        self.name = "CEDA_AGMARKNET"

    def fetch_data(self, commodity: str, market: str) -> List[Dict[str, Any]]:
        # Mocking CEDA endpoint as it requires specific institutional access/authentication
        # In a real scenario, this hits the CEDA Agmarknet API
        logger.info("Attempting to fetch from CEDA fallback...")
        try:
            # Simulate a request failure or empty response for the mock
            return []
        except Exception as e:
            logger.error(f"CedaAgmarknetSource fetch failed: {e}")
            return []

class DatabaseCacheSource(MarketPriceSource):
    def __init__(self, supabase_client):
        super().__init__()
        self.name = "DATABASE_CACHE"
        self.supabase = supabase_client

    def fetch_data(self, commodity: str, market: str) -> List[Dict[str, Any]]:
        if not self.supabase:
            return []
        try:
            resp = self.supabase.table("market_prices") \
                .select("*") \
                .ilike("commodity", commodity) \
                .ilike("market", market) \
                .order("date", desc=True) \
                .limit(10) \
                .execute()
            # Map DB records back to a format similar to API for the normalizer, or just return them
            return resp.data if resp.data else []
        except Exception as e:
            logger.error(f"DatabaseCacheSource fetch failed: {e}")
            return []

class PriceDataSourceManager:
    def __init__(self, supabase_client):
        api_key = os.getenv("DATA_GOV_API_KEY", "")
        self.sources = [
            DataGovSource(api_key),
            CedaAgmarknetSource(),
            DatabaseCacheSource(supabase_client)
        ]
        self.kafka_producer = KafkaEventProducer()

    def _normalize_record(self, raw: Dict[str, Any], source_name: str) -> Optional[Dict[str, Any]]:
        try:
            # Handle DB format
            if source_name == "DATABASE_CACHE":
                return {
                    "date": raw["date"],
                    "commodity": raw["commodity"],
                    "market": raw["market"],
                    "state": raw.get("state", "Unknown"),
                    "district": raw.get("district", "Unknown"),
                    "variety": raw.get("variety", "FAQ"),
                    "grade": raw.get("grade", "FAQ"),
                    "min_price": float(raw["min_price"]),
                    "max_price": float(raw["max_price"]),
                    "modal_price": float(raw["modal_price"]),
                    "arrivals": float(raw["arrivals"]) if raw.get("arrivals") is not None else 0.0,
                    "source": source_name,
                    "data_as_of": raw["date"],
                    "fetched_at": datetime.now(timezone.utc).isoformat()
                }

            # Handle Agmarknet format
            raw_date = raw.get("arrival_date", "")
            iso_date = datetime.strptime(raw_date, "%d/%m/%Y").strftime("%Y-%m-%d")
            
            return {
                "date": iso_date,
                "commodity": str(raw.get("commodity")).upper(),
                "market": str(raw.get("market")).upper(),
                "state": str(raw.get("state", "Unknown")),
                "district": str(raw.get("district", "Unknown")),
                "variety": str(raw.get("variety", "FAQ")),
                "grade": str(raw.get("grade", "FAQ")),
                "min_price": float(raw.get("min_price", 0)),
                "max_price": float(raw.get("max_price", 0)),
                "modal_price": float(raw.get("modal_price", 0)),
                "arrivals": float(raw.get("arrivals", 0)) if raw.get("arrivals") else 0.0,
                "source": source_name,
                "data_as_of": iso_date,
                "fetched_at": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.warning(f"Skipping malformed record: {e}")
            return None

    def _is_fresh(self, records: List[Dict[str, Any]]) -> bool:
        if not records:
            return False
        
        # Find the latest date in the records
        latest_date_str = max(r["date"] for r in records)
        latest_date = datetime.strptime(latest_date_str, "%Y-%m-%d").date()
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=PRICE_DATA_MAX_STALENESS_DAYS)
        
        return latest_date >= cutoff

    def publish_status(self, source_name: str, status: str, latest_date: Optional[str] = None, reason: Optional[str] = None):
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "DATA_SOURCE_STATUS",
            "event_version": "1.0",
            "event_timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "price-ingestion-service",
            "payload": {
                "source": source_name,
                "status": status,
                "checked_at": datetime.now(timezone.utc).isoformat()
            }
        }
        if latest_date:
            event["payload"]["latest_data_date"] = latest_date
        if reason:
            event["payload"]["reason"] = reason

        self.kafka_producer.publish_event(
            topic=os.getenv("KAFKA_DATA_SOURCE_TOPIC", "data-source-status"),
            event=event
        )

    def fetch_and_publish(self, commodity: str, market: str):
        logger.info(f"Starting price ingestion for {commodity}/{market}")
        
        best_records = []
        selected_source = None

        for source in self.sources:
            logger.info(f"Checking source: {source.name}")
            raw_data = source.fetch_data(commodity, market)
            
            if not raw_data:
                self.publish_status(source.name, "UNAVAILABLE", reason="API failed or empty")
                continue
                
            normalized = []
            for r in raw_data:
                norm = self._normalize_record(r, source.name)
                if norm:
                    normalized.append(norm)
            
            if not normalized:
                continue

            if self._is_fresh(normalized):
                logger.info(f"Source {source.name} is fresh and valid.")
                best_records = normalized
                selected_source = source.name
                
                latest_date = max(r["date"] for r in best_records)
                self.publish_status(source.name, "ACTIVE", latest_date=latest_date)
                break
            else:
                logger.warning(f"Source {source.name} data is stale.")
                self.publish_status(source.name, "STALE", reason="Data exceeded max staleness days")

        if not best_records:
            logger.error("All sources failed or returned stale data. Cannot proceed.")
            return

        logger.info(f"Publishing {len(best_records)} records from {selected_source} to Kafka.")
        
        # Publish to Kafka
        topic = os.getenv("KAFKA_MARKET_PRICE_TOPIC", "market-prices")
        for record in best_records:
            event = {
                "event_id": str(uuid.uuid4()),
                "event_type": "MARKET_PRICE_UPDATED",
                "event_version": "1.0",
                "event_timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "price-ingestion-service",
                "payload": record
            }
            kafka_key = f"{record['commodity']}:{record['market']}"
            self.kafka_producer.publish_event(topic, event, key=kafka_key)
            
        self.kafka_producer.flush()
        logger.info("Ingestion complete.")
