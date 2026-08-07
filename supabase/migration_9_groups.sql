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
