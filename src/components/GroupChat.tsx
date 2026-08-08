import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Image as ImageIcon, Send, Trash2, User as UserIcon, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { GroupMessage, Profile } from "../lib/types";

export default function GroupChat({
  groupId,
  user,
  members,
}: {
  groupId: string;
  user: User;
  members: Profile[];
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileById = Object.fromEntries(members.map((m) => [m.id, m]));

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) setError(fetchErr.message);
        else setMessages((data as GroupMessage[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const msg = payload.new as GroupMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const oldMsg = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const missing = messages.filter((m) => m.image_path && !imageUrls[m.image_path]).map((m) => m.image_path as string);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (path) => {
        const { data } = await supabase.storage.from("group-chat").createSignedUrl(path, 60 * 60 * 6);
        return [path, data?.signedUrl ?? ""] as const;
      })
    ).then((entries) => {
      if (!cancelled) setImageUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [messages, imageUrls]);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 3 * 1024 * 1024) {
      setError("Bild ist zu groß (max. 3 MB).");
      return;
    }
    setPendingImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body && !pendingImage) return;
    setSending(true);
    setError("");
    try {
      let imagePath: string | null = null;
      if (pendingImage) {
        const ext = pendingImage.name.split(".").pop() || "jpg";
        imagePath = `${groupId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("group-chat")
          .upload(imagePath, pendingImage, { contentType: pendingImage.type });
        if (upErr) throw upErr;
      }
      const { data: inserted, error: insErr } = await supabase
        .from("group_messages")
        .insert({ group_id: groupId, user_id: user.id, body: body || null, image_path: imagePath })
        .select()
        .single();
      if (insErr) throw insErr;
      const msg = inserted as GroupMessage;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setText("");
      setPendingImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(id: string) {
    await supabase.from("group_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border border-parchment/10 bg-ink-2">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading && <p className="text-center text-sm text-parchment-dim">Lädt…</p>}
        {!loading && messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-parchment-dim">Noch keine Nachrichten. Schreib die erste!</p>
        )}
        {messages.map((m) => {
          const own = m.user_id === user.id;
          const profile = profileById[m.user_id];
          return (
            <div key={m.id} className={`flex items-end gap-2 ${own ? "flex-row-reverse" : ""}`}>
              {!own &&
                (profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-3">
                    <UserIcon className="h-3 w-3 text-parchment-dim" />
                  </span>
                ))}
              <div className={`group max-w-[75%] space-y-1 ${own ? "items-end" : "items-start"} flex flex-col`}>
                {!own && (
                  <span className="px-1 text-[10px] text-parchment-dim/60">{profile?.display_name ?? "Ohne Namen"}</span>
                )}
                {m.image_path && imageUrls[m.image_path] && (
                  <img
                    src={imageUrls[m.image_path]}
                    alt=""
                    className="max-h-48 rounded-xl border border-parchment/10 object-cover"
                  />
                )}
                {m.body && (
                  <p
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      own ? "bg-terracotta text-ink" : "bg-ink-3 text-parchment"
                    }`}
                  >
                    {m.body}
                  </p>
                )}
              </div>
              {own && (
                <button
                  onClick={() => deleteMessage(m.id)}
                  className="shrink-0 text-parchment-dim/0 group-hover:text-parchment-dim/50 active:text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 text-xs text-red-400">{error}</p>}

      {pendingImage && (
        <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg border border-parchment/10 bg-ink-3 px-3 py-1.5 text-xs text-parchment-dim">
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">{pendingImage.name}</span>
          <button onClick={() => setPendingImage(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-parchment/10 p-3">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" id="chat-image-input" />
        <label htmlFor="chat-image-input" className="shrink-0 rounded-lg p-2 text-parchment-dim active:text-gold">
          <ImageIcon className="h-4 w-4" />
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nachricht…"
          maxLength={1000}
          className="min-w-0 flex-1 rounded-lg border border-parchment/10 bg-ink-3 px-3 py-2 text-sm text-parchment outline-none focus:border-terracotta"
        />
        <button
          type="submit"
          disabled={sending || (!text.trim() && !pendingImage)}
          className="shrink-0 rounded-lg bg-terracotta p-2 text-ink disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
