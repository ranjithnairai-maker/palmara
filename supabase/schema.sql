-- Palmara schema. Run against a fresh Supabase project.
-- All access is server-side via the service role key, which bypasses RLS.

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  image_path text not null,                    -- path in the palm-photos storage bucket
  hand_element text,                            -- "Earth" | "Air" | "Fire" | "Water" | null
  reading_text text not null default '',        -- initial full reading, markdown
  status text not null default 'processing'     -- 'processing' | 'complete' | 'failed'
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

-- Lock both tables down. No policies => no anon/public access; the server's
-- service role key bypasses RLS.
alter table public.readings enable row level security;
alter table public.reading_messages enable row level security;

-- Private Storage bucket for palm photos (create via dashboard or this insert).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('palm-photos', 'palm-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
