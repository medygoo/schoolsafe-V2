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
            window.ssButton({ label: "Entrée", icon: "log-in", attrs: { "data-event-type": "entry" } }) +
            window.ssButton({ label: "Sortie", icon: "log-out", attrs: { "data-event-type": "exit" } }) +
            window.ssButton({ label: "Incident", variant: "secondary", icon: "siren", attrs: { "data-event-type": "incident" } }) +
            window.ssButton({ label: "Caméra", variant: "secondary", icon: "camera", attrs: { id: "cameraToggle" } }) +
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

  function bindCameraToggle(containerId) {
    var container = document.getElementById(containerId);
    var cameraToggle = container.querySelector("#cameraToggle");
    if (!cameraToggle) return;
    cameraToggle.addEventListener("click", function () {
      var cameraContainer = container.querySelector("#cameraContainer");
      if (cameraContainer.classList.contains("hidden")) {
        startCamera(containerId);
      } else {
        stopCamera(containerId);
      }
    });
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
    bindCameraToggle(containerId);
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
        toggle.outerHTML = window.ssButton({ label: "Arrêter", variant: "secondary", icon: "camera-off", attrs: { id: "cameraToggle" } });
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        bindCameraToggle(containerId);
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
      toggle.outerHTML = window.ssButton({ label: "Caméra", variant: "secondary", icon: "camera", attrs: { id: "cameraToggle" } });
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
      bindCameraToggle(containerId);
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
    var config = { size: "compact" };
    if (type === "error") {
      config.type = "error";
      config.title = "Erreur";
      config.message = message;
    } else if (type === "info") {
      config.type = "loading";
      config.title = "Vérification en cours";
      config.message = message;
    } else if (type === "success") {
      config.type = "success";
      config.title = "AUTORISÉ";
      config.message = message;
    } else if (type === "warning") {
      config.type = "unavailable";
      config.title = "PASSAGE MANUEL";
      config.message = message;
    } else {
      config.type = "error";
      config.title = "Erreur";
      config.message = message;
    }
    resultBox.innerHTML = window.ssState(config);
    resultBox.classList.remove("hidden");
  }

  function performScan(containerId) {
    var container = document.getElementById(containerId);
    var input = container.querySelector("#qrPayloadInput");
    var resultBox = container.querySelector("#scanResult");
    var payload = input.value.trim();
    if (!payload) {
      showResult(containerId, "error", "Veuillez saisir un QR.");
      return;
    }

    if (!window.SchoolSafeSecurityAPI) {
      showResult(containerId, "error", "API de sécurité non disponible.");
      return;
    }

    showResult(containerId, "info", "Vérification en cours…");

    window.SchoolSafeSecurityAPI.scan({ qr_payload: payload, event_type: currentEventType }).then(function (data) {
      var isAllowed = data.decision === "allowed";
      var isManual = data.decision === "manual_override";
      var stateConfig = isAllowed
        ? { type: "success", title: "AUTORISÉ", message: "Accès autorisé", size: "compact" }
        : isManual
        ? { type: "unavailable", title: "PASSAGE MANUEL", message: "Passage manuel requis", size: "compact" }
        : { type: "error", title: "REFUSÉ", message: "Accès refusé", size: "compact" };

      var html = window.ssState(stateConfig);
      html += '<div class="scan-result-details">';
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
      resultBox.innerHTML = window.ssState({ type: "error", title: "Erreur", message: err.message, size: "compact" });
    });
  }

  root.SchoolSafeSecurityModule = {
    render: render,
  };
})(window);
