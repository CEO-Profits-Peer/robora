-- Account-Name + "Aufnahmen speichern"-Feature. Idempotent.

alter table profiles add column if not exists display_name text;

create table if not exists saved_recordings (
  user_id uuid not null references auth.users(id) on delete cascade,
  recording_id uuid not null references recordings(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, recording_id)
);

alter table saved_recordings enable row level security;

drop policy if exists "Users manage own saved recordings" on saved_recordings;
create policy "Users manage own saved recordings" on saved_recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
