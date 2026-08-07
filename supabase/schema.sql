-- ROBORA: Datenbank-Schema für Supabase
-- Ausführen unter: Supabase Dashboard -> SQL Editor -> New query -> einfügen -> Run

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Ohne Titel',
  tag text not null default 'Vokabeln',
  audio_path text not null,
  duration numeric,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists vocab_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  latin text not null,
  german text not null,
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table recordings enable row level security;
alter table vocab_cards enable row level security;
alter table profiles enable row level security;

create policy "Users manage own recordings" on recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Public recordings are readable by anyone" on recordings
  for select using (is_public = true);

create policy "Users manage own vocab cards" on vocab_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Profiles are readable by anyone" on profiles for select using (true);

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Storage-Buckets anlegen (kein Dashboard-Klick nötig):

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "Users upload own audio"
  on storage.objects for insert
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own audio"
  on storage.objects for select
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own audio"
  on storage.objects for delete
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public recording audio is readable by anyone"
  on storage.objects for select
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from recordings r
      where r.audio_path = storage.objects.name and r.is_public = true
    )
  );

create policy "Users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
