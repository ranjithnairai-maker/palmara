-- Palmistica schema. Run against a fresh Supabase project.
-- All access is server-side via the service role key, which bypasses RLS.

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  image_path text,                              -- path in the palm-photos storage bucket; null once retention-pruned
  hand_element text,                            -- "Earth" | "Air" | "Fire" | "Water" | null
  reading_text text not null default '',        -- Quick Insights prose (markdown)
  status text not null default 'processing',    -- 'processing' | 'complete' | 'failed'
  analysis_json jsonb,                          -- structured vision-model output (lines, mounts) — analyzed once
  detailed_text text,                           -- Detailed Reading, generated on demand from analysis_json
  detailed_status text,                         -- null | 'processing' | <failure message>; see lib/generateReading.ts
  owner_token uuid not null default gen_random_uuid(), -- proves ownership for manual delete; never exposed after creation
  image_deleted_at timestamptz,                 -- set when the 90-day retention job prunes the photo
  generation_claimed_at timestamptz             -- lease for atomic /generate claiming; see lib/readings.ts claimGeneration()
);

-- Tombstone for owner-deleted readings, so their URL can show a friendly
-- "removed by its owner" message instead of an indistinguishable 404.
create table if not exists public.deleted_readings (
  id uuid primary key,
  deleted_at timestamptz not null default now()
);

create table if not exists public.reading_messages (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings(id) on delete cascade,
  role text not null,                           -- 'user' | 'assistant'
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists reading_messages_reading_id_created_at_idx
  on public.reading_messages (reading_id, created_at);

-- Server-side rate limiting store. No raw IPs — only a salted SHA-256 hash
-- (see lib/rateLimit.ts), so this table can't be used to identify a client.
create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,        -- 'create_reading' | 'generate_reading' | 'chat_message'
  client_key text not null,    -- sha256(salt + ip)
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup_idx
  on public.rate_limit_hits (bucket, client_key, created_at);

-- Paid ebook orders ("Learn Palmistry Basics", $1 one-time). A row only
-- ever gets inserted by the verified Stripe webhook handler once a
-- checkout.session.completed event confirms payment — its mere existence
-- means the order is paid, so there's no separate status column to track.
-- download_token is a capability distinct from stripe_session_id (which is
-- visible in the success-page URL) so the success page can be safely
-- revisited without itself granting a fresh download once the token's own
-- cap/expiry are spent. See app/api/stripe/webhook/route.ts.
create table if not exists public.ebook_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_session_id text not null unique,
  stripe_event_id text not null,
  email text,
  paid_at timestamptz not null default now(),
  download_token uuid not null default gen_random_uuid(),
  download_count int not null default 0,
  max_downloads int not null default 5,
  expires_at timestamptz not null default (now() + interval '48 hours')
);

create unique index if not exists ebook_orders_download_token_idx
  on public.ebook_orders (download_token);

-- Lock all tables down. No policies => no anon/public access; the
-- server's service role key bypasses RLS.
alter table public.readings enable row level security;
alter table public.reading_messages enable row level security;
alter table public.rate_limit_hits enable row level security;
alter table public.deleted_readings enable row level security;
alter table public.ebook_orders enable row level security;

-- Private Storage bucket for palm photos (create via dashboard or this insert).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('palm-photos', 'palm-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Private Storage bucket holding the single shared ebook PDF. Access is
-- gated entirely by the download_token cap/expiry check in
-- app/api/ebook/download/route.ts, not by bucket policy — that route mints
-- a short-lived signed URL per allowed download rather than exposing this
-- bucket directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ebook-files', 'ebook-files', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
