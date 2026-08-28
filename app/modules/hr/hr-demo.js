// SchoolSafe V2 — Phase H — Personnel / RH frontend de démonstration uniquement.
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
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.getCurrentUser === "function") return root.SchoolSafeAppContext.getCurrentUser();
    return { permissions: [], scopes: [] };
  }

  function allowsFor(subject, permission, scope) {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.allowsScope === "function" && access.allowsScope(subject, permission, scope));
  }

  function allows(permission, scope) { return allowsFor(user(), permission, scope); }
  function canReadStaff() { return allows("staff.read", "school"); }
  function canManageStaff() { return allows("staff.manage", "school"); }
  function canReadAttendance() { return allows("staff.attendance.read", "school"); }
  function canReadReports() { return allows("reports.hr.read", "school"); }
  function canAccessHr() { return canReadStaff() || canManageStaff() || canReadAttendance() || canReadReports(); }

  function tabAllowed(tab) {
    if (tab === "dashboard") return canAccessHr();
    if (tab === "staff" || tab === "contracts" || tab === "assignments" || tab === "absence") return canReadStaff() || canManageStaff();
    if (tab === "attendance" || tab === "biometric") return canReadAttendance();
    if (tab === "payroll" || tab === "reports") return canReadReports();
    return false;
  }

  function metric(label, value, icon) {
    return '<article class="hr-dashboard-metric"><span><i data-lucide="' + icon + '"></i></span><div><small>' + escapeMarkup(label) + '</small><b>' + escapeMarkup(value) + "</b></div></article>";
  }

  function shortcut(tab, label, icon) {
    return '<button type="button" class="hr-dashboard-action" data-hr-open="' + tab + '"><i data-lucide="' + icon + '"></i><span>' + escapeMarkup(label) + "</span></button>";
  }

  function renderDashboard() {
    var metrics = [
      metric("Effectif visible", canReadStaff() ? "6 profils démo" : "Accès limité", "users"),
      metric("Actifs / inactifs", canReadStaff() ? "5 / 1" : "Non visible", "user-check"),
      metric("Présents aujourd’hui", canReadAttendance() ? "4 démo" : "Permission requise", "badge-check"),
      metric("Absents", canReadAttendance() ? "1 démo" : "Permission requise", "user-x"),
      metric("Retards", canReadAttendance() ? "1 démo" : "Permission requise", "clock-alert"),
      metric("Contrats à surveiller", canReadStaff() ? "2 échéances démo" : "Non visible", "files"),
      metric("Affectations", canReadStaff() ? "6 projections" : "Non visible", "user-cog"),
      metric("Demandes en préparation", canManageStaff() ? "2 brouillons locaux" : "Lecture seule", "calendar-x"),
      metric("Rapports RH", canReadReports() ? "Synthèses frontend" : "Permission requise", "file-chart-column"),
      metric("Alertes / échéances", canAccessHr() ? "3 signaux démo" : "Non visible", "triangle-alert")
    ].join("");
    var shortcuts = [
      ["staff", "Personnel", "contact-round"],
      ["contracts", "Contrats", "files"],
      ["assignments", "Affectations", "user-cog"],
      ["absence", "Absences", "calendar-x"],
      ["attendance", "Présence", "clipboard-check"],
      ["biometric", "Biométrie", "scan-face"],
      ["payroll", "Paie", "banknote"],
      ["reports", "Rapports RH", "file-chart-column"]
    ].filter(function (item) { return tabAllowed(item[0]); }).map(function (item) { return shortcut(item[0], item[1], item[2]); }).join("");
    return '<section class="hr-dashboard" data-hr-dashboard><header><div><span>Personnel / Ressources humaines</span><h3>Tableau de bord RH</h3><p>Projection frontend non sensible, sans donnée officielle ni décision RH.</p></div><span class="hr-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><aside class="hr-boundary"><i data-lucide="shield-check"></i><p>Permissions existantes uniquement · portées school / own · DENY explicite prioritaire.</p></aside><div class="hr-dashboard-grid">' + metrics + '</div><section class="hr-shortcuts"><header><span>Raccourcis autorisés</span><h3>Accès selon permission et portée</h3></header><div>' + shortcuts + "</div></section></section>";
  }

  function renderDenied() {
    return '<section class="hr-denied">' + root.ssState({ type: "error", title: "Ressources humaines non autorisées", message: "Une permission RH existante avec portée school est obligatoire.", details: "DENY explicite prioritaire · aucune donnée RH générale n’est révélée." }) + "</section>";
  }

  function renderFuture() {
    var labels = { staff: "Dossier personnel", contracts: "Contrats", assignments: "Affectations", absence: "Absences / congés", attendance: "Présence personnel", biometric: "Biométrie", payroll: "Paie", reports: "Rapports RH" };
    return '<section class="hr-future"><span>Phase H</span><h3>' + escapeMarkup(labels[activeTab] || "Ressources humaines") + '</h3><p>Surface frontend prévue dans le lot dédié, sans opération officielle.</p><span class="hr-boundary-chip">FEATURE_LATER · BACKEND_LATER</span></section>';
  }

  function bindNavigation() {
    document.querySelectorAll("#hrTabs [data-hr-tab]").forEach(function (button) {
      button.onclick = function () { activeTab = button.getAttribute("data-hr-tab") || "dashboard"; renderContent(); };
    });
    document.querySelectorAll("[data-hr-open]").forEach(function (button) {
      button.onclick = function () { activeTab = button.getAttribute("data-hr-open") || "dashboard"; renderContent(); };
    });
  }

  function renderContent() {
    var content = document.getElementById("hrContent");
    if (!content) return;
    document.querySelectorAll("#hrTabs [data-hr-tab]").forEach(function (button) {
      var tab = button.getAttribute("data-hr-tab") || "dashboard";
      button.hidden = !tabAllowed(tab);
      button.classList.toggle("active", tab === activeTab);
    });
    content.innerHTML = !canAccessHr() ? renderDenied() : !tabAllowed(activeTab) ? renderDenied() : activeTab === "dashboard" ? renderDashboard() : renderFuture();
    bindNavigation();
    if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
  }

  function render(containerId) {
    var module = document.getElementById(containerId || "hrModule");
    if (!module) return;
    module.hidden = false;
    activeTab = "dashboard";
    renderContent();
  }

  function open(tab) { activeTab = tab || "dashboard"; renderContent(); }
  function close() {
    var module = document.getElementById("hrModule");
    if (module) module.hidden = true;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.showDashboard === "function") root.SchoolSafeAppContext.showDashboard();
  }
  function setSession(session) { sessionOverride = session || null; }

  root.SchoolSafeHrDemo = {
    render: render,
    open: open,
    close: close,
    setSession: setSession,
    canReadStaff: canReadStaff,
    canManageStaff: canManageStaff,
    canReadAttendance: canReadAttendance,
    canReadReports: canReadReports
  };
})(window);
