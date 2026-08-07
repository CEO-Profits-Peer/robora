-- Spaced Repetition für Vokabelkarten. Idempotent.

alter table vocab_cards add column if not exists ease_factor numeric not null default 2.5;
alter table vocab_cards add column if not exists interval_days numeric not null default 0;
alter table vocab_cards add column if not exists repetitions integer not null default 0;
alter table vocab_cards add column if not exists due_at timestamptz not null default now();
alter table vocab_cards add column if not exists last_reviewed_at timestamptz;
