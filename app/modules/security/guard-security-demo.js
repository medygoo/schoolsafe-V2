(function (root) {
  "use strict";

  var activeContainerId = null;
  var activeUser = null;

  var PORTALS = [
    { id: "demo-portal-main", name: "Portail principal", station: "Poste A", status: "POSTE ACTIF" },
    { id: "demo-portal-east", name: "Portail Est", station: "Poste B", status: "HORS AFFECTATION" }
  ];

  var STUDENTS = [
    { id: "demo-active-student", name: "Lucas Martin", className: "6e A", lifecycleStatus: "active", dismissalStatus: "À PRÉPARER" },
    { id: "demo-student-chloe", name: "Chloé Bernard", className: "6e A", lifecycleStatus: "active", dismissalStatus: "PRÊT" },
    { id: "demo-student-ethan", name: "Ethan Leroy", className: "5e A", lifecycleStatus: "active", dismissalStatus: "EN ATTENTE DU CONTRÔLE" },
    { id: "demo-draft-student", name: "Amina Mbuyi", className: "5e A", lifecycleStatus: "draft", dismissalStatus: "DOSSIER NON ACTIF" }
  ];

  function escapeMarkup(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function icon(name) {
    return '<i data-lucide="' + name + '"></i>';
  }

  function allowsScope(user, permission, scope) {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.allowsScope === "function" && access.allowsScope(user || {}, permission, scope));
  }

  function hasExplicitDeny(user) {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.explicitDeny === "function" &&
      (access.explicitDeny(user || {}, "security.scan") || access.explicitDeny(user || {}, "security.pickup.manage")));
  }

  function getPortalProjection(user) {
    if (!allowsScope(user, "security.scan", "assigned_portal") || !allowsScope(user, "security.pickup.manage", "assigned_portal")) {
      return { allowed: false, portal: null, students: [] };
    }
    var assignedIds = Array.isArray(user && user.assignedPortalIds) ? user.assignedPortalIds : [];
    var portal = PORTALS.find(function (item) { return assignedIds.indexOf(item.id) >= 0; }) || null;
    return {
      allowed: !!portal,
      portal: portal,
      students: STUDENTS.filter(function (student) { return student.lifecycleStatus === "active"; })
    };
  }

  function dashboardCard(label, value, detail, iconName) {
    return '<article class="guard-security-metric"><span>' + icon(iconName) + '</span><div><small>' + escapeMarkup(label) + '</small><strong>' + escapeMarkup(value) + '</strong><p>' + escapeMarkup(detail) + '</p></div></article>';
  }

  function shortcut(label, target, iconName) {
    return '<button type="button" data-guard-open="' + target + '"><span>' + icon(iconName) + '</span><strong>' + escapeMarkup(label) + '</strong><small>assigned_portal</small></button>';
  }

  function renderDenied(container, user) {
    container.innerHTML = '<section class="guard-security-denied">' + icon("shield-x") + '<div><p class="guard-security-eyebrow">Access_Law</p><h1>Accès sécurité refusé</h1><p>' +
      (hasExplicitDeny(user) ? "Un DENY explicite bloque ce poste." : "security.scan et security.pickup.manage avec assigned_portal sont obligatoires.") +
      '</p></div></section>';
  }

  function renderDashboard(container, projection) {
    var studentRows = projection.students.map(function (student) {
      return '<li><span><strong>' + escapeMarkup(student.name) + '</strong><small>' + escapeMarkup(student.className) + '</small></span><b>' + escapeMarkup(student.dismissalStatus) + '</b></li>';
    }).join("");
    container.innerHTML = '<div class="guard-security-shell guard-security-dashboard">' +
      '<header class="guard-security-hero"><div><p class="guard-security-eyebrow">Espace Gardien · démonstration locale</p><h1>' + escapeMarkup(projection.portal.name) + '</h1><p>' + escapeMarkup(projection.portal.station) + ' · contrôle limité au portail affecté.</p></div><span>' + escapeMarkup(projection.portal.status) + '</span></header>' +
      '<section class="guard-security-metrics" aria-label="Situation du poste">' +
        dashboardCard("Scans du jour", "18", "Entrées et sorties simulées", "scan-line") +
        dashboardCard("Élèves à préparer", "3", "Uniquement les dossiers actifs", "users-round") +
        dashboardCard("Contrôles de récupération", "2", "Une vérification en attente", "badge-check") +
        dashboardCard("Alertes à traiter", "1", "Identité à revérifier", "triangle-alert") +
      '</section>' +
      '<section class="guard-security-shortcuts" aria-label="Raccourcis du poste">' +
        shortcut("Scanner une carte", "scan", "scan-line") +
        shortcut("Contrôler une récupération", "pickup", "contact-round") +
        shortcut("Préparer une sortie", "dismissal", "clock-3") +
      '</section>' +
      '<div class="guard-security-columns"><section class="guard-security-panel"><header><div><p class="guard-security-eyebrow">Opérations admissibles</p><h2>Élèves actifs du portail</h2></div><span>DRAFTS EXCLUS</span></header><ul class="guard-security-student-list">' + studentRows + '</ul></section>' +
      '<section class="guard-security-panel"><header><div><p class="guard-security-eyebrow">Session locale</p><h2>Événements récents</h2></div><span>DÉMONSTRATION</span></header><ol class="guard-security-event-list"><li><b>08:04</b><span>Entrée autorisée · Lucas Martin</span></li><li><b>12:15</b><span>Contrôle préparé · Chloé Bernard</span></li><li><b>14:02</b><span>Vérification d’identité requise</span></li></ol></section></div>' +
      '<aside class="guard-security-honesty">' + icon("cloud-off") + '<div><strong>FRONTEND UNIQUEMENT · BACKEND_LATER</strong><p>Les compteurs et événements sont des données de démonstration locales. Aucune action serveur réelle.</p></div></aside>' +
      '<section class="guard-security-feature" data-guard-feature hidden></section>' +
    '</div>';
    container.querySelectorAll("[data-guard-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        var feature = container.querySelector("[data-guard-feature]");
        if (!feature) return;
        feature.hidden = false;
        feature.innerHTML = '<p class="guard-security-eyebrow">Navigation Phase E</p><h2>' + escapeMarkup(button.textContent.trim()) + '</h2><strong>FEATURE_LATER</strong>';
      });
    });
  }

  function render(containerId, user) {
    var container = root.document.getElementById(containerId);
    if (!container) return;
    activeContainerId = containerId;
    activeUser = user || {};
    var projection = getPortalProjection(activeUser);
    if (!projection.allowed) renderDenied(container, activeUser);
    else renderDashboard(container, projection);
    if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
  }

  function clear() {
    activeContainerId = null;
    activeUser = null;
  }

  root.SchoolSafeGuardSecurity = {
    PORTALS: PORTALS,
    STUDENTS: STUDENTS,
    getPortalProjection: getPortalProjection,
    clear: clear,
    render: render
  };
}(window));
