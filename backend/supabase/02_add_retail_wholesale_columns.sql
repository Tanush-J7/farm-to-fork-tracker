-- Add explicit wholesale and retail columns for vegetablemarketprice.com integration
ALTER TABLE public.market_prices
ADD COLUMN IF NOT EXISTS wholesale_price numeric,
ADD COLUMN IF NOT EXISTS retail_min numeric,
ADD COLUMN IF NOT EXISTS retail_max numeric,
ADD COLUMN IF NOT EXISTS retail_unit text;
