(function () {
  "use strict";

  var currentTab = "school";
  var settingsData = null;
  var staffData = [];
  var rolesData = [];
  var permissionsData = [];
  var tabsBound = false;

  function escapeMarkup(text) {
    if (text == null) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notify(message) {
    if (window.SchoolSafeApp && window.SchoolSafeApp.notify) {
      window.SchoolSafeApp.notify(message);
    } else {
      window.alert(message);
    }
  }

  async function loadSchool() {
    try {
      settingsData = await window.SchoolSafeSchoolAPI.getSettings();
      renderSchoolTab();
    } catch (e) {
      notify("Erreur chargement école : " + e.message);
    }
  }

  async function loadStaff() {
    try {
      var results = await Promise.all([
        window.SchoolSafeSchoolAPI.listStaff(),
        window.SchoolSafeSchoolAPI.listRoles(),
        window.SchoolSafeSchoolAPI.listPermissions(),
      ]);
      staffData = results[0];
      rolesData = results[1];
      permissionsData = results[2];
      renderStaffTab();
    } catch (e) {
      notify("Erreur chargement équipe : " + e.message);
    }
  }

  function renderTabs() {
    var container = document.getElementById("schoolTabs");
    if (!container) return;
    container.querySelectorAll("button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-school-tab") === currentTab);
    });
  }

  function renderAcademicYears() {
    var years = settingsData.academic_years || [];
    var rows = years.map(function (y) {
      return (
        '<tr data-year-id="' + escapeMarkup(y.id) + '">' +
        "<td>" + escapeMarkup(y.label) + "</td>" +
        "<td>" + escapeMarkup(y.starts_on) + "</td>" +
        "<td>" + escapeMarkup(y.ends_on) + "</td>" +
        '<td>' + (y.is_active ? '<span class="school-status active">Active</span>' : '') + "</td>" +
        '<td class="school-actions">' +
        (y.is_active ? '' : '<button class="icon-button" type="button" data-action="activate-year" title="Activer"><i data-lucide="check"></i></button>') +
        '<button class="icon-button" type="button" data-action="edit-year" title="Modifier"><i data-lucide="pencil"></i></button>' +
        "</td></tr>"
      );
    }).join("");
    return (
      '<section class="form-section"><h3>Années scolaires</h3>' +
      '<div class="school-table-wrap"><table class="school-table"><thead><tr><th>Libellé</th><th>Début</th><th>Fin</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="school-empty">Aucune année scolaire.</td></tr>') +
      "</tbody></table></div>" +
      '<button class="primary-button" type="button" id="addYearBtn"><i data-lucide="plus"></i> Ajouter une année</button>' +
      "</section>"
    );
  }

  function renderCycles() {
    var cycles = settingsData.cycles || [];
    var rows = cycles.map(function (c) {
      return (
        '<tr><td>' + escapeMarkup(c.cycle_name) + '</td>' +
        '<td>' + (c.is_active ? '<span class="school-status active">Actif</span>' : '<span class="school-status inactive">Inactif</span>') + "</td>" +
        '<td><button type="button" data-cycle="' + escapeMarkup(c.cycle_key) + '" class="toggle-cycle">' + (c.is_active ? "Désactiver" : "Activer") + "</button></td></tr>"
      );
    }).join("");
    return (
      '<section class="form-section"><h3>Cycles</h3>' +
      '<div class="school-table-wrap"><table class="school-table"><thead><tr><th>Cycle</th><th>Statut</th><th>Action</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" class="school-empty">Aucun cycle configuré.</td></tr>') +
      "</tbody></table></div></section>"
    );
  }

  function renderSchoolTab() {
    var container = document.getElementById("schoolContent");
    if (!container || !settingsData) return;
    var s = settingsData;
    container.innerHTML =
      '<form id="schoolSettingsForm" class="school-form">' +
      '<div class="form-section"><h3>Identité de l\'école</h3>' +
      '<label>Nom (français)<input name="name" required value="' + escapeMarkup(s.identity.name) + '"></label>' +
      '<label>Nom (anglais)<input name="name_en" value="' + escapeMarkup(s.identity.name_en || "") + '"></label>' +
      '<label>Nom légal<input name="legal_name" value="' + escapeMarkup(s.identity.legal_name || "") + '"></label>' +
      '<label>Type<input name="school_type" value="' + escapeMarkup(s.identity.school_type || "") + '"></label>' +
      '<label>Code d\'agrément<input name="approval_code" value="' + escapeMarkup(s.identity.approval_code || "") + '"></label>' +
      '<label>Devise<input name="currency" value="' + escapeMarkup(s.identity.currency || "USD") + '"></label>' +
      '<label>Motto / devise de l\'école<input name="motto" value="' + escapeMarkup(s.identity.motto || "") + '"></label>' +
      '<label>Nom de la banque<input name="bank_name" value="' + escapeMarkup(s.identity.bank_name || "") + '"></label>' +
      '<label>Compte bancaire<input name="bank_account" value="' + escapeMarkup(s.identity.bank_account || "") + '"></label>' +
      '<label>Numéro d\'identification fiscale<input name="tax_id" value="' + escapeMarkup(s.identity.tax_id || "") + '"></label>' +
      '<label>Nom du directeur<input name="director_name" value="' + escapeMarkup(s.identity.director_name || "") + '"></label>' +
      '<label>Langue officielle<input name="official_language" value="' + escapeMarkup(s.identity.official_language || "FR") + '"></label>' +
      "</div>" +
      '<div class="form-section"><h3>Coordonnées</h3>' +
      '<label>Pays<input name="country" value="' + escapeMarkup(s.contact.country || "") + '"></label>' +
      '<label>Province<input name="province" value="' + escapeMarkup(s.contact.province || "") + '"></label>' +
      '<label>Ville<input name="city" value="' + escapeMarkup(s.contact.city || "") + '"></label>' +
      '<label>Adresse<textarea name="address" rows="2">' + escapeMarkup(s.contact.address || "") + '</textarea></label>' +
      '<label>Email<input name="email" type="email" value="' + escapeMarkup(s.contact.email || "") + '"></label>' +
      '<label>Téléphone<input name="phone" value="' + escapeMarkup(s.contact.phone || "") + '"></label>' +
      '<label>Site web<input name="website_url" value="' + escapeMarkup(s.contact.website_url || "") + '"></label>' +
      "</div>" +
      '<div class="form-section"><h3>Apparence</h3>' +
      '<label>Couleur principale<input name="primary_color" type="color" value="' + escapeMarkup(s.brand.primary_color || "#071a3d") + '"></label>' +
      '<label>Couleur d\'accent<input name="accent_color" type="color" value="' + escapeMarkup(s.brand.accent_color || "#e9a515") + '"></label>' +
      '<label>Pied de page<input name="document_footer" value="' + escapeMarkup(s.brand.document_footer || "") + '"></label>' +
      '<label>Logo<input name="logo_file" type="file" accept="image/png,image/jpeg,image/webp"></label>' +
      '<input name="logo_path" type="hidden" value="' + escapeMarkup(s.brand.logo_path || "") + '">' +
      (s.brand.logo_path ? '<img src="' + escapeMarkup(s.brand.logo_path) + '" alt="Logo" style="max-width:200px;max-height:100px;">' : '') +
      "</div>" +
      renderAcademicYears() +
      renderCycles() +
      '<div class="form-actions"><button class="primary-button" type="submit"><i data-lucide="save"></i> Enregistrer</button></div>' +
      "</form>";

    document.getElementById("schoolSettingsForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.target;
      var logoPath = form.logo_path.value || null;
      try {
        if (form.logo_file.files && form.logo_file.files[0]) {
          var upload = await window.SchoolSafeSchoolAPI.uploadLogo(form.logo_file.files[0]);
          logoPath = upload && upload.logo_path ? upload.logo_path : logoPath;
        }
        var payload = {
          identity: {
            name: form.name.value,
            name_en: form.name_en.value || null,
            legal_name: form.legal_name.value || null,
            school_type: form.school_type.value || null,
            approval_code: form.approval_code.value || null,
            currency: form.currency.value || null,
            motto: form.motto.value || null,
            bank_name: form.bank_name.value || null,
            bank_account: form.bank_account.value || null,
            tax_id: form.tax_id.value || null,
            director_name: form.director_name.value || null,
            official_language: form.official_language.value || null,
          },
          contact: {
            country: form.country.value || null,
            province: form.province.value || null,
            city: form.city.value || null,
            address: form.address.value || null,
            email: form.email.value || null,
            phone: form.phone.value || null,
            website_url: form.website_url.value || null,
          },
          brand: {
            primary_color: form.primary_color.value,
            accent_color: form.accent_color.value,
            document_footer: form.document_footer.value || null,
            logo_path: logoPath,
          },
        };
        settingsData = await window.SchoolSafeSchoolAPI.updateSettings(payload);
        notify("Paramètres de l'école enregistrés.");
        renderSchoolTab();
      } catch (err) {
        notify("Erreur : " + err.message);
      }
    });

    var addYearBtn = document.getElementById("addYearBtn");
    if (addYearBtn) {
      addYearBtn.addEventListener("click", function () {
        openYearModal();
      });
    }

    container.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var yearId = btn.closest("tr").getAttribute("data-year-id");
        var action = btn.getAttribute("data-action");
        if (action === "activate-year") activateYear(yearId);
        if (action === "edit-year") openYearModal(yearId);
      });
    });

    container.querySelectorAll(".toggle-cycle").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var cycleKey = btn.getAttribute("data-cycle");
        var cycle = (settingsData.cycles || []).find(function (c) {
          return c.cycle_key === cycleKey;
        });
        if (!cycle) return;
        var newState = !cycle.is_active;
        try {
          await window.SchoolSafeSchoolAPI.toggleCycle(cycleKey, newState);
          notify(newState ? "Cycle activé." : "Cycle désactivé.");
          await loadSchool();
        } catch (err) {
          notify("Erreur : " + err.message);
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function openYearModal(yearId) {
    var year = null;
    if (yearId) {
      year = (settingsData.academic_years || []).find(function (y) {
        return y.id === yearId;
      });
      if (!year) return;
    }
    var container = document.getElementById("schoolContent");
    container.insertAdjacentHTML(
      "beforeend",
      '<div class="school-modal" id="yearModal">' +
        '<div class="school-modal-box">' +
        '<h3>' + (yearId ? "Modifier l'année" : "Ajouter une année") + "</h3>" +
        '<form id="yearForm">' +
        '<label>Libellé<input name="label" required value="' + (year ? escapeMarkup(year.label) : "") + '"></label>' +
        '<label>Date de début<input name="starts_on" type="date" required value="' + (year ? escapeMarkup(year.starts_on) : "") + '"></label>' +
        '<label>Date de fin<input name="ends_on" type="date" required value="' + (year ? escapeMarkup(year.ends_on) : "") + '"></label>' +
        '<label>Périodes<select name="periods" required>' +
        '<option value="Trimestres"' + (year && year.periods === "Trimestres" ? " selected" : "") + '>Trimestres</option>' +
        '<option value="Semestres"' + (year && year.periods === "Semestres" ? " selected" : "") + '>Semestres</option>' +
        '</select></label>' +
        '<div class="form-actions"><button class="secondary-button" type="button" id="cancelYear">Annuler</button><button class="primary-button" type="submit">Enregistrer</button></div>' +
        "</form></div></div>"
    );

    document.getElementById("cancelYear").addEventListener("click", function () {
      document.getElementById("yearModal").remove();
    });

    document.getElementById("yearForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.target;
      var payload = {
        label: form.label.value,
        starts_on: form.starts_on.value,
        ends_on: form.ends_on.value,
        periods: form.periods.value,
      };
      try {
        if (yearId) {
          await window.SchoolSafeSchoolAPI.updateAcademicYear(yearId, payload);
          notify("Année mise à jour.");
        } else {
          await window.SchoolSafeSchoolAPI.createAcademicYear(payload);
          notify("Année créée.");
        }
        document.getElementById("yearModal").remove();
        await loadSchool();
      } catch (err) {
        notify("Erreur : " + err.message);
      }
    });
  }

  async function activateYear(yearId) {
    try {
      await window.SchoolSafeSchoolAPI.activateAcademicYear(yearId);
      notify("Année activée.");
      await loadSchool();
    } catch (err) {
      notify("Erreur : " + err.message);
    }
  }

  function renderStaffTab() {
    var container = document.getElementById("schoolContent");
    if (!container) return;

    var rows = staffData.map(function (person) {
      var roleBadges = (person.roles || [])
        .map(function (r) {
          return '<span class="school-role-badge">' + escapeMarkup(r.label) + "</span>";
        })
        .join("");
      return (
        '<tr data-profile-id="' + escapeMarkup(person.id) + '">' +
        "<td>" + escapeMarkup(person.display_name) + "</td>" +
        "<td>" + escapeMarkup(person.email) + "</td>" +
        "<td>" + escapeMarkup(person.phone || "—") + "</td>" +
        '<td class="school-roles-cell">' + roleBadges + "</td>" +
        "<td>" + (person.is_active ? '<span class="school-status active">Actif</span>' : '<span class="school-status inactive">Inactif</span>') + "</td>" +
        '<td class="school-actions">' +
        '<button class="icon-button" type="button" data-action="view-staff" title="Détails"><i data-lucide="eye"></i></button>' +
        '<button class="icon-button" type="button" data-action="edit-roles" title="Modifier les rôles"><i data-lucide="shield"></i></button>' +
        '<button class="icon-button" type="button" data-action="toggle-active" title="Activer/Désactiver"><i data-lucide="power"></i></button>' +
        '<button class="icon-button" type="button" data-action="resend-invite" title="Renvoyer l\'invitation"><i data-lucide="mail"></i></button>' +
        "</td></tr>"
      );
    }).join("");

    container.innerHTML =
      '<div class="school-staff-header">' +
      '<h3>Membres de l\'équipe</h3>' +
      '<button class="primary-button" type="button" id="inviteStaffBtn"><i data-lucide="user-plus"></i> Inviter</button>' +
      "</div>" +
      '<div class="school-table-wrap">' +
      '<table class="school-table"><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Rôles</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6" class="school-empty">Aucun membre pour l\'instant.</td></tr>') +
      "</tbody></table></div>";

    container.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var profileId = btn.closest("tr").getAttribute("data-profile-id");
        var action = btn.getAttribute("data-action");
        if (action === "edit-roles") openRoleEditor(profileId);
        if (action === "toggle-active") toggleActive(profileId);
        if (action === "view-staff") viewStaffDetail(profileId);
        if (action === "resend-invite") resendStaffInvite(profileId);
      });
    });

    document.getElementById("inviteStaffBtn").addEventListener("click", openInviteModal);

    if (window.lucide) window.lucide.createIcons();
  }

  async function viewStaffDetail(profileId) {
    try {
      var detail = await window.SchoolSafeSchoolAPI.getStaffDetail(profileId);
      var container = document.getElementById("schoolContent");
      var roles = (detail.roles || []).map(function (r) {
        return escapeMarkup(r.label);
      }).join(", ");
      container.insertAdjacentHTML(
        "beforeend",
        '<div class="school-modal" id="staffDetailModal">' +
          '<div class="school-modal-box">' +
          '<h3>' + escapeMarkup(detail.display_name) + "</h3>" +
          '<p><b>Email :</b> ' + escapeMarkup(detail.email) + "</p>" +
          '<p><b>Téléphone :</b> ' + escapeMarkup(detail.phone || "—") + "</p>" +
          '<p><b>Rôles :</b> ' + (roles || "—") + "</p>" +
          '<p><b>Statut :</b> ' + (detail.is_active ? "Actif" : "Inactif") + "</p>" +
          '<div class="form-actions"><button class="secondary-button" type="button" id="closeStaffDetail">Fermer</button></div>' +
          "</div></div>"
      );
      document.getElementById("closeStaffDetail").addEventListener("click", function () {
        document.getElementById("staffDetailModal").remove();
      });
    } catch (err) {
      notify("Erreur : " + err.message);
    }
  }

  async function resendStaffInvite(profileId) {
    try {
      await window.SchoolSafeSchoolAPI.resendInvite(profileId);
      notify("Invitation renvoyée.");
      await loadStaff();
    } catch (err) {
      notify("Erreur : " + err.message);
    }
  }

  function openInviteModal() {
    var container = document.getElementById("schoolContent");
    var rolesOptions = rolesData
      .map(function (r) {
        return '<label class="school-checkbox"><input type="checkbox" name="role" value="' + escapeMarkup(r.id) + '"> ' + escapeMarkup(r.label) + "</label>";
      })
      .join("");

    container.insertAdjacentHTML(
      "beforeend",
      '<div class="school-modal" id="inviteModal">' +
        '<div class="school-modal-box">' +
        '<h3>Inviter un membre</h3>' +
        '<form id="inviteStaffForm">' +
        '<label>Prénom<input name="first_name" required></label>' +
        '<label>Nom<input name="last_name" required></label>' +
        '<label>Email<input name="email" type="email" required></label>' +
        '<label>Téléphone<input name="phone"></label>' +
        '<div class="school-roles-select"><span>Rôles</span>' + rolesOptions + "</div>" +
        '<div class="form-actions"><button class="secondary-button" type="button" id="cancelInvite">Annuler</button><button class="primary-button" type="submit">Inviter</button></div>' +
        "</form></div></div>"
    );

    document.getElementById("cancelInvite").addEventListener("click", function () {
      document.getElementById("inviteModal").remove();
    });

    document.getElementById("inviteStaffForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.target;
      var selectedRoles = Array.from(form.querySelectorAll('input[name="role"]:checked')).map(function (cb) {
        return cb.value;
      });
      if (selectedRoles.length === 0) {
        notify("Sélectionnez au moins un rôle.");
        return;
      }
      try {
        await window.SchoolSafeSchoolAPI.inviteStaff({
          email: form.email.value,
          first_name: form.first_name.value,
          last_name: form.last_name.value,
          phone: form.phone.value || undefined,
          role_ids: selectedRoles,
        });
        notify("Invitation envoyée.");
        document.getElementById("inviteModal").remove();
        await loadStaff();
      } catch (err) {
        notify("Erreur : " + err.message);
      }
    });
  }

  function openRoleEditor(profileId) {
    var person = staffData.find(function (p) {
      return p.id === profileId;
    });
    if (!person) return;

    var container = document.getElementById("schoolContent");
    var rolesOptions = rolesData
      .map(function (r) {
        var checked = person.roles.some(function (pr) {
          return pr.id === r.id;
        });
        return (
          '<label class="school-checkbox"><input type="checkbox" name="role" value="' +
          escapeMarkup(r.id) +
          '"' +
          (checked ? " checked" : "") +
          "> " +
          escapeMarkup(r.label) +
          "</label>"
        );
      })
      .join("");

    container.insertAdjacentHTML(
      "beforeend",
      '<div class="school-modal" id="roleModal">' +
        '<div class="school-modal-box">' +
        '<h3>Rôles de ' + escapeMarkup(person.display_name) + "</h3>" +
        '<form id="roleStaffForm">' +
        '<div class="school-roles-select">' + rolesOptions + "</div>" +
        '<div class="form-actions"><button class="secondary-button" type="button" id="cancelRole">Annuler</button><button class="primary-button" type="submit">Enregistrer</button></div>' +
        "</form></div></div>"
    );

    document.getElementById("cancelRole").addEventListener("click", function () {
      document.getElementById("roleModal").remove();
    });

    document.getElementById("roleStaffForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var selectedRoles = Array.from(e.target.querySelectorAll('input[name="role"]:checked')).map(function (cb) {
        return cb.value;
      });
      try {
        await window.SchoolSafeSchoolAPI.updateStaffRoles(profileId, selectedRoles);
        notify("Rôles mis à jour.");
        document.getElementById("roleModal").remove();
        await loadStaff();
      } catch (err) {
        notify("Erreur : " + err.message);
      }
    });
  }

  async function toggleActive(profileId) {
    var person = staffData.find(function (p) {
      return p.id === profileId;
    });
    if (!person) return;
    var newState = !person.is_active;
    try {
      await window.SchoolSafeSchoolAPI.toggleStaffActive(profileId, newState);
      notify(newState ? "Utilisateur activé." : "Utilisateur désactivé.");
      await loadStaff();
    } catch (err) {
      notify("Erreur : " + err.message);
    }
  }

  function bindTabs() {
    if (tabsBound) return;
    var container = document.getElementById("schoolTabs");
    if (!container) return;
    tabsBound = true;
    container.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-school-tab]");
      if (!btn) return;
      currentTab = btn.getAttribute("data-school-tab");
      renderTabs();
      if (currentTab === "school") loadSchool();
      if (currentTab === "staff") loadStaff();
    });
  }

  function render(tabName) {
    if (tabName === "school" || tabName === "staff") {
      currentTab = tabName;
    }
    renderTabs();
    if (currentTab === "school") loadSchool();
    if (currentTab === "staff") loadStaff();
  }

  window.SchoolSafeSchoolModule = {
    render: function (tabName) {
      bindTabs();
      render(tabName);
    },
  };
})();
