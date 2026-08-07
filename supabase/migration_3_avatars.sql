-- Profilbilder: im Supabase Dashboard zuerst Storage -> New bucket -> Name "avatars",
-- diesmal "Public" EINSCHALTEN (damit Profilbilder ohne Signed-URL-Umweg geladen werden können).
-- Danach diese Policies im SQL Editor ausführen:

create policy "Users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
