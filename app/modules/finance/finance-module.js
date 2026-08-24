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
        { id: "demo-1", name: "Frais scolaires", cycle: "Primaire", amount: 300000, frequency: "Trimestre", due: "30 septembre 2026", active: true },
        { id: "demo-2", name: "Frais scolaires", cycle: "Humanités", amount: 450000, frequency: "Trimestre", due: "30 septembre 2026", active: true },
        { id: "demo-3", name: "Inscription", cycle: "Tous les cycles", amount: 50000, frequency: "Une fois", due: "À l’inscription", active: true },
        { id: "demo-4", name: "Transport scolaire", cycle: "Service facultatif", amount: 100000, currency: "USD", frequency: "Mois", due: "Chaque 5 du mois", active: true }
      ],
      feeAssignment: { feeStructureId: "", targetingMode: "cycle", classIds: [], studentIds: [], prepared: false },
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
      financialSearch: "",
      financialFeeFilter: "",
      financialStatusFilter: "",
      transactions: [
        { id: "demo-p1", receipt: "REC-2026-0587", date: "14 août 2026 · 10:20", day: "14 août 2026", student: "Ethan Leroy", className: "1re A", fee: "Frais scolaires", amount: 150000, mode: "Espèces", cashier: "Mme K", reference: "Première tranche", status: "Validé" },
        { id: "demo-p2", receipt: "REC-2026-0586", date: "14 août 2026 · 09:15", day: "14 août 2026", student: "Lucas Martin", className: "6e A", fee: "Frais scolaires", amount: 150000, mode: "Espèces", cashier: "Mme K", reference: "Deuxième tranche", status: "Validé" },
        { id: "demo-p3", receipt: "REC-2026-0585", date: "13 août 2026 · 14:40", day: "13 août 2026", student: "Emma Martin", className: "Maternelle 3", fee: "Frais scolaires", amount: 300000, mode: "Virement constaté", cashier: "Mme K", reference: "Paiement complet", status: "Validé" },
        { id: "demo-p4", receipt: "REC-2026-0584", date: "12 août 2026 · 11:05", day: "12 août 2026", student: "Lucas Martin", className: "6e A", fee: "Frais scolaires", amount: 200000, mode: "Espèces", cashier: "Mme K", reference: "Première tranche", status: "Validé" },
        { id: "demo-p5", receipt: "REC-2026-0583", date: "11 août 2026 · 08:55", day: "11 août 2026", student: "Chloé Bernard", className: "2e B", fee: "Frais scolaires", amount: 450000, mode: "Espèces", cashier: "Mme K", reference: "Paiement complet", status: "Validé" },
        { id: "demo-p6", receipt: "REC-2026-0582", date: "10 août 2026 · 13:10", day: "10 août 2026", student: "Aline Martin", className: "4e Humanités A", fee: "Frais scolaires", amount: 600000, mode: "Virement constaté", cashier: "Mme K", reference: "Paiement complet", status: "Validé" }
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
      studentFeeMap: {},
      students: [],
      studentFees: [],
      studentFinancialProfiles: [],
      selectedFinancialStudentId: "",
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
  function canAccessFeeCatalog(permission) {
    var access = root.SchoolSafeAccess;
    var user = currentSession() || { role: currentRole(), permissions: [] };
    return !!(access && typeof access.canAccess === "function" && access.canAccess(user, permission));
  }
  function canReadFeeCatalog() { return canAccessFeeCatalog("finance.fee.read"); }
  function canManageFeeCatalog() { return canAccessFeeCatalog("finance.fee.manage"); }
  function canReadFinancialDetails() { return isDemoMode() || canReadFeeCatalog(); }
  function canReadFinancialStatus() { return canAccessFeeCatalog("finance.status.read"); }

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

  // ---------------------------------------------------------------------------
  // Chargement des données
  // ---------------------------------------------------------------------------
  async function loadDailyReport(date) {
    if (isDemoMode()) {
      financeState.reportDate = date;
      financeState.dailyReport = null;
      return;
    }
    var api = deps().api;
    if (!api) return;
    try {
      var report = await api.getDailyReport(date);
      financeState.reportDate = date;
      financeState.dailyReport = report || null;
    } catch (e) {
      console.warn("[Finance] rapport journalier échoué", e);
      financeState.dailyReport = null;
    }
  }

  async function loadFinanceData() {
    if (financeState.loading || financeState.loaded) return;
    if (isDemoMode()) {
      financeState.loaded = true;
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
      var markFailedNull = function () { failed = true; return null; };
      var [feeStructures, studentFees, pendingFees, partialFees, report] = await Promise.all([
        api.listFeeStructures().catch(markFailedEmpty),
        api.listStudentFees({}).catch(markFailedEmpty),
        api.listStudentFees({ status: "pending" }).catch(markFailedEmpty),
        api.listStudentFees({ status: "partial" }).catch(markFailedEmpty),
        api.getDailyReport(financeState.reportDate).catch(markFailedNull)
      ]);
      if (failed && !isDemoMode()) {
        financeState.error = "Données indisponibles / connexion impossible";
        financeState.loaded = true;
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
      }
      if (pendingFeesMerged) {
        financeState.pendingStudents = pendingFeesMerged.map(mapStudentFee);
        if (financeState.selectedPendingStudent >= financeState.pendingStudents.length) {
          financeState.selectedPendingStudent = 0;
        }
      }
      if (report) {
        financeState.dailyReport = report;
        financeState.transactions = (report.payments || []).map(mapDailyPayment);
      }
      financeState.loaded = true;
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
    if (/affectation des frais|affecter un frais/i.test(actionName)) return "assignments";
    if (/structure des frais|types de frais|contrôle des frais|échéance/i.test(actionName)) return "fees";
    if (/reçu/i.test(actionName)) return "receipts";
    if (/impayé|solde|en ordre|régulariser/i.test(actionName)) return "balances";
    if (/rapport|clôture|soumettre|export|imprimer/i.test(actionName)) return "reports";
    if (/encaissement|enregistrer un paiement|rechercher un élève|vérifier un paiement|historique du jour|caisse/i.test(actionName)) return "cash";
    if (/frais scolaires|paiement|échéances/i.test(actionName) && currentRole() === "parent") return "family";
    if (/financ|recette|dépense|statistique/i.test(actionName)) return "overview";
    return "";
  }

  function financeTabsForRole() {
    var role = currentRole();
    var tabs;
    if (role === "parent") tabs = ["family"];
    else if (role === "pedagogy") tabs = ["balances"];
    else if (role === "cashier") tabs = ["cash", "receipts", "balances", "reports"];
    else if (role === "school_head") tabs = ["overview", "reports"];
    else if (role === "finance" || role === "admin") tabs = ["overview", "fees", "cash", "receipts", "balances", "reports"];
    else tabs = ["overview"];
    if (canReadFeeCatalog() || canManageFeeCatalog()) {
      if (tabs.indexOf("fees") === -1) tabs.push("fees");
    } else {
      tabs = tabs.filter(function (tab) { return tab !== "fees"; });
    }
    if (canManageFeeCatalog() && tabs.indexOf("assignments") === -1) tabs.push("assignments");
    if (!canManageFeeCatalog()) tabs = tabs.filter(function (tab) { return tab !== "assignments"; });
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
    var d = deps();
    var totals = financeTotals();
    var recent = financeState.transactions.slice(0, 5).map(function (transaction) {
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b><small>' + escapeMarkup(transaction.date) + '</small></td><td>' + escapeMarkup(transaction.student) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + d.money(transaction.amount) + '</b></td><td>' + window.ssBadge({ variant: d.certificationStatusClass(transaction.status), label: transaction.status }) + '</td></tr>';
    }).join("");
    return '<section class="finance-overview"><header><div><span>Pilotage financier</span><h3>Situation enregistrée par l’école</h3><p>Les chiffres proviennent des opérations consignées sur le serveur.</p></div>' + window.ssBadge({ variant: "neutral", icon: "hand-coins", label: "Aucun paiement en ligne" }) + '</header><div class="finance-kpis"><article class="blue"><small>Frais attendus</small><b>' + d.money(totals.expected) + '</b><span>' + financeState.students.length + ' élèves suivis</span></article><article class="green"><small>Montants enregistrés</small><b>' + d.money(totals.paid) + '</b><span>' + totals.rate + ' % de recouvrement</span></article><article class="gold"><small>Soldes à régulariser</small><b>' + d.money(totals.balance) + '</b><span>' + financeState.studentFees.filter(function (studentFee) { return Number(studentFee.amount_remaining || 0) > 0; }).length + ' dossiers</span></article><article class="purple"><small>Encaissements du jour</small><b>' + d.money(totals.todayTotal) + '</b><span>' + totals.today.length + ' opérations</span></article></div><div class="finance-overview-grid"><section class="finance-panel"><header><div><span>Activité récente</span><h3>Derniers enregistrements</h3></div>' + window.ssIconButton({ icon: "arrow-right", variant: "light", title: "Voir les reçus", attrs: { "data-finance-open": "receipts" } }) + '</header>' +
      window.ssTable({
        headers: ['Reçu', 'Élève', 'Mode constaté', 'Montant', 'Statut'],
        rows: recent,
        empty: 'Aucun enregistrement récent.',
        emptyTitle: 'Activité récente',
        responsive: true
      }) +
      '</section><aside class="finance-control"><span><i data-lucide="shield-check"></i></span><h3>Contrôle de la journée</h3><dl><div><dt>Caisse</dt><dd>' + escapeMarkup(financeState.dayStatus) + '</dd></div><div><dt>Dépenses à approuver</dt><dd>' + financeState.expenses.filter(function (expense) { return expense.status === "À approuver"; }).length + '</dd></div><div><dt>Annulations demandées</dt><dd>' + financeState.transactions.filter(function (transaction) { return transaction.status === "Annulation demandée"; }).length + '</dd></div></dl></aside></div></section>';
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
    var role = currentRole();
    var pending = financeState.pendingStudents;
    var student = pending[financeState.selectedPendingStudent] || pending[0] || null;
    var canRecord = (role === "cashier" || role === "admin") && financeState.dayStatus === "Ouverte";
    var studentOptions = pending.map(function (item, index) {
      return '<option value="' + index + '"' + (index === financeState.selectedPendingStudent ? " selected" : "") + '>' + escapeMarkup(item.name + " · " + item.className) + '</option>';
    }).join("");
    var feeOptions = financeState.feeTypes.filter(function (fee) { return fee.active; }).map(function (fee) {
      return '<option>' + escapeMarkup(fee.name + " · " + fee.cycle) + '</option>';
    }).join("");
    var todayRows = financeTotals().today.map(function (transaction) {
      var pdfAction = transaction.status === "Validé" ? window.ssIconButton({ icon: "file-down", variant: "light", title: "Télécharger le reçu PDF", attrs: { "data-export-receipt-id": escapeMarkup(transaction.id) } }) : '' + window.ssBadge({ variant: "warning", icon: "clock-3", label: "Après synchronisation" }) + '';
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b><small>' + escapeMarkup(String(transaction.date).split(" · ").pop()) + '</small></td><td>' + escapeMarkup(transaction.student) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + d.money(transaction.amount) + '</b></td><td>' + window.ssBadge({ variant: d.certificationStatusClass(transaction.status), label: transaction.status }) + '</td><td>' + pdfAction + '</td></tr>';
    }).join("") || '<tr><td colspan="6">Aucune opération enregistrée aujourd’hui.</td></tr>';
    var paymentForm = canRecord && student ? '<form class="payment-form" id="paymentForm"><header><span><i data-lucide="hand-coins"></i></span><div><h3>Enregistrer une tranche</h3><p>L’argent est reçu hors de SchoolSafe; cette action consigne uniquement l’opération.</p></div></header><div><label>Type de frais<select name="fee" required>' + feeOptions + '</select></label><label>Montant reçu en FC<input name="amount" type="number" min="1000" max="' + student.balance + '" step="1000" required placeholder="Montant"></label><label>Mode constaté<select name="mode"><option value="cash">Espèces</option><option value="card">Carte bancaire</option><option value="check">Chèque</option><option value="bank_transfer">Virement constaté</option><option value="mobile_money">Mobile money</option><option value="other">Autre moyen constaté</option></select></label><label>Référence ou observation<input name="reference" required placeholder="Ex. Deuxième tranche"></label></div>' + window.ssButton({ label: "Enregistrer et préparer le reçu", icon: "badge-check", type: "submit", disabled: student.balance <= 0 }) + '</form>' : '<aside class="finance-readonly"><i data-lucide="' + (financeState.dayStatus === "Ouverte" ? "eye" : "lock-keyhole") + '"></i><p>' + (financeState.dayStatus === "Ouverte" ? "Consultation et contrôle uniquement. Les encaissements sont exécutés par l’Agent de caisse autorisé." : "La journée a été soumise. Aucun nouvel encaissement ne peut être ajouté dans cet aperçu.") + '</p></aside>';
    var studentPanel = student ? '<section class="finance-panel student-finance-panel"><header><div><span>Recherche du dossier</span><h3>Situation de l’élève</h3></div>' + window.ssBadge({ variant: d.certificationStatusClass(student.status), label: student.status }) + '</header><label class="finance-student-picker">Élève<select id="financeStudentSelect">' + studentOptions + '</select></label><article class="student-finance-card"><span class="student-avatar large">' + student.initials + '</span><div><small>' + escapeMarkup(student.className + " · " + student.sex) + '</small><h3>' + escapeMarkup(student.name) + '</h3><p>' + escapeMarkup(student.guardian) + '</p></div></article><dl class="student-finance-facts"><div><dt>Frais attendus</dt><dd>' + d.money(student.expected) + '</dd></div><div><dt>Enregistré</dt><dd>' + d.money(student.paid) + '</dd></div><div><dt>Solde</dt><dd>' + d.money(student.balance) + '</dd></div></dl></section>' : '<section class="finance-panel student-finance-panel"><header><div><span>Recherche du dossier</span><h3>Situation de l’élève</h3></div></header>' + window.ssState({ type: "empty", title: "Aucun dossier", message: "Aucun dossier avec solde à encaisser.", size: "compact" }) + '</section>';
    return '<div class="cash-workspace"><section class="cashier-layout">' + studentPanel + paymentForm + '</section><section class="finance-panel"><header><div><span>Journal de caisse</span><h3>Opérations du jour</h3></div><b>' + d.money(financeTotals().todayTotal) + '</b></header>' +
      window.ssTable({
        headers: ['Reçu', 'Élève', 'Mode constaté', 'Montant', 'Statut', 'PDF'],
        rows: todayRows,
        empty: 'Aucune opération enregistrée aujourd’hui.',
        emptyTitle: 'Journal de caisse',
        responsive: true
      }) +
      '</section></div>';
  }

  function renderReceipts() {
    var d = deps();
    var role = currentRole();
    var canRequestCancellation = role === "cashier" || role === "admin";
    var rows = financeState.transactions.map(function (transaction) {
      var cancellationButton = canRequestCancellation && transaction.status === "Validé" ? window.ssIconButton({ icon: "circle-x", variant: "danger", title: "Demander l’annulation", attrs: { "data-cancel-payment-id": escapeMarkup(transaction.id) } }) : "";
      var receiptAction = transaction.status === "Validé" ? window.ssIconButton({ icon: "file-down", variant: "light", title: "Télécharger le reçu PDF", attrs: { "data-export-receipt-id": escapeMarkup(transaction.id) } }) : '' + window.ssBadge({ variant: "warning", icon: "clock-3", label: "PDF après synchronisation" }) + '';
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b><small>' + escapeMarkup(transaction.date) + '</small></td><td><b>' + escapeMarkup(transaction.student) + '</b><small>' + escapeMarkup(transaction.className) + '</small></td><td>' + escapeMarkup(transaction.fee) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + d.money(transaction.amount) + '</b></td><td>' + window.ssBadge({ variant: d.certificationStatusClass(transaction.status), label: transaction.status }) + '</td><td><div class="finance-row-actions">' + receiptAction + cancellationButton + '</div></td></tr>';
    }).join("");
    return '<section class="finance-panel receipt-register"><header><div><span>Documents financiers</span><h3>Reçus et opérations</h3><p>Un reçu reste traçable même lorsqu’une annulation est demandée.</p></div>' + window.ssBadge({ variant: "neutral", icon: "shield-check", label: "PDF avec logo" }) + '</header><aside class="finance-audit-note"><i data-lucide="history"></i><p>Une demande d’annulation ne supprime jamais l’écriture. Elle doit être contrôlée et approuvée dans le circuit financier.</p></aside>' +
      window.ssTable({
        headers: ['Reçu', 'Élève', 'Frais', 'Mode constaté', 'Montant', 'Statut', 'Actions'],
        rows: rows,
        empty: 'Aucun reçu ou opération enregistrée.',
        emptyTitle: 'Reçus et opérations',
        responsive: true
      }) +
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
    var currencies = selectedProfile.fees.map(function (fee) { return fee.currency; }).filter(Boolean).filter(function (currency, index, values) { return values.indexOf(currency) === index; });
    var amountSummary = currencies.length === 1
      ? '<dl class="student-finance-facts"><div><dt>Attendu cumulé</dt><dd>' + formatFinancialAmount(summary.expected, currencies[0]) + '</dd></div><div><dt>Payé cumulé</dt><dd>' + formatFinancialAmount(summary.paidAmount, currencies[0]) + '</dd></div><div><dt>Restant cumulé</dt><dd>' + formatFinancialAmount(summary.remaining, currencies[0]) + '</dd></div></dl>'
      : '<aside class="finance-audit-note"><i data-lucide="circle-alert"></i><p>Montants cumulés indisponibles : les frais affichés utilisent plusieurs devises. Consultez chaque ligne individuellement.</p></aside>';
    var feesTable = visibleFees.length ? window.ssTable({ headers: ["Type de frais", "Statut", "Attendu", "Payé", "Restant", "Échéance"], rows: rows, responsive: true }) : window.ssState({ type: "empty", title: "Aucune obligation financière affectée", message: "Aucun frais du profil ne correspond aux filtres actifs." });

    return '<section class="balance-register"><header><div><span>Situation financière</span><h3>Frais de l’élève</h3><p>Chaque ligne représente un student_fee distinct ; les montants proviennent des données Finance chargées.</p></div><b>' + filteredProfiles.length + ' élève(s)</b></header>' + filters + '<section class="finance-two-column"><aside class="finance-panel">' + studentSelect + identity + summaryMarkup + '</aside><section class="finance-panel"><header><div><span>Résumé de l’élève</span><h3>Obligations financières</h3></div></header>' + summaryMarkup + amountSummary + '</section></section><section class="finance-panel"><header><div><span>Détail individuel</span><h3>Frais applicables</h3><p>Les frais restent indépendants ; la synthèse ne remplace pas cette liste.</p></div></header>' + feesTable + '</section></section>';
  }

  function renderReports() {
    var d = deps();
    var role = currentRole();
    var report = financeState.dailyReport || { total_amount: 0, transaction_count: 0, by_mode: [], by_fee_type: [], payments: [], currency: "USD" };
    var payments = (report.payments || []).map(mapDailyPayment);
    var cashTotal = (report.by_mode || []).reduce(function (sum, item) { return sum + (String(item.mode).toLowerCase() === "cash" ? Number(item.amount || 0) : 0); }, 0);
    var otherTotal = Number(report.total_amount || 0) - cashTotal;
    var modeRows = (report.by_mode || []).map(function (item) {
      return '<tr><td>' + escapeMarkup(modeLabel(item.mode)) + '</td><td><b>' + d.money(item.amount) + '</b></td><td>' + Number(item.count || 0) + '</td></tr>';
    }).join("") || '<tr><td colspan="3">Aucune opération</td></tr>';
    var feeRows = (report.by_fee_type || []).map(function (item) {
      return '<tr><td>' + escapeMarkup(item.fee_label || "-") + '</td><td><b>' + d.money(item.amount) + '</b></td><td>' + Number(item.count || 0) + '</td></tr>';
    }).join("") || '<tr><td colspan="3">Aucune opération</td></tr>';
    var paymentRows = payments.map(function (transaction) {
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b></td><td>' + escapeMarkup(transaction.student) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + d.money(transaction.amount) + '</b></td></tr>';
    }).join("") || '<tr><td colspan="4">Aucune opération enregistrée pour cette date.</td></tr>';
    var canClose = role === "cashier" || role === "admin";
    var closureNotice = financeState.reportClosure ? '' + window.ssBadge({ variant: "success", icon: "lock-keyhole", label: "Caisse clôturée le " + escapeMarkup(formatIsoDateFr(financeState.reportClosure.closure_date)) }) + '' : '' + window.ssBadge({ variant: "info", icon: "eye", label: "Caisse ouverte" }) + '';
    return '<div class="finance-reports"><header class="finance-report-head"><div><span>Contrôle et clôture</span><h3>Rapport de caisse du ' + escapeMarkup(formatIsoDateFr(financeState.reportDate)) + '</h3><p>État préparé pour contrôle à partir des opérations enregistrées sur le serveur.</p></div><div><label class="finance-report-date">Date<input type="date" id="financeReportDate" value="' + escapeMarkup(financeState.reportDate) + '"></label>' + (canClose ? '<label class="finance-report-expected">Montant constaté (FC)<input type="number" id="closeExpectedAmount" min="0" step="1000" value="' + Number(report.total_amount || 0) + '"></label>' + window.ssButton({ label: "Clôturer la caisse", icon: "lock-keyhole", attrs: { id: "closeCashRegister" } }) + '' : '') + closureNotice + '</div></header><div class="finance-kpis report-kpis"><article class="blue"><small>Encaissements</small><b>' + d.money(report.total_amount) + '</b><span>' + Number(report.transaction_count || 0) + ' opérations</span></article><article class="green"><small>Espèces constatées</small><b>' + d.money(cashTotal) + '</b><span>À rapprocher physiquement</span></article><article class="purple"><small>Autres moyens constatés</small><b>' + d.money(otherTotal) + '</b><span>Références conservées</span></article><article class="gold"><small>Devise</small><b>' + escapeMarkup(report.currency || "-") + '</b><span>Rapport journalier</span></article></div><div class="finance-two-column"><section class="finance-panel"><header><div><span>Répartition par mode</span><h3>Modes de paiement</h3></div></header>' + window.ssTable({
        headers: ['Mode', 'Montant', 'Opérations'],
        rows: modeRows,
        empty: 'Aucune opération.',
        emptyTitle: 'Modes de paiement',
        responsive: true
      }) + '</section><section class="finance-panel"><header><div><span>Répartition par frais</span><h3>Types de frais</h3></div></header>' + window.ssTable({
        headers: ['Frais', 'Montant', 'Opérations'],
        rows: feeRows,
        empty: 'Aucune opération.',
        emptyTitle: 'Types de frais',
        responsive: true
      }) + '</section></div><section class="finance-panel"><header><div><span>Détail</span><h3>Opérations de la journée</h3></div></header>' + window.ssTable({
        headers: ['Reçu', 'Élève', 'Mode', 'Montant'],
        rows: paymentRows,
        empty: 'Aucune opération enregistrée pour cette date.',
        emptyTitle: 'Opérations de la journée',
        responsive: true
      }) + '</section></div>';
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
    if (allowedTabs.indexOf(financeState.activeTab) === -1) financeState.activeTab = allowedTabs[0];

    var titles = { overview: "Pilotage financier", fees: "Structure des frais", assignments: "Affectation des frais", cash: "Encaissements", receipts: "Reçus", balances: "Soldes et régularité", reports: "Rapports de caisse", family: "Situation familiale" };
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
      cash: renderCash,
      receipts: renderReceipts,
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
      var student = financeState.pendingStudents[financeState.selectedPendingStudent];
      if (!student) { d.notify("Aucun dossier sélectionné."); return; }
      var data = new FormData(paymentForm);
      var amount = Number(data.get("amount"));
      if (!amount || amount <= 0 || amount > student.balance) { d.notify("Le montant doit être positif et ne pas dépasser le solde de l’élève."); return; }
      var mode = data.get("mode");
      var reference = data.get("reference");
      var api = d.api;
      (api ? api.createPayment({
        student_fee_id: student.id,
        amount: amount,
        currency: student.currency || "CDF",
        mode: mode,
        reference: reference,
        metadata: { mode: mode, reference: reference }
      }) : Promise.reject(new Error("API indisponible"))).then(function (res) {
        d.notify("Paiement enregistré sur le serveur.");
        financeState.loaded = false;
        return loadFinanceData();
      }).then(function () {
        financeState.activeTab = "receipts";
        renderFinanceModule();
      }).catch(function (err) {
        console.warn("[Finance] paiement backend échoué", err);
        if (!isDemoMode()) {
          d.notify("Impossible d’enregistrer le paiement : " + (err.message || "erreur"), "error");
          return;
        }
        var updatedStudent = Object.assign({}, student, {
          paid: student.paid + amount,
          balance: Math.max(0, student.expected - (student.paid + amount))
        });
        updatedStudent.status = updatedStudent.balance === 0 ? "En ordre" : "À régulariser";
        financeState.pendingStudents = financeState.pendingStudents.slice();
        financeState.pendingStudents[financeState.selectedPendingStudent] = updatedStudent;
        financeState.students = financeState.students.map(function (s) {
          return s.id === updatedStudent.id ? Object.assign({}, s, { paid: updatedStudent.paid, balance: updatedStudent.balance, status: updatedStudent.status }) : s;
        });
        var localReference = "PAY-LOCAL-" + Date.now();
        financeState.transactions.unshift({ id: "local-" + Date.now(), receipt: "Après synchronisation", date: formatIsoDateTimeFr(new Date().toISOString()), day: formatIsoDateFr(new Date().toISOString()), student: student.name, className: student.className, fee: String(data.get("fee")).split(" · ")[0], amount: amount, mode: modeLabel(mode), cashier: "—", reference: reference, status: "En attente de synchronisation", localReference: localReference });
        d.queueOfflineOperation("finance", "Paiement de " + student.name, {
          kind: "payment",
          localReference: localReference,
          student: student.name,
          amount: amount,
          fee: String(data.get("fee")).split(" · ")[0]
        }).then(function (operation) {
          if (operation && financeState.transactions[0] && financeState.transactions[0].localReference === localReference) financeState.transactions[0].syncOperationId = operation.id;
        });
        financeState.activeTab = "receipts";
        d.notify(navigator.onLine ? "Paiement consigné. Le reçu sera produit après confirmation." : "Paiement conservé sur cet appareil. Le reçu sera produit au retour de la connexion.");
        renderFinanceModule();
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

    var requestedTab = financeTabForAction(options.action || "") || "overview";
    var allowedTabs = financeTabsForRole();
    financeState.activeTab = allowedTabs.indexOf(requestedTab) === -1 ? allowedTabs[0] : requestedTab;

    bindModuleTabs();
    loadFinanceData().then(function () { renderFinanceModule(); });
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
