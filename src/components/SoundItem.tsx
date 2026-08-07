import { Bookmark, Download, Heart, ListPlus, Pause, Play, Share2, Trash2, User as UserIcon } from "lucide-react";
import { downloadFile, safeFilename } from "../lib/download";
import { formatTime } from "../lib/format";
import type { Recording } from "../lib/types";
import { usePlayer, type Track } from "../context/PlayerContext";

async function share(r: Recording, url: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title: r.title, url });
      return;
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(url);
  alert("Link kopiert!");
}

export default function SoundItem({
  recording: r,
  url,
  queue,
  avatarUrl,
  posterName,
  onAvatarClick,
  saved,
  onToggleSave,
  liked,
  likeCount,
  onToggleLike,
  onRemove,
  removeTitle,
}: {
  recording: Recording;
  url: string | undefined;
  queue: Recording[];
  avatarUrl?: string | null;
  posterName?: string | null;
  onAvatarClick?: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  liked?: boolean;
  likeCount?: number;
  onToggleLike?: () => void;
  onRemove?: () => void;
  removeTitle?: string;
}) {
  const player = usePlayer();
  const isCurrent = player.current?.id === r.id;
  const toTrack = (rec: Recording): Track => ({ id: rec.id, title: rec.title, tag: rec.tag, url: url ?? "" });

  return (
    <li
      className={`flex items-center gap-2.5 rounded-xl border p-3 transition ${
        isCurrent ? "border-terracotta/50 bg-terracotta/10" : "border-parchment/10 bg-ink-2"
      }`}
    >
      {onAvatarClick && (
        <button onClick={onAvatarClick} title="Profil ansehen" className="shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-3">
              <UserIcon className="h-4 w-4 text-parchment-dim" />
            </span>
          )}
        </button>
      )}
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
        <p className="truncate text-xs text-parchment-dim">
          {r.tag} · {formatTime(r.duration ?? 0)}
          {posterName && <span className="text-parchment-dim/60"> · {posterName}</span>}
        </p>
      </div>
      {onToggleLike && (
        <button onClick={onToggleLike} className={`flex shrink-0 items-center gap-1 ${liked ? "text-red-400" : "text-parchment-dim/70"}`}>
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
          {!!likeCount && <span className="text-[10px]">{likeCount}</span>}
        </button>
      )}
      {onToggleSave && (
        <button
          onClick={onToggleSave}
          className={`shrink-0 ${saved ? "text-gold" : "text-parchment-dim/70"}`}
          title={saved ? "Aus Gespeichert entfernen" : "Speichern"}
        >
          <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
        </button>
      )}
      <button
        onClick={() => url && player.addToQueue(toTrack(r))}
        disabled={!url}
        className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
        title="Zur Warteschlange hinzufügen"
      >
        <ListPlus className="h-4 w-4" />
      </button>
      <button
        onClick={() => url && share(r, url)}
        disabled={!url}
        className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
        title="Teilen"
      >
        <Share2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => url && downloadFile(url, safeFilename(r.title, "webm"))}
        disabled={!url}
        className="shrink-0 text-parchment-dim/70 disabled:opacity-30"
        title="Herunterladen"
      >
        <Download className="h-4 w-4" />
      </button>
      {onRemove && (
        <button onClick={onRemove} className="shrink-0 text-parchment-dim/70 active:text-red-400" title={removeTitle ?? "Entfernen"}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
