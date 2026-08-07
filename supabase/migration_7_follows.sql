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
