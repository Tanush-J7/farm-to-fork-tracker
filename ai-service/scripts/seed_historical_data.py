"""
Seed script: Generate 60 days of realistic historical price data 
for all supported commodities and markets, and append to the CSV.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

np.random.seed(42)

# Base wholesale prices per quintal (realistic Indian mandi ranges)
BASE_PRICES = {
    "Tomato": 3200,
    "Onion": 2500,
    "Potato": 1800,
    "Carrot": 4000,
    "Cabbage": 1500,
    "Green Chilli": 5500,
    "Brinjal": 2800,
}

MARKETS = ["Bangalore", "Mysore", "Mumbai", "Pune", "Delhi", "Hyderabad", "Chennai"]

# Volatility factor per commodity (how much daily price swings)
VOLATILITY = {
    "Tomato": 0.04,
    "Onion": 0.03,
    "Potato": 0.02,
    "Carrot": 0.025,
    "Cabbage": 0.035,
    "Green Chilli": 0.05,
    "Brinjal": 0.03,
}

# Market price modifier (some markets are cheaper/more expensive)
MARKET_MODIFIER = {
    "Bangalore": 1.0,
    "Mysore": 0.92,
    "Mumbai": 1.12,
    "Pune": 1.05,
    "Delhi": 1.08,
    "Hyderabad": 0.95,
    "Chennai": 1.03,
}

DAYS = 60
START_DATE = datetime(2023, 1, 1)

rows = []
for commodity, base_price in BASE_PRICES.items():
    for market in MARKETS:
        modifier = MARKET_MODIFIER[market]
        vol = VOLATILITY[commodity]
        price = base_price * modifier
        
        for day_offset in range(DAYS):
            date = START_DATE + timedelta(days=day_offset)
            
            # Random walk with mean reversion
            change = np.random.normal(0, vol)
            mean_reversion = (base_price * modifier - price) / (base_price * modifier) * 0.1
            price = price * (1 + change + mean_reversion)
            price = max(price * 0.5, price)  # floor
            
            modal = round(price, 2)
            min_p = round(modal * np.random.uniform(0.85, 0.95), 2)
            max_p = round(modal * np.random.uniform(1.05, 1.15), 2)
            arrivals = round(np.random.uniform(50, 500), 0)
            
            rows.append({
                "Price Date": date.strftime("%Y-%m-%d"),
                "Commodity": commodity,
                "Market Name": market,
                "Variety": "FAQ",
                "Grade": "FAQ",
                "Min Price (Rs./Quintal)": min_p,
                "Max Price (Rs./Quintal)": max_p,
                "Modal Price (Rs./Quintal)": modal,
                "Arrivals (Tonnes)": int(arrivals),
            })

new_df = pd.DataFrame(rows)

# Load existing CSV and append
csv_path = os.path.join("ai-service", "data", "test_raw_feat.csv")
existing = pd.read_csv(csv_path)
combined = pd.concat([existing, new_df], ignore_index=True)

# Remove duplicates (same commodity + market + date)
combined = combined.drop_duplicates(
    subset=["Price Date", "Commodity", "Market Name"], 
    keep="first"
)

combined.to_csv(csv_path, index=False)
print(f"Done! Total rows: {len(combined)}")
print(f"Commodities: {combined['Commodity'].unique().tolist()}")
print(f"Markets: {combined['Market Name'].unique().tolist()}")
print(f"Rows per commodity:")
print(combined.groupby("Commodity").size())
