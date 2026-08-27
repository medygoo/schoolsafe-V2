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

  var ASSIGNMENT_STORAGE_KEY = "schoolsafe-v2-teacher-assignment-drafts";
  var ASSIGNMENTS = [
    { id: "demo-assignment-fractions", title: "Fractions équivalentes", classId: "demo-class-1", subjectId: "demo-subject-math", instructions: "Résoudre les exercices 1 à 5.", publishOn: "2026-09-01", dueOn: "2026-09-08", workType: "Devoir", status: "PUBLIÉ", local: false },
    { id: "demo-assignment-reading", title: "Lecture expressive", classId: "demo-class-2", subjectId: "demo-subject-french", instructions: "Préparer une lecture de deux minutes.", publishOn: "2026-09-02", dueOn: "2026-09-09", workType: "Travail individuel", status: "À PUBLIER", local: true },
    { id: "demo-assignment-foreign", title: "Forces et mouvements", classId: "demo-class-foreign", subjectId: "demo-subject-physics", instructions: "Hors périmètre.", publishOn: "2026-09-01", dueOn: "2026-09-08", workType: "TP", status: "BROUILLON", local: false }
  ];
  var EVALUATION_STORAGE_KEY = "schoolsafe-v2-teacher-evaluation-drafts";
  var GRADE_STORAGE_KEY = "schoolsafe-v2-teacher-grade-drafts";
  var EVALUATIONS = [
    { id: "demo-evaluation-calcul", title: "Calcul mental", classId: "demo-class-1", subjectId: "demo-subject-math", type: "interrogation", date: "2026-09-05", scale: 10, coefficient: 1, instructions: "Calculs rapides sans calculatrice.", status: "BROUILLON", local: true },
    { id: "demo-evaluation-redaction", title: "Rédaction descriptive", classId: "demo-class-2", subjectId: "demo-subject-french", type: "devoir", date: "2026-09-06", scale: 20, coefficient: 1, instructions: "Décrire un lieu familier.", status: "À PRÉPARER", local: true },
    { id: "demo-evaluation-foreign", title: "Mécanique", classId: "demo-class-foreign", subjectId: "demo-subject-physics", type: "TP", date: "2026-09-07", scale: 20, coefficient: 2, instructions: "Hors périmètre.", status: "BROUILLON", local: false }
  ];
  var APPRECIATION_STORAGE_KEY = "schoolsafe-v2-teacher-appreciation-drafts";
  var RESULT_SUMMARIES = [
    { classId: "demo-class-1", subjectId: "demo-subject-math", monthlyAverage: "13,8 / 20", termAverage: "13,2 / 20", coverage: "82 %", source: "Devoirs · interrogations" },
    { classId: "demo-class-2", subjectId: "demo-subject-french", monthlyAverage: "12,6 / 20", termAverage: "12,9 / 20", coverage: "76 %", source: "Devoirs · travaux" },
    { classId: "demo-class-foreign", subjectId: "demo-subject-physics", monthlyAverage: "15,1 / 20", termAverage: "14,7 / 20", coverage: "91 %", source: "TP · examens" }
  ];
  var RANKING_SCORES = [
    { studentId: "demo-student-chloe", name: "Chloé Bernard", classId: "demo-class-1", score: 16.2 },
    { studentId: "demo-student-lucas", name: "Lucas Martin", classId: "demo-class-1", score: 14.8 },
    { studentId: "demo-student-ethan", name: "Ethan Leroy", classId: "demo-class-2", score: 13.6 },
    { studentId: "demo-student-foreign", name: "Noah Kasongo", classId: "demo-class-foreign", score: 17.4 }
  ];

  var activeContainerId = null;
  var activeUser = null;
  var activeView = "dashboard";
  var selectedEvaluationId = null;
  var resultsPeriod = "monthly";

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

  function storageGet(key) {
    try { return root.localStorage.getItem(key); } catch (error) { return null; }
  }

  function storageSet(key, value) {
    try { root.localStorage.setItem(key, value); } catch (error) {}
  }

  function readAssignmentDrafts() {
    try {
      var parsed = JSON.parse(storageGet(ASSIGNMENT_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) { return []; }
  }

  function saveAssignmentDrafts(items) {
    storageSet(ASSIGNMENT_STORAGE_KEY, JSON.stringify(items));
  }

  function readJson(key, fallback) {
    try {
      var parsed = JSON.parse(storageGet(key) || "null");
      return parsed == null ? fallback : parsed;
    } catch (error) { return fallback; }
  }

  function readEvaluationDrafts() {
    var items = readJson(EVALUATION_STORAGE_KEY, []);
    return Array.isArray(items) ? items : [];
  }

  function saveEvaluationDrafts(items) {
    storageSet(EVALUATION_STORAGE_KEY, JSON.stringify(items));
  }

  function readGradeDrafts() {
    var drafts = readJson(GRADE_STORAGE_KEY, {});
    return drafts && typeof drafts === "object" && !Array.isArray(drafts) ? drafts : {};
  }

  function saveGradeDrafts(drafts) {
    storageSet(GRADE_STORAGE_KEY, JSON.stringify(drafts));
  }

  function readAppreciationDrafts() {
    var items = readJson(APPRECIATION_STORAGE_KEY, []);
    return Array.isArray(items) ? items : [];
  }

  function saveAppreciationDrafts(items) {
    storageSet(APPRECIATION_STORAGE_KEY, JSON.stringify(items));
  }

  function labelFor(items, id) {
    var found = items.find(function (item) { return item.id === id; });
    return found ? found.name : "Indisponible";
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
    activeView = "dashboard";
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
        if (target === "assignments") {
          open("assignments");
          return;
        }
        if (target === "evaluations") {
          open("evaluations");
          return;
        }
        var state = container.querySelector("[data-teacher-feature-state]");
        if (!state) return;
        state.hidden = false;
        state.innerHTML = '<p class="teacher-eyebrow">Navigation Phase D</p><h2>' + escapeMarkup(button.textContent.trim()) +
          '</h2><span>' + (target === "schedule" || target === "notifications" ? "FEATURE_LATER" : "Disponible dans un lot Phase D suivant") + '</span>';
      });
    });
  }

  function assignmentCard(item) {
    var statusLabel = item.status === "PUBLIÉ" ? "PUBLIÉ · APERÇU" : item.status;
    return '<article class="teacher-record-card" data-assignment-id="' + escapeMarkup(item.id) + '"><header><div><p class="teacher-eyebrow">' +
      escapeMarkup(labelFor(CLASSES, item.classId) + " · " + labelFor(SUBJECTS, item.subjectId)) + '</p><h3>' + escapeMarkup(item.title) +
      '</h3></div><span class="teacher-status">' + escapeMarkup(statusLabel) + '</span></header><p>' + escapeMarkup(item.instructions) +
      '</p><dl><div><dt>Publication prévue</dt><dd>' + escapeMarkup(item.publishOn || "À planifier") + '</dd></div><div><dt>Date limite</dt><dd>' +
      escapeMarkup(item.dueOn || "À planifier") + '</dd></div><div><dt>Type</dt><dd>' + escapeMarkup(item.workType) + '</dd></div></dl>' +
      (item.local ? '<footer><b>BROUILLON LOCAL</b><span>BACKEND_LATER</span></footer>' : '<footer><span>APERÇU DE DÉMONSTRATION</span><span>BACKEND_LATER</span></footer>') + '</article>';
  }

  function renderAssignmentForm(projection) {
    if (!allowsScope(activeUser, "pedagogy.assignment.manage", "assigned_classes")) {
      return '<aside class="teacher-access-note teacher-access-note--denied"><strong>Préparation non autorisée</strong><p>La permission pedagogy.assignment.manage est absente ou refusée par un DENY explicite.</p></aside>';
    }
    var classOptions = projection.classes.map(function (item) { return '<option value="' + escapeMarkup(item.id) + '">' + escapeMarkup(item.name) + '</option>'; }).join("");
    var subjectOptions = projection.subjects.map(function (item) { return '<option value="' + escapeMarkup(item.id) + '">' + escapeMarkup(item.name) + '</option>'; }).join("");
    return '<form class="teacher-form" id="teacherAssignmentForm"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Préparation locale</p><h2>Nouveau devoir</h2></div><span>BROUILLON LOCAL</span></div>' +
      '<div class="teacher-form-grid"><label><span>Titre</span><input name="title" required maxlength="120"></label>' +
      '<label><span>Classe</span><select name="classId" required>' + classOptions + '</select></label>' +
      '<label><span>Matière</span><select name="subjectId" required>' + subjectOptions + '</select></label>' +
      '<label><span>Type de travail</span><select name="workType"><option>Devoir</option><option>Travail individuel</option><option>Travail de groupe</option><option>TP</option></select></label>' +
      '<label><span>Publication prévue</span><input name="publishOn" type="date"></label><label><span>Date limite</span><input name="dueOn" type="date" required></label>' +
      '<label><span>Statut</span><select name="status"><option>BROUILLON</option><option>À PUBLIER</option><option>PUBLIÉ</option><option>TERMINÉ</option></select></label>' +
      '<label><span>Pièce/document futur</span><input name="attachmentNote" placeholder="BACKEND_LATER"></label>' +
      '<label class="teacher-form-wide"><span>Consigne</span><textarea name="instructions" rows="4" required></textarea></label></div>' +
      '<aside class="teacher-access-note"><strong>Publication officielle indisponible</strong><p>Même le statut PUBLIÉ reste un aperçu local tant que le backend est absent — BACKEND_LATER.</p></aside>' +
      '<button class="ss-button" type="submit"><i data-lucide="save"></i> Enregistrer la préparation</button></form>';
  }

  function renderAssignments(container, projection) {
    activeView = "assignments";
    if (!allowsScope(activeUser, "pedagogy.assignment.read", "assigned_classes")) {
      renderDenied(container);
      return;
    }
    var classIds = projection.classes.map(function (item) { return item.id; });
    var subjectIds = projection.subjects.map(function (item) { return item.id; });
    var items = ASSIGNMENTS.concat(readAssignmentDrafts()).filter(function (item) {
      return classIds.indexOf(item.classId) >= 0 && subjectIds.indexOf(item.subjectId) >= 0;
    });
    container.innerHTML = '<div class="teacher-pedagogy-shell"><header class="teacher-workspace-header"><button class="ss-button ss-button--secondary" type="button" data-teacher-back>' + icon("arrow-left") + ' Tableau de bord</button>' +
      '<div><p class="teacher-eyebrow">D2 · Devoirs / travaux / remises</p><h1>Devoirs de mes affectations</h1><p>Préparation locale uniquement, sans publication serveur.</p></div><span class="teacher-boundary">BACKEND_LATER</span></header>' +
      '<div class="teacher-workspace-grid"><section class="teacher-panel"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Classes et matières autorisées</p><h2>Travaux préparés</h2></div><span>' + items.length + ' élément(s)</span></div>' +
      '<div class="teacher-record-list" data-assignment-list>' + (items.length ? items.map(assignmentCard).join("") : '<p class="teacher-empty">Aucun devoir dans ce périmètre.</p>') + '</div></section>' +
      '<section class="teacher-panel">' + renderAssignmentForm(projection) + '</section></div>' +
      '<aside class="teacher-honesty-note" data-submissions-state>' + icon("inbox") + '<div><strong>Remises et corrections · BACKEND_LATER</strong><p>Aucune remise serveur inventée. Les statuts réels seront consultables lorsque la projection backend existera.</p></div></aside></div>';

    var back = container.querySelector("[data-teacher-back]");
    if (back) back.addEventListener("click", function () { render(activeContainerId, activeUser); });
    var form = container.querySelector("#teacherAssignmentForm");
    if (form) form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var classId = String(data.get("classId") || "");
      var subjectId = String(data.get("subjectId") || "");
      var subject = projection.subjects.find(function (item) { return item.id === subjectId; });
      if (!subject || subject.classIds.indexOf(classId) < 0) {
        var note = form.querySelector(".teacher-access-note");
        if (note) note.innerHTML = '<strong>Couple classe / matière refusé</strong><p>La matière doit être affectée à la classe choisie.</p>';
        return;
      }
      var drafts = readAssignmentDrafts();
      drafts.unshift({
        id: "teacher-assignment-" + Date.now(),
        title: String(data.get("title") || ""),
        classId: classId,
        subjectId: subjectId,
        instructions: String(data.get("instructions") || ""),
        publishOn: String(data.get("publishOn") || ""),
        dueOn: String(data.get("dueOn") || ""),
        workType: String(data.get("workType") || "Devoir"),
        attachmentNote: String(data.get("attachmentNote") || ""),
        status: String(data.get("status") || "BROUILLON"),
        local: true
      });
      saveAssignmentDrafts(drafts);
      renderAssignments(container, projection);
    });
  }

  function evaluationCard(item) {
    return '<article class="teacher-record-card" data-evaluation-id="' + escapeMarkup(item.id) + '"><header><div><p class="teacher-eyebrow">' +
      escapeMarkup(labelFor(CLASSES, item.classId) + " · " + labelFor(SUBJECTS, item.subjectId)) + '</p><h3>' + escapeMarkup(item.title) +
      '</h3></div><span class="teacher-status">' + escapeMarkup(item.status) + '</span></header><p>' + escapeMarkup(item.instructions) +
      '</p><dl><div><dt>Type</dt><dd>' + escapeMarkup(item.type) + '</dd></div><div><dt>Date</dt><dd>' + escapeMarkup(item.date) +
      '</dd></div><div><dt>Barème</dt><dd>/' + escapeMarkup(item.scale) + ' · coef. ' + escapeMarkup(item.coefficient) + '</dd></div></dl>' +
      '<footer><b>BROUILLON LOCAL</b><span>BACKEND_LATER</span></footer></article>';
  }

  function renderEvaluationForm(projection) {
    var classOptions = projection.classes.map(function (item) { return '<option value="' + escapeMarkup(item.id) + '">' + escapeMarkup(item.name) + '</option>'; }).join("");
    var subjectOptions = projection.subjects.map(function (item) { return '<option value="' + escapeMarkup(item.id) + '">' + escapeMarkup(item.name) + '</option>'; }).join("");
    return '<form class="teacher-form" id="teacherEvaluationForm"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Préparation locale</p><h2>Nouvelle évaluation</h2></div><span>BACKEND_LATER</span></div>' +
      '<div class="teacher-form-grid"><label><span>Titre</span><input name="title" required maxlength="120"></label>' +
      '<label><span>Classe</span><select name="classId" required>' + classOptions + '</select></label><label><span>Matière</span><select name="subjectId" required>' + subjectOptions + '</select></label>' +
      '<label><span>Type</span><select name="type"><option value="devoir">Devoir</option><option value="interrogation">Interrogation</option><option value="TP">TP</option><option value="examen">Examen</option><option value="autre">Autre</option></select></label>' +
      '<label><span>Date</span><input name="date" type="date" required></label><label><span>Barème</span><input name="scale" type="number" min="1" max="100" value="20" required></label>' +
      '<label><span>Coefficient</span><input name="coefficient" type="number" min="0.1" max="10" step="0.1" value="1"></label><label><span>Statut</span><select name="status"><option>BROUILLON</option><option>À PRÉPARER</option><option>TERMINÉ</option></select></label>' +
      '<label class="teacher-form-wide"><span>Consigne</span><textarea name="instructions" rows="3" required></textarea></label></div>' +
      '<button class="ss-button" type="submit">' + icon("save") + ' Enregistrer l’évaluation</button></form>';
  }

  function gradeRow(student, saved) {
    saved = saved || {};
    return '<fieldset class="teacher-grade-row" data-grade-student="' + escapeMarkup(student.id) + '"><legend>' + escapeMarkup(student.name) + '</legend>' +
      '<label><span>Valeur</span><input type="number" min="0" step="0.25" data-grade-value="' + escapeMarkup(student.id) + '" value="' + escapeMarkup(saved.value == null ? "" : saved.value) + '"></label>' +
      '<label class="teacher-check"><input type="checkbox" data-grade-absent="' + escapeMarkup(student.id) + '"' + (saved.absent ? " checked" : "") + '><span>Absent</span></label>' +
      '<label class="teacher-check"><input type="checkbox" data-grade-unmarked="' + escapeMarkup(student.id) + '"' + (saved.unmarked ? " checked" : "") + '><span>Non noté</span></label>' +
      '<label><span>Observation</span><input data-grade-observation="' + escapeMarkup(student.id) + '" value="' + escapeMarkup(saved.observation || "") + '"></label></fieldset>';
  }

  function renderGradebook(projection, evaluations) {
    var selected = evaluations.find(function (item) { return item.id === selectedEvaluationId; }) || evaluations[0];
    if (!selected) return '<p class="teacher-empty">Préparez une évaluation pour ouvrir la saisie locale.</p>';
    selectedEvaluationId = selected.id;
    var options = evaluations.map(function (item) { return '<option value="' + escapeMarkup(item.id) + '"' + (item.id === selected.id ? " selected" : "") + '>' + escapeMarkup(item.title) + '</option>'; }).join("");
    var savedByEvaluation = readGradeDrafts()[selected.id] || {};
    var students = projection.students.filter(function (item) { return item.classId === selected.classId && item.lifecycleStatus === "active"; });
    return '<form class="teacher-form" id="teacherGradebookForm"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Saisie frontend</p><h2>Notes en préparation</h2></div><span>NON PUBLIÉ · BACKEND_LATER</span></div>' +
      '<label><span>Évaluation</span><select id="teacherEvaluationSelect">' + options + '</select></label><div class="teacher-grade-list">' +
      students.map(function (student) { return gradeRow(student, savedByEvaluation[student.id]); }).join("") + '</div>' +
      '<button class="ss-button" type="submit">' + icon("save") + ' Sauvegarder les notes locales</button></form>';
  }

  function renderEvaluations(container, projection) {
    activeView = "evaluations";
    if (!allowsScope(activeUser, "pedagogy.grade.read", "assigned_classes")) {
      renderDenied(container);
      return;
    }
    var classIds = projection.classes.map(function (item) { return item.id; });
    var subjectIds = projection.subjects.map(function (item) { return item.id; });
    var evaluations = EVALUATIONS.concat(readEvaluationDrafts()).filter(function (item) {
      return classIds.indexOf(item.classId) >= 0 && subjectIds.indexOf(item.subjectId) >= 0;
    });
    var canManage = allowsScope(activeUser, "pedagogy.grade.manage", "assigned_classes");
    var controls = canManage ? '<div class="teacher-workspace-grid"><section class="teacher-panel">' + renderEvaluationForm(projection) + '</section><section class="teacher-panel">' + renderGradebook(projection, evaluations) + '</section></div>' :
      '<aside class="teacher-access-note teacher-access-note--denied"><strong>Modification des notes refusée</strong><p>Le DENY explicite ou l’absence de pedagogy.grade.manage interdit toute préparation.</p></aside>';
    container.innerHTML = '<div class="teacher-pedagogy-shell"><header class="teacher-workspace-header"><button class="ss-button ss-button--secondary" type="button" data-teacher-back>' + icon("arrow-left") + ' Tableau de bord</button>' +
      '<div><p class="teacher-eyebrow">D3 · Évaluations et notes</p><h1>Évaluations de mes classes</h1><p>Saisie locale, jamais une publication officielle.</p></div><span class="teacher-boundary">BACKEND_LATER</span></header>' +
      '<section class="teacher-panel"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Périmètre affecté</p><h2>Évaluations préparées</h2></div><span>' + evaluations.length + ' élément(s)</span></div>' +
      '<div class="teacher-record-list" data-evaluation-list>' + evaluations.map(evaluationCard).join("") + '</div></section>' + controls + '</div>';
    var back = container.querySelector("[data-teacher-back]");
    if (back) back.addEventListener("click", function () { render(activeContainerId, activeUser); });
    var evaluationForm = container.querySelector("#teacherEvaluationForm");
    if (evaluationForm) evaluationForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!evaluationForm.reportValidity()) return;
      var data = new FormData(evaluationForm);
      var classId = String(data.get("classId") || "");
      var subjectId = String(data.get("subjectId") || "");
      var subject = projection.subjects.find(function (item) { return item.id === subjectId; });
      if (!subject || subject.classIds.indexOf(classId) < 0) return;
      var drafts = readEvaluationDrafts();
      var item = { id: "teacher-evaluation-" + Date.now(), title: String(data.get("title") || ""), classId: classId, subjectId: subjectId, type: String(data.get("type") || "devoir"), date: String(data.get("date") || ""), scale: Number(data.get("scale") || 20), coefficient: Number(data.get("coefficient") || 1), instructions: String(data.get("instructions") || ""), status: String(data.get("status") || "BROUILLON"), local: true };
      drafts.unshift(item);
      selectedEvaluationId = item.id;
      saveEvaluationDrafts(drafts);
      renderEvaluations(container, projection);
    });
    var evaluationSelect = container.querySelector("#teacherEvaluationSelect");
    if (evaluationSelect) evaluationSelect.addEventListener("change", function () { selectedEvaluationId = evaluationSelect.value; renderEvaluations(container, projection); });
    container.querySelectorAll("[data-grade-absent], [data-grade-unmarked]").forEach(function (control) {
      control.addEventListener("change", function () {
        var studentId = control.getAttribute(control.hasAttribute("data-grade-absent") ? "data-grade-absent" : "data-grade-unmarked");
        var row = container.querySelector('[data-grade-student="' + studentId + '"]');
        if (!row || !control.checked) return;
        var other = row.querySelector(control.hasAttribute("data-grade-absent") ? "[data-grade-unmarked]" : "[data-grade-absent]");
        var value = row.querySelector("[data-grade-value]");
        if (other) other.checked = false;
        if (value) value.value = "";
      });
    });
    var gradebook = container.querySelector("#teacherGradebookForm");
    if (gradebook) gradebook.addEventListener("submit", function (event) {
      event.preventDefault();
      var evaluation = evaluations.find(function (item) { return item.id === selectedEvaluationId; });
      if (!evaluation) return;
      var drafts = readGradeDrafts();
      drafts[evaluation.id] = {};
      gradebook.querySelectorAll("[data-grade-student]").forEach(function (row) {
        var studentId = row.getAttribute("data-grade-student");
        var rawValue = row.querySelector("[data-grade-value]").value;
        var value = rawValue === "" ? null : Number(rawValue);
        if (value != null && (value < 0 || value > evaluation.scale)) return;
        drafts[evaluation.id][studentId] = { value: value, absent: row.querySelector("[data-grade-absent]").checked, unmarked: row.querySelector("[data-grade-unmarked]").checked, observation: row.querySelector("[data-grade-observation]").value };
      });
      saveGradeDrafts(drafts);
      renderEvaluations(container, projection);
    });
  }

  function renderRanking(title, scope, rows) {
    var content = rows.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 10).map(function (item, index) {
      return '<li><b>' + (index + 1) + '</b><span>' + escapeMarkup(item.name) + '<small>' + escapeMarkup(labelFor(CLASSES, item.classId)) + '</small></span><strong>' + escapeMarkup(item.score.toFixed(1)) + '</strong></li>';
    }).join("");
    return '<section class="teacher-panel teacher-ranking" data-ranking-scope="' + scope + '"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Classement calculé</p><h2>' + escapeMarkup(title) + '</h2></div><span>lecture seule</span></div><ol>' + content + '</ol><p class="teacher-demo-caption">Sources compatibles de démonstration : devoirs, interrogations, TP et autres évaluations. Aucun classement officiel n’est calculé.</p></section>';
  }

  function renderResults(container, projection) {
    activeView = "results";
    if (!allowsScope(activeUser, "pedagogy.grade.read", "assigned_classes")) {
      renderDenied(container);
      return;
    }
    var classIds = projection.classes.map(function (item) { return item.id; });
    var subjectIds = projection.subjects.map(function (item) { return item.id; });
    var summaries = RESULT_SUMMARIES.filter(function (item) { return classIds.indexOf(item.classId) >= 0 && subjectIds.indexOf(item.subjectId) >= 0; });
    var summaryCards = summaries.map(function (item) {
      return '<article class="teacher-result-card"><p class="teacher-eyebrow">' + escapeMarkup(labelFor(CLASSES, item.classId)) + '</p><h3>' + escapeMarkup(labelFor(SUBJECTS, item.subjectId)) + '</h3>' +
        '<strong>' + escapeMarkup(resultsPeriod === "monthly" ? item.monthlyAverage : item.termAverage) + '</strong><span>Couverture des notes : ' + escapeMarkup(item.coverage) + '</span><small>' + escapeMarkup(item.source) + '</small></article>';
    }).join("");
    var classRows = RANKING_SCORES.filter(function (item) { return classIds.indexOf(item.classId) >= 0; });
    var canSeeSchoolRanking = allowsScope(activeUser, "palmarques.read", "school");
    var schoolRanking = canSeeSchoolRanking ? renderRanking("Top 10 école", "school", RANKING_SCORES) : '<aside class="teacher-access-note"><strong>Top école non autorisé</strong><p>La permission palmarques.read avec scope school est nécessaire; aucun scope school n’est accordé automatiquement.</p></aside>';
    var appreciations = readAppreciationDrafts().filter(function (item) { return classIds.indexOf(item.classId) >= 0; });
    var appreciationRows = appreciations.map(function (item) { return '<li><strong>' + escapeMarkup(item.studentName) + '</strong><span>' + escapeMarkup(item.text) + '</span><small>BROUILLON LOCAL</small></li>'; }).join("");
    var studentOptions = projection.students.map(function (student) { return '<option value="' + escapeMarkup(student.id) + '">' + escapeMarkup(student.name) + '</option>'; }).join("");
    var appreciationForm = allowsScope(activeUser, "pedagogy.grade.manage", "assigned_classes") ? '<form class="teacher-form" id="teacherAppreciationForm"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Appréciation</p><h2>Préparer une appréciation</h2></div><span>BROUILLON LOCAL</span></div><label><span>Élève actif</span><select name="studentId">' + studentOptions + '</select></label><label><span>Texte</span><textarea name="text" rows="3" required></textarea></label><button class="ss-button" type="submit">' + icon("save") + ' Enregistrer localement</button></form>' : '<p>Préparation non autorisée.</p>';

    container.innerHTML = '<div class="teacher-pedagogy-shell"><header class="teacher-workspace-header"><button class="ss-button ss-button--secondary" type="button" data-teacher-back>' + icon("arrow-left") + ' Tableau de bord</button>' +
      '<div><p class="teacher-eyebrow">D4 · Résultats / bulletins / palmarès</p><h1>Résultats et moyennes</h1><p>DONNÉES DE DÉMONSTRATION · aucun calcul officiel.</p></div><span class="teacher-boundary">BACKEND_LATER</span></header>' +
      '<nav class="teacher-period-tabs" aria-label="Période"><button type="button" data-results-period="monthly"' + (resultsPeriod === "monthly" ? ' class="active"' : "") + '>Mensuel</button><button type="button" data-results-period="term"' + (resultsPeriod === "term" ? ' class="active"' : "") + '>Trimestriel</button></nav>' +
      '<section class="teacher-panel"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Synthèse par matière</p><h2>Moyennes de démonstration</h2></div><span>NON OFFICIEL</span></div><div class="teacher-result-grid">' + summaryCards + '</div></section>' +
      '<div class="teacher-workspace-grid">' + renderRanking("Top 10 classe", "class", classRows) + schoolRanking + '</div>' +
      '<section class="teacher-panel" data-bulletin-preview><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Aperçu uniquement</p><h2>Bulletin en préparation</h2></div><span>BACKEND_LATER</span></div><p>Le Bulletin officiel et sa publication restent une fonction serveur future. Cet aperçu reprend seulement les synthèses visibles du périmètre affecté.</p></section>' +
      '<div class="teacher-workspace-grid"><section class="teacher-panel">' + appreciationForm + '</section><section class="teacher-panel"><div class="teacher-section-heading"><div><p class="teacher-eyebrow">Historique local</p><h2>Appréciations préparées</h2></div></div><ul class="teacher-appreciation-list" data-appreciation-list>' + (appreciationRows || '<li>Aucune appréciation préparée.</li>') + '</ul></section></div></div>';
    var back = container.querySelector("[data-teacher-back]");
    if (back) back.addEventListener("click", function () { render(activeContainerId, activeUser); });
    container.querySelectorAll("[data-results-period]").forEach(function (button) { button.addEventListener("click", function () { resultsPeriod = button.getAttribute("data-results-period"); renderResults(container, projection); }); });
    var form = container.querySelector("#teacherAppreciationForm");
    if (form) form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var student = projection.students.find(function (item) { return item.id === String(data.get("studentId") || ""); });
      if (!student || student.lifecycleStatus !== "active") return;
      var items = readAppreciationDrafts();
      items.unshift({ id: "teacher-appreciation-" + Date.now(), studentId: student.id, studentName: student.name, classId: student.classId, text: String(data.get("text") || "") });
      saveAppreciationDrafts(items);
      renderResults(container, projection);
    });
  }

  function open(view) {
    var container = document.getElementById(activeContainerId || "teacherPedagogyPortal");
    if (!container || !activeUser) return false;
    var projection = getAssignedProjection(activeUser);
    if (!projection.allowed) {
      renderDenied(container);
      return false;
    }
    if (view === "assignments") renderAssignments(container, projection);
    else if (view === "evaluations") renderEvaluations(container, projection);
    else if (view === "results") renderResults(container, projection);
    else renderDashboard(container, projection);
    if (root.lucide && root.lucide.createIcons) root.lucide.createIcons();
    return true;
  }

  function clear() {
    activeContainerId = null;
    activeUser = null;
    activeView = "dashboard";
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
    readAssignmentDrafts: readAssignmentDrafts,
    readEvaluationDrafts: readEvaluationDrafts,
    readGradeDrafts: readGradeDrafts,
    readAppreciationDrafts: readAppreciationDrafts,
    open: open,
    clear: clear,
    render: render
  };
}(window));
