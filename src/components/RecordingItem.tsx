import { Fragment } from "react";
import { Download, Globe, ListPlus, Lock, Loader2, Pause, Play, Scissors, Trash2 } from "lucide-react";
import { downloadFile, safeFilename } from "../lib/download";
import { formatTime } from "../lib/format";
import type { Recording } from "../lib/types";
import { usePlayer, type Track } from "../context/PlayerContext";
import AudioTrimEditor from "./AudioTrimEditor";

export default function RecordingItem({
  recording: r,
  url,
  queue,
  checking,
  flaggedReason,
  trimming,
  onTogglePublic,
  onToggleTrim,
  onTrimSaved,
  onRemove,
}: {
  recording: Recording;
  url: string | undefined;
  queue: Recording[];
  checking: boolean;
  flaggedReason?: string;
  trimming: boolean;
  onTogglePublic: (r: Recording) => void;
  onToggleTrim: (id: string | null) => void;
  onTrimSaved: () => void;
  onRemove: (r: Recording) => void;
}) {
  const player = usePlayer();
  const isCurrent = player.current?.id === r.id;
  const toTrack = (rec: Recording): Track => ({ id: rec.id, title: rec.title, tag: rec.tag, url: url ?? "" });

  return (
    <Fragment>
      <li
        className={`space-y-2 rounded-xl border p-3 transition ${
          isCurrent ? "border-terracotta/50 bg-terracotta/10" : "border-parchment/10 bg-ink-2"
        }`}
      >
        <div className="flex items-center gap-3">
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
        </div>

        {flaggedReason && (
          <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400">Nicht veröffentlicht: {flaggedReason}</p>
        )}

        <div className="flex items-center justify-end gap-3 text-parchment-dim/70">
          <button
            onClick={() => url && player.addToQueue(toTrack(r))}
            disabled={!url}
            className="disabled:opacity-30"
            title="Zur Warteschlange hinzufügen"
          >
            <ListPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onTogglePublic(r)}
            disabled={checking}
            className={`flex items-center gap-1 text-xs ${r.is_public ? "text-gold" : ""}`}
            title={r.is_public ? "Öffentlich – für alle sichtbar" : "Privat – nur für dich"}
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : r.is_public ? (
              <Globe className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {checking ? "Prüfe…" : r.is_public ? "Öffentlich" : "Privat"}
          </button>
          <button
            onClick={() => url && downloadFile(url, safeFilename(r.title, "webm"))}
            disabled={!url}
            className="disabled:opacity-30"
            title="Herunterladen"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToggleTrim(trimming ? null : r.id)}
            disabled={!url}
            className="active:text-gold disabled:opacity-30"
            title="Schneiden"
          >
            <Scissors className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onRemove(r)} className="active:text-red-400" title="Löschen">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
      {trimming && url && (
        <li className="col-span-full">
          <AudioTrimEditor recording={r} url={url} onCancel={() => onToggleTrim(null)} onSaved={onTrimSaved} />
        </li>
      )}
    </Fragment>
  );
}
