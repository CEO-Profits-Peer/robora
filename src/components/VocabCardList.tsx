import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Trash2, Volume2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { isTtsSupported, readCard, type ReadOrder } from "../lib/tts";
import type { VocabCard } from "../lib/types";

const ORDER_KEY = "latein-audio:read-order";

export default function VocabCardList({ user, refreshKey }: { user: User; refreshKey: number }) {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [order, setOrder] = useState<ReadOrder>(() => (localStorage.getItem(ORDER_KEY) as ReadOrder) || "latin-first");

  function changeOrder(o: ReadOrder) {
    setOrder(o);
    localStorage.setItem(ORDER_KEY, o);
  }

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("vocab_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) setCards(data as VocabCard[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, refreshKey]);

  async function removeCard(id: string) {
    await supabase.from("vocab_cards").delete().eq("id", id);
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  if (cards.length === 0) return null;

  return (
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
  );
}
