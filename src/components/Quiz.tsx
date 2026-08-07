import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Check, PartyPopper, RotateCcw, Volume2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { nextReview } from "../lib/spacedRepetition";
import { isTtsSupported, readCard } from "../lib/tts";
import type { VocabCard } from "../lib/types";

export default function Quiz({ user, onExit }: { user: User; onExit: () => void }) {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);

  useEffect(() => {
    supabase
      .from("vocab_cards")
      .select("*")
      .eq("user_id", user.id)
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(20)
      .then(({ data }) => {
        setCards((data as VocabCard[]) ?? []);
        setLoading(false);
      });
  }, [user.id]);

  const current = cards[index];

  async function grade(correct: boolean) {
    if (!current) return;
    const update = nextReview(current, correct);
    await supabase
      .from("vocab_cards")
      .update({ ...update, last_reviewed_at: new Date().toISOString() })
      .eq("id", current.id);

    setAnswered((a) => a + 1);
    if (correct) setCorrectCount((c) => c + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-parchment-dim">Lädt…</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onExit} className="flex items-center gap-1 text-sm text-parchment-dim active:text-parchment">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-parchment/15 p-10 text-center">
          <PartyPopper className="h-8 w-8 text-gold" strokeWidth={1.5} />
          <p className="text-sm text-parchment-dim">Keine fälligen Karten. Alles gelernt — komm später wieder!</p>
        </div>
      </div>
    );
  }

  if (index >= cards.length) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-terracotta/25 bg-ink-2 p-10 text-center">
          <PartyPopper className="h-8 w-8 text-gold" strokeWidth={1.5} />
          <p className="font-display text-xl text-parchment">
            {correctCount} / {answered} richtig
          </p>
          <p className="text-sm text-parchment-dim">Session beendet.</p>
          <button
            onClick={onExit}
            className="mt-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-black/30"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1 text-sm text-parchment-dim active:text-parchment">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
        <p className="text-xs text-parchment-dim">
          {index + 1} / {cards.length}
        </p>
      </div>

      <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-parchment/10 bg-ink-2 p-8 text-center">
        <p className="font-display text-2xl text-parchment">{current.latin}</p>
        {current.note && <p className="text-xs text-parchment-dim">{current.note}</p>}

        {revealed ? (
          <p className="text-lg text-gold">{current.german}</p>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="rounded-xl border border-parchment/15 px-4 py-2 text-sm text-parchment-dim active:scale-[0.98]"
          >
            Antwort zeigen
          </button>
        )}

        {isTtsSupported && (
          <button
            onClick={() => readCard(current, "latin-first")}
            className="flex items-center gap-1 text-xs text-parchment-dim/70 active:text-gold"
          >
            <Volume2 className="h-3.5 w-3.5" /> Vorlesen
          </button>
        )}
      </div>

      {revealed && (
        <div className="flex gap-2">
          <button
            onClick={() => grade(false)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 active:scale-[0.98]"
          >
            <X className="h-4 w-4" /> Nochmal
          </button>
          <button
            onClick={() => grade(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-ink shadow-lg shadow-black/30 active:scale-[0.98]"
          >
            <Check className="h-4 w-4" /> Kann ich
          </button>
        </div>
      )}

      <p className="flex items-center justify-center gap-1 text-xs text-parchment-dim/60">
        <RotateCcw className="h-3 w-3" /> Wiederholungen passen sich automatisch an dein Ergebnis an.
      </p>
    </div>
  );
}
