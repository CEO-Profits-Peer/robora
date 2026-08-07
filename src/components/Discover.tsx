import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useSavedRecordings } from "../hooks/useSavedRecordings";
import { useFollows } from "../hooks/useFollows";
import { useLikes } from "../hooks/useLikes";
import type { Recording } from "../lib/types";
import SoundItem from "./SoundItem";
import Profile from "./Profile";

type PosterInfo = { avatar_url: string | null; display_name: string | null };

export default function Discover({ user }: { user: User }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [posters, setPosters] = useState<Record<string, PosterInfo>>({});
  const [query, setQuery] = useState("");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { savedIds, toggleSave } = useSavedRecordings(user.id);
  const { followingIds } = useFollows(user.id);
  const { likedIds, counts: likeCounts, toggleLike } = useLikes(
    user.id,
    recordings.map((r) => r.id)
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      let req = supabase
        .from("recordings")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (query.trim()) req = req.ilike("title", `%${query.trim()}%`);

      const { data, error } = await req;
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setLoading(false);
        return;
      }
      setRecordings(data as Recording[]);

      const userIds = [...new Set((data as Recording[]).map((r) => r.user_id))];
      const [urlEntries, profileRows] = await Promise.all([
        Promise.all(
          (data as Recording[]).map(async (r) => {
            const { data: signed } = await supabase.storage
              .from("recordings")
              .createSignedUrl(r.audio_path, 60 * 60 * 6);
            return [r.id, signed?.signedUrl ?? ""] as const;
          })
        ),
        userIds.length
          ? supabase.from("profiles").select("id, avatar_url, display_name").in("id", userIds).then((res) => res.data ?? [])
          : Promise.resolve([]),
      ]);

      if (!cancelled) {
        setUrls(Object.fromEntries(urlEntries));
        setPosters(
          Object.fromEntries(profileRows.map((p) => [p.id, { avatar_url: p.avatar_url, display_name: p.display_name }]))
        );
        setLoading(false);
      }
    }
    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  if (viewingUserId) {
    return <Profile userId={viewingUserId} currentUserId={user.id} onBack={() => setViewingUserId(null)} />;
  }

  const visible = onlyFollowed ? recordings.filter((r) => followingIds.has(r.user_id)) : recordings;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Suche nach Titel (z.B. 'a-Deklination')…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-parchment/10 bg-ink-2 px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment-dim/50 focus:border-terracotta"
      />

      <div className="flex rounded-lg bg-ink-2 p-0.5 text-xs">
        <button
          onClick={() => setOnlyFollowed(false)}
          className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
            !onlyFollowed ? "bg-terracotta text-ink" : "text-parchment-dim"
          }`}
        >
          Alle
        </button>
        <button
          onClick={() => setOnlyFollowed(true)}
          className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${
            onlyFollowed ? "bg-terracotta text-ink" : "text-parchment-dim"
          }`}
        >
          Folge ich
        </button>
      </div>

      {loading && <p className="py-8 text-center text-sm text-parchment-dim">Lädt…</p>}

      {!loading && loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          Fehler beim Laden: {loadError}
        </div>
      )}

      {!loading && !loadError && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
          {onlyFollowed
            ? "Du folgst noch niemandem mit öffentlichen Aufnahmen."
            : query
              ? "Keine öffentlichen Aufnahmen gefunden."
              : "Noch keine öffentlichen Aufnahmen von der Community."}
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => (
          <SoundItem
            key={r.id}
            recording={r}
            url={urls[r.id]}
            avatarUrl={posters[r.user_id]?.avatar_url}
            posterName={posters[r.user_id]?.display_name}
            onAvatarClick={() => setViewingUserId(r.user_id)}
            queue={visible}
            saved={savedIds.has(r.id)}
            onToggleSave={() => toggleSave(r.id)}
            liked={likedIds.has(r.id)}
            likeCount={likeCounts[r.id]}
            onToggleLike={() => toggleLike(r.id)}
          />
        ))}
      </ul>
    </div>
  );
}
