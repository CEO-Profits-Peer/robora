import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

const TAGS = ["Vokabeln", "Grammatik", "Sonstiges"] as const;

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function readDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      URL.revokeObjectURL(url);
    });
    audio.addEventListener("error", () => {
      resolve(0);
      URL.revokeObjectURL(url);
    });
  });
}

export default function Recorder({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<(typeof TAGS)[number]>("Vokabeln");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrl = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(b);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Mikrofon-Zugriff wurde verweigert oder ist nicht verfügbar.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const dur = await readDuration(file);
    setSeconds(Math.round(dur));
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    setBlob(file);
  }

  function discard() {
    setBlob(null);
    setTitle("");
    setSeconds(0);
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    if (!blob) return;
    setSaving(true);
    setError("");
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : "webm";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("recordings").upload(path, blob, {
        contentType: blob.type || "audio/webm",
      });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("recordings").insert({
        user_id: user.id,
        title: title.trim() || "Ohne Titel",
        tag,
        audio_path: path,
        duration: seconds,
      });
      if (dbErr) throw dbErr;

      discard();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (blob) {
    if (!audioUrl.current) audioUrl.current = URL.createObjectURL(blob);
    return (
      <div className="space-y-4 rounded-2xl border border-parchment/10 bg-ink-2 p-5">
        <audio controls src={audioUrl.current} className="w-full" />
        <input
          type="text"
          placeholder="Titel (z.B. 'a-Deklination' oder 'Vokabeln Lektion 5')"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-parchment/10 bg-ink-3 px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchment-dim/50 focus:border-terracotta"
        />
        <div className="flex gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tag === t ? "bg-terracotta text-ink" : "bg-ink-3 text-parchment-dim"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={discard}
            className="flex-1 rounded-xl border border-parchment/10 px-4 py-3 text-sm text-parchment-dim active:scale-[0.98]"
          >
            Verwerfen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-parchment/10 bg-ink-2 p-8">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`relative flex h-28 w-28 items-center justify-center rounded-full shadow-xl transition active:scale-95 ${
          recording ? "bg-red-600 shadow-red-900/50" : "bg-terracotta shadow-black/40"
        }`}
      >
        {recording ? (
          <Square className="h-9 w-9 text-white" fill="currentColor" />
        ) : (
          <Mic className="h-10 w-10 text-ink" strokeWidth={1.75} />
        )}
        {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-600/40" />}
      </button>
      <div className="font-display text-2xl tabular-nums text-parchment">{formatTime(seconds)}</div>
      <p className="text-center text-sm text-parchment-dim">
        {recording ? "Aufnahme läuft… tippe zum Stoppen." : "Tippe, um eine Vokabel- oder Grammatik-Aufnahme zu starten."}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {!recording && (
        <>
          <div className="flex w-full items-center gap-3 text-xs text-parchment-dim/50">
            <div className="h-px flex-1 bg-parchment/10" />
            oder
            <div className="h-px flex-1 bg-parchment/10" />
          </div>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={onFileChosen} className="hidden" id="audio-upload" />
          <label
            htmlFor="audio-upload"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-parchment/10 px-4 py-2.5 text-sm text-parchment-dim active:scale-[0.98]"
          >
            <Upload className="h-4 w-4" />
            Audiodatei hochladen
          </label>
        </>
      )}
    </div>
  );
}
