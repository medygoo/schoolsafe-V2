(function (root) {
  "use strict";

  var currentEventType = "entry";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="security-scan-panel">' +
        '<header><span>Contrôle d’accès</span><h2>Scanner une carte SchoolSafe</h2><p>Saisissez le contenu du QR ou utilisez un lecteur de codes connecté.</p></header>' +
        '<div class="scan-form">' +
          '<label>QR payload<input type="text" id="qrPayloadInput" placeholder="schoolsafe://card/..." autocomplete="off"></label>' +
          '<div class="scan-actions">' +
            '<button type="button" class="primary-button" data-event-type="entry"><i data-lucide="log-in"></i> Entrée</button>' +
            '<button type="button" class="primary-button" data-event-type="exit"><i data-lucide="log-out"></i> Sortie</button>' +
            '<button type="button" class="secondary-button" data-event-type="incident"><i data-lucide="siren"></i> Incident</button>' +
          '</div>' +
        '</div>' +
        '<div id="scanResult" class="scan-result hidden"></div>' +
      '</div>';

    bind(containerId);
  }

  function bind(containerId) {
    var container = document.getElementById(containerId);
    container.querySelectorAll("[data-event-type]").forEach(function (button) {
      button.addEventListener("click", function () {
        currentEventType = button.getAttribute("data-event-type");
        performScan(containerId);
      });
    });
    var input = container.querySelector("#qrPayloadInput");
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          performScan(containerId);
        }
      });
    }
  }

  function performScan(containerId) {
    var container = document.getElementById(containerId);
    var input = container.querySelector("#qrPayloadInput");
    var resultBox = container.querySelector("#scanResult");
    var payload = input.value.trim();
    if (!payload) {
      resultBox.innerHTML = '<div class="scan-alert error">Veuillez saisir un QR.</div>';
      resultBox.classList.remove("hidden");
      return;
    }

    if (!window.SchoolSafeSecurityAPI) {
      resultBox.innerHTML = '<div class="scan-alert error">API de sécurité non disponible.</div>';
      resultBox.classList.remove("hidden");
      return;
    }

    resultBox.innerHTML = '<div class="scan-alert info">Vérification en cours…</div>';
    resultBox.classList.remove("hidden");

    window.SchoolSafeSecurityAPI.scan({ qr_payload: payload, event_type: currentEventType }).then(function (data) {
      var decisionClass = data.decision === "allowed" ? "success" : data.decision === "manual_override" ? "warning" : "error";
      var decisionText = data.decision === "allowed" ? "AUTORISÉ" : data.decision === "manual_override" ? "PASSAGE MANUEL" : "REFUSÉ";
      var html = '<div class="scan-alert ' + decisionClass + '"><h3>' + decisionText + '</h3>';
      if (data.student) {
        html += '<p><b>' + escapeHtml(data.student.first_name + " " + data.student.last_name) + '</b> · ' + escapeHtml(data.student.matricule) + '</p>';
        html += '<p>' + escapeHtml(data.student.class_name || "") + '</p>';
      }
      if (data.reason) {
        html += '<p>Motif : ' + escapeHtml(data.reason) + '</p>';
      }
      if (data.authorized_persons && data.authorized_persons.length) {
        html += '<div class="authorized-persons"><h4>Personnes autorisées</h4><ul>';
        data.authorized_persons.forEach(function (person) {
          html += '<li>' + escapeHtml(person.full_name) + ' <small>' + escapeHtml(person.guardian_type) + '</small></li>';
        });
        html += '</ul></div>';
      }
      if (data.alert) {
        html += '<p class="alert-info">🚨 ' + escapeHtml(data.alert.title) + '</p>';
      }
      html += '</div>';
      resultBox.innerHTML = html;
      input.value = "";
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }).catch(function (err) {
      resultBox.innerHTML = '<div class="scan-alert error"><h3>Erreur</h3><p>' + escapeHtml(err.message) + '</p></div>';
    });
  }

  root.SchoolSafeSecurityModule = {
    render: render,
  };
})(window);
