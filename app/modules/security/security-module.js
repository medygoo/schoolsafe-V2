(function (root) {
  "use strict";

  var currentEventType = "entry";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var scanStream = null;
  var scanTimeout = null;

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="security-scan-panel">' +
        '<header><span>Contrôle d’accès</span><h2>Scanner une carte SchoolSafe</h2><p>Saisissez le contenu du QR, utilisez un lecteur connecté ou activez la caméra.</p></header>' +
        '<div class="scan-form">' +
          '<label>QR payload<input type="text" id="qrPayloadInput" placeholder="schoolsafe://card/..." autocomplete="off"></label>' +
          '<div class="scan-actions">' +
            '<button type="button" class="primary-button" data-event-type="entry"><i data-lucide="log-in"></i> Entrée</button>' +
            '<button type="button" class="primary-button" data-event-type="exit"><i data-lucide="log-out"></i> Sortie</button>' +
            '<button type="button" class="secondary-button" data-event-type="incident"><i data-lucide="siren"></i> Incident</button>' +
            '<button type="button" class="secondary-button" id="cameraToggle"><i data-lucide="camera"></i> Caméra</button>' +
          '</div>' +
        '</div>' +
        '<div id="cameraContainer" class="camera-container hidden">' +
          '<video id="cameraVideo" autoplay playsinline muted></video>' +
          '<p class="camera-hint">Placez le QR code devant la caméra.</p>' +
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
    var cameraToggle = container.querySelector("#cameraToggle");
    if (cameraToggle) {
      cameraToggle.addEventListener("click", function () {
        var cameraContainer = container.querySelector("#cameraContainer");
        if (cameraContainer.classList.contains("hidden")) {
          startCamera(containerId);
        } else {
          stopCamera(containerId);
        }
      });
    }
  }

  function startCamera(containerId) {
    var container = document.getElementById(containerId);
    var cameraContainer = container.querySelector("#cameraContainer");
    var video = container.querySelector("#cameraVideo");
    var toggle = container.querySelector("#cameraToggle");

    if (!window.BarcodeDetector) {
      showResult(containerId, "error", "La détection de QR par caméra n’est pas supportée par ce navigateur. Utilisez la saisie manuelle.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(function (stream) {
        scanStream = stream;
        video.srcObject = stream;
        cameraContainer.classList.remove("hidden");
        toggle.innerHTML = '<i data-lucide="camera-off"></i> Arrêter';
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        detectLoop(containerId);
      })
      .catch(function (err) {
        showResult(containerId, "error", "Impossible d’accéder à la caméra : " + (err.message || err.name));
      });
  }

  function stopCamera(containerId) {
    var container = document.getElementById(containerId);
    var cameraContainer = container.querySelector("#cameraContainer");
    var video = container.querySelector("#cameraVideo");
    var toggle = container.querySelector("#cameraToggle");

    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }
    if (scanStream) {
      scanStream.getTracks().forEach(function (track) { track.stop(); });
      scanStream = null;
    }
    if (video) video.srcObject = null;
    if (cameraContainer) cameraContainer.classList.add("hidden");
    if (toggle) {
      toggle.innerHTML = '<i data-lucide="camera"></i> Caméra';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
  }

  function detectLoop(containerId) {
    var container = document.getElementById(containerId);
    var video = container.querySelector("#cameraVideo");
    if (!video || !scanStream) return;

    var detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    detector.detect(video).then(function (barcodes) {
      if (barcodes.length > 0) {
        var payload = barcodes[0].rawValue;
        var input = container.querySelector("#qrPayloadInput");
        if (input) input.value = payload;
        stopCamera(containerId);
        performScan(containerId);
        return;
      }
      scanTimeout = setTimeout(function () { detectLoop(containerId); }, 300);
    }).catch(function () {
      scanTimeout = setTimeout(function () { detectLoop(containerId); }, 300);
    });
  }

  function showResult(containerId, type, message) {
    var container = document.getElementById(containerId);
    var resultBox = container.querySelector("#scanResult");
    resultBox.innerHTML = '<div class="scan-alert ' + type + '"><p>' + escapeHtml(message) + '</p></div>';
    resultBox.classList.remove("hidden");
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
