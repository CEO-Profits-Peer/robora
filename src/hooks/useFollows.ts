import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useFollows(currentUserId: string) {
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", currentUserId)
      .then(({ data }) => {
        if (cancelled) return;
        setFollowingIds(new Set((data ?? []).map((r) => r.followed_id)));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const toggleFollow = useCallback(
    async (followedId: string) => {
      const isFollowing = followingIds.has(followedId);
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(followedId);
        else next.add(followedId);
        return next;
      });
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("followed_id", followedId);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, followed_id: followedId });
      }
    },
    [followingIds, currentUserId]
  );

  return { followingIds, toggleFollow, loading };
}
