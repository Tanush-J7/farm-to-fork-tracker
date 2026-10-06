-- =========================
-- MARKET PRICES
-- =========================
-- This table stores historical agricultural commodity prices to be ingested by the AI model.

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  commodity text not null,
  market text not null,
  variety text,
  grade text,
  min_price numeric,
  max_price numeric,
  modal_price numeric not null,
  arrivals numeric,
  created_at timestamptz not null default now()
);

-- Index for fast time-series queries filtering by commodity and market
create index if not exists idx_market_prices_lookup on public.market_prices (commodity, market, date desc);

-- RLS Policy (Optional: Allow read access so backend/frontend can fetch it)
alter table public.market_prices enable row level security;

-- Only admins/service role can insert, but anyone can read for prediction features
create policy "Allow public read access on market_prices" 
  on public.market_prices for select 
  using (true);
