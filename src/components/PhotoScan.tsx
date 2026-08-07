import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Camera, Trash2, Volume2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { extractCardsFromImage, isGeminiConfigured, type ExtractedCard } from "../lib/gemini";
import { isTtsSupported, readCard, type ReadOrder } from "../lib/tts";
import type { VocabCard } from "../lib/types";

const ORDER_KEY = "latein-audio:read-order";

export default function PhotoScan({ user }: { user: User }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [drafts, setDrafts] = useState<ExtractedCard[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [order, setOrder] = useState<ReadOrder>(
    () => (localStorage.getItem(ORDER_KEY) as ReadOrder) || "latin-first"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function changeOrder(o: ReadOrder) {
    setOrder(o);
    localStorage.setItem(ORDER_KEY, o);
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    const { data } = await supabase
      .from("vocab_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCards(data as VocabCard[]);
  }

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
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCard(id: string) {
    await supabase.from("vocab_cards").delete().eq("id", id);
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  if (!isGeminiConfigured) {
    return (
      <div className="rounded-2xl border border-dashed border-parchment/15 p-6 text-center text-sm text-parchment-dim">
        Foto-Scan braucht einen kostenlosen Gemini API-Key. Trag{" "}
        <code className="rounded bg-parchment/10 px-1.5 py-0.5">VITE_GEMINI_API_KEY</code> in deiner{" "}
        <code className="rounded bg-parchment/10 px-1.5 py-0.5">.env</code> ein (Details in der README).
      </div>
    );
  }

  return (
    <div className="space-y-5">
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

      {cards.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-parchment/80">Gespeicherte Vokabelkarten</p>
            {isTtsSupported && (
              <div className="flex rounded-lg bg-ink-2 p-0.5 text-xs">
                <button
                  onClick={() => changeOrder("latin-first")}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    order === "latin-first" ? "bg-terracotta text-ink" : "text-parchment-dim"
                  }`}
                >
                  Latein zuerst
                </button>
                <button
                  onClick={() => changeOrder("german-first")}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    order === "german-first" ? "bg-terracotta text-ink" : "text-parchment-dim"
                  }`}
                >
                  Deutsch zuerst
                </button>
              </div>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-parchment/10 bg-ink-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-parchment">{c.latin}</span>
                  <span className="text-parchment-dim"> — {c.german}</span>
                  {c.note && <span className="block truncate text-xs text-parchment-dim/70">{c.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {isTtsSupported && (
                    <button onClick={() => readCard(c, order)} className="text-parchment-dim/80 active:text-gold">
                      <Volume2 className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => removeCard(c.id)} className="text-parchment-dim/60 active:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
