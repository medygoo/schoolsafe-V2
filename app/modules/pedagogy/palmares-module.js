(function (global) {
  "use strict";

  var state = {
    activeView: "class",
    selectedMonth: currentYearMonth(),
    selectedClassId: null,
    rankings: [],
    currentRanking: null,
    stars: [],
    children: [],
    classes: [],
    loading: false,
    error: null,
  };

  var container = null;
  var demoState = null;

  function currentYearMonth() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  function escapeMarkup(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function notify(message) {
    if (global.SchoolSafeApp && global.SchoolSafeApp.notify) global.SchoolSafeApp.notify(message);
    else global.dispatchEvent(new CustomEvent("schoolsafe-toast", { detail: { message: message } }));
  }

  function hasValidSessionToken() {
    try {
      var raw = global.localStorage.getItem("schoolsafe-v2-session");
      if (!raw) return false;
      var session = JSON.parse(raw);
      return !!(session && session.token);
    } catch (e) { return false; }
  }

  function isDemoMode() {
    if (global.schoolSafeDemoMode === true) return true;
    var host = String(global.location && global.location.hostname || "").toLowerCase();
    var isLocalhost = host === "localhost" || host === "127.0.0.1";
    return isLocalhost && !hasValidSessionToken();
  }

  function getSession() {
    try {
      var raw = global.localStorage.getItem("schoolsafe-v2-session");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function isParent(session) {
    return session && Array.isArray(session.roles) && session.roles.indexOf("parent") >= 0;
  }

  function canManage() {
    var session = getSession();
    if (!session || !Array.isArray(session.permissions)) return false;
    return session.permissions.indexOf("palmarques.manage") >= 0;
  }

  function createDemoState() {
    return {
      activeView: "class",
      selectedMonth: currentYearMonth(),
      selectedClassId: "demo-c1",
      rankings: [
        { id: "demo-r-class", school_id: "demo-school", class_id: "demo-c1", month: currentYearMonth(), status: "published", computed_at: new Date().toISOString() },
        { id: "demo-r-school", school_id: "demo-school", class_id: null, month: currentYearMonth(), status: "published", computed_at: new Date().toISOString() },
      ],
      currentRanking: null,
      stars: [{ ranking_id: "demo-r-class", student_id: "demo-s1", parent_profile_id: "demo-parent" }],
      children: [{ students: { id: "demo-s1", first_name: "Lucas", last_name: "Martin", class_id: "demo-c1", classes: { name: "1re A" } } }],
      classes: [{ id: "demo-c1", name: "1re A" }, { id: "demo-c2", name: "2e B" }],
      loading: false,
      error: null,
    };
  }

  function createDemoRankingEntries(rankingId) {
    var entries = [
      { student_id: "demo-s1", first_name: "Lucas", last_name: "Martin", classes: { name: "1re A" }, photo_path: null, rank: 1, monthly_average: 18.5 },
      { student_id: "demo-s2", first_name: "Emma", last_name: "Martin", classes: { name: "1re A" }, photo_path: null, rank: 2, monthly_average: 17.25 },
      { student_id: "demo-s3", first_name: "Ethan", last_name: "Leroy", classes: { name: "1re A" }, photo_path: null, rank: 3, monthly_average: 16 },
      { student_id: "demo-s4", first_name: "Chloé", last_name: "Bernard", classes: { name: "1re A" }, photo_path: null, rank: 4, monthly_average: 14 },
    ];
    return entries.map(function (e) {
      return {
        id: "demo-entry-" + e.student_id,
        ranking_id: rankingId,
        student_id: e.student_id,
        rank: e.rank,
        monthly_average: e.monthly_average,
        students: e,
      };
    });
  }

  async function init(parentContainer, session) {
    container = parentContainer;
    demoState = isDemoMode() ? createDemoState() : null;
    if (demoState) {
      Object.assign(state, demoState);
      state.selectedClassId = session && isParent(session) ? "demo-c1" : state.selectedClassId;
      await loadCurrentRanking();
      render();
      return;
    }

    state.loading = true;
    render();
    try {
      state.classes = await global.SchoolSafePedagogyAPI.listClasses();
      if (session && isParent(session)) {
        state.children = await global.SchoolSafePedagogyAPI.getParentChildren();
        if (state.children.length > 0) {
          state.selectedClassId = state.children[0].students.class_id;
        }
      } else if (state.classes.length > 0) {
        state.selectedClassId = state.classes[0].id;
      }
      await loadRankingsList();
      await loadCurrentRanking();
    } catch (e) {
      state.error = e.message || "Erreur de chargement";
      notify(state.error);
    }
    state.loading = false;
    render();
  }

  async function loadRankingsList() {
    var options = { month: state.selectedMonth };
    if (state.activeView === "class" && state.selectedClassId) options.class_id = state.selectedClassId;
    if (state.activeView === "school") options.class_id = "null";
    state.rankings = await global.SchoolSafePalmaresAPI.listRankings(options);
  }

  async function loadCurrentRanking() {
    var ranking = state.rankings.find(function (r) {
      if (state.activeView === "school") return r.class_id === null;
      return r.class_id === state.selectedClassId;
    });
    if (!ranking) {
      state.currentRanking = null;
      state.stars = [];
      return;
    }
    if (demoState) {
      state.currentRanking = {
        id: ranking.id,
        school_id: ranking.school_id,
        class_id: ranking.class_id,
        month: ranking.month,
        status: ranking.status,
        computed_at: ranking.computed_at,
        published_at: ranking.published_at,
        computed_by_profile_id: ranking.computed_by_profile_id,
        entries: createDemoRankingEntries(ranking.id),
      };
      state.stars = demoState.stars;
      return;
    }
    state.currentRanking = await global.SchoolSafePalmaresAPI.getRanking(ranking.id);
    state.stars = await global.SchoolSafePalmaresAPI.listStars(ranking.id);
  }

  async function computeRanking() {
    if (!canManage()) return;
    state.loading = true;
    render();
    try {
      await global.SchoolSafePalmaresAPI.computeRanking(state.selectedMonth, state.activeView === "school" ? undefined : state.selectedClassId);
      notify("Palmarès calculé.");
      await loadRankingsList();
      await loadCurrentRanking();
    } catch (e) {
      notify(e.message || "Erreur de calcul");
    }
    state.loading = false;
    render();
  }

  async function publishRanking() {
    if (!state.currentRanking || !canManage()) return;
    state.loading = true;
    render();
    try {
      await global.SchoolSafePalmaresAPI.publishRanking(state.currentRanking.id);
      notify("Palmarès publié.");
      await loadRankingsList();
      await loadCurrentRanking();
    } catch (e) {
      notify(e.message || "Erreur de publication");
    }
    state.loading = false;
    render();
  }

  async function toggleStar(studentId) {
    if (!state.currentRanking) return;
    var session = getSession();
    if (!session || !isParent(session)) return;
    var existing = state.stars.find(function (s) { return s.student_id === studentId; });
    try {
      if (existing) {
        await global.SchoolSafePalmaresAPI.removeStar(state.currentRanking.id, studentId);
        notify("Étoile retirée.");
      } else {
        await global.SchoolSafePalmaresAPI.addStar(state.currentRanking.id, studentId);
        notify("⭐ Élève encouragé !");
      }
      state.stars = await global.SchoolSafePalmaresAPI.listStars(state.currentRanking.id);
      render();
    } catch (e) {
      notify(e.message || "Erreur");
    }
  }

  function studentPhotoUrl(student) {
    if (!student) return "./schoolsafe-logo.png";
    if (student.photo_path) return student.photo_path;
    return "./schoolsafe-logo.png";
  }

  function starCount(studentId) {
    return state.stars.filter(function (s) { return s.student_id === studentId; }).length;
  }

  function hasStarred(studentId) {
    var session = getSession();
    if (!session) return false;
    return state.stars.some(function (s) { return s.student_id === studentId && s.parent_profile_id === session.profile.id; });
  }

  function render() {
    if (!container) return;
    var session = getSession();
    var isParentUser = session && isParent(session);
    var html = '<div class="palmares-module">';
    html += renderHeader(isParentUser);
    html += renderControls(isParentUser);
    if (state.loading) html += global.ssState({ type: "loading", title: "Chargement du palmarès", message: "Veuillez patienter pendant le chargement des classements." });
    else if (state.error) html += global.ssState({ type: "error", title: "Erreur", message: state.error, retry: { attrs: { id: "retryPalmares" } } });
    else if (!state.currentRanking) html += renderEmpty();
    else html += renderRanking();
    html += "</div>";
    container.innerHTML = html;
    bindEvents();
  }

  function renderHeader(isParentUser) {
    return '<div class="palmares-header"><h2><i data-lucide="trophy"></i> Palmarès</h2><p>' + (isParentUser ? "Top 10 de la classe de votre enfant et de toute l’école" : "Classements mensuels par classe et par école") + '</p></div>';
  }

  function renderControls(isParentUser) {
    var html = '<div class="palmares-controls">';
    html += '<label>Mois <input type="month" id="palmaresMonth" value="' + escapeMarkup(state.selectedMonth) + '"></label>';
    html += '<div class="palmares-view-toggle">' +
      '<button type="button" data-view="class" class="' + (state.activeView === "class" ? "active" : "") + '">Par classe</button>' +
      '<button type="button" data-view="school" class="' + (state.activeView === "school" ? "active" : "") + '">Toute l’école</button>' +
      '</div>';
    if (!isParentUser && state.activeView === "class") {
      html += '<label>Classe <select id="palmaresClass">';
      state.classes.forEach(function (c) {
        html += '<option value="' + escapeMarkup(c.id) + '"' + (c.id === state.selectedClassId ? " selected" : "") + '>' + escapeMarkup(c.name) + '</option>';
      });
      html += '</select></label>';
    }
    if (!isParentUser && canManage()) {
      html += global.ssButton({ label: "Calculer", variant: "primary", className: "small", attrs: { id: "palmaresCompute" } });
      if (state.currentRanking && state.currentRanking.status === "draft") {
        html += global.ssButton({ label: "Publier", variant: "primary", className: "small", attrs: { id: "palmaresPublish" } });
      }
    }
    html += "</div>";
    return html;
  }

  function renderEmpty() {
    return global.ssState({
      type: "empty",
      title: "Aucun palmarès",
      message: "Aucun palmarès n'a été calculé pour ce mois.",
      action: canManage() ? { label: "Calculer le palmarès", variant: "primary", attrs: { id: "palmaresComputeEmpty" } } : undefined
    });
  }

  function renderRanking() {
    var entries = (state.currentRanking.entries || []).slice(0, 10);
    var html = '<div class="palmares-ranking">';
    if (state.currentRanking.status === "draft") html += '<div class="palmares-draft-badge">Brouillon</div>';
    html += '<div class="palmares-podium">';
    entries.slice(0, 3).forEach(function (entry, index) {
      html += renderPodiumCard(entry, index);
    });
    html += '</div>';
    if (entries.length > 3) {
      html += '<ol class="palmares-list" start="4">';
      entries.slice(3).forEach(function (entry) {
        html += renderListItem(entry);
      });
      html += '</ol>';
    }
    html += '</div>';
    return html;
  }

  function renderPodiumCard(entry, index) {
    var medal = ["🥇", "🥈", "🥉"][index];
    var student = entry.students;
    var stars = starCount(entry.student_id);
    var starred = hasStarred(entry.student_id);
    return '<div class="palmares-card podium rank-' + (index + 1) + '">' +
      '<div class="palmares-medal">' + medal + '</div>' +
      '<img class="palmares-photo" src="' + escapeMarkup(studentPhotoUrl(student)) + '" alt="">' +
      '<div class="palmares-name">' + escapeMarkup(student.first_name + " " + student.last_name) + '</div>' +
      '<div class="palmares-class">' + escapeMarkup(student.classes && student.classes.name ? student.classes.name : "") + '</div>' +
      '<div class="palmares-average">' + entry.monthly_average + '/20</div>' +
      '<div class="palmares-stars">⭐ ' + stars + '</div>' +
      renderStarButton(entry.student_id, starred) +
      '</div>';
  }

  function renderListItem(entry) {
    var student = entry.students;
    var stars = starCount(entry.student_id);
    var starred = hasStarred(entry.student_id);
    return '<li class="palmares-list-item">' +
      '<span class="palmares-rank">' + entry.rank + '</span>' +
      '<img class="palmares-photo small" src="' + escapeMarkup(studentPhotoUrl(student)) + '" alt="">' +
      '<span class="palmares-name">' + escapeMarkup(student.first_name + " " + student.last_name) + '</span>' +
      '<span class="palmares-class">' + escapeMarkup(student.classes && student.classes.name ? student.classes.name : "") + '</span>' +
      '<span class="palmares-average">' + entry.monthly_average + '/20</span>' +
      '<span class="palmares-stars">⭐ ' + stars + '</span>' +
      renderStarButton(entry.student_id, starred) +
      '</li>';
  }

  function isParentChild(studentId) {
    if (!state.children || !state.children.length) return false;
    return state.children.some(function (child) {
      return child && child.students && child.students.id === studentId;
    });
  }

  function renderStarButton(studentId, starred) {
    var session = getSession();
    if (!session || !Array.isArray(session.roles) || session.roles.indexOf("parent") < 0) return '';
    if (!isParentChild(studentId)) return '';
    return '<button type="button" class="palmares-star-btn' + (starred ? " starred" : "") + '" data-star-student="' + escapeMarkup(studentId) + '">' +
      (starred ? "⭐ Retirer" : "⭐ Encourager") +
      '</button>';
  }

  function bindEvents() {
    var monthInput = container.querySelector("#palmaresMonth");
    if (monthInput) monthInput.addEventListener("change", function (e) { state.selectedMonth = e.target.value; loadRankingsList().then(loadCurrentRanking).then(render); });

    container.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () { state.activeView = btn.getAttribute("data-view"); loadRankingsList().then(loadCurrentRanking).then(render); });
    });

    var classSelect = container.querySelector("#palmaresClass");
    if (classSelect) classSelect.addEventListener("change", function (e) { state.selectedClassId = e.target.value; loadRankingsList().then(loadCurrentRanking).then(render); });

    var computeBtn = container.querySelector("#palmaresCompute");
    if (computeBtn) computeBtn.addEventListener("click", computeRanking);
    var computeEmptyBtn = container.querySelector("#palmaresComputeEmpty");
    if (computeEmptyBtn) computeEmptyBtn.addEventListener("click", computeRanking);
    var retryBtn = container.querySelector("#retryPalmares");
    if (retryBtn) retryBtn.addEventListener("click", function () { init(container, getSession()); });

    var publishBtn = container.querySelector("#palmaresPublish");
    if (publishBtn) publishBtn.addEventListener("click", publishRanking);

    container.querySelectorAll("[data-star-student]").forEach(function (btn) {
      btn.addEventListener("click", function () { toggleStar(btn.getAttribute("data-star-student")); });
    });

    if (global.lucide && global.lucide.createIcons) {
      try { global.lucide.createIcons(); } catch (e) {}
    }
  }

  global.renderPalmaresModule = function (parentContainer, session) {
    init(parentContainer, session);
  };

  global.refreshPalmaresModule = function () {
    if (container) render();
  };
})(window);
