import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, LogOut, User as UserIcon, Volume2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { isTtsSupported, readCard } from "../lib/tts";
import type { Group, Profile, Recording, VocabCard } from "../lib/types";
import SoundItem from "./SoundItem";

export default function GroupDetail({
  groupId,
  user,
  onBack,
  onLeft,
}: {
  groupId: string;
  user: User;
  onBack: () => void;
  onLeft: () => void;
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [sharedRecordings, setSharedRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [sharedCards, setSharedCards] = useState<VocabCard[]>([]);
  const [myRecordings, setMyRecordings] = useState<Recording[]>([]);
  const [myCards, setMyCards] = useState<VocabCard[]>([]);
  const [pickedRecording, setPickedRecording] = useState("");
  const [pickedCard, setPickedCard] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: g }, { data: memberRows }, { data: sharedRecRows }, { data: sharedCardRows }, { data: ownRecs }, { data: ownCards }] =
        await Promise.all([
          supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
          supabase.from("group_members").select("profiles(id, avatar_url, display_name)").eq("group_id", groupId),
          supabase.from("group_shared_recordings").select("recordings(*)").eq("group_id", groupId),
          supabase.from("group_shared_cards").select("vocab_cards(*)").eq("group_id", groupId),
          supabase.from("recordings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("vocab_cards").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        ]);
      if (cancelled) return;

      setGroup(g as Group);
      setMembers(((memberRows ?? []) as unknown as { profiles: Profile | null }[]).map((r) => r.profiles).filter((p): p is Profile => Boolean(p)));
      const recs = ((sharedRecRows ?? []) as unknown as { recordings: Recording | null }[]).map((r) => r.recordings).filter((r): r is Recording => Boolean(r));
      setSharedRecordings(recs);
      setSharedCards(((sharedCardRows ?? []) as unknown as { vocab_cards: VocabCard | null }[]).map((r) => r.vocab_cards).filter((c): c is VocabCard => Boolean(c)));
      setMyRecordings((ownRecs as Recording[]) ?? []);
      setMyCards((ownCards as VocabCard[]) ?? []);

      const entries = await Promise.all(
        recs.map(async (r) => {
          const { data: signed } = await supabase.storage.from("recordings").createSignedUrl(r.audio_path, 60 * 60 * 6);
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
  }, [groupId, user.id, refreshKey]);

  async function shareRecording() {
    if (!pickedRecording) return;
    await supabase.from("group_shared_recordings").insert({ group_id: groupId, recording_id: pickedRecording, shared_by: user.id });
    setPickedRecording("");
    setRefreshKey((k) => k + 1);
  }

  async function shareCard() {
    if (!pickedCard) return;
    await supabase.from("group_shared_cards").insert({ group_id: groupId, vocab_card_id: pickedCard, shared_by: user.id });
    setPickedCard("");
    setRefreshKey((k) => k + 1);
  }

  async function unshareRecording(recordingId: string) {
    await supabase.from("group_shared_recordings").delete().eq("group_id", groupId).eq("recording_id", recordingId);
    setRefreshKey((k) => k + 1);
  }

  async function leaveGroup() {
    if (!confirm("Diese Gruppe wirklich verlassen?")) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    onLeft();
  }

  if (loading) return <p className="py-12 text-center text-sm text-parchment-dim">Lädt…</p>;
  if (!group) return null;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-parchment-dim active:text-parchment">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </button>

      <div className="rounded-2xl border border-parchment/10 bg-ink-2 p-5 text-center">
        <p className="font-display text-xl font-semibold text-parchment">{group.name}</p>
        <p className="mt-1 text-xs text-parchment-dim">
          Einladungscode: <span className="font-mono text-gold">{group.invite_code}</span>
        </p>
        <div className="mt-3 flex justify-center -space-x-2">
          {members.map((m) => (
            <span key={m.id} title={m.display_name ?? undefined}>
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full border-2 border-ink-2 object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-2 bg-ink-3">
                  <UserIcon className="h-3.5 w-3.5 text-parchment-dim" />
                </span>
              )}
            </span>
          ))}
        </div>
        <button
          onClick={leaveGroup}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-parchment-dim/70 active:text-red-400"
        >
          <LogOut className="h-3.5 w-3.5" /> Gruppe verlassen
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-parchment/10 bg-ink-2 p-4">
          <p className="text-sm font-medium text-parchment/80">Aufnahme teilen</p>
          <select
            value={pickedRecording}
            onChange={(e) => setPickedRecording(e.target.value)}
            className="w-full rounded-lg border border-parchment/10 bg-ink-3 px-3 py-2 text-sm text-parchment outline-none"
          >
            <option value="">Auswählen…</option>
            {myRecordings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <button
            onClick={shareRecording}
            disabled={!pickedRecording}
            className="w-full rounded-lg bg-terracotta px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Teilen
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-parchment/10 bg-ink-2 p-4">
          <p className="text-sm font-medium text-parchment/80">Vokabelkarte teilen</p>
          <select
            value={pickedCard}
            onChange={(e) => setPickedCard(e.target.value)}
            className="w-full rounded-lg border border-parchment/10 bg-ink-3 px-3 py-2 text-sm text-parchment outline-none"
          >
            <option value="">Auswählen…</option>
            {myCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.latin} — {c.german}
              </option>
            ))}
          </select>
          <button
            onClick={shareCard}
            disabled={!pickedCard}
            className="w-full rounded-lg bg-terracotta px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Teilen
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-parchment/80">Geteilte Aufnahmen</p>
        {sharedRecordings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-parchment/15 p-4 text-center text-xs text-parchment-dim">
            Noch nichts geteilt.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {sharedRecordings.map((r) => (
              <SoundItem
                key={r.id}
                recording={r}
                url={urls[r.id]}
                queue={sharedRecordings}
                onRemove={r.user_id === user.id ? () => unshareRecording(r.id) : undefined}
                removeTitle="Freigabe entfernen"
              />
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-parchment/80">Geteilte Vokabelkarten</p>
        {sharedCards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-parchment/15 p-4 text-center text-xs text-parchment-dim">
            Noch nichts geteilt.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {sharedCards.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-parchment/10 bg-ink-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-parchment">{c.latin}</span>
                  <span className="text-parchment-dim"> — {c.german}</span>
                </span>
                {isTtsSupported && (
                  <button onClick={() => readCard(c, "latin-first")} className="shrink-0 text-parchment-dim/70 active:text-gold">
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
