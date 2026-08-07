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
