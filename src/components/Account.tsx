import { useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import Profile from "./Profile";

export default function Account({ user }: { user: User }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.user_metadata?.avatar_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 3 * 1024 * 1024) {
      setError("Bild ist zu groß (max. 3 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: userErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (userErr) throw userErr;

      // Auch in "profiles" spiegeln, damit andere Nutzer das Bild im Entdecken-Tab sehen können
      // (auth.users ist clientseitig nicht für andere Nutzer lesbar).
      await supabase.from("profiles").upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() });

      setAvatarUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-parchment/10 bg-ink-2 p-8 text-center">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profilbild"
              className="h-24 w-24 rounded-full border border-terracotta/25 object-cover shadow-lg shadow-black/40"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-terracotta/25 bg-ink-3 shadow-lg shadow-black/40">
              <UserIcon className="h-10 w-10 text-parchment-dim" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFile} className="hidden" id="avatar-input" />
        <label
          htmlFor="avatar-input"
          className="cursor-pointer rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-black/30 active:scale-[0.98]"
        >
          {uploading ? "Lädt hoch…" : avatarUrl ? "Profilbild ändern" : "Profilbild hochladen"}
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}

        <p className="text-sm text-parchment">{user.email}</p>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-parchment/10 px-4 py-3 text-sm text-parchment-dim active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        Abmelden
      </button>

      <div>
        <p className="mb-2 text-sm font-medium text-parchment/80">Deine öffentlichen Aufnahmen</p>
        <Profile userId={user.id} showHeader={false} />
      </div>
    </div>
  );
}
