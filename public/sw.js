// The app's service worker (GAME_DESIGN.md 13.26). It only handles push notifications: it shows
// the message the server sent and opens the app on the right tab when it is tapped. It caches
// nothing, so it never changes how pages load.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  // Firebase Cloud Messaging puts our fields under `data`.
  const data = payload.data || payload.notification || {};
  const title = data.title || "Do You Even Log Bro?";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // One per kind: a newer "weekly fight" replaces an unread older one.
      tag: data.type || "general",
      data: { url: data.url || "/train" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/train", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse the open app if there is one.
      for (const client of windows) {
        if ("focus" in client) return client.navigate ? client.navigate(url).then((c) => (c || client).focus()) : client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
