// SchoolSafe V2 — Phase K — Communications frontend uniquement.
(function (root) {
  "use strict";

  var activeTab = "dashboard";
  var sessionOverride = null;
  var messageDrafts = [];

  var SECTIONS = [
    { key: "messages", label: "Messages", icon: "messages-square", note: "Composition bornée par permission et portée." },
    { key: "notifications", label: "Notifications", icon: "bell", note: "Préférences personnelles et historique de démonstration." },
    { key: "announcements", label: "Annonces", icon: "megaphone", note: "Brouillons et circuit de relecture frontend." },
    { key: "convocations", label: "Convocations", icon: "mail-plus", note: "Préparation locale sous permission future dédiée." },
    { key: "channels", label: "Site public / WebSync", icon: "globe-2", note: "Publication réelle indisponible sans permission future." },
    { key: "events", label: "Événements", icon: "calendar-days", note: "Aperçu de démonstration, jamais présenté comme publié." }
  ];

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function user() {
    if (sessionOverride) return sessionOverride;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.getCurrentUser === "function") {
      return root.SchoolSafeAppContext.getCurrentUser();
    }
    return { permissions: [], scopes: [], denies: [] };
  }

  function isDemoMode(subject) {
    return !(subject && subject.token);
  }

  function access() {
    return root.SchoolSafeAccess || null;
  }

  function permissionScope(subject, permission) {
    var engine = access();
    if (!engine || typeof engine.canAccess !== "function" || typeof engine.scopeFor !== "function") return null;
    if (!engine.canAccess(subject, permission)) return null;
    return engine.scopeFor(subject, permission);
  }

  function canPrepareMessage(subject) {
    var scope = permissionScope(subject || user(), "communication.message.send");
    return !!(scope && ["own", "own_children", "assigned_classes", "assigned_subjects", "school"].indexOf(scope.type) >= 0);
  }

  function labelForChild(id) {
    var labels = {
      "demo-parent-child-lucas": "Lucas",
      "demo-parent-child-emma": "Emma"
    };
    return labels[id] || "Enfant rattaché";
  }

  function labelForClass(id) {
    var labels = { "demo-class-1": "6e A", "demo-class-2": "5e A" };
    return labels[id] || id;
  }

  function labelForSubject(id) {
    var labels = { "demo-subject-math": "Mathématiques", "demo-subject-french": "Français" };
    return labels[id] || id;
  }

  function messageRecipients(subject) {
    var current = subject || user();
    var scope = permissionScope(current, "communication.message.send");
    if (!scope) return [];
    if (scope.type === "own_children") {
      return (current.childIds || []).filter(function (id) { return id !== "demo-draft-student"; }).map(function (id) {
        return { value: "direction:child:" + id, label: "Direction · au sujet de " + labelForChild(id), contextId: id };
      });
    }
    if (scope.type === "assigned_classes") {
      return (current.assignedClassIds || []).map(function (id) {
        return { value: "class:" + id, label: "Classe affectée · " + labelForClass(id), contextId: id };
      });
    }
    if (scope.type === "assigned_subjects") {
      return (current.assignedSubjectIds || []).map(function (id) {
        return { value: "subject:" + id, label: "Matière affectée · " + labelForSubject(id), contextId: id };
      });
    }
    if (scope.type === "own") return [{ value: "direction:own", label: "Direction · demande personnelle" }];
    if (scope.type === "school") {
      return [
        { value: "direction:school", label: "Direction" },
        { value: "staff:school", label: "Personnel autorisé de l’école" },
        { value: "community:school", label: "Communauté scolaire" }
      ];
    }
    return [];
  }

  function dashboardCard(item) {
    return '<button class="communication-card" type="button" data-communication-open="' + item.key + '">' +
      '<span class="communication-card__icon"><i data-lucide="' + item.icon + '"></i></span>' +
      '<span class="communication-card__copy"><b>' + escapeMarkup(item.label) + '</b><small>' + escapeMarkup(item.note) + '</small></span>' +
      '<span class="communication-card__state">BACKEND_LATER</span>' +
      '<i data-lucide="chevron-right" aria-hidden="true"></i>' +
      '</button>';
  }

  function renderDashboard() {
    var live = !isDemoMode(user());
    return '<section class="communication-dashboard" data-communication-dashboard>' +
      '<header class="communication-view-header"><div><span>' + (live ? "SESSION LIVE" : "DÉMONSTRATION") + '</span>' +
      '<h3>Communication scolaire</h3><p>Messages, annonces, convocations et canaux restent séparés par leurs autorisations propres.</p></div>' +
      '<span class="communication-boundary-chip">' + (live ? "DONNÉES RÉELLES INDISPONIBLES" : "DÉMONSTRATION") + '</span></header>' +
      '<aside class="communication-boundary"><i data-lucide="shield-check"></i><div><b>Frontend uniquement</b><p>Aucun compteur distant, envoi, publication ou distribution n’est simulé comme réel. Toutes les opérations finales restent BACKEND_LATER.</p></div></aside>' +
      '<div class="communication-card-grid">' + SECTIONS.map(dashboardCard).join("") + '</div>' +
      '</section>';
  }

  function renderMessageDenied() {
    return '<section class="communication-denied" data-message-denied><i data-lucide="shield-x"></i><span>ACCÈS REFUSÉ</span><h3>Préparation de message indisponible</h3><p>La permission <b>communication.message.send</b> et une portée effective reconnue sont obligatoires. Un DENY explicite reste prioritaire.</p></section>';
  }

  function renderMessageDraft(draft) {
    return '<article class="communication-draft" data-message-draft><header><div><span>' + escapeMarkup(draft.status) + '</span><b>' + escapeMarkup(draft.subject) + '</b></div><span>' + escapeMarkup(draft.priority) + '</span></header><p>' + escapeMarkup(draft.content) + '</p><footer><span>' + escapeMarkup(draft.recipientLabel) + '</span><span>' + escapeMarkup(draft.date) + '</span>' + (draft.attachment ? '<span>PIÈCE PRÉPARATOIRE · ' + escapeMarkup(draft.attachment) + '</span>' : '') + '</footer></article>';
  }

  function renderMessages() {
    var subject = user();
    var scope = permissionScope(subject, "communication.message.send");
    if (!canPrepareMessage(subject)) return renderMessageDenied();
    var recipients = messageRecipients(subject);
    if (!recipients.length) return renderMessageDenied();
    var live = !isDemoMode(subject);
    var options = recipients.map(function (item) {
      return '<option value="' + escapeMarkup(item.value) + '">' + escapeMarkup(item.label) + '</option>';
    }).join("");
    return '<section class="communication-messages" data-communication-messages><header class="communication-view-header"><div><span>MESSAGE BORNÉ</span><h3>Préparer un message</h3><p data-message-boundary>communication.message.send · portée effective <b>' + escapeMarkup(scope.type) + '</b></p></div><span class="communication-boundary-chip">' + (live ? "SESSION LIVE" : "DÉMONSTRATION") + '</span></header>' +
      '<aside class="communication-boundary"><i data-lucide="shield-check"></i><div><b>Destinataires limités par Access_Law</b><p>Un message de classe ne vaut jamais convocation individuelle. Aucun envoi réseau n’est déclenché ici.</p></div></aside>' +
      '<form class="communication-form" data-message-form><label>Destinataire / groupe<select name="recipient" required>' + options + '</select></label>' +
      '<label>Objet<input name="subject" maxlength="120" required></label>' +
      '<label>Priorité<select name="priority"><option>NORMALE</option><option>HAUTE</option><option>URGENTE</option></select></label>' +
      '<label>Date<input name="date" type="date" required></label>' +
      '<label class="communication-form-wide">Contenu<textarea name="content" rows="5" maxlength="1200" required></textarea></label>' +
      '<label>Pièce jointe préparatoire<input name="attachment" type="file" aria-describedby="messageAttachmentBoundary"></label>' +
      '<label>Statut<select name="status"><option>BROUILLON</option><option>À RELIRE</option></select></label>' +
      '<p class="communication-form-wide" id="messageAttachmentBoundary">Le fichier n’est ni téléversé ni envoyé ; seul son nom est conservé dans la session courante.</p>' +
      '<button class="ss-button ss-button--primary" type="submit">Préparer le brouillon</button>' +
      '<span class="communication-submit-boundary">ENVOI RÉEL — BACKEND_LATER</span></form>' +
      '<div class="communication-draft-list">' + messageDrafts.map(renderMessageDraft).join("") + '</div></section>';
  }

  function bindMessageEvents() {
    var form = document.querySelector("[data-message-form]");
    if (!form || form.__communicationBound) return;
    form.__communicationBound = true;
    var date = form.querySelector('[name="date"]');
    if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var subject = user();
      if (!canPrepareMessage(subject)) {
        renderContent();
        return;
      }
      var allowedRecipients = messageRecipients(subject);
      var data = new FormData(form);
      var recipient = String(data.get("recipient") || "");
      var allowed = allowedRecipients.filter(function (item) { return item.value === recipient; })[0];
      if (!allowed) {
        renderContent();
        return;
      }
      var attachment = form.querySelector('[name="attachment"]');
      var fileName = attachment && attachment.files && attachment.files[0] ? attachment.files[0].name : "";
      messageDrafts = messageDrafts.concat([{
        recipient: recipient,
        recipientLabel: allowed.label,
        subject: String(data.get("subject") || "").trim(),
        content: String(data.get("content") || "").trim(),
        priority: String(data.get("priority") || "NORMALE"),
        date: String(data.get("date") || ""),
        attachment: fileName,
        status: isDemoMode(subject) ? "BROUILLON LOCAL · DÉMONSTRATION" : "BROUILLON DE SESSION · ENVOI RÉEL — BACKEND_LATER"
      }]);
      renderContent();
    });
  }

  function renderFuture() {
    var selected = SECTIONS.filter(function (item) { return item.key === activeTab; })[0];
    return '<section class="communication-future"><i data-lucide="construction"></i><span>DÉMONSTRATION · BACKEND_LATER</span><h3>' +
      escapeMarkup(selected ? selected.label : "Communication") + '</h3><p>Cette surface sera complétée dans le lot Phase K correspondant.</p></section>';
  }

  function refreshTabs() {
    document.querySelectorAll("[data-communication-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-communication-tab") === activeTab);
    });
  }

  function renderContent() {
    var content = document.getElementById("communicationContent");
    if (!content) return;
    content.innerHTML = activeTab === "dashboard" ? renderDashboard() : activeTab === "messages" ? renderMessages() : renderFuture();
    refreshTabs();
    content.querySelectorAll("[data-communication-open]").forEach(function (button) {
      button.addEventListener("click", function () { open(button.getAttribute("data-communication-open")); });
    });
    if (activeTab === "messages") bindMessageEvents();
    if (root.lucide && typeof root.lucide.createIcons === "function") root.lucide.createIcons();
  }

  function bindEvents() {
    document.querySelectorAll("[data-communication-tab]").forEach(function (button) {
      if (button.__communicationBound) return;
      button.__communicationBound = true;
      button.addEventListener("click", function () { open(button.getAttribute("data-communication-tab")); });
    });
  }

  function render(containerId) {
    var module = document.getElementById(containerId || "communicationModule");
    if (!module) return;
    module.hidden = false;
    activeTab = "dashboard";
    bindEvents();
    renderContent();
  }

  function open(tab) {
    activeTab = tab || "dashboard";
    renderContent();
  }

  function close() {
    var module = document.getElementById("communicationModule");
    if (module) module.hidden = true;
    if (root.SchoolSafeAppContext && typeof root.SchoolSafeAppContext.showDashboard === "function") {
      root.SchoolSafeAppContext.showDashboard();
    }
  }

  function setSession(session) {
    sessionOverride = session || null;
    messageDrafts = [];
  }

  root.SchoolSafeCommunication = {
    render: render,
    open: open,
    close: close,
    setSession: setSession,
    isDemoMode: isDemoMode,
    canPrepareMessage: canPrepareMessage,
    messageRecipients: messageRecipients,
    getMessageDrafts: function () { return messageDrafts.map(function (draft) { return Object.assign({}, draft); }); }
  };
})(window);
