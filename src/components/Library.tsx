import { Fragment, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Download, Globe, ListPlus, Lock, Loader2, Pause, Play, Scissors, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { checkAudioSafety, isGeminiConfigured } from "../lib/gemini";
import { downloadFile, safeFilename } from "../lib/download";
import type { Recording } from "../lib/types";
import { usePlayer, type Track } from "../context/PlayerContext";
import AudioTrimEditor from "./AudioTrimEditor";

const FILTERS = ["Alle", "Vokabeln", "Grammatik", "Sonstiges"] as const;

function formatTime(sec: number) {
  if (!sec || Number.isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function Library({ user, refreshKey }: { user: User; refreshKey: number }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Alle");
  const [loading, setLoading] = useState(true);
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<{ id: string; reason: string } | null>(null);
  const player = usePlayer();

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      setRecordings(data as Recording[]);

      const entries = await Promise.all(
        (data as Recording[]).map(async (r) => {
          const { data: signed } = await supabase.storage
            .from("recordings")
            .createSignedUrl(r.audio_path, 60 * 60 * 6);
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
  }, [user.id, refreshKey, reloadKey]);

  async function remove(r: Recording) {
    if (!confirm(`"${r.title}" wirklich löschen?`)) return;
    await supabase.storage.from("recordings").remove([r.audio_path]);
    await supabase.from("recordings").delete().eq("id", r.id);
    setRecordings((prev) => prev.filter((x) => x.id !== r.id));
  }

  async function togglePublic(r: Recording) {
    setFlagged(null);
    if (r.is_public) {
      await supabase.from("recordings").update({ is_public: false }).eq("id", r.id);
      setRecordings((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_public: false } : x)));
      return;
    }

    if (isGeminiConfigured && urls[r.id]) {
      setCheckingId(r.id);
      const result = await checkAudioSafety(urls[r.id]);
      setCheckingId(null);
      if (!result.safe) {
        setFlagged({ id: r.id, reason: result.reason });
        return;
      }
    }

    await supabase.from("recordings").update({ is_public: true }).eq("id", r.id);
    setRecordings((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_public: true } : x)));
  }

  const filtered = recordings.filter((r) => filter === "Alle" || r.tag === filter);
  const toTrack = (r: Recording): Track => ({ id: r.id, title: r.title, tag: r.tag, url: urls[r.id] });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === f ? "bg-terracotta text-ink" : "bg-ink-2 text-parchment-dim"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center text-sm text-parchment-dim">Lädt…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
          Noch keine Aufnahmen{filter !== "Alle" ? ` in "${filter}"` : ""}. Leg im Tab "Aufnehmen" los.
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => {
          const isCurrent = player.current?.id === r.id;
          return (
            <Fragment key={r.id}>
              <li
                className={`space-y-2 rounded-xl border p-3 transition ${
                  isCurrent ? "border-terracotta/50 bg-terracotta/10" : "border-parchment/10 bg-ink-2"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => player.play(toTrack(r), filtered.map(toTrack))}
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
                </div>

                {flagged?.id === r.id && (
                  <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
                    Nicht veröffentlicht: {flagged.reason}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 text-parchment-dim/70">
                  <button
                    onClick={() => urls[r.id] && player.addToQueue(toTrack(r))}
                    disabled={!urls[r.id]}
                    className="disabled:opacity-30"
                    title="Zur Warteschlange hinzufügen"
                  >
                    <ListPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => togglePublic(r)}
                    disabled={checkingId === r.id}
                    className={`flex items-center gap-1 text-xs ${r.is_public ? "text-gold" : ""}`}
                    title={r.is_public ? "Öffentlich – für alle sichtbar" : "Privat – nur für dich"}
                  >
                    {checkingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : r.is_public ? (
                      <Globe className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    {checkingId === r.id ? "Prüfe…" : r.is_public ? "Öffentlich" : "Privat"}
                  </button>
                  <button
                    onClick={() => urls[r.id] && downloadFile(urls[r.id], safeFilename(r.title, "webm"))}
                    disabled={!urls[r.id]}
                    className="disabled:opacity-30"
                    title="Herunterladen"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setTrimmingId(trimmingId === r.id ? null : r.id)}
                    disabled={!urls[r.id]}
                    className="active:text-gold disabled:opacity-30"
                    title="Schneiden"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(r)} className="active:text-red-400" title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
              {trimmingId === r.id && urls[r.id] && (
                <li className="col-span-full">
                  <AudioTrimEditor
                    recording={r}
                    url={urls[r.id]}
                    onCancel={() => setTrimmingId(null)}
                    onSaved={() => {
                      setTrimmingId(null);
                      setReloadKey((k) => k + 1);
                    }}
                  />
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
