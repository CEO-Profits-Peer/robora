// Wird per Supabase Database Webhook bei INSERT auf group_messages aufgerufen
// (Dashboard → Database → Webhooks, siehe README) und schickt Web-Push-
// Benachrichtigungen an alle anderen Mitglieder der Gruppe.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey);

type WebhookPayload = {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    group_id: string;
    user_id: string;
    body: string | null;
    image_path: string | null;
  };
};

Deno.serve(async (req) => {
  const payload = (await req.json()) as WebhookPayload;
  const message = payload.record;
  if (!message?.group_id || !message?.user_id) {
    return new Response("ignored", { status: 200 });
  }

  const [{ data: sender }, { data: group }, { data: members }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", message.user_id).maybeSingle(),
    supabase.from("groups").select("name").eq("id", message.group_id).maybeSingle(),
    supabase.from("group_members").select("user_id").eq("group_id", message.group_id).neq("user_id", message.user_id),
  ]);

  const recipientIds = (members ?? []).map((m) => m.user_id);
  if (recipientIds.length === 0) return new Response("no recipients", { status: 200 });

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipientIds);

  if (!subscriptions || subscriptions.length === 0) return new Response("no subscriptions", { status: 200 });

  const title = sender?.display_name ? `${sender.display_name} · ${group?.name ?? "Gruppe"}` : group?.name ?? "Neue Nachricht";
  const body = message.body?.trim() || (message.image_path ? "📷 Bild" : "Neue Nachricht");
  const notificationPayload = JSON.stringify({ title, body, groupId: message.group_id });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notificationPayload
      )
    )
  );

  const expiredEndpoints = subscriptions
    .filter((_, i) => {
      const r = results[i];
      return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
    })
    .map((s) => s.endpoint);

  if (expiredEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  return new Response("ok", { status: 200 });
});
