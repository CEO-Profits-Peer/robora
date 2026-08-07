import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useSavedRecordings(userId: string) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("saved_recordings")
      .select("recording_id")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        setSavedIds(new Set((data ?? []).map((r) => r.recording_id)));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleSave = useCallback(
    async (recordingId: string) => {
      const isSaved = savedIds.has(recordingId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(recordingId);
        else next.add(recordingId);
        return next;
      });
      if (isSaved) {
        await supabase.from("saved_recordings").delete().eq("user_id", userId).eq("recording_id", recordingId);
      } else {
        await supabase.from("saved_recordings").insert({ user_id: userId, recording_id: recordingId });
      }
    },
    [savedIds, userId]
  );

  return { savedIds, toggleSave, loading };
}
