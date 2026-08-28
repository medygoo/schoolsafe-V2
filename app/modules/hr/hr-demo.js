// SchoolSafe V2 — Phase H — Personnel / RH frontend de démonstration uniquement.
(function (root) {
  "use strict";

  var activeTab = "dashboard";
  var sessionOverride = null;
  var staffFilters = { search: "", status: "" };
  var selectedStaffId = "hr-demo-1";
  var STAFF_DRAFTS_STORAGE_KEY = "schoolsafe-v2-hr-staff-drafts";
  var STAFF = [
    { id: "hr-demo-1", hrId: "HR-DEM-001", firstName: "Aline", lastName: "Kalala", job: "Enseignante", service: "Primaire", status: "ACTIF", entryDate: "2023-09-04", contact: "aline.kalala@example.test", assignment: "4e A · Français", history: ["Entrée démo · 04/09/2023", "Affectation démo · Primaire"] },
    { id: "hr-demo-2", hrId: "HR-DEM-002", firstName: "Patrick", lastName: "Mbala", job: "Enseignant", service: "Secondaire", status: "ACTIF", entryDate: "2022-08-29", contact: "patrick.mbala@example.test", assignment: "6e A · Mathématiques", history: ["Entrée démo · 29/08/2022"] },
    { id: "hr-demo-3", hrId: "HR-DEM-003", firstName: "Chantal", lastName: "Lukusa", job: "Secrétaire", service: "Administration", status: "ACTIF", entryDate: "2021-01-11", contact: "chantal.lukusa@example.test", assignment: "Secrétariat scolaire", history: ["Entrée démo · 11/01/2021"] },
    { id: "hr-demo-4", hrId: "HR-DEM-004", firstName: "Daniel", lastName: "Moke", job: "Gardien", service: "Sécurité", status: "ACTIF", entryDate: "2024-02-05", contact: "daniel.moke@example.test", assignment: "Portail principal", history: ["Entrée démo · 05/02/2024"] },
    { id: "hr-demo-5", hrId: "HR-DEM-005", firstName: "Esther", lastName: "Ilunga", job: "Responsable cantine", service: "Cantine", status: "ACTIF", entryDate: "2020-10-19", contact: "esther.ilunga@example.test", assignment: "Service cantine", history: ["Entrée démo · 19/10/2020"] },
    { id: "hr-demo-6", hrId: "HR-DEM-006", firstName: "Jean", lastName: "Kabeya", job: "Agent administratif", service: "Administration", status: "INACTIF", entryDate: "2019-03-18", contact: "jean.kabeya@example.test", assignment: "Archives · historique", history: ["Entrée démo · 18/03/2019", "Passage INACTIF · simulation"] }
  ];
  var CONTRACTS = [
    { id: "contract-demo-1", reference: "CTR-DEM-001", staffId: "hr-demo-1", type: "Exemple durée déterminée", job: "Enseignante", service: "Primaire", startDate: "2023-09-04", endDate: "2027-08-31", status: "ACTIF", deadline: "31/08/2027", observation: "Contrat fictif de démonstration" },
    { id: "contract-demo-2", reference: "CTR-DEM-002", staffId: "hr-demo-2", type: "Exemple renouvelable", job: "Enseignant", service: "Secondaire", startDate: "2022-08-29", endDate: "2026-09-30", status: "À RENOUVELER", deadline: "30/09/2026", observation: "Échéance à examiner" },
    { id: "contract-demo-3", reference: "CTR-DEM-003", staffId: "hr-demo-6", type: "Exemple mission terminée", job: "Agent administratif", service: "Administration", startDate: "2019-03-18", endDate: "2025-06-30", status: "TERMINÉ", deadline: "Terminée", observation: "Historique fictif conservé" }
  ];
  var ASSIGNMENTS = [
    { id: "assignment-demo-1", staffId: "hr-demo-1", service: "Primaire", job: "Enseignante", className: "4e A", subject: "Français", site: "Bâtiment A", startDate: "2026-09-01", endDate: "" },
    { id: "assignment-demo-2", staffId: "hr-demo-2", service: "Secondaire", job: "Enseignant", className: "6e A", subject: "Mathématiques", site: "Bâtiment B", startDate: "2026-09-01", endDate: "" },
    { id: "assignment-demo-3", staffId: "hr-demo-4", service: "Sécurité", job: "Gardien", className: "Sans objet", subject: "Sans objet", site: "Portail principal", startDate: "2026-01-08", endDate: "" }
  ];
  var CONTRACT_DRAFTS_STORAGE_KEY = "schoolsafe-v2-hr-contract-drafts";
  var ASSIGNMENT_DRAFTS_STORAGE_KEY = "schoolsafe-v2-hr-assignment-drafts";

  function readStaffDrafts() {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(STAFF_DRAFTS_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) { return {}; }
  }

  function persistStaffDrafts(drafts) {
    try { root.localStorage.setItem(STAFF_DRAFTS_STORAGE_KEY, JSON.stringify(drafts)); } catch (error) {}
  }

  var staffDrafts = readStaffDrafts();

  function readDraftList(key) {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) { return []; }
  }

  function persistDraftList(key, drafts) {
    try { root.localStorage.setItem(key, JSON.stringify(drafts)); } catch (error) {}
  }

  var contractDrafts = readDraftList(CONTRACT_DRAFTS_STORAGE_KEY);
  var assignmentDrafts = readDraftList(ASSIGNMENT_DRAFTS_STORAGE_KEY);

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

  function selectedStaff() {
    return STAFF.find(function (member) { return member.id === selectedStaffId; }) || STAFF[0];
  }

  function visibleStaff() {
    var search = String(staffFilters.search || "").toLowerCase();
    return STAFF.filter(function (member) {
      if (staffFilters.status && member.status !== staffFilters.status) return false;
      if (search && [member.hrId, member.firstName, member.lastName, member.job, member.service, member.assignment].join(" ").toLowerCase().indexOf(search) < 0) return false;
      return true;
    });
  }

  function renderStaffDenied() {
    return root.ssState({ type: "error", title: "Dossier personnel non autorisé", message: "staff.read avec portée school est obligatoire pour consulter le personnel.", details: "staff.manage ne remplace pas staff.read · DENY explicite prioritaire." });
  }

  function renderStaffOriginal(member) {
    return '<article class="hr-staff-dossier" data-hr-staff-original="' + member.id + '"><header><div><span>' + escapeMarkup(member.hrId) + '</span><h3>' + escapeMarkup(member.firstName + " " + member.lastName) + '</h3></div><span class="hr-status">' + escapeMarkup(member.status) + '</span></header><dl><div><dt>Fonction</dt><dd>' + escapeMarkup(member.job) + '</dd></div><div><dt>Service</dt><dd>' + escapeMarkup(member.service) + '</dd></div><div><dt>Date d’entrée</dt><dd>' + escapeMarkup(member.entryDate) + '</dd></div><div><dt>Contact professionnel fictif</dt><dd>' + escapeMarkup(member.contact) + '</dd></div><div><dt>Affectation principale</dt><dd>' + escapeMarkup(member.assignment) + '</dd></div></dl><section><h4>Historique synthétique</h4><ul>' + member.history.map(function (item) { return '<li>' + escapeMarkup(item) + '</li>'; }).join("") + '</ul><small>Fiche originale de démonstration · aucune suppression d’historique.</small></section></article>';
  }

  function renderStaffDraft(member) {
    var draft = staffDrafts[member.id];
    if (!draft) return "";
    return '<article class="hr-staff-draft" data-hr-staff-draft="' + member.id + '"><header><div><span>BROUILLON LOCAL</span><h4>Modification préparée distincte</h4></div><span class="hr-boundary-chip">BACKEND_LATER</span></header><dl><div><dt>Fonction préparée</dt><dd>' + escapeMarkup(draft.job) + '</dd></div><div><dt>Service préparé</dt><dd>' + escapeMarkup(draft.service) + '</dd></div><div><dt>Statut préparé</dt><dd>' + escapeMarkup(draft.status) + '</dd></div><div><dt>Affectation préparée</dt><dd>' + escapeMarkup(draft.assignment) + '</dd></div></dl><p>' + escapeMarkup(draft.observation || "Aucune observation") + '</p><small>Source conservée : ' + escapeMarkup(member.hrId) + ' · aucune modification officielle.</small></article>';
  }

  function staffOptions(values, current) {
    return values.map(function (value) { return '<option value="' + escapeMarkup(value) + '"' + (value === current ? " selected" : "") + '>' + escapeMarkup(value) + '</option>'; }).join("");
  }

  function renderStaffForm(member) {
    if (!canManageStaff()) return '<aside class="hr-boundary"><i data-lucide="lock-keyhole"></i><p>Lecture seule · staff.manage avec portée school est requis pour préparer un brouillon.</p></aside>';
    var draft = staffDrafts[member.id] || member;
    return '<form class="hr-staff-form" data-hr-staff-form data-staff-id="' + member.id + '"><header><div><span>Préparation locale</span><h4>Modifier sans toucher à l’original</h4></div><span class="hr-boundary-chip">BROUILLON LOCAL</span></header><label>Fonction<input name="job" value="' + escapeMarkup(draft.job) + '" required></label><label>Service<select name="service">' + staffOptions(["Primaire", "Secondaire", "Administration", "Sécurité", "Cantine"], draft.service) + '</select></label><label>Statut<select name="status">' + staffOptions(["ACTIF", "SUSPENDU ADMINISTRATIVEMENT — simulation", "INACTIF", "SORTI"], draft.status) + '</select></label><label>Affectation<input name="assignment" value="' + escapeMarkup(draft.assignment) + '" required></label><label class="hr-form-wide">Observation RH<textarea name="observation" rows="3">' + escapeMarkup(draft.observation || "") + '</textarea></label><button class="ss-button ss-button--primary" type="submit">Préparer la modification</button><p class="hr-form-wide">BACKEND_LATER · aucun statut, licenciement ou dossier officiel n’est modifié.</p></form>';
  }

  function renderStaff() {
    if (!canReadStaff()) return '<section class="hr-staff-denied">' + renderStaffDenied() + '</section>';
    var rows = visibleStaff();
    var member = selectedStaff();
    return '<section class="hr-staff" data-hr-staff><header><div><span>Dossier personnel</span><h3>Personnel visible</h3><p>Données fictives non sensibles · consultation school.</p></div><span class="hr-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><div class="hr-staff-filters"><label>Rechercher<input data-hr-staff-filter="search" type="search" value="' + escapeMarkup(staffFilters.search) + '" placeholder="Nom, identifiant, fonction"></label><label>Statut<select data-hr-staff-filter="status"><option value="">Tous</option>' + staffOptions(["ACTIF", "INACTIF"], staffFilters.status) + '</select></label></div><div class="hr-staff-layout"><div class="hr-staff-list">' + (rows.length ? rows.map(function (item) { return '<button type="button" data-hr-staff-row="' + item.id + '" class="' + (item.id === member.id ? "active" : "") + '"><span><b>' + escapeMarkup(item.firstName + " " + item.lastName) + '</b><small>' + escapeMarkup(item.hrId + " · " + item.job) + '</small></span><span class="hr-status">' + escapeMarkup(item.status) + '</span></button>'; }).join("") : '<p class="hr-empty">Aucun membre ne correspond aux filtres.</p>') + '</div><div class="hr-staff-detail" data-hr-staff-dossier>' + renderStaffOriginal(member) + renderStaffDraft(member) + renderStaffForm(member) + '</div></div></section>';
  }

  function staffById(id) { return STAFF.find(function (member) { return member.id === id; }) || STAFF[0]; }
  function staffMemberOptions(selectedId) {
    return STAFF.map(function (member) { return '<option value="' + member.id + '"' + (member.id === selectedId ? " selected" : "") + '>' + escapeMarkup(member.firstName + " " + member.lastName + " · " + member.hrId) + '</option>'; }).join("");
  }

  function renderContractDrafts() {
    if (!contractDrafts.length) return "";
    return '<section class="hr-draft-list"><header><div><span>BROUILLONS LOCAUX</span><h4>Contrats préparés</h4></div><span class="hr-boundary-chip">BACKEND_LATER</span></header>' + contractDrafts.map(function (draft) { var member = staffById(draft.staffId); return '<article data-hr-contract-draft><small>BROUILLON LOCAL · BACKEND_LATER</small><b>' + escapeMarkup(draft.type) + '</b><span>' + escapeMarkup(member.firstName + " " + member.lastName + " · " + draft.status) + '</span><span>' + escapeMarkup(draft.startDate + " → " + (draft.endDate || "Sans fin préparée")) + '</span><p>' + escapeMarkup(draft.observation || "Aucune observation") + '</p></article>'; }).join("") + '</section>';
  }

  function renderContractForm() {
    if (!canManageStaff()) return '<aside class="hr-boundary"><i data-lucide="lock-keyhole"></i><p>Lecture seule · staff.manage avec portée school est requis pour préparer un contrat.</p></aside>';
    return '<form class="hr-preparation-form" data-hr-contract-form><header><div><span>Préparation locale</span><h4>Nouveau brouillon de contrat</h4></div><span class="hr-boundary-chip">BROUILLON LOCAL</span></header><label>Membre<select name="staffId">' + staffMemberOptions(STAFF[0].id) + '</select></label><label>Type exemple<input name="type" value="Exemple de contrat" required></label><label>Fonction<input name="job" value="Fonction à confirmer" required></label><label>Service<select name="service">' + staffOptions(["Primaire", "Secondaire", "Administration", "Sécurité", "Cantine"], "Primaire") + '</select></label><label>Date début<input name="startDate" type="date" value="2026-09-01" required></label><label>Date fin éventuelle<input name="endDate" type="date"></label><label>Statut<select name="status">' + staffOptions(["BROUILLON", "ACTIF", "À RENOUVELER", "EXPIRÉ", "TERMINÉ"], "BROUILLON") + '</select></label><label>Observation<input name="observation" value=""></label><button class="ss-button ss-button--primary" type="submit">Préparer le contrat</button><p class="hr-form-wide">Types configurables à confirmer · aucune décision ou signature officielle.</p></form>';
  }

  function renderContracts() {
    if (!canReadStaff()) return '<section>' + renderStaffDenied() + '</section>';
    return '<section class="hr-records" data-hr-contracts><header><div><span>Contrats du personnel</span><h3>Échéances visibles</h3><p>Les types présentés comme exemples ne constituent pas une enum juridique fermée.</p></div><span class="hr-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>Référence</th><th>Personnel</th><th>Type</th><th>Fonction / service</th><th>Période</th><th>Statut</th><th>Échéance</th><th>Observation</th></tr></thead><tbody>' + CONTRACTS.map(function (contract) { var member = staffById(contract.staffId); return '<tr data-hr-contract-row="' + contract.id + '"><td>' + escapeMarkup(contract.reference) + '</td><td>' + escapeMarkup(member.firstName + " " + member.lastName) + '</td><td>' + escapeMarkup(contract.type) + '</td><td>' + escapeMarkup(contract.job + " · " + contract.service) + '</td><td>' + escapeMarkup(contract.startDate + " → " + contract.endDate) + '</td><td><span class="hr-status">' + escapeMarkup(contract.status) + '</span></td><td>' + escapeMarkup(contract.deadline) + '</td><td>' + escapeMarkup(contract.observation) + '</td></tr>'; }).join("") + '</tbody></table></div>' + renderContractDrafts() + renderContractForm() + '</section>';
  }

  function renderAssignmentDrafts() {
    if (!assignmentDrafts.length) return "";
    return '<section class="hr-draft-list"><header><div><span>BROUILLONS LOCAUX</span><h4>Affectations projetées</h4></div><span class="hr-boundary-chip">BACKEND_LATER</span></header>' + assignmentDrafts.map(function (draft) { var member = staffById(draft.staffId); return '<article data-hr-assignment-draft><small>BROUILLON LOCAL · BACKEND_LATER</small><b>' + escapeMarkup(member.firstName + " " + member.lastName) + '</b><span>' + escapeMarkup(draft.job + " · " + draft.service) + '</span><span>' + escapeMarkup([draft.className, draft.subject, draft.site].filter(Boolean).join(" · ")) + '</span><p>teacher_assignments backend inchangé · projection RH uniquement.</p></article>'; }).join("") + '</section>';
  }

  function renderAssignmentForm() {
    if (!canManageStaff()) return '<aside class="hr-boundary"><i data-lucide="lock-keyhole"></i><p>Lecture seule · staff.manage avec portée school est requis pour préparer une affectation.</p></aside>';
    return '<form class="hr-preparation-form" data-hr-assignment-form><header><div><span>Préparation locale</span><h4>Nouvelle projection d’affectation</h4></div><span class="hr-boundary-chip">BROUILLON LOCAL</span></header><label>Membre<select name="staffId">' + staffMemberOptions(STAFF[0].id) + '</select></label><label>Service<select name="service">' + staffOptions(["Primaire", "Secondaire", "Administration", "Sécurité", "Cantine"], "Primaire") + '</select></label><label>Fonction<input name="job" value="Fonction projetée" required></label><label>Classe si pertinent<input name="className" value=""></label><label>Matière si pertinent<input name="subject" value=""></label><label>Site / poste<input name="site" value="Site principal"></label><label>Date début<input name="startDate" type="date" value="2026-09-01" required></label><label>Date fin éventuelle<input name="endDate" type="date"></label><button class="ss-button ss-button--primary" type="submit">Préparer l’affectation</button><p class="hr-form-wide">teacher_assignments backend inchangé · BACKEND_LATER.</p></form>';
  }

  function renderAssignments() {
    if (!canReadStaff()) return '<section>' + renderStaffDenied() + '</section>';
    return '<section class="hr-records" data-hr-assignments><header><div><span>Affectations du personnel</span><h3>Projections visibles</h3><p>Lecture RH des affectations fictives sans mutation pédagogique.</p></div><span class="hr-boundary-chip">DÉMONSTRATION · BACKEND_LATER</span></header><div class="hr-table-wrap"><table class="hr-table"><thead><tr><th>Personnel</th><th>Service</th><th>Fonction</th><th>Classe</th><th>Matière</th><th>Site / poste</th><th>Période</th></tr></thead><tbody>' + ASSIGNMENTS.map(function (assignment) { var member = staffById(assignment.staffId); return '<tr data-hr-assignment-row="' + assignment.id + '"><td>' + escapeMarkup(member.firstName + " " + member.lastName) + '</td><td>' + escapeMarkup(assignment.service) + '</td><td>' + escapeMarkup(assignment.job) + '</td><td>' + escapeMarkup(assignment.className) + '</td><td>' + escapeMarkup(assignment.subject) + '</td><td>' + escapeMarkup(assignment.site) + '</td><td>' + escapeMarkup(assignment.startDate + " → " + (assignment.endDate || "En cours")) + '</td></tr>'; }).join("") + '</tbody></table></div>' + renderAssignmentDrafts() + renderAssignmentForm() + '<aside class="hr-boundary"><i data-lucide="shield-check"></i><p>teacher_assignments backend inchangé · aucune affectation pédagogique officielle n’est écrite.</p></aside></section>';
  }

  function bindStaff() {
    var search = document.querySelector('[data-hr-staff-filter="search"]');
    var status = document.querySelector('[data-hr-staff-filter="status"]');
    if (search) search.oninput = function () { staffFilters.search = search.value; renderContent(); };
    if (status) status.onchange = function () { staffFilters.status = status.value; renderContent(); };
    document.querySelectorAll("[data-hr-staff-row]").forEach(function (button) {
      button.onclick = function () { selectedStaffId = button.getAttribute("data-hr-staff-row") || selectedStaffId; renderContent(); };
    });
    var form = document.querySelector("[data-hr-staff-form]");
    if (form) form.onsubmit = function (event) {
      event.preventDefault();
      var data = new root.FormData(form);
      var member = selectedStaff();
      staffDrafts[member.id] = {
        sourceStaffId: member.id,
        job: String(data.get("job") || member.job),
        service: String(data.get("service") || member.service),
        status: String(data.get("status") || member.status),
        assignment: String(data.get("assignment") || member.assignment),
        observation: String(data.get("observation") || ""),
        preparedAt: new Date().toISOString()
      };
      persistStaffDrafts(staffDrafts);
      renderContent();
    };
  }

  function bindContracts() {
    var form = document.querySelector("[data-hr-contract-form]");
    if (!form) return;
    form.onsubmit = function (event) {
      event.preventDefault();
      var data = new root.FormData(form);
      contractDrafts.push({
        id: "contract-draft-" + Date.now(), staffId: String(data.get("staffId") || ""), type: String(data.get("type") || ""),
        job: String(data.get("job") || ""), service: String(data.get("service") || ""), startDate: String(data.get("startDate") || ""),
        endDate: String(data.get("endDate") || ""), status: String(data.get("status") || "BROUILLON"), observation: String(data.get("observation") || "")
      });
      persistDraftList(CONTRACT_DRAFTS_STORAGE_KEY, contractDrafts);
      renderContent();
    };
  }

  function bindAssignments() {
    var form = document.querySelector("[data-hr-assignment-form]");
    if (!form) return;
    form.onsubmit = function (event) {
      event.preventDefault();
      var data = new root.FormData(form);
      assignmentDrafts.push({
        id: "assignment-draft-" + Date.now(), staffId: String(data.get("staffId") || ""), service: String(data.get("service") || ""),
        job: String(data.get("job") || ""), className: String(data.get("className") || ""), subject: String(data.get("subject") || ""),
        site: String(data.get("site") || ""), startDate: String(data.get("startDate") || ""), endDate: String(data.get("endDate") || "")
      });
      persistDraftList(ASSIGNMENT_DRAFTS_STORAGE_KEY, assignmentDrafts);
      renderContent();
    };
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
    content.innerHTML = !canAccessHr() ? renderDenied() : !tabAllowed(activeTab) ? renderDenied() : activeTab === "dashboard" ? renderDashboard() : activeTab === "staff" ? renderStaff() : activeTab === "contracts" ? renderContracts() : activeTab === "assignments" ? renderAssignments() : renderFuture();
    bindNavigation();
    if (activeTab === "staff") bindStaff();
    if (activeTab === "contracts") bindContracts();
    if (activeTab === "assignments") bindAssignments();
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
