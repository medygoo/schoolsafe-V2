/* Phase J4 — Adaptateurs frontend Finance / Comptabilité vers le Centre de documents. */
(function (root) {
  "use strict";

  var SCHOOL_ID = "demo-school-1";
  var CHILD_ID = "demo-parent-child-lucas";
  var today = new Date().toISOString().slice(0, 10);
  var common = {
    date: today,
    status: "draft",
    authority: "preview",
    currencyPolicy: "separate-usd-cdf",
    formats: ["pdf"],
    officialBoundary: "APERÇU / BROUILLON frontend · aucune pièce comptable officielle",
  };

  function descriptor(value) {
    return Object.assign({}, common, value);
  }

  var descriptors = [
    descriptor({
      id: "finance-receipt-family", type: "receipt", label: "Reçu familial — aperçu",
      description: "Reçu existant lié à l’enfant autorisé, généré avec le template A5 SchoolSafe.",
      sourceModule: "finance", nature: "DOCUMENT", permission: "finance.receipt.read", scope: "own_children",
      context: { childId: CHILD_ID, studentId: CHILD_ID }, templateKind: "receipt",
    }),
    descriptor({
      id: "finance-receipt-school", type: "receipt", label: "Registre des reçus — aperçu",
      description: "Reçus de démonstration visibles au niveau école, sans valeur probante frontend.",
      sourceModule: "finance", nature: "DOCUMENT", permission: "finance.receipt.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "receipt",
    }),
    descriptor({
      id: "finance-cash-report", type: "cash-report", label: "Rapport de caisse par devise",
      description: "Projection de caisse CDF et USD séparée, sans clôture ni total inter-devise.",
      sourceModule: "finance", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "finance.report.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "table",
    }),
    descriptor({
      id: "finance-situation-family", type: "financial-situation", label: "Situation financière familiale",
      description: "Récapitulatif strictement limité à l’enfant lié au parent ou tuteur.",
      sourceModule: "finance", nature: "FICHE", permission: "finance.status.read", scope: "own_children",
      context: { childId: CHILD_ID, studentId: CHILD_ID }, templateKind: "sheet",
    }),
    descriptor({
      id: "finance-situation-school", type: "financial-situation", label: "Situation financière — école",
      description: "Synthèse frontend des statuts financiers visibles, séparée par devise.",
      sourceModule: "finance", nature: "DOCUMENT", permission: "finance.status.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "report",
    }),
    descriptor({
      id: "finance-register", type: "financial-register", label: "Liste financière autorisée",
      description: "Liste de démonstration issue de la surface Finance visible, jamais un registre légal.",
      sourceModule: "finance", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "finance.report.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "register",
    }),
    descriptor({
      id: "accounting-summary", type: "accounting-summary", label: "Synthèse comptable frontend",
      description: "Agrégats de démonstration déjà visibles, sans écriture, débit/crédit ni valeur légale.",
      sourceModule: "accounting", nature: "DOCUMENT", permission: "reports.financial.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "report",
    }),
    descriptor({
      id: "accounting-treasury-report", type: "treasury-report", label: "Trésorerie par devise — aperçu",
      description: "Entrées et sorties visibles regroupées séparément en CDF et USD, sans conversion.",
      sourceModule: "accounting", nature: "REGISTRE/LISTE IMPRIMABLE", permission: "reports.financial.read", scope: "school",
      context: { schoolId: SCHOOL_ID }, templateKind: "table",
    }),
  ];

  var columnsByType = {
    "cash-report": ["Date", "Référence", "Mode", "CDF", "USD"],
    "financial-register": ["Référence", "Libellé", "Statut", "Devise", "Montant"],
    "treasury-report": ["Date", "Nature", "Référence", "Entrée", "Sortie", "Devise"],
  };

  async function getTemplate(descriptorId) {
    var item = descriptors.find(function (entry) { return entry.id === descriptorId; });
    if (!item) throw new Error("Finance/accounting document not found: " + descriptorId);
    if (item.templateKind === "receipt") {
      var receiptModule = await import("../document-engine/templates/receipt-template.js");
      return receiptModule.receiptTemplate;
    }
    var engine = await import("../document-engine/index.js");
    var headers = columnsByType[item.type] || [];
    return engine.createUniversalDocumentTemplate({
      type: item.type,
      label: item.label,
      sourceModule: item.sourceModule,
      kind: item.templateKind,
      permissions: [item.permission],
      columns: headers.map(function (header) { return { header: header, width: 105 }; }),
    });
  }

  function register() {
    if (!root.SchoolSafeDocumentCenter) return [];
    return root.SchoolSafeDocumentCenter.registerMany(descriptors);
  }

  root.SchoolSafeFinanceAccountingDocuments = {
    register: register,
    list: function () { return descriptors.map(function (item) { return Object.assign({}, item); }); },
    getTemplate: getTemplate,
  };

  register();
}(window));
