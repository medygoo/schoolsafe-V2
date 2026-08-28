/* Phase J5 — Adaptateurs École / Élèves / Pédagogie vers le Centre de documents. */
(function (root) {
  "use strict";

  var SCHOOL_ID = "demo-school-1";
  var CLASS_ID = "demo-class-1";
  var SUBJECT_ID = "demo-subject-math";
  var CHILD_ID = "demo-parent-child-lucas";
  var today = new Date().toISOString().slice(0, 10);
  var base = {
    date: today,
    status: "draft",
    formats: ["pdf"],
    currencyPolicy: "not-applicable",
    officialBoundary: "APERÇU / BROUILLON frontend uniquement",
  };

  function descriptor(value) { return Object.assign({}, base, value); }

  var descriptors = [
    descriptor({
      id: "pedagogy-assignment", type: "assignment", label: "Devoir / interrogation",
      description: "PDF pédagogique de la classe et de la matière affectées.",
      sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.assignment.read", scope: "assigned_classes",
      context: { classId: CLASS_ID, subjectId: SUBJECT_ID }, templateKind: "assignment",
    }),
    descriptor({
      id: "pedagogy-answer-sheet", type: "answer-sheet", label: "Feuille de réponses",
      description: "Feuille associée au devoir visible dans la classe affectée.",
      sourceModule: "pedagogy", nature: "FORMULAIRE", permission: "pedagogy.assignment.read", scope: "assigned_classes",
      context: { classId: CLASS_ID, subjectId: SUBJECT_ID }, templateKind: "answer-sheet",
    }),
    descriptor({
      id: "pedagogy-report-class", type: "pedagogy-report", label: "Rapport pédagogique de classe",
      description: "Synthèse pédagogique bornée à la classe affectée.",
      sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.report.read", scope: "assigned_classes",
      context: { classId: CLASS_ID }, templateKind: "report",
    }),
    descriptor({
      id: "pedagogy-report-family", type: "pedagogy-report", label: "Suivi pédagogique de l’enfant",
      description: "Récapitulatif strictement limité à l’enfant lié au parent ou tuteur.",
      sourceModule: "pedagogy", nature: "DOCUMENT", permission: "pedagogy.report.read", scope: "own_children",
      context: { childId: CHILD_ID, studentId: CHILD_ID }, templateKind: "report",
    }),
    descriptor({
      id: "school-student-summary-class", type: "student-summary", label: "Récapitulatif élève — classe affectée",
      description: "Fiche structurée limitée aux élèves actifs de la classe affectée.",
      sourceModule: "school", nature: "FICHE", permission: "school.student.read", scope: "assigned_classes",
      context: { classId: CLASS_ID, studentId: "demo-active-student-1" }, templateKind: "sheet",
    }),
    descriptor({
      id: "school-student-summary-family", type: "student-summary", label: "Récapitulatif de mon enfant",
      description: "Fiche structurée limitée à l’enfant actif lié au parent ou tuteur.",
      sourceModule: "school", nature: "FICHE", permission: "school.student.read", scope: "own_children",
      context: { childId: CHILD_ID, studentId: CHILD_ID }, templateKind: "sheet",
    }),
    descriptor({
      id: "school-student-summary-school", type: "student-summary", label: "Récapitulatif élève — école",
      description: "Fiche élève active dans le périmètre école autorisé.",
      sourceModule: "school", nature: "FICHE", permission: "school.student.read", scope: "school",
      context: { schoolId: SCHOOL_ID, studentId: "demo-active-student-1" }, templateKind: "sheet",
    }),
    descriptor({
      id: "school-class-register", type: "class-register", label: "Liste de classe affectée",
      description: "Liste imprimable limitée à la classe affectée.",
      sourceModule: "school", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "school.class.read", scope: "assigned_classes",
      context: { classId: CLASS_ID }, templateKind: "register",
    }),
    descriptor({
      id: "school-class-register-school", type: "class-register", label: "Liste des classes — école",
      description: "Liste des classes actives visible dans le périmètre école.",
      sourceModule: "school", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "school.class.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "register",
    }),
    descriptor({
      id: "pedagogy-subject-register", type: "subject-register", label: "Liste de matière affectée",
      description: "Liste pédagogique limitée à la matière explicitement affectée.",
      sourceModule: "pedagogy", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "pedagogy.subject.read", scope: "assigned_subjects",
      context: { subjectId: SUBJECT_ID }, templateKind: "register",
    }),
    descriptor({
      id: "school-card-preparation", type: "student-card-preparation", label: "Préparation carte élève existante",
      description: "Adaptateur d’aperçu uniquement vers le sous-système carte protégé.",
      sourceModule: "school", nature: "CARTE/BADGE", permission: "security.card.create", scope: "school",
      context: { schoolId: SCHOOL_ID, studentId: "demo-active-student-1" }, templateKind: "card-adapter",
      formats: ["png"], actions: ["preview"],
      officialBoundary: "Safe Control — transmission et impression réelles BACKEND_LATER · carte existante intacte",
    }),
  ];

  var columnsByType = {
    "class-register": ["Matricule", "Nom", "Classe", "Statut"],
    "subject-register": ["Matière", "Classe", "Enseignant", "Période"],
  };

  async function getTemplate(descriptorId) {
    var item = descriptors.find(function (entry) { return entry.id === descriptorId; });
    if (!item) throw new Error("School/pedagogy document not found: " + descriptorId);
    if (item.templateKind === "assignment") {
      var assignmentModule = await import("../document-engine/templates/assignment-template.js");
      return assignmentModule.assignmentTemplate;
    }
    if (item.templateKind === "answer-sheet") {
      var answerModule = await import("../document-engine/templates/answer-sheet-template.js");
      return answerModule.answerSheetTemplate;
    }
    if (item.templateKind === "card-adapter") return null;
    var engine = await import("../document-engine/index.js");
    var headers = columnsByType[item.type] || [];
    return engine.createUniversalDocumentTemplate({
      type: item.type,
      label: item.label,
      sourceModule: item.sourceModule,
      kind: item.templateKind,
      permissions: [item.permission],
      columns: headers.map(function (header) { return { header: header, width: 120 }; }),
    });
  }

  function openCardPreparation(user) {
    if (!root.SchoolSafeStudentCardPreparation || typeof root.SchoolSafeStudentCardPreparation.open !== "function") return false;
    var student = {
      id: "demo-active-student-1", first_name: "Amina", last_name: "Kabongo", matricule: "SS-DEMO-001",
      lifecycle_status: "active", class_id: CLASS_ID, photo_url: "",
      enrollment: { planned_class_id: CLASS_ID, planned_class_name: "6e A", academic_year_label: "2026-2027" },
    };
    root.SchoolSafeStudentCardPreparation.open(student, user || {});
    return true;
  }

  function register() {
    if (!root.SchoolSafeDocumentCenter) return [];
    return root.SchoolSafeDocumentCenter.registerMany(descriptors);
  }

  root.SchoolSafeSchoolPedagogyDocuments = {
    register: register,
    list: function () { return descriptors.map(function (item) { return Object.assign({}, item); }); },
    getTemplate: getTemplate,
    openCardPreparation: openCardPreparation,
  };
  register();
}(window));
