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
  ease_factor numeric not null default 2.5,
  interval_days numeric not null default 0,
  repetitions integer not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  display_name text,
  updated_at timestamptz not null default now()
);

create table if not exists saved_recordings (
  user_id uuid not null references auth.users(id) on delete cascade,
  recording_id uuid not null references recordings(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, recording_id)
);

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id)
);

create table if not exists likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  recording_id uuid not null references recordings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recording_id)
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists group_shared_recordings (
  group_id uuid not null references groups(id) on delete cascade,
  recording_id uuid not null references recordings(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (group_id, recording_id)
);

create table if not exists group_shared_cards (
  group_id uuid not null references groups(id) on delete cascade,
  vocab_card_id uuid not null references vocab_cards(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (group_id, vocab_card_id)
);

alter table recordings enable row level security;
alter table vocab_cards enable row level security;
alter table profiles enable row level security;
alter table saved_recordings enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_shared_recordings enable row level security;
alter table group_shared_cards enable row level security;

create policy "Users manage own recordings" on recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Public recordings are readable by anyone" on recordings
  for select using (is_public = true);

create policy "Users manage own vocab cards" on vocab_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Profiles are readable by anyone" on profiles for select using (true);

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own saved recordings" on saved_recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own follows" on follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

create policy "Follow counts are readable by anyone" on follows
  for select using (true);

create policy "Users manage own likes" on likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Like counts are readable by anyone" on likes
  for select using (true);

-- Gruppen: jeder eingeloggte Nutzer kann Gruppen sehen (z.B. um per Einladungscode
-- beizutreten), aber nur Mitglieder sehen die Mitgliederliste und geteilten Inhalte.

create policy "Authenticated users can read groups" on groups
  for select using (auth.role() = 'authenticated');

create policy "Users create groups" on groups
  for insert with check (auth.uid() = created_by);

create policy "Creators update their groups" on groups
  for update using (auth.uid() = created_by);

create policy "Creators delete their groups" on groups
  for delete using (auth.uid() = created_by);

-- SECURITY DEFINER, damit die Mitgliedschaftsprüfung nicht die RLS-Policy von
-- group_members selbst auslöst (das würde eine Endlosrekursion verursachen).
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = target_group_id and user_id = auth.uid()
  );
$$;

create policy "Members see membership" on group_members
  for select using (is_group_member(group_id));

create policy "Users join groups" on group_members
  for insert with check (auth.uid() = user_id);

create policy "Users leave groups" on group_members
  for delete using (auth.uid() = user_id);

create policy "Members read shared recordings" on group_shared_recordings
  for select using (
    exists (select 1 from group_members gm where gm.group_id = group_shared_recordings.group_id and gm.user_id = auth.uid())
  );

create policy "Members share recordings to their groups" on group_shared_recordings
  for insert with check (
    auth.uid() = shared_by
    and exists (select 1 from group_members gm where gm.group_id = group_shared_recordings.group_id and gm.user_id = auth.uid())
  );

create policy "Sharers remove their shared recordings" on group_shared_recordings
  for delete using (auth.uid() = shared_by);

create policy "Members read shared cards" on group_shared_cards
  for select using (
    exists (select 1 from group_members gm where gm.group_id = group_shared_cards.group_id and gm.user_id = auth.uid())
  );

create policy "Members share cards to their groups" on group_shared_cards
  for insert with check (
    auth.uid() = shared_by
    and exists (select 1 from group_members gm where gm.group_id = group_shared_cards.group_id and gm.user_id = auth.uid())
  );

create policy "Sharers remove their shared cards" on group_shared_cards
  for delete using (auth.uid() = shared_by);

-- Damit geteilte (nicht öffentliche) Aufnahmen/Karten für Gruppenmitglieder überhaupt lesbar sind:

create policy "Group members can read shared recordings" on recordings
  for select using (
    exists (
      select 1 from group_shared_recordings gsr
      join group_members gm on gm.group_id = gsr.group_id
      where gsr.recording_id = recordings.id and gm.user_id = auth.uid()
    )
  );

create policy "Group members can read shared cards" on vocab_cards
  for select using (
    exists (
      select 1 from group_shared_cards gsc
      join group_members gm on gm.group_id = gsc.group_id
      where gsc.vocab_card_id = vocab_cards.id and gm.user_id = auth.uid()
    )
  );

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

create policy "Group shared recording audio is readable by members"
  on storage.objects for select
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from recordings r
      join group_shared_recordings gsr on gsr.recording_id = r.id
      join group_members gm on gm.group_id = gsr.group_id
      where r.audio_path = storage.objects.name and gm.user_id = auth.uid()
    )
  );

-- Gruppen-Chat (migration_11_group_chat.sql)
-- Live-Chat innerhalb von Gruppen: Text- und Bildnachrichten, per Supabase Realtime. Idempotent.

create table if not exists group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text,
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists group_messages_group_created_idx on group_messages (group_id, created_at);

alter table group_messages enable row level security;

drop policy if exists "Members read group messages" on group_messages;
create policy "Members read group messages" on group_messages
  for select using (is_group_member(group_id));

drop policy if exists "Members send group messages" on group_messages;
create policy "Members send group messages" on group_messages
  for insert with check (auth.uid() = user_id and is_group_member(group_id));

drop policy if exists "Authors delete their group messages" on group_messages;
create policy "Authors delete their group messages" on group_messages
  for delete using (auth.uid() = user_id);

-- Live-Updates aktivieren (falls noch nicht Teil der Publication).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table group_messages;
  end if;
end $$;

-- Bild-Anhänge: eigener privater Bucket, Pfad-Schema {group_id}/{dateiname}.
insert into storage.buckets (id, name, public)
values ('group-chat', 'group-chat', false)
on conflict (id) do update set public = false;

drop policy if exists "Members upload chat images" on storage.objects;
create policy "Members upload chat images"
  on storage.objects for insert
  with check (bucket_id = 'group-chat' and is_group_member((storage.foldername(name))[1]::uuid));

drop policy if exists "Members read chat images" on storage.objects;
create policy "Members read chat images"
  on storage.objects for select
  using (bucket_id = 'group-chat' and is_group_member((storage.foldername(name))[1]::uuid));

drop policy if exists "Uploaders delete their chat images" on storage.objects;
create policy "Uploaders delete their chat images"
  on storage.objects for delete
  using (bucket_id = 'group-chat' and owner = auth.uid());
