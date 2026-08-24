(function (root) {
  "use strict";

  var campaigns = [];
  var selectedCampaignId = null;
  var demoAuthorizedCampaigns = [
    {
      id: "demo-control-september",
      label: "Contrôle du portail · septembre",
      starts_at: "2026-09-01",
      ends_at: "2026-09-30",
      status: "published",
      description: "Vérifiez la carte de l’élève au portail et appliquez la consigne de contrôle affichée."
    }
  ];
  // FE-FIN-08A : projection locale explicitement démo. Elle ne remplace ni
  // l'identification sécurisée, ni le calcul serveur du résultat futur.
  var demoScanRecords = {
    "schoolsafe://card/DEMO-PAID/verification": { name: "Amina Kalonji", matricule: "DEMO-001", className: "5e primaire", studentFeeStatus: "paid" },
    "schoolsafe://card/DEMO-PARTIAL/verification": { name: "Noah Ilunga", matricule: "DEMO-002", className: "4e primaire", studentFeeStatus: "partial" },
    "schoolsafe://card/DEMO-PENDING/verification": { name: "Sarah Mbuyi", matricule: "DEMO-003", className: "3e primaire", studentFeeStatus: "pending" },
    "schoolsafe://card/DEMO-EXEMPTED/verification": { name: "David Tshibangu", matricule: "DEMO-004", className: "6e primaire", studentFeeStatus: "exempted" },
    "schoolsafe://card/DEMO-NO-FEE/verification": { name: "Lina Kabasele", matricule: "DEMO-005", className: "2e primaire", studentFeeStatus: null }
  };
  // FE-FIN-09A : projection locale explicitement démo de l'historique
  // autorisé. Elle reste distincte de tout historique serveur futur et ne
  // contient aucune donnée financière ou issue du module Sécurité.
  var demoAuthorizedHistory = [
    { reference: "DÉMO-HIST-001", scanned_at: "2026-09-08 07:42", campaign: { id: "demo-history-gate", label: "Portail · septembre" }, student: { display_name: "Amina Kalonji", matricule: "DEMO-001", class_name: "5e primaire" }, result: "ok", operational_status_snapshot: "paid", duplicate: { is_duplicate: false } },
    { reference: "DÉMO-HIST-002", scanned_at: "2026-09-08 07:51", campaign: { id: "demo-history-gate", label: "Portail · septembre" }, student: { display_name: "Noah Ilunga", matricule: "DEMO-002", class_name: "4e primaire" }, result: "partial", operational_status_snapshot: "partial", duplicate: { is_duplicate: false } },
    { reference: "DÉMO-HIST-003", scanned_at: "2026-09-08 08:03", campaign: { id: "demo-history-gate", label: "Portail · septembre" }, student: { display_name: "Sarah Mbuyi", matricule: "DEMO-003", class_name: "3e primaire" }, result: "unpaid", operational_status_snapshot: "pending", duplicate: { is_duplicate: true, reference: "DÉMO-HIST-002" } },
    { reference: "DÉMO-HIST-004", scanned_at: "2026-09-08 08:16", campaign: { id: "demo-history-library", label: "Bibliothèque · septembre" }, student: { display_name: "David Tshibangu", matricule: "DEMO-004", class_name: "6e primaire" }, result: "exempted", operational_status_snapshot: "exempted", duplicate: { is_duplicate: false } },
    { reference: "DÉMO-HIST-005", scanned_at: "2026-09-08 08:25", campaign: { id: "demo-history-gate", label: "Portail · septembre" }, student: { display_name: "Lina Kabasele", matricule: "DEMO-005", class_name: "2e primaire" }, result: "anomaly", anomaly: { code: "NO_STUDENT_FEE", note: "Aucune obligation démo configurée." }, duplicate: { is_duplicate: false } }
  ];
  var historyFilters = { campaign: "", result: "", search: "" };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function money(amount, currency) {
    var value = Number(amount || 0);
    var sym = currency === "USD" ? "$" : "FC";
    return sym + " " + value.toLocaleString("fr-FR");
  }

  function hasValidSessionToken() {
    try {
      var raw = root.localStorage.getItem("schoolsafe-v2-session");
      if (!raw) return false;
      var session = JSON.parse(raw);
      return !!(session && session.token);
    } catch (e) { return false; }
  }

  function isDemoMode() {
    if (root.schoolSafeDemoMode === true) return true;
    var host = String(root.location && root.location.hostname || "").toLowerCase();
    return (host === "localhost" || host === "127.0.0.1") && !hasValidSessionToken();
  }

  function controlAccessUser() {
    if (root.currentSession) return root.currentSession;
    return { role: root.currentDemoRole || "", permissions: [] };
  }

  // FE-FIN-07B : garde transitoire, sans élargir les droits ni décider par rôle.
  function canOpenFeeControl() {
    var access = root.SchoolSafeAccess;
    return !!(access && typeof access.canAccessAny === "function" && access.canAccessAny(controlAccessUser(), [
      "finance.control.read",
      "finance.control.manage",
      "finance.control.scan"
    ]));
  }

  function formatPeriod(campaign) {
    if (!campaign.starts_at || !campaign.ends_at) return "Période à confirmer";
    return escapeHtml(campaign.starts_at) + " → " + escapeHtml(campaign.ends_at);
  }

  function renderScannerBacklog() {
    return '<div id="feeControlScan" class="fee-control-scan">' +
      '<h3>Scanner un élève</h3>' +
      window.ssState({
        type: "unavailable",
        title: "Scanner sécurisé — BACKEND_LATER",
        message: "Le scan et le résultat opérationnel seront connectés après validation du contrat sécurisé.",
        details: "Aucun appel Sécurité ni résultat financier n’est déclenché depuis cette surface."
      }) +
      '<div id="feeControlResult" class="scan-result hidden"></div>' +
    '</div>';
  }

  function renderDemoScanner() {
    return '<div id="feeControlScan" class="fee-control-scan">' +
      '<header><span>Scanner démo</span><h3>Résultat opérationnel simulé</h3><p>Utilisez uniquement un QR de démonstration. Ces résultats ne proviennent pas du serveur.</p></header>' +
      window.ssBadge({ variant: "info", label: "DÉMO" }) +
      window.ssState({ type: "ready", title: "Prêt à analyser", message: "Sélectionnez une campagne puis saisissez un QR de démonstration.", size: "compact" }) +
      '<form id="feeControlDemoScanForm" novalidate>' +
        '<label for="feeControlQrInput">QR de démonstration<input type="text" id="feeControlQrInput" placeholder="schoolsafe://card/DEMO-PAID/verification" autocomplete="off"></label>' +
        window.ssButton({ label: "Analyser", type: "submit", icon: "scan-line" }) +
      '</form>' +
      '<div id="feeControlResult" class="scan-result hidden" aria-live="polite"></div>' +
    '</div>';
  }

  function renderScanner() {
    return isDemoMode() ? renderDemoScanner() : renderScannerBacklog();
  }

  function historyResult(result) {
    return {
      ok: { label: "En règle", variant: "success" },
      partial: { label: "Paiement partiel", variant: "warning" },
      unpaid: { label: "Non en règle", variant: "danger" },
      exempted: { label: "Exempté", variant: "success" },
      anomaly: { label: "Anomalie", variant: "danger" }
    }[result] || { label: "Anomalie", variant: "danger" };
  }

  function renderHistoryBacklog() {
    return '<section id="feeControlHistory" class="fee-control-history">' +
      '<header><span>Historique autorisé</span><h3>Lecture réelle à venir</h3></header>' +
      window.ssState({
        type: "unavailable",
        title: "Historique autorisé — BACKEND_LATER",
        message: "La lecture réelle attend une permission dédiée, des filtres serveur et une pagination sûre.",
        details: "Aucune liste globale, aucun scan et aucune donnée Sécurité ne sont chargés depuis cette surface."
      }) +
    '</section>';
  }

  function historyCampaignOptions() {
    var seen = {};
    var options = '<option value="">Toutes les campagnes démo</option>';
    demoAuthorizedHistory.forEach(function (entry) {
      if (seen[entry.campaign.id]) return;
      seen[entry.campaign.id] = true;
      options += '<option value="' + escapeHtml(entry.campaign.id) + '">' + escapeHtml(entry.campaign.label) + '</option>';
    });
    return options;
  }

  function historyResultOptions() {
    return '<option value="">Tous les résultats démo</option>' +
      '<option value="ok">En règle</option>' +
      '<option value="partial">Paiement partiel</option>' +
      '<option value="unpaid">Non en règle</option>' +
      '<option value="exempted">Exempté</option>' +
      '<option value="anomaly">Anomalie</option>';
  }

  function filteredDemoHistory() {
    var query = String(historyFilters.search || "").trim().toLowerCase();
    return demoAuthorizedHistory.filter(function (entry) {
      if (historyFilters.campaign && entry.campaign.id !== historyFilters.campaign) return false;
      if (historyFilters.result && entry.result !== historyFilters.result) return false;
      if (!query) return true;
      return (entry.student.display_name + " " + entry.student.matricule).toLowerCase().indexOf(query) !== -1;
    });
  }

  function renderDemoHistoryRows() {
    var entries = filteredDemoHistory();
    if (!entries.length) {
      return window.ssState({ type: "empty", title: "Aucun contrôle démo", message: "Aucun résultat ne correspond aux filtres locaux." });
    }
    var html = '<div class="ss-table-wrap"><table class="ss-table"><thead><tr><th>Référence</th><th>Date / heure</th><th>Campagne</th><th>Élève</th><th>Résultat</th></tr></thead><tbody>';
    entries.forEach(function (entry) {
      var result = historyResult(entry.result);
      var duplicate = entry.duplicate && entry.duplicate.is_duplicate
        ? '<small>Doublon démo · réf. ' + escapeHtml(entry.duplicate.reference) + '</small>'
        : '';
      var anomaly = entry.result === "anomaly" && entry.anomaly
        ? '<small>' + escapeHtml(entry.anomaly.code) + (entry.anomaly.note ? ' · ' + escapeHtml(entry.anomaly.note) : '') + '</small>'
        : '';
      html += '<tr><td>' + escapeHtml(entry.reference) + duplicate + '</td>' +
        '<td>' + escapeHtml(entry.scanned_at) + '</td>' +
        '<td>' + escapeHtml(entry.campaign.label) + '</td>' +
        '<td><strong>' + escapeHtml(entry.student.display_name) + '</strong><small>Matricule : ' + escapeHtml(entry.student.matricule) + (entry.student.class_name ? ' · ' + escapeHtml(entry.student.class_name) : '') + '</small></td>' +
        '<td>' + window.ssBadge({ variant: result.variant, label: result.label }) + anomaly + '</td></tr>';
    });
    return html + '</tbody></table></div>';
  }

  function renderDemoHistory() {
    return '<section id="feeControlHistory" class="fee-control-history">' +
      '<header><div><span>Historique autorisé</span><h3>Projection locale non sensible</h3><p>Les lignes, filtres et références ci-dessous sont fictifs et servent uniquement à visualiser le futur historique autorisé.</p></div>' + window.ssBadge({ variant: "info", label: "DÉMO" }) + '</header>' +
      '<div class="fee-control-history-filters">' +
        '<label for="feeControlHistoryCampaign">Campagne démo<select id="feeControlHistoryCampaign">' + historyCampaignOptions() + '</select></label>' +
        '<label for="feeControlHistoryResult">Résultat démo<select id="feeControlHistoryResult">' + historyResultOptions() + '</select></label>' +
        '<label for="feeControlHistorySearch">Rechercher un élève démo<input type="search" id="feeControlHistorySearch" placeholder="Nom ou matricule" autocomplete="off"></label>' +
      '</div>' +
      '<div id="feeControlHistoryList" aria-live="polite">' + renderDemoHistoryRows() + '</div>' +
    '</section>';
  }

  function renderHistory() {
    return isDemoMode() ? renderDemoHistory() : renderHistoryBacklog();
  }

  function refreshDemoHistory() {
    var list = document.getElementById("feeControlHistoryList");
    if (list) list.innerHTML = renderDemoHistoryRows();
  }

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="fee-control-panel">' +
        '<header><span>Contrôle des frais</span><h2>Mes campagnes autorisées</h2><p>Consultez la consigne de campagne. Le scan sécurisé et le résultat seront raccordés dans un lot distinct.</p></header>' +
        '<div id="feeControlCampaigns" class="fee-control-campaigns">' + window.ssState({ type: "loading", title: "Chargement...", message: "Chargement des campagnes…" }) + '</div>' +
        renderScanner() +
        renderHistory() +
      '</div>';
    loadCampaigns();
    bind(containerId);
  }

  function bind(containerId) {
    var container = document.getElementById(containerId);
    container.querySelectorAll("input[name='feeControlCampaign']").forEach(function (radio) {
      radio.addEventListener("change", function () { selectedCampaignId = this.value; });
    });
    var demoForm = container.querySelector("#feeControlDemoScanForm");
    var qrInput = container.querySelector("#feeControlQrInput");
    if (demoForm && qrInput) {
      demoForm.addEventListener("submit", function (event) {
        event.preventDefault();
        performDemoScan(containerId);
      });
      qrInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        performDemoScan(containerId);
      });
    }
    var historyCampaign = container.querySelector("#feeControlHistoryCampaign");
    var historyResult = container.querySelector("#feeControlHistoryResult");
    var historySearch = container.querySelector("#feeControlHistorySearch");
    if (historyCampaign) historyCampaign.addEventListener("change", function () { historyFilters.campaign = this.value; refreshDemoHistory(); });
    if (historyResult) historyResult.addEventListener("change", function () { historyFilters.result = this.value; refreshDemoHistory(); });
    if (historySearch) historySearch.addEventListener("input", function () { historyFilters.search = this.value; refreshDemoHistory(); });
  }

  function loadCampaigns() {
    var box = document.getElementById("feeControlCampaigns");
    if (!canOpenFeeControl()) {
      box.innerHTML = window.ssState({ type: "denied", title: "Contrôle des frais non autorisé", message: "Une permission de contrôle des frais est requise." });
      return;
    }
    if (!isDemoMode()) {
      box.innerHTML = window.ssState({
        type: "unavailable",
        title: "Mes campagnes autorisées — BACKEND_LATER",
        message: "Le serveur doit filtrer les campagnes par contrôleur autorisé, portée et période avant leur affichage.",
        details: "La liste globale de l’école n’est jamais présentée comme une liste autorisée."
      });
      return;
    }

    campaigns = demoAuthorizedCampaigns.slice();
    if (!campaigns.length) {
      box.innerHTML = window.ssState({ type: "empty", title: "Aucune campagne démo", message: "Aucune projection démo non sensible n’est disponible." });
      return;
    }
    if (!campaigns.some(function (campaign) { return campaign.id === selectedCampaignId; })) selectedCampaignId = campaigns[0].id;
    var html = '<header><div><span>Mes campagnes autorisées</span><h3>Projection non sensible</h3><p>Les campagnes ci-dessous sont uniquement une visualisation démo.</p></div>' + window.ssBadge({ variant: "info", label: "DÉMO" }) + '</header><ul>';
    campaigns.forEach(function (campaign) {
      html += '<li><label><input type="radio" name="feeControlCampaign" value="' + escapeHtml(campaign.id) + '"' + (selectedCampaignId === campaign.id ? " checked" : "") + '> ' +
        '<b>' + escapeHtml(campaign.label) + '</b> · ' + formatPeriod(campaign) + ' · Statut déclaré : ' + escapeHtml(campaign.status) +
        '</label><p><strong>Consigne :</strong> ' + escapeHtml(campaign.description) + '</p></li>';
    });
    box.innerHTML = html + '</ul>';
  }

  function parseQrPayload(payload) {
    var match = payload.match(/^schoolsafe:\/\/card\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    return { cardNumber: match[1], signature: match[2] };
  }

  function demoResultForStatus(studentFeeStatus) {
    var results = {
      paid: { code: "ok", title: "En règle", state: "success", message: "La situation de démonstration est conforme." },
      partial: { code: "partial", title: "Paiement partiel", state: "unavailable", message: "La situation de démonstration requiert une régularisation." },
      pending: { code: "unpaid", title: "Non en règle", state: "error", message: "La situation de démonstration n’est pas régularisée." },
      exempted: { code: "exempted", title: "Exempté", state: "success", message: "Une exemption de démonstration est appliquée." }
    };
    return results[studentFeeStatus] || { code: "anomaly", title: "Anomalie", state: "error", message: "NO_STUDENT_FEE — aucune obligation de démonstration n’est configurée pour cet élève." };
  }

  function renderDemoControlResult(resultBox, record) {
    var outcome = demoResultForStatus(record.studentFeeStatus);
    var identity = '<p><strong>' + escapeHtml(record.name) + '</strong> · Matricule : ' + escapeHtml(record.matricule) + ' · Classe : ' + escapeHtml(record.className) + '</p>';
    resultBox.innerHTML = identity + window.ssState({ type: outcome.state, title: outcome.title, message: outcome.message, size: "compact" });
    resultBox.classList.remove("hidden");
  }

  function performDemoScan(containerId) {
    var container = document.getElementById(containerId);
    var input = container.querySelector("#feeControlQrInput");
    var resultBox = container.querySelector("#feeControlResult");
    var payload = input.value.trim();
    if (!selectedCampaignId) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: "Veuillez d’abord sélectionner une campagne.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }
    if (!payload) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: "Veuillez saisir un QR de démonstration.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }
    if (!parseQrPayload(payload)) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "QR invalide", message: "Le format du QR de démonstration n’est pas reconnu.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }
    resultBox.innerHTML = window.ssState({ type: "loading", title: "Analyse démo", message: "Résolution de la projection de démonstration…", size: "compact" });
    resultBox.classList.remove("hidden");
    Promise.resolve().then(function () {
      var record = demoScanRecords[payload];
      if (!record) {
        resultBox.innerHTML = window.ssState({ type: "error", title: "QR démo inconnu", message: "Ce QR n’existe pas dans la projection de démonstration.", size: "compact" });
        return;
      }
      renderDemoControlResult(resultBox, record);
      input.value = "";
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    });
  }

  function performScan(containerId, result) {
    var container = document.getElementById(containerId);
    var input = container.querySelector("#feeControlQrInput");
    var resultBox = container.querySelector("#feeControlResult");
    var payload = input.value.trim();
    if (!selectedCampaignId) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: "Veuillez d’abord sélectionner une campagne.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }
    if (!payload) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: "Veuillez saisir un QR.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }
    var parsed = parseQrPayload(payload);
    if (!parsed) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: "Format de QR non reconnu.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }

    if (!window.SchoolSafeSecurityAPI || !window.SchoolSafeFinanceAPI) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: "API non disponible.", size: "compact" });
      resultBox.classList.remove("hidden");
      return;
    }

    resultBox.innerHTML = window.ssState({ type: "loading", title: "Vérification du QR", message: "Analyse en cours…", size: "compact" });
    resultBox.classList.remove("hidden");

    // Étape 1 : vérifier le QR via l’API sécurité pour identifier l’élève
    window.SchoolSafeSecurityAPI.scan({ qr_payload: payload, event_type: "incident" }).then(function (scanData) {
      var studentId = scanData.student && scanData.student.id;
      if (!studentId) throw new Error("Élève non identifié");
      // Étape 2 : enregistrer le résultat du contrôle des frais
      return window.SchoolSafeFinanceAPI.createScan({
        campaign_id: selectedCampaignId,
        student_id: studentId,
        result: result,
      });
    }).then(function (controlData) {
      var statusType = controlData.result === "ok" || controlData.result === "exempted" ? "success" : controlData.result === "partial" ? "unavailable" : "error";
      var statusText = { ok: "EN RÈGLE", partial: "PAIEMENT PARTIEL", unpaid: "NON EN RÈGLE", exempted: "EXEMPTÉ", anomaly: "ANOMALIE" }[controlData.result];
      resultBox.innerHTML = window.ssState({ type: statusType, title: statusText, message: "Contrôle enregistré sous référence " + escapeHtml(controlData.id.slice(0, 8)), size: "compact" });
      input.value = "";
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }).catch(function (err) {
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: escapeHtml(err.message), size: "compact" });
    });
  }

  root.SchoolSafeFeeControlModule = {
    render: render,
  };
})(window);
