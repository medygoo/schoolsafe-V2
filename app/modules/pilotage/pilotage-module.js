(function (root) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleString("fr-FR");
  }

  function renderDashboard(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="pilotage-loading">Chargement du tableau de bord…</div>';
    if (!window.SchoolSafePilotageAPI) {
      container.innerHTML = '<div class="pilotage-error">API Pilotage non disponible.</div>';
      return;
    }
    window.SchoolSafePilotageAPI.dashboard().then(function (data) {
      var html = '<div class="pilotage-dashboard">';
      html += '<header><span>Tableau de bord</span><h2>' + escapeHtml(data.date || "Aujourd’hui") + '</h2></header>';
      html += '<div class="pilotage-kpis">';
      (data.kpis || []).forEach(function (kpi) {
        html += '<article><small>' + escapeHtml(kpi.code) + '</small><b>' + kpi.value + '</b><span>' + escapeHtml(kpi.unit) + '</span></article>';
      });
      html += '</div>';
      if (data.lockdown_active) {
        html += '<div class="pilotage-lockdown">🔒 Lockdown actif</div>';
      }
      html += '<section class="pilotage-alerts"><h3>Alertes critiques récentes</h3>';
      if (data.latest_alerts && data.latest_alerts.length) {
        html += '<ul>';
        data.latest_alerts.forEach(function (alert) {
          html += '<li><span class="severity ' + escapeHtml(alert.severity) + '">' + escapeHtml(alert.severity) + '</span> ' + escapeHtml(alert.title) + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p>Aucune alerte critique.</p>';
      }
      html += '</section></div>';
      container.innerHTML = html;
    }).catch(function (err) {
      container.innerHTML = '<div class="pilotage-error">Erreur : ' + escapeHtml(err.message) + '</div>';
    });
  }

  function renderAlerts(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="pilotage-loading">Chargement des alertes…</div>';
    if (!window.SchoolSafePilotageAPI) {
      container.innerHTML = '<div class="pilotage-error">API Pilotage non disponible.</div>';
      return;
    }
    window.SchoolSafePilotageAPI.listAlerts({ status: "open" }).then(function (result) {
      var html = '<div class="pilotage-alerts-list"><h3>Alertes ouvertes</h3>';
      if (result.data && result.data.length) {
        html += '<ul>';
        result.data.forEach(function (alert) {
          html += '<li data-alert-id="' + escapeHtml(alert.id) + '">' +
            '<span class="severity ' + escapeHtml(alert.severity) + '">' + escapeHtml(alert.severity) + '</span>' +
            '<b>' + escapeHtml(alert.title) + '</b>' +
            '<small>' + escapeHtml(alert.message || "") + ' · ' + formatDate(alert.detected_at) + '</small>' +
            '<div class="alert-actions">' +
              '<button type="button" class="secondary-button small" data-action="ack">Prendre en charge</button>' +
              '<button type="button" class="primary-button dark small" data-action="resolve">Résoudre</button>' +
            '</div>' +
          '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p>Aucune alerte ouverte.</p>';
      }
      html += '</div>';
      container.innerHTML = html;
      bindAlerts(container);
    }).catch(function (err) {
      container.innerHTML = '<div class="pilotage-error">Erreur : ' + escapeHtml(err.message) + '</div>';
    });
  }

  function bindAlerts(container) {
    container.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var li = button.closest("[data-alert-id]");
        var id = li.getAttribute("data-alert-id");
        var action = button.getAttribute("data-action");
        if (!window.SchoolSafePilotageAPI) return;
        var promise = action === "ack"
          ? window.SchoolSafePilotageAPI.acknowledgeAlert(id)
          : window.SchoolSafePilotageAPI.resolveAlert(id, "Traité depuis le tableau de bord");
        promise.then(function () {
          li.remove();
        }).catch(function (err) {
          alert("Erreur : " + err.message);
        });
      });
    });
  }

  root.SchoolSafePilotageModule = {
    renderDashboard: renderDashboard,
    renderAlerts: renderAlerts,
  };
})(window);
