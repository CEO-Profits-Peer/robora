-- ROBORA: konsolidiertes Update-Skript (migration_2 bis migration_11).
-- Einmal komplett in den Supabase SQL Editor einfügen und ausführen, statt jede Datei einzeln.
-- Idempotent -- kann gefahrlos mehrfach ausgeführt werden. Bei Neuinstallation nicht nötig (schon in schema.sql enthalten).

-- ============================================================
-- migration_2_social.sql
-- ============================================================
-- Social-Feature: öffentliche Aufnahmen. Im SQL Editor ausführen (einmalig).

alter table recordings add column if not exists is_public boolean not null default false;

-- Zusätzliche (additive) Policy: öffentliche Aufnahmen sind für ALLE eingeloggten Nutzer lesbar,
-- die bestehende "Users manage own recordings"-Policy bleibt unverändert für alles andere.
drop policy if exists "Public recordings are readable by anyone" on recordings;
create policy "Public recordings are readable by anyone"
  on recordings for select
  using (is_public = true);

-- Gleiches für die Audiodateien im Storage: ein signiertes Link-Erzeugen für eine fremde,
-- öffentliche Aufnahme funktioniert nur, wenn diese Policy existiert.
drop policy if exists "Public recording audio is readable by anyone" on storage.objects;
create policy "Public recording audio is readable by anyone"
  on storage.objects for select
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from recordings r
      where r.audio_path = storage.objects.name and r.is_public = true
    )
  );

-- ============================================================
-- migration_3_avatars.sql
-- ============================================================
-- Profilbilder: Bucket + Policies. Idempotent -- kann gefahrlos mehrfach ausgeführt werden.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- migration_4_profiles.sql
-- ============================================================
-- Öffentliche Profile (nur Avatar), damit andere Nutzer im "Entdecken"-Tab
-- ein Profilbild sehen und darauf klicken können, um alle Aufnahmen dieser Person zu sehen.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Profiles are readable by anyone" on profiles;
create policy "Profiles are readable by anyone" on profiles for select using (true);

drop policy if exists "Users manage own profile" on profiles;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- migration_5_name_saved.sql
-- ============================================================
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

-- ============================================================
-- migration_6_spaced_repetition.sql
-- ============================================================
-- Spaced Repetition für Vokabelkarten. Idempotent.

alter table vocab_cards add column if not exists ease_factor numeric not null default 2.5;
alter table vocab_cards add column if not exists interval_days numeric not null default 0;
alter table vocab_cards add column if not exists repetitions integer not null default 0;
alter table vocab_cards add column if not exists due_at timestamptz not null default now();
alter table vocab_cards add column if not exists last_reviewed_at timestamptz;

-- ============================================================
-- migration_7_follows.sql
-- ============================================================
-- Follow-System. Idempotent.

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id)
);

alter table follows enable row level security;

drop policy if exists "Users manage own follows" on follows;
create policy "Users manage own follows" on follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

drop policy if exists "Follow counts are readable by anyone" on follows;
create policy "Follow counts are readable by anyone" on follows
  for select using (true);

-- ============================================================
-- migration_8_likes.sql
-- ============================================================
-- Likes für öffentliche Aufnahmen. Idempotent.

create table if not exists likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  recording_id uuid not null references recordings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recording_id)
);

alter table likes enable row level security;

drop policy if exists "Users manage own likes" on likes;
create policy "Users manage own likes" on likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Like counts are readable by anyone" on likes;
create policy "Like counts are readable by anyone" on likes
  for select using (true);

-- ============================================================
-- migration_9_groups.sql
-- ============================================================
-- Gruppen zum Teilen von Aufnahmen & Vokabelkarten. Idempotent.
-- Bewusst kein Chat/Freitext-Messaging (eigenes größeres Thema wegen Moderation).

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

alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_shared_recordings enable row level security;
alter table group_shared_cards enable row level security;

drop policy if exists "Authenticated users can read groups" on groups;
create policy "Authenticated users can read groups" on groups
  for select using (auth.role() = 'authenticated');

drop policy if exists "Users create groups" on groups;
create policy "Users create groups" on groups
  for insert with check (auth.uid() = created_by);

drop policy if exists "Creators update their groups" on groups;
create policy "Creators update their groups" on groups
  for update using (auth.uid() = created_by);

drop policy if exists "Creators delete their groups" on groups;
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

drop policy if exists "Members see membership" on group_members;
create policy "Members see membership" on group_members
  for select using (is_group_member(group_id));

drop policy if exists "Users join groups" on group_members;
create policy "Users join groups" on group_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users leave groups" on group_members;
create policy "Users leave groups" on group_members
  for delete using (auth.uid() = user_id);

drop policy if exists "Members read shared recordings" on group_shared_recordings;
create policy "Members read shared recordings" on group_shared_recordings
  for select using (
    exists (select 1 from group_members gm where gm.group_id = group_shared_recordings.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "Members share recordings to their groups" on group_shared_recordings;
create policy "Members share recordings to their groups" on group_shared_recordings
  for insert with check (
    auth.uid() = shared_by
    and exists (select 1 from group_members gm where gm.group_id = group_shared_recordings.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "Sharers remove their shared recordings" on group_shared_recordings;
create policy "Sharers remove their shared recordings" on group_shared_recordings
  for delete using (auth.uid() = shared_by);

drop policy if exists "Members read shared cards" on group_shared_cards;
create policy "Members read shared cards" on group_shared_cards
  for select using (
    exists (select 1 from group_members gm where gm.group_id = group_shared_cards.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "Members share cards to their groups" on group_shared_cards;
create policy "Members share cards to their groups" on group_shared_cards
  for insert with check (
    auth.uid() = shared_by
    and exists (select 1 from group_members gm where gm.group_id = group_shared_cards.group_id and gm.user_id = auth.uid())
  );

drop policy if exists "Sharers remove their shared cards" on group_shared_cards;
create policy "Sharers remove their shared cards" on group_shared_cards
  for delete using (auth.uid() = shared_by);

drop policy if exists "Group members can read shared recordings" on recordings;
create policy "Group members can read shared recordings" on recordings
  for select using (
    exists (
      select 1 from group_shared_recordings gsr
      join group_members gm on gm.group_id = gsr.group_id
      where gsr.recording_id = recordings.id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Group members can read shared cards" on vocab_cards;
create policy "Group members can read shared cards" on vocab_cards
  for select using (
    exists (
      select 1 from group_shared_cards gsc
      join group_members gm on gm.group_id = gsc.group_id
      where gsc.vocab_card_id = vocab_cards.id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "Group shared recording audio is readable by members" on storage.objects;
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

-- ============================================================
-- migration_10_fix_group_rls.sql
-- ============================================================
-- KRITISCHER FIX: Die Policy "Members see membership" auf group_members fragt
-- group_members innerhalb ihrer eigenen USING-Klausel ab. Postgres erkennt das
-- als Endlosrekursion ("infinite recursion detected in policy for relation
-- group_members") und wirft einen Fehler. Weil group_shared_recordings,
-- group_shared_cards, recordings und vocab_cards diese Tabelle in ihren eigenen
-- Policies mit abfragen, kann der Fehler durchschlagen und z.B. auch das ganz
-- normale Laden deiner eigenen Aufnahmen in "Anhören" zum Scheitern bringen —
-- sie sehen dann aus wie gelöscht, sind es aber nicht.
--
-- Fix: Mitgliedschaft über eine SECURITY DEFINER-Funktion prüfen, die RLS
-- intern umgeht und damit die Rekursion durchbricht. Ausführen und danach
-- die App neu laden — deine Aufnahmen sollten sofort wieder da sein.

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

drop policy if exists "Members see membership" on group_members;
create policy "Members see membership" on group_members
  for select using (is_group_member(group_id));

-- ============================================================
-- migration_11_group_chat.sql
-- ============================================================
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

