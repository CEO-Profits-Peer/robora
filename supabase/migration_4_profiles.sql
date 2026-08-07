-- Öffentliche Profile (nur Avatar), damit andere Nutzer im "Entdecken"-Tab
-- ein Profilbild sehen und darauf klicken können, um alle Aufnahmen dieser Person zu sehen.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are readable by anyone" on profiles for select using (true);

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
