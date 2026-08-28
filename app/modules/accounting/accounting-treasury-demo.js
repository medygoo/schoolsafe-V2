// SchoolSafe V2 — Phase G — Comptabilité / Trésorerie frontend uniquement.
(function (root) {
  "use strict";

  var activeTab = "dashboard";
  var sessionOverride = null;

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
    return { permissions: [], scopes: [] };
  }

  function allows(permission, scope) {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.allowsScope === "function" && access.allowsScope(user(), permission, scope));
  }

  function canReadAccounting() {
    return allows("reports.financial.read", "school") || allows("finance.report.read", "school");
  }

  function canPrepareClosing() {
    return allows("finance.cash_register.close", "school");
  }

  function snapshot() {
    var finance = root.SchoolSafeFinanceModule;
    if (!finance || typeof finance.getAccountingSnapshot !== "function") {
      return { dayStatus: "Indisponible", transactions: [], expenses: [], studentFees: [] };
    }
    return finance.getAccountingSnapshot();
  }

  function renderDenied() {
    return '<section class="accounting-denied">' + root.ssState({
      type: "error",
      title: "Comptabilité / Trésorerie non autorisée",
      message: "reports.financial.read ou finance.report.read avec portée school est obligatoire.",
      details: "DENY explicite prioritaire · aucune donnée de trésorerie n’est révélée."
    }) + "</section>";
  }

  function metric(label, value, icon) {
    return '<article class="accounting-dashboard-metric"><span><i data-lucide="' + icon + '"></i></span><div><small>' + escapeMarkup(label) + '</small><b>' + escapeMarkup(value) + "</b></div></article>";
  }

  function shortcut(tab, label, icon) {
    return '<button type="button" class="accounting-dashboard-action" data-accounting-open="' + tab + '"><i data-lucide="' + icon + '"></i><span>' + escapeMarkup(label) + "</span></button>";
  }

  function renderDashboard() {
    var data = snapshot();
    var receipts = data.transactions.filter(function (item) { return item.status !== "Annulé"; }).length;
    var outputs = data.expenses.length;
    var metrics = [
      metric("Position de trésorerie", "Par devise", "landmark"),
      metric("Recettes visibles", String(receipts), "arrow-down-left"),
      metric("Sorties visibles", String(outputs), "arrow-up-right"),
      metric("Caisses", data.dayStatus, "wallet"),
      metric("Clôtures", canPrepareClosing() ? "Préparation locale" : "Lecture seule", "lock-keyhole"),
      metric("Écarts", "À contrôler", "scale"),
      metric("Anomalies", "Analyse frontend", "triangle-alert"),
      metric("Rapports", "Synthèses frontend", "file-chart-column")
    ].join("");
    var shortcuts = [
      shortcut("journal", "Journal", "notebook-tabs"),
      shortcut("treasury", "Trésorerie", "landmark"),
      shortcut("reconciliation", "Rapprochement", "list-checks"),
      shortcut("reports", "Rapports", "file-chart-column")
    ];
    if (canPrepareClosing()) shortcuts.splice(2, 0, shortcut("closing", "Clôture", "lock-keyhole"));
    return '<section class="accounting-dashboard" data-accounting-dashboard><header><div><span>Trésorerie frontend · démonstration</span><h3>Comptabilité / Trésorerie</h3><p>Projection en lecture seule des données Finance déjà visibles.</p></div><span class="accounting-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><aside class="accounting-boundary"><i data-lucide="shield-check"></i><p>Aucune écriture comptable officielle, aucun journal légal, aucun débit/crédit et aucune conversion de devise.</p></aside><div class="accounting-dashboard-grid">' + metrics + '</div><section class="accounting-shortcuts"><header><span>Raccourcis autorisés</span><h3>Accès selon permission et portée</h3></header><div>' + shortcuts.join("") + "</div></section></section>";
  }

  function renderFutureSurface() {
    var labels = {
      journal: "Journal de trésorerie",
      expenses: "Registre des dépenses",
      treasury: "Position de trésorerie",
      closing: "Préparation de clôture",
      reconciliation: "Rapprochement",
      reports: "Rapports financiers frontend"
    };
    return '<section class="accounting-future"><h3>' + escapeMarkup(labels[activeTab] || "Trésorerie") + '</h3><p>Surface prévue dans la suite de la Phase G.</p><span class="accounting-boundary-chip">BACKEND_LATER</span></section>';
  }

  function bindNavigation() {
    document.querySelectorAll("#accountingTabs [data-accounting-tab]").forEach(function (button) {
      button.onclick = function () {
        activeTab = button.getAttribute("data-accounting-tab") || "dashboard";
        renderContent();
      };
    });
    document.querySelectorAll("[data-accounting-open]").forEach(function (button) {
      button.onclick = function () {
        activeTab = button.getAttribute("data-accounting-open") || "dashboard";
        renderContent();
      };
    });
  }

  function renderContent() {
    var content = document.getElementById("accountingContent");
    if (!content) return;
    var closeAllowed = canPrepareClosing();
    document.querySelectorAll("#accountingTabs [data-accounting-tab]").forEach(function (button) {
      var tab = button.getAttribute("data-accounting-tab");
      button.hidden = tab === "closing" && !closeAllowed;
      button.classList.toggle("active", tab === activeTab);
    });
    content.innerHTML = canReadAccounting() ? (activeTab === "dashboard" ? renderDashboard() : renderFutureSurface()) : renderDenied();
    bindNavigation();
    if (typeof root.lucide !== "undefined" && root.lucide.createIcons) root.lucide.createIcons();
  }

  function render(containerId) {
    var module = document.getElementById(containerId || "accountingModule");
    if (!module) return;
    module.hidden = false;
    activeTab = "dashboard";
    renderContent();
  }

  function close() {
    var module = document.getElementById("accountingModule");
    if (module) module.hidden = true;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.showDashboard === "function") root.SchoolSafeAppContext.showDashboard();
  }

  function setSession(session) {
    sessionOverride = session || null;
  }

  root.SchoolSafeAccountingTreasury = {
    render: render,
    close: close,
    setSession: setSession,
    canReadAccounting: canReadAccounting,
    canPrepareClosing: canPrepareClosing,
    getSnapshot: snapshot
  };
})(window);
