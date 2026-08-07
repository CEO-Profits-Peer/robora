import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useLikes(userId: string, recordingIds: string[]) {
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  const idsKey = recordingIds.join(",");

  useEffect(() => {
    if (!userId || recordingIds.length === 0) {
      setCounts({});
      return;
    }
    let cancelled = false;
    supabase
      .from("likes")
      .select("user_id, recording_id")
      .in("recording_id", recordingIds)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data ?? [];
        setLikedIds(new Set(rows.filter((r) => r.user_id === userId).map((r) => r.recording_id)));
        const nextCounts: Record<string, number> = {};
        for (const row of rows) nextCounts[row.recording_id] = (nextCounts[row.recording_id] ?? 0) + 1;
        setCounts(nextCounts);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, idsKey]);

  const toggleLike = useCallback(
    async (recordingId: string) => {
      const isLiked = likedIds.has(recordingId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(recordingId);
        else next.add(recordingId);
        return next;
      });
      setCounts((prev) => ({ ...prev, [recordingId]: Math.max(0, (prev[recordingId] ?? 0) + (isLiked ? -1 : 1)) }));

      if (isLiked) {
        await supabase.from("likes").delete().eq("user_id", userId).eq("recording_id", recordingId);
      } else {
        await supabase.from("likes").insert({ user_id: userId, recording_id: recordingId });
      }
    },
    [likedIds, userId]
  );

  return { likedIds, counts, toggleLike };
}
