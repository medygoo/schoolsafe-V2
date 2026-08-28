(function (global) {
  "use strict";

  var state = {
    containerId: "administrationModule",
    user: null,
    options: {},
    activeView: "dashboard",
    staff: null,
    roles: null,
    accountsLoading: false,
    accountsError: "",
    notice: "",
    selectedStaffId: null,
    mutationPanel: null,
    permissionCatalog: null,
    permissionsLoading: false,
    permissionsError: "",
    permissionFilters: { query: "", domain: "all", operation: "all", scope: "all", code: "" }
  };
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
      : section.key === "roles"
        ? '<button class="ss-button ss-button--secondary" type="button" data-admin-open="accounts">Gérer les comptes et rôles</button>'
        : section.key === "permissions"
          ? '<button class="ss-button ss-button--secondary" type="button" data-admin-open="permissions">Consulter le catalogue</button>'
        : '<span class="administration-card__boundary">FRONTEND · contrôle d’accès actif</span>';
    return '<article class="administration-card" data-admin-section="' + section.key + '">' +
      '<span class="administration-card__icon"><i data-lucide="' + section.icon + '"></i></span>' +
      '<div><h3>' + escapeMarkup(section.label) + '</h3><p>' + escapeMarkup(section.description) + '</p></div>' + action + '</article>';
  }

  function asList(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.data)) return value.data;
    return [];
  }

  function explicitDeny(permission) {
    var access = global.SchoolSafeAccess;
    return !!(access && typeof access.explicitDeny === "function" && access.explicitDeny(state.user || {}, permission));
  }

  function roleAssignmentMarkup() {
    if (!state.selectedStaffId || !canUse(state.user, "roles.manage", "school")) return "";
    var person = (state.staff || []).find(function (item) { return item.id === state.selectedStaffId; });
    if (!person) return "";
    var assigned = (person.roles || []).map(function (role) { return role.id; });
    return '<section class="administration-mutation" data-role-assignment>' +
      '<div><span>ATTRIBUTION LIVE · API EXISTANTE</span><h3>Rôles de ' + escapeMarkup(person.display_name) + '</h3><p>Aucune modification locale ne sera présentée comme un succès backend.</p></div>' +
      '<form><div class="administration-role-options">' + (state.roles || []).map(function (role) {
        return '<label><input type="checkbox" name="role" value="' + escapeMarkup(role.id) + '"' + (assigned.indexOf(role.id) >= 0 ? ' checked' : '') + '> ' + escapeMarkup(role.label || role.code) + '</label>';
      }).join("") + '</div>' +
      '<label class="administration-confirm"><input type="checkbox" name="confirmed"> Je confirme cette modification via le backend existant</label>' +
      '<div class="administration-mutation__actions"><button class="ss-button ss-button--secondary" type="button" data-cancel-mutation>Annuler</button><button class="ss-button" type="submit" disabled>Confirmer l’attribution live</button></div></form></section>';
  }

  function inviteMarkup() {
    if (state.mutationPanel !== "invite" || !canUse(state.user, "staff.manage", "school")) return "";
    return '<section class="administration-mutation" data-invite-staff><div><span>INVITATION LIVE · API EXISTANTE</span><h3>Inviter un membre</h3><p>Envoi réel uniquement après confirmation explicite.</p></div><form class="administration-form-grid"><label>Prénom<input name="first_name" required></label><label>Nom<input name="last_name" required></label><label>Email<input name="email" type="email" required></label><label class="administration-confirm"><input type="checkbox" name="confirmed"> Je confirme l’envoi via le backend existant</label><div class="administration-mutation__actions"><button class="ss-button ss-button--secondary" type="button" data-cancel-mutation>Annuler</button><button class="ss-button" type="submit" disabled>Confirmer l’invitation live</button></div></form></section>';
  }

  function toggleMarkup() {
    if (!state.mutationPanel || state.mutationPanel.indexOf("toggle:") !== 0 || !canUse(state.user, "staff.manage", "school")) return "";
    var id = state.mutationPanel.slice(7);
    var person = (state.staff || []).find(function (item) { return item.id === id; });
    if (!person) return "";
    var verb = person.is_active ? "désactivation" : "activation";
    return '<section class="administration-mutation" data-toggle-staff><div><span>STATUT LIVE · API EXISTANTE</span><h3>Confirmer la ' + verb + ' de ' + escapeMarkup(person.display_name) + '</h3><p>Le statut ne changera à l’écran qu’après confirmation du backend.</p></div><div class="administration-mutation__actions"><button class="ss-button ss-button--secondary" type="button" data-cancel-mutation>Annuler</button><button class="ss-button" type="button" data-confirm-toggle="' + escapeMarkup(person.id) + '">Confirmer la ' + verb + ' live</button></div></section>';
  }

  function renderAccounts() {
    var canRead = canUse(state.user, "staff.read", "school");
    var canManage = canUse(state.user, "staff.manage", "school");
    var canAssign = canUse(state.user, "roles.manage", "school");
    if (!canRead) return '<section class="administration-empty" data-administration-accounts><i data-lucide="shield-off"></i><h3>Comptes non autorisés</h3><p>staff.read + school requis.</p></section>';
    var boundary = explicitDeny("roles.manage") ? "DENY roles.manage prioritaire" : (canAssign ? "roles.manage + school vérifiés" : "roles.manage requis pour toute attribution");
    var notice = state.notice ? '<div class="administration-notice" role="status">' + escapeMarkup(state.notice) + '</div>' : "";
    var content = "";
    if (state.accountsLoading) content = '<div class="administration-empty"><i data-lucide="loader-2"></i><h3>Chargement des comptes…</h3></div>';
    else if (state.accountsError) content = '<div class="administration-empty"><i data-lucide="wifi-off"></i><h3>Comptes indisponibles</h3><p>' + escapeMarkup(state.accountsError) + ' · BACKEND_LATER</p></div>';
    else content = '<div class="administration-table-wrap"><table class="administration-table"><thead><tr><th>Utilisateur</th><th>Statut</th><th>Rôles</th><th>Accès</th></tr></thead><tbody>' + (state.staff || []).map(function (person) {
      var roles = (person.roles || []).map(function (role) { return role.label || role.code; }).join(", ") || "Aucun rôle";
      return '<tr><td><strong>' + escapeMarkup(person.display_name) + '</strong><span>' + escapeMarkup(person.email || "—") + '</span></td><td><span class="administration-status administration-status--' + (person.is_active ? 'active' : 'inactive') + '">' + (person.is_active ? 'Actif' : 'Inactif') + '</span></td><td>' + escapeMarkup(roles) + '</td><td><div class="administration-row-actions">' +
        (canAssign ? '<button class="ss-button ss-button--secondary" type="button" data-assign-roles="' + escapeMarkup(person.id) + '" aria-label="Attribuer les rôles à ' + escapeMarkup(person.display_name) + '">Attribuer les rôles</button>' : '') +
        (canManage ? '<button class="ss-button ss-button--secondary" type="button" data-toggle-account="' + escapeMarkup(person.id) + '" aria-label="' + (person.is_active ? 'Désactiver ' : 'Activer ') + escapeMarkup(person.display_name) + '">' + (person.is_active ? 'Désactiver' : 'Activer') + '</button>' : '') +
      '</div></td></tr>';
    }).join("") + '</tbody></table></div>';
    return '<section class="administration-accounts" data-administration-accounts><div class="administration-view-heading"><button class="ss-button ss-button--secondary" type="button" data-admin-home><i data-lucide="arrow-left"></i> Centre Administration</button><div><span>COMPTES / PERSONNEL / RÔLES</span><h3>Comptes et accès</h3><p>staff.manage et roles.manage restent deux autorisations indépendantes.</p></div>' + (canManage ? '<button class="ss-button" type="button" data-open-invite><i data-lucide="user-plus"></i> Inviter un membre</button>' : '') + '</div><div class="administration-boundaries"><span>' + boundary + '</span><span>' + (canManage ? 'staff.manage + school vérifiés' : 'staff.manage absent') + '</span></div>' + notice + content + roleAssignmentMarkup() + inviteMarkup() + toggleMarkup() + '</section>';
  }

  function dashboardMarkup(allowed) {
    return '<section class="administration-summary" aria-label="Résumé des accès"><div><strong>' + allowed.length + ' domaine' + (allowed.length > 1 ? 's' : '') + ' autorisé' + (allowed.length > 1 ? 's' : '') + ' sur ' + SECTIONS.length + '</strong><span>Utilisateur → Rôle → Permission → Portée → Condition → Exception</span></div><span>Administrateur sans bypass implicite</span></section>' +
      (allowed.length ? '<div class="administration-grid">' + allowed.map(renderCard).join("") + '</div>' : '<div class="administration-empty"><i data-lucide="shield-off"></i><h3>Administration non autorisée</h3><p>Aucune permission avec portée compatible n’est accordée à cette session.</p></div>');
  }

  function permissionDomain(permission) {
    return String(permission && permission.code || "other").split(".")[0] || "other";
  }

  function permissionOperation(permission) {
    var code = String(permission && permission.code || "");
    if (/\.manage$/.test(code)) return "manage";
    if (/\.read$/.test(code)) return "read";
    return "other";
  }

  function filteredPermissions() {
    var filters = state.permissionFilters;
    var query = filters.query.trim().toLowerCase();
    var exactCode = filters.code.trim().toLowerCase();
    return (state.permissionCatalog || []).filter(function (permission) {
      var code = String(permission.code || "");
      var label = String(permission.label || "");
      if (query && (code + " " + label).toLowerCase().indexOf(query) < 0) return false;
      if (filters.domain !== "all" && permissionDomain(permission) !== filters.domain) return false;
      if (filters.operation !== "all" && permissionOperation(permission) !== filters.operation) return false;
      if (filters.scope !== "all" && permission.scope !== filters.scope) return false;
      if (exactCode && code.toLowerCase() !== exactCode) return false;
      return true;
    });
  }

  function optionMarkup(values, selected, allLabel) {
    return '<option value="all">' + escapeMarkup(allLabel) + '</option>' + values.map(function (value) {
      return '<option value="' + escapeMarkup(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeMarkup(value) + '</option>';
    }).join("");
  }

  function renderPermissions() {
    if (!canUse(state.user, "roles.manage", "school")) {
      return '<section class="administration-empty" data-permission-catalog><i data-lucide="shield-off"></i><h3>Catalogue non autorisé</h3><p>roles.manage + school requis ; DENY prioritaire.</p></section>';
    }
    if (state.permissionsLoading) return '<section class="administration-empty" data-permission-catalog><i data-lucide="loader-2"></i><h3>Chargement du catalogue canonique…</h3></section>';
    if (state.permissionsError) return '<section class="administration-empty" data-permission-catalog><i data-lucide="wifi-off"></i><h3>Catalogue indisponible</h3><p>' + escapeMarkup(state.permissionsError) + '</p></section>';
    var catalog = state.permissionCatalog || [];
    var domains = Array.from(new Set(catalog.map(permissionDomain))).sort();
    var scopes = Array.from(new Set(catalog.map(function (permission) { return permission.scope || "none"; }))).sort();
    var rows = filteredPermissions();
    return '<section class="administration-permissions" data-permission-catalog>' +
      '<div class="administration-view-heading"><button class="ss-button ss-button--secondary" type="button" data-admin-home><i data-lucide="arrow-left"></i> Centre Administration</button><div><span>LECTURE SEULE</span><h3>Catalogue des permissions</h3><p>Source canonique · shared/permissions.json</p></div><span class="administration-readonly"><i data-lucide="lock-keyhole"></i> Aucun droit d’édition</span></div>' +
      '<div class="administration-permission-filters"><label>Rechercher une permission<input type="search" data-permission-filter="query" value="' + escapeMarkup(state.permissionFilters.query) + '"></label><label>Domaine<select data-permission-filter="domain">' + optionMarkup(domains, state.permissionFilters.domain, "Tous") + '</select></label><label>Opération<select data-permission-filter="operation"><option value="all">Toutes</option><option value="read"' + (state.permissionFilters.operation === "read" ? ' selected' : '') + '>read</option><option value="manage"' + (state.permissionFilters.operation === "manage" ? ' selected' : '') + '>manage</option><option value="other"' + (state.permissionFilters.operation === "other" ? ' selected' : '') + '>autre</option></select></label><label>Portée<select data-permission-filter="scope">' + optionMarkup(scopes, state.permissionFilters.scope, "Toutes") + '</select></label><label>Code exact<input type="search" data-permission-filter="code" value="' + escapeMarkup(state.permissionFilters.code) + '"></label></div>' +
      '<div class="administration-catalog-count"><strong>' + rows.length + '</strong> permission' + (rows.length > 1 ? 's' : '') + ' affichée' + (rows.length > 1 ? 's' : '') + '</div>' +
      (rows.length ? '<div class="administration-table-wrap"><table class="administration-table administration-permission-table"><thead><tr><th>Code</th><th>Libellé</th><th>Domaine</th><th>Portée par défaut</th><th>Type</th></tr></thead><tbody>' + rows.map(function (permission) {
        return '<tr data-permission-row><td><code>' + escapeMarkup(permission.code) + '</code></td><td>' + escapeMarkup(permission.label) + '</td><td>' + escapeMarkup(permissionDomain(permission)) + '</td><td>' + escapeMarkup(permission.scope || "none") + '</td><td>' + escapeMarkup(permissionOperation(permission)) + '</td></tr>';
      }).join("") + '</tbody></table></div>' : '<div class="administration-empty"><i data-lucide="search-x"></i><h3>Aucune permission</h3><p>Aucun code canonique ne correspond aux filtres.</p></div>') + '</section>';
  }

  function loadPermissions() {
    var access = global.SchoolSafeAccess;
    if (state.permissionsLoading || state.permissionCatalog) return;
    if (!access || typeof access.loadPermissions !== "function") {
      state.permissionsError = "SchoolSafeAccess indisponible";
      render(state.containerId, state.user, state.options);
      return;
    }
    state.permissionsLoading = true;
    render(state.containerId, state.user, state.options);
    access.loadPermissions().then(function (permissions) {
      state.permissionCatalog = asList(permissions);
      state.permissionsError = "";
    }).catch(function (error) {
      state.permissionsError = error && error.message ? error.message : "Source canonique indisponible";
    }).finally(function () {
      state.permissionsLoading = false;
      render(state.containerId, state.user, state.options);
    });
  }

  function bindPermissions(container) {
    var home = container.querySelector("[data-admin-home]");
    if (home) home.addEventListener("click", function () { open("dashboard"); });
    container.querySelectorAll("[data-permission-filter]").forEach(function (control) {
      control.addEventListener(control.tagName === "SELECT" ? "change" : "input", function () {
        state.permissionFilters[control.getAttribute("data-permission-filter")] = control.value;
        render(state.containerId, state.user, state.options);
        var replacement = global.document.querySelector('[data-permission-filter="' + control.getAttribute("data-permission-filter") + '"]');
        if (replacement && replacement.tagName !== "SELECT") {
          replacement.focus();
          replacement.setSelectionRange(replacement.value.length, replacement.value.length);
        }
      });
    });
  }

  function loadAccounts() {
    var api = global.SchoolSafeSchoolAPI;
    if (state.accountsLoading || state.staff) return;
    if (!api || typeof api.listStaff !== "function" || typeof api.listRoles !== "function") {
      state.accountsError = "API École indisponible";
      render(state.containerId, state.user, state.options);
      return;
    }
    state.accountsLoading = true;
    render(state.containerId, state.user, state.options);
    Promise.all([api.listStaff(), api.listRoles()]).then(function (result) {
      state.staff = asList(result[0]);
      state.roles = asList(result[1]);
      state.accountsError = "";
    }).catch(function (error) {
      state.accountsError = error && error.message ? error.message : "Source non connectée";
    }).finally(function () {
      state.accountsLoading = false;
      render(state.containerId, state.user, state.options);
    });
  }

  function updateConfirmationState(form) {
    var confirmed = form.querySelector('input[name="confirmed"]');
    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = !confirmed || !confirmed.checked;
  }

  function bindAccounts(container) {
    var home = container.querySelector("[data-admin-home]");
    if (home) home.addEventListener("click", function () { open("dashboard"); });
    container.querySelectorAll("[data-assign-roles]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedStaffId = button.getAttribute("data-assign-roles");
        state.mutationPanel = null;
        state.notice = "";
        render(state.containerId, state.user, state.options);
      });
    });
    container.querySelectorAll("[data-toggle-account]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedStaffId = null;
        state.mutationPanel = "toggle:" + button.getAttribute("data-toggle-account");
        state.notice = "";
        render(state.containerId, state.user, state.options);
      });
    });
    var inviteButton = container.querySelector("[data-open-invite]");
    if (inviteButton) inviteButton.addEventListener("click", function () {
      state.selectedStaffId = null;
      state.mutationPanel = "invite";
      state.notice = "";
      render(state.containerId, state.user, state.options);
    });
    container.querySelectorAll("[data-cancel-mutation]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedStaffId = null;
        state.mutationPanel = null;
        render(state.containerId, state.user, state.options);
      });
    });

    var roleForm = container.querySelector("[data-role-assignment] form");
    if (roleForm) {
      roleForm.querySelector('input[name="confirmed"]').addEventListener("change", function () { updateConfirmationState(roleForm); });
      roleForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!canUse(state.user, "roles.manage", "school")) return;
        var roleIds = Array.prototype.map.call(roleForm.querySelectorAll('input[name="role"]:checked'), function (input) { return input.value; });
        var submit = roleForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        global.SchoolSafeSchoolAPI.updateStaffRoles(state.selectedStaffId, roleIds).then(function () {
          var person = (state.staff || []).find(function (item) { return item.id === state.selectedStaffId; });
          if (person) person.roles = (state.roles || []).filter(function (role) { return roleIds.indexOf(role.id) >= 0; });
          state.notice = "Rôles mis à jour par le backend.";
          state.selectedStaffId = null;
          render(state.containerId, state.user, state.options);
        }).catch(function (error) {
          state.notice = (error && error.message ? error.message : "Mutation indisponible") + " · BACKEND_LATER";
          render(state.containerId, state.user, state.options);
        });
      });
    }

    var inviteForm = container.querySelector("[data-invite-staff] form");
    if (inviteForm) {
      inviteForm.querySelector('input[name="confirmed"]').addEventListener("change", function () { updateConfirmationState(inviteForm); });
      inviteForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!canUse(state.user, "staff.manage", "school")) return;
        var submit = inviteForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        global.SchoolSafeSchoolAPI.inviteStaff({ first_name: inviteForm.first_name.value, last_name: inviteForm.last_name.value, email: inviteForm.email.value }).then(function () {
          state.notice = "Invitation confirmée par le backend.";
          state.mutationPanel = null;
          render(state.containerId, state.user, state.options);
        }).catch(function (error) {
          state.notice = (error && error.message ? error.message : "Invitation indisponible") + " · BACKEND_LATER";
          render(state.containerId, state.user, state.options);
        });
      });
    }

    var toggleButton = container.querySelector("[data-confirm-toggle]");
    if (toggleButton) toggleButton.addEventListener("click", function () {
      if (!canUse(state.user, "staff.manage", "school")) return;
      var id = toggleButton.getAttribute("data-confirm-toggle");
      var person = (state.staff || []).find(function (item) { return item.id === id; });
      if (!person) return;
      toggleButton.disabled = true;
      global.SchoolSafeSchoolAPI.toggleStaffActive(id, !person.is_active).then(function () {
        person.is_active = !person.is_active;
        state.notice = "Statut mis à jour par le backend.";
        state.mutationPanel = null;
        render(state.containerId, state.user, state.options);
      }).catch(function (error) {
        state.notice = (error && error.message ? error.message : "Statut indisponible") + " · BACKEND_LATER";
        render(state.containerId, state.user, state.options);
      });
    });
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
      (state.activeView === "accounts" ? renderAccounts() : state.activeView === "permissions" ? renderPermissions() : dashboardMarkup(allowed));

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
    container.querySelectorAll("[data-admin-open]").forEach(function (button) {
      button.addEventListener("click", function () { open(button.getAttribute("data-admin-open")); });
    });
    if (state.activeView === "accounts") {
      bindAccounts(container);
      if (!state.staff && !state.accountsLoading && !state.accountsError) loadAccounts();
    }
    if (state.activeView === "permissions") {
      bindPermissions(container);
      if (!state.permissionCatalog && !state.permissionsLoading && !state.permissionsError) loadPermissions();
    }
    if (global.lucide && typeof global.lucide.createIcons === "function") global.lucide.createIcons();
  }

  function setSession(user) {
    state.user = user || {};
    render(state.containerId, state.user, state.options);
  }

  function open(view) {
    state.activeView = ["accounts", "permissions"].indexOf(view) >= 0 ? view : "dashboard";
    state.notice = "";
    state.selectedStaffId = null;
    state.mutationPanel = null;
    render(state.containerId, state.user, state.options);
  }

  function close() {
    var container = global.document && global.document.getElementById(state.containerId);
    if (container) container.hidden = true;
  }

  global.SchoolSafeAdministration = { render: render, setSession: setSession, open: open, close: close, canUse: canUse, visibleSections: visibleSections };
})(window);
