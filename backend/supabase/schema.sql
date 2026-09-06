-- Farm-to-Fork Tracker: Supabase (Postgres) schema
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)

-- Extension for UUID generation
create extension if not exists "pgcrypto";

-- =========================
-- USERS
-- =========================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null, -- bcrypt hash
  role text not null default 'consumer'
    check (role in ('admin', 'farmer', 'processor', 'distributor', 'retailer', 'consumer')),
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);

-- =========================
-- PRODUCTS
-- =========================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_id integer default 0, -- mapping to blockchain ID
  name text not null,
  category text not null,
  batch_number text not null,
  quantity numeric not null,
  farmer_id uuid not null references public.users(id),
  current_owner_id uuid not null references public.users(id),
  status text not null default 'Harvested',
  organic_status boolean default false,
  ai_quality_score numeric,
  ai_quality_label text,
  ai_shelf_life jsonb,
  blockchain_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_farmer_id on public.products (farmer_id);
create index if not exists idx_products_created_at on public.products (created_at desc);

-- Product photo and expiry metadata. These statements are safe for existing projects.
alter table public.products add column if not exists expiry_date date;
alter table public.products add column if not exists product_image_url text;

-- Product images are uploaded by the Express backend using the Supabase service role.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =========================
-- ROW LEVEL SECURITY
-- =========================
-- The Express backend talks to Supabase using the SERVICE ROLE key,
-- which bypasses RLS entirely — so the app keeps working exactly as before
-- with no policy changes needed. RLS is enabled anyway as defense-in-depth
-- in case the anon/public key is ever used directly from the frontend.
alter table public.users enable row level security;
alter table public.products enable row level security;

-- No policies are defined for the anon/authenticated roles, so direct
-- =========================
-- SHIPMENTS (Logistics)
-- =========================
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_id text not null unique, -- Custom ID like SHP-2026-001
  product_id uuid not null references public.products(id) on delete cascade,
  distributor_id uuid not null references public.users(id),
  processor_name text,
  retailer_name text,
  vehicle_no text not null,
  vehicle_type text,
  driver_name text,
  driver_phone text,
  driver_license text,
  status text not null default 'Packed' check (status in ('Packed', 'In Transit', 'Delivered')),
  location text,
  expected_delivery timestamptz,
  delivery_date timestamptz,
  temp_safe_min numeric,
  temp_safe_max numeric,
  cold_chain_violation boolean default false,
  violation_message text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipments_product_id on public.shipments (product_id);
create index if not exists idx_shipments_distributor_id on public.shipments (distributor_id);

drop trigger if exists trg_shipments_updated_at on public.shipments;
create trigger trg_shipments_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

alter table public.shipments enable row level security;


-- =========================
-- TELEMETRY LOGS (Cold-Chain)
-- =========================
create table if not exists public.telemetry_logs (
  id uuid primary key default gen_random_uuid(),
  log_id text not null unique, -- Custom ID like LOG-101
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  temperature numeric not null,
  humidity numeric not null,
  location text,
  status text not null default 'Normal' check (status in ('Normal', 'Warning', 'Critical Violation')),
  logged_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_logs_shipment_id on public.telemetry_logs (shipment_id);
create index if not exists idx_telemetry_logs_created_at on public.telemetry_logs (created_at desc);

alter table public.telemetry_logs enable row level security;
