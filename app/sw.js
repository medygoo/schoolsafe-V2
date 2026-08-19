self.addEventListener("push", function (event) {
  var payload = { title: "SchoolSafe", body: "Nouvelle notification" };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {}

  var options = {
    body: payload.body || "Nouvelle notification",
    icon: "./schoolsafe-logo.png",
    badge: "./schoolsafe-logo.png",
    tag: payload.tag || "schoolsafe-default",
    requireInteraction: payload.requireInteraction || false,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(payload.title || "SchoolSafe", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow("./");
    }),
  );
});

self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
