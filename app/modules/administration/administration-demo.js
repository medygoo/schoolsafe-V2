(function (global) {
  "use strict";

  var state = { containerId: "administrationModule", user: null, options: {} };
  var SECTIONS = [
    { key: "school", label: "École", description: "Identité, année et structure via le module École existant.", permission: "school.manage", scope: "school", icon: "school", action: "school", actionLabel: "Ouvrir le module École" },
    { key: "staff", label: "Comptes et personnel", description: "Comptes, états et équipe via les surfaces Personnel existantes.", permission: "staff.read", scope: "school", icon: "contact-round", action: "staff", actionLabel: "Ouvrir le module Personnel / RH" },
    { key: "roles", label: "Rôles", description: "Attribution des rôles bornée par roles.manage et la portée école.", permission: "roles.manage", scope: "school", icon: "user-cog" },
    { key: "permissions", label: "Permissions", description: "Catalogue canonique en lecture seule, sans création ni renommage.", permission: "roles.manage", scope: "school", icon: "list-checks" },
    { key: "access", label: "Accès effectifs", description: "Lecture du résultat Access_Law, sans moteur d’autorisation parallèle.", permission: "roles.manage", scope: "school", icon: "shield-check" },
    { key: "exceptions", label: "Exceptions / DENY", description: "Frontière des exceptions individuelles et priorité du refus explicite.", permission: "roles.manage", scope: "school", icon: "shield-off" },
    { key: "jaspe", label: "Jaspe", description: "Gouvernance de l’assistant : Jaspe reste inférieur ou égal à l’utilisateur.", permission: "safe.assistant.use", scope: "own", icon: "sparkles" },
    { key: "settings", label: "Paramètres frontend", description: "Préférences techniques locales et limites BACKEND_LATER honnêtes.", permission: "school.manage", scope: "school", icon: "settings" }
  ];

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function canUse(user, permission, scope) {
    var access = global.SchoolSafeAccess;
    if (!user || !access || typeof access.canAccess !== "function" || typeof access.allowsScope !== "function") return false;
    if (typeof access.explicitDeny === "function" && access.explicitDeny(user, permission)) return false;
    return access.canAccess(user, permission) && access.allowsScope(user, permission, scope);
  }

  function visibleSections(user) {
    return SECTIONS.filter(function (section) { return canUse(user, section.permission, section.scope); });
  }

  function renderCard(section) {
    var action = section.action
      ? '<button class="ss-button ss-button--secondary" type="button" data-admin-link="' + section.action + '">' + escapeMarkup(section.actionLabel) + '</button>'
      : '<span class="administration-card__boundary">FRONTEND · contrôle d’accès actif</span>';
    return '<article class="administration-card" data-admin-section="' + section.key + '">' +
      '<span class="administration-card__icon"><i data-lucide="' + section.icon + '"></i></span>' +
      '<div><h3>' + escapeMarkup(section.label) + '</h3><p>' + escapeMarkup(section.description) + '</p></div>' + action + '</article>';
  }

  function render(containerId, user, options) {
    state.containerId = containerId || state.containerId;
    state.user = user || state.user || {};
    state.options = options || state.options || {};
    var container = global.document && global.document.getElementById(state.containerId);
    if (!container) return;
    var allowed = visibleSections(state.user);
    container.hidden = false;
    container.innerHTML =
      '<header class="administration-header">' +
        '<button class="ss-button ss-button--secondary" type="button" data-admin-close><i data-lucide="arrow-left"></i> Tableau de bord</button>' +
        '<div><span>Administration / Accès / Jaspe logiciel</span><h2>Centre Administration</h2><p>Vue de contrôle frontend : chaque surface exige sa permission et sa portée réelles.</p></div>' +
        '<span class="administration-header__badge"><i data-lucide="shield-check"></i> DENY explicite prioritaire</span>' +
      '</header>' +
      '<section class="administration-summary" aria-label="Résumé des accès"><div><strong>' + allowed.length + ' domaine' + (allowed.length > 1 ? 's' : '') + ' autorisé' + (allowed.length > 1 ? 's' : '') + ' sur ' + SECTIONS.length + '</strong><span>Utilisateur → Rôle → Permission → Portée → Condition → Exception</span></div><span>Administrateur sans bypass implicite</span></section>' +
      (allowed.length ? '<div class="administration-grid">' + allowed.map(renderCard).join("") + '</div>' : '<div class="administration-empty"><i data-lucide="shield-off"></i><h3>Administration non autorisée</h3><p>Aucune permission avec portée compatible n’est accordée à cette session.</p></div>');

    var closeButton = container.querySelector("[data-admin-close]");
    if (closeButton) closeButton.addEventListener("click", function () {
      if (typeof state.options.onClose === "function") state.options.onClose(); else container.hidden = true;
    });
    container.querySelectorAll("[data-admin-link]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-admin-link");
        if (target === "school" && typeof state.options.openSchool === "function") state.options.openSchool();
        if (target === "staff" && typeof state.options.openStaff === "function") state.options.openStaff();
      });
    });
    if (global.lucide && typeof global.lucide.createIcons === "function") global.lucide.createIcons();
  }

  function setSession(user) {
    state.user = user || {};
    render(state.containerId, state.user, state.options);
  }

  function close() {
    var container = global.document && global.document.getElementById(state.containerId);
    if (container) container.hidden = true;
  }

  global.SchoolSafeAdministration = { render: render, setSession: setSession, close: close, canUse: canUse, visibleSections: visibleSections };
})(window);
