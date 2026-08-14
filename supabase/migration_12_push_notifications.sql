-- Web-Push-Abos für Benachrichtigungen (z.B. neue Gruppen-Chat-Nachrichten). Idempotent.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage their push subscriptions" on push_subscriptions;
create policy "Users manage their push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Die Edge Function send-chat-push liest über den service_role Key (RLS-Bypass)
-- die Abos anderer Gruppenmitglieder, um neue Chat-Nachrichten zuzustellen.
