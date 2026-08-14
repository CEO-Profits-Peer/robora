/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.pathname.includes("/storage/v1/object/"),
  new CacheFirst({
    cacheName: "audio-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.includes("/rest/v1/"),
  new StaleWhileRevalidate({
    cacheName: "api-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

self.skipWaiting();

type ChatPushPayload = {
  title: string;
  body: string;
  groupId: string;
  icon?: string;
};

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: ChatPushPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icon-192.png",
      badge: "/icon-192.png",
      tag: `group-${payload.groupId}`,
      data: { groupId: payload.groupId },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const groupId = (event.notification.data as { groupId?: string } | undefined)?.groupId;
  const targetUrl = groupId ? `/?group=${groupId}` : "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => "focus" in c);
      if (existing) {
        await (existing as WindowClient).focus();
        existing.postMessage({ type: "open-group", groupId });
      } else {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
