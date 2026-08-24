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
      '<label>QR payload<input type="text" id="feeControlQrInput" placeholder="schoolsafe://card/..." autocomplete="off" disabled></label>' +
      '<div class="fee-control-result-options">' +
        window.ssButton({ label: "En règle", icon: "badge-check", disabled: true, attrs: { "data-result": "ok" } }) +
        window.ssButton({ label: "Paiement partiel", variant: "secondary", icon: "hand-coins", disabled: true, attrs: { "data-result": "partial" } }) +
        window.ssButton({ label: "Non en règle", variant: "danger", icon: "badge-alert", disabled: true, attrs: { "data-result": "unpaid" } }) +
        window.ssButton({ label: "Exempté", variant: "secondary", icon: "shield-check", disabled: true, attrs: { "data-result": "exempted" } }) +
        window.ssButton({ label: "Anomalie", variant: "secondary", icon: "triangle-alert", disabled: true, attrs: { "data-result": "anomaly" } }) +
      '</div>' +
      '<div id="feeControlResult" class="scan-result hidden"></div>' +
    '</div>';
  }

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="fee-control-panel">' +
        '<header><span>Contrôle des frais</span><h2>Mes campagnes autorisées</h2><p>Consultez la consigne de campagne. Le scan sécurisé et le résultat seront raccordés dans un lot distinct.</p></header>' +
        '<div id="feeControlCampaigns" class="fee-control-campaigns">' + window.ssState({ type: "loading", title: "Chargement...", message: "Chargement des campagnes…" }) + '</div>' +
        renderScannerBacklog() +
      '</div>';
    loadCampaigns();
    bind(containerId);
  }

  function bind(containerId) {
    var container = document.getElementById(containerId);
    container.querySelectorAll("input[name='feeControlCampaign']").forEach(function (radio) {
      radio.addEventListener("change", function () { selectedCampaignId = this.value; });
    });
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
