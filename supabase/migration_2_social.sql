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
