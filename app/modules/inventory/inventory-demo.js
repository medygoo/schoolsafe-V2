// SchoolSafe V2 — Phase I — Stock / Inventaire frontend de démonstration uniquement.
(function (root) {
  "use strict";

  var activeTab = "dashboard";
  var sessionOverride = null;
  var METRICS = [
    ["Articles", "12 références démo", "boxes"],
    ["Catégories", "5 familles", "tags"],
    ["Emplacements", "4 zones", "warehouse"],
    ["Alertes seuil", "3 à examiner", "triangle-alert"],
    ["Ruptures", "1 simulation", "package-x"],
    ["Mouvements récents", "8 opérations démo", "arrow-left-right"],
    ["Demandes d’achat", "3 brouillons", "clipboard-list"],
    ["Commandes", "2 simulations", "shopping-cart"],
    ["Réceptions", "2 contrôles", "package-check"],
    ["Anomalies", "1 à rapprocher", "badge-alert"]
  ];

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function user() {
    if (sessionOverride) return sessionOverride;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.getCurrentUser === "function") return root.SchoolSafeAppContext.getCurrentUser();
    return { permissions: [], scopes: [] };
  }

  function isDemoMode(subject) { return !(subject && subject.token); }

  function canReadAggregates(subject) {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.allowsScope === "function" && access.allowsScope(subject || user(), "reports.operational.read", "school"));
  }

  function metric(item, live) {
    return '<article class="inventory-dashboard-metric"><span><i data-lucide="' + item[2] + '"></i></span><div><small>' + escapeMarkup(item[0]) + '</small><b>' + escapeMarkup(live ? "Agrégat disponible" : item[1]) + "</b></div></article>";
  }

  function renderDemoDashboard() {
    return '<section class="inventory-dashboard" data-inventory-dashboard><header><div><span>Stock / Inventaire / Achats internes</span><h3>Vue opérationnelle générique</h3><p>Données fictives destinées à valider les parcours frontend, sans écriture officielle.</p></div><span class="inventory-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><aside class="inventory-boundary"><i data-lucide="shield-check"></i><p>Moteur Stock unique · les besoins Cantine réutiliseront ce référentiel sans dupliquer le domaine.</p></aside><div class="inventory-dashboard-grid">' + METRICS.map(function (item) { return metric(item, false); }).join("") + "</div></section>";
  }

  function renderLiveAggregates() {
    return '<section class="inventory-dashboard inventory-live" data-inventory-live-aggregates><header><div><span>AGRÉGATS AUTORISÉS</span><h3>Lecture opérationnelle consolidée</h3><p>Aucun détail opérationnel, article, mouvement ou formulaire n’est exposé dans cette session.</p></div><span class="inventory-boundary-chip">LECTURE SEULE · school</span></header><div class="inventory-dashboard-grid">' + METRICS.map(function (item) { return metric(item, true); }).join("") + "</div></section>";
  }

  function renderDenied() {
    var state = typeof root.ssState === "function" ? root.ssState({ type: "error", title: "Stock non autorisé", message: "reports.operational.read avec portée school est obligatoire en session réelle.", details: "DENY explicite prioritaire · aucun détail Stock n’est révélé." }) : "<h3>Stock non autorisé</h3>";
    return '<section class="inventory-denied">' + state + "</section>";
  }

  function renderFuture(tab) {
    var labels = { catalog: "Catalogue articles", levels: "Niveaux et seuils", movements: "Mouvements", procurement: "Achats internes", receipts: "Réceptions et anomalies", reports: "Rapports Stock" };
    return '<section class="inventory-future"><span>FEATURE_LATER</span><h3>' + escapeMarkup(labels[tab] || "Stock") + '</h3><p>Ce parcours sera activé dans son lot Phase I dédié.</p><small>FRONTEND UNIQUEMENT · BACKEND_LATER</small></section>';
  }

  function refreshTabs() {
    document.querySelectorAll("[data-inventory-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-inventory-tab") === activeTab);
    });
  }

  function renderContent() {
    var content = document.getElementById("inventoryContent");
    if (!content) return;
    var subject = user();
    if (activeTab !== "dashboard") content.innerHTML = isDemoMode(subject) ? renderFuture(activeTab) : (canReadAggregates(subject) && activeTab === "reports" ? renderLiveAggregates() : renderDenied());
    else content.innerHTML = isDemoMode(subject) ? renderDemoDashboard() : (canReadAggregates(subject) ? renderLiveAggregates() : renderDenied());
    refreshTabs();
    if (root.lucide && typeof root.lucide.createIcons === "function") root.lucide.createIcons();
  }

  function bindEvents() {
    document.querySelectorAll("[data-inventory-tab]").forEach(function (button) {
      if (button.__inventoryBound) return;
      button.__inventoryBound = true;
      button.addEventListener("click", function () { open(button.getAttribute("data-inventory-tab")); });
    });
  }

  function render(containerId) {
    var module = document.getElementById(containerId || "inventoryModule");
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
    var module = document.getElementById("inventoryModule");
    if (module) module.hidden = true;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.showDashboard === "function") root.SchoolSafeAppContext.showDashboard();
  }

  function setSession(session) { sessionOverride = session || null; }

  root.SchoolSafeInventoryDemo = {
    render: render,
    open: open,
    close: close,
    setSession: setSession,
    isDemoMode: isDemoMode,
    canReadAggregates: canReadAggregates
  };
})(window);
