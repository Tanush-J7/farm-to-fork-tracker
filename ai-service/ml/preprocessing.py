import pandas as pd
import numpy as np
import logging
import json
import os
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataPreprocessor:
    def __init__(self, column_mapping=None):
        """
        Initialize the preprocessor with an optional column mapping.
        Maps raw CSV columns to the internal schema:
        ['date', 'commodity', 'market', 'variety', 'grade', 'min_price', 'max_price', 'modal_price', 'arrivals']
        """
        self.internal_columns = [
            'date', 'commodity', 'market', 'variety', 'grade', 
            'min_price', 'max_price', 'modal_price', 'arrivals'
        ]
        
        # Default mapping attempts to catch common Indian ag data formats (like Agmarknet)
        self.column_mapping = column_mapping or {
            'Price Date': 'date',
            'Reported Date': 'date',
            'Commodity': 'commodity',
            'Market Name': 'market',
            'Market': 'market',
            'Variety': 'variety',
            'Grade': 'grade',
            'Min Price (Rs./Quintal)': 'min_price',
            'Max Price (Rs./Quintal)': 'max_price',
            'Modal Price (Rs./Quintal)': 'modal_price',
            'Arrivals (Tonnes)': 'arrivals'
        }

    def normalize_schema(self, df: pd.DataFrame) -> pd.DataFrame:
        """Rename columns to match the internal schema."""
        # Rename based on mapping
        df = df.rename(columns=self.column_mapping)
        
        # Lowercase column names and strip whitespace to catch slight variations
        df.columns = [str(col).strip().lower().replace(' ', '_') for col in df.columns]
        
        # Ensure all internal columns exist, even if empty
        for col in self.internal_columns:
            if col not in df.columns:
                df[col] = np.nan
                
        return df[self.internal_columns].copy()

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply robust preprocessing:
        1. Parse date
        2. Sort chronologically
        3. Drop duplicates
        4. Handle missing/invalid targets
        5. Clean outliers
        """
        # 1. Parse date
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        
        # Drop rows with unparseable dates
        df = df.dropna(subset=['date'])

        # Format strings consistently
        for col in ['commodity', 'market', 'variety', 'grade']:
            df[col] = df[col].astype(str).str.strip().str.upper()

        # 2. Sort chronologically by commodity, market, date
        df = df.sort_values(by=['commodity', 'market', 'date'])

        # 3. Drop exact duplicates
        df = df.drop_duplicates(subset=['commodity', 'market', 'date'], keep='last')

        # Convert numeric columns securely
        for col in ['min_price', 'max_price', 'modal_price', 'arrivals']:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        # 4. Handle missing/invalid target values
        # We MUST NOT blindly fill missing modal_price with 0. 
        # If modal_price is missing but min and max exist, we can impute with their average.
        mask_missing_modal = df['modal_price'].isna() | (df['modal_price'] <= 0)
        has_min_max = df['min_price'].notna() & df['max_price'].notna() & (df['min_price'] > 0)
        
        # Impute missing modal with average of min and max where available
        df.loc[mask_missing_modal & has_min_max, 'modal_price'] = (df['min_price'] + df['max_price']) / 2.0

        # Drop any rows where modal_price is STILL missing, zero, or negative.
        df = df.dropna(subset=['modal_price'])
        df = df[df['modal_price'] > 0]

        # Fill missing arrivals with 0 (assuming no data means 0 arrivals)
        df['arrivals'] = df['arrivals'].fillna(0.0)

        # 5. Outlier detection (Prices shouldn't be astronomically high or near-zero anomalies)
        # Using a sensible clip or dropping extremes based on 1st/99th percentile per commodity
        # For this version, we will drop any row where modal_price is > 1,000,000 (clear error)
        df = df[df['modal_price'] < 1000000]

        # Ensure types
        df['modal_price'] = df['modal_price'].astype(float)
        
        # Convert prices from Rs/Quintal to Rs/Kg if values are extremely high (typical of Agmarknet)
        # Assuming if mean price > 500, it's likely quintal. We will divide by 100 to standardize to per kg.
        # This is a safe heuristic for Indian ag markets where per kg price rarely exceeds 1000 INR.
        # We do this per commodity.
        for commodity in df['commodity'].unique():
            mask = df['commodity'] == commodity
            if df.loc[mask, 'modal_price'].mean() > 400:  
                df.loc[mask, 'min_price'] = df.loc[mask, 'min_price'] / 100.0
                df.loc[mask, 'max_price'] = df.loc[mask, 'max_price'] / 100.0
                df.loc[mask, 'modal_price'] = df.loc[mask, 'modal_price'] / 100.0

        return df.reset_index(drop=True)

    def generate_report(self, df_raw: pd.DataFrame, df_clean: pd.DataFrame, output_path: str = None) -> dict:
        """Generate a preprocessing report."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_rows_raw": int(len(df_raw)),
            "total_rows_clean": int(len(df_clean)),
            "removed_rows": int(len(df_raw) - len(df_clean)),
            "missing_values_raw": df_raw.isna().sum().to_dict(),
            "missing_values_clean": df_clean.isna().sum().to_dict(),
            "date_range": {
                "start": df_clean['date'].min().isoformat() if not df_clean.empty else None,
                "end": df_clean['date'].max().isoformat() if not df_clean.empty else None
            },
            "num_commodities": int(df_clean['commodity'].nunique()),
            "num_markets": int(df_clean['market'].nunique()),
            "commodities_list": df_clean['commodity'].unique().tolist()
        }
        
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump(report, f, indent=4)
                
        return report

    def process(self, raw_csv_path: str, output_csv_path: str = None, report_path: str = None) -> pd.DataFrame:
        """End-to-end data processing."""
        if not os.path.exists(raw_csv_path):
            raise FileNotFoundError(f"Dataset not found at {raw_csv_path}. Please download your historical prices CSV here.")
            
        logger.info(f"Loading raw dataset from {raw_csv_path}...")
        df_raw = pd.read_csv(raw_csv_path)
        
        logger.info("Normalizing schema...")
        df_norm = self.normalize_schema(df_raw.copy())
        
        logger.info("Cleaning data...")
        df_clean = self.clean_data(df_norm)
        
        logger.info("Generating preprocessing report...")
        report = self.generate_report(df_norm, df_clean, report_path)
        
        logger.info(f"Preprocessing complete. Cleaned {report['removed_rows']} rows. Valid rows: {report['total_rows_clean']}")
        
        if output_csv_path:
            os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
            df_clean.to_csv(output_csv_path, index=False)
            logger.info(f"Cleaned data saved to {output_csv_path}")
            
        return df_clean

# Quick test routine
if __name__ == "__main__":
    # Create dummy CSV to test the pipeline
    test_csv = "data/test_raw.csv"
    os.makedirs("data", exist_ok=True)
    
    mock_data = pd.DataFrame({
        "Price Date": ["2023-01-01", "2023-01-01", "invalid_date", "2023-01-02", "2023-01-02"],
        "Commodity": ["Tomato", "Tomato", "Tomato", "Tomato", "Tomato "],
        "Market Name": ["Bangalore", "Bangalore", "Bangalore", "Bangalore", "Bangalore"],
        "Variety": ["Local", "Local", "Local", "Local", "Local"],
        "Grade": ["FAQ", "FAQ", "FAQ", "FAQ", "FAQ"],
        "Min Price (Rs./Quintal)": [3000, 3000, 3200, 3100, None],
        "Max Price (Rs./Quintal)": [3500, 3500, 3600, 3500, None],
        "Modal Price (Rs./Quintal)": [3200, 3200, 3400, 0, None], # 0 and None should be handled
        "Arrivals (Tonnes)": [120, 120, 130, None, 140]
    })
    mock_data.to_csv(test_csv, index=False)
    
    preprocessor = DataPreprocessor()
    df_clean = preprocessor.process(
        raw_csv_path=test_csv, 
        output_csv_path="data/test_clean.csv",
        report_path="data/preprocessing_report.json"
    )
    
    print("\nCleaned Data Head:")
    print(df_clean.head())
    
    with open("data/preprocessing_report.json", "r") as f:
        print("\nPreprocessing Report:")
        print(json.dumps(json.load(f), indent=2))
