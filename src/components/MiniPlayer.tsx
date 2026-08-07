import { useState } from "react";
import { ListMusic, Pause, Play, Repeat, SkipBack, SkipForward, X } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";

function formatTime(sec: number) {
  if (!sec || Number.isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function MiniPlayer() {
  const { current, isPlaying, progress, duration, loop, toggleLoop, upNext, removeFromQueue, toggle, seek, next, prev } =
    usePlayer();
  const [showQueue, setShowQueue] = useState(false);
  if (!current) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 px-3 md:bottom-4 md:left-64 md:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-parchment/10 bg-ink-2/95 p-3 shadow-2xl backdrop-blur md:max-w-2xl xl:max-w-3xl">
        {showQueue && (
          <div className="mb-3 max-h-40 space-y-1 overflow-y-auto border-b border-parchment/10 pb-3">
            {upNext.length === 0 ? (
              <p className="py-2 text-center text-xs text-parchment-dim">Warteschlange ist leer.</p>
            ) : (
              upNext.map((t, i) => (
                <div key={`${t.id}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-ink-3 px-2 py-1.5 text-xs">
                  <span className="truncate text-parchment">
                    {i + 1}. {t.title}
                  </span>
                  <button onClick={() => removeFromQueue(i)} className="shrink-0 text-parchment-dim/60 active:text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-2 text-parchment-dim active:text-parchment">
            <SkipBack className="h-4 w-4" fill="currentColor" />
          </button>
          <button
            onClick={toggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta text-ink shadow-lg"
          >
            {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
          </button>
          <button onClick={next} className="p-2 text-parchment-dim active:text-parchment">
            <SkipForward className="h-4 w-4" fill="currentColor" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-parchment">{current.title}</p>
            <p className="text-xs text-parchment-dim">
              {formatTime(progress)} / {formatTime(duration)}
            </p>
          </div>
          <button
            onClick={() => setShowQueue((v) => !v)}
            title="Warteschlange"
            className={`relative shrink-0 rounded-lg p-2 ${showQueue ? "bg-terracotta/20 text-gold" : "text-parchment-dim/60"}`}
          >
            <ListMusic className="h-4 w-4" />
            {upNext.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-[9px] font-bold text-ink">
                {upNext.length}
              </span>
            )}
          </button>
          <button
            onClick={toggleLoop}
            title="Wiederholen"
            className={`shrink-0 rounded-lg p-2 ${loop ? "bg-terracotta/20 text-gold" : "text-parchment-dim/60"}`}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          className="mt-2 w-full accent-terracotta"
        />
      </div>
    </div>
  );
}
