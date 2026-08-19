(function () {
  "use strict";

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[Push] Web Push not supported");
    return;
  }

  function getApiBase() {
    return window.schoolSafeBackendConfig && window.schoolSafeBackendConfig.api_base
      ? window.schoolSafeBackendConfig.api_base
      : "http://127.0.0.1:8787";
  }

  function currentToken() {
    try {
      var session = JSON.parse(localStorage.getItem("schoolsafe-v2-session") || "{}");
      return session.token || null;
    } catch (e) {
      return null;
    }
  }

  async function requestPushSubscription() {
    var permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[Push] Notification permission denied");
      return;
    }

    var token = currentToken();
    if (!token) {
      console.log("[Push] No session token");
      return;
    }

    try {
      var res = await fetch(getApiBase() + "/push/public-key", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.log("[Push] Push not configured on server");
        return;
      }
      var config = await res.json();
      var publicKey = config.public_key;
      if (!publicKey) return;

      var registration = await navigator.serviceWorker.ready;
      var subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(getApiBase() + "/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
            auth: arrayBufferToBase64(subscription.getKey("auth")),
          },
        }),
      });
      console.log("[Push] Subscription saved");
    } catch (err) {
      console.error("[Push] Subscription failed", err);
    }
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  navigator.serviceWorker
    .register("./sw.js")
    .then(function (registration) {
      console.log("[SW] Registered", registration.scope);
      return requestPushSubscription();
    })
    .catch(function (err) {
      console.error("[SW] Registration failed", err);
    });
})();
