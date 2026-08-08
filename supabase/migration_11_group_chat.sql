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
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
    ) then
      alter publication supabase_realtime add table group_messages;
    end if;
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
