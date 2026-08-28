(function (root) {
  "use strict";

  var activeContainerId = null;
  var activeUser = null;

  var PORTALS = [
    { id: "demo-portal-main", name: "Portail principal", station: "Poste A", status: "POSTE ACTIF" },
    { id: "demo-portal-east", name: "Portail Est", station: "Poste B", status: "HORS AFFECTATION" }
  ];

  var STUDENTS = [
    { id: "demo-active-student", name: "Lucas Martin", classId: "demo-class-1", className: "6e A", lifecycleStatus: "active", dismissalStatus: "À PRÉPARER", attendanceStatus: "PRÉSENT", movement: "ENTRÉ", firstEntry: "07:31", lastExit: "—", history: "Entrée portail principal · 07:31" },
    { id: "demo-student-chloe", name: "Chloé Bernard", classId: "demo-class-1", className: "6e A", lifecycleStatus: "active", dismissalStatus: "PRÊT", attendanceStatus: "RETARD", movement: "ENTRÉ", firstEntry: "08:12", lastExit: "—", history: "Retard vérifié · 08:12" },
    { id: "demo-student-ethan", name: "Ethan Leroy", classId: "demo-class-2", className: "5e A", lifecycleStatus: "active", dismissalStatus: "EN ATTENTE DU CONTRÔLE", attendanceStatus: "ABSENT", movement: "SORTI", firstEntry: "07:28", lastExit: "11:54", history: "Sortie autorisée · 11:54" },
    { id: "demo-draft-student", name: "Amina Mbuyi", classId: "demo-class-2", className: "5e A", lifecycleStatus: "draft", dismissalStatus: "DOSSIER NON ACTIF", attendanceStatus: "INDISPONIBLE", movement: "AUCUN", firstEntry: "—", lastExit: "—", history: "Dossier en préparation" }
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

  function getAttendanceProjection(user) {
    var activeStudents = STUDENTS.filter(function (student) { return student.lifecycleStatus === "active"; });
    var portalProjection = getPortalProjection(user);
    if (portalProjection.allowed) return { allowed: true, scopeType: "assigned_portal", students: portalProjection.students, portal: portalProjection.portal };
    if (!allowsScope(user, "security.events.read", "assigned_classes") || !allowsScope(user, "school.student.read", "assigned_classes")) {
      return { allowed: false, scopeType: "none", students: [], portal: null };
    }
    var classIds = Array.isArray(user && user.assignedClassIds) ? user.assignedClassIds : [];
    return {
      allowed: classIds.length > 0,
      scopeType: "assigned_classes",
      students: activeStudents.filter(function (student) { return classIds.indexOf(student.classId) >= 0; }),
      portal: null
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
      '<button class="guard-security-inline-action" type="button" data-guard-attendance>' + icon("clipboard-check") + '<span><strong>Consulter la présence</strong><small>Statut du jour · démonstration</small></span></button>' +
      '<div class="guard-security-columns"><section class="guard-security-panel"><header><div><p class="guard-security-eyebrow">Opérations admissibles</p><h2>Élèves actifs du portail</h2></div><span>DRAFTS EXCLUS</span></header><ul class="guard-security-student-list">' + studentRows + '</ul></section>' +
      '<section class="guard-security-panel"><header><div><p class="guard-security-eyebrow">Session locale</p><h2>Événements récents</h2></div><span>DÉMONSTRATION</span></header><ol class="guard-security-event-list"><li><b>08:04</b><span>Entrée autorisée · Lucas Martin</span></li><li><b>12:15</b><span>Contrôle préparé · Chloé Bernard</span></li><li><b>14:02</b><span>Vérification d’identité requise</span></li></ol></section></div>' +
      '<aside class="guard-security-honesty">' + icon("cloud-off") + '<div><strong>FRONTEND UNIQUEMENT · BACKEND_LATER</strong><p>Les compteurs et événements sont des données de démonstration locales. Aucune action serveur réelle.</p></div></aside>' +
      '<section class="guard-security-feature" data-guard-feature hidden></section>' +
    '</div>';
    container.querySelectorAll("[data-guard-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-guard-open");
        if (target === "scan") {
          open("scan");
          return;
        }
        var feature = container.querySelector("[data-guard-feature]");
        if (!feature) return;
        feature.hidden = false;
        feature.innerHTML = '<p class="guard-security-eyebrow">Navigation Phase E</p><h2>' + escapeMarkup(button.textContent.trim()) + '</h2><strong>FEATURE_LATER</strong>';
      });
    });
    var attendance = container.querySelector("[data-guard-attendance]");
    if (attendance) attendance.addEventListener("click", function () { open("attendance"); });
  }

  function attendanceMetric(label, value, iconName) {
    return '<article><span>' + icon(iconName) + '</span><small>' + escapeMarkup(label) + '</small><strong>' + escapeMarkup(value) + '</strong></article>';
  }

  function renderAttendance(container, projection) {
    var students = projection.students;
    var rows = students.map(function (student) {
      return '<article class="guard-attendance-row" data-attendance-student="' + escapeMarkup(student.id) + '"><header><div><p class="guard-security-eyebrow">' + escapeMarkup(student.className) + '</p><h3>' + escapeMarkup(student.name) + '</h3></div><span>' + escapeMarkup(student.attendanceStatus) + '</span></header><dl><div><dt>Statut du jour</dt><dd>' + escapeMarkup(student.movement) + '</dd></div><div><dt>Première entrée</dt><dd>' + escapeMarkup(student.firstEntry) + '</dd></div><div><dt>Dernière sortie</dt><dd>' + escapeMarkup(student.lastExit) + '</dd></div></dl><p><strong>Historique synthétique :</strong> ' + escapeMarkup(student.history) + '</p></article>';
    }).join("");
    var present = students.filter(function (student) { return student.attendanceStatus === "PRÉSENT"; }).length;
    var absent = students.filter(function (student) { return student.attendanceStatus === "ABSENT"; }).length;
    var late = students.filter(function (student) { return student.attendanceStatus === "RETARD"; }).length;
    var entered = students.filter(function (student) { return student.movement === "ENTRÉ"; }).length;
    var exited = students.filter(function (student) { return student.movement === "SORTI"; }).length;
    container.innerHTML = '<div class="guard-security-shell guard-attendance-view"><header class="guard-security-workspace-header"><button type="button" data-guard-back>' + icon("arrow-left") + ' Tableau de bord</button><div><p class="guard-security-eyebrow">E2 · Présence frontend</p><h1>Présence des élèves actifs</h1><p>Consultation limitée à ' + escapeMarkup(projection.scopeType) + '.</p></div><span>DÉMONSTRATION · BACKEND_LATER</span></header><section class="guard-attendance-metrics">' + attendanceMetric("Présents", present, "user-check") + attendanceMetric("Absents", absent, "user-x") + attendanceMetric("Retards", late, "clock-alert") + attendanceMetric("Entrés", entered, "log-in") + attendanceMetric("Sortis", exited, "log-out") + '</section><section class="guard-security-panel"><header><div><p class="guard-security-eyebrow">Lecture seule</p><h2>Statut du jour</h2></div><span>AUCUNE MODIFICATION OFFICIELLE</span></header><div class="guard-attendance-list">' + (rows || '<p>Aucun élève actif dans le périmètre.</p>') + '</div></section><aside class="guard-security-honesty">' + icon("info") + '<div><strong>Données de démonstration</strong><p>Aucun historique serveur réel et aucune modification manuelle arbitraire.</p></div></aside></div>';
    var back = container.querySelector("[data-guard-back]");
    if (back) back.addEventListener("click", function () { render(activeContainerId, activeUser); });
  }

  function renderScannerWorkspace(container, projection) {
    container.innerHTML = '<div class="guard-security-shell guard-scan-view"><header class="guard-security-workspace-header"><button type="button" data-guard-back>' + icon("arrow-left") + ' Tableau de bord</button><div><p class="guard-security-eyebrow">E3 · Scanner existant</p><h1>Entrée / sortie au ' + escapeMarkup(projection.portal.name) + '</h1><p>security.scan · assigned_portal</p></div><span>FRONTEND · BACKEND_LATER</span></header><section class="guard-security-panel"><div id="guardScannerHost" class="guard-scanner-host"></div></section></div>';
    root.SchoolSafeSecurityModule.render("guardScannerHost", { mode: "scan", user: activeUser, portalId: projection.portal.id, frontendDemo: true, hideModeTabs: true });
    var back = container.querySelector("[data-guard-back]");
    if (back) back.addEventListener("click", function () { render(activeContainerId, activeUser); });
  }

  function open(view) {
    var container = root.document.getElementById(activeContainerId || "guardSecurityPortal");
    if (!container || !activeUser) return false;
    if (view === "attendance") {
      var projection = getAttendanceProjection(activeUser);
      if (!projection.allowed) {
        renderDenied(container, activeUser);
        if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
        return false;
      }
      renderAttendance(container, projection);
      if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
      return true;
    }
    if (view === "scan") {
      var portalProjection = getPortalProjection(activeUser);
      if (!portalProjection.allowed || !root.SchoolSafeSecurityModule) {
        renderDenied(container, activeUser);
        if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
        return false;
      }
      renderScannerWorkspace(container, portalProjection);
      if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
      return true;
    }
    return false;
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
    getAttendanceProjection: getAttendanceProjection,
    open: open,
    clear: clear,
    render: render
  };
}(window));
