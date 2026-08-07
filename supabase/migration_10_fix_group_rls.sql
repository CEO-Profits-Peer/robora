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
