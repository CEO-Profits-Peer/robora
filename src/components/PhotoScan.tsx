import { useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Camera, GraduationCap, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { extractCardsFromImage, isGeminiConfigured, type ExtractedCard } from "../lib/gemini";
import VocabCardList from "./VocabCardList";
import Quiz from "./Quiz";

export default function PhotoScan({ user }: { user: User }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [drafts, setDrafts] = useState<ExtractedCard[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [quizActive, setQuizActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setDrafts([]);
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const results = await extractCardsFromImage(file);
      if (results.length === 0) setError("Es konnten keine Karten erkannt werden. Versuch ein schärferes Foto.");
      setDrafts(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Scannen.");
    } finally {
      setScanning(false);
    }
  }

  function updateDraft(i: number, field: keyof ExtractedCard, value: string) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveAll() {
    if (drafts.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const rows = drafts.map((d) => ({
        user_id: user.id,
        latin: d.latin,
        german: d.german,
        note: d.note || null,
        source: "photo",
      }));
      const { error: dbErr } = await supabase.from("vocab_cards").insert(rows);
      if (dbErr) throw dbErr;
      setDrafts([]);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (quizActive) {
    return <Quiz user={user} onExit={() => setQuizActive(false)} />;
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => setQuizActive(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 active:scale-[0.98]"
      >
        <GraduationCap className="h-4 w-4" />
        Quiz starten
      </button>

      {isGeminiConfigured ? (
        <div className="rounded-2xl border border-parchment/10 bg-ink-2 p-5 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
            id="photo-input"
          />
          {preview ? (
            <img src={preview} alt="Vorschau" className="mx-auto mb-3 max-h-48 rounded-xl object-contain" />
          ) : (
            <Camera className="mx-auto mb-3 h-10 w-10 text-parchment-dim" strokeWidth={1.5} />
          )}
          <label
            htmlFor="photo-input"
            className="inline-block cursor-pointer rounded-xl bg-terracotta px-5 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 active:scale-[0.98]"
          >
            Foto von Vokabeln / Grammatik machen
          </label>
          <p className="mt-2 text-xs text-parchment-dim">
            KI liest Latein-Deutsch-Paare oder Deklinations-/Konjugationstabellen aus.
          </p>
          {scanning && <p className="mt-3 text-sm text-gold">Scanne Foto…</p>}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-6 text-center text-sm text-parchment-dim">
          Foto-Scan braucht einen kostenlosen Gemini API-Key. Trag{" "}
          <code className="rounded bg-parchment/10 px-1.5 py-0.5">VITE_GEMINI_API_KEY</code> in deiner{" "}
          <code className="rounded bg-parchment/10 px-1.5 py-0.5">.env</code> ein (Details in der README).
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-parchment/80">{drafts.length} Karten gefunden — prüfen & speichern:</p>
          {drafts.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-parchment/10 bg-ink-2 p-2">
              <input
                value={d.latin}
                onChange={(e) => updateDraft(i, "latin", e.target.value)}
                className="w-1/2 rounded-lg bg-ink-3 px-2 py-2 text-sm text-parchment outline-none"
                placeholder="Latein"
              />
              <input
                value={d.german}
                onChange={(e) => updateDraft(i, "german", e.target.value)}
                className="w-1/2 rounded-lg bg-ink-3 px-2 py-2 text-sm text-parchment outline-none"
                placeholder="Deutsch"
              />
              <button onClick={() => removeDraft(i)} className="px-2 text-parchment-dim/60 active:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={saveAll}
            disabled={saving}
            className="w-full rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Speichert…" : `${drafts.length} Karten speichern`}
          </button>
        </div>
      )}

      <VocabCardList user={user} refreshKey={refreshKey} />
    </div>
  );
}
