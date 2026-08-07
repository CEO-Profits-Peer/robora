import { useEffect, useState } from "react";
import { Download, ListPlus, Pause, Play, User as UserIcon, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { downloadFile, safeFilename } from "../lib/download";
import type { Recording } from "../lib/types";
import { usePlayer, type Track } from "../context/PlayerContext";

function formatTime(sec: number) {
  if (!sec || Number.isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function Discover() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let req = supabase
        .from("recordings")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (query.trim()) req = req.ilike("title", `%${query.trim()}%`);

      const { data, error } = await req;
      if (cancelled) return;
      if (error || !data) {
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
          ? supabase.from("profiles").select("id, avatar_url").in("id", userIds).then((res) => res.data ?? [])
          : Promise.resolve([]),
      ]);

      if (!cancelled) {
        setUrls(Object.fromEntries(urlEntries));
        setAvatars(Object.fromEntries(profileRows.map((p) => [p.id, p.avatar_url])));
        setLoading(false);
      }
    }
    const t = setTimeout(load, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const toTrack = (r: Recording): Track => ({ id: r.id, title: r.title, tag: r.tag, url: urls[r.id] });
  const visible = profileFilter ? recordings.filter((r) => r.user_id === profileFilter) : recordings;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Suche nach Titel (z.B. 'a-Deklination')…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-parchment/10 bg-ink-2 px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment-dim/50 focus:border-terracotta"
      />

      {profileFilter && (
        <div className="flex items-center justify-between rounded-xl border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-sm text-parchment">
          Zeige nur Aufnahmen dieser Person
          <button onClick={() => setProfileFilter(null)} className="flex items-center gap-1 text-xs text-gold">
            <X className="h-3.5 w-3.5" /> Zurücksetzen
          </button>
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-parchment-dim">Lädt…</p>}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
          {query || profileFilter ? "Keine öffentlichen Aufnahmen gefunden." : "Noch keine öffentlichen Aufnahmen von der Community."}
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => {
          const isCurrent = player.current?.id === r.id;
          const avatarUrl = avatars[r.user_id];
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                isCurrent ? "border-terracotta/50 bg-terracotta/10" : "border-parchment/10 bg-ink-2"
              }`}
            >
              <button
                onClick={() => setProfileFilter(r.user_id)}
                title="Alle Aufnahmen dieser Person ansehen"
                className="shrink-0"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-3">
                    <UserIcon className="h-4 w-4 text-parchment-dim" />
                  </span>
                )}
              </button>
              <button
                onClick={() => player.play(toTrack(r), visible.map(toTrack))}
                disabled={!urls[r.id]}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-3 disabled:opacity-30"
              >
                {isCurrent && player.isPlaying ? (
                  <Pause className="h-4 w-4 text-parchment" fill="currentColor" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 text-parchment" fill="currentColor" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-parchment">{r.title}</p>
                <p className="text-xs text-parchment-dim">
                  {r.tag} · {formatTime(r.duration ?? 0)}
                </p>
              </div>
              <button
                onClick={() => urls[r.id] && player.addToQueue(toTrack(r))}
                disabled={!urls[r.id]}
                className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
                title="Zur Warteschlange hinzufügen"
              >
                <ListPlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => urls[r.id] && downloadFile(urls[r.id], safeFilename(r.title, "webm"))}
                disabled={!urls[r.id]}
                className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
                title="Herunterladen"
              >
                <Download className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
