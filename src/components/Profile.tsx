import { useEffect, useState } from "react";
import { ArrowLeft, Download, ListPlus, Pause, Play, User as UserIcon } from "lucide-react";
import { supabase } from "../lib/supabase";
import { downloadFile, safeFilename } from "../lib/download";
import { formatTime } from "../lib/format";
import type { Recording } from "../lib/types";
import { usePlayer, type Track } from "../context/PlayerContext";

function ProfileRecording({ r, url, queue }: { r: Recording; url: string | undefined; queue: Recording[] }) {
  const player = usePlayer();
  const isCurrent = player.current?.id === r.id;
  const toTrack = (rec: Recording): Track => ({ id: rec.id, title: rec.title, tag: rec.tag, url: url ?? "" });

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
        isCurrent ? "border-terracotta/50 bg-terracotta/10" : "border-parchment/10 bg-ink-2"
      }`}
    >
      <button
        onClick={() => player.play(toTrack(r), queue.map(toTrack))}
        disabled={!url}
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
        onClick={() => url && player.addToQueue(toTrack(r))}
        disabled={!url}
        className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
        title="Zur Warteschlange hinzufügen"
      >
        <ListPlus className="h-4 w-4" />
      </button>
      <button
        onClick={() => url && downloadFile(url, safeFilename(r.title, "webm"))}
        disabled={!url}
        className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
        title="Herunterladen"
      >
        <Download className="h-4 w-4" />
      </button>
    </li>
  );
}

export default function Profile({
  userId,
  onBack,
  showHeader = true,
}: {
  userId: string;
  onBack?: () => void;
  showHeader?: boolean;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: profile }, { data: recs }] = await Promise.all([
        supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle(),
        supabase
          .from("recordings")
          .select("*")
          .eq("user_id", userId)
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setAvatarUrl(profile?.avatar_url ?? null);
      const list = (recs as Recording[]) ?? [];
      setRecordings(list);

      const entries = await Promise.all(
        list.map(async (r) => {
          const { data: signed } = await supabase.storage.from("recordings").createSignedUrl(r.audio_path, 60 * 60 * 6);
          return [r.id, signed?.signedUrl ?? ""] as const;
        })
      );
      if (!cancelled) {
        setUrls(Object.fromEntries(entries));
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-parchment-dim active:text-parchment">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
      )}

      {showHeader && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full border border-terracotta/25 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-terracotta/25 bg-ink-3">
              <UserIcon className="h-8 w-8 text-parchment-dim" strokeWidth={1.5} />
            </div>
          )}
          <p className="text-sm text-parchment-dim">
            {loading ? "Lädt…" : `${recordings.length} öffentliche Aufnahme${recordings.length === 1 ? "" : "n"}`}
          </p>
        </div>
      )}

      {!loading && recordings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
          Noch keine öffentlichen Aufnahmen.
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {recordings.map((r) => (
          <ProfileRecording key={r.id} r={r} url={urls[r.id]} queue={recordings} />
        ))}
      </ul>
    </div>
  );
}
