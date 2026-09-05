// SchoolSafe Auth Native — client frontend (lot 2.4).
// La session vit dans un cookie HttpOnly : ce module NE LIT JAMAIS de token.
// Toutes les requêtes passent credentials: 'include' (le cookie voyage seul).
// Le flux legacy (Supabase/sessionStorage) reste intact : repli complet.
(function () {
  "use strict";

  function apiBase() {
    return (
      window.schoolSafeApiBase ||
      window.SCHOOLSAFE_API_BASE ||
      "http://127.0.0.1:8787"
    );
  }

  async function request(path, options) {
    var res = await fetch(apiBase() + path, {
      method: options && options.method ? options.method : "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options && options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined,
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error((data && data.message) || "Erreur " + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // true si le serveur connaît l'auth native (sinon repli legacy complet).
  async function isAvailable() {
    try {
      await request("/health", {});
      return true;
    } catch (e) {
      return false;
    }
  }

  async function login(login, password, profileId) {
    return request("/auth/native/login", {
      method: "POST",
      body: { login: login, password: password, profileId: profileId },
    });
  }

  async function me() {
    return request("/auth/native/me", {});
  }

  async function sessionBootstrap() {
    return request("/native/session/bootstrap", {});
  }

  async function logout() {
    return request("/auth/native/logout", { method: "POST", body: {} });
  }

  window.SchoolSafeAuthNative = {
    isAvailable: isAvailable,
    login: login,
    me: me,
    sessionBootstrap: sessionBootstrap,
    logout: logout,
  };
})();
