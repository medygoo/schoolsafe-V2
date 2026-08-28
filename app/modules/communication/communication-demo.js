// SchoolSafe V2 — Phase K — Communications frontend uniquement.
(function (root) {
  "use strict";

  var activeTab = "dashboard";
  var sessionOverride = null;

  var SECTIONS = [
    { key: "messages", label: "Messages", icon: "messages-square", note: "Composition bornée par permission et portée." },
    { key: "notifications", label: "Notifications", icon: "bell", note: "Préférences personnelles et historique de démonstration." },
    { key: "announcements", label: "Annonces", icon: "megaphone", note: "Brouillons et circuit de relecture frontend." },
    { key: "convocations", label: "Convocations", icon: "mail-plus", note: "Préparation locale sous permission future dédiée." },
    { key: "channels", label: "Site public / WebSync", icon: "globe-2", note: "Publication réelle indisponible sans permission future." },
    { key: "events", label: "Événements", icon: "calendar-days", note: "Aperçu de démonstration, jamais présenté comme publié." }
  ];

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function user() {
    if (sessionOverride) return sessionOverride;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.getCurrentUser === "function") {
      return root.SchoolSafeAppContext.getCurrentUser();
    }
    return { permissions: [], scopes: [], denies: [] };
  }

  function isDemoMode(subject) {
    return !(subject && subject.token);
  }

  function dashboardCard(item) {
    return '<button class="communication-card" type="button" data-communication-open="' + item.key + '">' +
      '<span class="communication-card__icon"><i data-lucide="' + item.icon + '"></i></span>' +
      '<span class="communication-card__copy"><b>' + escapeMarkup(item.label) + '</b><small>' + escapeMarkup(item.note) + '</small></span>' +
      '<span class="communication-card__state">BACKEND_LATER</span>' +
      '<i data-lucide="chevron-right" aria-hidden="true"></i>' +
      '</button>';
  }

  function renderDashboard() {
    var live = !isDemoMode(user());
    return '<section class="communication-dashboard" data-communication-dashboard>' +
      '<header class="communication-view-header"><div><span>' + (live ? "SESSION LIVE" : "DÉMONSTRATION") + '</span>' +
      '<h3>Communication scolaire</h3><p>Messages, annonces, convocations et canaux restent séparés par leurs autorisations propres.</p></div>' +
      '<span class="communication-boundary-chip">' + (live ? "DONNÉES RÉELLES INDISPONIBLES" : "DÉMONSTRATION") + '</span></header>' +
      '<aside class="communication-boundary"><i data-lucide="shield-check"></i><div><b>Frontend uniquement</b><p>Aucun compteur distant, envoi, publication ou distribution n’est simulé comme réel. Toutes les opérations finales restent BACKEND_LATER.</p></div></aside>' +
      '<div class="communication-card-grid">' + SECTIONS.map(dashboardCard).join("") + '</div>' +
      '</section>';
  }

  function renderFuture() {
    var selected = SECTIONS.filter(function (item) { return item.key === activeTab; })[0];
    return '<section class="communication-future"><i data-lucide="construction"></i><span>DÉMONSTRATION · BACKEND_LATER</span><h3>' +
      escapeMarkup(selected ? selected.label : "Communication") + '</h3><p>Cette surface sera complétée dans le lot Phase K correspondant.</p></section>';
  }

  function refreshTabs() {
    document.querySelectorAll("[data-communication-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-communication-tab") === activeTab);
    });
  }

  function renderContent() {
    var content = document.getElementById("communicationContent");
    if (!content) return;
    content.innerHTML = activeTab === "dashboard" ? renderDashboard() : renderFuture();
    refreshTabs();
    content.querySelectorAll("[data-communication-open]").forEach(function (button) {
      button.addEventListener("click", function () { open(button.getAttribute("data-communication-open")); });
    });
    if (root.lucide && typeof root.lucide.createIcons === "function") root.lucide.createIcons();
  }

  function bindEvents() {
    document.querySelectorAll("[data-communication-tab]").forEach(function (button) {
      if (button.__communicationBound) return;
      button.__communicationBound = true;
      button.addEventListener("click", function () { open(button.getAttribute("data-communication-tab")); });
    });
  }

  function render(containerId) {
    var module = document.getElementById(containerId || "communicationModule");
    if (!module) return;
    module.hidden = false;
    activeTab = "dashboard";
    bindEvents();
    renderContent();
  }

  function open(tab) {
    activeTab = tab || "dashboard";
    renderContent();
  }

  function close() {
    var module = document.getElementById("communicationModule");
    if (module) module.hidden = true;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.showDashboard === "function") {
      root.SchoolSafeAppContext.showDashboard();
    }
  }

  function setSession(session) {
    sessionOverride = session || null;
  }

  root.SchoolSafeCommunication = {
    render: render,
    open: open,
    close: close,
    setSession: setSession,
    isDemoMode: isDemoMode
  };
})(window);
