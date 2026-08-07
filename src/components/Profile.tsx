import { useEffect, useState } from "react";
import { ArrowLeft, User as UserIcon, UserMinus, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useSavedRecordings } from "../hooks/useSavedRecordings";
import { useFollows } from "../hooks/useFollows";
import { useLikes } from "../hooks/useLikes";
import type { Recording } from "../lib/types";
import SoundItem from "./SoundItem";

export default function Profile({
  userId,
  currentUserId,
  onBack,
  showHeader = true,
}: {
  userId: string;
  currentUserId?: string;
  onBack?: () => void;
  showHeader?: boolean;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { savedIds, toggleSave } = useSavedRecordings(currentUserId ?? "");
  const { followingIds, toggleFollow } = useFollows(currentUserId ?? "");
  const { likedIds, counts: likeCounts, toggleLike } = useLikes(
    currentUserId ?? "",
    recordings.map((r) => r.id)
  );
  const isOwnProfile = currentUserId === userId;
  const isFollowing = followingIds.has(userId);

  function handleToggleFollow() {
    setFollowerCount((c) => c + (isFollowing ? -1 : 1));
    toggleFollow(userId);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: profile }, { data: recs }, { count: followers }] = await Promise.all([
        supabase.from("profiles").select("avatar_url, display_name").eq("id", userId).maybeSingle(),
        supabase
          .from("recordings")
          .select("*")
          .eq("user_id", userId)
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", userId),
      ]);
      if (cancelled) return;
      setAvatarUrl(profile?.avatar_url ?? null);
      setDisplayName(profile?.display_name ?? null);
      setFollowerCount(followers ?? 0);
      const list = (recs as Recording[]) ?? [];
      setRecordings(list);

      const entries = await Promise.all(
        list.map(async (r) => {
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
  }, [userId]);

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-parchment-dim active:text-parchment">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
      )}

      {showHeader && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full border border-terracotta/25 object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-terracotta/25 bg-ink-3">
              <UserIcon className="h-8 w-8 text-parchment-dim" strokeWidth={1.5} />
            </div>
          )}
          {displayName ? (
            <p className="font-display text-lg font-semibold text-parchment">{displayName}</p>
          ) : (
            <p className="text-sm text-parchment-dim/60">Ohne Namen</p>
          )}
          <div className="flex items-center gap-3 text-sm text-parchment-dim">
            <span>{loading ? "Lädt…" : `${recordings.length} Aufnahme${recordings.length === 1 ? "" : "n"}`}</span>
            <span className="text-parchment-dim/40">·</span>
            <span>{followerCount} Follower</span>
          </div>
          {currentUserId && !isOwnProfile && (
            <button
              onClick={handleToggleFollow}
              className={`mt-1 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${
                isFollowing ? "border border-parchment/15 text-parchment-dim" : "bg-terracotta text-ink font-semibold"
              }`}
            >
              {isFollowing ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isFollowing ? "Entfolgen" : "Folgen"}
            </button>
          )}
        </div>
      )}

      {!loading && recordings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-parchment/15 p-8 text-center text-sm text-parchment-dim">
          Noch keine öffentlichen Aufnahmen.
        </div>
      )}

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {recordings.map((r) => (
          <SoundItem
            key={r.id}
            recording={r}
            url={urls[r.id]}
            queue={recordings}
            saved={currentUserId ? savedIds.has(r.id) : undefined}
            onToggleSave={currentUserId ? () => toggleSave(r.id) : undefined}
            liked={currentUserId ? likedIds.has(r.id) : undefined}
            likeCount={likeCounts[r.id]}
            onToggleLike={currentUserId ? () => toggleLike(r.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
