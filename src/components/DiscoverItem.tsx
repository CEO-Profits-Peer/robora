import { Download, ListPlus, Pause, Play, User as UserIcon } from "lucide-react";
import { downloadFile, safeFilename } from "../lib/download";
import { formatTime } from "../lib/format";
import type { Recording } from "../lib/types";
import { usePlayer, type Track } from "../context/PlayerContext";

export default function DiscoverItem({
  recording: r,
  url,
  avatarUrl,
  queue,
  onSelectProfile,
}: {
  recording: Recording;
  url: string | undefined;
  avatarUrl: string | null | undefined;
  queue: Recording[];
  onSelectProfile: (userId: string) => void;
}) {
  const player = usePlayer();
  const isCurrent = player.current?.id === r.id;
  const toTrack = (rec: Recording): Track => ({ id: rec.id, title: rec.title, tag: rec.tag, url: url ?? "" });

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
        isCurrent ? "border-terracotta/50 bg-terracotta/10" : "border-parchment/10 bg-ink-2"
      }`}
    >
      <button onClick={() => onSelectProfile(r.user_id)} title="Alle Aufnahmen dieser Person ansehen" className="shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-3">
            <UserIcon className="h-4 w-4 text-parchment-dim" />
          </span>
        )}
      </button>
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
