(function (global) {
  "use strict";

  var state = {
    activeTab: "subjects",
    subjects: [],
    classes: [],
    students: [],
    teacherAssignments: [],
    assignments: [],
    lessonPlans: [],
    profiles: [],
    selectedAssignmentId: null,
    selectedLessonPlanId: null,
    assignmentStudents: [],
    assignmentGrades: [],
    gradeDrafts: {},
    loading: false,
    error: null,
  };

  function escapeMarkup(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notify(message) {
    if (global.SchoolSafeApp && global.SchoolSafeApp.notify) {
      global.SchoolSafeApp.notify(message);
    } else {
      window.dispatchEvent(new CustomEvent("schoolsafe-toast", { detail: { message: message } }));
    }
  }

  function refreshIcons() {
    if (global.lucide && global.lucide.createIcons) {
      try { global.lucide.createIcons(); } catch (e) {}
    }
  }

  async function loadAll() {
    state.loading = true;
    state.error = null;
    render();
    try {
      var results = await Promise.all([
        global.SchoolSafePedagogyAPI.listClasses(),
        global.SchoolSafePedagogyAPI.listSubjects(),
        global.SchoolSafePedagogyAPI.listAssignments(),
        global.SchoolSafePedagogyAPI.listLessonPlans(),
        global.SchoolSafePedagogyAPI.listTeacherAssignments(),
      ]);
      state.classes = results[0] || [];
      state.subjects = results[1] || [];
      state.assignments = results[2] || [];
      state.lessonPlans = results[3] || [];
      state.teacherAssignments = results[4] || [];
      if (state.selectedAssignmentId) {
        await loadAssignmentStudentsAndGrades(state.selectedAssignmentId);
      }
    } catch (e) {
      state.error = e.message || "Erreur de chargement";
      notify(state.error);
    }
    state.loading = false;
    render();
  }

  async function loadAssignmentStudentsAndGrades(assignmentId) {
    var assignment = state.assignments.find(function (a) { return a.id === assignmentId; });
    if (!assignment || !assignment.class_id) {
      state.assignmentStudents = [];
      state.assignmentGrades = [];
      state.gradeDrafts = {};
      return;
    }
    try {
      var results = await Promise.all([
        global.SchoolSafeSchoolAPI.listStudentsByClass(assignment.class_id),
        global.SchoolSafePedagogyAPI.getAssignmentGrades(assignmentId),
      ]);
      state.assignmentStudents = results[0] || [];
      state.assignmentGrades = results[1] || [];
      state.gradeDrafts = {};
    } catch (e) {
      notify(e.message || "Erreur de chargement des élèves/cotes");
      state.assignmentStudents = [];
      state.assignmentGrades = [];
      state.gradeDrafts = {};
    }
  }

  function getExistingGrade(studentId) {
    return state.assignmentGrades.find(function (g) { return g.student_id === studentId; });
  }

  function getGradeValue(studentId) {
    if (state.gradeDrafts[studentId] && state.gradeDrafts[studentId].value !== undefined) {
      return state.gradeDrafts[studentId].value;
    }
    var existing = getExistingGrade(studentId);
    if (!existing) return "";
    return existing.value_numeric !== null && existing.value_numeric !== undefined
      ? String(existing.value_numeric)
      : (existing.value_text || "");
  }

  async function submitGrades(assignmentId, publish) {
    var assignment = state.assignments.find(function (a) { return a.id === assignmentId; });
    if (!assignment) return;

    var grades = [];
    for (var i = 0; i < state.assignmentStudents.length; i++) {
      var student = state.assignmentStudents[i];
      var draft = state.gradeDrafts[student.id] || {};
      var existing = getExistingGrade(student.id);
      var rawValue = draft.value !== undefined ? draft.value : getGradeValue(student.id);
      if (rawValue === "" && !existing) continue;
      if (rawValue === "" && existing) continue;

      var grade = { student_id: student.id };
      if (assignment.scale_mode === "numeric") {
        grade.value_numeric = Number(rawValue);
        grade.normalized_value = Number(rawValue);
      } else {
        grade.value_text = String(rawValue);
      }
      if (draft.comment !== undefined) grade.comment = draft.comment;
      else if (existing && existing.comment) grade.comment = existing.comment;
      if (draft.change_reason !== undefined) grade.change_reason = draft.change_reason;
      else if (existing && existing.change_reason) grade.change_reason = existing.change_reason;
      if (publish) grade.status = "published";

      grades.push(grade);
    }

    try {
      await global.SchoolSafePedagogyAPI.saveGrades(assignmentId, grades);
      if (publish) {
        await global.SchoolSafePedagogyAPI.publishGrades(assignmentId);
        notify("Cotes publiées.");
      } else {
        notify("Cotes enregistrées.");
      }
      await loadAssignmentStudentsAndGrades(assignmentId);
      render();
    } catch (e) {
      notify(e.message || "Erreur d’enregistrement des cotes");
    }
  }

  function assignmentTypeLabel(type) {
    return { homework: "Devoir", quiz: "Interrogation", exam: "Examen", compensatory: "Activité compensatoire" }[type] || type;
  }

  function languageLabel(lang) {
    return lang === "EN" ? "Anglais" : "Français";
  }

  function renderTabs() {
    var tabs = [
      { key: "subjects", label: "Matières", icon: "book-open" },
      { key: "assignments", label: "Devoirs", icon: "notebook-pen" },
      { key: "lesson-plans", label: "Cahier de préparation", icon: "book-open-check" },
    ];
    return '<nav class="pedagogy-tabs" aria-label="Fonctions pédagogiques">' +
      tabs.map(function (tab) {
        return '<button class="' + (state.activeTab === tab.key ? "active" : "") + '" type="button" data-pedagogy-tab="' + tab.key + '"><i data-lucide="' + tab.icon + '"></i><span>' + tab.label + '</span></button>';
      }).join("") +
      '</nav>';
  }

  function renderSubjects() {
    var rows = state.subjects.map(function (s) {
      return '<tr><td><b>' + escapeMarkup(s.name) + '</b></td><td>' + escapeMarkup(s.code) + '</td><td>' + languageLabel(s.language) + '</td><td>' + escapeMarkup(s.cycle_key) + '</td><td>' + (s.subject_family_code ? escapeMarkup(s.subject_family_code) : "—") + '</td></tr>';
    }).join("");

    return '<section class="pedagogy-panel"><header class="panel-heading"><div><span>Référentiel</span><h3>Matières de l’école</h3></div><i data-lucide="book-open"></i></header>' +
      '<form class="pedagogy-form" id="subjectForm"><div class="pedagogy-form-grid compact">' +
      '<label>Code<input name="code" required placeholder="MATH"></label>' +
      '<label>Nom<input name="name" required placeholder="Mathématiques FR"></label>' +
      '<label>Langue<select name="language"><option value="FR">Français</option><option value="EN">Anglais</option></select></label>' +
      '<label>Cycle<select name="cycle_key"><option value="nursery">Maternelle</option><option value="primary">Primaire</option><option value="secondary">Secondaire</option></select></label>' +
      '<label>Famille (optionnel)<input name="subject_family_code" placeholder="MATH"></label>' +
      '</div><footer><button class="primary-button" type="submit"><i data-lucide="plus"></i> Ajouter la matière</button></footer></form>' +
      '<div class="table-scroll"><table class="grade-table"><thead><tr><th>Nom</th><th>Code</th><th>Langue</th><th>Cycle</th><th>Famille</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">Aucune matière enregistrée.</td></tr>') + '</tbody></table></div></section>';
  }

  function renderAssignments() {
    var selected = state.assignments.find(function (a) { return a.id === state.selectedAssignmentId; }) || state.assignments[0] || null;
    var list = state.assignments.map(function (a) {
      return '<button class="assignment-row' + (selected && selected.id === a.id ? " active" : "") + '" type="button" data-assignment-id="' + a.id + '"><span><b>' + escapeMarkup(a.title) + '</b><small>' + escapeMarkup((a.classes ? a.classes.name : a.class_id) + " · " + (a.subjects ? a.subjects.name : a.subject_id)) + '</small></span><span class="pedagogy-badge ' + (a.status === "published" ? "published" : "draft") + '">' + (a.status === "published" ? "Publié" : "Brouillon") + '</span></button>';
    }).join("");

    var detail = "";
    if (selected) {
      detail = '<article class="assignment-detail"><div><span class="subject-tag">' + escapeMarkup((selected.subjects ? selected.subjects.name : selected.subject_id) + " · " + selected.language) + '</span><h3>' + escapeMarkup(selected.title) + '</h3><p>' + escapeMarkup(selected.instructions || "Aucune consigne.") + '</p></div><dl>' +
        '<div><dt>Échéance</dt><dd>' + escapeMarkup(selected.due_date || "Non planifiée") + '</dd></div>' +
        '<div><dt>Barème</dt><dd>' + escapeMarkup(selected.scale_label || (selected.scale_max ? "/" + selected.scale_max : "Qualitatif")) + '</dd></div>' +
        '<div><dt>Coefficient</dt><dd>' + escapeMarkup(String(selected.coefficient || 1)) + '</dd></div>' +
        '<div><dt>Publication</dt><dd>' + (selected.status === "published" ? "Visible" : "Brouillon") + '</dd></div>' +
        '</dl><div class="assignment-detail-actions">' +
        (selected.status === "draft" ? '<button class="primary-button" type="button" data-publish-assignment="' + selected.id + '"><i data-lucide="send"></i> Publier le devoir</button>' : '') +
        '</div></article>';
    }

    var composer = '<form class="pedagogy-form assignment-composer" id="assignmentForm"><div class="form-section-title"><span><i data-lucide="file-pen-line"></i></span><div><h3>Composer un devoir</h3></div></div><div class="pedagogy-form-grid">' +
      '<label>Titre<input name="title" required placeholder="Titre du devoir"></label>' +
      '<label>Classe<select name="class_id" id="assignmentClassSelect">' + state.classes.map(function (c) { return '<option value="' + c.id + '">' + escapeMarkup(c.name) + '</option>'; }).join("") + '</select></label>' +
      '<label>Matière<select name="subject_id" id="assignmentSubjectSelect">' + state.subjects.map(function (s) { return '<option value="' + s.id + '">' + escapeMarkup(s.name) + '</option>'; }).join("") + '</select></label>' +
      '<label>Langue<select name="language"><option value="FR">Français</option><option value="EN">Anglais</option></select></label>' +
      '<label>Type<select name="type"><option value="homework">Devoir</option><option value="quiz">Interrogation</option><option value="exam">Examen</option><option value="compensatory">Activité compensatoire</option></select></label>' +
      '<label>Mode d’échelle<select name="scale_mode"><option value="numeric">Numérique</option><option value="qualitative">Qualitative</option><option value="custom">Libre</option></select></label>' +
      '<label>Barème max / libellé<input name="scale_label" placeholder="/20, %, Acquis…"></label>' +
      '<label>Coefficient<input name="coefficient" type="number" step="0.1" min="0" value="1"></label>' +
      '<label>Date de remise<input name="due_date" type="date"></label>' +
      '<label class="wide">Prérequis<textarea name="prerequisites" rows="2"></textarea></label>' +
      '<label class="wide">Consignes<textarea name="instructions" rows="3"></textarea></label>' +
      '</div><footer><button class="secondary-button" type="submit" data-draft="true"><i data-lucide="save"></i> Enregistrer en brouillon</button><button class="primary-button dark" type="submit" data-publish="true"><i data-lucide="send"></i> Publier</button></footer></form>';

    var gradingPanel = "";
    if (selected) {
      gradingPanel = renderGradingPanel(selected);
    }

    return '<div class="pedagogy-two-column assignment-layout"><section class="pedagogy-panel"><header class="panel-heading"><div><span>Travaux</span><h3>Devoirs et évaluations</h3></div><b>' + state.assignments.length + '</b></header><div class="assignment-list">' + (list || '<p class="empty-list">Aucun devoir.</p>') + '</div>' + detail + '</section>' + (gradingPanel || composer) + '</div>';
  }

  function renderGradingPanel(selected) {
    var rows = state.assignmentStudents.map(function (s) {
      var existing = getExistingGrade(s.id);
      var isPublished = existing && existing.status === "published";
      var value = getGradeValue(s.id);
      var draft = state.gradeDrafts[s.id] || {};
      var inputType = selected.scale_mode === "numeric" ? "number" : "text";
      var step = selected.scale_mode === "numeric" ? ' step="0.01"' : "";
      var maxAttr = selected.scale_max ? ' max="' + selected.scale_max + '"' : "";
      var commentValue = draft.comment !== undefined ? draft.comment : (existing && existing.comment ? existing.comment : "");
      var reasonValue = draft.change_reason !== undefined ? draft.change_reason : "";

      return '<tr data-student-id="' + s.id + '">' +
        '<td><b>' + escapeMarkup(s.last_name || "") + '</b> ' + escapeMarkup(s.first_name || "") + '</td>' +
        '<td>' + escapeMarkup(s.matricule || "—") + '</td>' +
        '<td><input type="' + inputType + '"' + step + maxAttr + ' value="' + escapeMarkup(value) + '" data-grade-input="' + s.id + '"' + (isPublished ? ' data-published="true"' : "") + '></td>' +
        '<td><input type="text" placeholder="Commentaire" value="' + escapeMarkup(commentValue) + '" data-grade-comment="' + s.id + '"></td>' +
        '<td>' + (isPublished ? '<input type="text" placeholder="Motif de modification" value="' + escapeMarkup(reasonValue) + '" data-grade-reason="' + s.id + '" required>' : '—') + '</td>' +
        '<td>' + (isPublished ? '<span class="pedagogy-badge published">Publié</span>' : (existing ? '<span class="pedagogy-badge draft">Brouillon</span>' : '<span class="pedagogy-badge">—</span>')) + '</td>' +
        '</tr>';
    }).join("");

    return '<section class="pedagogy-panel grading-panel"><header class="panel-heading"><div><span>Cotation</span><h3>Saisir les cotes · ' + escapeMarkup(selected.title) + '</h3></div><b>' + state.assignmentStudents.length + '</b></header>' +
      '<div class="table-scroll"><table class="grade-table"><thead><tr><th>Élève</th><th>Matricule</th><th>Cote</th><th>Commentaire</th><th>Motif</th><th>Statut</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">Aucun élève dans cette classe.</td></tr>') +
      '</tbody></table></div>' +
      '<footer class="grading-actions">' +
      '<button class="secondary-button" type="button" data-save-grades="' + selected.id + '"><i data-lucide="save"></i> Enregistrer les cotes</button>' +
      '<button class="primary-button dark" type="button" data-publish-grades="' + selected.id + '"><i data-lucide="send"></i> Publier les cotes</button>' +
      '</footer></section>';
  }

  function renderLessonPlans() {
    var rows = state.lessonPlans.map(function (p) {
      return '<tr data-lesson-plan-id="' + p.id + '"><td><b>' + escapeMarkup(p.title) + '</b></td><td>' + escapeMarkup(p.lesson_date) + '</td><td>' + escapeMarkup((p.classes ? p.classes.name : p.class_id)) + '</td><td>' + escapeMarkup((p.subjects ? p.subjects.name : p.subject_id)) + '</td><td>' + escapeMarkup((p.profiles ? p.profiles.display_name : p.teacher_id)) + '</td></tr>';
    }).join("");

    return '<section class="pedagogy-panel"><header class="panel-heading"><div><span>Cahier de préparation</span><h3>Leçons planifiées</h3></div><i data-lucide="book-open-check"></i></header>' +
      '<form class="pedagogy-form" id="lessonPlanForm"><div class="pedagogy-form-grid">' +
      '<label>Titre<input name="title" required placeholder="Titre de la leçon"></label>' +
      '<label>Date<input name="lesson_date" type="date" required></label>' +
      '<label>Classe<select name="class_id">' + state.classes.map(function (c) { return '<option value="' + c.id + '">' + escapeMarkup(c.name) + '</option>'; }).join("") + '</select></label>' +
      '<label>Matière<select name="subject_id">' + state.subjects.map(function (s) { return '<option value="' + s.id + '">' + escapeMarkup(s.name) + '</option>'; }).join("") + '</select></label>' +
      '<label class="wide">Objectifs<textarea name="objectives" rows="2"></textarea></label>' +
      '<label class="wide">Matériel<textarea name="materials" rows="2"></textarea></label>' +
      '<label class="wide">Déroulement<textarea name="procedure" rows="4"></textarea></label>' +
      '</div><footer><button class="primary-button" type="submit"><i data-lucide="plus"></i> Ajouter la leçon</button></footer></form>' +
      '<div class="table-scroll"><table class="grade-table"><thead><tr><th>Titre</th><th>Date</th><th>Classe</th><th>Matière</th><th>Enseignant</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">Aucune leçon enregistrée.</td></tr>') + '</tbody></table></div></section>';
  }

  function render() {
    var container = document.getElementById("pedagogyContent");
    if (!container) return;
    var content = state.loading ? '<p class="loading">Chargement…</p>' : (state.error ? '<p class="error">' + escapeMarkup(state.error) + '</p>' : "");
    if (!state.loading && !state.error) {
      if (state.activeTab === "subjects") content = renderSubjects();
      else if (state.activeTab === "assignments") content = renderAssignments();
      else if (state.activeTab === "lesson-plans") content = renderLessonPlans();
    }
    container.innerHTML = content;
    bindEvents();
    refreshIcons();
  }

  function bindEvents() {
    document.querySelectorAll("#pedagogyContent [data-pedagogy-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeTab = button.getAttribute("data-pedagogy-tab");
        render();
      });
    });

    document.querySelectorAll("#pedagogyContent [data-assignment-id]").forEach(function (button) {
      button.addEventListener("click", async function () {
        state.selectedAssignmentId = button.getAttribute("data-assignment-id");
        await loadAssignmentStudentsAndGrades(state.selectedAssignmentId);
        render();
      });
    });

    document.querySelectorAll("#pedagogyContent [data-publish-assignment]").forEach(function (button) {
      button.addEventListener("click", async function () {
        var id = button.getAttribute("data-publish-assignment");
        try {
          await global.SchoolSafePedagogyAPI.publishAssignment(id);
          notify("Devoir publié.");
          await loadAll();
        } catch (e) {
          notify(e.message || "Erreur de publication");
        }
      });
    });

    document.querySelectorAll("#pedagogyContent [data-grade-input]").forEach(function (input) {
      input.addEventListener("input", function () {
        var studentId = input.getAttribute("data-grade-input");
        if (!state.gradeDrafts[studentId]) state.gradeDrafts[studentId] = {};
        state.gradeDrafts[studentId].value = input.value;
      });
    });

    document.querySelectorAll("#pedagogyContent [data-grade-comment]").forEach(function (input) {
      input.addEventListener("input", function () {
        var studentId = input.getAttribute("data-grade-comment");
        if (!state.gradeDrafts[studentId]) state.gradeDrafts[studentId] = {};
        state.gradeDrafts[studentId].comment = input.value;
      });
    });

    document.querySelectorAll("#pedagogyContent [data-grade-reason]").forEach(function (input) {
      input.addEventListener("input", function () {
        var studentId = input.getAttribute("data-grade-reason");
        if (!state.gradeDrafts[studentId]) state.gradeDrafts[studentId] = {};
        state.gradeDrafts[studentId].change_reason = input.value;
      });
    });

    document.querySelectorAll("#pedagogyContent [data-save-grades]").forEach(function (button) {
      button.addEventListener("click", async function () {
        var assignmentId = button.getAttribute("data-save-grades");
        await submitGrades(assignmentId, false);
      });
    });

    document.querySelectorAll("#pedagogyContent [data-publish-grades]").forEach(function (button) {
      button.addEventListener("click", async function () {
        var assignmentId = button.getAttribute("data-publish-grades");
        await submitGrades(assignmentId, true);
      });
    });

    var subjectForm = document.getElementById("subjectForm");
    if (subjectForm) {
      subjectForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var data = new FormData(subjectForm);
        try {
          await global.SchoolSafePedagogyAPI.createSubject({
            code: String(data.get("code")),
            name: String(data.get("name")),
            language: String(data.get("language")),
            cycle_key: String(data.get("cycle_key")),
            subject_family_code: String(data.get("subject_family_code") || ""),
          });
          subjectForm.reset();
          notify("Matière créée.");
          await loadAll();
        } catch (e) {
          notify(e.message || "Erreur de création");
        }
      });
    }

    var assignmentForm = document.getElementById("assignmentForm");
    if (assignmentForm) {
      assignmentForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!assignmentForm.reportValidity()) return;
        var data = new FormData(assignmentForm);
        var submitter = event.submitter;
        var published = submitter && submitter.getAttribute("data-publish") === "true";
        try {
          var assignment = await global.SchoolSafePedagogyAPI.createAssignment({
            class_id: String(data.get("class_id")),
            subject_id: String(data.get("subject_id")),
            title: String(data.get("title")),
            type: String(data.get("type")),
            scale_mode: String(data.get("scale_mode")),
            scale_label: String(data.get("scale_label") || ""),
            coefficient: Number(data.get("coefficient") || 1),
            due_date: data.get("due_date") ? String(data.get("due_date")) : undefined,
            prerequisites: String(data.get("prerequisites") || ""),
            instructions: String(data.get("instructions") || ""),
            language: String(data.get("language")),
            questions: [],
          });
          if (published) {
            await global.SchoolSafePedagogyAPI.publishAssignment(assignment.id);
          }
          assignmentForm.reset();
          notify(published ? "Devoir publié." : "Devoir enregistré.");
          await loadAll();
        } catch (e) {
          notify(e.message || "Erreur de création");
        }
      });
    }

    var lessonPlanForm = document.getElementById("lessonPlanForm");
    if (lessonPlanForm) {
      lessonPlanForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!lessonPlanForm.reportValidity()) return;
        var data = new FormData(lessonPlanForm);
        try {
          await global.SchoolSafePedagogyAPI.createLessonPlan({
            class_id: String(data.get("class_id")),
            subject_id: String(data.get("subject_id")),
            title: String(data.get("title")),
            lesson_date: String(data.get("lesson_date")),
            objectives: String(data.get("objectives") || ""),
            materials: String(data.get("materials") || ""),
            procedure: String(data.get("procedure") || ""),
          });
          lessonPlanForm.reset();
          notify("Leçon ajoutée.");
          await loadAll();
        } catch (e) {
          notify(e.message || "Erreur de création");
        }
      });
    }
  }

  global.SchoolSafePedagogyModule = {
    render: function (containerId) {
      var container = document.getElementById(containerId || "pedagogyContent");
      if (!container) return;
      var wrapper = document.createElement("div");
      wrapper.innerHTML = renderTabs() + '<div id="pedagogyModuleContent"></div>';
      container.innerHTML = "";
      container.appendChild(wrapper);
      loadAll();
    },
    renderTab: function (tab) {
      state.activeTab = tab;
      render();
    },
    load: loadAll,
  };
})(window);
