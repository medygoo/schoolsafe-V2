(function (root) {
  "use strict";

  var REQUIRED_PERMISSION = "school.student.read";

  var CHILDREN = [
    {
      id: "demo-parent-child-lucas",
      profile_id: "demo-parent-child-lucas-profile",
      first_name: "Lucas",
      last_name: "Martin",
      matricule: "P-C2-0001",
      class_id: "demo-class-1",
      class_name: "6e A",
      academic_year: "2026-2027",
      lifecycle_status: "active",
      enrollment: { planned_class_id: "demo-class-1", planned_class_name: "6e A", academic_year_label: "2026-2027" },
      primary_parent: { display_name: "Sophie Martin", account_status: "Compte Parent actif" },
      communications: {
        notifications: [{ title: "Réunion de rentrée", detail: "Information de démonstration à consulter", date: "26 août 2026" }],
        convocations: [{ title: "Entretien avec la Direction", detail: "Convocation de démonstration · réponse côté serveur indisponible", date: "2 septembre 2026" }],
        messages: [{ title: "Accueil de l’établissement", detail: "Historique de démonstration non synchronisé", date: "25 août 2026" }]
      },
      pedagogy: {
        assignments: [{ title: "Exercices sur les fractions", subject: "Mathématiques", due: "30 août 2026", state: "À faire" }],
        evaluations: [{ title: "Interrogation de mathématiques", subject: "Mathématiques", grade: "14 / 20", comment: "Aperçu de démonstration" }],
        averages: [{ subject: "Mathématiques", value: "14 / 20" }, { subject: "Français", value: "12 / 20" }],
        overall: "13 / 20",
        bulletin: "Aperçu disponible · document officiel BACKEND_LATER",
        ranking: "7e position · aperçu autorisé",
        difficulty: "Lecture des consignes longues",
        remediation: "Fiche d’exercices guidés · information de démonstration"
      },
      finance: {
        fees: [
          { label: "Frais de scolarité", amount: "180 000 CDF", state: "PARTIEL" },
          { label: "Transport scolaire", amount: "75 000 CDF", state: "PAYÉ" },
          { label: "Fournitures", amount: "45 000 CDF", state: "EN ATTENTE" },
          { label: "Activité culturelle", amount: "25 000 CDF", state: "EXEMPTÉ" },
          { label: "Régularisation", amount: "À vérifier", state: "ANOMALIE" }
        ],
        payments: [
          { label: "Versement scolarité", amount: "90 000 CDF", date: "20 août 2026" },
          { label: "Transport scolaire", amount: "75 000 CDF", date: "18 août 2026" }
        ],
        receipts: [
          { id: "REC-2026-0586", label: "Versement scolarité", amount: "90 000 CDF" },
          { id: "REC-2026-0584", label: "Transport scolaire", amount: "75 000 CDF" }
        ],
        history: ["Situation familiale consultée", "Reçu REC-2026-0586 enregistré dans l’aperçu", "Échéance de scolarité à consulter"]
      },
      summary: {
        presence: "Présent",
        safety: "Sortie prévue à 16 h 15",
        homework: "2 devoirs à consulter",
        notification: "1 notification récente",
        convocation: "Aucune convocation urgente",
        finance: "Paiement partiel"
      }
    },
    {
      id: "demo-parent-child-emma",
      profile_id: "demo-parent-child-emma-profile",
      first_name: "Emma",
      last_name: "Martin",
      matricule: "P-C2-0002",
      class_id: "demo-class-2",
      class_name: "Maternelle 3",
      academic_year: "2026-2027",
      lifecycle_status: "active",
      enrollment: { planned_class_id: "demo-class-2", planned_class_name: "Maternelle 3", academic_year_label: "2026-2027" },
      primary_parent: { display_name: "Sophie Martin", account_status: "Compte Parent actif" },
      communications: {
        notifications: [{ title: "Activité pédagogique", detail: "Information de démonstration à consulter", date: "27 août 2026" }],
        convocations: [],
        messages: [{ title: "Accueil maternelle", detail: "Historique de démonstration non synchronisé", date: "24 août 2026" }]
      },
      pedagogy: {
        assignments: [{ title: "Activité de motricité", subject: "Éveil", due: "29 août 2026", state: "À découvrir" }],
        evaluations: [{ title: "Observation langage", subject: "Langage", grade: "Acquis", comment: "Aperçu de démonstration" }],
        averages: [{ subject: "Langage", value: "Acquis" }],
        overall: "Suivi qualitatif",
        bulletin: "Aperçu disponible · document officiel BACKEND_LATER",
        ranking: "Non applicable en maternelle",
        difficulty: "Aucune difficulté signalée dans cet aperçu",
        remediation: "Aucun rattrapage signalé"
      },
      finance: {
        fees: [
          { label: "Frais de scolarité", amount: "120 000 CDF", state: "PAYÉ" },
          { label: "Activité d’éveil", amount: "30 000 CDF", state: "EN ATTENTE" }
        ],
        payments: [{ label: "Frais de scolarité", amount: "120 000 CDF", date: "19 août 2026" }],
        receipts: [{ id: "REC-2026-0585", label: "Frais de scolarité", amount: "120 000 CDF" }],
        history: ["Reçu REC-2026-0585 enregistré dans l’aperçu"]
      },
      summary: {
        presence: "Présente",
        safety: "Sortie prévue à 15 h 30",
        homework: "1 activité à consulter",
        notification: "Aucune nouvelle notification",
        convocation: "1 convocation à consulter",
        finance: "À jour"
      }
    },
    {
      id: "demo-draft-student",
      profile_id: "demo-draft-student-profile",
      first_name: "Amina",
      last_name: "Mbuyi",
      matricule: "BROUILLON-P-C2-0003",
      class_id: null,
      class_name: "5e A",
      academic_year: "2026-2027",
      lifecycle_status: "draft",
      enrollment: { planned_class_id: "demo-class-4", planned_class_name: "5e A", academic_year_label: "2026-2027" },
      primary_parent: { display_name: "Sophie Martin", account_status: "À préparer" },
      communications: { notifications: [], convocations: [], messages: [] },
      pedagogy: null,
      finance: null,
      summary: null
    },
    {
      id: "demo-unrelated-child-ethan",
      profile_id: "demo-unrelated-child-ethan-profile",
      first_name: "Ethan",
      last_name: "Leroy",
      matricule: "HORS-PERIMETRE",
      class_id: "demo-class-3",
      class_name: "4e B",
      academic_year: "2026-2027",
      lifecycle_status: "active",
      enrollment: { planned_class_id: "demo-class-3", planned_class_name: "4e B", academic_year_label: "2026-2027" },
      primary_parent: { display_name: "Autre famille", account_status: "Hors périmètre" },
      communications: { notifications: [], convocations: [], messages: [] },
      pedagogy: null,
      finance: null,
      summary: null
    }
  ];

  var selectedChildId = null;
  var activeContainerId = null;
  var activeUser = null;

  function escapeMarkup(value) {
    if (root.ssEscapeHtml) return root.ssEscapeHtml(value == null ? "" : String(value));
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function childName(child) {
    return [child.first_name, child.last_name].filter(Boolean).join(" ");
  }

  function explicitDeny(user, permission) {
    if (Array.isArray(user && user.deniedPermissions) && user.deniedPermissions.indexOf(permission) >= 0) return true;
    return Array.isArray(user && user.permissionExceptions) && user.permissionExceptions.some(function (item) {
      return item && item.permission === permission && String(item.effect || "").toLowerCase() === "deny";
    });
  }

  function hasPermission(user, permission) {
    if (explicitDeny(user, permission)) return false;
    return !!(root.SchoolSafeAccess && root.SchoolSafeAccess.canAccess(user || {}, permission));
  }

  function scopeFor(user, permission) {
    var scopes = Array.isArray(user && user.scopes) ? user.scopes : [];
    return scopes.find(function (scope) { return scope.permission === permission; }) ||
      scopes.find(function (scope) { return !scope.permission; }) || null;
  }

  function getLinkedChildren(user) {
    var scope = scopeFor(user, REQUIRED_PERMISSION);
    if (!hasPermission(user, REQUIRED_PERMISSION) || !scope || scope.type !== "own_children") return [];
    var linkedIds = Array.isArray(user && user.childIds) ? user.childIds : [];
    return CHILDREN.filter(function (child) { return linkedIds.indexOf(child.id) >= 0; });
  }

  function getSelectedChild(user) {
    var linked = getLinkedChildren(user);
    if (!linked.length) return null;
    var selected = linked.find(function (child) { return child.id === selectedChildId; });
    return selected || linked[0];
  }

  function openChildDossier(childId, user) {
    var linked = getLinkedChildren(user || {});
    var child = linked.find(function (item) { return item.id === childId; });
    if (!child || !root.SchoolSafeStudentDossier) return false;
    root.SchoolSafeStudentDossier.open(child, user || {});
    return true;
  }

  function scopeAllowsChild(user, permission, child) {
    var scope = scopeFor(user, permission);
    return !!(child && hasPermission(user, permission) && scope && scope.type === "own_children" &&
      Array.isArray(user && user.childIds) && user.childIds.indexOf(child.id) >= 0);
  }

  function communicationColumn(title, items, iconName) {
    var rows = items.length ? items.map(function (item) {
      return '<article><span>' + icon(iconName) + '</span><div><strong>' + escapeMarkup(item.title) + '</strong>' +
        '<p>' + escapeMarkup(item.detail) + '</p><small>' + escapeMarkup(item.date) + ' · DÉMONSTRATION</small></div></article>';
    }).join("") : '<p class="parent-communication-empty">Aucun élément disponible dans cet aperçu.</p>';
    return '<section class="parent-communication-column"><h2>' + escapeMarkup(title) + '</h2><div>' + rows + '</div></section>';
  }

  function communicationsMarkup(child, user) {
    var draft = child.lifecycle_status !== "active";
    var data = child.communications || { notifications: [], convocations: [], messages: [] };
    var canPrepare = scopeAllowsChild(user, "communication.message.send", child);
    var history = draft ? '<div class="parent-communication-draft"><strong>EN PRÉPARATION</strong><p>Aucun historique officiel : le dossier n’est pas encore opérationnel.</p></div>' :
      '<div class="parent-communication-history">' +
        communicationColumn("Notifications", data.notifications || [], "bell") +
        communicationColumn("Convocations", data.convocations || [], "mail-warning") +
        communicationColumn("Messages", data.messages || [], "messages-square") +
      '</div>';
    var composer = canPrepare ? '<section class="parent-message-composer"><header><div><p class="parent-eyebrow">Préparation locale uniquement</p><h2>Nouveau message</h2></div><span>BACKEND_LATER</span></header>' +
      '<div class="parent-message-recipient" data-parent-message-recipient><span>Destinataire autorisé</span><strong>Direction de l’établissement</strong><small>Aucun enseignant n’est ajouté implicitement.</small></div>' +
      '<label for="parentMessageDraft">Votre message</label><textarea id="parentMessageDraft" rows="5" placeholder="Rédigez un brouillon pour la Direction"></textarea>' +
      '<button class="ss-button" type="button" data-prepare-parent-message>Préparer le message</button><p class="parent-message-draft-state" role="status">Aucun envoi effectué.</p></section>' :
      '<aside class="parent-communication-denied"><span>' + icon("shield-x") + '</span><div><strong>Préparation de message indisponible</strong><p>La permission et la portée requises ne sont pas accordées, ou un DENY explicite s’applique.</p></div></aside>';
    return '<div class="parent-communications"><header class="parent-feature-header"><div><p class="parent-eyebrow">Communication familiale · own_children</p><h1>' +
      escapeMarkup(childName(child)) + '</h1><p>Historique frontend autorisé · données de démonstration non synchronisées.</p></div><span>DÉMO · BACKEND_LATER</span></header>' +
      history + composer + '</div>';
  }

  function openCommunications(childId, user) {
    var linked = getLinkedChildren(user || {});
    var child = linked.find(function (item) { return item.id === childId; });
    if (!child || !root.ssModal) return false;
    var modal = root.ssModal({
      title: "Communications Parent",
      subtitle: "Consultation et préparation locale selon Access_Law",
      size: "full",
      className: "parent-communications-modal",
      content: communicationsMarkup(child, user || {}),
      actions: [{ label: "Fermer", variant: "secondary" }]
    });
    var prepare = modal.content.querySelector("[data-prepare-parent-message]");
    if (prepare) prepare.addEventListener("click", function () {
      var textarea = modal.content.querySelector("#parentMessageDraft");
      var state = modal.content.querySelector(".parent-message-draft-state");
      if (!textarea || !state) return;
      if (!String(textarea.value || "").trim()) {
        state.textContent = "Rédigez un message avant de préparer le brouillon.";
        return;
      }
      state.textContent = "Brouillon local préparé · aucun envoi effectué · BACKEND_LATER";
    });
    if (root.lucide) root.lucide.createIcons();
    return true;
  }

  function pedagogyList(items, renderItem, emptyText) {
    if (!items || !items.length) return '<p class="parent-feature-empty">' + escapeMarkup(emptyText) + '</p>';
    return '<div class="parent-readonly-list">' + items.map(renderItem).join("") + '</div>';
  }

  function pedagogyMarkup(child, user) {
    var allowed = scopeAllowsChild(user, "pedagogy.grade.read", child);
    var header = '<header class="parent-feature-header"><div><p class="parent-eyebrow">Suivi pédagogique · own_children</p><h1>' +
      escapeMarkup(childName(child)) + '</h1><p>Consultation seule · composants Pédagogie partagés · aucune écriture.</p></div><span>DÉMO · BACKEND_LATER</span></header>';
    if (!allowed) {
      return '<div class="parent-pedagogy">' + header + '<aside class="parent-pedagogy-denied">' + icon("shield-x") +
        '<div><strong>Suivi pédagogique non autorisé</strong><p>La permission, la portée own_children ou une exception individuelle bloque cette consultation.</p></div></aside></div>';
    }
    if (child.lifecycle_status !== "active" || !child.pedagogy) {
      return '<div class="parent-pedagogy">' + header + '<aside class="parent-pedagogy-draft"><strong>EN PRÉPARATION</strong>' +
        '<p>Aucune donnée pédagogique officielle n’est disponible pour ce dossier non opérationnel.</p></aside></div>';
    }
    var data = child.pedagogy;
    var assignments = pedagogyList(data.assignments, function (item) {
      return '<article><div><strong>' + escapeMarkup(item.title) + '</strong><p>' + escapeMarkup(item.subject) + '</p></div><span>' + escapeMarkup(item.state) + '<small>Échéance ' + escapeMarkup(item.due) + '</small></span></article>';
    }, "Aucun devoir visible.");
    var evaluations = pedagogyList(data.evaluations, function (item) {
      return '<article><div><strong>' + escapeMarkup(item.title) + '</strong><p>' + escapeMarkup(item.subject) + ' · ' + escapeMarkup(item.comment) + '</p></div><span class="parent-grade">' + escapeMarkup(item.grade) + '</span></article>';
    }, "Aucune évaluation visible.");
    var averages = pedagogyList(data.averages, function (item) {
      return '<article><div><strong>' + escapeMarkup(item.subject) + '</strong><p>Moyenne de démonstration</p></div><span class="parent-grade">' + escapeMarkup(item.value) + '</span></article>';
    }, "Aucune moyenne calculable.");
    return '<div class="parent-pedagogy">' + header + '<div class="parent-pedagogy-grid">' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Devoirs</h2>' + assignments + '</section>' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Évaluations</h2>' + evaluations + '</section>' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Moyennes</h2><p class="parent-overall">Moyenne générale <strong>' + escapeMarkup(data.overall) + '</strong></p>' + averages + '</section>' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Bulletin</h2><p>' + escapeMarkup(data.bulletin) + '</p><span class="parent-feature-source">FEATURE_LATER / BACKEND_LATER</span></section>' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Palmarès</h2><p>' + escapeMarkup(data.ranking) + '</p><span class="parent-feature-source">Visible uniquement si autorisé</span></section>' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Difficultés et suivi</h2><p>' + escapeMarkup(data.difficulty) + '</p><span class="parent-feature-source">Aperçu de démonstration</span></section>' +
      '<section class="pedagogy-panel parent-readonly-panel"><h2>Rattrapage</h2><p>' + escapeMarkup(data.remediation) + '</p><span class="parent-feature-source">Information uniquement</span></section>' +
      '</div><aside class="parent-readonly-boundary">' + icon("eye") + '<p>Consultation seule : aucune cote, moyenne, difficulté ou décision pédagogique ne peut être modifiée ici.</p></aside></div>';
  }

  function openPedagogy(childId, user) {
    var linked = getLinkedChildren(user || {});
    var child = linked.find(function (item) { return item.id === childId; });
    if (!child || !root.ssModal) return false;
    root.ssModal({
      title: "Suivi pédagogique Parent",
      subtitle: "Vue familiale en consultation seule",
      size: "full",
      className: "parent-pedagogy-modal",
      content: pedagogyMarkup(child, user || {}),
      actions: [{ label: "Fermer", variant: "secondary" }]
    });
    if (root.lucide) root.lucide.createIcons();
    return true;
  }

  function financeStateClass(state) {
    return {
      "PAYÉ": "success",
      "PARTIEL": "warning",
      "EN ATTENTE": "neutral",
      "EXEMPTÉ": "info",
      "ANOMALIE": "error"
    }[state] || "neutral";
  }

  function financeMarkup(child, user) {
    var allowed = scopeAllowsChild(user, "finance.status.read", child);
    var header = '<header class="parent-feature-header"><div><p class="parent-eyebrow">Finance familiale · own_children</p><h1>' +
      escapeMarkup(childName(child)) + '</h1><p>Consultation des opérations enregistrées par l’école · aucun paiement en ligne.</p></div><span>DÉMO · BACKEND_LATER</span></header>';
    if (!allowed) {
      return '<div class="parent-finance">' + header + '<aside class="parent-finance-denied">' + icon("shield-x") +
        '<div><strong>Situation financière non autorisée</strong><p>La permission, la portée own_children ou un DENY explicite bloque cette consultation.</p></div></aside></div>';
    }
    if (child.lifecycle_status !== "active" || !child.finance) {
      return '<div class="parent-finance">' + header + '<aside class="parent-finance-draft"><strong>EN PRÉPARATION</strong>' +
        '<p>Aucune opération financière officielle n’est disponible pour ce dossier non opérationnel.</p></aside></div>';
    }
    var data = child.finance;
    var fees = data.fees.map(function (item) {
      return '<article class="parent-fee-row"><div><strong>' + escapeMarkup(item.label) + '</strong><small>Montant de démonstration</small></div>' +
        '<span>' + escapeMarkup(item.amount) + '</span><b class="parent-finance-state parent-finance-state--' + financeStateClass(item.state) + '">' + escapeMarkup(item.state) + '</b></article>';
    }).join("");
    var payments = data.payments.map(function (item) {
      return '<li><span>' + icon("circle-check") + '</span><div><strong>' + escapeMarkup(item.label) + '</strong><small>' + escapeMarkup(item.date) + '</small></div><b>' + escapeMarkup(item.amount) + '</b></li>';
    }).join("");
    var receipts = data.receipts.map(function (item) {
      return '<li><span>' + icon("receipt-text") + '</span><div><strong>' + escapeMarkup(item.id) + '</strong><small>' + escapeMarkup(item.label) + '</small></div><b>' + escapeMarkup(item.amount) + '</b></li>';
    }).join("");
    var history = data.history.map(function (item) {
      return '<li><span>' + icon("history") + '</span><p>' + escapeMarkup(item) + '</p></li>';
    }).join("");
    return '<div class="parent-finance">' + header +
      '<section class="parent-finance-panel"><h2>Situation des frais</h2><div class="parent-fee-list">' + fees + '</div></section>' +
      '<div class="parent-finance-columns">' +
        '<section class="parent-finance-panel"><h2>Paiements enregistrés</h2><ul>' + payments + '</ul></section>' +
        '<section class="parent-finance-panel"><h2>Reçus</h2><ul>' + receipts + '</ul></section>' +
        '<section class="parent-finance-panel"><h2>Historique</h2><ul class="parent-finance-history">' + history + '</ul></section>' +
      '</div><aside class="parent-finance-boundary">' + icon("landmark") + '<div><strong>Consultation uniquement</strong><p>Aucun paiement en ligne, aucune création, modification ou annulation de caisse. Les données officielles viendront du backend.</p></div></aside></div>';
  }

  function openFinance(childId, user) {
    var linked = getLinkedChildren(user || {});
    var child = linked.find(function (item) { return item.id === childId; });
    if (!child || !root.ssModal) return false;
    root.ssModal({
      title: "Finance Parent",
      subtitle: "Situation familiale en consultation seule",
      size: "full",
      className: "parent-finance-modal",
      content: financeMarkup(child, user || {}),
      actions: [{ label: "Fermer", variant: "secondary" }]
    });
    if (root.lucide) root.lucide.createIcons();
    return true;
  }

  function icon(name) {
    return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
  }

  function summaryCard(label, value, iconName, state) {
    return '<article class="parent-summary-card parent-summary-card--' + state + '">' +
      '<span class="parent-summary-icon">' + icon(iconName) + '</span>' +
      '<div><small>' + escapeMarkup(label) + '</small><strong>' + escapeMarkup(value) + '</strong></div>' +
      '<span class="parent-summary-source">DÉMO · BACKEND_LATER</span>' +
    '</article>';
  }

  function renderSummary(child) {
    if (child.lifecycle_status === "draft") {
      return [
        ["Présence du jour", "Indisponible · dossier EN PRÉPARATION", "calendar-clock"],
        ["Sécurité", "Indisponible · dossier EN PRÉPARATION", "shield"],
        ["Devoirs", "Indisponible · dossier EN PRÉPARATION", "notebook-pen"],
        ["Notification", "Indisponible · dossier EN PRÉPARATION", "bell"],
        ["Convocations", "Indisponible · dossier EN PRÉPARATION", "mail-warning"],
        ["Situation financière", "Indisponible · dossier EN PRÉPARATION", "receipt-text"]
      ].map(function (item) { return summaryCard(item[0], item[1], item[2], "unavailable"); }).join("");
    }
    return [
      ["Présence du jour", child.summary.presence, "calendar-check-2", "success"],
      ["Sécurité", child.summary.safety, "shield-check", "info"],
      ["Devoirs", child.summary.homework, "notebook-pen", "info"],
      ["Notification", child.summary.notification, "bell", "info"],
      ["Convocations", child.summary.convocation, "mail-check", "neutral"],
      ["Situation financière", child.summary.finance, "receipt-text", "warning"]
    ].map(function (item) { return summaryCard(item[0], item[1], item[2], item[3]); }).join("");
  }

  function renderShortcuts() {
    return [
      ["Dossier", "folder-user"],
      ["Pédagogie", "book-open-check"],
      ["Communications", "messages-square"],
      ["Finance", "receipt-text"],
      ["Sécurité", "shield-check"],
      ["Cantine", "utensils"]
    ].map(function (item) {
      return '<button class="parent-shortcut" type="button" data-parent-shortcut="' + escapeMarkup(item[0].toLowerCase()) + '">' +
        icon(item[1]) + '<span>' + escapeMarkup(item[0]) + '</span><small>Consulter</small>' + icon("chevron-right") +
      '</button>';
    }).join("");
  }

  function renderDenied(container) {
    container.innerHTML = '<section class="parent-portal-denied" role="alert">' +
      '<span>' + icon("shield-x") + '</span><div><p class="parent-eyebrow">Périmètre protégé</p>' +
      '<h1>Accès refusé</h1><p>La permission de consulter les enfants liés avec la portée <code>own_children</code> est absente ou explicitement refusée.</p></div>' +
    '</section>';
  }

  function render(containerId, user) {
    var container = document.getElementById(containerId);
    if (!container) return;
    activeContainerId = containerId;
    activeUser = user || {};
    var linked = getLinkedChildren(activeUser);
    if (!linked.length) {
      selectedChildId = null;
      renderDenied(container);
      if (root.lucide) root.lucide.createIcons();
      return;
    }

    var child = getSelectedChild(activeUser);
    selectedChildId = child.id;
    var isDraft = child.lifecycle_status === "draft";
    var options = linked.map(function (item) {
      var suffix = item.lifecycle_status === "draft" ? " · EN PRÉPARATION" : "";
      return '<option value="' + escapeMarkup(item.id) + '"' + (item.id === child.id ? " selected" : "") + '>' +
        escapeMarkup(childName(item) + suffix) + '</option>';
    }).join("");

    container.innerHTML = '<div class="parent-dashboard">' +
      '<header class="parent-dashboard-header"><div><p class="parent-eyebrow">Espace Parent · démonstration locale</p>' +
      '<h1>Mes enfants</h1><p>Consultez uniquement les informations autorisées de vos enfants liés.</p></div>' +
      '<label class="parent-child-picker" for="parentChildSelect"><span>Enfant sélectionné</span><select id="parentChildSelect">' + options + '</select></label></header>' +
      '<section class="parent-child-identity" data-parent-selected-child="' + escapeMarkup(child.id) + '">' +
        '<span class="parent-child-avatar" aria-hidden="true">' + escapeMarkup(child.first_name.charAt(0) + child.last_name.charAt(0)) + '</span>' +
        '<div><p class="parent-eyebrow">Enfant lié · portée own_children</p><h2>' + escapeMarkup(childName(child)) + '</h2>' +
        '<p>' + escapeMarkup(child.class_name) + ' · Année scolaire ' + escapeMarkup(child.academic_year) + '</p></div>' +
        '<span class="parent-status parent-status--' + (isDraft ? "draft" : "active") + '">' + (isDraft ? "EN PRÉPARATION" : "DOSSIER ACTIF") + '</span>' +
      '</section>' +
      (isDraft ? '<aside class="parent-draft-boundary">' + icon("cloud-off") + '<div><strong>Dossier local en préparation</strong><p>Aucune opération scolaire officielle ne peut être affichée ou préparée pour cet enfant.</p></div></aside>' : '') +
      '<section aria-labelledby="parentSummaryTitle"><div class="parent-section-heading"><div><p class="parent-eyebrow">Aujourd’hui</p><h2 id="parentSummaryTitle">Vue d’ensemble autorisée</h2></div><span>DÉMONSTRATION · BACKEND_LATER</span></div>' +
      '<div class="parent-dashboard-summary">' + renderSummary(child) + '</div></section>' +
      '<section aria-labelledby="parentShortcutsTitle"><div class="parent-section-heading"><div><p class="parent-eyebrow">Navigation familiale</p><h2 id="parentShortcutsTitle">Accès rapides</h2></div></div>' +
      '<div class="parent-shortcuts">' + renderShortcuts() + '</div></section>' +
    '</div>';

    var selector = container.querySelector("#parentChildSelect");
    if (selector) selector.addEventListener("change", function () {
      selectedChildId = selector.value;
      render(activeContainerId, activeUser);
    });
    container.querySelectorAll("[data-parent-shortcut]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.getAttribute("data-parent-shortcut") === "dossier") {
          openChildDossier(selectedChildId, activeUser);
          return;
        }
        if (button.getAttribute("data-parent-shortcut") === "communications") {
          openCommunications(selectedChildId, activeUser);
          return;
        }
        if (button.getAttribute("data-parent-shortcut") === "pédagogie") {
          openPedagogy(selectedChildId, activeUser);
          return;
        }
        if (button.getAttribute("data-parent-shortcut") === "finance") {
          openFinance(selectedChildId, activeUser);
          return;
        }
        var label = button.querySelector("span");
        if (typeof root.schoolSafeNotify === "function") {
          root.schoolSafeNotify((label ? label.textContent : "Fonction") + " — disponible dans les prochains lots Parent.");
        }
      });
    });
    if (root.lucide) root.lucide.createIcons();
  }

  root.SchoolSafeParentPortal = {
    CHILDREN: CHILDREN,
    getLinkedChildren: getLinkedChildren,
    getSelectedChild: getSelectedChild,
    openChildDossier: openChildDossier,
    openCommunications: openCommunications,
    openPedagogy: openPedagogy,
    openFinance: openFinance,
    render: render
  };
}(window));
