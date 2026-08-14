import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Plus, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Group } from "../lib/types";
import GroupDetail from "./GroupDetail";

export default function Groups({
  user,
  openGroupId,
  onOpened,
}: {
  user: User;
  openGroupId?: string | null;
  onOpened?: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (openGroupId) {
      setViewingGroupId(openGroupId);
      onOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroupId]);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("group_members")
      .select("groups(*)")
      .eq("user_id", user.id)
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message);
          setLoading(false);
          return;
        }
        setError("");
        const list = ((data ?? []) as unknown as { groups: Group | null }[])
          .map((row) => row.groups)
          .filter((g): g is Group => Boolean(g));
        setGroups(list);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, refreshKey]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { data, error: insErr } = await supabase
        .from("groups")
        .insert({ name: newName.trim(), created_by: user.id })
        .select()
        .single();
      if (insErr) throw insErr;
      await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id });
      setNewName("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gruppe konnte nicht erstellt werden.");
    } finally {
      setCreating(false);
    }
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setError("");
    try {
      const { data: group, error: findErr } = await supabase
        .from("groups")
        .select("id")
        .eq("invite_code", joinCode.trim().toLowerCase())
        .maybeSingle();
      if (findErr) throw findErr;
      if (!group) {
        setError("Kein Gruppe mit diesem Code gefunden.");
        return;
      }
      await supabase.from("group_members").upsert({ group_id: group.id, user_id: user.id });
      setJoinCode("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beitreten fehlgeschlagen.");
    } finally {
      setJoining(false);
    }
  }

  if (viewingGroupId) {
    return (
      <GroupDetail
        groupId={viewingGroupId}
        user={user}
        onBack={() => setViewingGroupId(null)}
        onLeft={() => {
          setViewingGroupId(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <form onSubmit={createGroup} className="space-y-2 rounded-xl border border-parchment/10 bg-ink-2 p-4">
          <p className="text-sm font-medium text-parchment/80">Neue Gruppe</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Gruppenname"
            className="w-full rounded-lg border border-parchment/10 bg-ink-3 px-3 py-2 text-sm text-parchment outline-none focus:border-terracotta"
          />
          <button
            type="submit"
            disabled={creating}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Erstellen
          </button>
        </form>

        <form onSubmit={joinGroup} className="space-y-2 rounded-xl border border-parchment/10 bg-ink-2 p-4">
          <p className="text-sm font-medium text-parchment/80">Gruppe beitreten</p>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Einladungscode"
            className="w-full rounded-lg border border-parchment/10 bg-ink-3 px-3 py-2 text-sm text-parchment outline-none focus:border-terracotta"
          />
          <button
            type="submit"
            disabled={joining}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-parchment/15 px-3 py-2 text-sm text-parchment-dim disabled:opacity-50"
          >
            <Users className="h-4 w-4" /> Beitreten
          </button>
        </form>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading && <p className="py-8 text-center text-sm text-parchment-dim">Lädt…</p>}

      {!loading && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
          Noch in keiner Gruppe. Erstelle eine oder tritt mit einem Code bei.
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id}>
            <button
              onClick={() => setViewingGroupId(g.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-parchment/10 bg-ink-2 p-4 text-left active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-3">
                <Users className="h-4 w-4 text-parchment-dim" />
              </span>
              <span className="min-w-0">
                <p className="truncate text-sm font-medium text-parchment">{g.name}</p>
                <p className="text-xs text-parchment-dim">Code: {g.invite_code}</p>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
