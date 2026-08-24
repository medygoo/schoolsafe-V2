(function (root) {
  "use strict";

  var campaigns = [];
  var selectedCampaignId = null;

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

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="fee-control-panel">' +
        '<header><span>Contrôle des frais</span><h2>Campagnes de contrôle par QR</h2><p>Sélectionnez une campagne publiée, scannez la carte d’un élève et enregistrez le résultat.</p></header>' +
        '<div id="feeControlCampaigns" class="fee-control-campaigns">' + window.ssState({ type: "loading", title: "Chargement...", message: "Chargement des campagnes…" }) + '</div>' +
        '<div id="feeControlScan" class="fee-control-scan hidden">' +
          '<h3>Scanner un élève</h3>' +
          '<label>QR payload<input type="text" id="feeControlQrInput" placeholder="schoolsafe://card/..." autocomplete="off"></label>' +
          '<div class="fee-control-result-options">' +
            window.ssButton({ label: "En règle", icon: "badge-check", attrs: { "data-result": "ok" } }) +
            window.ssButton({ label: "Paiement partiel", variant: "secondary", icon: "hand-coins", attrs: { "data-result": "partial" } }) +
            window.ssButton({ label: "Non en règle", variant: "danger", icon: "badge-alert", attrs: { "data-result": "unpaid" } }) +
            window.ssButton({ label: "Exempté", variant: "secondary", icon: "shield-check", attrs: { "data-result": "exempted" } }) +
            window.ssButton({ label: "Anomalie", variant: "secondary", icon: "triangle-alert", attrs: { "data-result": "anomaly" } }) +
          '</div>' +
          '<div id="feeControlResult" class="scan-result hidden"></div>' +
        '</div>' +
      '</div>';
    bind(containerId);
    loadCampaigns();
  }

  function bind(containerId) {
    var container = document.getElementById(containerId);
    container.querySelectorAll("[data-result]").forEach(function (button) {
      button.addEventListener("click", function () {
        var result = button.getAttribute("data-result");
        performScan(containerId, result);
      });
    });
    var input = container.querySelector("#feeControlQrInput");
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          performScan(containerId, "ok");
        }
      });
    }
  }

  function loadCampaigns() {
    var box = document.getElementById("feeControlCampaigns");
    if (!window.SchoolSafeFinanceAPI) {
      box.innerHTML = window.ssState({ type: "unavailable", title: "Service indisponible", message: "API Finance non disponible." });
      return;
    }
    window.SchoolSafeFinanceAPI.listCampaigns().then(function (data) {
      campaigns = data || [];
      var published = campaigns.filter(function (c) { return c.status === "published"; });
      if (!published.length) {
        box.innerHTML = window.ssState({ type: "empty", title: "Aucune campagne publiée", message: "L’Administrateur général doit d’abord créer et publier une campagne." });
        return;
      }
      var html = '<h3>Campagnes actives</h3><ul>';
      published.forEach(function (c) {
        var fee = c.fee_structures || {};
        html += '<li><label><input type="radio" name="feeControlCampaign" value="' + escapeHtml(c.id) + '"' + (selectedCampaignId === c.id ? " checked" : "") + '> ' +
          '<b>' + escapeHtml(c.label) + '</b> · ' + escapeHtml(fee.label || "Frais") + ' · ' + money(fee.amount, fee.currency) +
          '</label></li>';
      });
      html += '</ul>';
      box.innerHTML = html;
      box.querySelectorAll("input[name='feeControlCampaign']").forEach(function (radio) {
        radio.addEventListener("change", function () {
          selectedCampaignId = this.value;
          document.getElementById("feeControlScan").classList.remove("hidden");
        });
      });
      if (selectedCampaignId) document.getElementById("feeControlScan").classList.remove("hidden");
    }).catch(function (err) {
      box.innerHTML = window.ssState({ type: "error", title: "Erreur", message: err.message });
    });
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
