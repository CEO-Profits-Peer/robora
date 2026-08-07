import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { checkAudioSafety, isGeminiConfigured } from "../lib/gemini";
import type { Recording } from "../lib/types";
import RecordingItem from "./RecordingItem";

const FILTERS = ["Alle", "Vokabeln", "Grammatik", "Sonstiges"] as const;

export default function Library({ user, refreshKey }: { user: User; refreshKey: number }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Alle");
  const [loading, setLoading] = useState(true);
  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<{ id: string; reason: string } | null>(null);
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
    </div>
  );
}
