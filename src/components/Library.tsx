import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { checkAudioSafety, isGeminiConfigured } from "../lib/gemini";
import { useSavedRecordings } from "../hooks/useSavedRecordings";
import type { Recording } from "../lib/types";
import RecordingItem from "./RecordingItem";
import SoundItem from "./SoundItem";

const FILTERS = ["Alle", "Vokabeln", "Grammatik", "Sonstiges", "Gespeichert"] as const;

export default function Library({ user, refreshKey }: { user: User; refreshKey: number }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Alle");
  const [loading, setLoading] = useState(true);
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<{ id: string; reason: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState("");

  const { savedIds, toggleSave } = useSavedRecordings(user.id);
  const [savedRecordings, setSavedRecordings] = useState<Recording[]>([]);
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  const [savedLoading, setSavedLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

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

  useEffect(() => {
    if (filter !== "Gespeichert") return;
    let cancelled = false;
    async function loadSaved() {
      setSavedLoading(true);
      const { data } = await supabase
        .from("saved_recordings")
        .select("recording_id, recordings(*)")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false });

      if (cancelled) return;
      const list = ((data ?? []) as unknown as { recordings: Recording | null }[])
        .map((row) => row.recordings)
        .filter((r): r is Recording => Boolean(r));
      setSavedRecordings(list);

      const entries = await Promise.all(
        list.map(async (r) => {
          const { data: signed } = await supabase.storage
            .from("recordings")
            .createSignedUrl(r.audio_path, 60 * 60 * 6);
          return [r.id, signed?.signedUrl ?? ""] as const;
        })
      );
      if (!cancelled) {
        setSavedUrls(Object.fromEntries(entries));
        setSavedLoading(false);
      }
    }
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, [filter, user.id, savedIds.size]);

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

      {filter === "Gespeichert" ? (
        <>
          {savedLoading && <p className="py-8 text-center text-sm text-parchment-dim">Lädt…</p>}
          {!savedLoading && savedRecordings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
              Noch nichts gespeichert. Im Tab "Entdecken" auf das Lesezeichen-Symbol tippen.
            </div>
          )}
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {savedRecordings.map((r) => (
              <SoundItem
                key={r.id}
                recording={r}
                url={savedUrls[r.id]}
                queue={savedRecordings}
                saved
                onToggleSave={() => toggleSave(r.id)}
              />
            ))}
          </ul>
        </>
      ) : (
        <>
          {loading && <p className="py-8 text-center text-sm text-parchment-dim">Lädt…</p>}
          {!loading && loadError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
              Fehler beim Laden deiner Aufnahmen: {loadError}
              <br />
              <span className="text-xs text-red-400/70">Das ist wahrscheinlich kein Datenverlust — bitte melde diesen Fehler.</span>
            </div>
          )}
          {!loading && !loadError && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
              Noch keine Aufnahmen{filter !== "Alle" ? ` in "${filter}"` : ""}. Leg im Tab "Aufnehmen" los.
            </div>
          )}
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <RecordingItem
                key={r.id}
                recording={r}
                url={urls[r.id]}
                queue={filtered}
                checking={checkingId === r.id}
                flaggedReason={flagged?.id === r.id ? flagged.reason : undefined}
                trimming={trimmingId === r.id}
                onTogglePublic={togglePublic}
                onToggleTrim={setTrimmingId}
                onTrimSaved={() => {
                  setTrimmingId(null);
                  setReloadKey((k) => k + 1);
                }}
                onRemove={remove}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
