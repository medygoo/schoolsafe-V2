(function (root) {
  "use strict";

  var CLASSES = [
    { id: "demo-class-1", name: "1re A", cycle: "Secondaire", room: "B12" },
    { id: "demo-class-2", name: "2e B", cycle: "Secondaire", room: "C04" },
    { id: "demo-class-foreign", name: "3e C", cycle: "Secondaire", room: "D08" }
  ];

  var SUBJECTS = [
    { id: "demo-subject-math", name: "Mathématiques", classIds: ["demo-class-1"] },
    { id: "demo-subject-french", name: "Français", classIds: ["demo-class-2"] },
    { id: "demo-subject-physics", name: "Sciences physiques", classIds: ["demo-class-foreign"] }
  ];

  var STUDENTS = [
    { id: "demo-student-lucas", name: "Lucas Martin", classId: "demo-class-1", lifecycleStatus: "active", attention: "Lecture des consignes" },
    { id: "demo-student-chloe", name: "Chloé Bernard", classId: "demo-class-1", lifecycleStatus: "active", attention: "Progression régulière" },
    { id: "demo-student-ethan", name: "Ethan Leroy", classId: "demo-class-2", lifecycleStatus: "active", attention: "Expression écrite" },
    { id: "demo-student-amina", name: "Amina Mbuyi", classId: "demo-class-1", lifecycleStatus: "draft", attention: "Dossier en préparation" },
    { id: "demo-student-foreign", name: "Noah Kasongo", classId: "demo-class-foreign", lifecycleStatus: "active", attention: "Hors périmètre" }
  ];

  var activeContainerId = null;
  var activeUser = null;

  function escapeMarkup(value) {
    if (root.ssEscapeHtml) return root.ssEscapeHtml(value == null ? "" : String(value));
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function explicitDeny(user, permission) {
    if (Array.isArray(user && user.deniedPermissions) && user.deniedPermissions.indexOf(permission) >= 0) return true;
    return Array.isArray(user && user.permissionExceptions) && user.permissionExceptions.some(function (item) {
      return item && item.permission === permission && String(item.effect || "").toLowerCase() === "deny";
    });
  }

  function hasPermission(user, permission) {
    if (explicitDeny(user, permission)) return false;
    return !!(root.SchoolSafeAccess && root.SchoolSafeAccess.canAccess(user || {}, permission));
  }

  function scopeFor(user, permission) {
    var scopes = Array.isArray(user && user.scopes) ? user.scopes : [];
    return scopes.find(function (scope) { return scope && scope.permission === permission; }) || null;
  }

  function allowsScope(user, permission, expectedScope) {
    var scope = scopeFor(user, permission);
    return hasPermission(user, permission) && !!scope && scope.type === expectedScope;
  }

  function getAssignedProjection(user) {
    var canReadClasses = allowsScope(user, "school.class.read", "assigned_classes");
    var canReadSubjects = allowsScope(user, "pedagogy.subject.read", "assigned_subjects");
    if (!canReadClasses || !canReadSubjects) {
      return { allowed: false, classes: [], subjects: [], students: [] };
    }
    var classIds = Array.isArray(user && user.assignedClassIds) ? user.assignedClassIds : [];
    var subjectIds = Array.isArray(user && user.assignedSubjectIds) ? user.assignedSubjectIds : [];
    var classes = CLASSES.filter(function (item) { return classIds.indexOf(item.id) >= 0; });
    var subjects = SUBJECTS.filter(function (item) {
      return subjectIds.indexOf(item.id) >= 0 && item.classIds.some(function (classId) { return classIds.indexOf(classId) >= 0; });
    });
    var students = allowsScope(user, "school.student.read", "assigned_classes") ? STUDENTS.filter(function (item) {
      return item.lifecycleStatus === "active" && classIds.indexOf(item.classId) >= 0;
    }) : [];
    return { allowed: true, classes: classes, subjects: subjects, students: students };
  }

  function icon(name) {
    return '<i data-lucide="' + name + '"></i>';
  }

  function renderDenied(container) {
    container.innerHTML = '<div class="teacher-pedagogy-state teacher-pedagogy-state--denied">' + icon("shield-off") +
      '<div><p class="teacher-eyebrow">ACCESS_LAW · DENY par défaut</p><h1>Accès pédagogique refusé</h1>' +
      '<p>Les permissions et portées assigned_classes / assigned_subjects sont obligatoires.</p></div></div>';
  }

  function dashboardCard(label, value, detail, iconName, target, state) {
    return '<button class="teacher-priority-card" type="button" data-teacher-open="' + target + '">' +
      '<span class="teacher-priority-icon">' + icon(iconName) + '</span><span><small>' + escapeMarkup(label) + '</small>' +
      '<strong>' + escapeMarkup(value) + '</strong><em>' + escapeMarkup(detail) + '</em></span>' +
      '<b>' + escapeMarkup(state || "PHASE D") + '</b></button>';
  }

  function renderDashboard(container, projection) {
    var classCards = projection.classes.map(function (item) {
      return '<article class="teacher-scope-card" data-assigned-class="' + escapeMarkup(item.id) + '">' + icon("users-round") +
        '<div><small>Classe affectée</small><strong>' + escapeMarkup(item.name) + '</strong><span>' + escapeMarkup(item.cycle + " · Salle " + item.room) + '</span></div></article>';
    }).join("");
    var subjectCards = projection.subjects.map(function (item) {
      var classNames = item.classIds.map(function (classId) {
        var found = projection.classes.find(function (classItem) { return classItem.id === classId; });
        return found ? found.name : "";
      }).filter(Boolean).join(", ");
      return '<article class="teacher-scope-card" data-assigned-subject="' + escapeMarkup(item.id) + '">' + icon("book-open") +
        '<div><small>Matière affectée</small><strong>' + escapeMarkup(item.name) + '</strong><span>' + escapeMarkup(classNames) + '</span></div></article>';
    }).join("");
    var attentionRows = projection.students.map(function (student) {
      var classItem = projection.classes.find(function (item) { return item.id === student.classId; });
      return '<li><span>' + escapeMarkup(student.name) + '</span><small>' + escapeMarkup((classItem ? classItem.name : "") + " · " + student.attention) + '</small></li>';
    }).join("");

    container.innerHTML = '<div class="teacher-pedagogy-shell">' +
      '<header class="teacher-hero"><div><p class="teacher-eyebrow">Espace Enseignant · démonstration locale</p><h1>Mon espace pédagogique</h1>' +
      '<p>Classes et matières limitées aux affectations autorisées.</p></div><span class="teacher-boundary">assigned_classes + assigned_subjects</span></header>' +
      '<section class="teacher-priority-grid" aria-label="Priorités pédagogiques">' +
        dashboardCard("Cours du jour", "3 séances", "1re A et 2e B", "calendar-clock", "schedule", "FEATURE_LATER") +
        dashboardCard("Devoirs", "2 à préparer", "4 remises à corriger", "notebook-pen", "assignments") +
        dashboardCard("Évaluations", "1 planifiée", "6 notes à compléter", "star", "evaluations") +
        dashboardCard("Difficultés", "2 élèves", "Suivi pédagogique", "triangle-alert", "difficulties") +
        dashboardCard("Rattrapages", "1 proposition", "Pédagogie uniquement", "life-buoy", "remediation") +
        dashboardCard("Notifications", "2 utiles", "Direction et calendrier", "bell-ring", "notifications", "FEATURE_LATER") +
      '</section>' +
      '<div class="teacher-dashboard-columns"><section class="teacher-panel"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Périmètre actif</p><h2>Mes affectations</h2></div><span>ACCÈS LIMITÉ</span></div>' +
        '<div class="teacher-scope-grid">' + (classCards || '<p class="teacher-empty">Aucune classe affectée.</p>') + (subjectCards || '<p class="teacher-empty">Aucune matière affectée.</p>') + '</div></section>' +
        '<section class="teacher-panel"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Élèves actifs</p><h2>À suivre</h2></div><span>drafts exclus</span></div>' +
        '<ul class="teacher-attention-list">' + (attentionRows || '<li><span>Aucun élève actif autorisé</span></li>') + '</ul></section></div>' +
      '<aside class="teacher-honesty-note">' + icon("cloud-off") + '<div><strong>Données de démonstration</strong><p>Aucune publication officielle ni écriture serveur. Les fonctions non disponibles sont indiquées FEATURE_LATER ou BACKEND_LATER.</p></div></aside>' +
      '<section class="teacher-feature-state" data-teacher-feature-state hidden></section>' +
    '</div>';

    container.querySelectorAll("[data-teacher-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-teacher-open");
        var state = container.querySelector("[data-teacher-feature-state]");
        if (!state) return;
        state.hidden = false;
        state.innerHTML = '<p class="teacher-eyebrow">Navigation Phase D</p><h2>' + escapeMarkup(button.textContent.trim()) +
          '</h2><span>' + (target === "schedule" || target === "notifications" ? "FEATURE_LATER" : "Disponible dans un lot Phase D suivant") + '</span>';
      });
    });
  }

  function clear() {
    activeContainerId = null;
    activeUser = null;
  }

  function render(containerId, user) {
    var container = document.getElementById(containerId);
    if (!container) return;
    activeContainerId = containerId;
    activeUser = user || {};
    var projection = getAssignedProjection(activeUser);
    if (!projection.allowed) renderDenied(container);
    else renderDashboard(container, projection);
    if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
  }

  root.SchoolSafeTeacherPedagogy = {
    CLASSES: CLASSES,
    SUBJECTS: SUBJECTS,
    STUDENTS: STUDENTS,
    getAssignedProjection: getAssignedProjection,
    clear: clear,
    render: render
  };
}(window));
