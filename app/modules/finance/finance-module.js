// SchoolSafe V2 — Module Finance
// Extrait de app/app.js ; utilise les dépendances globales exposées sur window.

(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Dépendances globales avec fallbacks défensifs
  // ---------------------------------------------------------------------------
  function deps() {
    return {
      money: typeof root.money === "function" ? root.money : function (n) { return Number(n || 0).toLocaleString("fr-FR") + " FC"; },
      certificationStatusClass: typeof root.certificationStatusClass === "function" ? root.certificationStatusClass : function (s) {
        if (s === "En ordre" || s === "Validé" || s === "done") return "success";
        if (s === "À régulariser" || s === "pending" || s === "En attente de synchronisation" || s === "Annulation demandée") return "warning";
        if (s === "Annulé") return "error";
        return "info";
      },
      notify: typeof root.notify === "function" ? root.notify : function () {},
      icons: typeof root.icons === "function" ? root.icons : function () {},
      currentDemoRole: root.currentDemoRole || "admin",
      queueOfflineOperation: typeof root.queueOfflineOperation === "function" ? root.queueOfflineOperation : function () { return Promise.resolve(null); },
      api: root.SchoolSafeFinanceAPI || null,
      i18n: root.SchoolSafeI18n || null,
      pdf: root.SchoolSafePdfUtils || null
    };
  }

  function currentRole() { return deps().currentDemoRole; }
  function currentSession() { return root.currentSession || null; }

  // ---------------------------------------------------------------------------
  // Helpers généraux
  // ---------------------------------------------------------------------------
  function todayIsoDate() {
    return new Date().toISOString().split("T")[0];
  }

  function formatIsoDateFr(isoString) {
    if (!isoString) return "—";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  function formatIsoDateTimeFr(isoString) {
    if (!isoString) return "—";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function modeLabel(mode) {
    if (!mode) return "—";
    var map = {
      cash: "Espèces",
      card: "Carte bancaire",
      check: "Chèque",
      bank_transfer: "Virement constaté",
      mobile_money: "Mobile money",
      other: "Autre moyen constaté",
      unknown: "—"
    };
    return map[mode] || mode;
  }

  function cycleLabel(cycleKey) {
    if (!cycleKey) return "—";
    var map = { nursery: "Maternelle", primary: "Primaire", secondary: "Secondaire", kindergarten: "Maternelle", all: "Tous les cycles" };
    return map[cycleKey] || cycleKey;
  }

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function initialsFromName(name) {
    return name.split(" ").map(function (part) { return part[0]; }).join("").toUpperCase().slice(0, 2);
  }

  function statusLabelFromFeeStatus(status) {
    if (status === "paid") return "En ordre";
    if (status === "partial") return "À régulariser";
    if (status === "exempted") return "Exempté";
    return "À régulariser";
  }

  function financialStatusDefinition(status) {
    var definitions = {
      pending: { label: "À payer", variant: "warning" },
      partial: { label: "Paiement partiel", variant: "warning" },
      paid: { label: "En règle", variant: "success" },
      exempted: { label: "Exempté", variant: "info" }
    };
    return definitions[status] || { label: "Statut indisponible", variant: "neutral" };
  }

  function hasValidSessionToken() {
    try {
      var raw = root.localStorage.getItem("schoolsafe-v2-session");
      if (!raw) return false;
      var session = JSON.parse(raw);
      return !!(session && session.token);
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------
  // Mode démo vs mode réel
  // ---------------------------------------------------------------------------
  function isDemoMode() {
    if (root.schoolSafeDemoMode === true) return true;
    var host = String(root.location && root.location.hostname || "").toLowerCase();
    var isLocalhost = host === "localhost" || host === "127.0.0.1";
    return isLocalhost && !hasValidSessionToken();
  }

  function createDemoState() {
    return {
      activeTab: "overview",
      selectedStudent: 0,
      selectedFamilyStudent: 0,
      receiptSequence: 587,
      dayStatus: "Ouverte",
      loaded: false,
      loading: false,
      pendingStudents: [
        { id: "demo-s1", name: "Lucas Martin", initials: "LM", sex: "Garçon", className: "6e A", guardian: "Mme Sophie Martin", expected: 450000, paid: 350000, balance: 100000, status: "À régulariser", currency: "CDF" },
        { id: "demo-s3", name: "Ethan Leroy", initials: "EL", sex: "Garçon", className: "1re A", guardian: "M. Paul Leroy", expected: 450000, paid: 150000, balance: 300000, status: "À régulariser", currency: "CDF" }
      ],
      selectedPendingStudent: 0,
      reportClosure: null,
      feeTypes: [
        { id: "demo-1", name: "Frais scolaires", cycle: "Primaire", amount: 300000, currency: "CDF", frequency: "Trimestre", due: "30 septembre 2026", active: true },
        { id: "demo-2", name: "Frais scolaires", cycle: "Humanités", amount: 450000, currency: "CDF", frequency: "Trimestre", due: "30 septembre 2026", active: true },
        { id: "demo-3", name: "Inscription", cycle: "Tous les cycles", amount: 50000, currency: "CDF", frequency: "Une fois", due: "À l’inscription", active: true },
        { id: "demo-4", name: "Transport scolaire", cycle: "Service facultatif", amount: 100000, currency: "USD", frequency: "Mois", due: "Chaque 5 du mois", active: true }
      ],
      feeAssignment: { feeStructureId: "", targetingMode: "cycle", classIds: [], studentIds: [], prepared: false },
      campaignDraft: { feeStructureId: "", label: "", startsAt: "", endsAt: "", description: "", prepared: false, preparedSummary: null },
      studentFeeMap: {},
      // Legacy conservé jusqu'au remplacement validé de la Caisse / FE-FIN-05.
      legacyStudentRecords: [
        { id: "demo-s1", name: "Lucas Martin", initials: "LM", sex: "Garçon", className: "6e A", guardian: "Mme Sophie Martin", expected: 450000, paid: 350000, balance: 100000, status: "À régulariser", currency: "CDF" },
        { id: "demo-s2", name: "Emma Martin", initials: "EM", sex: "Fille", className: "Maternelle 3", guardian: "Mme Sophie Martin", expected: 300000, paid: 300000, balance: 0, status: "En ordre", currency: "CDF" },
        { id: "demo-s3", name: "Ethan Leroy", initials: "EL", sex: "Garçon", className: "1re A", guardian: "M. Paul Leroy", expected: 450000, paid: 150000, balance: 300000, status: "À régulariser", currency: "CDF" },
        { id: "demo-s4", name: "Chloé Bernard", initials: "CB", sex: "Fille", className: "2e B", guardian: "Mme Julie Bernard", expected: 450000, paid: 450000, balance: 0, status: "En ordre", currency: "CDF" },
        { id: "demo-s5", name: "Aline Martin", initials: "AM", sex: "Fille", className: "4e Humanités A", guardian: "Mme Sophie Martin", expected: 600000, paid: 600000, balance: 0, status: "En ordre", currency: "CDF" }
      ],
      students: [
        { id: "demo-s1", name: "Lucas Martin", initials: "LM", sex: "Garçon", className: "6e A", guardian: "Mme Sophie Martin" },
        { id: "demo-s2", name: "Emma Martin", initials: "EM", sex: "Fille", className: "Maternelle 3", guardian: "Mme Sophie Martin" },
        { id: "demo-s3", name: "Ethan Leroy", initials: "EL", sex: "Garçon", className: "1re A", guardian: "M. Paul Leroy" },
        { id: "demo-s4", name: "Chloé Bernard", initials: "CB", sex: "Fille", className: "2e B", guardian: "Mme Julie Bernard" },
        { id: "demo-s5", name: "Aline Martin", initials: "AM", sex: "Fille", className: "4e Humanités A", guardian: "Mme Sophie Martin" },
        { id: "demo-student-no-fee", name: "Noah Ilunga", initials: "NI", sex: "Garçon", className: "5e A", guardian: "Mme Sarah Ilunga" }
      ],
      studentFees: [
        { id: "demo-sf-lucas-school", student_id: "demo-s1", fee_structure_id: "demo-2", amount_expected: 450000, amount_paid: 350000, amount_remaining: 100000, status: "partial" },
        { id: "demo-sf-lucas-transport", student_id: "demo-s1", fee_structure_id: "demo-4", amount_expected: 100000, amount_paid: 0, amount_remaining: 100000, status: "pending" },
        { id: "demo-sf-emma-school", student_id: "demo-s2", fee_structure_id: "demo-1", amount_expected: 300000, amount_paid: 300000, amount_remaining: 0, status: "paid" },
        { id: "demo-sf-ethan-school", student_id: "demo-s3", fee_structure_id: "demo-2", amount_expected: 450000, amount_paid: 150000, amount_remaining: 300000, status: "partial" },
        { id: "demo-sf-chloe-school", student_id: "demo-s4", fee_structure_id: "demo-2", amount_expected: 450000, amount_paid: 450000, amount_remaining: 0, status: "paid" },
        { id: "demo-sf-aline-school", student_id: "demo-s5", fee_structure_id: "demo-2", amount_expected: 600000, amount_paid: 0, amount_remaining: 0, status: "exempted" }
      ],
      studentFinancialProfiles: [],
      selectedFinancialStudentId: "demo-s1",
      exemptionDraft: { studentId: "demo-s1", studentFeeId: "demo-sf-lucas-transport", type: "total", prepared: false, preparedSummary: null },
      selectedCashStudentId: "demo-s1",
      selectedCashStudentFeeId: "demo-sf-lucas-school",
      lastConfirmedPayment: null,
      financialSearch: "",
      financialFeeFilter: "",
      financialStatusFilter: "",
      transactions: [
        { id: "demo-p1", receipt: "REC-2026-0587", date: "14 août 2026 · 10:20", day: "14 août 2026", student: "Ethan Leroy", className: "1re A", fee: "Frais scolaires", amount: 150000, currency: "CDF", mode: "Espèces", cashier: "Mme K", reference: "Première tranche", status: "Validé" },
        { id: "demo-p2", receipt: "REC-2026-0586", date: "14 août 2026 · 09:15", day: "14 août 2026", student: "Lucas Martin", className: "6e A", fee: "Frais scolaires", amount: 150000, currency: "CDF", mode: "Espèces", cashier: "Mme K", reference: "Deuxième tranche", status: "Validé" },
        { id: "demo-p3", receipt: "REC-2026-0585", date: "13 août 2026 · 14:40", day: "13 août 2026", student: "Emma Martin", className: "Maternelle 3", fee: "Frais scolaires", amount: 300000, currency: "CDF", mode: "Virement constaté", cashier: "Mme K", reference: "Paiement complet", status: "Validé" },
        { id: "demo-p4", receipt: "REC-2026-0584", date: "12 août 2026 · 11:05", day: "12 août 2026", student: "Lucas Martin", className: "6e A", fee: "Frais scolaires", amount: 200000, currency: "CDF", mode: "Espèces", cashier: "Mme K", reference: "Première tranche", status: "Validé" },
        { id: "demo-p5", receipt: "REC-2026-0583", date: "11 août 2026 · 08:55", day: "11 août 2026", student: "Chloé Bernard", className: "2e B", fee: "Frais scolaires", amount: 450000, currency: "CDF", mode: "Espèces", cashier: "Mme K", reference: "Paiement complet", status: "Validé" },
        { id: "demo-p6", receipt: "REC-2026-0582", date: "10 août 2026 · 13:10", day: "10 août 2026", student: "Aline Martin", className: "4e Humanités A", fee: "Frais scolaires", amount: 600000, currency: "CDF", mode: "Virement constaté", cashier: "Mme K", reference: "Paiement complet", status: "Validé" }
      ],
      expenses: [
        { reference: "DEP-2026-011", date: "14 août 2026", label: "Fournitures administratives", amount: 120000, status: "Validée" },
        { reference: "DEP-2026-012", date: "14 août 2026", label: "Entretien du groupe électrogène", amount: 75000, status: "À approuver" }
      ],
      dailyReport: null,
      reportDate: todayIsoDate(),
      error: null
    };
  }

  function createRealState() {
    return {
      activeTab: "overview",
      selectedStudent: 0,
      selectedFamilyStudent: 0,
      receiptSequence: 0,
      dayStatus: "Ouverte",
      loaded: false,
      loading: false,
      pendingStudents: [],
      selectedPendingStudent: 0,
      reportClosure: null,
      feeTypes: [],
      feeAssignment: { feeStructureId: "", targetingMode: "cycle", classIds: [], studentIds: [], prepared: false },
      campaignDraft: { feeStructureId: "", label: "", startsAt: "", endsAt: "", description: "", prepared: false, preparedSummary: null },
      studentFeeMap: {},
      students: [],
      studentFees: [],
      studentFinancialProfiles: [],
      selectedFinancialStudentId: "",
      exemptionDraft: { studentId: "", studentFeeId: "", type: "total", prepared: false, preparedSummary: null },
      selectedCashStudentId: "",
      selectedCashStudentFeeId: "",
      lastConfirmedPayment: null,
      financialSearch: "",
      financialFeeFilter: "",
      financialStatusFilter: "",
      transactions: [],
      expenses: [],
      dailyReport: null,
      reportDate: todayIsoDate(),
      error: null
    };
  }

  var financeState = isDemoMode() ? createDemoState() : createRealState();

  // ---------------------------------------------------------------------------
  // Mapping données backend
  // ---------------------------------------------------------------------------
  function mapFeeStructure(fee) {
    return {
      id: fee.id,
      name: fee.label || "Frais",
      cycle: cycleLabel(fee.cycle_key),
      cycle_key: fee.cycle_key || "",
      amount: Number(fee.amount || 0),
      currency: fee.currency || "CDF",
      due: fee.due_date ? formatIsoDateFr(fee.due_date) : "—",
      due_date: fee.due_date || null,
      active: fee.is_active !== false,
      academic_year_id: fee.academic_year_id || null
    };
  }

  function mapFinancialStudent(student) {
    student = student || {};
    var name = student.name || [student.first_name, student.last_name].filter(Boolean).join(" ") || "Élève";
    return {
      id: student.id || null,
      name: name,
      initials: student.initials || initialsFromName(name),
      sex: student.sex || (student.gender === "F" ? "Fille" : student.gender === "M" ? "Garçon" : "—"),
      className: student.className || student.class_name || "Classe indisponible",
      guardian: student.guardian || student.guardian_name || "—",
      matricule: student.matricule || ""
    };
  }

  function feeStructureById(feeStructureId) {
    return (financeState.feeTypes || []).find(function (fee) { return fee.id === feeStructureId; }) || null;
  }

  function mapStudentFeeForFinancialProfile(studentFee) {
    studentFee = studentFee || {};
    var feeStructureId = studentFee.fee_structure_id || null;
    var feeStructure = feeStructureById(feeStructureId);
    var status = ["pending", "partial", "paid", "exempted"].indexOf(studentFee.status) >= 0 ? studentFee.status : "unknown";
    return {
      student_fee_id: studentFee.id || null,
      fee_structure_id: feeStructureId,
      student_id: studentFee.student_id || null,
      label: feeStructure ? feeStructure.name : "Type de frais indisponible",
      feeStructureAvailable: !!feeStructure,
      expected: Number(studentFee.amount_expected || 0),
      paid: Number(studentFee.amount_paid || 0),
      remaining: Number(studentFee.amount_remaining || 0),
      currency: feeStructure ? feeStructure.currency : null,
      due: feeStructure ? feeStructure.due : "Indisponible",
      due_date: feeStructure ? feeStructure.due_date : null,
      status: status
    };
  }

  function rebuildStudentFinancialProfiles() {
    var profilesByStudentId = {};
    var profileOrder = [];
    (financeState.students || []).forEach(function (student) {
      var mappedStudent = mapFinancialStudent(student);
      if (!mappedStudent.id || profilesByStudentId[mappedStudent.id]) return;
      profilesByStudentId[mappedStudent.id] = { student: mappedStudent, fees: [] };
      profileOrder.push(mappedStudent.id);
    });
    (financeState.studentFees || []).forEach(function (studentFee) {
      var studentId = studentFee.student_id || (studentFee.students && studentFee.students.id) || null;
      if (!studentId) return;
      if (!profilesByStudentId[studentId]) {
        var student = mapFinancialStudent(Object.assign({ id: studentId }, studentFee.students || {}));
        profilesByStudentId[studentId] = { student: student, fees: [] };
        profileOrder.push(studentId);
      }
      profilesByStudentId[studentId].fees.push(mapStudentFeeForFinancialProfile(studentFee));
    });
    financeState.studentFinancialProfiles = profileOrder.map(function (studentId) { return profilesByStudentId[studentId]; });
    if (!financeState.selectedFinancialStudentId || !profilesByStudentId[financeState.selectedFinancialStudentId]) {
      financeState.selectedFinancialStudentId = profileOrder[0] || "";
    }
  }

  function formatFinancialAmount(value, currency) {
    if (!currency) return "Indisponible";
    return Number(value || 0).toLocaleString("fr-FR") + " " + escapeMarkup(currency);
  }

  function hasUnsynchronizedFinancialOperation() {
    return (financeState.transactions || []).some(function (transaction) {
      return transaction && transaction.status === "En attente de synchronisation";
    });
  }

  function mapStudentFee(sf) {
    var student = sf.students || {};
    var name = [student.first_name, student.last_name].filter(Boolean).join(" ") || "Élève";
    return {
      id: sf.id,
      student_id: sf.student_id,
      name: name,
      initials: initialsFromName(name),
      sex: student.gender === "F" ? "Fille" : "Garçon",
      className: sf.class_name || student.class_name || "Classe",
      guardian: sf.guardian_name || student.guardian_name || "—",
      expected: Number(sf.amount_expected || 0),
      paid: Number(sf.amount_paid || 0),
      balance: Number(sf.amount_remaining || 0),
      status: statusLabelFromFeeStatus(sf.status),
      currency: sf.currency || "CDF"
    };
  }

  if (isDemoMode()) rebuildStudentFinancialProfiles();

  function mapDailyPayment(payment) {
    var student = payment.student || {};
    var name = [student.first_name, student.last_name].filter(Boolean).join(" ") || "Élève";
    return {
      id: payment.id,
      receipt: payment.id,
      date: formatIsoDateTimeFr(payment.received_at),
      day: formatIsoDateFr(payment.received_at),
      student: name,
      className: "",
      fee: payment.fee_label || "Frais",
      amount: Number(payment.amount || 0),
      mode: modeLabel(payment.mode),
      reference: payment.reference || "",
      status: "Validé",
      currency: payment.currency || "CDF"
    };
  }

  // ---------------------------------------------------------------------------
  // Autorisation (spécifique Finance)
  // ---------------------------------------------------------------------------
  function checkAuthorization(permission, options) {
    options = options || {};
    var role = currentRole();
    var session = currentSession();
    var allowed = false;
    if (session && Array.isArray(session.permissions)) {
      allowed = session.permissions.indexOf(permission) !== -1;
      if (!allowed && permission === "finance.receipts.view") {
        allowed = session.permissions.indexOf("finance.receipt.read") !== -1;
      }
    }
    if (!allowed) {
      if (permission === "finance.receipts.view") {
        allowed = role === "admin" || role === "finance" || role === "cashier" || role === "school_head";
        if (options.scope === "own_children" || role === "parent") {
          allowed = allowed || role === "parent";
        }
      } else if (permission === "finance.fee.manage") {
        allowed = role === "admin" || role === "finance";
      } else {
        allowed = role === "admin";
      }
    }
    return allowed;
  }

  /**
   * FE-FIN-02 : accès catalogue via ACCESS_LAW; aucun rôle ne décide seul.
   */
  function financeAccessUser() {
    var session = currentSession();
    if (session) return session;
    // Démo uniquement : le rôle fournit son modèle initial de permissions.
    var demoPermissions = { cashier: ["finance.payment.record"] };
    return { role: currentRole(), permissions: isDemoMode() ? (demoPermissions[currentRole()] || []) : [] };
  }

  function canAccessFeeCatalog(permission) {
    var access = root.SchoolSafeAccess;
    var user = financeAccessUser();
    return !!(access && typeof access.canAccess === "function" && access.canAccess(user, permission));
  }
  function canReadFeeCatalog() { return canAccessFeeCatalog("finance.fee.read"); }
  function canManageFeeCatalog() { return canAccessFeeCatalog("finance.fee.manage"); }
  function canReadFinancialDetails() { return canReadFeeCatalog(); }
  function canReadFinancialStatus() { return canAccessFeeCatalog("finance.status.read"); }

  function canRecordPayment() {
    return canAccessFeeCatalog("finance.payment.record");
  }

  // FE-FIN-11A : la permission existante autorise uniquement l’accès à la
  // surface Caisse. Sa projection réelle (journal, état, clôture, historique)
  // reste BACKEND_LATER tant que son contrat serveur dédié n’existe pas.
  function canAccessCashRegister() {
    return canAccessFeeCatalog("finance.cash_register.close");
  }

  // FE-FIN-12A : Rapports est une surface autonome. Aucun rôle ou autre
  // permission Finance ne doit en déduire l'accès.
  function canReadFinanceReports() {
    return canAccessFeeCatalog("finance.report.read");
  }

  // FE-FIN-13A : Reçus est une surface autonome. La permission de paiement
  // n'implique jamais la consultation d'un registre de reçus.
  function canReadFinanceReceipts() {
    return canAccessFeeCatalog("finance.receipt.read");
  }

  // FE-FIN-06 : garde transitoire. La permission dédiée finance.exemption.manage
  // reste BACKEND_LATER ; aucune décision finale ne repose sur un rôle.
  function canPrepareExemption() {
    return canManageFeeCatalog();
  }

  // FE-FIN-07A : garde transitoire. Les permissions dédiées
  // finance.control.campaign.* restent BACKEND_LATER ; aucun rôle ne décide seul.
  function canManageControlCampaigns() {
    return canAccessFeeCatalog("finance.control.manage");
  }

  function exemptionDraftState() {
    if (!financeState.exemptionDraft) {
      financeState.exemptionDraft = { studentId: "", studentFeeId: "", type: "total", prepared: false, preparedSummary: null };
    }
    return financeState.exemptionDraft;
  }

  function selectedExemptionProfile() {
    var draft = exemptionDraftState();
    var profiles = financeState.studentFinancialProfiles || [];
    if (!profiles.length) return null;
    var selected = profiles.find(function (profile) { return profile.student.id === draft.studentId; });
    if (selected) return selected;
    if (!draft.studentId) {
      draft.studentId = profiles[0].student.id;
      return profiles[0];
    }
    return null;
  }

  function selectedExemptionStudentFee(profile) {
    var draft = exemptionDraftState();
    if (!profile || !Array.isArray(profile.fees) || !profile.fees.length) return null;
    var selected = profile.fees.find(function (fee) { return fee.student_fee_id === draft.studentFeeId; });
    if (selected) return selected;
    if (!draft.studentFeeId) {
      draft.studentFeeId = profile.fees[0].student_fee_id;
      return profile.fees[0];
    }
    return null;
  }

  function exemptionAvailability(fee) {
    if (!fee) return { allowed: false, message: "Sélectionnez une obligation financière précise." };
    if (!fee.feeStructureAvailable || !fee.student_fee_id || !fee.label) return { allowed: false, message: "Le student_fee ou son type de frais est incomplet." };
    if (["CDF", "USD"].indexOf(fee.currency) === -1) return { allowed: false, message: "La devise de cette obligation est inconnue." };
    if (Number(fee.paid) > 0) return { allowed: false, message: "Paiement déjà enregistré : la politique rétroactive exige le backend." };
    if (fee.status === "exempted") return { allowed: false, message: "Cette obligation est déjà affichée comme exemptée ; son historique n’est pas encore connecté." };
    if (fee.status !== "pending") return { allowed: false, message: "Le statut financier n’est pas compatible avec une préparation d’exemption." };
    if (!Number.isFinite(Number(fee.remaining)) || Number(fee.remaining) <= 0) return { allowed: false, message: "Aucun montant restant disponible pour une exemption." };
    return { allowed: true, message: "" };
  }

  function selectedCashProfile() {
    var profiles = financeState.studentFinancialProfiles || [];
    if (!profiles.length) return null;
    var selected = profiles.find(function (profile) { return profile.student.id === financeState.selectedCashStudentId; });
    if (selected) return selected;
    if (!financeState.selectedCashStudentId) {
      financeState.selectedCashStudentId = profiles[0].student.id;
      return profiles[0];
    }
    return null;
  }

  function selectedCashStudentFee(profile) {
    if (!profile || !Array.isArray(profile.fees) || !profile.fees.length) return null;
    var selected = profile.fees.find(function (fee) { return fee.student_fee_id === financeState.selectedCashStudentFeeId; });
    if (selected) return selected;
    if (!financeState.selectedCashStudentFeeId) {
      financeState.selectedCashStudentFeeId = profile.fees[0].student_fee_id;
      return profile.fees[0];
    }
    return null;
  }

  function paymentAvailability(fee) {
    if (!fee) return { allowed: false, message: "Sélectionnez une obligation financière précise." };
    if (!fee.feeStructureAvailable || !fee.label || !fee.currency) return { allowed: false, message: "Le type de frais ou sa devise est indisponible." };
    if (["CDF", "USD"].indexOf(fee.currency) === -1) return { allowed: false, message: "La devise de cette obligation est inconnue." };
    if (fee.status === "paid") return { allowed: false, message: "Paiement normal indisponible : ce frais est déjà réglé." };
    if (fee.status === "exempted") return { allowed: false, message: "Paiement normal indisponible : ce frais est exempté." };
    if (["pending", "partial"].indexOf(fee.status) === -1) return { allowed: false, message: "Paiement normal indisponible : statut financier inconnu." };
    if (!Number.isFinite(Number(fee.remaining)) || Number(fee.remaining) <= 0) return { allowed: false, message: "Paiement normal indisponible : aucun montant restant à encaisser." };
    return { allowed: true, message: "" };
  }

  function paymentStepForCurrency(currency) {
    return currency === "USD" ? 0.01 : 1;
  }

  function hasValidPaymentPrecision(amount, currency) {
    var multiplier = currency === "USD" ? 100 : 1;
    return Math.abs(Number(amount) * multiplier - Math.round(Number(amount) * multiplier)) < 0.0000001;
  }

  function formatTransactionAmount(transaction) {
    return formatFinancialAmount(transaction && transaction.amount, transaction && transaction.currency);
  }

  function formatTransactionTotal(transactions) {
    var rows = Array.isArray(transactions) ? transactions : [];
    var currencies = Array.from(new Set(rows.map(function (transaction) { return transaction && transaction.currency; }).filter(Boolean)));
    if (currencies.length !== 1) return "Montants mixtes non cumulés";
    var amount = rows.reduce(function (sum, transaction) { return sum + Number(transaction.amount || 0); }, 0);
    return formatFinancialAmount(amount, currencies[0]);
  }

  function recordDemoPayment(profile, fee, amount, mode, reference, d) {
    var updatedStudentFee = financeState.studentFees.find(function (studentFee) { return studentFee.id === fee.student_fee_id; });
    if (!updatedStudentFee) {
      d.notify("Démonstration indisponible : l’obligation sélectionnée est introuvable.", "error");
      return;
    }
    var nextPaid = Number(updatedStudentFee.amount_paid || 0) + amount;
    var nextRemaining = Math.max(0, Number(updatedStudentFee.amount_expected || 0) - nextPaid);
    var updated = Object.assign({}, updatedStudentFee, {
      amount_paid: nextPaid,
      amount_remaining: nextRemaining,
      status: nextRemaining === 0 ? "paid" : "partial"
    });
    financeState.studentFees = financeState.studentFees.map(function (studentFee) {
      return studentFee.id === updated.id ? updated : studentFee;
    });
    rebuildStudentFinancialProfiles();
    financeState.transactions.unshift({ id: "demo-payment-" + Date.now(), receipt: "Démonstration — non officiel", date: formatIsoDateTimeFr(new Date().toISOString()), day: formatIsoDateFr(new Date().toISOString()), student: profile.student.name, className: profile.student.className, fee: fee.label, amount: amount, mode: modeLabel(mode), cashier: "—", reference: reference, status: "Démonstration", currency: fee.currency, studentId: profile.student.id, studentFeeId: fee.student_fee_id, feeStructureId: fee.fee_structure_id });
    d.notify("Paiement simulé en démonstration. Aucun reçu officiel n’a été créé.");
    renderFinanceModule();
  }

  /**
   * FE-FIN-03 — prépare uniquement une intention d'affectation dans la vue.
   * Aucune donnée n'est persistée ici : le backend devra créer les student_fees.
   */
  function feeAssignmentState() {
    if (!financeState.feeAssignment) {
      financeState.feeAssignment = { feeStructureId: "", targetingMode: "cycle", classIds: [], studentIds: [], prepared: false };
    }
    return financeState.feeAssignment;
  }

  function deduplicateAssignmentIds(values) {
    var seen = {};
    return (Array.isArray(values) ? values : []).filter(function (value) {
      var key = String(value || "");
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function selectedFeeForAssignment() {
    var assignment = feeAssignmentState();
    var feeTypes = financeState.feeTypes || [];
    if (!assignment.feeStructureId && feeTypes.length) assignment.feeStructureId = feeTypes[0].id;
    return feeTypes.find(function (fee) { return fee.id === assignment.feeStructureId; }) || null;
  }

  function assignmentAmountLabel(fee) {
    if (!fee) return "—";
    return Number(fee.amount || 0).toLocaleString("fr-FR") + " " + escapeMarkup(fee.currency || "CDF");
  }

  // FE-FIN-07A : intention de campagne en mémoire uniquement.
  // Ni createCampaign(), ni offline, ni stockage local ne sont utilisés.
  function campaignDraftState() {
    if (!financeState.campaignDraft) {
      financeState.campaignDraft = { feeStructureId: "", label: "", startsAt: "", endsAt: "", description: "", prepared: false, preparedSummary: null };
    }
    return financeState.campaignDraft;
  }

  function selectedFeeForCampaignDraft() {
    var draft = campaignDraftState();
    var feeTypes = financeState.feeTypes || [];
    if (!draft.feeStructureId && feeTypes.length) draft.feeStructureId = feeTypes[0].id;
    return feeTypes.find(function (fee) { return fee.id === draft.feeStructureId; }) || null;
  }

  // ---------------------------------------------------------------------------
  // Chargement des données
  // ---------------------------------------------------------------------------
  async function loadDailyReport(date) {
    financeState.reportDate = date;
    // Le endpoint journalier actuel agrège potentiellement CDF et USD. Il est
    // conservé pour les flux legacy, mais ne peut pas alimenter Rapports.
    financeState.dailyReport = null;
  }

  function financeDataRequirements() {
    var tab = financeState.activeTab;
    var needsFeeStructures = (tab === "fees" && canReadFeeCatalog()) || ((tab === "assignments" || tab === "cash" || tab === "balances" || tab === "exemptions" || tab === "campaigns") && canReadFinancialDetails());
    var needsStudentFees = (tab === "cash" || tab === "balances" || tab === "exemptions") && canReadFinancialDetails();
    return { feeStructures: needsFeeStructures, studentFees: needsStudentFees };
  }

  async function loadFinanceData() {
    var requirements = financeDataRequirements();
    if (!requirements.feeStructures && !requirements.studentFees) return;
    if (financeState.loading) return;
    if ((!requirements.feeStructures || financeState.feeStructuresLoaded) && (!requirements.studentFees || financeState.studentFeesLoaded)) return;
    if (isDemoMode()) {
      financeState.loaded = true;
      financeState.feeStructuresLoaded = true;
      financeState.studentFeesLoaded = true;
      financeState.loading = false;
      return;
    }
    var api = deps().api;
    if (!api) {
      financeState.error = "Données indisponibles / connexion impossible";
      return;
    }
    financeState.loading = true;
    financeState.error = null;
    renderFinanceModule();
    try {
      var failed = false;
      var markFailedEmpty = function () { failed = true; return []; };
      var feeStructures = requirements.feeStructures && !financeState.feeStructuresLoaded ? await api.listFeeStructures().catch(markFailedEmpty) : null;
      var studentFees = requirements.studentFees && !financeState.studentFeesLoaded ? await api.listStudentFees({}).catch(markFailedEmpty) : null;
      var pendingFees = requirements.studentFees && !financeState.studentFeesLoaded ? await api.listStudentFees({ status: "pending" }).catch(markFailedEmpty) : null;
      var partialFees = requirements.studentFees && !financeState.studentFeesLoaded ? await api.listStudentFees({ status: "partial" }).catch(markFailedEmpty) : null;
      if (failed && !isDemoMode()) {
        financeState.error = "Données indisponibles / connexion impossible";
        return;
      }
      var pendingById = {};
      (pendingFees || []).concat(partialFees || []).forEach(function (sf) {
        pendingById[sf.id] = sf;
      });
      var pendingFeesMerged = Object.values(pendingById);
      if (feeStructures && feeStructures.length) {
        financeState.feeTypes = feeStructures.map(mapFeeStructure);
      }
      if (requirements.feeStructures && feeStructures) financeState.feeStructuresLoaded = true;
      if (studentFees) {
        financeState.studentFeeMap = {};
        financeState.studentFees = studentFees.slice();
        financeState.students = studentFees.reduce(function (students, sf, index) {
          financeState.studentFeeMap[index] = sf.id;
          var identity = mapFinancialStudent(Object.assign({ id: sf.student_id }, sf.students || {}));
          if (identity.id && !students.some(function (student) { return student.id === identity.id; })) students.push(identity);
          // La projection legacy reste strictement dédiée aux flux Caisse existants.
          return students;
        }, []);
        rebuildStudentFinancialProfiles();
        financeState.studentFeesLoaded = true;
      }
      if (pendingFeesMerged) {
        financeState.pendingStudents = pendingFeesMerged.map(mapStudentFee);
        if (financeState.selectedPendingStudent >= financeState.pendingStudents.length) {
          financeState.selectedPendingStudent = 0;
        }
      }
      financeState.loaded = !!(financeState.feeStructuresLoaded || financeState.studentFeesLoaded);
    } catch (e) {
      console.warn("[Finance] chargement backend échoué", e);
      if (!isDemoMode()) {
        financeState.error = "Données indisponibles / connexion impossible";
      }
    } finally {
      financeState.loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Onglets et autorisation des onglets
  // ---------------------------------------------------------------------------
  function financeTabForAction(actionName) {
    if (/campagne/i.test(actionName)) return "campaigns";
    if (/exemption|exonération/i.test(actionName)) return "exemptions";
    if (/affectation des frais|affecter un frais/i.test(actionName)) return "assignments";
    if (/structure des frais|types de frais|contrôle des frais|échéance/i.test(actionName)) return "fees";
    if (/reçu/i.test(actionName)) return "receipts";
    if (/impayé|solde|en ordre|régulariser/i.test(actionName)) return "balances";
    if (/encaissement|enregistrer un paiement|rechercher un élève|vérifier un paiement/i.test(actionName)) return "cash";
    if (/caisse|journal de caisse|historique du jour|clôture|soumettre/i.test(actionName)) return "cash-register";
    if (/rapport|export|imprimer/i.test(actionName)) return "reports";
    if (/frais scolaires|paiement|échéances/i.test(actionName) && currentRole() === "parent") return "family";
    if (/financ|recette|dépense|statistique/i.test(actionName)) return "overview";
    return "";
  }

  function hasFinanceGeneralSurface(tabs) {
    return tabs.some(function (tab) { return ["overview", "campaigns", "family"].indexOf(tab) === -1; });
  }

  function financeTabsForRole() {
    // L'ancienne vue familiale ne possède pas encore de permission own_children
    // dédiée : elle demeure isolée comme comportement legacy jusqu'à son contrat.
    if (currentRole() === "parent") return ["family"];

    var tabs = [];
    if (canReadFeeCatalog() || canManageFeeCatalog()) tabs.push("fees");
    if (canManageFeeCatalog()) tabs.push("assignments");
    if (canRecordPayment()) tabs.push("cash");
    if (canReadFinanceReceipts()) tabs.push("receipts");
    if (canAccessCashRegister()) tabs.push("cash-register");
    if (canReadFinancialDetails() || canReadFinancialStatus()) tabs.push("balances");
    if (canPrepareExemption()) tabs.push("exemptions");
    if (canReadFinanceReports()) tabs.push("reports");
    // La gestion de campagnes legacy reste disponible uniquement pour un
    // utilisateur déjà autorisé dans Finance générale ; control.* seul ne crée
    // donc jamais une entrée Finance générale.
    if (canManageControlCampaigns() && hasFinanceGeneralSurface(tabs)) tabs.push("campaigns");
    // Aucun droit "overview" n'existe aujourd'hui. La surface peut être
    // explicitement demandée par les lecteurs financiers, mais elle n'est pas
    // le point d'entrée automatique et reste BACKEND_LATER en réel.
    if (canReadFeeCatalog() || canReadFinancialStatus() || canReadFinanceReports()) tabs.push("overview");
    return tabs;
  }

  // ---------------------------------------------------------------------------
  // Renderers
  // ---------------------------------------------------------------------------
  function financeTotals() {
    var expected = financeState.studentFees.reduce(function (sum, studentFee) { return sum + Number(studentFee.amount_expected || 0); }, 0);
    var paid = financeState.studentFees.reduce(function (sum, studentFee) { return sum + Number(studentFee.amount_paid || 0); }, 0);
    var balance = financeState.studentFees.reduce(function (sum, studentFee) { return sum + Number(studentFee.amount_remaining || 0); }, 0);
    var today = financeState.transactions.filter(function (transaction) { return transaction.status !== "Annulé"; });
    return {
      expected: expected,
      paid: paid,
      balance: balance,
      rate: expected ? Math.round(paid / expected * 100) : 0,
      today: today,
      todayTotal: today.reduce(function (sum, transaction) { return sum + transaction.amount; }, 0)
    };
  }

  function renderErrorBanner() {
    if (!financeState.error) return "";
    return window.ssState({
      type: "error",
      title: "Erreur",
      message: financeState.error,
      retry: { attrs: { id: "retryFinance" } }
    });
  }

  function renderFinanceOverview() {
    if (!isDemoMode()) {
      return '<section class="finance-overview"><header><div><span>Pilotage financier</span><h3>Vue d’ensemble</h3><p>Les agrégats officiels exigent une projection serveur par devise, période et portée.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "BACKEND_LATER" }) + '</header>' + window.ssState({ type: "unavailable", title: "Vue d’ensemble non connectée", message: "Les montants attendus, payés, restants, taux de recouvrement et encaissements du jour ne sont pas affichés sans agrégats serveur sûrs.", details: "Aucun total local, aucune transaction navigateur et aucune addition CDF + USD ne sont utilisés." }) + '</section>';
    }
    var demoRows = [
      ["CDF", "Illustration séparée par devise", "Aucun total officiel"],
      ["USD", "Illustration séparée par devise", "Aucun total officiel"]
    ].map(function (row) { return "<tr><td><b>" + row[0] + "</b></td><td>" + row[1] + "</td><td>" + row[2] + "</td></tr>"; }).join("");
    return '<section class="finance-overview"><header><div><span>Pilotage financier · démonstration</span><h3>Vue d’ensemble illustrative</h3><p>Cette surface ne représente aucune donnée serveur ni aucun indicateur officiel.</p></div>' + window.ssBadge({ variant: "info", icon: "flask-conical", label: "DÉMO · Non officiel" }) + '</header><aside class="finance-audit-note"><i data-lucide="shield-check"></i><p>Les devises sont séparées. Aucun total CDF + USD, aucun taux de recouvrement et aucun encaissement réel ne sont calculés.</p></aside>' + window.ssTable({ headers: ["Devise", "Projection", "Statut"], rows: demoRows, empty: "Aucune donnée de démonstration.", emptyTitle: "Démonstration", responsive: true }) + '</section>';
  }

  function renderFeeStructure() {
    var canRead = canReadFeeCatalog();
    var canManage = canManageFeeCatalog();
    var cycleOptions = [{ value: "nursery", label: "Maternelle" }, { value: "primary", label: "Primaire" }, { value: "secondary", label: "Secondaire" }];
    var currencyOptions = [{ value: "CDF", label: "CDF" }, { value: "USD", label: "USD" }];
    if (!canRead && !canManage) return window.ssState({ type: "error", title: "Accès non autorisé", message: "Vous ne disposez pas de la permission de consulter ou gérer le catalogue des frais." });

    var rows = canRead ? financeState.feeTypes.map(function (fee) {
      var amount = Number(fee.amount || 0).toLocaleString("fr-FR") + " " + escapeMarkup(fee.currency || "CDF");
      return '<tr><td><b>' + escapeMarkup(fee.name) + '</b></td><td>' + escapeMarkup(fee.cycle) + '</td><td><b>' + amount + '</b></td><td>' + escapeMarkup(fee.due) + '</td><td>' + window.ssBadge({ label: fee.active ? "Actif" : "Inactif", variant: fee.active ? "success" : "warning" }) + '</td></tr>';
    }).join("") : "";

    var form = canManage
      ? '<form class="finance-fee-form" id="financeFeeForm"><header><span><i data-lucide="circle-plus"></i></span><div><h3>Créer un type de frais</h3><p>Le libellé est libre. SchoolSafe enregistre la définition sans encaisser de paiement.</p></div></header><div>' +
        window.ssField({ label: "Libellé", labelFor: "financeFeeLabel", required: true, inputHtml: window.ssInput({ type: "text", name: "label", id: "financeFeeLabel", required: true, maxlength: 200, placeholder: "Ex. Transport scolaire", autocomplete: "off" }) }) +
        window.ssField({ label: "Cycle concerné", labelFor: "financeFeeCycle", required: true, inputHtml: window.ssSelect({ name: "cycle_key", id: "financeFeeCycle", required: true, options: cycleOptions }) }) +
        window.ssField({ label: "Montant", labelFor: "financeFeeAmount", required: true, inputHtml: window.ssInput({ type: "number", name: "amount", id: "financeFeeAmount", required: true, min: 0, step: 1000, inputmode: "decimal", placeholder: "Montant" }) }) +
        window.ssField({ label: "Devise", labelFor: "financeFeeCurrency", required: true, inputHtml: window.ssSelect({ name: "currency", id: "financeFeeCurrency", required: true, value: "CDF", options: currencyOptions }) }) +
        window.ssField({ label: "Échéance", labelFor: "financeFeeDueDate", help: "Facultative. Utilisez une date précise ; les règles récurrentes ne sont pas encore connectées.", className: "wide", inputHtml: window.ssInput({ type: "date", name: "due_date", id: "financeFeeDueDate" }) }) +
        '</div>' + window.ssButton({ label: "Enregistrer le type de frais", icon: "save", type: "submit" }) + '</form>'
      : '<aside class="finance-readonly"><i data-lucide="eye"></i><p>Consultation uniquement. La création de types de frais exige la permission finance.fee.manage.</p></aside>';

    var catalogue = canRead ? window.ssTable({
      headers: ["Libellé", "Cycle concerné", "Montant", "Échéance", "Statut"],
      rows: rows, empty: "Aucun type de frais configuré.", emptyTitle: "Catalogue des frais", responsive: true
    }) : window.ssState({
      type: "unavailable", title: "Lecture du catalogue non accordée",
      message: "Vous pouvez créer un type de frais, mais la permission finance.fee.read est nécessaire pour consulter le catalogue."
    });
    return '<div class="finance-two-column"><section class="finance-panel"><header><div><span>Paramétrage</span><h3>Catalogue des frais</h3></div><b>' + (canRead ? financeState.feeTypes.length : "—") + '</b></header>' + catalogue + '</section>' + form + '</div>';
  }

  function renderFeeAssignment() {
    var canManage = canManageFeeCatalog();
    var canRead = canReadFeeCatalog();
    var assignment = feeAssignmentState();
    assignment.classIds = deduplicateAssignmentIds(assignment.classIds);
    assignment.studentIds = deduplicateAssignmentIds(assignment.studentIds);

    if (!canManage) {
      return window.ssState({
        type: "denied",
        title: "Affectation non autorisée",
        message: "La prévisualisation FE-FIN-03 utilise temporairement finance.fee.manage. La permission finale finance.fee.assign sera raccordée au backend ultérieur.",
        details: "Aucune affectation n’est créée depuis cette interface."
      });
    }

    if (!canRead) {
      return '<section class="finance-panel"><header><div><span>FE-FIN-03 · BACKEND_LATER</span><h3>Affecter un frais</h3></div>' + window.ssBadge({ variant: "warning", label: "Non connecté" }) + '</header>' + window.ssState({
        type: "unavailable",
        title: "Catalogue non disponible",
        message: "La sélection exige un fee_structure réel et la permission finance.fee.read.",
        details: "finance.fee.assign reste la permission cible finale."
      }) + '</section>';
    }

    if (isDemoMode()) {
      return '<section class="finance-panel"><header><div><span>FE-FIN-03 · BACKEND_LATER</span><h3>Affecter un frais</h3></div>' + window.ssBadge({ variant: "warning", label: "Non connecté" }) + '</header>' + window.ssState({
        type: "unavailable",
        title: "Catalogue réel requis",
        message: "Les types de frais de démonstration ne peuvent pas être préparés pour une affectation.",
        details: "Connectez une session Finance autorisée pour sélectionner un fee_structure réel."
      }) + '</section>';
    }

    if (!financeState.feeTypes.length) {
      return '<section class="finance-panel"><header><div><span>FE-FIN-03 · BACKEND_LATER</span><h3>Affecter un frais</h3></div>' + window.ssBadge({ variant: "warning", label: "Non connecté" }) + '</header>' + window.ssState({
        type: "empty",
        title: "Aucun type de frais disponible",
        message: "Créez d’abord un type de frais dans le catalogue avant de préparer une affectation."
      }) + '</section>';
    }

    var fee = selectedFeeForAssignment();
    var targetingModes = [
      { value: "cycle", label: "Cycle" },
      { value: "class", label: "Une classe" },
      { value: "classes", label: "Plusieurs classes" },
      { value: "student", label: "Un élève" },
      { value: "students", label: "Plusieurs élèves" }
    ];
    var feeOptions = financeState.feeTypes.map(function (item) {
      return { value: item.id, label: item.name + " · " + item.cycle };
    });
    var selectionUnavailable = assignment.targetingMode !== "cycle";
    var targetLabel = selectionUnavailable
      ? "Liste indisponible — connexion backend requise"
      : "Cycle concerné : " + (fee ? fee.cycle : "—");
    var preparedState = assignment.prepared ? window.ssState({
      type: "success",
      title: "Configuration prête",
      message: "Configuration prête — connexion backend requise pour appliquer l’affectation.",
      details: "Aucun student_fee n’a été créé."
    }) : "";
    var unavailableState = selectionUnavailable ? window.ssState({
      type: "unavailable",
      title: "Liste indisponible — connexion backend requise",
      message: "La projection Finance des classes et élèves n’existe pas encore. Aucune donnée Pédagogie n’est réutilisée.",
      size: "inline"
    }) : "";
    var futureRows = [
      ["À créer", "student_fee à créer transactionnellement côté backend"],
      ["Déjà existant", "doublon serveur à retourner sans création"],
      ["Conflit", "contrôle serveur, portée et exception à expliquer"]
    ];

    return '<div class="finance-two-column"><section class="finance-panel"><header><div><span>FE-FIN-03 · BACKEND_LATER</span><h3>Affecter un frais</h3><p>Préparez une configuration ; l’affectation réelle reste non connectée.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "Non connecté" }) + '</header>' +
      '<form id="financeFeeAssignmentForm" class="finance-fee-form" novalidate><div class="ss-form-grid">' +
      window.ssField({ label: "Type de frais", labelFor: "financeAssignmentFee", required: true, inputHtml: window.ssSelect({ name: "fee_structure_id", id: "financeAssignmentFee", required: true, value: assignment.feeStructureId, options: feeOptions }) }) +
      window.ssField({ label: "Mode de ciblage", labelFor: "financeAssignmentTargetMode", required: true, inputHtml: window.ssSelect({ name: "targeting_mode", id: "financeAssignmentTargetMode", required: true, value: assignment.targetingMode, options: targetingModes }) }) +
      window.ssField({ label: "Année scolaire", inputHtml: window.ssInput({ type: "text", value: "Année scolaire : connexion backend requise", readonly: true }), help: "Aucune source compatible Finance n’est disponible sans contourner ACCESS_LAW.", className: "wide" }) +
      '</div><section class="finance-panel"><header><div><span>Type sélectionné</span><h3>' + escapeMarkup(fee ? fee.name : "—") + '</h3></div>' + window.ssBadge({ variant: fee && fee.active ? "success" : "warning", label: fee && fee.active ? "Actif" : "Inactif" }) + '</header><dl class="student-finance-facts"><div><dt>Cycle concerné</dt><dd>' + escapeMarkup(fee ? fee.cycle : "—") + '</dd></div><div><dt>Montant standard</dt><dd>' + assignmentAmountLabel(fee) + '</dd></div><div><dt>Échéance</dt><dd>' + escapeMarkup(fee ? fee.due : "—") + '</dd></div></dl></section>' +
      unavailableState + window.ssButton({ label: "Préparer l’affectation", icon: "clipboard-check", type: "submit", disabled: selectionUnavailable || !fee }) + '</form>' + preparedState + '</section>' +
      '<aside class="finance-panel"><header><div><span>Résumé avant validation</span><h3>Aperçu d’affectation</h3></div></header><dl class="student-finance-facts"><div><dt>Type de frais</dt><dd>' + escapeMarkup(fee ? fee.name : "—") + '</dd></div><div><dt>Cible</dt><dd>' + escapeMarkup(targetLabel) + '</dd></div><div><dt>Élèves potentiellement concernés</dt><dd>Indisponible tant que backend non connecté</dd></div><div><dt>Montant standard</dt><dd>' + assignmentAmountLabel(fee) + '</dd></div><div><dt>Année</dt><dd>Indisponible — connexion backend requise</dd></div></dl><aside class="finance-audit-note"><i data-lucide="shield-check"></i><p>Le futur backend devra imposer <code>unique(student_id, fee_structure_id)</code>. La déduplication locale ne prétend jamais vérifier les doublons serveur.</p></aside><p><strong>Groupe</strong> · BACKEND_LATER</p>' + window.ssTable({ headers: ["Résultat futur", "Contrat backend"], rows: futureRows, responsive: true, compact: true }) + '<aside class="finance-audit-note"><i data-lucide="git-branch"></i><p>Contrat : fee_structure → affectation → student_fee → campagne → scan → résultat. Sans student_fee, le futur contrôle doit signaler une anomalie / absence d’affectation, jamais « Non en règle » automatiquement.</p></aside></aside></div>';
  }

  function renderCash() {
    var d = deps();
    var canRecord = canRecordPayment();
    var isRealSession = !isDemoMode();
    if (!canRecord) {
      return window.ssState({
        type: "denied",
        title: "Encaissement non autorisé",
        message: "La permission finance.payment.record est requise pour enregistrer un paiement."
      });
    }
    if (isRealSession && !canReadFeeCatalog()) {
      return window.ssState({
        type: "unavailable",
        title: "Encaissement indisponible",
        message: "Connexion backend à finaliser : la projection minimale d’encaissement doit être fournie sous finance.payment.record.",
        details: "La Caisse ne contourne jamais finance.fee.read pour récupérer les obligations financières."
      });
    }

    var profiles = financeState.studentFinancialProfiles || [];
    if (!profiles.length) {
      return window.ssState({
        type: "empty",
        title: "Aucun élève disponible",
        message: "Aucune obligation financière n’est disponible pour l’encaissement."
      });
    }

    var profile = selectedCashProfile();
    if (!profile) {
      return window.ssState({
        type: "unavailable",
        title: "Élève indisponible",
        message: "La sélection actuelle ne correspond à aucun élève autorisé."
      });
    }
    var student = profile.student;
    var fee = selectedCashStudentFee(profile);
    var availability = paymentAvailability(fee);
    var studentOptions = profiles.map(function (item) {
      return { value: item.student.id, label: item.student.name + " · " + item.student.className };
    });
    var feeOptions = (profile.fees || []).map(function (item) {
      var status = financialStatusDefinition(item.status);
      return { value: item.student_fee_id, label: item.label + " · " + status.label + " · " + formatFinancialAmount(item.remaining, item.currency) };
    });
    var studentPanel = '<section class="finance-panel student-finance-panel"><header><div><span>Recherche du dossier</span><h3>Élève et obligations</h3></div>' + window.ssBadge({ variant: "neutral", label: profile.fees.length + " obligation(s)" }) + '</header>' +
      window.ssField({ label: "Élève", labelFor: "financeCashStudent", required: true, inputHtml: window.ssSelect({ id: "financeCashStudent", name: "student_id", value: student.id, options: studentOptions }) }) +
      '<article class="student-finance-card"><span class="student-avatar large">' + escapeMarkup(student.initials) + '</span><div><small>' + escapeMarkup(student.className + " · " + student.sex) + '</small><h3>' + escapeMarkup(student.name) + '</h3><p>' + escapeMarkup(student.guardian) + '</p></div></article>' +
      (profile.fees.length ? window.ssField({ label: "Obligation financière", labelFor: "financeCashStudentFee", required: true, inputHtml: window.ssSelect({ id: "financeCashStudentFee", name: "student_fee_id", value: fee ? fee.student_fee_id : financeState.selectedCashStudentFeeId, options: feeOptions }) }) : window.ssState({ type: "empty", title: "Aucune obligation financière affectée", message: "Cet élève ne possède aucun student_fee disponible." })) +
      '</section>';
    var feeSummary = fee ? '<section class="finance-panel"><header><div><span>Obligation sélectionnée</span><h3>' + escapeMarkup(fee.label) + '</h3></div>' + window.ssBadge({ variant: financialStatusDefinition(fee.status).variant, label: financialStatusDefinition(fee.status).label }) + '</header>' +
      window.ssTable({ headers: ["Type de frais", "Attendu", "Déjà payé", "Restant", "Devise"], rows: '<tr data-student-id="' + escapeMarkup(fee.student_id) + '" data-student-fee-id="' + escapeMarkup(fee.student_fee_id) + '" data-fee-structure-id="' + escapeMarkup(fee.fee_structure_id) + '"><td><b>' + escapeMarkup(fee.label) + '</b></td><td>' + formatFinancialAmount(fee.expected, fee.currency) + '</td><td>' + formatFinancialAmount(fee.paid, fee.currency) + '</td><td><b>' + formatFinancialAmount(fee.remaining, fee.currency) + '</b></td><td>' + escapeMarkup(fee.currency || "Indisponible") + '</td></tr>', responsive: true, compact: true }) + '</section>' : window.ssState({ type: "unavailable", title: "Obligation indisponible", message: "La sélection du student_fee doit être rétablie avant tout paiement." });
    var paymentForm = fee && availability.allowed && financeState.dayStatus === "Ouverte" ? '<form class="payment-form" id="paymentForm" data-student-id="' + escapeMarkup(student.id) + '" data-student-fee-id="' + escapeMarkup(fee.student_fee_id) + '" data-fee-structure-id="' + escapeMarkup(fee.fee_structure_id) + '" data-currency="' + escapeMarkup(fee.currency) + '"><header><span><i data-lucide="hand-coins"></i></span><div><h3>Enregistrer un paiement</h3><p>Le paiement sera rattaché uniquement à l’obligation sélectionnée.</p></div></header><div>' +
      window.ssField({ label: "Montant reçu", labelFor: "financePaymentAmount", required: true, help: "Maximum : " + formatFinancialAmount(fee.remaining, fee.currency), inputHtml: window.ssInput({ type: "number", name: "amount", id: "financePaymentAmount", required: true, min: paymentStepForCurrency(fee.currency), max: fee.remaining, step: paymentStepForCurrency(fee.currency), inputmode: "decimal", placeholder: "Montant en " + fee.currency }) }) +
      window.ssField({ label: "Devise", labelFor: "financePaymentCurrency", inputHtml: window.ssInput({ type: "text", id: "financePaymentCurrency", value: fee.currency, readonly: true }) }) +
      window.ssField({ label: "Mode constaté", labelFor: "financePaymentMode", required: true, inputHtml: window.ssSelect({ name: "mode", id: "financePaymentMode", value: "cash", options: [{ value: "cash", label: "Espèces" }, { value: "card", label: "Carte bancaire" }, { value: "check", label: "Chèque" }, { value: "bank_transfer", label: "Virement constaté" }, { value: "mobile_money", label: "Mobile money" }, { value: "other", label: "Autre moyen constaté" }] }) }) +
      window.ssField({ label: "Référence ou observation", labelFor: "financePaymentReference", required: true, inputHtml: window.ssInput({ type: "text", name: "reference", id: "financePaymentReference", required: true, maxlength: 200, placeholder: "Ex. Deuxième tranche" }) }) +
      '</div>' + window.ssButton({ label: isDemoMode() ? "Simuler le paiement (démo)" : "Enregistrer et préparer le reçu", icon: "badge-check", type: "submit" }) + '</form>' : window.ssState({ type: availability.allowed ? "unavailable" : "denied", title: availability.allowed ? "Encaissement indisponible" : "Paiement normal indisponible", message: financeState.dayStatus !== "Ouverte" ? "La journée de caisse ne permet plus de nouvel encaissement." : availability.message });
    var demoActivity = isDemoMode() ? '<section class="finance-panel"><header><div><span>Encaissements · données fictives</span><h3>Activité de démonstration</h3></div><b>' + formatTransactionTotal(financeTotals().today) + '</b></header><aside class="finance-audit-note"><i data-lucide="flask-conical"></i><p>Cette activité est fictive et non officielle. Elle ne constitue ni un journal de caisse ni un registre de reçus.</p></aside>' + window.ssTable({ headers: ["Référence", "Élève", "Mode", "Montant", "Statut"], rows: financeTotals().today.map(function (transaction) { return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b></td><td>' + escapeMarkup(transaction.student) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + formatTransactionAmount(transaction) + '</b></td><td>' + window.ssBadge({ variant: d.certificationStatusClass(transaction.status), label: transaction.status }) + '</td></tr>'; }).join(""), empty: "Aucune opération fictive.", emptyTitle: "Encaissements de démonstration", responsive: true }) + '</section>' : "";
    return '<div class="cash-workspace"><section class="cashier-layout">' + studentPanel + paymentForm + '</section>' + demoActivity + feeSummary + '</div>';
  }

  function renderCashRegister() {
    if (!canAccessCashRegister()) {
      return window.ssState({
        type: "denied",
        title: "Accès Caisse non autorisé",
        message: "La consultation de cette surface exige une permission Caisse existante. Aucun accès n’est déduit d’un rôle ou de finance.payment.record."
      });
    }

    if (!isDemoMode()) {
      return '<section class="finance-panel"><header><div><span>Caisse</span><h3>Surface opérationnelle</h3><p>La connexion officielle reste volontairement indisponible.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "BACKEND_LATER" }) + '</header>' +
        window.ssState({
          type: "unavailable",
          title: "Caisse — BACKEND_LATER",
          message: "L’état courant, le journal autorisé, le rapprochement, la clôture et l’historique exigent une projection serveur dédiée.",
          details: "Cette projection devra appliquer la permission, le scope, la condition, la persistance et une séparation stricte par devise et moyen de paiement. Aucun rapport journalier, état local, PDF ou action offline n’est utilisé ici."
        }) + '</section>';
    }

    var demoRows = [
      ["CDF", "450 000 CDF", "125 000 CDF", "5"],
      ["USD", "80,00 USD", "45,00 USD", "3"]
    ].map(function (row) {
      return '<tr><td><b>' + row[0] + '</b></td><td>' + row[1] + '</td><td>' + row[2] + '</td><td>' + row[3] + '</td></tr>';
    }).join("");
    return '<section class="finance-panel cash-register-demo"><header><div><span>Caisse · projection fictive</span><h3>État opérationnel à venir</h3><p>Données d’illustration uniquement : aucune écriture, clôture ou synchronisation officielle n’est disponible.</p></div>' + window.ssBadge({ variant: "info", icon: "flask-conical", label: "DÉMO · Non officiel" }) + '</header>' +
      '<aside class="finance-audit-note"><i data-lucide="shield-check"></i><p>Les devises et les moyens sont présentés séparément. Aucun total CDF + USD et aucun tiroir physique ne sont déduits des autres moyens.</p></aside>' +
      window.ssTable({ headers: ["Devise", "Espèces", "Autres moyens", "Opérations fictives"], rows: demoRows, empty: "Aucune donnée de démonstration.", emptyTitle: "Caisse de démonstration", responsive: true }) +
      '<section class="finance-two-column"><section class="finance-panel"><header><div><span>Journal autorisé</span><h3>Projection future</h3></div></header>' + window.ssState({ type: "unavailable", title: "Journal réel — BACKEND_LATER", message: "Le journal réel exigera une projection serveur filtrée par scope et paginée." }) + '</section><section class="finance-panel"><header><div><span>Clôture et historique</span><h3>Contrat serveur requis</h3></div></header>' + window.ssState({ type: "unavailable", title: "Clôture réelle — BACKEND_LATER", message: "La clôture officielle doit être en ligne, idempotente et auditée ; l’historique dépendra du même contrat." }) + '</section></section></section>';
  }

  function renderReceipts() {
    if (!canReadFinanceReceipts()) {
      return window.ssState({
        type: "denied",
        title: "Accès Reçus non autorisé",
        message: "La consultation du registre exige finance.receipt.read. Aucun accès n’est déduit d’une autre permission Finance."
      });
    }
    if (!isDemoMode()) {
      return '<section class="finance-panel receipt-register"><header><div><span>Reçus</span><h3>Registre autorisé</h3><p>La consultation réelle attend une projection serveur dédiée.</p></div></header>' +
        window.ssState({
          type: "unavailable",
          title: "Registre des reçus — BACKEND_LATER",
          message: "La liste, la recherche et la consultation réelle exigent des filtres serveur, une permission appliquée et une pagination sûre.",
          details: "Le rapport journalier n’est pas utilisé comme registre de reçus. Aucun PDF, téléchargement ou impression n’est proposé depuis cette surface."
        }) +
      '</section>';
    }

    var demoReceipts = [
      { reference: "DÉMO-REC-001", date: "14 août 2026 · 10:20", student: "Emma Martin", matricule: "DEMO-002", fee: "Scolarité", amount: 300000, currency: "CDF", mode: "Espèces", status: "Valide", kind: "Paiement complet", transaction: "DÉMO-TX-001" },
      { reference: "DÉMO-REC-002", date: "14 août 2026 · 09:15", student: "Lucas Martin", matricule: "DEMO-001", fee: "Transport scolaire", amount: 100000, currency: "USD", mode: "Virement constaté", status: "Valide", kind: "Paiement partiel", transaction: "DÉMO-TX-002" },
      { reference: "DÉMO-REC-003", date: "13 août 2026 · 14:40", student: "Ethan Leroy", matricule: "DEMO-003", fee: "Scolarité", amount: 150000, currency: "CDF", mode: "Espèces", status: "Annulé", kind: "Paiement annulé", transaction: "DÉMO-TX-003" }
    ];
    var rows = demoReceipts.map(function (receipt) {
      var statusVariant = receipt.status === "Annulé" ? "danger" : "success";
      return '<tr><td><b>' + escapeMarkup(receipt.reference) + '</b><small>' + escapeMarkup(receipt.date) + '</small></td><td><b>' + escapeMarkup(receipt.student) + '</b><small>Matricule : ' + escapeMarkup(receipt.matricule) + '</small></td><td>' + escapeMarkup(receipt.fee) + '<small>' + escapeMarkup(receipt.kind) + '</small></td><td>' + escapeMarkup(receipt.mode) + '<small>Réf. transaction : ' + escapeMarkup(receipt.transaction) + '</small></td><td><b>' + formatFinancialAmount(receipt.amount, receipt.currency) + '</b></td><td>' + window.ssBadge({ variant: statusVariant, label: receipt.status }) + '</td></tr>';
    }).join("");
    return '<section class="finance-panel receipt-register"><header><div><span>Reçus</span><h3>Projection de registre</h3><p>Ces reçus sont fictifs et servent uniquement à visualiser la future surface autorisée.</p></div>' + window.ssBadge({ variant: "info", icon: "flask-conical", label: "DÉMO" }) + '</header><aside class="finance-audit-note"><i data-lucide="info"></i><p>Un reçu annulé reste visible pour l’audit, mais aucune correction, aucun remboursement, aucun avoir et aucune génération officielle ne sont disponibles ici.</p></aside>' +
      window.ssTable({ headers: ['Référence', 'Élève', 'Frais', 'Paiement', 'Montant', 'Statut'], rows: rows, empty: 'Aucun reçu démo.', emptyTitle: 'Reçus', responsive: true }) +
      '</section>';
  }

  function renderBalances() {
    if (!canReadFinancialDetails()) {
      if (canReadFinancialStatus()) {
        return window.ssState({
          type: "unavailable",
          title: "Vue statut non connectée",
          message: "La projection serveur sans montants exigée par finance.status.read n’existe pas encore.",
          details: "BACKEND_LATER — ne pas utiliser cette vue financière détaillée pour afficher seulement un statut."
        });
      }
      return window.ssState({
        type: "denied",
        title: "Situation financière non autorisée",
        message: "La consultation détaillée exige la permission finance.fee.read.",
        details: "finance.status.read disposera plus tard d’une projection serveur distincte, sans montant."
      });
    }

    if (hasUnsynchronizedFinancialOperation()) {
      return window.ssState({
        type: "unavailable",
        title: "Situation financière à actualiser",
        message: "Une opération locale attend sa synchronisation. Les soldes détaillés ne sont pas affichés avant confirmation serveur.",
        details: "Aucun montant ou statut local n’est déduit d’un paiement non confirmé."
      });
    }

    var profiles = financeState.studentFinancialProfiles || [];
    var search = String(financeState.financialSearch || "").trim().toLocaleLowerCase("fr-FR");
    var feeFilter = financeState.financialFeeFilter || "";
    var statusFilter = financeState.financialStatusFilter || "";
    var filteredProfiles = profiles.filter(function (profile) {
      var student = profile.student;
      var matchesSearch = !search || [student.name, student.className, student.matricule].join(" ").toLocaleLowerCase("fr-FR").indexOf(search) >= 0;
      var matchesFee = !feeFilter || profile.fees.some(function (fee) { return fee.fee_structure_id === feeFilter; });
      var matchesStatus = !statusFilter || profile.fees.some(function (fee) { return fee.status === statusFilter; });
      return matchesSearch && matchesFee && matchesStatus;
    });
    if (filteredProfiles.length && !filteredProfiles.some(function (profile) { return profile.student.id === financeState.selectedFinancialStudentId; })) {
      financeState.selectedFinancialStudentId = filteredProfiles[0].student.id;
    }
    var selectedProfile = filteredProfiles.find(function (profile) { return profile.student.id === financeState.selectedFinancialStudentId; }) || null;
    var feeOptions = [{ value: "", label: "Tous les types de frais" }].concat((financeState.feeTypes || []).map(function (fee) { return { value: fee.id, label: fee.name }; }));
    var statusOptions = [
      { value: "", label: "Tous les statuts" },
      { value: "pending", label: "À payer" },
      { value: "partial", label: "Paiement partiel" },
      { value: "paid", label: "En règle" },
      { value: "exempted", label: "Exempté" }
    ];
    var studentOptions = filteredProfiles.map(function (profile) {
      var student = profile.student;
      return { value: student.id, label: student.name + " · " + student.className };
    });
    var filters = '<section class="finance-panel"><div class="ss-form-grid">' +
      window.ssField({ label: "Rechercher un élève", labelFor: "financeFinancialSearch", inputHtml: window.ssInput({ type: "search", id: "financeFinancialSearch", value: financeState.financialSearch, placeholder: "Nom, matricule ou classe", autocomplete: "off" }) }) +
      window.ssField({ label: "Type de frais", labelFor: "financeFinancialFeeFilter", inputHtml: window.ssSelect({ id: "financeFinancialFeeFilter", value: feeFilter, options: feeOptions }) }) +
      window.ssField({ label: "Statut", labelFor: "financeFinancialStatusFilter", inputHtml: window.ssSelect({ id: "financeFinancialStatusFilter", value: statusFilter, options: statusOptions }) }) +
      '</div></section>';

    if (!profiles.length) {
      return '<section class="balance-register">' + filters + window.ssState({ type: "empty", title: "Aucune obligation financière affectée", message: "Aucun student_fee n’a été retourné par la source Finance." }) + '</section>';
    }
    if (!selectedProfile) {
      return '<section class="balance-register">' + filters + window.ssState({ type: "empty", title: "Aucun élève ne correspond aux filtres", message: "Modifiez la recherche, le type de frais ou le statut." }) + '</section>';
    }

    var selectedStudent = selectedProfile.student;
    var visibleFees = selectedProfile.fees.filter(function (fee) {
      return (!feeFilter || fee.fee_structure_id === feeFilter) && (!statusFilter || fee.status === statusFilter);
    });
    var summary = selectedProfile.fees.reduce(function (result, fee) {
      result.total += 1;
      if (fee.status === "paid") result.paid += 1;
      if (fee.status === "exempted") result.exempted += 1;
      if (fee.status === "pending" || fee.status === "partial") result.toRegularize += 1;
      result.expected += fee.expected;
      result.paidAmount += fee.paid;
      result.remaining += fee.remaining;
      return result;
    }, { total: 0, paid: 0, exempted: 0, toRegularize: 0, expected: 0, paidAmount: 0, remaining: 0 });
    var rows = visibleFees.map(function (fee) {
      var status = financialStatusDefinition(fee.status);
      var feeLabel = '<b>' + escapeMarkup(fee.label) + '</b>' + (fee.feeStructureAvailable ? "" : '<small>ID technique : ' + escapeMarkup(fee.fee_structure_id || "—") + "</small>");
      return '<tr data-student-id="' + escapeMarkup(fee.student_id) + '" data-student-fee-id="' + escapeMarkup(fee.student_fee_id) + '" data-fee-structure-id="' + escapeMarkup(fee.fee_structure_id) + '"><td>' + feeLabel + '</td><td>' + window.ssBadge({ variant: status.variant, label: status.label }) + '</td><td><b>' + formatFinancialAmount(fee.expected, fee.currency) + '</b></td><td>' + formatFinancialAmount(fee.paid, fee.currency) + '</td><td><b>' + formatFinancialAmount(fee.remaining, fee.currency) + '</b></td><td>' + escapeMarkup(fee.due) + '</td></tr>';
    }).join("");
    var studentSelect = window.ssField({ label: "Élève", labelFor: "financeFinancialStudent", inputHtml: window.ssSelect({ id: "financeFinancialStudent", value: selectedStudent.id, options: studentOptions }) });
    var identity = '<article class="student-finance-card"><span class="student-avatar large">' + escapeMarkup(selectedStudent.initials) + '</span><div><small>' + escapeMarkup(selectedStudent.className) + '</small><h3>' + escapeMarkup(selectedStudent.name) + '</h3><p>' + escapeMarkup(selectedStudent.guardian) + '</p></div></article>';
    var summaryMarkup = '<div class="balance-summary"><article><small>Frais</small><b>' + summary.total + '</b></article><article><small>En règle</small><b>' + summary.paid + '</b></article><article><small>À régulariser</small><b>' + summary.toRegularize + '</b></article><article><small>Exemptés</small><b>' + summary.exempted + '</b></article></div>';
    var hasUnknownCurrency = selectedProfile.fees.some(function (fee) { return !fee.currency; });
    var currencies = selectedProfile.fees.map(function (fee) { return fee.currency; }).filter(Boolean).filter(function (currency, index, values) { return values.indexOf(currency) === index; });
    var amountSummary = currencies.length === 1 && !hasUnknownCurrency
      ? '<dl class="student-finance-facts"><div><dt>Attendu cumulé</dt><dd>' + formatFinancialAmount(summary.expected, currencies[0]) + '</dd></div><div><dt>Payé cumulé</dt><dd>' + formatFinancialAmount(summary.paidAmount, currencies[0]) + '</dd></div><div><dt>Restant cumulé</dt><dd>' + formatFinancialAmount(summary.remaining, currencies[0]) + '</dd></div></dl>'
      : '<aside class="finance-audit-note"><i data-lucide="circle-alert"></i><p>Montants cumulés indisponibles : une devise ou une structure de frais manque, ou plusieurs devises sont utilisées. Consultez chaque ligne individuellement.</p></aside>';
    var feesTable = visibleFees.length ? window.ssTable({ headers: ["Type de frais", "Statut", "Attendu", "Payé", "Restant", "Échéance"], rows: rows, responsive: true }) : window.ssState({ type: "empty", title: "Aucune obligation financière affectée", message: "Aucun frais du profil ne correspond aux filtres actifs." });

    return '<section class="balance-register"><header><div><span>Situation financière</span><h3>Frais de l’élève</h3><p>Chaque ligne représente un student_fee distinct ; les montants proviennent des données Finance chargées.</p></div><b>' + filteredProfiles.length + ' élève(s)</b></header>' + filters + '<section class="finance-two-column"><aside class="finance-panel">' + studentSelect + identity + summaryMarkup + '</aside><section class="finance-panel"><header><div><span>Résumé de l’élève</span><h3>Obligations financières</h3></div></header>' + summaryMarkup + amountSummary + '</section></section><section class="finance-panel"><header><div><span>Détail individuel</span><h3>Frais applicables</h3><p>Les frais restent indépendants ; la synthèse ne remplace pas cette liste.</p></div></header>' + feesTable + '</section></section>';
  }

  function renderExemptions() {
    if (!canPrepareExemption()) {
      return window.ssState({
        type: "denied",
        title: "Exemptions non autorisées",
        message: "La préparation d’une exemption nécessite temporairement finance.fee.manage.",
        details: "La permission cible finance.exemption.manage reste BACKEND_LATER."
      });
    }
    if (!canReadFinancialDetails()) {
      return window.ssState({
        type: "unavailable",
        title: "Exemptions indisponibles",
        message: "Connexion backend à finaliser : la projection student_fee autorisée est requise.",
        details: "La surface ne contourne jamais finance.fee.read pour obtenir des montants ou des élèves."
      });
    }

    var profiles = financeState.studentFinancialProfiles || [];
    if (!profiles.length) {
      return window.ssState({ type: "empty", title: "Aucune obligation financière", message: "Aucun student_fee n’est disponible pour préparer une exemption." });
    }

    var draft = exemptionDraftState();
    var profile = selectedExemptionProfile();
    if (!profile) {
      return window.ssState({ type: "unavailable", title: "Élève indisponible", message: "La sélection actuelle ne correspond à aucun élève autorisé." });
    }
    var fee = selectedExemptionStudentFee(profile);
    var availability = exemptionAvailability(fee);
    var student = profile.student;
    var studentOptions = profiles.map(function (item) {
      return { value: item.student.id, label: item.student.name + " · " + item.student.className };
    });
    var feeOptions = (profile.fees || []).map(function (item) {
      return { value: item.student_fee_id, label: item.label + " · " + financialStatusDefinition(item.status).label + " · " + formatFinancialAmount(item.remaining, item.currency) };
    });
    var studentPanel = '<section class="finance-panel student-finance-panel"><header><div><span>Préparation d’exemption</span><h3>Élève et obligation</h3></div>' + window.ssBadge({ variant: "neutral", label: profile.fees.length + " obligation(s)" }) + '</header>' +
      window.ssField({ label: "Élève", labelFor: "financeExemptionStudent", required: true, inputHtml: window.ssSelect({ id: "financeExemptionStudent", name: "student_id", value: student.id, options: studentOptions }) }) +
      '<article class="student-finance-card"><span class="student-avatar large">' + escapeMarkup(student.initials) + '</span><div><small>' + escapeMarkup(student.className + " · " + student.sex) + '</small><h3>' + escapeMarkup(student.name) + '</h3><p>' + escapeMarkup(student.guardian) + '</p></div></article>' +
      window.ssField({ label: "Obligation financière", labelFor: "financeExemptionStudentFee", required: true, inputHtml: window.ssSelect({ id: "financeExemptionStudentFee", name: "student_fee_id", value: fee ? fee.student_fee_id : draft.studentFeeId, options: feeOptions }) }) +
      '</section>';

    var feeSummary = fee ? '<section class="finance-panel"><header><div><span>Student_fee sélectionné</span><h3>' + escapeMarkup(fee.label) + '</h3></div>' + window.ssBadge({ variant: financialStatusDefinition(fee.status).variant, label: financialStatusDefinition(fee.status).label }) + '</header>' +
      window.ssTable({ headers: ["Type de frais", "Attendu", "Payé", "Restant", "Devise"], rows: '<tr data-student-id="' + escapeMarkup(fee.student_id) + '" data-student-fee-id="' + escapeMarkup(fee.student_fee_id) + '" data-fee-structure-id="' + escapeMarkup(fee.fee_structure_id) + '"><td><b>' + escapeMarkup(fee.label) + '</b></td><td>' + formatFinancialAmount(fee.expected, fee.currency) + '</td><td>' + formatFinancialAmount(fee.paid, fee.currency) + '</td><td><b>' + formatFinancialAmount(fee.remaining, fee.currency) + '</b></td><td>' + escapeMarkup(fee.currency) + '</td></tr>', responsive: true, compact: true }) +
      '</section>' : window.ssState({ type: "unavailable", title: "Obligation indisponible", message: "La sélection du student_fee doit être rétablie avant de préparer une exemption." });

    var preparation = draft.prepared ? window.ssState({
      type: "success",
      title: "Configuration prête — connexion backend requise",
      message: "Aucune exemption n’a été appliquée. La demande préparée reste non connectée.",
      details: "BACKEND_LATER : validation, persistance, audit et révocation doivent être effectués côté serveur."
    }) : "";
    var form = fee && availability.allowed ? '<form class="payment-form" id="financeExemptionForm" data-student-id="' + escapeMarkup(student.id) + '" data-student-fee-id="' + escapeMarkup(fee.student_fee_id) + '" data-fee-structure-id="' + escapeMarkup(fee.fee_structure_id) + '" data-currency="' + escapeMarkup(fee.currency) + '"><header><span><i data-lucide="shield-check"></i></span><div><h3>Préparer une demande</h3><p>Aucune exonération ni modification de montant ne sera enregistrée depuis cet écran.</p></div></header><div>' +
      window.ssField({ label: "Type d’exemption", labelFor: "financeExemptionType", required: true, inputHtml: window.ssSelect({ id: "financeExemptionType", name: "exemption_type", value: draft.type, options: [{ value: "total", label: "Totale" }, { value: "partial", label: "Partielle" }] }) }) +
      (draft.type === "partial" ? window.ssField({ label: "Montant exonéré", labelFor: "financeExemptionAmount", required: true, help: "Maximum : " + formatFinancialAmount(fee.remaining, fee.currency), inputHtml: window.ssInput({ type: "number", id: "financeExemptionAmount", name: "amount", required: true, min: paymentStepForCurrency(fee.currency), max: fee.remaining, step: paymentStepForCurrency(fee.currency), inputmode: "decimal", placeholder: "Montant en " + fee.currency }) }) : "") +
      window.ssField({ label: "Motif", labelFor: "financeExemptionReason", required: true, inputHtml: '<textarea id="financeExemptionReason" name="reason" rows="3" required maxlength="1000" placeholder="Expliquez le motif de la demande…"></textarea>' }) +
      '</div>' + window.ssButton({ label: "Préparer la demande", icon: "clipboard-check", type: "submit" }) + '</form>' : window.ssState({ type: availability.allowed ? "unavailable" : "unavailable", title: "Préparation indisponible", message: availability.message, details: "Aucune exemption réelle n’est appliquée." });

    return '<section class="balance-register"><header><div><span>Finance générale</span><h3>Exemptions</h3><p>Préparez une demande sur un student_fee précis. Cette surface est explicitement non connectée.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "BACKEND_LATER" }) + '</header><section class="finance-two-column">' + studentPanel + feeSummary + '</section><section class="finance-panel">' + preparation + form + '</section></section>';
  }

  function renderControlCampaignManagement() {
    if (!canManageControlCampaigns()) {
      return window.ssState({
        type: "denied",
        title: "Gestion des campagnes non autorisée",
        message: "La préparation d’une campagne nécessite temporairement finance.control.manage.",
        details: "La permission cible finance.control.campaign.manage reste BACKEND_LATER."
      });
    }
    if (!canReadFeeCatalog()) {
      return window.ssState({
        type: "unavailable",
        title: "Catalogue des frais indisponible",
        message: "La préparation exige un fee_structure réel et la permission finance.fee.read.",
        details: "La surface ne contourne jamais la lecture Finance pour sélectionner un type de frais."
      });
    }
    if (!financeState.feeTypes.length) {
      return window.ssState({
        type: "empty",
        title: "Aucun type de frais disponible",
        message: "Créez ou chargez d’abord un type de frais avant de préparer une campagne."
      });
    }

    var draft = campaignDraftState();
    var fee = selectedFeeForCampaignDraft();
    var feeOptions = financeState.feeTypes.map(function (item) {
      return { value: item.id, label: item.name + " · " + item.cycle };
    });
    var statuses = [
      [window.ssBadge({ variant: "neutral", label: "Brouillon" }), "Préparation locale uniquement"],
      [window.ssBadge({ variant: "info", label: "Publiée" }), "Publication serveur requise"],
      [window.ssBadge({ variant: "warning", label: "Fermée" }), "Transition serveur requise"],
      [window.ssBadge({ variant: "neutral", label: "Archivée" }), "Transition serveur requise"]
    ].map(function (row) { return "<tr><td>" + row[0] + "</td><td>" + row[1] + "</td></tr>"; }).join("");
    var unavailableTargets = window.ssState({
      type: "unavailable",
      title: "Classes · BACKEND_LATER",
      message: "Projection Finance autorisée requise pour cibler une ou plusieurs classes.",
      details: "Élèves individuels · BACKEND_LATER — Contrôleurs · BACKEND_LATER"
    });
    var prepared = draft.prepared ? window.ssState({
      type: "success",
      title: "Configuration prête — connexion backend requise pour publier/activer",
      message: "Aucune campagne serveur n’a été créée. La préparation reste non connectée.",
      details: "BACKEND_LATER : cibles, assignees, publication, activation, audit et historique."
    }) : "";
    var summary = '<aside class="finance-panel"><header><div><span>Résumé avant action</span><h3>Campagne préparée</h3></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "Non connectée" }) + '</header><dl class="student-finance-facts"><div><dt>Type de frais</dt><dd>' + escapeMarkup(fee ? fee.name : "—") + '</dd></div><div><dt>Cycle (filtre du catalogue)</dt><dd>' + escapeMarkup(fee ? fee.cycle : "—") + '</dd></div><div><dt>Période</dt><dd>' + escapeMarkup(draft.startsAt && draft.endsAt ? formatIsoDateFr(draft.startsAt) + " → " + formatIsoDateFr(draft.endsAt) : "À compléter") + '</dd></div><div><dt>Classes / élèves / contrôleurs</dt><dd>BACKEND_LATER</dd></div><div><dt>Statut à préparer</dt><dd>Brouillon uniquement</dd></div></dl></aside>';
    var form = '<form id="financeCampaignForm" class="finance-fee-form" novalidate><header><span><i data-lucide="calendar-plus"></i></span><div><h3>Préparer la campagne</h3><p>Une campagne ne devient jamais active depuis cette interface.</p></div></header><div class="ss-form-grid">' +
      window.ssField({ label: "Nom de campagne", labelFor: "financeCampaignName", required: true, inputHtml: window.ssInput({ type: "text", id: "financeCampaignName", name: "label", required: true, maxlength: 200, value: draft.label, placeholder: "Ex. Contrôle excursion septembre" }) }) +
      window.ssField({ label: "Type de frais", labelFor: "financeCampaignFee", required: true, inputHtml: window.ssSelect({ id: "financeCampaignFee", name: "fee_structure_id", required: true, value: fee ? fee.id : draft.feeStructureId, options: feeOptions }) }) +
      window.ssField({ label: "Début", labelFor: "financeCampaignStart", required: true, inputHtml: window.ssInput({ type: "date", id: "financeCampaignStart", name: "starts_at", required: true, value: draft.startsAt }) }) +
      window.ssField({ label: "Fin", labelFor: "financeCampaignEnd", required: true, inputHtml: window.ssInput({ type: "date", id: "financeCampaignEnd", name: "ends_at", required: true, value: draft.endsAt }) }) +
      window.ssField({ label: "Consigne opérationnelle", labelFor: "financeCampaignInstruction", required: true, className: "wide", inputHtml: '<textarea id="financeCampaignInstruction" name="description" rows="3" required maxlength="1000" placeholder="Décrivez la consigne appliquée au contrôle…">' + escapeMarkup(draft.description) + '</textarea>' }) +
      '</div>' + unavailableTargets + window.ssButton({ label: "Préparer la campagne", icon: "clipboard-check", type: "submit", disabled: !fee }) + '</form>';

    return '<section class="balance-register"><header><div><span>Finance générale · FE-FIN-07A</span><h3>Campagnes de contrôle</h3><p>Configurez une campagne sur un type de frais réel. La publication et l’activation restent BACKEND_LATER.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "BACKEND_LATER" }) + '</header><section class="finance-panel"><header><div><span>États cibles</span><h3>Cycle de vie de campagne</h3></div></header>' + window.ssTable({ headers: ["Statut", "Connexion actuelle"], rows: statuses, responsive: true, compact: true }) + '</section><section class="finance-two-column">' + form + summary + '</section>' + prepared + '</section>';
  }

  function renderReports() {
    if (!canReadFinanceReports()) {
      return window.ssState({
        type: "denied",
        title: "Rapports financiers non autorisés",
        message: "La consultation exige la permission finance.report.read. Aucun rapport n’est chargé sans cette permission."
      });
    }

    if (!isDemoMode()) {
      return '<section class="finance-panel finance-reports"><header><div><span>Rapports financiers</span><h3>Surface distincte</h3><p>Les rapports officiels ne sont pas encore connectés.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "BACKEND_LATER" }) + '</header>' +
        window.ssState({
          type: "unavailable",
          title: "Rapports financiers — BACKEND_LATER",
          message: "La projection serveur actuelle ne garantit pas une séparation sûre par devise : CDF et USD ne doivent jamais être additionnés.",
          details: "Le futur contrat devra fournir les périodes, agrégats par devise, moyens et types de frais, avec permission, scope, pagination et audit. Aucun rapport journalier legacy, total local ou export n’est utilisé ici."
        }) + '</section>';
    }

    var demoRows = [
      ["CDF", "450 000 CDF", "Espèces : 300 000 CDF · Virement : 150 000 CDF", "Scolarité · 300 000 CDF<br>Inscription · 150 000 CDF"],
      ["USD", "80,00 USD", "Espèces : 35,00 USD · Mobile money : 45,00 USD", "Transport · 80,00 USD"]
    ].map(function (row) {
      return '<tr><td><b>' + row[0] + '</b></td><td><b>' + row[1] + '</b></td><td>' + row[2] + '</td><td>' + row[3] + '</td></tr>';
    }).join("");
    return '<section class="finance-panel finance-reports"><header class="finance-report-head"><div><span>Rapports financiers · projection fictive</span><h3>Lecture par devise</h3><p>Cette démonstration visualise la future surface sans constituer un rapport officiel.</p></div>' + window.ssBadge({ variant: "info", icon: "flask-conical", label: "DÉMO · Non officiel" }) + '</header>' +
      '<aside class="finance-audit-note"><i data-lucide="shield-check"></i><p>Aucun total CDF + USD : chaque devise reste séparée. Aucun export, aucune clôture et aucune donnée serveur ne sont proposés.</p></aside>' +
      '<div class="ss-form-grid">' + window.ssField({ label: "Période fictive", labelFor: "financeReportDate", inputHtml: window.ssInput({ type: "date", id: "financeReportDate", value: financeState.reportDate }) }) + '</div>' +
      window.ssTable({ headers: ["Devise", "Total fictif", "Répartition par moyen", "Répartition par type de frais"], rows: demoRows, empty: "Aucune donnée de démonstration.", emptyTitle: "Rapports de démonstration", responsive: true }) +
      '<section class="finance-two-column"><section class="finance-panel"><header><div><span>Périodes</span><h3>Contrat à venir</h3></div></header>' + window.ssState({ type: "unavailable", title: "Mensuel et période — BACKEND_LATER", message: "La sélection réelle de période exige des agrégats serveur séparés par devise." }) + '</section><section class="finance-panel"><header><div><span>Exports</span><h3>Contrat à venir</h3></div></header>' + window.ssState({ type: "unavailable", title: "CSV, Excel et PDF — BACKEND_LATER", message: "Aucun export officiel n’est disponible avant le contrat de rapport canonique." }) + '</section></section></section>';
  }

  function currentGuardianName() {
    var session = currentSession();
    if (session && session.profile && session.profile.display_name) return session.profile.display_name;
    // Demo fallback when no real session is active.
    return "Mme Sophie Martin";
  }

  function renderFamilyFinance() {
    if (!isDemoMode()) {
      return '<div class="family-finance">' + window.ssState({
        type: "unavailable",
        title: "Situation familiale non connectée",
        message: "La projection own_children sécurisée n’est pas encore fournie par l’API Finance.",
        details: "BACKEND_LATER — aucun frais, montant ou reçu ne peut être déduit côté navigateur pour un parent."
      }) + '</div>';
    }
    var guardianName = currentGuardianName();
    var children = (financeState.studentFinancialProfiles || []).filter(function (profile) { return profile.student.guardian === guardianName; });
    if (financeState.selectedFamilyStudent >= children.length) financeState.selectedFamilyStudent = 0;
    var profile = children[financeState.selectedFamilyStudent];
    if (!profile) {
      return '<div class="family-finance">' + window.ssState({ type: "empty", title: "Aucun enfant rattaché", message: "Aucun enfant rattaché à votre profil.", size: "compact" }) + '</div>';
    }
    var student = profile.student;
    var options = children.map(function (item, index) { return '<option value="' + index + '"' + (index === financeState.selectedFamilyStudent ? " selected" : "") + '>' + escapeMarkup(item.student.name + " · " + item.student.className) + '</option>'; }).join("");
    var rows = profile.fees.map(function (fee) {
      var status = financialStatusDefinition(fee.status);
      return '<tr data-student-id="' + escapeMarkup(fee.student_id) + '" data-student-fee-id="' + escapeMarkup(fee.student_fee_id) + '"><td><b>' + escapeMarkup(fee.label) + '</b></td><td>' + window.ssBadge({ variant: status.variant, label: status.label }) + '</td><td>' + formatFinancialAmount(fee.expected, fee.currency) + '</td><td>' + formatFinancialAmount(fee.paid, fee.currency) + '</td><td>' + formatFinancialAmount(fee.remaining, fee.currency) + '</td></tr>';
    }).join("");
    return '<div class="family-finance"><header><div><span>Situation familiale · démonstration</span><h3>Frais de mes enfants</h3><p>Les reçus réels exigent la projection own_children sécurisée.</p></div>' + window.ssBadge({ variant: "warning", icon: "plug-zap", label: "Démonstration" }) + '</header><label class="family-student-picker">Enfant suivi<select id="familyFinanceStudent">' + options + '</select></label><section class="family-finance-summary"><div><span class="student-avatar large">' + escapeMarkup(student.initials) + '</span><div><small>' + escapeMarkup(student.className) + '</small><h3>' + escapeMarkup(student.name) + '</h3><p>' + profile.fees.length + ' obligation(s) financière(s)</p></div></div></section>' + window.ssTable({ headers: ["Type de frais", "Statut", "Attendu", "Payé", "Restant"], rows: rows, empty: "Aucune obligation financière affectée.", emptyTitle: "Situation financière", responsive: true }) + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Rendu principal
  // ---------------------------------------------------------------------------
  function renderFinanceModule() {
    var d = deps();
    var moduleEl = document.getElementById("financeModule");
    var contentEl = document.getElementById("financeContent");
    var titleEl = document.getElementById("financeModuleTitle");
    var workspaceTitle = document.getElementById("workspaceTitle");
    if (!moduleEl || !contentEl) return;

    var allowedTabs = financeTabsForRole();
    var deniedReports = financeState.activeTab === "reports" && !canReadFinanceReports();
    if (!allowedTabs.length) {
      if (titleEl) titleEl.textContent = "Finance";
      if (workspaceTitle) workspaceTitle.textContent = "Finance";
      document.querySelectorAll("#financeTabs [data-finance-tab]").forEach(function (button) { button.hidden = true; });
      contentEl.innerHTML = window.ssState({
        type: "denied",
        title: "Finance générale non autorisée",
        message: "Aucune sous-fonction Finance générale n’est accordée à cette session.",
        details: "Les permissions finance.control.* ouvrent uniquement Contrôle des frais."
      });
      d.icons();
      return;
    }
    if (allowedTabs.indexOf(financeState.activeTab) === -1 && !deniedReports) financeState.activeTab = allowedTabs[0];

    var titles = { overview: "Pilotage financier", fees: "Structure des frais", assignments: "Affectation des frais", exemptions: "Exemptions", campaigns: "Campagnes de contrôle", cash: "Encaissements", receipts: "Reçus", "cash-register": "Caisse", balances: "Soldes et régularité", reports: "Rapports financiers", family: "Situation familiale" };
    if (titleEl) titleEl.textContent = titles[financeState.activeTab];
    if (workspaceTitle) workspaceTitle.textContent = titles[financeState.activeTab];

    document.querySelectorAll("#financeTabs [data-finance-tab]").forEach(function (button) {
      var tab = button.getAttribute("data-finance-tab");
      button.hidden = allowedTabs.indexOf(tab) === -1;
      button.classList.toggle("active", tab === financeState.activeTab);
    });

    if (financeState.loading) {
      contentEl.innerHTML = window.ssState({ type: "loading", title: "Chargement...", message: "Récupération des données financières…" });
      d.icons();
      return;
    }

    if (financeState.error) {
      contentEl.innerHTML = renderErrorBanner();
      d.icons();
      return;
    }

    var renderers = {
      overview: renderFinanceOverview,
      fees: renderFeeStructure,
      assignments: renderFeeAssignment,
      exemptions: renderExemptions,
      campaigns: renderControlCampaignManagement,
      cash: renderCash,
      receipts: renderReceipts,
      "cash-register": renderCashRegister,
      balances: renderBalances,
      reports: renderReports,
      family: renderFamilyFinance
    };
    contentEl.innerHTML = renderers[financeState.activeTab]();
    bindFinanceEvents();
    d.icons();
  }

  // ---------------------------------------------------------------------------
  // Événements
  // ---------------------------------------------------------------------------
  function bindFinanceEvents() {
    var d = deps();
    var retryBtn = document.getElementById("retryFinance");
    if (retryBtn) retryBtn.addEventListener("click", function () {
      financeState.error = null;
      financeState.loaded = false;
      loadFinanceData().then(function () { renderFinanceModule(); }).catch(function () { renderFinanceModule(); });
    });

    document.querySelectorAll("[data-finance-open]").forEach(function (button) {
      button.addEventListener("click", function () { financeState.activeTab = button.getAttribute("data-finance-open"); renderFinanceModule(); });
    });

    var studentSelect = document.getElementById("financeStudentSelect");
    if (studentSelect) studentSelect.addEventListener("change", function () { financeState.selectedPendingStudent = Number(this.value); renderFinanceModule(); });

    var cashStudentSelect = document.getElementById("financeCashStudent");
    if (cashStudentSelect) cashStudentSelect.addEventListener("change", function () {
      financeState.selectedCashStudentId = this.value;
      financeState.selectedCashStudentFeeId = "";
      renderFinanceModule();
    });
    var cashStudentFeeSelect = document.getElementById("financeCashStudentFee");
    if (cashStudentFeeSelect) cashStudentFeeSelect.addEventListener("change", function () {
      financeState.selectedCashStudentFeeId = this.value;
      renderFinanceModule();
    });

    var exemptionStudentSelect = document.getElementById("financeExemptionStudent");
    if (exemptionStudentSelect) exemptionStudentSelect.addEventListener("change", function () {
      var exemption = exemptionDraftState();
      exemption.studentId = this.value;
      exemption.studentFeeId = "";
      exemption.prepared = false;
      exemption.preparedSummary = null;
      renderFinanceModule();
    });
    var exemptionStudentFeeSelect = document.getElementById("financeExemptionStudentFee");
    if (exemptionStudentFeeSelect) exemptionStudentFeeSelect.addEventListener("change", function () {
      var exemption = exemptionDraftState();
      exemption.studentFeeId = this.value;
      exemption.prepared = false;
      exemption.preparedSummary = null;
      renderFinanceModule();
    });
    var exemptionTypeSelect = document.getElementById("financeExemptionType");
    if (exemptionTypeSelect) exemptionTypeSelect.addEventListener("change", function () {
      var exemption = exemptionDraftState();
      exemption.type = this.value === "partial" ? "partial" : "total";
      exemption.prepared = false;
      exemption.preparedSummary = null;
      renderFinanceModule();
    });
    var exemptionForm = document.getElementById("financeExemptionForm");
    if (exemptionForm) exemptionForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!canPrepareExemption()) { d.notify("Action non autorisée.", "error"); return; }
      var exemption = exemptionDraftState();
      var profile = selectedExemptionProfile();
      var fee = selectedExemptionStudentFee(profile);
      var availability = exemptionAvailability(fee);
      var data = new FormData(exemptionForm);
      var type = String(data.get("exemption_type") || "");
      var reason = String(data.get("reason") || "").trim();
      var amount = type === "partial" ? Number(data.get("amount")) : null;
      if (!availability.allowed || !profile || !fee || ["total", "partial"].indexOf(type) === -1 || !reason) {
        d.notify("Vérifiez l’obligation financière, le type et le motif de la demande.", "error");
        return;
      }
      if (type === "partial" && (!Number.isFinite(amount) || amount <= 0 || amount > Number(fee.remaining) || !hasValidPaymentPrecision(amount, fee.currency))) {
        d.notify("Le montant exonéré doit être supérieur à zéro et ne pas dépasser le restant de ce student_fee.", "error");
        return;
      }
      if (exemptionForm.getAttribute("data-student-id") !== profile.student.id || exemptionForm.getAttribute("data-student-fee-id") !== fee.student_fee_id || exemptionForm.getAttribute("data-currency") !== fee.currency) {
        d.notify("La sélection affichée ne correspond plus au student_fee actif.", "error");
        return;
      }
      exemption.type = type;
      exemption.prepared = true;
      exemption.preparedSummary = { student_fee_id: fee.student_fee_id, type: type, amount: amount, currency: fee.currency };
      d.notify("Configuration prête. Aucune exemption n’a été appliquée : connexion backend requise.");
      renderFinanceModule();
    });

    var campaignFeeSelect = document.getElementById("financeCampaignFee");
    if (campaignFeeSelect) campaignFeeSelect.addEventListener("change", function () {
      var campaign = campaignDraftState();
      campaign.feeStructureId = this.value;
      campaign.prepared = false;
      campaign.preparedSummary = null;
      renderFinanceModule();
    });
    var campaignForm = document.getElementById("financeCampaignForm");
    if (campaignForm) campaignForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!canManageControlCampaigns()) { d.notify("Action non autorisée.", "error"); return; }
      var campaign = campaignDraftState();
      var data = new FormData(campaignForm);
      var label = String(data.get("label") || "").trim();
      var feeStructureId = String(data.get("fee_structure_id") || "");
      var startsAt = String(data.get("starts_at") || "");
      var endsAt = String(data.get("ends_at") || "");
      var description = String(data.get("description") || "").trim();
      var fee = (financeState.feeTypes || []).find(function (item) { return item.id === feeStructureId; }) || null;
      if (!label || !fee || !/^\d{4}-\d{2}-\d{2}$/.test(startsAt) || !/^\d{4}-\d{2}-\d{2}$/.test(endsAt) || startsAt >= endsAt || !description) {
        d.notify("Vérifiez le nom, le type de frais, la période et la consigne de la campagne.", "error");
        return;
      }
      campaign.feeStructureId = feeStructureId;
      campaign.label = label;
      campaign.startsAt = startsAt;
      campaign.endsAt = endsAt;
      campaign.description = description;
      campaign.prepared = true;
      campaign.preparedSummary = { fee_structure_id: feeStructureId, label: label, starts_at: startsAt, ends_at: endsAt, description: description, status: "draft" };
      d.notify("Configuration prête — connexion backend requise pour publier/activer.");
      renderFinanceModule();
    });

    var familySelect = document.getElementById("familyFinanceStudent");
    if (familySelect) familySelect.addEventListener("change", function () { financeState.selectedFamilyStudent = Number(this.value); renderFinanceModule(); });

    var financialStudentSelect = document.getElementById("financeFinancialStudent");
    if (financialStudentSelect) financialStudentSelect.addEventListener("change", function () {
      financeState.selectedFinancialStudentId = this.value;
      renderFinanceModule();
    });
    var financialSearchInput = document.getElementById("financeFinancialSearch");
    if (financialSearchInput) financialSearchInput.addEventListener("input", function () {
      financeState.financialSearch = this.value;
      renderFinanceModule();
    });
    var financialFeeFilter = document.getElementById("financeFinancialFeeFilter");
    if (financialFeeFilter) financialFeeFilter.addEventListener("change", function () {
      financeState.financialFeeFilter = this.value;
      renderFinanceModule();
    });
    var financialStatusFilter = document.getElementById("financeFinancialStatusFilter");
    if (financialStatusFilter) financialStatusFilter.addEventListener("change", function () {
      financeState.financialStatusFilter = this.value;
      renderFinanceModule();
    });

    var feeForm = document.getElementById("financeFeeForm");
    if (feeForm) feeForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!canManageFeeCatalog()) { d.notify("Action non autorisée.", "error"); return; }
      var data = new FormData(feeForm);
      var label = String(data.get("label") || "").trim();
      var cycleKey = String(data.get("cycle_key") || "");
      var amount = Number(data.get("amount"));
      var currency = String(data.get("currency") || "");
      var dueDate = String(data.get("due_date") || "");
      var allowedCycles = ["nursery", "primary", "secondary"];
      var allowedCurrencies = ["CDF", "USD"];
      if (!label || allowedCycles.indexOf(cycleKey) === -1 || !Number.isFinite(amount) || amount < 0 || allowedCurrencies.indexOf(currency) === -1 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
        d.notify("Vérifiez le libellé, le cycle, le montant, la devise et la date d’échéance.", "error");
        return;
      }
      var input = { cycle_key: cycleKey, label: label, amount: amount, currency: currency, due_date: dueDate || undefined, is_active: true };
      var api = d.api;
      (api ? api.createFeeStructure(input) : Promise.reject(new Error("API indisponible"))).then(function () {
        d.notify("Type de frais enregistré sur le serveur.");
        financeState.loaded = false;
        return loadFinanceData();
      }).then(function () {
        renderFinanceModule();
      }).catch(function (err) {
        console.warn("[Finance] création frais échouée", err);
        if (!isDemoMode()) { d.notify("Impossible d’enregistrer le type de frais : " + (err.message || "erreur"), "error"); return; }
        financeState.feeTypes.push({ id: "local-" + Date.now(), name: label, cycle: cycleLabel(cycleKey), cycle_key: cycleKey, amount: amount, currency: currency, due: dueDate ? formatIsoDateFr(dueDate) : "—", due_date: dueDate || null, active: true });
        d.queueOfflineOperation("finance", "Création d’un type de frais · " + label, { kind: "fee-type-create", label: label, cycle_key: cycleKey, amount: amount, currency: currency, due_date: dueDate || null });
        d.notify("Type de frais conservé localement.");
        renderFinanceModule();
      });
    });

    var assignmentForm = document.getElementById("financeFeeAssignmentForm");
    if (assignmentForm) {
      var assignment = feeAssignmentState();
      var assignmentFeeSelect = document.getElementById("financeAssignmentFee");
      var assignmentModeSelect = document.getElementById("financeAssignmentTargetMode");
      if (assignmentFeeSelect) assignmentFeeSelect.addEventListener("change", function () {
        assignment.feeStructureId = this.value;
        assignment.prepared = false;
        renderFinanceModule();
      });
      if (assignmentModeSelect) assignmentModeSelect.addEventListener("change", function () {
        assignment.targetingMode = this.value;
        assignment.prepared = false;
        renderFinanceModule();
      });
      assignmentForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!canManageFeeCatalog()) { d.notify("Action non autorisée.", "error"); return; }
        var selectedFee = selectedFeeForAssignment();
        if (!selectedFee || !assignment.targetingMode) {
          d.notify("Sélectionnez un type de frais et un mode de ciblage.", "error");
          return;
        }
        if (assignment.targetingMode !== "cycle") {
          d.notify("La liste des cibles n’est pas encore connectée au backend Finance.", "error");
          return;
        }
        assignment.prepared = true;
        renderFinanceModule();
      });
    }

    document.querySelectorAll("[data-toggle-fee]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!checkAuthorization("finance.fee.manage")) {
          d.notify("Action non autorisée.", "error");
          return;
        }
        var index = Number(button.getAttribute("data-toggle-fee"));
        var fee = financeState.feeTypes[index];
        var updated = Object.assign({}, fee, { active: !fee.active });
        financeState.feeTypes = financeState.feeTypes.slice();
        financeState.feeTypes[index] = updated;
        d.queueOfflineOperation("finance", "Modification d’un type de frais · " + updated.name, { kind: "fee-type-status", name: updated.name, active: updated.active });
        renderFinanceModule();
      });
    });

    var paymentForm = document.getElementById("paymentForm");
    if (paymentForm) paymentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!canRecordPayment()) { d.notify("Action non autorisée.", "error"); return; }
      if (!isDemoMode() && typeof navigator !== "undefined" && navigator.onLine === false) {
        d.notify("Connexion requise pour enregistrer cet encaissement.", "error");
        return;
      }
      var profile = selectedCashProfile();
      var fee = selectedCashStudentFee(profile);
      var availability = paymentAvailability(fee);
      if (!profile || !fee || fee.student_id !== profile.student.id || !availability.allowed) {
        d.notify((availability && availability.message) || "Sélectionnez une obligation financière valide.", "error");
        return;
      }
      var data = new FormData(paymentForm);
      var amount = Number(data.get("amount"));
      var mode = String(data.get("mode") || "");
      var reference = String(data.get("reference") || "").trim();
      if (!Number.isFinite(amount) || amount <= 0 || amount > Number(fee.remaining)) { d.notify("Le montant doit être positif et ne pas dépasser le restant de cette obligation.", "error"); return; }
      if (["CDF", "USD"].indexOf(fee.currency) === -1) { d.notify("La devise de cette obligation est indisponible.", "error"); return; }
      if (!hasValidPaymentPrecision(amount, fee.currency)) { d.notify("Le montant ne respecte pas la précision autorisée pour cette devise.", "error"); return; }
      if (paymentForm.getAttribute("data-student-fee-id") !== fee.student_fee_id || paymentForm.getAttribute("data-student-id") !== profile.student.id || paymentForm.getAttribute("data-currency") !== fee.currency) {
        d.notify("La sélection du paiement a changé. Vérifiez l’obligation financière avant de confirmer.", "error");
        return;
      }
      var api = d.api;
      var input = {
        student_fee_id: fee.student_fee_id,
        amount: amount,
        currency: fee.currency,
        mode: mode,
        reference: reference,
        metadata: { mode: mode, reference: reference }
      };
      if (isDemoMode()) {
        recordDemoPayment(profile, fee, amount, mode, reference, d);
        return;
      }
      if (!api || typeof api.createPayment !== "function") {
        d.notify("Connexion requise pour enregistrer cet encaissement.", "error");
        return;
      }
      api.createPayment(input).then(function (res) {
        financeState.lastConfirmedPayment = res || null;
        d.notify("Paiement enregistré sur le serveur.");
        financeState.loaded = false;
        return loadFinanceData();
      }).then(function () {
        financeState.activeTab = "receipts";
        renderFinanceModule();
      }).catch(function (err) {
        console.warn("[Finance] paiement backend échoué", err);
        d.notify("Impossible d’enregistrer le paiement : " + (err.message || "erreur"), "error");
      });
    });

    document.querySelectorAll("[data-export-receipt-id]").forEach(function (button) {
      button.addEventListener("click", function () { exportReceiptPdf(button.getAttribute("data-export-receipt-id")); });
    });

    document.querySelectorAll("[data-cancel-payment-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        var paymentId = button.getAttribute("data-cancel-payment-id");
        var trigger = button;
        var modal = window.ssModal({
          title: "Annuler le paiement",
          content: '<form id="cancelPaymentForm"><label>Motif de l’annulation<textarea name="reason" rows="3" required placeholder="Précisez pourquoi ce paiement est annulé…"></textarea></label></form>',
          size: "md",
          focusReturn: trigger,
          actions: [
            { label: "Annuler", variant: "secondary", onClick: function () { modal.close(); } },
            { label: "Confirmer l’annulation", variant: "danger", type: "submit", attrs: { form: "cancelPaymentForm" } }
          ]
        });

        var form = modal.content.querySelector("#cancelPaymentForm");
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var reason = form.reason.value.trim();
          if (!reason) {
            modal.setError("Le motif est obligatoire.");
            return;
          }
          modal.setLoading(true);
          var api = d.api;
          (api ? api.cancelPayment(paymentId, reason) : Promise.reject(new Error("API indisponible"))).then(function () {
            d.notify("Annulation enregistrée sur le serveur.");
            financeState.loaded = false;
            return loadFinanceData();
          }).then(function () {
            modal.close();
            renderFinanceModule();
          }).catch(function (err) {
            console.warn("[Finance] annulation backend échouée", err);
            if (!isDemoMode()) {
              modal.setError("Impossible d’annuler le paiement : " + (err.message || "erreur"));
              modal.setLoading(false);
              return;
            }
            var transaction = financeState.transactions.find(function (t) { return t.id === paymentId; });
            if (transaction && transaction.status === "Validé") {
              transaction.status = "Annulation demandée";
              d.queueOfflineOperation("finance", "Demande d’annulation " + transaction.receipt, { kind: "cancellation-request", receipt: transaction.receipt, reason: reason, paymentId: paymentId });
            }
            modal.close();
            d.notify("Demande d’annulation conservée localement.");
            renderFinanceModule();
          });
        });
      });
    });

    var reportDateInput = document.getElementById("financeReportDate");
    if (reportDateInput) reportDateInput.addEventListener("change", function () {
      loadDailyReport(this.value).then(function () { renderFinanceModule(); });
    });

    var closeRegister = document.getElementById("closeCashRegister");
    if (closeRegister) closeRegister.addEventListener("click", function () {
      var api = d.api;
      if (!api) { d.notify("API finance non disponible."); return; }
      var report = financeState.dailyReport || { total_amount: 0 };
      var expectedInput = document.getElementById("closeExpectedAmount");
      var expectedAmount = expectedInput && expectedInput.value !== "" ? Number(expectedInput.value) : Number(report.total_amount || 0);
      api.closeCashRegister({ date: financeState.reportDate, expected_amount: expectedAmount, notes: "Clôture depuis le frontend" }).then(function (res) {
        financeState.reportClosure = res && res.closure ? res.closure : null;
        d.notify(res && res.alreadyClosed ? "La caisse était déjà clôturée pour cette date." : "Caisse clôturée pour le " + formatIsoDateFr(financeState.reportDate) + ".");
        renderFinanceModule();
      }).catch(function (err) {
        console.warn("[Finance] clôture échouée", err);
        d.notify("Clôture impossible : " + (err.message || "erreur"));
      });
    });

    var submitDay = document.getElementById("submitCashDay");
    if (submitDay) submitDay.addEventListener("click", function () {
      financeState.dayStatus = "Soumise";
      d.queueOfflineOperation("finance", "Soumission de la journée de caisse", { kind: "cash-day-submission" });
      d.notify("Journée soumise localement pour contrôle.");
      renderFinanceModule();
    });
  }

  function bindModuleTabs() {
    document.querySelectorAll("#financeTabs [data-finance-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        financeState.activeTab = button.getAttribute("data-finance-tab");
        renderFinanceModule();
      });
    });
    var closeBtn = document.getElementById("closeFinanceModule");
    if (closeBtn) closeBtn.addEventListener("click", function () { close(); });
  }

  // ---------------------------------------------------------------------------
  // PDF
  // ---------------------------------------------------------------------------
  async function exportReceiptPdf(paymentId) {
    var d = deps();
    if (!paymentId) { d.notify("Reçu introuvable."); return; }
    if (!checkAuthorization("finance.receipts.view", { scope: "own_children" })) {
      d.notify("Accès non autorisé", "error");
      return;
    }
    try {
      var api = d.api;
      if (!api) { d.notify("API finance non disponible."); return; }
      var data = await api.getReceiptData(paymentId);
      if (!data) { d.notify("Reçu introuvable."); return; }
      var mod = await import("../document-engine/templates/receipt-template.js");
      var school = data.school || {};
      var identity = {
        name: school.name || "",
        nameEn: null,
        legalName: school.name || "",
        address: school.address || null,
        city: null,
        province: null,
        country: null,
        phone: school.phone || null,
        email: school.email || null,
        website: school.website || null,
        primaryColor: "#071a3d",
        accentColor: "#e9a515",
        logoUrl: school.logo_url || null,
        documentFooter: null,
        officialSealUrl: null,
        currency: school.currency || "USD",
        bankName: null,
        bankAccount: null,
        taxId: null,
        directorName: null,
        directorSignatureUrl: null,
        activeAcademicYear: school.activeAcademicYear || null,
        activeCycles: []
      };
      var p = data.payment || {};
      var s = data.student || {};
      var payment = {
        student: {
          firstName: s.first_name || "",
          lastName: s.last_name || "",
          matricule: s.matricule || "",
          className: s.class_name || ""
        },
        feeLabel: p.fee_label || "",
        period: "",
        amountExpected: Number(p.expected_amount || 0),
        amountPaid: Number(p.amount || 0),
        remaining: Number(p.remaining_amount || 0),
        currency: p.currency || identity.currency,
        paymentMode: modeLabel(p.mode),
        reference: p.reference || "",
        paidAt: p.received_at || data.generatedAt,
        cashierName: p.cashier_name || "",
        verificationCode: p.verification_code || data.receiptNumber || ""
      };
      var doc = await mod.renderReceipt(identity, payment, data.receiptNumber || "");
      var pdfUtils = d.pdf;
      var filename = "recu-" + (pdfUtils && pdfUtils.sanitizeFilename ? pdfUtils.sanitizeFilename(data.receiptNumber || "schoolsafe") : "schoolsafe") + ".pdf";
      doc.save(filename);
      d.notify("Reçu PDF téléchargé.");
    } catch (e) {
      console.error("[Finance] receipt generation failed", e);
      d.notify("Erreur lors de la génération du reçu : " + (e.message || "erreur inconnue"));
    }
  }

  async function exportCashReportPdf() {
    var d = deps();
    var pdf = d.pdf;
    if (!pdf || typeof pdf.pdfLibrary !== "function" || typeof pdf.pdfSchoolIdentity !== "function" || typeof pdf.loadPdfLogo !== "function" || typeof pdf.configurePdfLanguage !== "function" || typeof pdf.pdfHeader !== "function" || typeof pdf.pdfFooter !== "function" || typeof pdf.drawTableHeader !== "function") {
      d.notify("Les utilitaires PDF ne sont pas disponibles.");
      return;
    }
    var JsPdf = pdf.pdfLibrary();
    if (!JsPdf) { d.notify("Le générateur PDF n’est pas disponible."); return; }
    var identity = pdf.pdfSchoolIdentity();
    var logo = await pdf.loadPdfLogo();
    var doc = pdf.configurePdfLanguage(new JsPdf({ unit: "mm", format: "a4" }));
    var totals = financeTotals();
    var validatedExpenses = financeState.expenses.filter(function (expense) { return expense.status === "Validée"; });
    var expenseTotal = validatedExpenses.reduce(function (sum, expense) { return sum + expense.amount; }, 0);
    pdf.pdfHeader(doc, identity, logo, "Rapport de caisse", "Journée du " + formatIsoDateFr(financeState.reportDate) + " · Statut : " + financeState.dayStatus);
    var metricData = [["Encaissements", totals.todayTotal, 7, 100, 194], ["Dépenses validées", expenseTotal, 8, 122, 85], ["Net de la journée", totals.todayTotal - expenseTotal, 155, 100, 0]];
    metricData.forEach(function (metric, index) {
      var x = 14 + index * 62;
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(x, 65, 58, 25, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(83, 96, 119);
      doc.text(metric[0], x + 5, 73);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(metric[2], metric[3], metric[4]);
      doc.text(d.money(metric[1]), x + 5, 84);
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(7, 48, 112);
    doc.text("Opérations enregistrées", 14, 104);
    var transactionColumns = [{ label: "Reçu", x: 16 }, { label: "Élève", x: 48 }, { label: "Mode", x: 102 }, { label: "Montant", x: 151 }, { label: "Statut", x: 177 }];
    var y = pdf.drawTableHeader(doc, transactionColumns, 109);
    totals.today.forEach(function (transaction) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(38, 50, 73);
      doc.text(transaction.receipt, 16, y + 4);
      doc.text(transaction.student, 48, y + 4);
      doc.text(transaction.mode, 102, y + 4);
      doc.text(d.money(transaction.amount), 151, y + 4);
      doc.text(transaction.status, 177, y + 4);
      doc.setDrawColor(230, 234, 241);
      doc.line(14, y + 8, 196, y + 8);
      y += 11;
    });
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(7, 48, 112);
    doc.text("Dépenses consignées", 14, y);
    var expenseColumns = [{ label: "Référence", x: 16 }, { label: "Libellé", x: 58 }, { label: "Montant", x: 145 }, { label: "Statut", x: 176 }];
    y = pdf.drawTableHeader(doc, expenseColumns, y + 5);
    financeState.expenses.forEach(function (expense) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(38, 50, 73);
      doc.text(expense.reference, 16, y + 4);
      doc.text(expense.label, 58, y + 4);
      doc.text(d.money(expense.amount), 145, y + 4);
      doc.text(expense.status, 176, y + 4);
      doc.setDrawColor(230, 234, 241);
      doc.line(14, y + 8, 196, y + 8);
      y += 11;
    });
    doc.setFillColor(244, 248, 253);
    doc.roundedRect(14, y + 7, 182, 24, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(55, 67, 88);
    doc.text(doc.splitTextToSize("Rapport préparé à partir des opérations consignées dans SchoolSafe. Les espèces et références externes doivent être rapprochées et contrôlées par l’école.", 166), 22, y + 17);
    pdf.pdfFooter(doc, identity);
    var filename = "rapport-caisse-" + financeState.reportDate + ".pdf";
    doc.save(filename);
    d.notify("Rapport de caisse PDF téléchargé avec le logo de l’école.");
  }

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------
  function render(containerId, options) {
    options = options || {};
    var moduleEl = document.getElementById(containerId || "financeModule");
    if (moduleEl) {
      moduleEl.hidden = false;
    } else {
      document.getElementById("financeModule").hidden = false;
    }
    document.querySelector(".workspace-grid").hidden = true;
    var cards = document.getElementById("cardsProtected");
    if (cards) cards.hidden = true;

    var requestedTab = options.tab || financeTabForAction(options.action || "");
    var allowedTabs = financeTabsForRole();
    if (!requestedTab) requestedTab = allowedTabs[0] || "";
    var requestedDeniedReports = requestedTab === "reports" && !canReadFinanceReports();
    financeState.activeTab = allowedTabs.indexOf(requestedTab) === -1 && !requestedDeniedReports ? (allowedTabs[0] || "") : requestedTab;

    bindModuleTabs();
    if (!allowedTabs.length || financeState.activeTab === "overview" || (financeState.activeTab === "family" && !isDemoMode()) || (financeState.activeTab === "receipts" && !isDemoMode()) || (financeState.activeTab === "cash-register" && !isDemoMode()) || (financeState.activeTab === "reports") || (financeState.activeTab === "balances" && !canReadFinancialDetails()) || (financeState.activeTab === "cash" && !isDemoMode() && canRecordPayment() && !canReadFeeCatalog()) || (financeState.activeTab === "exemptions" && !isDemoMode() && canPrepareExemption() && !canReadFinancialDetails()) || (financeState.activeTab === "fees" && !canReadFeeCatalog()) || (financeState.activeTab === "assignments" && !canReadFinancialDetails())) {
      // own_children et status-only n'ont pas de projection dédiée : ne jamais demander la liste globale des student_fees.
      renderFinanceModule();
    } else {
      loadFinanceData().then(function () { renderFinanceModule(); });
    }
    var content = document.querySelector(".workspace-content");
    if (content) content.scrollTo({ top: 0, behavior: "smooth" });
  }

  function close() {
    var moduleEl = document.getElementById("financeModule");
    if (moduleEl) moduleEl.hidden = true;
    var feeControl = document.getElementById("feeControlModule");
    if (feeControl) feeControl.hidden = true;
    var grid = document.querySelector(".workspace-grid");
    if (grid) grid.hidden = false;
    var cards = document.getElementById("cardsProtected");
    if (cards) cards.hidden = currentRole() !== "admin" && currentRole() !== "admissions";
    var workspaceTitle = document.getElementById("workspaceTitle");
    if (workspaceTitle) workspaceTitle.textContent = "Tableau de bord";
  }

  function setRole(role) {
    root.currentDemoRole = role;
  }

  function setSession(session) {
    root.currentSession = session;
  }

  root.SchoolSafeFinanceModule = {
    render: render,
    close: close,
    setRole: setRole,
    setSession: setSession,
    _state: financeState,
    isDemoMode: isDemoMode
  };
})(window);
