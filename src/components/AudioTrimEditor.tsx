import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "../lib/supabase";
import { audioBufferToWav, decodeAudio, trimBuffer } from "../lib/audioTrim";
import type { Recording } from "../lib/types";

function fmt(sec: number) {
  if (!Number.isFinite(sec)) return "0.0";
  return sec.toFixed(1);
}

export default function AudioTrimEditor({
  recording,
  url,
  onSaved,
  onCancel,
}: {
  recording: Recording;
  url: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [saving, setSaving] = useState(false);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    decodeAudio(url)
      .then((buf) => {
        if (cancelled) return;
        bufferRef.current = buf;
        setDuration(buf.duration);
        setEnd(buf.duration);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Audio konnte nicht geladen werden.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function preview() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = start;
    audio.play();
    const stopAt = () => {
      if (audio.currentTime >= end) {
        audio.pause();
        audio.removeEventListener("timeupdate", stopAt);
      }
    };
    audio.addEventListener("timeupdate", stopAt);
  }

  async function saveTrim() {
    if (!bufferRef.current || end <= start) return;
    setSaving(true);
    setError("");
    try {
      const trimmed = trimBuffer(bufferRef.current, start, end);
      const wav = audioBufferToWav(trimmed);
      const newPath = `${recording.user_id}/${Date.now()}-trim.wav`;

      const { error: upErr } = await supabase.storage.from("recordings").upload(newPath, wav, {
        contentType: "audio/wav",
      });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("recordings")
        .update({ audio_path: newPath, duration: end - start })
        .eq("id", recording.id);
      if (dbErr) throw dbErr;

      await supabase.storage.from("recordings").remove([recording.audio_path]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuschneiden fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="col-span-full space-y-3 rounded-xl border border-terracotta/30 bg-ink-3 p-4">
      <audio ref={audioRef} src={url} className="hidden" />
      {loading && <p className="text-sm text-parchment-dim">Lädt Audio…</p>}
      {!loading && !error && (
        <>
          <div className="flex items-center justify-between text-xs text-parchment-dim">
            <span>
              Start: {fmt(start)}s — Ende: {fmt(end)}s (Länge: {fmt(end - start)}s)
            </span>
            <button onClick={preview} className="flex items-center gap-1 text-gold">
              <Play className="h-3.5 w-3.5" fill="currentColor" /> Vorschau
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={start}
              onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.1))}
              className="w-full accent-terracotta"
            />
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={end}
              onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.1))}
              className="w-full accent-terracotta"
            />
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg border border-parchment/10 py-2 text-sm text-parchment-dim">
          Abbrechen
        </button>
        <button
          onClick={saveTrim}
          disabled={loading || saving || !!error}
          className="flex-1 rounded-lg bg-terracotta py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Zuschneiden & speichern"}
        </button>
      </div>
    </div>
  );
}
