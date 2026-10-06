-- Migration to support Kafka event streaming

-- 1. Update market_prices table
ALTER TABLE public.market_prices 
ADD COLUMN IF NOT EXISTS event_id text,
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS data_as_of date,
ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

-- Add a unique constraint for upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_market_prices_commodity_market_date'
    ) THEN
        ALTER TABLE public.market_prices ADD CONSTRAINT uq_market_prices_commodity_market_date UNIQUE (commodity, market, date);
    END IF;
END $$;

-- 2. Create processed_events table for idempotency
CREATE TABLE IF NOT EXISTS public.processed_events (
    event_id text NOT NULL,
    topic text NOT NULL,
    consumer_group text NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, consumer_group)
);

-- 3. Create event_outbox table (for future phases)
CREATE TABLE IF NOT EXISTS public.event_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL UNIQUE,
    event_type text NOT NULL,
    topic text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    retry_count integer NOT NULL DEFAULT 0,
    last_error text
);
