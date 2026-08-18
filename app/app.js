(function () {
  "use strict";

  var screens = {
    splash: document.getElementById("splash"),
    guardian: document.getElementById("guardian"),
    auth: document.getElementById("auth"),
    setup: document.getElementById("setup"),
    workspace: document.getElementById("workspace")
  };
  var toastTimer = null;
  var rotationTimer = null;
  var guardianGalleryTimer = null;
  var guardianGalleryIndex = 0;
  var imageIndex = 0;
  var imageFront = "A";
  var loginImages = [
    "login-kid-1.jpg",
    "login-kid-2.jpg",
    "login-kid-3.jpg",
    "login-kid-4.jpg",
    "login-kid-5.jpg",
    "login-kid-6.jpg"
  ];
  var schoolMediaLibrary = [
    { src: "login-kid-1.jpg", alt: "Élève SchoolSafe", desktop: [60,34], mobile: [62,31], active: true, order: 1 },
    { src: "login-kid-2.jpg", alt: "Élève SchoolSafe", desktop: [32,31], mobile: [34,29], active: true, order: 2 },
    { src: "login-kid-3.jpg", alt: "Élève SchoolSafe", desktop: [35,34], mobile: [34,31], active: true, order: 3 },
    { src: "login-kid-4.jpg", alt: "Élève SchoolSafe", desktop: [26,31], mobile: [25,29], active: true, order: 4 },
    { src: "login-kid-5.jpg", alt: "Élève SchoolSafe", desktop: [54,30], mobile: [54,28], active: true, order: 5 },
    { src: "login-kid-6.jpg", alt: "Élève SchoolSafe", desktop: [52,28], mobile: [52,27], active: true, order: 6 }
  ];

  var apiBase = "http://127.0.0.1:8787";
  var supabaseClient = null;
  var currentSession = null;
  var backendConfig = null;
  var pendingPhone = null;
  var setupToken = null;

  function tryLocalStorage() { try { return window.localStorage; } catch (e) { return null; } }
  function storageGet(key) { var s = tryLocalStorage(); return s ? s.getItem(key) : null; }
  function storageSet(key, value) { var s = tryLocalStorage(); if (s) s.setItem(key, value); }
  function storageRemove(key) { var s = tryLocalStorage(); if (s) s.removeItem(key); }

  function normalizePhone(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    if (digits.indexOf("243") === 0 && digits.length > 9) digits = digits.substring(3);
    return "+243" + digits;
  }

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (!backendConfig || !backendConfig.supabase_url || !backendConfig.supabase_anon_key) return null;
    if (!window.SchoolSafeSupabaseSDK || !window.SchoolSafeSupabaseSDK.createClient) return null;
    supabaseClient = window.SchoolSafeSupabaseSDK.createClient(backendConfig.supabase_url, backendConfig.supabase_anon_key, {
      auth: { autoRefreshToken: true, persistSession: false }
    });
    return supabaseClient;
  }

  async function loadBackendConfig() {
    try {
      var res = await fetch(apiBase + "/config", { method: "GET", headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      backendConfig = await res.json();
      window.schoolSafeBackendConfig = backendConfig;
      return backendConfig;
    } catch (e) {
      return null;
    }
  }

  async function apiPost(path, body) {
    var res = await fetch(apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var message = data && data.message ? data.message : ("Erreur " + res.status);
      throw new Error(message);
    }
    return data;
  }

  function currentApiToken() {
    if (currentSession && currentSession.token) return currentSession.token;
    try {
      var raw = storageGet("schoolsafe-v2-session");
      if (!raw) return null;
      var session = JSON.parse(raw);
      return session && session.token ? session.token : null;
    } catch (e) { return null; }
  }

  async function apiGetAuth(path) {
    var token = currentApiToken();
    var res = await fetch(apiBase + path, {
      method: "GET",
      headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var message = data && data.message ? data.message : ("Erreur " + res.status);
      throw new Error(message);
    }
    return data;
  }

  async function apiPostAuth(path, body) {
    var token = currentApiToken();
    var res = await fetch(apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(body)
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var message = data && data.message ? data.message : ("Erreur " + res.status);
      throw new Error(message);
    }
    return data;
  }

  function storeSession(session) {
    currentSession = session;
    if (session) storageSet("schoolsafe-v2-session", JSON.stringify(session));
    else storageRemove("schoolsafe-v2-session");
  }

  function loadSession() {
    try {
      var raw = storageGet("schoolsafe-v2-session");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearSession() {
    currentSession = null;
    storageRemove("schoolsafe-v2-session");
    supabaseClient = null;
  }

  async function callBootstrap(token) {
    var res = await fetch(apiBase + "/session/bootstrap", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    });
    if (!res.ok) throw new Error("Bootstrap " + res.status);
    return await res.json();
  }

  function applyBootstrap(bootstrap) {
    if (!bootstrap || !bootstrap.profile || !bootstrap.roles || !bootstrap.roles.length) {
      throw new Error("Profil incomplet");
    }
    var savedActiveRole = storageGet("schoolsafe-v2-active-role");
    var activeRole = bootstrap.roles.indexOf(savedActiveRole) >= 0 ? savedActiveRole : bootstrap.roles[0];
    var session = {
      token: currentSession && currentSession.token ? currentSession.token : null,
      profile: bootstrap.profile,
      roles: bootstrap.roles,
      permissions: bootstrap.permissions || [],
      scopes: bootstrap.scopes || [],
      school: bootstrap.school || null,
      offline_policy: bootstrap.offline_policy || { max_offline_hours: 24 }
    };
    storeSession(session);
    storageSet("schoolsafe-v2-active-role", activeRole);
    document.getElementById("workspaceProfileName").textContent = bootstrap.profile.display_name || "";
    document.getElementById("workspaceInitials").textContent = initialsFromName(bootstrap.profile.display_name || "SchoolSafe");
    document.getElementById("workspaceSchoolName").textContent = bootstrap.school ? bootstrap.school.name : "Configuration en cours";
    document.getElementById("workspaceRole").textContent = roleCatalog[activeRole] ? roleCatalog[activeRole].label : activeRole;
    document.getElementById("statusRole").textContent = roleCatalog[activeRole] ? roleCatalog[activeRole].label : activeRole;
    document.getElementById("statusScope").textContent = scopeSummary(session);
    document.getElementById("syncStatusDetail").textContent = "Connecté · " + (bootstrap.school ? bootstrap.school.name : "école");
    renderWorkspace(activeRole);
  }

  function initialsFromName(name) {
    return String(name || "")
      .split(/\s+/)
      .filter(function (w) { return w.length > 0; })
      .slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); })
      .join("");
  }

  function scopeSummary(session) {
    if (!session || !session.scopes || !session.scopes.length) return "Instance";
    var parts = session.scopes.map(function (s) { return s.label || s.type + (s.id ? " · " + s.id : ""); });
    return parts.join(" · ") || "Instance";
  }

  function enterDemo() {
    notify("Accès de démonstration — ouverture de l’espace Administrateur principal.");
    window.setTimeout(function () { showScreen("workspace"); }, 250);
  }

  function enterLiveSession() {
    notify("Connexion réussie. Chargement de l’espace.");
    window.setTimeout(function () { showScreen("workspace"); }, 250);
  }

  var branchDefinitions = {
    pilotage: { label: "Pilotage", icon: "layout-dashboard", color: "#1264df", background: "#dceaff" },
    school: { label: "École", icon: "school", color: "#087a55", background: "#dff8ee" },
    pedagogy: { label: "Pédagogie", icon: "book-open-check", color: "#6b42c7", background: "#eee7ff" },
    security: { label: "Sécurité et contrôle", icon: "shield-check", color: "#087a55", background: "#dff8ee" },
    finance: { label: "Finances", icon: "wallet-cards", color: "#9b6700", background: "#fff2cd" },
    accounting: { label: "Comptabilité", icon: "landmark", color: "#c64b45", background: "#ffe7e4" },
    people: { label: "Personnel", icon: "contact-round", color: "#c64b45", background: "#ffe7e4" },
    communication: { label: "Communication", icon: "messages-square", color: "#1264df", background: "#dceaff" },
    care: { label: "Vie et bien-être", icon: "heart-pulse", color: "#c64b45", background: "#ffe7e4" },
    administration: { label: "Administration", icon: "folder-cog", color: "#5c6578", background: "#edf0f5" },
    reports: { label: "Contrôle et rapports", icon: "chart-no-axes-combined", color: "#6b42c7", background: "#eee7ff" }
  };

  function group(label, actions) { return { label: label, actions: actions }; }
  function branch(key, description, groups) { return { key: key, description: description, groups: groups }; }

  var roleCatalog = {
    admin: {
      label: "Administrateur principal", short: "Administrateur", initials: "AP", scope: "Toute l’instance · tous les cycles et services", eyebrow: "Pilotage global",
      welcome: "Pilotez l’établissement depuis un espace unifié.", copy: "Les branches sont organisées par métier; les actions sensibles restent séparées des simples consultations.",
      today: [["Alertes prioritaires","3 à examiner","triangle-alert"],["Validations","7 en attente","badge-check"],["Présence globale","Vue de l’école","users"],["Rapports","Prêts à consulter","file-chart-column"]],
      branches: [
        branch("pilotage","Décider avec une vue consolidée",[group("Vue exécutive",[["Tableau de bord","layout-dashboard"],["Statistiques","chart-no-axes-combined"],["Alertes importantes","triangle-alert"],["Indicateurs","gauge"]])]),
        branch("school","Administrer les élèves et leur parcours",[group("Scolarité",[["Élèves","users"],["Classes","school"],["Parent principal et tuteurs","contact-round"],["Inscriptions et réinscriptions","clipboard-pen-line"]]),group("Organisation",[["Année scolaire","calendar-range"],["Affectations","git-branch"],["Import massif","file-up"],["Documents élèves","files"]])]),
        branch("people","Gérer les équipes et leurs affectations",[group("Équipe",[["Enseignants","graduation-cap"],["Personnel","contact-round"],["Affectations","user-cog"],["Contrats","files"]]),group("Temps et paie",[["Présence du personnel","fingerprint"],["Biométrie","scan-face"],["Salaires","banknote"],["Avances, primes et retenues","hand-coins"]])]),
        branch("pedagogy","Suivre l’apprentissage et les résultats",[group("Organisation pédagogique",[["Matières","book-open"],["Emplois du temps","calendar-range"],["Présences, absences et retards","clipboard-check"],["Devoirs et corrections","notebook-pen"]]),group("Évaluation",[["Évaluations et notes","star"],["Moyennes et coefficients","calculator"],["Bulletins","file-text"],["Palmarès","trophy"]]),group("Accompagnement",[["Rattrapage pédagogique","life-buoy"],["Cahiers de préparation","book-open-check"]]),group("Épreuves certificatives",[["ENAFEP","scroll-text"],["TENASOSP","compass"],["EXETAT","badge-check"]])]),
        branch("security","Superviser les accès et les sorties",[group("Action et contrôle",[["Scanner un QR","scan-line"],["Entrées","log-in"],["Sorties","log-out"],["Préparer une sortie","clock-3"]]),group("Autorisation et suivi",[["Personnes autorisées","contact-round"],["Confirmer ou refuser une sortie","badge-check"],["Alertes et anomalies","siren"],["Historique des passages","history"]])]),
        branch("finance","Contrôler la situation financière",[group("Frais et caisse",[["Structure des frais","settings"],["Encaissements","wallet"],["Reçus PDF","receipt-text"],["Impayés et soldes","badge-alert"]]),group("Trésorerie",[["Recettes et dépenses","arrow-left-right"],["Rapports de caisse","file-chart-column"],["Clôtures","lock-keyhole"],["Exports financiers","file-down"]])]),
        branch("accounting","Tenir et contrôler la comptabilité",[group("Écritures",[["Plan comptable","list-tree"],["Journal comptable","notebook-tabs"],["Grand livre","book-copy"],["Écritures comptables","file-pen-line"]]),group("États",[["Balance","scale"],["Rapprochements","list-checks"],["États financiers","file-chart-column"],["Rapports SYSCOHADA","landmark"]])]),
        branch("communication","Informer la communauté scolaire",[group("Échanges",[["Messages","messages-square"],["Notifications","bell"],["Annonces","megaphone"],["Convocations","mail-plus"]]),group("Publication",[["Site public et WebSync","globe-2"],["Événements","calendar-days"]])]),
        branch("administration","Gouverner et conserver les preuves",[group("Configuration",[["École & Personnel","school","execute"]]),group("Administration",[["Documents R2","files"],["Archives","archive"],["Paramètres","settings"],["Comptes et droits","shield-ellipsis"]]),group("Plateforme",[["Français et anglais","languages"],["Mode hors ligne","cloud-off"],["Séparation public et privé","shield-check"]])]),
        branch("reports","Contrôler l’activité",[group("Traçabilité",[["Historiques","history"],["Audit des actions","list-checks"],["Rapports administratifs","file-chart-column"],["Exports PDF et Excel","file-down"]])])
      ]
    },
    guard: {
      label: "Agent de contrôle d’accès", short: "Contrôle d’accès", initials: "GA", scope: "Portail principal · sécurité uniquement", eyebrow: "Sécurité du portail",
      welcome: "Contrôlez les entrées et les sorties sans distraction.", copy: "Les actions immédiates sont prioritaires; les contrôles, la surveillance et l’historique suivent le déroulement réel du poste.",
      today: [["Élèves présents","286 actuellement","users"],["Sorties en attente","4 à contrôler","clock-3"],["Anomalies","1 à examiner","triangle-alert"],["Portail","Principal · actif","door-open"]],
      branches: [branch("security","Portail principal",[
        group("Action immédiate",[["Scanner un QR","scan-line"],["Enregistrer une entrée","log-in"],["Enregistrer une sortie","log-out"]]),
        group("Contrôle",[["Personnes autorisées","contact-round"],["Vérifier l’identité","badge-check"],["Autoriser une sortie","circle-check-big"],["Refuser une sortie","circle-x"]]),
        group("Surveillance",[["Élèves dans l’école","users"],["Sorties en attente","clock-3"],["Alertes et anomalies","siren"]]),
        group("Historique",[["Passages précédents","history"],["Incidents","shield-alert"],["Rechercher","search"]])
      ])]
    },
    teacher: {
      label: "Enseignant", short: "Enseignant", initials: "EN", scope: "Classes affectées · matières autorisées", eyebrow: "Ma journée pédagogique",
      welcome: "Retrouvez immédiatement vos classes et vos priorités.", copy: "SchoolSafe utilise les affectations pour limiter l’espace aux classes, matières et élèves confiés à l’enseignant.",
      today: [["Présence à effectuer","1 classe","clipboard-check"],["Cours prévus","4 aujourd’hui","calendar-clock"],["Devoirs à corriger","18 remises","notebook-tabs"],["Notifications","2 importantes","bell-ring"]],
      branches: [
        branch("pedagogy","Classes et apprentissage",[group("Mes classes",[["1re A","users-round"],["2e B","users-round"],["Emploi du temps","calendar-range"]]),group("Travail pédagogique",[["Présences, absences et retards","clipboard-check"],["Devoirs et corrections","notebook-pen"],["Évaluations et notes","star"],["Cahier de préparation de l’enseignant","book-open-check"]]),group("Suivi des élèves",[["Résultats et moyennes","chart-no-axes-combined"],["Difficultés","triangle-alert"],["Rattrapage pédagogique","life-buoy"],["Bulletins à consulter","file-text"],["Préparation aux épreuves certificatives","scroll-text"]])]),
        branch("communication","Échanges autorisés",[group("Communication",[["Direction","school"],["Parents autorisés","contact-round"],["Notifications","bell"]])])
      ]
    },
    cashier: {
      label: "Agent de caisse", short: "Caisse", initials: "CA", scope: "Point de caisse affecté · opérations d’encaissement", eyebrow: "Opérations du jour",
      welcome: "Encaissez vite et conservez une trace claire.", copy: "L’agent de caisse produit les opérations et les reçus, sans accès aux paramètres financiers généraux.",
      today: [["Encaissements","12 aujourd’hui","wallet"],["Reçus","12 émis","receipt-text"],["À vérifier","2 soldes","search-check"],["Caisse","Ouverte","badge-check"]],
      branches: [branch("finance","Encaissements et reçus",[group("Action immédiate",[["Enregistrer un paiement","circle-plus"],["Versement de rattrapage","hand-coins"],["Rechercher un élève","search"],["Produire un reçu PDF","receipt-text"]]),group("Contrôle",[["Vérifier un paiement","badge-check"],["Consulter le solde et les impayés","wallet-cards"],["Historique du jour","history"],["Demander l’annulation d’un paiement","circle-x"]]),group("Clôture",[["Rapport de caisse","file-chart-column"],["Soumettre la journée","send"]])])]
    },
    school_head: {
      label: "Chef d’établissement", short: "Direction", initials: "CE", scope: "Toute l’école · consultation et approbations", eyebrow: "Direction de l’établissement",
      welcome: "Décidez avec une vue claire de l’école.", copy: "La Direction consulte les domaines stratégiques et approuve les opérations autorisées sans exécuter les tâches de caisse ou de contrôle.",
      today: [["Approbations","7 en attente","badge-check"],["Présence","94 % aujourd’hui","users"],["Alertes","3 prioritaires","triangle-alert"],["Rapports","4 disponibles","file-chart-column"]],
      branches: [branch("pilotage","Vue stratégique",[group("Décision",[["Tableau de bord","layout-dashboard"],["Indicateurs","gauge"],["Alertes","triangle-alert"],["Approbations","badge-check"]])]),branch("school","Suivi administratif",[group("École",[["Élèves et classes","users"],["Inscriptions","clipboard-pen-line"],["Personnel","contact-round"]])]),branch("pedagogy","Suivi scolaire",[group("Résultats",[["Présences","clipboard-check"],["Résultats","chart-no-axes-combined"],["Rattrapage pédagogique","life-buoy"],["Bulletins","file-text"],["Épreuves certificatives","scroll-text"]])]),branch("security","Supervision de la sécurité",[group("Contrôle",[["Entrées et sorties","scan-line"],["Incidents","siren"]])]),branch("finance","Consultation financière",[group("Lecture seule",[["Recettes","wallet"],["Statistiques","chart-pie"],["Imprimer les rapports","printer"]])]),branch("reports","Rapports et audit",[group("Contrôle",[["Rapports","file-chart-column"],["Audit","list-checks"]])])]
    },
    pedagogy: {
      label: "Responsable pédagogique", short: "Pédagogie", initials: "RP", scope: "Cycles et classes affectés", eyebrow: "Pilotage pédagogique",
      welcome: "Coordonnez les classes, les enseignants et les résultats.", copy: "Le périmètre pédagogique dépend des cycles attribués par l’Administrateur principal.",
      today: [["Présences","6 classes à suivre","clipboard-check"],["Évaluations","3 à valider","file-check-2"],["Rattrapage","14 élèves","life-buoy"],["Enseignants","2 suivis requis","graduation-cap"]],
      branches: [branch("pedagogy","Organisation et résultats",[group("Organisation",[["Classes","school"],["Matières","book-open"],["Emplois du temps","calendar-range"],["Affectations","git-branch"]]),group("Présence et travail",[["Présences élèves","clipboard-check"],["Absences et retards","calendar-x"],["Devoirs et corrections","notebook-pen"],["Cahiers de préparation des enseignants","book-open-check"]]),group("Évaluation",[["Évaluations et notes","star"],["Moyennes et coefficients","calculator"],["Bulletins","file-text"],["Palmarès","trophy"]]),group("Accompagnement",[["Rattrapage pédagogique","life-buoy"],["Activité enseignants","activity"]]),group("Épreuves certificatives",[["ENAFEP","scroll-text"],["TENASOSP","compass"],["EXETAT","badge-check"]])]),branch("finance","Statut administratif utile au suivi scolaire · aucun montant visible",[group("Régularité scolaire",[["Voir les élèves en ordre ou à régulariser","badge-check","status"]])]),branch("reports","Suivi scolaire",[group("Rapports",[["Statistiques pédagogiques","chart-no-axes-combined"],["Résultats des épreuves certificatives","file-chart-column"]])])]
    },
    admissions: {
      label: "Responsable administratif et admissions", short: "Admissions", initials: "RA", scope: "Admissions et dossiers élèves", eyebrow: "Admissions scolaires",
      welcome: "Traitez les demandes et constituez des dossiers complets.", copy: "L’espace suit le parcours d’une demande jusqu’à l’inscription confirmée.",
      today: [["Préinscriptions","9 nouvelles","clipboard-pen-line"],["À vérifier","5 dossiers","search-check"],["Inscriptions","3 à confirmer","badge-check"],["Doublons","1 alerte","copy-x"]],
      branches: [branch("school","Admissions et élèves",[group("Demandes",[["Préinscriptions","clipboard-pen-line"],["Vérifier les dossiers","search-check"],["Accepter ou refuser","badge-check"]]),group("Inscription",[["Créer l’élève","user-plus"],["Parents et tuteurs","contact-round"],["Personnes autorisées","user-round-check"],["Importer des dossiers","file-up"]])]),branch("administration","Documents d’admission",[group("Documents",[["Attestations","files"],["Archives","archive"],["Rechercher","search"]])])]
    },
    secretary: {
      label: "Secrétaire scolaire", short: "Secrétariat", initials: "SS", scope: "Documents et communication administrative", eyebrow: "Secrétariat",
      welcome: "Préparez les documents et coordonnez les demandes.", copy: "Les actes sensibles restent soumis à l’approbation de la Direction.",
      today: [["Documents","6 à produire","files"],["Rendez-vous","3 aujourd’hui","calendar-clock"],["Convocations","2 à envoyer","send"],["Archives","4 à classer","archive"]],
      branches: [branch("administration","Documents scolaires",[group("Production",[["Attestations","file-badge"],["Certificats","files"],["Convocations","mail-plus"],["Archives","archive"]]),group("Dossiers nationaux",[["Dossiers ENAFEP, TENASOSP et EXETAT","scroll-text"],["Contrôle des identités candidats","search-check"]])]),branch("communication","Accueil et échanges",[group("Communication",[["Messages","messages-square"],["Rendez-vous","calendar-clock"],["Annonces","megaphone"]])])]
    },
    finance: {
      label: "Responsable financier", short: "Finance", initials: "RF", scope: "Tous les modules financiers", eyebrow: "Supervision financière",
      welcome: "Supervisez les recettes, dépenses et contrôles.", copy: "Ce profil paramètre les frais et contrôle la caisse; les encaissements quotidiens restent attribués aux agents de caisse.",
      today: [["Recettes","À consolider","wallet"],["Dépenses","3 à approuver","receipt"],["Impayés","À suivre","badge-alert"],["Caisses","2 ouvertes","landmark"]],
      branches: [branch("finance","Gestion financière",[group("Supervision",[["Tableau financier","chart-pie"],["Contrôle des frais","badge-check"],["Impayés et soldes","badge-alert"],["Rapports financiers","file-chart-column"],["Versement de rattrapage","hand-coins"]]),group("Paramétrage",[["Types de frais","settings"],["Échéances","calendar-range"],["Caisses","landmark"]]),group("Trésorerie",[["Recettes et dépenses","arrow-left-right"],["Clôtures","lock-keyhole"],["Exports","file-down"]])]),branch("accounting","Supervision comptable",[group("Contrôle comptable",[["Journal comptable","notebook-tabs"],["Grand livre","book-copy"],["Balance","scale"],["Rapprochements","list-checks"]]),group("États",[["États financiers","file-chart-column"],["Rapports SYSCOHADA","landmark"]])])]
    },
    accountant: {
      label: "Comptable", short: "Comptabilité", initials: "CO", scope: "Comptabilité et rapports financiers", eyebrow: "Comptabilité",
      welcome: "Tenez les écritures et préparez les états.", copy: "L’accès est centré sur les journaux et les états, sans opérations de guichet.",
      today: [["Écritures","8 à classer","notebook-tabs"],["Rapprochement","À effectuer","list-checks"],["Dépenses","3 pièces","receipt"],["États","Mois en cours","file-chart-column"]],
      branches: [branch("accounting","Comptabilité",[group("Référentiel",[["Plan comptable","list-tree"],["Pièces comptables","files"]]),group("Écritures",[["Journal comptable","notebook-tabs"],["Grand livre","book-copy"],["Écritures comptables","file-pen-line"],["Rapprochement","list-checks"]]),group("États",[["Balance","scale"],["Compte de résultat","chart-no-axes-combined"],["Bilan","landmark"],["Rapports SYSCOHADA","file-chart-column"],["Exports PDF et Excel","file-down"]])])]
    },
    hr: {
      label: "Responsable RH", short: "Ressources humaines", initials: "RH", scope: "Personnel et paie", eyebrow: "Ressources humaines",
      welcome: "Suivez le personnel, les présences et la paie.", copy: "Les informations RH restent séparées des dossiers pédagogiques et financiers des familles.",
      today: [["Présences","2 anomalies","fingerprint"],["Absences","3 demandes","calendar-x"],["Paie","Préparation en cours","banknote"],["Contrats","2 échéances","files"]],
      branches: [branch("people","Gestion du personnel",[group("Dossiers",[["Personnel","contact-round"],["Contrats","files"],["Affectations","user-cog"],["Absences","calendar-x"]]),group("Temps",[["Présence personnel","fingerprint"],["Biométrie","scan-face"]]),group("Rémunération",[["Salaires","banknote"],["Primes","badge-dollar-sign"],["Avances","hand-coins"],["Retenues","circle-minus"]])])]
    },
    nurse: {
      label: "Infirmier", short: "Infirmerie", initials: "IN", scope: "Dossiers santé et incidents médicaux", eyebrow: "Santé scolaire",
      welcome: "Assurez le suivi médical utile à la journée scolaire.", copy: "Seules les informations de santé nécessaires et autorisées apparaissent dans cet espace.",
      today: [["Passages","5 aujourd’hui","heart-pulse"],["Allergies","2 vigilances","triangle-alert"],["Traitements","1 prévu","pill"],["Urgences","Aucune","siren"]],
      branches: [branch("care","Santé et urgences",[group("Action immédiate",[["Enregistrer un passage","clipboard-plus"],["Incident médical","siren"],["Contacter le parent","phone-call"]]),group("Suivi",[["Dossiers santé","heart-pulse"],["Allergies","triangle-alert"],["Traitements autorisés","pill"],["Historique","history"]])])]
    },
    canteen: {
      label: "Responsable cantine", short: "Cantine", initials: "RC", scope: "Service cantine", eyebrow: "Cantine scolaire",
      welcome: "Organisez les repas et les présences au service.", copy: "L’espace cantine ne donne aucun accès aux notes, à la paie ou à la caisse scolaire.",
      today: [["Repas prévus","318","utensils"],["Présences","À confirmer","clipboard-check"],["Allergies","6 signalées","triangle-alert"],["Menus","Semaine active","notebook-tabs"]],
      branches: [branch("care","Service de cantine",[group("Aujourd’hui",[["Présences repas","clipboard-check"],["Service des repas","utensils"],["Allergies","triangle-alert"]]),group("Organisation",[["Menus","notebook-tabs"],["Bénéficiaires","users"],["Historique","history"]])])]
    },
    communication: {
      label: "Responsable communication et site", short: "Communication", initials: "CM", scope: "Communication et site public", eyebrow: "Communication scolaire",
      welcome: "Informez clairement la communauté scolaire.", copy: "Les publications et messages suivent les circuits d’approbation définis par la Direction.",
      today: [["Messages","7 non lus","messages-square"],["Annonces","2 brouillons","megaphone"],["Notifications","1 urgente","bell-ring"],["Site public","À synchroniser","globe-2"]],
      branches: [branch("communication","Messages et publications",[group("Échanges",[["Messages","messages-square"],["Annonces","megaphone"],["Notifications","bell"],["Convocations","mail-plus"]]),group("Publication",[["Site public","globe-2"],["Galerie","images"],["Événements","calendar-days"],["Synchronisation","refresh-cw"]])])]
    },
    parent: {
      label: "Parent ou responsable légal", short: "Parent", initials: "PR", scope: "Enfants explicitement rattachés", eyebrow: "Suivi de mes enfants",
      welcome: "Suivez l’essentiel de la journée de vos enfants.", copy: "Le parent ne voit que les enfants et documents qui lui sont explicitement rattachés.",
      today: [["Présence","Enfant arrivé","badge-check"],["Sortie","16 h 15 prévue","clock-3"],["Devoirs","2 à consulter","notebook-pen"],["Notifications","1 nouvelle","bell-ring"]],
      branches: [branch("school","Mes enfants",[group("Suivi quotidien",[["Présence et passages","history"],["Emploi du temps","calendar-range"],["Devoirs","notebook-pen"],["Résultats","chart-no-axes-combined"],["Rattrapage pédagogique","life-buoy"],["Épreuves certificatives","scroll-text"]]),group("Démarches",[["Justifier une absence","file-pen-line"],["Personnes autorisées","user-round-check"],["Documents","files"]])]),branch("finance","Situation familiale",[group("Paiements",[["Frais scolaires","wallet-cards"],["Reçus","receipt-text"],["Échéances","calendar-clock"]])]),branch("communication","Échanges avec l’école",[group("Communication",[["Messages","messages-square"],["Convocations","mail-plus"],["Notifications","bell"]])])]
    }
  };

  var profileIndicators = {
    admin: [["Total élèves","1 245","users"],["Filles","648","user-round"],["Garçons","597","user-round"],["Personnel total","72","contact-round"],["Femmes personnel","39","user-round"],["Hommes personnel","33","user-round"],["Enseignants","48","graduation-cap"],["Classes actives","38","school"],["Cycles ouverts","3","layers-3"],["Présence globale","94 %","chart-no-axes-combined"]],
    school_head: [["Total élèves","1 245","users"],["Filles","648","user-round"],["Garçons","597","user-round"],["Personnel total","72","contact-round"],["Femmes personnel","39","user-round"],["Hommes personnel","33","user-round"],["Enseignants","48","graduation-cap"],["Classes actives","38","school"],["Alertes prioritaires","3","triangle-alert"],["Présence globale","94 %","chart-no-axes-combined"]],
    pedagogy: [["Élèves suivis","1 245","users"],["Filles","648","user-round"],["Garçons","597","user-round"],["Classes suivies","38","school"],["Enseignants","48","graduation-cap"],["Enseignantes","26","user-round"],["Enseignants hommes","22","user-round"],["Évaluations à valider","3","file-check-2"],["Cahiers à contrôler","12","book-open-check"],["Moyenne générale","67 %","chart-no-axes-combined"]],
    admissions: [["Élèves inscrits","1 245","users"],["Filles","648","user-round"],["Garçons","597","user-round"],["Maternelle","186","shapes"],["Primaire","612","book-open"],["Secondaire","447","graduation-cap"],["Dossiers ouverts","32","folder-open"],["Dossiers incomplets","5","file-warning"],["Places disponibles","84","armchair"],["Admissions du mois","27","clipboard-pen-line"]],
    secretary: [["Total élèves","1 245","users"],["Filles","648","user-round"],["Garçons","597","user-round"],["Personnel total","72","contact-round"],["Femmes personnel","39","user-round"],["Hommes personnel","33","user-round"],["Documents du mois","186","files"],["Demandes ouvertes","12","inbox"],["Rendez-vous","8","calendar-clock"],["Archives à classer","4","archive"]],
    finance: [["Élèves facturés","1 208","users"],["En ordre","1 082","badge-check"],["À régulariser","126","badge-alert"],["Taux recouvrement","82 %","chart-pie"],["Frais actifs","14","wallet-cards"],["Échéances ouvertes","3","calendar-range"],["Caisses ouvertes","2","landmark"],["Dépenses à valider","3","receipt"],["Rapports prêts","4","file-chart-column"],["Clôture période","En cours","lock-keyhole"]],
    cashier: [["Caisse affectée","Principale","landmark"],["Solde initial","2,4 M FC","wallet"],["Paiements du jour","12","receipt-text"],["Reçus émis","12","file-check-2"],["Espèces","8 opérations","banknote"],["Autres moyens","4 opérations","credit-card"],["Élèves recherchés","18","search"],["À régulariser","2","badge-alert"],["Annulations demandées","1","circle-x"],["Clôture prévue","17 h 00","clock-3"]],
    accountant: [["Journaux actifs","4","notebook-tabs"],["Écritures du mois","286","file-pen-line"],["Pièces à classer","8","files"],["Pièces manquantes","2","file-warning"],["Rapprochements","2","list-checks"],["Comptes mouvementés","47","list-tree"],["Dépenses comptabilisées","38","receipt"],["Période active","Août 2026","calendar-range"],["Balance","Provisoire","scale"],["États à produire","3","file-chart-column"]],
    hr: [["Personnel total","72","contact-round"],["Femmes","39","user-round"],["Hommes","33","user-round"],["Enseignants","48","graduation-cap"],["Personnel administratif","16","briefcase-business"],["Personnel de service","8","users"],["Contrats actifs","70","files"],["Absences du jour","3","calendar-x"],["Présence personnel","96 %","fingerprint"],["Paies à préparer","72","banknote"]],
    teacher: [["Classes affectées","2","school"],["Matières enseignées","3","book-open"],["Total élèves","58","users"],["Filles","31","user-round"],["Garçons","27","user-round"],["Cours aujourd’hui","4","calendar-clock"],["Présence moyenne","94 %","clipboard-check"],["Devoirs à corriger","18","notebook-tabs"],["Moyenne des classes","13,8 / 20","chart-no-axes-combined"],["Élèves à accompagner","7","life-buoy"]],
    guard: [["Portail affecté","Principal","door-open"],["Élèves dans l’école","286","users"],["Filles présentes","149","user-round"],["Garçons présents","137","user-round"],["Entrées élèves","291","log-in"],["Sorties confirmées","5","log-out"],["Sorties en attente","4","clock-3"],["Personnes autorisées","312","contact-round"],["Personnel présent","61","badge-check"],["Anomalies actives","1","triangle-alert"]],
    nurse: [["Élèves suivis","1 245","users"],["Filles","648","user-round"],["Garçons","597","user-round"],["Dossiers santé","1 102","heart-pulse"],["Dossiers incomplets","143","file-warning"],["Allergies signalées","24","triangle-alert"],["Traitements autorisés","18","pill"],["Passages du jour","5","clipboard-plus"],["Parents à contacter","1","phone-call"],["Urgences actives","0","siren"]],
    canteen: [["Bénéficiaires","318","users"],["Filles","164","user-round"],["Garçons","154","user-round"],["Maternelle","64","shapes"],["Primaire","172","book-open"],["Secondaire","82","graduation-cap"],["Repas prévus","318","utensils"],["Présences confirmées","286","clipboard-check"],["Allergies signalées","6","triangle-alert"],["Service prévu","12 h 30","clock-3"]],
    communication: [["Communauté totale","1 389","users"],["Élèves","1 245","school"],["Filles","648","user-round"],["Garçons","597","user-round"],["Parents actifs","1 112","contact-round"],["Personnel actif","72","briefcase-business"],["Annonces publiées","24","megaphone"],["Brouillons à valider","2","file-pen-line"],["Messages non lus","7","messages-square"],["Langues actives","FR / EN","languages"]],
    parent: [["Enfants rattachés","2","users"],["Filles","1","user-round"],["Garçons","1","user-round"],["Enfants présents","2","badge-check"],["Devoirs ouverts","3","notebook-pen"],["Résultats publiés","2","chart-no-axes-combined"],["Documents disponibles","6","files"],["Notifications non lues","1","bell-ring"],["Statut scolaire","À consulter","wallet-cards"],["Prochaine sortie","16 h 15","clock-3"]]
  };

  var currentDemoRole = "admin";
  var staffSamples = [
    { name: "M. X", initials: "MX", role: "guard", scopeType: "portal", scope: "Portail principal" },
    { name: "Mme Y", initials: "MY", role: "teacher", scopeType: "class", scope: "Classe 4e A" },
    { name: "M. Z", initials: "MZ", role: "pedagogy", scopeType: "cycle", scope: "Cycle primaire", permissions: { "pedagogy::Cahiers de préparation des enseignants": false }, actionLevels: {}, dataViews: { "finance::Voir les élèves en ordre ou à régulariser": "status" } },
    { name: "Mme K", initials: "MK", role: "cashier", scopeType: "service", scope: "Caisse principale" },
    { name: "M. P", initials: "MP", role: "school_head", scopeType: "instance", scope: "Toute l’instance" }
  ];
  var selectedStaffIndex = 0;
  var pedagogyState = {
    activeTab: "assignments",
    selectedAssignment: 0,
    selectedParentChild: 0,
    assignmentDraftMeta: { title: "", className: "1re A", subject: "Mathématiques", language: "FR", type: "Devoir", teacher: "Mme Y", scale: 10, due: "À planifier", prerequisites: "", instructions: "" },
    assignmentDraftQuestions: [
      { text: "Calcule et simplifie les fractions suivantes.", type: "Calcul", points: 4, answerSpace: "Demi-page", choices: "" },
      { text: "Explique la méthode utilisée avec tes propres mots.", type: "Réponse longue", points: 6, answerSpace: "8 lignes", choices: "" }
    ],
    periods: { type: "Trimestres", count: 3, precision: 2, passMark: 50 },
    periodStatuses: [true, false, false],
    weights: { homework: 20, quiz: 30, exam: 50 },
    annualWeights: [1, 1, 1],
    languages: [{ code: "FR", label: "Français", weight: 50 }, { code: "EN", label: "Anglais", weight: 50 }],
    conduct: { teacher: 40, discipline: 60 },
    assignments: [
      { title: "Fractions équivalentes", subject: "Mathématiques", language: "FR", className: "1re A", type: "Devoir", due: "18 août 2026", format: "PDF SchoolSafe", scale: 10, published: true, teacher: "Mme Y", prerequisites: "Fractions simples et tables de multiplication.", instructions: "Résoudre les exercices et présenter les étapes de calcul.", questions: [{ text: "Calcule et simplifie : 2/4, 3/6 et 4/8.", type: "Calcul", points: 4, answerSpace: "Demi-page", choices: "" }, { text: "Explique pourquoi ces fractions sont équivalentes.", type: "Réponse longue", points: 6, answerSpace: "8 lignes", choices: "" }], version: 1, grades: [8, 6.5, null, 9] },
      { title: "Reading comprehension", subject: "Mathematics", language: "EN", className: "1re A", type: "Interrogation", due: "20 août 2026", format: "Texte", scale: 10, published: true, teacher: "Mme Y", prerequisites: "Basic reading vocabulary.", instructions: "Read the instructions and answer in complete sentences.", questions: [], version: 1, grades: [7.5, 8, 6, null] },
      { title: "Reconnaître les formes", subject: "Éveil", language: "FR", className: "Maternelle 3", type: "Activité compensatoire", due: "21 août 2026", format: "Images", scale: 0, published: false, teacher: "Mme Y", prerequisites: "Reconnaître les couleurs.", instructions: "Associer chaque forme à l’illustration correspondante.", questions: [], version: 1, grades: ["Acquis", "En acquisition", "Bien", "Très bien"] }
    ],
    students: [
      { name: "Lucas Martin", initials: "LM", paid: true },
      { name: "Sophie Durand", initials: "SD", paid: true },
      { name: "Ethan Leroy", initials: "EL", paid: false },
      { name: "Chloé Bernard", initials: "CB", paid: true }
    ],
    parentChildren: [
      { name: "Lucas Martin", initials: "LM", className: "1re A", paid: true, average: "14,00 / 20", rank: "5e / 32" },
      { name: "Emma Martin", initials: "EM", className: "Maternelle 3", paid: false, average: "Masquée", rank: "Masqué" }
    ],
    remediation: {
      activeView: "cases",
      selectedCase: 0,
      cases: [
        { student: "Ethan Leroy", initials: "EL", className: "1re A", cycle: "Primaire", month: "Août 2026", subjects: ["Mathématiques FR · 42 %", "Mathematics EN · 46 %"], average: 44, status: "Entretien requis", parentStatus: "Convocation envoyée", teacher: "Non affecté", price: 120000, paid: 0, start: "À confirmer", end: "À confirmer", sessions: [], progress: 44, monthsWithoutProgress: 1, report: "", validated: false, cancelled: false },
        { student: "Sophie Durand", initials: "SD", className: "2e B", cycle: "Secondaire", month: "Août 2026", subjects: ["Sciences FR · 47 %", "English EN · 48 %"], average: 47.5, status: "Suivi en cours", parentStatus: "Entretien effectué", teacher: "Mme Y", price: 150000, paid: 90000, start: "5 août 2026", end: "4 septembre 2026", sessions: [{ date: "7 août", subject: "Sciences FR", present: true }, { date: "10 août", subject: "English EN", present: false }], progress: 55, monthsWithoutProgress: 2, report: "Progrès en lecture des consignes. Renforcer les exercices scientifiques.", validated: false, cancelled: false },
        { student: "Lucas Martin", initials: "LM", className: "1re A", cycle: "Primaire", month: "Juillet 2026", subjects: ["Mathématiques FR · 45 %"], average: 45, status: "Bilan à valider", parentStatus: "Programme terminé", teacher: "Mme Y", price: 100000, paid: 100000, start: "1 juillet 2026", end: "31 juillet 2026", sessions: [{ date: "5 juillet", subject: "Mathématiques FR", present: true }, { date: "12 juillet", subject: "Mathématiques FR", present: true }, { date: "19 juillet", subject: "Mathématiques FR", present: true }], progress: 63, monthsWithoutProgress: 1, report: "Objectifs atteints. Les résultats restent séparés du bulletin officiel.", validated: false, cancelled: false },
        { student: "Noah Diallo", initials: "ND", className: "2e B", cycle: "Secondaire", month: "Août 2026", subjects: ["Mathématiques FR · 38 %", "Mathematics EN · 41 %"], average: 39.5, status: "Alerte renforcée", parentStatus: "Nouvelle convocation requise", teacher: "Mme Y", price: 120000, paid: 60000, start: "2 août 2026", end: "1 septembre 2026", sessions: [{ date: "6 août", subject: "Mathématiques FR", present: true }], progress: 41, monthsWithoutProgress: 6, report: "Sixième mois sans amélioration suffisante.", validated: false, cancelled: false }
      ]
    },
    certifications: {
      activeExam: "ENAFEP",
      activeView: "candidates",
      selectedCandidate: 0,
      filters: { className: "Toutes", center: "Tous", decision: "Tous", option: "Toutes" },
      exams: {
        ENAFEP: {
          label: "ENAFEP",
          fullName: "Examen national de fin d’études primaires",
          cycle: "6e primaire",
          session: "Session 2027",
          dates: "Calendrier national à confirmer",
          candidates: [
            { name: "Lucas Martin", initials: "LM", sex: "Garçon", className: "6e A", number: "EN-00124", center: "Centre 01 · Commune scolaire", dossier: "Complet", preparation: 78, attendance: "Présent", percentage: 76.5, decision: "Réussi", published: true },
            { name: "Sophie Durand", initials: "SD", sex: "Fille", className: "6e A", number: "EN-00125", center: "Centre 01 · Commune scolaire", dossier: "À vérifier", preparation: 68, attendance: "Présent", percentage: 64, decision: "Réussi", published: true },
            { name: "Ethan Leroy", initials: "EL", sex: "Garçon", className: "6e B", number: "À attribuer", center: "À affecter", dossier: "Incomplet", preparation: 46, attendance: "À venir", percentage: null, decision: "En attente", published: false },
            { name: "Chloé Bernard", initials: "CB", sex: "Fille", className: "6e B", number: "EN-00127", center: "Centre 02 · Quartier Nord", dossier: "Complet", preparation: 84, attendance: "Présent", percentage: 81, decision: "Réussi", published: true }
          ]
        },
        TENASOSP: {
          label: "TENASOSP",
          fullName: "Test national de sélection et d’orientation scolaire et professionnelle",
          cycle: "8e du Cycle terminal de l’éducation de base",
          session: "Session 2027",
          dates: "Calendrier national à confirmer",
          candidates: [
            { name: "Noah Diallo", initials: "ND", sex: "Garçon", className: "8e A", number: "TS-00318", center: "Centre 03 · École pilote", dossier: "Complet", preparation: 72, attendance: "À venir", percentage: null, decision: "En attente", published: false },
            { name: "Emma Martin", initials: "EM", sex: "Fille", className: "8e A", number: "TS-00319", center: "Centre 03 · École pilote", dossier: "À vérifier", preparation: 67, attendance: "À venir", percentage: null, decision: "En attente", published: false },
            { name: "Jean Kabeya", initials: "JK", sex: "Garçon", className: "8e B", number: "À attribuer", center: "À affecter", dossier: "Incomplet", preparation: 51, attendance: "À venir", percentage: null, decision: "En attente", published: false }
          ]
        },
        EXETAT: {
          label: "EXETAT",
          fullName: "Examen d’État",
          cycle: "Fin des humanités générales, techniques et professionnelles",
          session: "Session de démonstration 2026",
          dates: "Hors-session du 4 au 19 mai · Session ordinaire du 22 au 25 juin 2026",
          parentCandidateName: "Aline Martin",
          teacherClasses: ["4e Humanités A"],
          preparationAreas: ["Dissertation", "Cours d’option", "Culture générale"],
          phases: [
            { label: "Dossiers et identification", scope: "École", date: "Avant la hors-session", status: "Terminé", detail: "Identité, option, numéro, jury et statut de participation contrôlés localement." },
            { label: "Dissertation", scope: "Hors-session", date: "4 mai 2026", status: "Terminé", detail: "Première épreuve de la hors-session pour le cycle long." },
            { label: "Épreuves techniques", scope: "Hors-session", date: "5 mai 2026", status: "Terminé", detail: "Épreuves organisées selon les options techniques concernées." },
            { label: "Oraux de français et d’anglais", scope: "Hors-session", date: "6 au 9 mai 2026", status: "Terminé", detail: "Présences et incidents suivis sans saisir les résultats nationaux." },
            { label: "Pratique professionnelle", scope: "Hors-session", date: "11 au 18 mai 2026", status: "Terminé", detail: "Étape applicable aux options professionnelles et techniques." },
            { label: "Transmission des copies techniques", scope: "Administration", date: "19 mai 2026", status: "Terminé", detail: "SchoolSafe conserve uniquement la preuve locale de remise." },
            { label: "Session ordinaire", scope: "Épreuve nationale", date: "22 au 25 juin 2026", status: "Terminé", detail: "Suivi des présences, centres, jurys et incidents déclarés par l’école." },
            { label: "Scannage et traitement", scope: "Services officiels", date: "Après les épreuves", status: "Terminé", detail: "Traitement réalisé hors SchoolSafe par les services compétents." },
            { label: "Publication officielle", scope: "Services officiels", date: "Achevée le 12 juillet 2026", status: "Publié", detail: "SchoolSafe peut enregistrer la source et présenter le résultat vérifié, jamais le fabriquer." }
          ],
          candidates: [
            { name: "Aline Martin", initials: "AM", sex: "Fille", className: "4e Humanités A", option: "Sciences", cycleType: "Cycle long", number: "EX-2026-0418", center: "Jury 12 · Kinshasa", jury: "Jury 12", dossier: "Complet", participationStatus: "En ordre", preparation: 82, attendance: "Présente", percentage: 74, decision: "Réussi", published: true },
            { name: "David Kasongo", initials: "DK", sex: "Garçon", className: "4e Humanités A", option: "Pédagogie générale", cycleType: "Cycle long", number: "EX-2026-0419", center: "Jury 12 · Kinshasa", jury: "Jury 12", dossier: "Complet", participationStatus: "En ordre", preparation: 69, attendance: "Présent", percentage: 48.5, decision: "Échoué", published: true },
            { name: "Mireille Lukusa", initials: "ML", sex: "Fille", className: "4e Humanités B", option: "Commerciale et gestion", cycleType: "Cycle long", number: "EX-2026-0432", center: "Jury 14 · Kinshasa", jury: "Jury 14", dossier: "À vérifier", participationStatus: "À vérifier", preparation: 71, attendance: "Présente", percentage: 63, decision: "Réussi", published: true },
            { name: "Patrick Mbala", initials: "PM", sex: "Garçon", className: "4e Humanités B", option: "Électricité", cycleType: "Cycle long", number: "À attribuer", center: "À affecter", jury: "À affecter", dossier: "Incomplet", participationStatus: "À régulariser", preparation: 58, attendance: "À confirmer", percentage: null, decision: "En attente", published: false }
          ]
        }
      }
    }
  };

  var financeState = {
    activeTab: "overview",
    selectedStudent: 0,
    selectedFamilyStudent: 0,
    receiptSequence: 587,
    dayStatus: "Ouverte",
    loaded: false,
    loading: false,
    feeTypes: [
      { id: "demo-1", name: "Frais scolaires", cycle: "Primaire", amount: 300000, frequency: "Trimestre", due: "30 septembre 2026", active: true },
      { id: "demo-2", name: "Frais scolaires", cycle: "Humanités", amount: 450000, frequency: "Trimestre", due: "30 septembre 2026", active: true },
      { id: "demo-3", name: "Inscription", cycle: "Tous les cycles", amount: 50000, frequency: "Une fois", due: "À l’inscription", active: true },
      { id: "demo-4", name: "Transport scolaire", cycle: "Service facultatif", amount: 100000, frequency: "Mois", due: "Chaque 5 du mois", active: true }
    ],
    studentFeeMap: {},
    students: [
      { id: "demo-s1", name: "Lucas Martin", initials: "LM", sex: "Garçon", className: "6e A", guardian: "Mme Sophie Martin", expected: 450000, paid: 350000, balance: 100000, status: "À régulariser" },
      { id: "demo-s2", name: "Emma Martin", initials: "EM", sex: "Fille", className: "Maternelle 3", guardian: "Mme Sophie Martin", expected: 300000, paid: 300000, balance: 0, status: "En ordre" },
      { id: "demo-s3", name: "Ethan Leroy", initials: "EL", sex: "Garçon", className: "1re A", guardian: "M. Paul Leroy", expected: 450000, paid: 150000, balance: 300000, status: "À régulariser" },
      { id: "demo-s4", name: "Chloé Bernard", initials: "CB", sex: "Fille", className: "2e B", guardian: "Mme Julie Bernard", expected: 450000, paid: 450000, balance: 0, status: "En ordre" },
      { id: "demo-s5", name: "Aline Martin", initials: "AM", sex: "Fille", className: "4e Humanités A", guardian: "Mme Sophie Martin", expected: 600000, paid: 600000, balance: 0, status: "En ordre" }
    ],
    transactions: [
      { receipt: "REC-2026-0587", date: "14 août 2026 · 10:20", day: "14 août 2026", student: "Ethan Leroy", className: "1re A", fee: "Frais scolaires", amount: 150000, mode: "Espèces", cashier: "Mme K", reference: "Première tranche", status: "Validé" },
      { receipt: "REC-2026-0586", date: "14 août 2026 · 09:15", day: "14 août 2026", student: "Lucas Martin", className: "6e A", fee: "Frais scolaires", amount: 150000, mode: "Espèces", cashier: "Mme K", reference: "Deuxième tranche", status: "Validé" },
      { receipt: "REC-2026-0585", date: "13 août 2026 · 14:40", day: "13 août 2026", student: "Emma Martin", className: "Maternelle 3", fee: "Frais scolaires", amount: 300000, mode: "Virement constaté", cashier: "Mme K", reference: "Paiement complet", status: "Validé" },
      { receipt: "REC-2026-0584", date: "12 août 2026 · 11:05", day: "12 août 2026", student: "Lucas Martin", className: "6e A", fee: "Frais scolaires", amount: 200000, mode: "Espèces", cashier: "Mme K", reference: "Première tranche", status: "Validé" },
      { receipt: "REC-2026-0583", date: "11 août 2026 · 08:55", day: "11 août 2026", student: "Chloé Bernard", className: "2e B", fee: "Frais scolaires", amount: 450000, mode: "Espèces", cashier: "Mme K", reference: "Paiement complet", status: "Validé" },
      { receipt: "REC-2026-0582", date: "10 août 2026 · 13:10", day: "10 août 2026", student: "Aline Martin", className: "4e Humanités A", fee: "Frais scolaires", amount: 600000, mode: "Virement constaté", cashier: "Mme K", reference: "Paiement complet", status: "Validé" }
    ],
    expenses: [
      { reference: "DEP-2026-011", date: "14 août 2026", label: "Fournitures administratives", amount: 120000, status: "Validée" },
      { reference: "DEP-2026-012", date: "14 août 2026", label: "Entretien du groupe électrogène", amount: 75000, status: "À approuver" }
    ]
  };

  function initialsFromName(name) {
    return name.split(" ").map(function (part) { return part[0]; }).join("").toUpperCase().slice(0, 2);
  }

  function statusLabelFromFeeStatus(status) {
    if (status === "paid") return "En ordre";
    if (status === "partial") return "À régulariser";
    if (status === "exempted") return "Exempté";
    return "À régulariser";
  }

  async function loadFinanceData() {
    if (financeState.loading || financeState.loaded) return;
    if (!window.SchoolSafeFinanceAPI) return;
    financeState.loading = true;
    try {
      var api = window.SchoolSafeFinanceAPI;
      var feeStructures = await api.listFeeStructures();
      if (feeStructures && feeStructures.length) {
        financeState.feeTypes = feeStructures.map(function (fee) {
          return {
            id: fee.id,
            name: fee.label,
            cycle: fee.cycle_key,
            amount: Number(fee.amount),
            currency: fee.currency,
            frequency: "Trimestre",
            due: fee.due_date || "À définir",
            active: fee.is_active
          };
        });
      }

      var studentFees = await api.listStudentFees({});
      if (studentFees && studentFees.length) {
        financeState.studentFeeMap = {};
        financeState.students = studentFees.map(function (sf, index) {
          var student = sf.students || {};
          var name = [student.first_name, student.last_name].filter(Boolean).join(" ") || "Élève";
          var mapped = {
            id: sf.id,
            student_id: sf.student_id,
            name: name,
            initials: initialsFromName(name),
            sex: student.gender === "F" ? "Fille" : "Garçon",
            className: "Classe",
            guardian: "—",
            expected: Number(sf.amount_expected),
            paid: Number(sf.amount_paid),
            balance: Number(sf.amount_remaining),
            status: statusLabelFromFeeStatus(sf.status)
          };
          financeState.studentFeeMap[index] = sf.id;
          return mapped;
        });
      }

      financeState.loaded = true;
    } catch (e) {
      console.warn("[Finance] chargement backend échoué, démo locale conservée", e);
    } finally {
      financeState.loading = false;
    }
  }

  function escapeMarkup(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  var deferredInstallPrompt = null;
  var latestSyncState = null;

  function syncOperationIcon(type) {
    return { scan: "scan-line", message: "messages-square", assignment: "notebook-pen", attendance: "clipboard-check", pedagogy: "book-open-check", finance: "landmark", administration: "folder-cog" }[type] || "cloud-upload";
  }

  function syncOperationStatus(status) {
    return { pending: "En attente", syncing: "En cours", failed: "À vérifier", conflict: "Conflit", "demo-synced": "Confirmé localement" }[status] || status;
  }

  function queueOfflineOperation(type, label, payload) {
    if (!window.SchoolSafeSync) return Promise.resolve(null);
    return window.SchoolSafeSync.enqueue({
      type: type,
      label: label,
      payload: payload || {},
      role: currentDemoRole
    }).catch(function () {
      notify("L’opération reste dans l’application, mais la file hors connexion n’a pas pu être ouverte.");
      return null;
    });
  }

  function renderSyncState(state) {
    latestSyncState = state;
    var button = document.getElementById("syncStatusButton");
    if (!button) return;
    var label = document.getElementById("syncStatusLabel");
    var detail = document.getElementById("syncStatusDetail");
    var icon = "badge-check";
    var text = "Synchronisé";
    var subtext = state.mode === "demo-local" ? "Démo locale" : "Serveur requis";
    var className = "sync-status-button is-online";

    if (!state.online) {
      icon = "cloud-off";
      text = "Sans connexion";
      subtext = state.pending + " en attente";
      className = "sync-status-button is-offline";
    } else if (state.syncing) {
      icon = "refresh-cw";
      text = "Synchronisation";
      subtext = state.pending + " opération(s)";
      className = "sync-status-button is-syncing";
    } else if (state.conflicts) {
      icon = "triangle-alert";
      text = state.conflicts + " à vérifier";
      subtext = state.pending + " en attente";
      className = "sync-status-button has-conflict";
    } else if (state.pending) {
      icon = "cloud-upload";
      text = state.pending + " en attente";
      subtext = "Reprise automatique";
      className = "sync-status-button is-syncing";
    }

    button.className = className;
    button.innerHTML = '<i data-lucide="' + icon + '"></i><span><b id="syncStatusLabel">' + text + '</b><small id="syncStatusDetail">' + subtext + "</small></span>";
    button.setAttribute("aria-label", text + ". " + subtext);

    var summary = document.getElementById("syncSummary");
    var summaryClass = !state.online ? "sync-summary offline" : state.conflicts ? "sync-summary problem" : "sync-summary";
    var summaryCopy = !state.online
      ? "Le travail est conservé sur cet appareil. La reprise démarrera automatiquement au retour de la connexion."
      : state.syncing
        ? "SchoolSafe traite la file dans l’ordre de priorité défini. Vous pouvez continuer à travailler."
        : state.conflicts
          ? "Aucune donnée n’a été écrasée. Les éléments signalés devront être contrôlés."
          : "Toutes les opérations de cette prévisualisation ont été confirmées localement.";
    summary.className = summaryClass;
    summary.innerHTML = '<span><i data-lucide="' + icon + '"></i></span><div><b>' + text + '</b><small>' + summaryCopy + "</small></div>";

    var queue = state.operations.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 12);
    document.getElementById("syncQueueCount").textContent = state.pending
      ? state.pending + " opération(s) en attente"
      : "Aucune opération en attente";
    document.getElementById("syncQueueList").innerHTML = queue.length ? queue.map(function (operation) {
      var time = new Date(operation.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return '<article class="sync-operation ' + escapeMarkup(operation.status) + '"><span><i data-lucide="' + syncOperationIcon(operation.type) + '"></i></span><div><b>' + escapeMarkup(operation.label) + '</b><small>' + escapeMarkup(operation.role) + " · " + time + '</small></div><em>' + escapeMarkup(syncOperationStatus(operation.status)) + "</em></article>";
    }).join("") : '<p class="sync-empty">Les prochaines opérations hors connexion apparaîtront ici.</p>';
    icons();
  }

  function openSyncPanel() {
    document.getElementById("syncPanel").hidden = false;
    document.getElementById("syncPanelBackdrop").hidden = false;
    document.getElementById("syncStatusButton").setAttribute("aria-expanded", "true");
    document.getElementById("closeSyncPanel").focus();
  }

  function closeSyncPanel() {
    document.getElementById("syncPanel").hidden = true;
    document.getElementById("syncPanelBackdrop").hidden = true;
    document.getElementById("syncStatusButton").setAttribute("aria-expanded", "false");
    document.getElementById("syncStatusButton").focus();
  }

  function finalizeLocallyConfirmedOperation(operation) {
    if (!operation || operation.type !== "finance" || operation.payload.kind !== "payment") return;
    var transaction = financeState.transactions.find(function (item) { return item.localReference === operation.payload.localReference; });
    if (!transaction || transaction.status === "Validé") return;
    financeState.receiptSequence += 1;
    transaction.receipt = "REC-2026-" + String(financeState.receiptSequence).padStart(4, "0");
    transaction.status = "Validé";
    transaction.date = "14 août 2026 · confirmé localement";
    transaction.syncOperationId = operation.id;
    notify("Opération confirmée localement : reçu officiel de démonstration et notification préparés.");
    if (!document.getElementById("financeModule").hidden) renderFinanceModule();
  }

  function initPwaExperience() {
    if (!window.SchoolSafeSync) return;
    window.addEventListener("schoolsafe:sync-state", function (event) { renderSyncState(event.detail); });
    window.addEventListener("schoolsafe:operation-synced", function (event) { finalizeLocallyConfirmedOperation(event.detail); });
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      document.getElementById("installPwaButton").hidden = false;
    });
    window.addEventListener("appinstalled", function () {
      deferredInstallPrompt = null;
      document.getElementById("installPwaButton").hidden = true;
      notify("SchoolSafe est installé sur cet appareil.");
    });
    window.SchoolSafeSync.init({
      demoAdapter: function () {
        return new Promise(function (resolve) {
          window.setTimeout(function () { resolve({ mode: "demo-local" }); }, 180);
        });
      }
    });
  }

  function pedagogyTabForAction(actionName) {
    if (/rattrapage|accompagnement renforcé|versement de rattrapage/i.test(actionName)) return "remediation";
    if (/ENAFEP|TENASOSP|EXETAT|épreuve.*certificative|épreuve.*nationale/i.test(actionName)) return "certifications";
    if (/devoir|cahier/i.test(actionName)) return "assignments";
    if (/évaluation|note|cotation/i.test(actionName)) return "grades";
    if (/moyenne|coefficient/i.test(actionName)) return "rules";
    if (/bulletin|résultat/i.test(actionName)) return "bulletin";
    return "";
  }

  function openPedagogyModule(actionName) {
    var requestedTab = pedagogyTabForAction(actionName || "") || (currentDemoRole === "parent" ? "parent" : "assignments");
    if (/ENAFEP/i.test(actionName || "")) pedagogyState.certifications.activeExam = "ENAFEP";
    if (/TENASOSP/i.test(actionName || "")) pedagogyState.certifications.activeExam = "TENASOSP";
    if (/EXETAT/i.test(actionName || "")) pedagogyState.certifications.activeExam = "EXETAT";
    if (currentDemoRole === "parent" && requestedTab !== "certifications") requestedTab = "parent";
    if (/rattrapage/i.test(actionName || "")) requestedTab = "remediation";
    if (/versement de rattrapage/i.test(actionName || "")) {
      requestedTab = "remediation";
      pedagogyState.remediation.activeView = "finance";
    }
    if (currentDemoRole === "parent" && requestedTab === "remediation") pedagogyState.remediation.activeView = "parent";
    pedagogyState.activeTab = requestedTab;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("securityModule").hidden = true;
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.getElementById("pedagogyModule").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    document.getElementById("pedagogyTabs").hidden = true;
    document.getElementById("pedagogyModuleTitle").textContent = "Pédagogie";
    if (window.SchoolSafePedagogyModule) {
      window.SchoolSafePedagogyModule.render("pedagogyContent");
    } else {
      renderPedagogyModule();
    }
    document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePedagogyModule() {
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
  }

  function assignmentStatus(item) {
    return item.published ? '<span class="pedagogy-badge published">Publié</span>' : '<span class="pedagogy-badge draft">Brouillon</span>';
  }

  function renderAssignmentsTab() {
    var canEdit = currentDemoRole !== "parent" && currentDemoRole !== "school_head";
    var selected = pedagogyState.assignments[pedagogyState.selectedAssignment] || pedagogyState.assignments[0];
    var draft = pedagogyState.assignmentDraftMeta;
    var assignmentList = pedagogyState.assignments.map(function (item, index) {
      return '<button class="assignment-row' + (index === pedagogyState.selectedAssignment ? " active" : "") + '" type="button" data-assignment-index="' + index + '"><span class="assignment-format"><i data-lucide="' + (item.format === "PDF" ? "file-text" : item.format === "Images" ? "images" : "align-left") + '"></i></span><span><b>' + escapeMarkup(item.title) + '</b><small>' + escapeMarkup(item.className + " · " + item.subject + " · " + item.language) + '</small></span>' + assignmentStatus(item) + '</button>';
    }).join("");
    var questions = pedagogyState.assignmentDraftQuestions.map(function (question, index) {
      return '<article class="question-editor-row"><header><b>Question ' + (index + 1) + '</b><button class="icon-button light" type="button" data-remove-question="' + index + '" title="Supprimer la question"><i data-lucide="trash-2"></i></button></header><label>Énoncé<textarea rows="2" data-question-field="text" data-question-index="' + index + '">' + escapeMarkup(question.text) + '</textarea></label><div><label>Type<select data-question-field="type" data-question-index="' + index + '">' + ["Réponse courte","Réponse longue","Calcul","Dessin","Choix multiple"].map(function (type) { return '<option' + (type === question.type ? " selected" : "") + '>' + type + '</option>'; }).join("") + '</select></label><label>Points<input type="number" min="0" data-question-field="points" data-question-index="' + index + '" value="' + question.points + '"></label><label>Espace de réponse<select data-question-field="answerSpace" data-question-index="' + index + '">' + ["3 lignes","5 lignes","8 lignes","Demi-page","Page entière"].map(function (space) { return '<option' + (space === question.answerSpace ? " selected" : "") + '>' + space + '</option>'; }).join("") + '</select></label></div>' + (question.type === "Choix multiple" ? '<label>Choix séparés par un point-virgule<input data-question-field="choices" data-question-index="' + index + '" value="' + escapeMarkup(question.choices || "") + '"></label>' : "") + '</article>';
    }).join("");
    var creation = canEdit ? '<form class="pedagogy-form assignment-composer" id="assignmentForm"><div class="form-section-title"><span><i data-lucide="file-pen-line"></i></span><div><h3>Composer un devoir SchoolSafe</h3><p>Le contenu saisi sera aligné dans un modèle A4 avec l’identité officielle de l’école.</p></div></div><div class="pedagogy-form-grid"><label>Titre<input name="title" required placeholder="Titre du devoir" value="' + escapeMarkup(draft.title) + '"></label><label>Classe<select name="className">' + ["1re A","2e B","Maternelle 3"].map(function (value) { return '<option' + (draft.className === value ? " selected" : "") + '>' + value + '</option>'; }).join("") + '</select></label><label>Matière<input name="subject" required value="' + escapeMarkup(draft.subject) + '"></label><label>Langue<select name="language">' + ["FR","EN","Autre"].map(function (value) { return '<option' + (draft.language === value ? " selected" : "") + '>' + value + '</option>'; }).join("") + '</select></label><label>Type<select name="type">' + ["Devoir","Interrogation","Examen","Activité compensatoire"].map(function (value) { return '<option' + (draft.type === value ? " selected" : "") + '>' + value + '</option>'; }).join("") + '</select></label><label>Enseignant<input name="teacher" value="' + escapeMarkup(draft.teacher) + '"></label><label>Barème total<input name="scale" type="number" min="0" value="' + draft.scale + '"></label><label>Date de remise<input name="due" value="' + escapeMarkup(draft.due) + '"></label><label class="wide">Prérequis<textarea name="prerequisites" rows="2" placeholder="Connaissances nécessaires avant le devoir...">' + escapeMarkup(draft.prerequisites) + '</textarea></label><label class="wide">Consignes générales<textarea name="instructions" rows="2" placeholder="Consignes de travail...">' + escapeMarkup(draft.instructions) + '</textarea></label><label class="wide file-field"><span>Pièce jointe facultative</span><input name="attachment" type="file" accept="image/*,.pdf"><small>Une photo ou un PDF peut accompagner le devoir composé. Le fichier reste local dans cette démonstration.</small></label></div><section class="question-composer"><header><div><span>Contenu du document</span><h3>Questions et espaces de réponse</h3></div><button class="secondary-button" type="button" id="addAssignmentQuestion"><i data-lucide="plus"></i> Ajouter une question</button></header><div>' + questions + '</div><aside><i data-lucide="layout-template"></i><p>SchoolSafe évite de couper une question entre deux pages et ajoute automatiquement les lignes, cadres de dessin ou pages de réponse demandées.</p></aside></section><footer><button class="secondary-button" type="button" id="previewAssignmentPdf"><i data-lucide="file-down"></i> Aperçu PDF</button><button class="secondary-button" type="button" id="saveAssignmentDraft"><i data-lucide="save"></i> Enregistrer le brouillon</button><button class="primary-button dark" type="submit"><i data-lucide="send"></i> Publier aux parents</button></footer></form>' : "";
    var pdfButton = selected.questions && selected.questions.length ? '<button class="secondary-button" type="button" data-download-assignment="' + pedagogyState.selectedAssignment + '"><i data-lucide="file-down"></i> Télécharger le devoir PDF</button>' : "";
    var sourceLanguage = String(selected.language || "").toLowerCase();
    var translationNotice = '<span class="translation-fallback" data-source-language="' + escapeMarkup(sourceLanguage) + '"><i data-lucide="languages"></i> Traduction non disponible : contenu original conservé.</span>';
    return '<div class="pedagogy-two-column assignment-layout"><section class="pedagogy-panel"><header class="panel-heading"><div><span>Travaux de la classe</span><h3>Devoirs et activités</h3></div><b>' + pedagogyState.assignments.length + '</b></header><div class="assignment-list">' + assignmentList + '</div><article class="assignment-detail"><div>' + translationNotice + '<span class="subject-tag">' + escapeMarkup(selected.subject + " · " + selected.language) + '</span><h3>' + escapeMarkup(selected.title) + '</h3><p>' + escapeMarkup(selected.instructions) + '</p></div><dl><div><dt>Échéance</dt><dd>' + escapeMarkup(selected.due) + '</dd></div><div><dt>Support</dt><dd>' + escapeMarkup(selected.format) + '</dd></div><div><dt>Version</dt><dd>v' + (selected.version || 1) + '</dd></div><div><dt>Barème</dt><dd>' + (selected.scale ? "/ " + selected.scale : "Qualitatif") + '</dd></div></dl><div class="assignment-detail-actions">' + pdfButton + '<button class="primary-button" type="button" data-open-grades><i data-lucide="clipboard-pen-line"></i> Coter ce travail</button></div></article></section>' + creation + '</div>';
  }

  function renderGradesTab() {
    var selected = pedagogyState.assignments[pedagogyState.selectedAssignment] || pedagogyState.assignments[0];
    var qualitative = !selected.scale;
    var rows = pedagogyState.students.map(function (student, index) {
      var grade = selected.grades[index];
      var input = qualitative
        ? '<select data-grade-index="' + index + '">' + ["Non observé","À renforcer","En acquisition","Acquis","Bien","Très bien","Excellent"].map(function (label) { return '<option' + (grade === label ? " selected" : "") + '>' + label + '</option>'; }).join("") + '</select>'
        : '<div class="grade-input"><input data-grade-index="' + index + '" type="number" min="0" max="' + selected.scale + '" step="0.25" value="' + (grade == null ? "" : grade) + '" placeholder="Absent"><span>/ ' + selected.scale + '</span></div>';
      return '<tr><td><span class="student-avatar">' + student.initials + '</span><b>' + student.name + '</b></td><td>' + input + '</td><td><select data-grade-state="' + index + '"><option>Présent</option><option' + (grade == null ? " selected" : "") + '>Absent</option><option>Rattrapage requis</option><option>Dispensé</option></select></td><td><span class="payment-dot ' + (student.paid ? "paid" : "unpaid") + '"></span>' + (student.paid ? "En règle" : "À régulariser") + '</td></tr>';
    }).join("");
    return '<section class="pedagogy-panel gradebook"><header class="gradebook-head"><div><span>Cotation de la classe</span><h3>' + escapeMarkup(selected.title) + '</h3><p>' + escapeMarkup(selected.className + " · " + selected.subject + " · " + selected.language) + '</p></div><label>Travail<select id="gradeAssignmentSelect">' + pedagogyState.assignments.map(function (item, index) { return '<option value="' + index + '"' + (index === pedagogyState.selectedAssignment ? " selected" : "") + '>' + escapeMarkup(item.title) + '</option>'; }).join("") + '</select></label></header><div class="grade-summary"><article><small>Barème</small><b>' + (qualitative ? "Qualitatif" : "/ " + selected.scale) + '</b></article><article><small>Cotes remplies</small><b>' + selected.grades.filter(function (grade) { return grade != null; }).length + ' / ' + pedagogyState.students.length + '</b></article><article><small>Publication</small><b>' + (selected.published ? "Visible" : "Brouillon") + '</b></article></div><div class="table-scroll"><table class="grade-table"><thead><tr><th>Élève</th><th>Cotation</th><th>Situation</th><th>Statut administratif</th></tr></thead><tbody>' + rows + '</tbody></table></div><footer class="grade-actions"><span><i data-lucide="info"></i> Les montants financiers ne sont jamais visibles ici.</span><div><button class="secondary-button" id="saveGrades" type="button"><i data-lucide="save"></i> Brouillon</button><button class="primary-button dark" id="publishGrades" type="button"><i data-lucide="send"></i> Publier les cotes</button></div></footer></section>';
  }

  function numberInput(name, label, value, suffix) {
    return '<label>' + label + '<span class="number-field"><input name="' + name + '" type="number" min="0" max="100" value="' + value + '"><b>' + suffix + '</b></span></label>';
  }

  function renderRulesTab() {
    return '<form class="pedagogy-rules" id="pedagogyRulesForm"><section class="pedagogy-panel"><header class="panel-heading"><div><span>Calendrier des résultats</span><h3>Périodes scolaires</h3></div><i data-lucide="calendar-range"></i></header><div class="pedagogy-form-grid compact"><label>Organisation<select name="periodType"><option' + (pedagogyState.periods.type === "Trimestres" ? " selected" : "") + '>Trimestres</option><option' + (pedagogyState.periods.type === "Semestres" ? " selected" : "") + '>Semestres</option><option>Périodes personnalisées</option></select></label><label>Nombre de périodes<input name="periodCount" type="number" min="1" max="12" value="' + pedagogyState.periods.count + '"></label><label>Seuil de réussite<span class="number-field"><input name="passMark" type="number" value="' + pedagogyState.periods.passMark + '"><b>%</b></span></label><label>Décimales<select name="precision"><option value="0">0</option><option value="1">1</option><option value="2" selected>2</option></select></label></div></section><section class="pedagogy-panel"><header class="panel-heading"><div><span>Calcul de période</span><h3>Poids des évaluations</h3></div><i data-lucide="calculator"></i></header><div class="rule-grid">' + numberInput("homeworkWeight", "Devoirs", pedagogyState.weights.homework, "%") + numberInput("quizWeight", "Interrogations", pedagogyState.weights.quiz, "%") + numberInput("examWeight", "Examens", pedagogyState.weights.exam, "%") + '</div><p class="rule-total" id="assessmentWeightTotal">Total : ' + (pedagogyState.weights.homework + pedagogyState.weights.quiz + pedagogyState.weights.exam) + ' %</p></section><section class="pedagogy-panel"><header class="panel-heading"><div><span>École bilingue</span><h3>Langues d’enseignement</h3></div><i data-lucide="languages"></i></header><div class="rule-grid">' + numberInput("frenchWeight", "Français", pedagogyState.languages[0].weight, "%") + numberInput("englishWeight", "Anglais", pedagogyState.languages[1].weight, "%") + '<label>Matière éliminatoire<select name="eliminatory"><option>Option désactivée</option><option>Au moins une matière</option></select></label></div><p class="rule-total">Chaque langue garde ses matières et ses cotations dans le bulletin unique.</p></section><section class="pedagogy-panel"><header class="panel-heading"><div><span>Vie scolaire</span><h3>Calcul de la conduite</h3></div><i data-lucide="shield-check"></i></header><div class="rule-grid">' + numberInput("teacherConduct", "Enseignant", pedagogyState.conduct.teacher, "%") + numberInput("disciplineConduct", "Responsable de discipline", pedagogyState.conduct.discipline, "%") + '<label>Rattrapage<select name="makeup"><option>Décision de l’enseignant</option><option>Remplace la note initiale</option><option>Conserve les deux notes</option></select></label></div></section><footer class="rules-footer"><span><i data-lucide="history"></i> Les résultats clôturés ne seront jamais recalculés silencieusement.</span><button class="primary-button dark" type="submit"><i data-lucide="save"></i> Enregistrer les règles</button></footer></form>';
  }

  function renderBulletinTab() {
    var parentChild = pedagogyState.parentChildren[pedagogyState.selectedParentChild];
    if (currentDemoRole === "parent" && !parentChild.paid) {
      return '<section class="result-locked"><span><i data-lucide="file-lock-2"></i></span><div><small>Résultat officiel non disponible</small><h3>' + escapeMarkup(parentChild.name) + '</h3><p>Les devoirs et cotations quotidiennes restent visibles. Le bulletin de fin de période et le résultat annuel attendent une autorisation de la Direction.</p><button class="secondary-button" type="button" data-return-parent><i data-lucide="arrow-left"></i> Retour au suivi quotidien</button></div></section>';
    }
    var periods = Array.from({ length: pedagogyState.periods.count }, function (_, index) {
      var closed = Boolean(pedagogyState.periodStatuses[index]);
      return '<article class="period-card ' + (closed ? "closed" : "") + '"><header><span>' + (index + 1) + '</span><div><b>' + escapeMarkup(pedagogyState.periods.type.replace(/s$/, "")) + ' ' + (index + 1) + '</b><small>' + (closed ? "Validé par la Direction pédagogique" : "En cours de remplissage") + '</small></div><i data-lucide="' + (closed ? "lock-keyhole" : "circle-dashed") + '"></i></header><div><span>Français <b>' + (closed ? "14,25 / 20" : "—") + '</b></span><span>Anglais <b>' + (closed ? "13,75 / 20" : "—") + '</b></span><span>Synthèse <b>' + (closed ? "14,00 / 20" : "—") + '</b></span></div></article>';
    }).join("");
    var canValidate = currentDemoRole === "pedagogy" || currentDemoRole === "admin";
    var validationButton = canValidate && pedagogyState.periodStatuses.some(function (status) { return !status; }) ? '<button class="secondary-button" type="button" id="validatePeriod"><i data-lucide="badge-check"></i> Valider la période suivante</button>' : "";
    return '<section class="continuous-bulletin"><header class="bulletin-identity"><div class="student-photo">' + escapeMarkup(currentDemoRole === "parent" ? parentChild.initials : "LM") + '</div><div><span>Bulletin scolaire continu · 2026-2027</span><h3>' + escapeMarkup(currentDemoRole === "parent" ? parentChild.name : "Lucas Martin") + '</h3><p>' + escapeMarkup(currentDemoRole === "parent" ? parentChild.className : "1re A") + ' · Cycle primaire · Matricule 4521</p></div><span class="single-record"><i data-lucide="file-check-2"></i> Un bulletin annuel</span></header><div class="bulletin-metrics"><article><small>Moyenne consolidée</small><b>14,00 / 20</b><span>70 % · Réussite</span></article><article><small>Position provisoire</small><b>5e / 32</b><span>Après validation</span></article><article><small>Conduite</small><b>Très bien</b><span>40 % + 60 %</span></article><article><small>Langues</small><b>50 / 50</b><span>Français · Anglais</span></article></div><div class="period-grid">' + periods + '</div><section class="subject-results"><header><h3>Résultats par matière et langue</h3><span>Deux décimales</span></header><div class="language-result"><b>Mathématiques</b><span>FR <strong>15,25</strong></span><span>EN <strong>14,50</strong></span><span>Synthèse <strong>14,88</strong></span></div><div class="language-result"><b>Français / English</b><span>FR <strong>13,75</strong></span><span>EN <strong>14,25</strong></span><span>Synthèse <strong>14,00</strong></span></div></section><footer><span><i data-lucide="badge-check"></i> Le PDF officiel portera le logo de l’école après validation.</span><div class="bulletin-actions">' + validationButton + '<button class="primary-button dark" type="button" id="prepareBulletin"><i data-lucide="file-down"></i> Préparer le PDF</button></div></footer></section>';
  }

  function renderParentTab() {
    var child = pedagogyState.parentChildren[pedagogyState.selectedParentChild];
    var cards = pedagogyState.assignments.filter(function (item) { return item.published; }).map(function (item) {
      var grade = item.grades[0];
      return '<article class="parent-assignment"><span class="assignment-format"><i data-lucide="' + (item.format === "PDF" ? "file-text" : "notebook-pen") + '"></i></span><div><small>' + escapeMarkup(item.type + " · " + item.subject + " · " + item.language) + '</small><b>' + escapeMarkup(item.title) + '</b><p>À remettre le ' + escapeMarkup(item.due) + '</p></div><span class="parent-grade">' + (grade == null ? "À venir" : (item.scale ? grade + " / " + item.scale : grade)) + '</span></article>';
    }).join("");
    var childOptions = pedagogyState.parentChildren.map(function (item, index) { return '<option value="' + index + '"' + (index === pedagogyState.selectedParentChild ? " selected" : "") + '>' + escapeMarkup(item.name + " · " + item.className) + '</option>'; }).join("");
    var officialCopy = child.paid ? "Visible après validation pédagogique et confirmation administrative. Les paiements ne transitent pas dans SchoolSafe." : "Le suivi quotidien reste disponible. Le résultat officiel attend une autorisation de la Direction.";
    return '<div class="parent-learning"><div class="parent-child-picker"><label>Enfant suivi<select id="parentChildSelect">' + childOptions + '</select></label></div><header><div><span>Suivi pédagogique</span><h3>' + escapeMarkup(child.name) + '</h3><p>Les devoirs et cotations publiés par ses enseignants.</p></div><span class="payment-state ' + (child.paid ? "" : "pending") + '"><i data-lucide="' + (child.paid ? "badge-check" : "clock-3") + '"></i> ' + (child.paid ? "En règle" : "À régulariser") + '</span></header><div class="parent-summary"><article><small>Devoirs publiés</small><b>' + pedagogyState.assignments.filter(function (item) { return item.published; }).length + '</b></article><article><small>Moyenne officielle</small><b>' + escapeMarkup(child.average) + '</b></article><article><small>Classement validé</small><b>' + escapeMarkup(child.rank) + '</b></article></div><section class="parent-work-list"><header><h3>Travaux et cotations</h3><span>Mise à jour dans l’application</span></header>' + cards + '</section><aside class="official-result ' + (child.paid ? "" : "restricted") + '"><i data-lucide="file-lock-2"></i><div><b>Résultat officiel de fin de période</b><p>' + officialCopy + '</p></div><button class="secondary-button" type="button" data-parent-bulletin' + (child.paid ? "" : " disabled") + '>' + (child.paid ? "Consulter" : "Accès suspendu") + '</button></aside></div>';
  }

  function money(value) {
    return new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " FC";
  }

  function remediationStatusClass(status) {
    if (/renforcée/i.test(status)) return "danger";
    if (/cours/i.test(status)) return "active";
    if (/validé|terminé/i.test(status)) return "done";
    return "pending";
  }

  function remediationCaseList() {
    return pedagogyState.remediation.cases.filter(function (item) {
      if (currentDemoRole === "teacher") return item.teacher === "Mme Y";
      if (currentDemoRole === "parent") return item.student === "Lucas Martin";
      return true;
    });
  }

  function renderRemediationCases() {
    var cases = remediationCaseList();
    var selected = pedagogyState.remediation.cases[pedagogyState.remediation.selectedCase] || cases[0];
    if (cases.indexOf(selected) === -1) selected = cases[0];
    var list = cases.map(function (item) {
      var index = pedagogyState.remediation.cases.indexOf(item);
      return '<button class="remediation-case-row' + (item === selected ? " active" : "") + '" type="button" data-remediation-case="' + index + '"><span class="student-avatar">' + item.initials + '</span><span><b>' + escapeMarkup(item.student) + '</b><small>' + escapeMarkup(item.className + " · " + item.month) + '</small></span><span class="case-score">' + String(item.average).replace(".", ",") + ' %</span><span class="case-status ' + remediationStatusClass(item.status) + '">' + escapeMarkup(item.status) + '</span></button>';
    }).join("");
    var subjects = selected.subjects.map(function (subject) { return '<span><i data-lucide="book-open"></i>' + escapeMarkup(subject) + '</span>'; }).join("");
    var canDecide = currentDemoRole === "admin" || currentDemoRole === "school_head" || currentDemoRole === "pedagogy";
    var decision = canDecide ? '<form class="remediation-decision" id="remediationDecisionForm"><h4>Décision de la Direction</h4><div><label>Enseignant<select name="teacher"><option' + (selected.teacher === "Non affecté" ? " selected" : "") + '>Non affecté</option><option' + (selected.teacher === "Mme Y" ? " selected" : "") + '>Mme Y</option><option>M. Kabasele</option></select></label><label>Prix mensuel<input name="price" type="number" min="0" value="' + selected.price + '"></label><label>Début<input name="start" value="' + escapeMarkup(selected.start) + '"></label><label>Fin<input name="end" value="' + escapeMarkup(selected.end) + '"></label></div><footer><button class="secondary-button" type="button" id="cancelDetection"><i data-lucide="circle-x"></i> Annuler la détection</button><button class="primary-button dark" type="submit"><i data-lucide="user-round-check"></i> Valider et affecter</button></footer></form>' : "";
    var alert = selected.monthsWithoutProgress >= 6 ? '<aside class="reinforced-alert"><i data-lucide="triangle-alert"></i><div><b>Accompagnement renforcé requis</b><p>Six mois sans progression suffisante. Une nouvelle convocation et un plan spécial doivent être préparés.</p></div></aside>' : "";
    return '<div class="remediation-case-layout"><section class="remediation-list"><header><div><span>Analyse mensuelle automatique</span><h3>Élèves sous 50 %</h3></div><b>' + cases.length + '</b></header><div>' + list + '</div><aside class="free-makeup-note"><i data-lucide="shield-check"></i><div><b>Évaluation manquée avec absence justifiée</b><p>Rattrapage gratuit, organisé par l’enseignant et exclu du programme mensuel payant.</p></div></aside></section><section class="remediation-case-detail"><header><div class="student-avatar large">' + selected.initials + '</div><div><span>' + escapeMarkup(selected.cycle + " · " + selected.month) + '</span><h3>' + escapeMarkup(selected.student) + '</h3><p>' + escapeMarkup(selected.parentStatus) + '</p></div><span class="case-status ' + remediationStatusClass(selected.status) + '">' + escapeMarkup(selected.status) + '</span></header>' + alert + '<div class="remediation-subjects"><h4>Matières détectées séparément</h4><div>' + subjects + '</div></div><div class="remediation-facts"><article><small>Moyenne détectée</small><b>' + String(selected.average).replace(".", ",") + ' %</b></article><article><small>Enseignant affecté</small><b>' + escapeMarkup(selected.teacher) + '</b></article><article><small>Prix mensuel</small><b>' + money(selected.price) + '</b></article><article><small>Durée</small><b>1 mois</b></article></div><aside class="convocation-note"><i data-lucide="messages-square"></i><div><b>Convocation parent</b><p>Notification dans SchoolSafe et notification Web Push gratuite. Le parent doit rencontrer la Direction avant l’affectation.</p></div></aside>' + decision + '</section></div>';
  }

  function renderRemediationSchedule() {
    var cases = remediationCaseList().filter(function (item) { return item.teacher !== "Non affecté" && !item.cancelled; });
    var cards = cases.map(function (item) {
      var attendance = item.sessions.map(function (session) { return '<li><span>' + escapeMarkup(session.date + " · " + session.subject) + '</span><b class="' + (session.present ? "present" : "absent") + '">' + (session.present ? "Présent" : "Absent · séance perdue") + '</b></li>'; }).join("") || '<li><span>Aucune séance enregistrée</span><b>À organiser</b></li>';
      return '<article class="remediation-plan"><header><span class="student-avatar">' + item.initials + '</span><div><h3>' + escapeMarkup(item.student) + '</h3><p>' + escapeMarkup(item.start + " au " + item.end) + '</p></div><span>' + item.sessions.length + ' séance(s)</span></header><div class="plan-subjects">' + item.subjects.map(function (subject) { return '<span>' + escapeMarkup(subject.split(" · ")[0]) + '</span>'; }).join("") + '</div><ul>' + attendance + '</ul><form data-session-form="' + pedagogyState.remediation.cases.indexOf(item) + '"><label>Date<input name="date" required placeholder="15 août"></label><label>Matière<select name="subject">' + item.subjects.map(function (subject) { return '<option>' + escapeMarkup(subject.split(" · ")[0]) + '</option>'; }).join("") + '</select></label><label>Présence<select name="presence"><option value="present">Présent</option><option value="absent">Absent</option></select></label><button class="primary-button" type="submit"><i data-lucide="plus"></i> Ajouter</button></form></article>';
    }).join("");
    return '<div class="remediation-schedule"><header><div><span>Organisation libre de l’enseignant</span><h3>Suivi des séances</h3><p>Les absences déclenchent une alerte et ne prolongent pas le mois.</p></div><span><i data-lucide="calendar-clock"></i> Un mois fixe</span></header><div>' + cards + '</div></div>';
  }

  function renderRemediationFinance() {
    var cases = remediationCaseList().filter(function (item) { return item.price > 0 && !item.cancelled; });
    var totalPaid = cases.reduce(function (sum, item) { return sum + item.paid; }, 0);
    var rows = cases.map(function (item) {
      var teacherShare = item.paid * 0.6;
      var schoolShare = item.paid * 0.4;
      return '<tr><td><b>' + escapeMarkup(item.student) + '</b><small>' + escapeMarkup(item.month) + '</small></td><td>' + money(item.price) + '</td><td>' + money(item.paid) + '</td><td>' + money(item.price - item.paid) + '</td><td>' + money(teacherShare) + '</td><td>' + money(schoolShare) + '</td><td><button class="icon-button light" type="button" data-add-installment="' + pedagogyState.remediation.cases.indexOf(item) + '" title="Enregistrer une tranche"><i data-lucide="circle-plus"></i></button></td></tr>';
    }).join("");
    return '<section class="remediation-finance"><header><div><span>Enregistrement comptable local</span><h3>Versements et ventilation</h3><p>SchoolSafe enregistre les tranches; aucun argent ne transite dans l’application.</p></div><span class="closure-chip"><i data-lucide="calendar-check"></i> Paiement enseignant à la clôture</span></header><div class="finance-summary"><article><small>Total attendu</small><b>' + money(cases.reduce(function (sum, item) { return sum + item.price; }, 0)) + '</b></article><article><small>Réellement encaissé</small><b>' + money(totalPaid) + '</b></article><article><small>Part enseignants · 60 %</small><b>' + money(totalPaid * .6) + '</b></article><article><small>Part école · 40 %</small><b>' + money(totalPaid * .4) + '</b></article></div><div class="table-scroll"><table class="remediation-table"><thead><tr><th>Élève</th><th>Prix</th><th>Encaissé</th><th>Solde</th><th>Enseignant 60 %</th><th>École 40 %</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><footer><span><i data-lucide="info"></i> Une tranche tardive sera intégrée à la clôture suivante.</span><button class="primary-button dark" type="button" id="closeRemediationMonth"><i data-lucide="lock-keyhole"></i> Préparer la clôture du mois</button></footer></section>';
  }

  function renderRemediationReports() {
    var cases = remediationCaseList().filter(function (item) { return item.teacher !== "Non affecté"; });
    var reports = cases.map(function (item) {
      var index = pedagogyState.remediation.cases.indexOf(item);
      var gain = item.progress - item.average;
      return '<article class="remediation-report"><header><span class="student-avatar">' + item.initials + '</span><div><h3>' + escapeMarkup(item.student) + '</h3><p>' + escapeMarkup(item.month + " · " + item.teacher) + '</p></div><span class="case-status ' + (item.validated ? "done" : "pending") + '">' + (item.validated ? "Validé" : "À valider") + '</span></header><div class="progress-comparison"><div><small>Détection</small><b>' + String(item.average).replace(".", ",") + ' %</b></div><i data-lucide="arrow-right"></i><div><small>Fin du suivi</small><b>' + item.progress + ' %</b></div><strong>+' + String(gain).replace(".", ",") + ' points</strong></div><label>Bilan pédagogique<textarea data-report-index="' + index + '" rows="3">' + escapeMarkup(item.report) + '</textarea></label><footer><span>Résultat séparé du bulletin officiel</span>' + (currentDemoRole === "pedagogy" || currentDemoRole === "admin" ? '<button class="primary-button" type="button" data-validate-report="' + index + '"' + (item.validated ? " disabled" : "") + '><i data-lucide="badge-check"></i> ' + (item.validated ? "Bilan validé" : "Valider le bilan") + '</button>' : '<button class="secondary-button" type="button" data-save-report="' + index + '"><i data-lucide="save"></i> Enregistrer</button>') + '</footer></article>';
    }).join("");
    return '<div class="remediation-reports"><header><div><span>Fin du mois</span><h3>Progression et bilans</h3></div><span><i data-lucide="file-check-2"></i> Validation pédagogique</span></header><div>' + reports + '</div></div>';
  }

  function renderRemediationParent() {
    var item = pedagogyState.remediation.cases.filter(function (record) { return record.student === "Lucas Martin"; })[0];
    return '<div class="remediation-parent"><header><div><span>Accompagnement pédagogique</span><h3>' + escapeMarkup(item.student) + '</h3><p>' + escapeMarkup(item.month + " · " + item.className) + '</p></div><span class="case-status ' + remediationStatusClass(item.status) + '">' + escapeMarkup(item.status) + '</span></header><div class="parent-remediation-summary"><article><small>Enseignant</small><b>' + escapeMarkup(item.teacher) + '</b></article><article><small>Période</small><b>' + escapeMarkup(item.start + " au " + item.end) + '</b></article><article><small>Progression</small><b>' + item.average + ' % → ' + item.progress + ' %</b></article></div><section><h3>Matières accompagnées</h3>' + item.subjects.map(function (subject) { return '<span><i data-lucide="book-open-check"></i>' + escapeMarkup(subject) + '</span>'; }).join("") + '</section><section class="parent-installments"><header><h3>Situation du programme</h3><span>Aucun paiement en ligne</span></header><div><span>Prix fixé par la Direction <b>' + money(item.price) + '</b></span><span>Versements enregistrés <b>' + money(item.paid) + '</b></span><span>Solde restant <b>' + money(item.price - item.paid) + '</b></span></div></section><aside><i data-lucide="info"></i><p>Les résultats de cet accompagnement mesurent la progression. Ils restent séparés du bulletin officiel et ne décident pas du passage de classe.</p></aside></div>';
  }

  function renderRemediationTab() {
    var roleViews = currentDemoRole === "parent" ? ["parent"] : currentDemoRole === "teacher" ? ["cases","schedule","reports"] : ["cases","schedule","finance","reports"];
    if (roleViews.indexOf(pedagogyState.remediation.activeView) === -1) pedagogyState.remediation.activeView = roleViews[0];
    var labels = { cases: ["Détection et dossiers","scan-search"], schedule: ["Séances","calendar-clock"], finance: ["Versements 60/40","hand-coins"], reports: ["Bilans","file-check-2"], parent: ["Suivi parent","contact-round"] };
    var navigation = roleViews.map(function (view) { return '<button class="' + (view === pedagogyState.remediation.activeView ? "active" : "") + '" type="button" data-remediation-view="' + view + '"><i data-lucide="' + labels[view][1] + '"></i>' + labels[view][0] + '</button>'; }).join("");
    var renderers = { cases: renderRemediationCases, schedule: renderRemediationSchedule, finance: renderRemediationFinance, reports: renderRemediationReports, parent: renderRemediationParent };
    return '<section class="remediation-workspace"><header class="remediation-overview"><div><span>Programme mensuel obligatoire après décision</span><h3>Rattrapage pédagogique</h3><p>Détection automatique sous 50 %, entretien avec le parent, suivi d’un mois et nouvelle analyse le mois suivant.</p></div><div><article><small>À convoquer</small><b>1</b></article><article><small>En suivi</small><b>2</b></article><article><small>Bilans</small><b>1</b></article><article><small>Alerte 6 mois</small><b>1</b></article></div></header><nav class="remediation-nav">' + navigation + '</nav><div class="remediation-view">' + renderers[pedagogyState.remediation.activeView]() + '</div></section>';
  }

  function certificationExam() {
    return pedagogyState.certifications.exams[pedagogyState.certifications.activeExam];
  }

  function certificationCandidates() {
    var filters = pedagogyState.certifications.filters;
    return certificationExam().candidates.filter(function (candidate) {
      return (filters.className === "Toutes" || candidate.className === filters.className) &&
        (filters.center === "Tous" || candidate.center === filters.center) &&
        (filters.decision === "Tous" || candidate.decision === filters.decision) &&
        (filters.option === "Toutes" || candidate.option === filters.option);
    });
  }

  function certificationStatusClass(value) {
    if (/complet|réussi|publié|présent|terminé|validé|en ordre/i.test(value) && !/incomplet/i.test(value)) return "done";
    if (/incomplet|rejeté|absent|échoué|non admis|régulariser/i.test(value)) return "danger";
    if (/vérifier|attente|venir/i.test(value)) return "pending";
    return "active";
  }

  function certificationFiltersMarkup(exam) {
    function options(values, selected) {
      return values.map(function (value) { return '<option' + (value === selected ? " selected" : "") + '>' + escapeMarkup(value) + '</option>'; }).join("");
    }
    var classes = ["Toutes"].concat(Array.from(new Set(exam.candidates.map(function (item) { return item.className; }))));
    var centers = ["Tous"].concat(Array.from(new Set(exam.candidates.map(function (item) { return item.center; }))));
    var decisions = ["Tous"].concat(Array.from(new Set(exam.candidates.map(function (item) { return item.decision; }))));
    var examOptions = ["Toutes"].concat(Array.from(new Set(exam.candidates.map(function (item) { return item.option; }).filter(Boolean))));
    var optionFilter = examOptions.length > 1 ? '<label>Option / filière<select data-cert-filter="option">' + options(examOptions, pedagogyState.certifications.filters.option) + '</select></label>' : "";
    return '<div class="certification-filters' + (optionFilter ? " has-option" : "") + '"><label>Classe<select data-cert-filter="className">' + options(classes, pedagogyState.certifications.filters.className) + '</select></label>' + optionFilter + '<label>Centre<select data-cert-filter="center">' + options(centers, pedagogyState.certifications.filters.center) + '</select></label><label>Résultat<select data-cert-filter="decision">' + options(decisions, pedagogyState.certifications.filters.decision) + '</select></label></div>';
  }

  function renderCertificationCandidates(exam) {
    var candidates = certificationCandidates();
    var canManage = currentDemoRole === "admin" || currentDemoRole === "school_head" || currentDemoRole === "pedagogy" || currentDemoRole === "secretary";
    var rows = candidates.map(function (candidate, index) {
      return '<tr><td><span class="student-avatar">' + candidate.initials + '</span><b>' + escapeMarkup(candidate.name) + '</b><small>' + escapeMarkup(candidate.sex) + '</small></td><td><b class="candidate-class">' + escapeMarkup(candidate.className) + '</b>' + (candidate.option ? '<span class="candidate-option">' + escapeMarkup(candidate.option) + '</span>' : "") + '</td><td>' + escapeMarkup(candidate.number) + '</td><td>' + escapeMarkup(candidate.center) + '</td><td><span class="case-status ' + certificationStatusClass(candidate.dossier) + '">' + escapeMarkup(candidate.dossier) + '</span></td><td><button class="icon-button light" type="button" data-cert-candidate="' + exam.candidates.indexOf(candidate) + '" title="Ouvrir le dossier"><i data-lucide="folder-open"></i></button></td></tr>';
    }).join("");
    var selected = exam.candidates[pedagogyState.certifications.selectedCandidate] || exam.candidates[0];
    var exetatDetails = selected.option ? '<div><dt>Option / filière</dt><dd>' + escapeMarkup(selected.option) + '</dd></div><div><dt>Type de cycle</dt><dd>' + escapeMarkup(selected.cycleType) + '</dd></div><div><dt>Jury</dt><dd>' + escapeMarkup(selected.jury) + '</dd></div><div><dt>Participation</dt><dd><span class="case-status ' + certificationStatusClass(selected.participationStatus) + '">' + escapeMarkup(selected.participationStatus) + '</span></dd></div>' : "";
    return '<div class="certification-candidate-layout"><section class="certification-table-card"><header><div><span>Registre des candidats</span><h3>Dossiers et affectations</h3></div><b>' + candidates.length + '</b></header>' + certificationFiltersMarkup(exam) + '<div class="table-scroll"><table class="certification-table"><thead><tr><th>Candidat</th><th>Classe / option</th><th>Numéro</th><th>Centre / jury</th><th>Dossier</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section><aside class="candidate-file"><header><span class="student-avatar large">' + selected.initials + '</span><div><small>' + escapeMarkup(exam.label + " · " + selected.className) + '</small><h3>' + escapeMarkup(selected.name) + '</h3><p>' + escapeMarkup(selected.number) + '</p></div><span class="case-status ' + certificationStatusClass(selected.dossier) + '">' + escapeMarkup(selected.dossier) + '</span></header><dl><div><dt>Centre</dt><dd>' + escapeMarkup(selected.center) + '</dd></div>' + exetatDetails + '<div><dt>Préparation</dt><dd>' + selected.preparation + ' %</dd></div><div><dt>Présence</dt><dd>' + escapeMarkup(selected.attendance) + '</dd></div><div><dt>Résultat officiel</dt><dd>' + (selected.percentage == null ? "Non publié" : String(selected.percentage).replace(".", ",") + " % · " + selected.decision) + '</dd></div></dl><aside><i data-lucide="shield-check"></i><p>L’identité, le numéro de candidat, l’option, le jury et le centre doivent être vérifiés avant transmission. SchoolSafe ne fabrique aucun résultat national et ne produit aucun diplôme d’État.</p></aside>' + (canManage ? '<button class="secondary-button" type="button" data-cert-save><i data-lucide="save"></i> Enregistrer le contrôle local</button>' : "") + '</aside></div>';
  }

  function renderCertificationPreparation(exam) {
    var teacherClasses = exam.teacherClasses || ["6e A", "8e A"];
    var candidates = currentDemoRole === "teacher" ? exam.candidates.filter(function (item) { return teacherClasses.indexOf(item.className) !== -1; }) : exam.candidates;
    var areas = exam.preparationAreas || ["Français", "Mathématiques", "Sciences"];
    var offsets = [-3, 2, -6];
    var cards = candidates.map(function (candidate) {
      var areaRows = areas.map(function (area, index) { return '<span>' + escapeMarkup(area) + ' <b>' + Math.max(35, Math.min(98, candidate.preparation + offsets[index % offsets.length])) + ' %</b></span>'; }).join("");
      return '<article class="preparation-card"><header><span class="student-avatar">' + candidate.initials + '</span><div><h3>' + escapeMarkup(candidate.name) + '</h3><p>' + escapeMarkup(candidate.className + (candidate.option ? " · " + candidate.option : "")) + '</p></div><b>' + candidate.preparation + ' %</b></header><div class="preparation-bar"><i style="width:' + candidate.preparation + '%"></i></div><div>' + areaRows + '</div><footer><span>Simulations séparées du résultat officiel</span><button class="icon-button light" type="button" title="Consigner une simulation"><i data-lucide="clipboard-pen-line"></i></button></footer></article>';
    }).join("");
    return '<section class="certification-preparation"><header><div><span>Préparation interne de l’école</span><h3>Simulations et progression</h3><p>Les enseignants suivent la préparation sans modifier le bulletin ni le futur résultat national.</p></div><button class="secondary-button" type="button" data-export-cert="preparation"><i data-lucide="file-down"></i> Exporter la préparation PDF</button></header><div>' + cards + '</div></section>';
  }

  function renderCertificationStages(exam) {
    if (!exam.phases || !exam.phases.length) {
      return '<section class="certification-stages empty"><i data-lucide="calendar-clock"></i><div><h3>Calendrier national à confirmer</h3><p>L’école ajoutera les étapes officielles après publication du calendrier de la session.</p></div></section>';
    }
    var completed = exam.phases.filter(function (phase) { return /terminé|publié/i.test(phase.status); }).length;
    var phases = exam.phases.map(function (phase, index) {
      return '<article><span class="stage-number">' + (index + 1) + '</span><div><header><small>' + escapeMarkup(phase.scope) + '</small><span class="case-status ' + certificationStatusClass(phase.status) + '">' + escapeMarkup(phase.status) + '</span></header><h3>' + escapeMarkup(phase.label) + '</h3><b><i data-lucide="calendar-days"></i>' + escapeMarkup(phase.date) + '</b><p>' + escapeMarkup(phase.detail) + '</p></div></article>';
    }).join("");
    return '<section class="certification-stages"><header><div><span>Parcours réglementaire suivi par l’école</span><h3>Étapes de l’EXETAT</h3><p>Calendrier 2026 de référence. Les dates d’une nouvelle session devront être confirmées avant utilisation.</p></div><div><b>' + completed + ' / ' + exam.phases.length + '</b><span>étapes documentées</span></div></header><div class="certification-stage-grid">' + phases + '</div><footer><i data-lucide="landmark"></i><p>Les corrections, le scannage, la délibération, la publication et le diplôme d’État relèvent exclusivement des services officiels. SchoolSafe conserve seulement le suivi local et la référence de la source.</p></footer></section>';
  }

  function renderCertificationResults(exam) {
    var published = certificationCandidates().filter(function (candidate) { return candidate.published && candidate.percentage != null; });
    var passed = published.filter(function (candidate) { return candidate.decision === "Réussi"; }).length;
    var rate = published.length ? Math.round(passed / published.length * 100) : 0;
    var rows = published.map(function (candidate) {
      return '<tr><td><span class="student-avatar">' + candidate.initials + '</span><b>' + escapeMarkup(candidate.name) + '</b></td><td><b class="candidate-class">' + escapeMarkup(candidate.className) + '</b>' + (candidate.option ? '<span class="candidate-option">' + escapeMarkup(candidate.option) + '</span>' : "") + '</td><td>' + escapeMarkup(candidate.number) + '</td><td><b>' + String(candidate.percentage).replace(".", ",") + ' %</b></td><td><span class="case-status ' + certificationStatusClass(candidate.decision) + '">' + escapeMarkup(candidate.decision) + '</span></td><td><button class="icon-button light" type="button" data-export-cert-person="' + exam.candidates.indexOf(candidate) + '" title="Télécharger le résultat individuel PDF"><i data-lucide="file-down"></i></button></td></tr>';
    }).join("") || '<tr><td colspan="6">Aucun résultat officiel validé pour ce filtre.</td></tr>';
    return '<section class="certification-results"><header><div><span>Après publication et validation</span><h3>Résultats officiels enregistrés</h3><p>Chaque résultat conserve sa source, sa date d’import et la personne qui l’a vérifié.</p></div><div class="certification-export-actions"><button class="secondary-button" type="button" data-export-cert="filtered"><i data-lucide="filter"></i> PDF filtré</button><button class="primary-button dark" type="button" data-export-cert="all"><i data-lucide="file-down"></i> Exporter tous les résultats PDF</button></div></header><div class="certification-metrics"><article><small>Résultats publiés</small><b>' + published.length + '</b></article><article><small>Réussites</small><b>' + passed + '</b></article><article><small>Taux de réussite</small><b>' + rate + ' %</b></article><article><small>Source</small><b>À documenter</b></article></div>' + certificationFiltersMarkup(exam) + '<div class="table-scroll"><table class="certification-table"><thead><tr><th>Candidat</th><th>Classe</th><th>Numéro</th><th>Pourcentage</th><th>Décision</th><th>PDF</th></tr></thead><tbody>' + rows + '</tbody></table></div><footer><i data-lucide="badge-alert"></i><span>Dans cette démonstration, les valeurs sont fictives et les PDF portent la mention « Aperçu non officiel ».</span></footer></section>';
  }

  function renderCertificationParent(exam) {
    var parentCandidateName = exam.parentCandidateName || "Lucas Martin";
    var candidate = exam.candidates.filter(function (item) { return item.name === parentCandidateName; })[0];
    if (!candidate) return '<section class="result-locked"><span><i data-lucide="scroll-text"></i></span><div><small>Aucune épreuve rattachée</small><h3>Mes enfants</h3><p>Aucun candidat de ce profil parent n’est rattaché à cette session.</p></div></section>';
    var optionSummary = candidate.option ? '<article><small>Option / jury</small><b>' + escapeMarkup(candidate.option + " · " + candidate.jury) + '</b></article>' : "";
    var parentNotice = exam.label === "EXETAT" ? "Ce résultat apparaît seulement après publication officielle et validation par l’école. Le PDF SchoolSafe n’est ni le diplôme d’État ni un relevé officiel." : "Ce résultat apparaît seulement après publication officielle et validation par l’école.";
    return '<section class="certification-parent"><header><div><span>' + escapeMarkup(exam.label + " · " + exam.session) + '</span><h3>' + escapeMarkup(candidate.name) + '</h3><p>' + escapeMarkup(candidate.className + " · " + candidate.number) + '</p></div><span class="case-status ' + certificationStatusClass(candidate.decision) + '">' + escapeMarkup(candidate.decision) + '</span></header><div><article><small>Dossier</small><b>' + escapeMarkup(candidate.dossier) + '</b></article>' + optionSummary + '<article><small>Centre</small><b>' + escapeMarkup(candidate.center) + '</b></article><article><small>Résultat validé</small><b>' + (candidate.published ? String(candidate.percentage).replace(".", ",") + " %" : "Non publié") + '</b></article></div><aside><i data-lucide="info"></i><p>' + escapeMarkup(parentNotice) + '</p></aside><button class="primary-button dark" type="button" data-export-cert-person="' + exam.candidates.indexOf(candidate) + '"' + (candidate.published ? "" : " disabled") + '><i data-lucide="file-down"></i> Télécharger le relevé SchoolSafe PDF</button></section>';
  }

  function renderCertificationsTab() {
    var exam = certificationExam();
    var hasStages = Boolean(exam.phases && exam.phases.length);
    var roleViews = currentDemoRole === "parent" ? (hasStages ? ["stages","parent"] : ["parent"]) : currentDemoRole === "teacher" ? (hasStages ? ["stages","preparation"] : ["preparation"]) : currentDemoRole === "secretary" ? (hasStages ? ["candidates","stages"] : ["candidates"]) : (hasStages ? ["candidates","stages","preparation","results"] : ["candidates","preparation","results"]);
    if (roleViews.indexOf(pedagogyState.certifications.activeView) === -1) pedagogyState.certifications.activeView = roleViews[0];
    var labels = { candidates: ["Candidats et dossiers","folder-check"], stages: ["Étapes EXETAT","milestone"], preparation: ["Préparation","clipboard-check"], results: ["Résultats et PDF","file-chart-column"], parent: ["Résultat de mon enfant","contact-round"] };
    var views = roleViews.map(function (view) { return '<button class="' + (view === pedagogyState.certifications.activeView ? "active" : "") + '" type="button" data-cert-view="' + view + '"><i data-lucide="' + labels[view][1] + '"></i>' + labels[view][0] + '</button>'; }).join("");
    var renderers = { candidates: renderCertificationCandidates, stages: renderCertificationStages, preparation: renderCertificationPreparation, results: renderCertificationResults, parent: renderCertificationParent };
    return '<section class="certification-workspace"><header class="certification-overview"><div><span>Épreuves certificatives de la RDC</span><h3>' + escapeMarkup(exam.fullName) + '</h3><p>' + escapeMarkup(exam.cycle + " · " + exam.session + " · " + exam.dates) + '</p></div><div class="exam-switch"><button class="' + (exam.label === "ENAFEP" ? "active" : "") + '" type="button" data-cert-exam="ENAFEP">ENAFEP</button><button class="' + (exam.label === "TENASOSP" ? "active" : "") + '" type="button" data-cert-exam="TENASOSP">TENASOSP</button><button class="' + (exam.label === "EXETAT" ? "active" : "") + '" type="button" data-cert-exam="EXETAT">EXETAT</button></div></header><aside class="certification-boundary"><i data-lucide="shield-alert"></i><p>SchoolSafe prépare et suit les dossiers. Il ne remplace pas les services officiels, ne crée pas de résultat national et ne délivre ni certificat ni diplôme de l’État.</p></aside><nav class="remediation-nav">' + views + '</nav><div>' + renderers[pedagogyState.certifications.activeView](exam) + '</div></section>';
  }

  function renderPedagogyModule() {
    var titles = { assignments: "Devoirs et activités", grades: "Cotations des élèves", rules: "Calculs et coefficients", bulletin: "Bulletin continu", remediation: "Rattrapage pédagogique", certifications: "Épreuves certificatives", parent: "Suivi de mon enfant" };
    document.getElementById("pedagogyModuleTitle").textContent = titles[pedagogyState.activeTab];
    document.getElementById("workspaceTitle").textContent = titles[pedagogyState.activeTab];
    document.querySelectorAll("#pedagogyTabs [data-pedagogy-tab]").forEach(function (button) {
      var tab = button.getAttribute("data-pedagogy-tab");
      button.classList.toggle("active", tab === pedagogyState.activeTab);
      var financeOnly = currentDemoRole === "cashier" || currentDemoRole === "finance";
      button.hidden = (currentDemoRole === "parent" && tab !== "parent" && tab !== "bulletin" && tab !== "remediation" && tab !== "certifications") || (financeOnly && tab !== "remediation") || (currentDemoRole === "teacher" && tab === "parent") || (currentDemoRole === "secretary" && tab !== "certifications");
    });
    var renderersByTab = { assignments: renderAssignmentsTab, grades: renderGradesTab, rules: renderRulesTab, bulletin: renderBulletinTab, remediation: renderRemediationTab, certifications: renderCertificationsTab, parent: renderParentTab };
    document.getElementById("pedagogyContent").innerHTML = renderersByTab[pedagogyState.activeTab]();
    bindPedagogyEvents();
    icons();
  }

  function financeTabForAction(actionName) {
    if (/structure des frais|types de frais|contrôle des frais|échéance/i.test(actionName)) return "fees";
    if (/reçu/i.test(actionName)) return "receipts";
    if (/impayé|solde|en ordre|régulariser/i.test(actionName)) return "balances";
    if (/rapport|clôture|soumettre|export|imprimer/i.test(actionName)) return "reports";
    if (/encaissement|enregistrer un paiement|rechercher un élève|vérifier un paiement|historique du jour|caisse/i.test(actionName)) return "cash";
    if (/frais scolaires|paiement|échéances/i.test(actionName) && currentDemoRole === "parent") return "family";
    if (/financ|recette|dépense|statistique/i.test(actionName)) return "overview";
    return "";
  }

  function financeTabsForRole() {
    if (currentDemoRole === "parent") return ["family"];
    if (currentDemoRole === "pedagogy") return ["balances"];
    if (currentDemoRole === "cashier") return ["cash", "receipts", "balances", "reports"];
    if (currentDemoRole === "school_head") return ["overview", "reports"];
    if (currentDemoRole === "finance" || currentDemoRole === "admin") return ["overview", "fees", "cash", "receipts", "balances", "reports"];
    return ["overview"];
  }

  function openFinanceModule(actionName) {
    var requestedTab = financeTabForAction(actionName || "") || "overview";
    var allowedTabs = financeTabsForRole();
    financeState.activeTab = allowedTabs.indexOf(requestedTab) === -1 ? allowedTabs[0] : requestedTab;
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("securityModule").hidden = true;
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("financeModule").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    loadFinanceData().then(function () { renderFinanceModule(); });
    document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeFinanceModule() {
    document.getElementById("financeModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
  }

  function securityTabForAction(actionName) {
    if (/scanner un qr|enregistrer une entrée|enregistrer une sortie|préparer une sortie|personnes autorisées|vérifier l’identité|autoriser une sortie|refuser une sortie|élèves dans l’école|sorties en attente|historique des passages|incidents|alertes et anomalies/i.test(actionName)) return "scan";
    return "";
  }

  function pilotageTabForAction(actionName) {
    if (/tableau de bord|indicateurs|vue exécutive|statistiques/i.test(actionName)) return "dashboard";
    if (/alertes|approbations/i.test(actionName)) return "alerts";
    return "";
  }

  function openSecurityModule(actionName) {
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("securityModule").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    if (window.SchoolSafeSecurityModule) window.SchoolSafeSecurityModule.render("securityContent");
    document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeSecurityModule() {
    document.getElementById("securityModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
  }

  function openPilotageModule(actionName) {
    var requestedTab = pilotageTabForAction(actionName || "") || "dashboard";
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("securityModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("pilotageModule").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    document.querySelectorAll("#pilotageTabs [data-pilotage-tab]").forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-pilotage-tab") === requestedTab);
    });
    renderPilotageTab(requestedTab);
    document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePilotageModule() {
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
  }

  function renderPilotageTab(tab) {
    if (!window.SchoolSafePilotageModule) return;
    if (tab === "dashboard") window.SchoolSafePilotageModule.renderDashboard("pilotageContent");
    else if (tab === "alerts") window.SchoolSafePilotageModule.renderAlerts("pilotageContent");
  }

  function feeControlTabForAction(actionName) {
    if (/contrôle des frais|contrôle par qr|vérifier le statut financier/i.test(actionName)) return "scan";
    return "";
  }

  function openFeeControlModule(actionName) {
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("securityModule").hidden = true;
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("feeControlModule").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    if (window.SchoolSafeFeeControlModule) window.SchoolSafeFeeControlModule.render("feeControlContent");
    document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeFeeControlModule() {
    document.getElementById("feeControlModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
  }

  function schoolTabForAction(actionName) {
    if (/mon école|paramètres de l’école|configuration école|école & personnel/i.test(actionName)) return "school";
    if (/mon équipe|personnel|staff/i.test(actionName)) return "staff";
    return "";
  }

  function openSchoolModule(tabName) {
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("securityModule").hidden = true;
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("schoolModule").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    if (window.SchoolSafeSchoolModule) {
      window.SchoolSafeSchoolModule.render(tabName);
    }
    document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeSchoolModule() {
    document.getElementById("schoolModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
  }

  function financeTotals() {
    var expected = financeState.students.reduce(function (sum, student) { return sum + student.expected; }, 0);
    var paid = financeState.students.reduce(function (sum, student) { return sum + student.paid; }, 0);
    var balance = financeState.students.reduce(function (sum, student) { return sum + student.balance; }, 0);
    var today = financeState.transactions.filter(function (transaction) { return transaction.day === "14 août 2026" && transaction.status !== "Annulé"; });
    return { expected: expected, paid: paid, balance: balance, rate: expected ? Math.round(paid / expected * 100) : 0, today: today, todayTotal: today.reduce(function (sum, transaction) { return sum + transaction.amount; }, 0) };
  }

  function renderFinanceOverview() {
    var totals = financeTotals();
    var recent = financeState.transactions.slice(0, 5).map(function (transaction) {
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b><small>' + escapeMarkup(transaction.date) + '</small></td><td>' + escapeMarkup(transaction.student) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + money(transaction.amount) + '</b></td><td><span class="case-status ' + certificationStatusClass(transaction.status) + '">' + escapeMarkup(transaction.status) + '</span></td></tr>';
    }).join("");
    return '<section class="finance-overview"><header><div><span>Pilotage financier</span><h3>Situation enregistrée par l’école</h3><p>Les chiffres proviennent des opérations consignées dans cette démonstration locale.</p></div><span class="recording-only"><i data-lucide="hand-coins"></i> Aucun paiement en ligne</span></header><div class="finance-kpis"><article class="blue"><small>Frais attendus</small><b>' + money(totals.expected) + '</b><span>' + financeState.students.length + ' élèves suivis</span></article><article class="green"><small>Montants enregistrés</small><b>' + money(totals.paid) + '</b><span>' + totals.rate + ' % de recouvrement</span></article><article class="gold"><small>Soldes à régulariser</small><b>' + money(totals.balance) + '</b><span>' + financeState.students.filter(function (student) { return student.balance > 0; }).length + ' dossiers</span></article><article class="purple"><small>Encaissements du jour</small><b>' + money(totals.todayTotal) + '</b><span>' + totals.today.length + ' opérations</span></article></div><div class="finance-overview-grid"><section class="finance-panel"><header><div><span>Activité récente</span><h3>Derniers enregistrements</h3></div><button class="icon-button light" type="button" data-finance-open="receipts" title="Voir les reçus"><i data-lucide="arrow-right"></i></button></header><div class="table-scroll"><table class="finance-table"><thead><tr><th>Reçu</th><th>Élève</th><th>Mode constaté</th><th>Montant</th><th>Statut</th></tr></thead><tbody>' + recent + '</tbody></table></div></section><aside class="finance-control"><span><i data-lucide="shield-check"></i></span><h3>Contrôle de la journée</h3><dl><div><dt>Caisse</dt><dd>' + escapeMarkup(financeState.dayStatus) + '</dd></div><div><dt>Dépenses à approuver</dt><dd>' + financeState.expenses.filter(function (expense) { return expense.status === "À approuver"; }).length + '</dd></div><div><dt>Annulations demandées</dt><dd>' + financeState.transactions.filter(function (transaction) { return transaction.status === "Annulation demandée"; }).length + '</dd></div></dl><button class="secondary-button" type="button" data-finance-open="reports"><i data-lucide="file-chart-column"></i> Ouvrir les rapports</button></aside></div></section>';
  }

  function renderFeeStructure() {
    var canEdit = currentDemoRole === "admin" || currentDemoRole === "finance";
    var rows = financeState.feeTypes.map(function (fee, index) {
      return '<tr><td><b>' + escapeMarkup(fee.name) + '</b></td><td>' + escapeMarkup(fee.cycle) + '</td><td><b>' + money(fee.amount) + '</b></td><td>' + escapeMarkup(fee.frequency) + '</td><td>' + escapeMarkup(fee.due) + '</td><td><span class="case-status ' + (fee.active ? "done" : "pending") + '">' + (fee.active ? "Actif" : "Désactivé") + '</span></td><td>' + (canEdit ? '<button class="icon-button light" type="button" data-toggle-fee="' + index + '" title="Activer ou désactiver"><i data-lucide="power"></i></button>' : "") + '</td></tr>';
    }).join("");
    var form = canEdit ? '<form class="finance-fee-form" id="financeFeeForm"><header><span><i data-lucide="circle-plus"></i></span><div><h3>Ajouter un type de frais</h3><p>Le montant est configuré par l’école. Aucun prélèvement n’est effectué.</p></div></header><div><label>Libellé<input name="name" required placeholder="Ex. Frais scolaires"></label><label>Cycle ou service<input name="cycle" required placeholder="Ex. Primaire"></label><label>Montant en FC<input name="amount" required type="number" min="0" step="1000"></label><label>Périodicité<select name="frequency"><option>Une fois</option><option>Mois</option><option>Trimestre</option><option>Semestre</option><option>Année</option></select></label><label class="wide">Échéance<input name="due" required placeholder="Date ou règle d’échéance"></label></div><button class="primary-button dark" type="submit"><i data-lucide="save"></i> Enregistrer le type de frais</button></form>' : '<aside class="finance-readonly"><i data-lucide="eye"></i><p>Consultation uniquement. La structure des frais est modifiée par le Responsable financier ou l’Administrateur principal.</p></aside>';
    return '<div class="finance-two-column"><section class="finance-panel"><header><div><span>Paramétrage</span><h3>Structure des frais</h3></div><b>' + financeState.feeTypes.length + '</b></header><div class="table-scroll"><table class="finance-table"><thead><tr><th>Frais</th><th>Cycle</th><th>Montant</th><th>Périodicité</th><th>Échéance</th><th>Statut</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' + form + '</div>';
  }

  function renderCash() {
    var student = financeState.students[financeState.selectedStudent] || financeState.students[0];
    var canRecord = (currentDemoRole === "cashier" || currentDemoRole === "admin") && financeState.dayStatus === "Ouverte";
    var studentOptions = financeState.students.map(function (item, index) {
      return '<option value="' + index + '"' + (index === financeState.selectedStudent ? " selected" : "") + '>' + escapeMarkup(item.name + " · " + item.className) + '</option>';
    }).join("");
    var feeOptions = financeState.feeTypes.filter(function (fee) { return fee.active; }).map(function (fee) {
      return '<option>' + escapeMarkup(fee.name + " · " + fee.cycle) + '</option>';
    }).join("");
    var todayRows = financeTotals().today.map(function (transaction, index) {
      var pdfAction = transaction.status === "Validé" ? '<button class="icon-button light" type="button" data-export-receipt="' + financeState.transactions.indexOf(transaction) + '" title="Télécharger le reçu PDF"><i data-lucide="file-down"></i></button>' : '<span class="receipt-waiting"><i data-lucide="clock-3"></i> Après synchronisation</span>';
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b><small>' + escapeMarkup(transaction.date.split(" · ").pop()) + '</small></td><td>' + escapeMarkup(transaction.student) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + money(transaction.amount) + '</b></td><td><span class="case-status ' + certificationStatusClass(transaction.status) + '">' + escapeMarkup(transaction.status) + '</span></td><td>' + pdfAction + '</td></tr>';
    }).join("") || '<tr><td colspan="6">Aucune opération enregistrée aujourd’hui.</td></tr>';
    var paymentForm = canRecord ? '<form class="payment-form" id="paymentForm"><header><span><i data-lucide="hand-coins"></i></span><div><h3>Enregistrer une tranche</h3><p>L’argent est reçu hors de SchoolSafe; cette action consigne uniquement l’opération.</p></div></header><div><label>Type de frais<select name="fee" required>' + feeOptions + '</select></label><label>Montant reçu en FC<input name="amount" type="number" min="1000" max="' + student.balance + '" step="1000" required placeholder="Montant"></label><label>Mode constaté<select name="mode"><option>Espèces</option><option>Virement constaté</option><option>Autre moyen constaté</option></select></label><label>Référence ou observation<input name="reference" required placeholder="Ex. Deuxième tranche"></label></div><button class="primary-button dark" type="submit"' + (student.balance <= 0 ? " disabled" : "") + '><i data-lucide="badge-check"></i> Enregistrer et préparer le reçu</button></form>' : '<aside class="finance-readonly"><i data-lucide="' + (financeState.dayStatus === "Ouverte" ? "eye" : "lock-keyhole") + '"></i><p>' + (financeState.dayStatus === "Ouverte" ? "Consultation et contrôle uniquement. Les encaissements sont exécutés par l’Agent de caisse autorisé." : "La journée a été soumise. Aucun nouvel encaissement ne peut être ajouté dans cet aperçu.") + '</p></aside>';
    return '<div class="cash-workspace"><section class="cashier-layout"><section class="finance-panel student-finance-panel"><header><div><span>Recherche du dossier</span><h3>Situation de l’élève</h3></div><span class="case-status ' + certificationStatusClass(student.status) + '">' + escapeMarkup(student.status) + '</span></header><label class="finance-student-picker">Élève<select id="financeStudentSelect">' + studentOptions + '</select></label><article class="student-finance-card"><span class="student-avatar large">' + student.initials + '</span><div><small>' + escapeMarkup(student.className + " · " + student.sex) + '</small><h3>' + escapeMarkup(student.name) + '</h3><p>' + escapeMarkup(student.guardian) + '</p></div></article><dl class="student-finance-facts"><div><dt>Frais attendus</dt><dd>' + money(student.expected) + '</dd></div><div><dt>Enregistré</dt><dd>' + money(student.paid) + '</dd></div><div><dt>Solde</dt><dd>' + money(student.balance) + '</dd></div></dl></section>' + paymentForm + '</section><section class="finance-panel"><header><div><span>Journal de caisse</span><h3>Opérations du jour</h3></div><b>' + money(financeTotals().todayTotal) + '</b></header><div class="table-scroll"><table class="finance-table"><thead><tr><th>Reçu</th><th>Élève</th><th>Mode constaté</th><th>Montant</th><th>Statut</th><th>PDF</th></tr></thead><tbody>' + todayRows + '</tbody></table></div></section></div>';
  }

  function renderReceipts() {
    var canRequestCancellation = currentDemoRole === "cashier" || currentDemoRole === "admin";
    var rows = financeState.transactions.map(function (transaction, index) {
      var cancellationButton = canRequestCancellation && transaction.status === "Validé" ? '<button class="icon-button light danger" type="button" data-request-cancel="' + index + '" title="Demander l’annulation"><i data-lucide="circle-x"></i></button>' : "";
      var receiptAction = transaction.status === "Validé" ? '<button class="icon-button light" type="button" data-export-receipt="' + index + '" title="Télécharger le reçu PDF"><i data-lucide="file-down"></i></button>' : '<span class="receipt-waiting"><i data-lucide="clock-3"></i> PDF après synchronisation</span>';
      return '<tr><td><b>' + escapeMarkup(transaction.receipt) + '</b><small>' + escapeMarkup(transaction.date) + '</small></td><td><b>' + escapeMarkup(transaction.student) + '</b><small>' + escapeMarkup(transaction.className) + '</small></td><td>' + escapeMarkup(transaction.fee) + '</td><td>' + escapeMarkup(transaction.mode) + '</td><td><b>' + money(transaction.amount) + '</b></td><td><span class="case-status ' + certificationStatusClass(transaction.status) + '">' + escapeMarkup(transaction.status) + '</span></td><td><div class="finance-row-actions">' + receiptAction + cancellationButton + '</div></td></tr>';
    }).join("");
    return '<section class="finance-panel receipt-register"><header><div><span>Documents financiers</span><h3>Reçus et opérations</h3><p>Un reçu reste traçable même lorsqu’une annulation est demandée.</p></div><span class="recording-only"><i data-lucide="shield-check"></i> PDF avec logo</span></header><aside class="finance-audit-note"><i data-lucide="history"></i><p>Une demande d’annulation ne supprime jamais l’écriture. Elle doit être contrôlée et approuvée dans le circuit financier.</p></aside><div class="table-scroll"><table class="finance-table"><thead><tr><th>Reçu</th><th>Élève</th><th>Frais</th><th>Mode constaté</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function renderBalances() {
    var statusOnly = currentDemoRole === "pedagogy";
    var inOrder = financeState.students.filter(function (student) { return student.balance === 0; }).length;
    var rows = financeState.students.map(function (student) {
      if (statusOnly) return '<tr><td><span class="student-avatar">' + student.initials + '</span><b>' + escapeMarkup(student.name) + '</b></td><td>' + escapeMarkup(student.className) + '</td><td>' + escapeMarkup(student.sex) + '</td><td><span class="case-status ' + certificationStatusClass(student.status) + '">' + escapeMarkup(student.status) + '</span></td></tr>';
      return '<tr><td><span class="student-avatar">' + student.initials + '</span><b>' + escapeMarkup(student.name) + '</b><small>' + escapeMarkup(student.guardian) + '</small></td><td>' + escapeMarkup(student.className) + '</td><td><b>' + money(student.expected) + '</b></td><td>' + money(student.paid) + '</td><td><b>' + money(student.balance) + '</b></td><td><span class="case-status ' + certificationStatusClass(student.status) + '">' + escapeMarkup(student.status) + '</span></td></tr>';
    }).join("");
    var heading = statusOnly ? '<aside class="finance-status-boundary"><i data-lucide="shield-check"></i><div><b>Attribution administrative limitée</b><p>Le Responsable pédagogique voit uniquement l’identité scolaire, la classe et le statut. Montants, paiements, reçus et trésorerie restent masqués.</p></div></aside>' : '<div class="balance-summary"><article><small>Élèves en ordre</small><b>' + inOrder + '</b></article><article><small>À régulariser</small><b>' + (financeState.students.length - inOrder) + '</b></article><article><small>Taux des dossiers en ordre</small><b>' + Math.round(inOrder / financeState.students.length * 100) + ' %</b></article></div>';
    var tableHead = statusOnly ? '<tr><th>Élève</th><th>Classe</th><th>Sexe</th><th>Statut administratif</th></tr>' : '<tr><th>Élève</th><th>Classe</th><th>Frais attendus</th><th>Enregistré</th><th>Solde</th><th>Statut</th></tr>';
    return '<section class="finance-panel balance-register"><header><div><span>' + (statusOnly ? "Suivi scolaire autorisé" : "Recouvrement") + '</span><h3>' + (statusOnly ? "Régularité des élèves" : "Impayés et soldes") + '</h3><p>' + (statusOnly ? "Aucun chiffre financier n’est exposé dans ce profil." : "Situation calculée à partir des opérations enregistrées par l’école.") + '</p></div><b>' + financeState.students.length + ' dossiers</b></header>' + heading + '<div class="table-scroll"><table class="finance-table' + (statusOnly ? " status-only-table" : "") + '"><thead>' + tableHead + '</thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function renderReports() {
    var totals = financeTotals();
    var validatedExpenses = financeState.expenses.filter(function (expense) { return expense.status === "Validée"; });
    var expenseTotal = validatedExpenses.reduce(function (sum, expense) { return sum + expense.amount; }, 0);
    var cashTotal = totals.today.filter(function (transaction) { return transaction.mode === "Espèces"; }).reduce(function (sum, transaction) { return sum + transaction.amount; }, 0);
    var otherTotal = totals.todayTotal - cashTotal;
    var expenses = financeState.expenses.map(function (expense) {
      return '<tr><td><b>' + escapeMarkup(expense.reference) + '</b></td><td>' + escapeMarkup(expense.date) + '</td><td>' + escapeMarkup(expense.label) + '</td><td><b>' + money(expense.amount) + '</b></td><td><span class="case-status ' + certificationStatusClass(expense.status) + '">' + escapeMarkup(expense.status) + '</span></td></tr>';
    }).join("");
    var canSubmit = currentDemoRole === "cashier" && financeState.dayStatus === "Ouverte";
    return '<div class="finance-reports"><header class="finance-report-head"><div><span>Contrôle et clôture</span><h3>Rapport de caisse du 14 août 2026</h3><p>État local préparé pour contrôle; il ne prouve aucun déploiement comptable ou bancaire.</p></div><div><button class="secondary-button" type="button" id="exportCashReport"><i data-lucide="file-down"></i> Télécharger le rapport PDF</button>' + (canSubmit ? '<button class="primary-button dark" type="button" id="submitCashDay"><i data-lucide="send"></i> Soumettre la journée</button>' : '<span class="closure-chip"><i data-lucide="' + (financeState.dayStatus === "Soumise" ? "lock-keyhole" : "eye") + '"></i>' + escapeMarkup(financeState.dayStatus) + '</span>') + '</div></header><div class="finance-kpis report-kpis"><article class="blue"><small>Encaissements</small><b>' + money(totals.todayTotal) + '</b><span>' + totals.today.length + ' opérations</span></article><article class="green"><small>Espèces constatées</small><b>' + money(cashTotal) + '</b><span>À rapprocher physiquement</span></article><article class="purple"><small>Autres moyens constatés</small><b>' + money(otherTotal) + '</b><span>Références conservées</span></article><article class="gold"><small>Net après dépenses validées</small><b>' + money(totals.todayTotal - expenseTotal) + '</b><span>' + money(expenseTotal) + ' de dépenses</span></article></div><section class="finance-panel"><header><div><span>Pièces de la journée</span><h3>Recettes et dépenses</h3></div><b>' + financeState.expenses.length + ' dépenses</b></header><div class="table-scroll"><table class="finance-table"><thead><tr><th>Référence</th><th>Date</th><th>Libellé</th><th>Montant</th><th>Statut</th></tr></thead><tbody>' + expenses + '</tbody></table></div></section><aside class="finance-audit-note"><i data-lucide="list-checks"></i><p>La soumission fige cet aperçu local pour contrôle. Une clôture définitive devra suivre les permissions, validations et règles comptables de l’école.</p></aside></div>';
  }

  function renderFamilyFinance() {
    var children = financeState.students.filter(function (student) { return student.guardian === "Mme Sophie Martin"; });
    if (financeState.selectedFamilyStudent >= children.length) financeState.selectedFamilyStudent = 0;
    var student = children[financeState.selectedFamilyStudent];
    var options = children.map(function (item, index) { return '<option value="' + index + '"' + (index === financeState.selectedFamilyStudent ? " selected" : "") + '>' + escapeMarkup(item.name + " · " + item.className) + '</option>'; }).join("");
    var receipts = financeState.transactions.map(function (transaction, index) { return { transaction: transaction, index: index }; }).filter(function (entry) { return entry.transaction.student === student.name; });
    var receiptCards = receipts.map(function (entry) {
      var transaction = entry.transaction;
      var receiptButton = transaction.status === "Validé" ? '<button class="icon-button light" type="button" data-export-receipt="' + entry.index + '" title="Télécharger le reçu PDF"><i data-lucide="file-down"></i></button>' : '<span class="receipt-waiting"><i data-lucide="clock-3"></i></span>';
      return '<article class="family-receipt"><span><i data-lucide="receipt-text"></i></span><div><small>' + escapeMarkup(transaction.date) + '</small><b>' + escapeMarkup(transaction.receipt) + '</b><p>' + escapeMarkup(transaction.fee + " · " + transaction.mode) + '</p></div><strong>' + money(transaction.amount) + '</strong>' + receiptButton + '</article>';
    }).join("") || '<p class="finance-empty">Aucun reçu n’est encore rattaché à cet enfant.</p>';
    return '<div class="family-finance"><header><div><span>Situation familiale</span><h3>Frais scolaires et reçus</h3><p>Vous voyez uniquement les enfants rattachés à votre profil.</p></div><span class="recording-only"><i data-lucide="shield-check"></i> Aucun paiement en ligne</span></header><label class="family-student-picker">Enfant suivi<select id="familyFinanceStudent">' + options + '</select></label><section class="family-finance-summary"><div><span class="student-avatar large">' + student.initials + '</span><div><small>' + escapeMarkup(student.className) + '</small><h3>' + escapeMarkup(student.name) + '</h3><p>' + escapeMarkup(student.status) + '</p></div></div><article><small>Frais attendus</small><b>' + money(student.expected) + '</b></article><article><small>Montants enregistrés</small><b>' + money(student.paid) + '</b></article><article><small>Solde restant</small><b>' + money(student.balance) + '</b></article></section><aside class="family-result-status ' + (student.balance === 0 ? "ready" : "pending") + '"><i data-lucide="' + (student.balance === 0 ? "badge-check" : "file-lock-2") + '"></i><div><b>Résultat officiel de fin de période</b><p>' + (student.balance === 0 ? "Situation en ordre. La publication reste soumise à la validation pédagogique et à la décision de la Direction." : "Le suivi quotidien reste visible. Le résultat officiel de fin de période reste suspendu jusqu’à la décision administrative.") + '</p></div></aside><section class="family-receipts"><header><h3>Reçus disponibles</h3><span>' + receipts.length + ' document(s)</span></header>' + receiptCards + '</section></div>';
  }

  function renderFinanceModule() {
    var allowedTabs = financeTabsForRole();
    if (allowedTabs.indexOf(financeState.activeTab) === -1) financeState.activeTab = allowedTabs[0];
    var titles = { overview: "Pilotage financier", fees: "Structure des frais", cash: "Encaissements", receipts: "Reçus", balances: "Soldes et régularité", reports: "Rapports de caisse", family: "Situation familiale" };
    document.getElementById("financeModuleTitle").textContent = titles[financeState.activeTab];
    document.getElementById("workspaceTitle").textContent = titles[financeState.activeTab];
    document.querySelectorAll("#financeTabs [data-finance-tab]").forEach(function (button) {
      var tab = button.getAttribute("data-finance-tab");
      button.hidden = allowedTabs.indexOf(tab) === -1;
      button.classList.toggle("active", tab === financeState.activeTab);
    });
    var renderers = { overview: renderFinanceOverview, fees: renderFeeStructure, cash: renderCash, receipts: renderReceipts, balances: renderBalances, reports: renderReports, family: renderFamilyFinance };
    document.getElementById("financeContent").innerHTML = renderers[financeState.activeTab]();
    bindFinanceEvents();
    icons();
  }

  function bindFinanceEvents() {
    document.querySelectorAll("[data-finance-open]").forEach(function (button) {
      button.addEventListener("click", function () { financeState.activeTab = button.getAttribute("data-finance-open"); renderFinanceModule(); });
    });
    var studentSelect = document.getElementById("financeStudentSelect");
    if (studentSelect) studentSelect.addEventListener("change", function () { financeState.selectedStudent = Number(this.value); renderFinanceModule(); });
    var familySelect = document.getElementById("familyFinanceStudent");
    if (familySelect) familySelect.addEventListener("change", function () { financeState.selectedFamilyStudent = Number(this.value); renderFinanceModule(); });
    var feeForm = document.getElementById("financeFeeForm");
    if (feeForm) feeForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(feeForm);
      var input = {
        cycle_key: data.get("cycle") === "Primaire" ? "primary" : data.get("cycle") === "Humanités" ? "secondary" : "primary",
        label: data.get("name"),
        amount: Number(data.get("amount")),
        currency: "CDF",
        due_date: data.get("due") || undefined,
        is_active: true
      };
      apiPostAuth("/finance/fee-structures", input).then(function () {
        notify("Type de frais enregistré sur le serveur.");
        financeState.loaded = false;
        return loadFinanceData();
      }).then(function () {
        renderFinanceModule();
      }).catch(function (err) {
        console.warn("[Finance] création frais échouée", err);
        financeState.feeTypes.push({ id: "local-" + Date.now(), name: data.get("name"), cycle: data.get("cycle"), amount: Number(data.get("amount")), frequency: data.get("frequency"), due: data.get("due"), active: true });
        queueOfflineOperation("finance", "Création d’un type de frais · " + data.get("name"), { kind: "fee-type-create", name: data.get("name"), cycle: data.get("cycle"), amount: Number(data.get("amount")) });
        notify("Type de frais conservé localement.");
        renderFinanceModule();
      });
    });
    document.querySelectorAll("[data-toggle-fee]").forEach(function (button) {
      button.addEventListener("click", function () { var fee = financeState.feeTypes[Number(button.getAttribute("data-toggle-fee"))]; fee.active = !fee.active; queueOfflineOperation("finance", "Modification d’un type de frais · " + fee.name, { kind: "fee-type-status", name: fee.name, active: fee.active }); renderFinanceModule(); });
    });
    var paymentForm = document.getElementById("paymentForm");
    if (paymentForm) paymentForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var student = financeState.students[financeState.selectedStudent];
      var data = new FormData(paymentForm);
      var amount = Number(data.get("amount"));
      if (!amount || amount <= 0 || amount > student.balance) { notify("Le montant doit être positif et ne pas dépasser le solde de l’élève."); return; }
      var studentFeeId = student.id;
      var mode = data.get("mode");
      var reference = data.get("reference");
      apiPostAuth("/finance/payments", {
        student_fee_id: studentFeeId,
        amount: amount,
        currency: student.currency || "CDF",
        metadata: { mode: mode, reference: reference }
      }).then(function (res) {
        notify("Paiement enregistré sur le serveur.");
        financeState.loaded = false;
        return loadFinanceData();
      }).then(function () {
        financeState.activeTab = "receipts";
        renderFinanceModule();
      }).catch(function (err) {
        console.warn("[Finance] paiement backend échoué", err);
        student.paid += amount;
        student.balance = Math.max(0, student.expected - student.paid);
        student.status = student.balance === 0 ? "En ordre" : "À régulariser";
        var localReference = "PAY-LOCAL-" + Date.now();
        financeState.transactions.unshift({ receipt: "Après synchronisation", date: "14 août 2026 · enregistré sur cet appareil", day: "14 août 2026", student: student.name, className: student.className, fee: String(data.get("fee")).split(" · ")[0], amount: amount, mode: mode, cashier: "Mme K", reference: reference, status: "En attente de synchronisation", localReference: localReference });
        queueOfflineOperation("finance", "Paiement de " + student.name, {
          kind: "payment",
          localReference: localReference,
          student: student.name,
          amount: amount,
          fee: String(data.get("fee")).split(" · ")[0]
        }).then(function (operation) {
          if (operation && financeState.transactions[0] && financeState.transactions[0].localReference === localReference) financeState.transactions[0].syncOperationId = operation.id;
        });
        financeState.activeTab = "receipts";
        notify(navigator.onLine ? "Paiement consigné. Le reçu sera produit après confirmation." : "Paiement conservé sur cet appareil. Le reçu sera produit au retour de la connexion.");
        renderFinanceModule();
      });
    });
    document.querySelectorAll("[data-export-receipt]").forEach(function (button) {
      button.addEventListener("click", function () { exportReceiptPdf(Number(button.getAttribute("data-export-receipt"))); });
    });
    document.querySelectorAll("[data-request-cancel]").forEach(function (button) {
      button.addEventListener("click", function () {
        var transaction = financeState.transactions[Number(button.getAttribute("data-request-cancel"))];
        if (transaction && transaction.status === "Validé") transaction.status = "Annulation demandée";
        if (transaction) queueOfflineOperation("finance", "Demande d’annulation " + transaction.receipt, { kind: "cancellation-request", receipt: transaction.receipt, reasonRequired: true });
        notify("Demande d’annulation enregistrée sans suppression de l’écriture.");
        renderFinanceModule();
      });
    });
    var exportReport = document.getElementById("exportCashReport");
    if (exportReport) exportReport.addEventListener("click", exportCashReportPdf);
    var submitDay = document.getElementById("submitCashDay");
    if (submitDay) submitDay.addEventListener("click", function () { financeState.dayStatus = "Soumise"; queueOfflineOperation("finance", "Soumission de la journée de caisse", { kind: "cash-day-submission" }); notify("Journée soumise localement pour contrôle."); renderFinanceModule(); });
  }

  function pdfLibrary() {
    return window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
  }

  function pdfDocumentText(value) {
    if (typeof value !== "string" || !window.SchoolSafeI18n) return value;
    var mode = window.SchoolSafeI18n.documentLanguage();
    var english = window.SchoolSafeI18n.translateText(value, "en");
    var prefixTranslations = [
      ["Statut :", "Status:"], ["Classe :", "Class:"], ["Numéro :", "Number:"], ["Centre :", "Center:"],
      ["Enseignant :", "Teacher:"], ["Nom de l’élève :", "Student name:"], ["Matricule :", "Student ID:"],
      ["Journée du", "Day of"], ["candidat(s) dans cet export.", "candidate(s) in this export."],
      ["École de démonstration SchoolSafe", "SchoolSafe demonstration school"],
      ["Adresse physique de l’école à configurer", "School address to configure"],
      ["E-mail de l’école à configurer", "School email to configure"],
      ["Site internet de l’école à configurer", "School website to configure"],
      ["APERÇU NON OFFICIEL · IDENTITÉ DE L’ÉCOLE À CONFIGURER", "UNOFFICIAL PREVIEW · SCHOOL IDENTITY TO CONFIGURE"],
      ["Mathématiques", "Mathematics"], ["Devoir", "Assignment"], ["Interrogation", "Quiz"],
      ["Examen", "Exam"], ["Activité compensatoire", "Make-up activity"], [" · suite", " · continued"]
    ];
    prefixTranslations.forEach(function (pair) { english = english.replace(pair[0], pair[1]); });
    if (mode === "en") return english;
    if (mode === "bilingual" && english !== value) return value + " / " + english;
    return value;
  }

  function configurePdfLanguage(doc) {
    var originalText = doc.text.bind(doc);
    var originalSplit = doc.splitTextToSize.bind(doc);
    doc.text = function (text) {
      var args = Array.prototype.slice.call(arguments, 1);
      var translated = Array.isArray(text) ? text.map(pdfDocumentText) : pdfDocumentText(text);
      return originalText.apply(doc, [translated].concat(args));
    };
    doc.splitTextToSize = function (text) {
      var args = Array.prototype.slice.call(arguments, 1);
      return originalSplit.apply(doc, [pdfDocumentText(text)].concat(args));
    };
    return doc;
  }

  function pdfSchoolIdentity() {
    return {
      name: state && state.schoolName ? state.schoolName : "École de démonstration SchoolSafe",
      legalName: state && state.legalName ? state.legalName : "Instance locale non configurée",
      email: state && state.email ? state.email : "E-mail de l’école à configurer",
      address: state && state.address ? state.address + ", " + (state.city || "") : "Adresse physique de l’école à configurer",
      website: state && (state.websiteAddress || state.website) ? (state.websiteAddress || state.website) : "Site internet de l’école à configurer",
      official: Boolean(state && state.schoolName && state.email && state.address && state.officialLogoData)
    };
  }

  function loadPdfLogo() {
    return new Promise(function (resolve) {
      var image = new Image();
      image.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = function () { resolve(""); };
      image.src = state && state.officialLogoData ? state.officialLogoData : "schoolsafe-logo.png";
    });
  }

  function sanitizeFilename(value) {
    return String(value || "schoolsafe").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  }

  function pdfHeader(doc, identity, logo, title, subtitle) {
    doc.setFillColor(7, 26, 61);
    doc.rect(0, 0, 210, 34, "F");
    if (logo) doc.addImage(logo, "PNG", 12, 5, 24, 24);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(identity.name, 42, 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(identity.address + " | " + identity.email, 150), 42, 18);
    doc.text(identity.website, 42, 28);
    doc.setTextColor(7, 26, 61);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, 14, 47);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(83, 96, 119);
    doc.text(subtitle, 14, 53);
    if (!identity.official) {
      doc.setTextColor(180, 55, 50);
      doc.setFont("helvetica", "bold");
      doc.text("APERÇU NON OFFICIEL · IDENTITÉ DE L’ÉCOLE À CONFIGURER", 196, 47, { align: "right" });
    }
    doc.setDrawColor(220, 226, 236);
    doc.line(14, 57, 196, 57);
  }

  function pdfFooter(doc, identity) {
    var pages = doc.getNumberOfPages();
    for (var page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(220, 226, 236);
      doc.line(14, 285, 196, 285);
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 128);
      doc.text("SchoolSafe by PRODELI SARLU · www.schoolsafe1.com", 14, 290);
      doc.text("Page " + page + " / " + pages, 196, 290, { align: "right" });
    }
  }

  function drawTableHeader(doc, columns, y) {
    doc.setFillColor(235, 240, 247);
    doc.rect(14, y, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(45, 57, 78);
    columns.forEach(function (column) { doc.text(column.label, column.x, y + 5); });
    return y + 10;
  }

  async function exportReceiptPdf(transactionIndex) {
    var transaction = financeState.transactions[transactionIndex];
    if (!transaction) { notify("Ce reçu est introuvable."); return; }
    if (transaction.status !== "Validé") { notify("Le reçu officiel sera disponible après confirmation de la synchronisation."); return; }

    function fallbackCanViewReceipt() {
      if (currentDemoRole === "admin" || currentDemoRole === "finance" || currentDemoRole === "cashier" || currentDemoRole === "school_head") return true;
      if (currentDemoRole === "parent") {
        var children = financeState.students.filter(function (s) { return s.guardian === "Mme Sophie Martin"; });
        var childNames = children.map(function (s) { return s.name; });
        return childNames.indexOf(transaction.student) !== -1;
      }
      return false;
    }

    async function checkAuthorization() {
      var client = getSupabaseClient();
      if (!client) return fallbackCanViewReceipt();
      try {
        var permResult = await client.rpc("has_permission", { permission_code: "finance.receipts.view" });
        if (permResult.error || !permResult.data) return false;
        var studentRecord = financeState.students.find(function (s) { return s.name === transaction.student; });
        var studentId = transaction.student_id || (studentRecord && studentRecord.student_id) || null;
        var scopeResult = await client.rpc("has_scope", {
          requested_scope_type: "student",
          requested_scope_id: studentId,
        });
        return scopeResult.data === true;
      } catch (e) {
        return fallbackCanViewReceipt();
      }
    }

    var authorized = await checkAuthorization();
    if (!authorized) {
      notify("Vous n’avez pas le droit de consulter ce reçu.");
      return;
    }

    try {
      var engine = await import("./modules/document-engine/index.js");
      var identity = await engine.createSchoolIdentityProvider(window.SchoolSafeSchoolAPI).load();

      function deriveSchoolId() {
        if (currentSession && currentSession.school && currentSession.school.id) return currentSession.school.id;
        return "";
      }
      var schoolId = deriveSchoolId();

      var receiptNumber;
      var client = getSupabaseClient();
      if (client && schoolId) {
        try {
          receiptNumber = await engine.createDocumentNumberingService(client, schoolId).nextNumber("receipt", "REC-");
        } catch (numErr) {
          console.warn("[Finance] document numbering failed, using existing receipt number", numErr);
          receiptNumber = transaction.receipt;
        }
      } else {
        receiptNumber = transaction.receipt;
      }

      function parseStudentName(fullName) {
        var parts = String(fullName || "").trim().split(/\s+/);
        if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
        return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
      }

      function parseTransactionDate(dateStr) {
        if (!dateStr) return new Date();
        var match = String(dateStr).match(/(\d{1,2})\s+([a-zA-Zàâäéèêëïîôöùûüç\s]+)\s+(\d{4})/);
        if (!match) return new Date();
        var monthMap = { janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11 };
        var month = monthMap[match[2].toLowerCase().trim()];
        if (month == null) return new Date();
        return new Date(Number(match[3]), month, Number(match[1]));
      }

      var nameParts = parseStudentName(transaction.student);
      var studentRecord = financeState.students.find(function (s) { return s.name === transaction.student; });
      var amountExpected = studentRecord ? studentRecord.expected : transaction.amount;
      var amountPaid = transaction.amount;
      var remaining = Math.max(0, amountExpected - amountPaid);

      var payment = {
        student: {
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          matricule: (studentRecord && studentRecord.matricule) || null,
          className: transaction.className || null,
        },
        feeLabel: transaction.fee || "",
        period: "",
        amountExpected: amountExpected,
        amountPaid: amountPaid,
        remaining: remaining,
        currency: identity.currency || "USD",
        paymentMode: transaction.mode || "",
        reference: transaction.reference || "",
        paidAt: parseTransactionDate(transaction.date),
        cashierName: transaction.cashier || "",
        verificationCode: receiptNumber,
      };

      var doc = await engine.renderReceipt(identity, payment, receiptNumber);
      var blob = doc.output("blob");
      var url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      notify("Reçu PDF ouvert dans un nouvel onglet.");

      var auditClient = getSupabaseClient();
      if (auditClient && schoolId) {
        var auditStudentId = transaction.student_id || (studentRecord && studentRecord.student_id) || null;
        auditClient.from("audit_events").insert({
          school_id: schoolId,
          event_type: "finance.receipt.generated",
          actor_profile_id: (currentSession && currentSession.profile && currentSession.profile.id) || (currentSession && currentSession.user && currentSession.user.id) || null,
          payload: {
            document_type: "receipt",
            document_number: receiptNumber,
            generated_at: new Date().toISOString(),
            entity_type: "student",
            entity_id: auditStudentId
          }
        }).then(function () {
          // Audit event logged successfully.
        }).catch(function (auditErr) {
          console.warn("[Finance] audit event insert failed", auditErr);
        });
      }
    } catch (e) {
      console.error("[Finance] receipt generation failed", e);
      notify("Erreur lors de la génération du reçu : " + (e.message || "erreur inconnue"));
    }
  }

  async function exportCashReportPdf() {
    var JsPdf = pdfLibrary();
    if (!JsPdf) { notify("Le générateur PDF n’est pas disponible."); return; }
    var identity = pdfSchoolIdentity();
    var logo = await loadPdfLogo();
    var doc = configurePdfLanguage(new JsPdf({ unit: "mm", format: "a4" }));
    var totals = financeTotals();
    var validatedExpenses = financeState.expenses.filter(function (expense) { return expense.status === "Validée"; });
    var expenseTotal = validatedExpenses.reduce(function (sum, expense) { return sum + expense.amount; }, 0);
    pdfHeader(doc, identity, logo, "Rapport de caisse", "Journée du 14 août 2026 · Statut : " + financeState.dayStatus);
    var metricData = [["Encaissements", totals.todayTotal, 7, 100, 194], ["Dépenses validées", expenseTotal, 8, 122, 85], ["Net de la journée", totals.todayTotal - expenseTotal, 155, 100, 0]];
    metricData.forEach(function (metric, index) {
      var x = 14 + index * 62;
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(x, 65, 58, 25, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(83, 96, 119);
      doc.text(metric[0], x + 5, 73);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(metric[2], metric[3], metric[4]);
      doc.text(money(metric[1]), x + 5, 84);
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(7, 48, 112);
    doc.text("Opérations enregistrées", 14, 104);
    var transactionColumns = [{ label: "Reçu", x: 16 }, { label: "Élève", x: 48 }, { label: "Mode", x: 102 }, { label: "Montant", x: 151 }, { label: "Statut", x: 177 }];
    var y = drawTableHeader(doc, transactionColumns, 109);
    totals.today.forEach(function (transaction) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(38, 50, 73);
      doc.text(transaction.receipt, 16, y + 4);
      doc.text(transaction.student, 48, y + 4);
      doc.text(transaction.mode, 102, y + 4);
      doc.text(money(transaction.amount), 151, y + 4);
      doc.text(transaction.status, 177, y + 4);
      doc.setDrawColor(230, 234, 241);
      doc.line(14, y + 8, 196, y + 8);
      y += 11;
    });
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(7, 48, 112);
    doc.text("Dépenses consignées", 14, y);
    var expenseColumns = [{ label: "Référence", x: 16 }, { label: "Libellé", x: 58 }, { label: "Montant", x: 145 }, { label: "Statut", x: 176 }];
    y = drawTableHeader(doc, expenseColumns, y + 5);
    financeState.expenses.forEach(function (expense) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(38, 50, 73);
      doc.text(expense.reference, 16, y + 4);
      doc.text(expense.label, 58, y + 4);
      doc.text(money(expense.amount), 145, y + 4);
      doc.text(expense.status, 176, y + 4);
      doc.setDrawColor(230, 234, 241);
      doc.line(14, y + 8, 196, y + 8);
      y += 11;
    });
    doc.setFillColor(244, 248, 253);
    doc.roundedRect(14, y + 7, 182, 24, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(55, 67, 88);
    doc.text(doc.splitTextToSize("Rapport préparé à partir des opérations consignées dans la démonstration SchoolSafe. Les espèces et références externes doivent être rapprochées et contrôlées par l’école.", 166), 22, y + 17);
    pdfFooter(doc, identity);
    doc.save("rapport-caisse-2026-08-14.pdf");
    notify("Rapport de caisse PDF téléchargé avec le logo de l’école.");
  }

  async function exportCertificationPdf(scope, candidateIndex) {
    var JsPdf = pdfLibrary();
    if (!JsPdf) { notify("Le générateur PDF n’est pas disponible."); return; }
    var exam = certificationExam();
    var identity = pdfSchoolIdentity();
    var logo = await loadPdfLogo();
    var doc = configurePdfLanguage(new JsPdf({ unit: "mm", format: "a4" }));
    var individual = typeof candidateIndex === "number";
    var records = individual ? [exam.candidates[candidateIndex]] : (scope === "all" ? exam.candidates.filter(function (item) { return item.published && item.percentage != null; }) : certificationCandidates().filter(function (item) { return scope === "preparation" || (item.published && item.percentage != null); }));
    var title = individual ? "Résultat individuel " + exam.label : (scope === "preparation" ? "Préparation " + exam.label : "Résultats " + exam.label);
    pdfHeader(doc, identity, logo, title, exam.fullName + " · " + exam.session);
    if (individual) {
      var candidate = records[0];
      var hasExamDetails = Boolean(candidate.option);
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(14, 65, 182, hasExamDetails ? 76 : 58, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(7, 48, 112);
      doc.text(candidate.name, 22, 78);
      doc.setFontSize(9);
      doc.setTextColor(55, 67, 88);
      doc.text("Classe : " + candidate.className, 22, 89);
      doc.text("Numéro : " + candidate.number, 22, 97);
      doc.text("Centre : " + candidate.center, 22, 105);
      doc.setFontSize(24);
      doc.setTextColor(candidate.decision === "Réussi" ? 8 : 155, candidate.decision === "Réussi" ? 122 : 81, candidate.decision === "Réussi" ? 85 : 0);
      doc.text(candidate.percentage == null ? "NON PUBLIÉ" : String(candidate.percentage).replace(".", ",") + " %", 187, 88, { align: "right" });
      doc.setFontSize(11);
      doc.text(candidate.decision, 187, 101, { align: "right" });
      doc.setFontSize(8);
      doc.setTextColor(83, 96, 119);
      if (hasExamDetails) {
        doc.text("Option / filière : " + candidate.option, 22, 113);
        doc.text("Jury : " + candidate.jury + " · Participation : " + candidate.participationStatus, 22, 121);
        doc.text("Ce document SchoolSafe n’est ni un diplôme d’État ni un relevé officiel.", 22, 132);
      } else {
        doc.text("Source officielle à documenter · validation locale de démonstration", 22, 116);
      }
    } else {
      var detailedExam = exam.label === "EXETAT";
      var columns = detailedExam ? [{ label: "Candidat", x: 16 }, { label: "Classe / option", x: 62 }, { label: "Numéro", x: 118 }, { label: scope === "preparation" ? "Préparation" : "Résultat", x: 151 }, { label: "Décision", x: 174 }] : [{ label: "Candidat", x: 16 }, { label: "Classe", x: 73 }, { label: "Numéro", x: 96 }, { label: scope === "preparation" ? "Préparation" : "Résultat", x: 130 }, { label: "Décision", x: 162 }];
      var y = drawTableHeader(doc, columns, 65);
      records.forEach(function (candidate) {
        var rowHeight = detailedExam ? 13 : 10;
        if (y + rowHeight > 275) { doc.addPage(); pdfHeader(doc, identity, logo, title, exam.fullName + " · " + exam.session); y = drawTableHeader(doc, columns, 65); }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(38, 50, 73);
        doc.text(candidate.name, 16, y + 4);
        doc.text(candidate.className, detailedExam ? 62 : 73, y + 4);
        if (detailedExam && candidate.option) {
          doc.setFontSize(6);
          doc.setTextColor(83, 96, 119);
          doc.text(doc.splitTextToSize(candidate.option, 50)[0], 62, y + 8);
          doc.setFontSize(7.5);
          doc.setTextColor(38, 50, 73);
        }
        doc.text(candidate.number, detailedExam ? 118 : 96, y + 4);
        doc.text((scope === "preparation" ? candidate.preparation : candidate.percentage) + " %", detailedExam ? 151 : 130, y + 4);
        doc.text(scope === "preparation" ? candidate.dossier : candidate.decision, detailedExam ? 174 : 162, y + 4);
        doc.setDrawColor(230, 234, 241);
        doc.line(14, y + rowHeight - 3, 196, y + rowHeight - 3);
        y += rowHeight;
      });
      doc.setFontSize(8);
      doc.setTextColor(83, 96, 119);
      doc.text(records.length + " candidat(s) dans cet export.", 14, Math.min(y + 7, 280));
    }
    pdfFooter(doc, identity);
    doc.save(sanitizeFilename(exam.label + "-" + title + (individual ? "-" + records[0].name : "")) + ".pdf");
    notify("PDF " + exam.label + " téléchargé.");
  }

  function captureAssignmentDraft(form) {
    if (!form) return pedagogyState.assignmentDraftMeta;
    var data = new FormData(form);
    ["title","className","subject","language","type","teacher","scale","due","prerequisites","instructions"].forEach(function (key) {
      pedagogyState.assignmentDraftMeta[key] = key === "scale" ? Number(data.get(key) || 0) : String(data.get(key) || "");
    });
    return pedagogyState.assignmentDraftMeta;
  }

  function answerSpaceHeight(question) {
    if (question.answerSpace === "Page entière") return 180;
    if (question.answerSpace === "Demi-page") return 95;
    var lines = parseInt(question.answerSpace, 10) || 3;
    return Math.max(22, lines * 7);
  }

  function assignmentNeedsTranslationNotice(assignment) {
    if (!window.SchoolSafeI18n) return false;
    var mode = window.SchoolSafeI18n.documentLanguage();
    var source = String(assignment.language || "").toUpperCase();
    if (mode === "bilingual") return source !== "FR/EN" && source !== "BILINGUAL";
    if (mode === "en") return source !== "EN";
    return source === "EN";
  }

  async function exportAssignmentPdf(assignment) {
    var JsPdf = pdfLibrary();
    if (!JsPdf) { notify("Le générateur PDF n’est pas disponible."); return; }
    var identity = pdfSchoolIdentity();
    var logo = await loadPdfLogo();
    var doc = configurePdfLanguage(new JsPdf({ unit: "mm", format: "a4" }));
    var questions = assignment.questions && assignment.questions.length ? assignment.questions : pedagogyState.assignmentDraftQuestions;
    pdfHeader(doc, identity, logo, assignment.type + " · " + assignment.subject, assignment.title + " · " + assignment.className + " · " + assignment.language);
    var contentOffset = assignmentNeedsTranslationNotice(assignment) ? 6 : 0;
    if (contentOffset) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(164, 92, 12);
      doc.text("Traduction non disponible : contenu original conservé.", 14, 61);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(45, 57, 78);
    doc.text("Enseignant : " + (assignment.teacher || "À renseigner"), 14, 64 + contentOffset);
    doc.text("Date : ____________________", 78, 64 + contentOffset);
    doc.text("Nom de l’élève : __________________________________________", 14, 71 + contentOffset);
    doc.text("Matricule : ____________________", 126, 71 + contentOffset);
    doc.setFont("helvetica", "bold");
    doc.text("Prérequis", 14, 81 + contentOffset);
    doc.setFont("helvetica", "normal");
    var prereq = doc.splitTextToSize(assignment.prerequisites || "Aucun prérequis indiqué.", 176);
    doc.text(prereq, 14, 87 + contentOffset);
    var y = 87 + contentOffset + prereq.length * 4 + 4;
    doc.setFont("helvetica", "bold");
    doc.text("Consignes", 14, y);
    doc.setFont("helvetica", "normal");
    var instructions = doc.splitTextToSize(assignment.instructions || "Répondre lisiblement à toutes les questions.", 176);
    doc.text(instructions, 14, y + 6);
    y += 8 + instructions.length * 4;
    questions.forEach(function (question, index) {
      var questionLines = doc.splitTextToSize((index + 1) + ". " + question.text, 160);
      var required = questionLines.length * 5 + answerSpaceHeight(question) + 15;
      if (y + required > 280) { doc.addPage(); pdfHeader(doc, identity, logo, assignment.type + " · " + assignment.subject, assignment.title + " · suite"); y = 66; }
      doc.setFillColor(245, 248, 252);
      doc.roundedRect(14, y, 182, questionLines.length * 5 + 11, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(24, 42, 72);
      doc.text(questionLines, 18, y + 7);
      doc.setFontSize(7);
      doc.text(question.points + " point(s)", 192, y + 7, { align: "right" });
      y += questionLines.length * 5 + 15;
      doc.setFont("helvetica", "normal");
      doc.setDrawColor(185, 195, 210);
      var height = answerSpaceHeight(question);
      if (question.type === "Dessin") {
        doc.rect(18, y, 174, height);
      } else if (question.type === "Choix multiple" && question.choices) {
        String(question.choices).split(";").forEach(function (choice, choiceIndex) { doc.rect(20, y + choiceIndex * 9, 4, 4); doc.text(choice.trim(), 28, y + 3 + choiceIndex * 9); });
      } else {
        for (var lineY = y + 6; lineY < y + height; lineY += 7) doc.line(18, lineY, 192, lineY);
      }
      y += height + 8;
    });
    pdfFooter(doc, identity);
    doc.save(sanitizeFilename(assignment.type + "-" + assignment.title + "-v" + (assignment.version || 1)) + ".pdf");
    notify("Devoir PDF téléchargé avec sa mise en page A4.");
  }

  function bindPedagogyEvents() {
    document.querySelectorAll("[data-assignment-index]").forEach(function (button) {
      button.addEventListener("click", function () { pedagogyState.selectedAssignment = Number(button.getAttribute("data-assignment-index")); renderPedagogyModule(); });
    });
    var openGrades = document.querySelector("[data-open-grades]");
    if (openGrades) openGrades.addEventListener("click", function () { pedagogyState.activeTab = "grades"; renderPedagogyModule(); });
    var assignmentSelect = document.getElementById("gradeAssignmentSelect");
    if (assignmentSelect) assignmentSelect.addEventListener("change", function () { pedagogyState.selectedAssignment = Number(this.value); renderPedagogyModule(); });
    var form = document.getElementById("assignmentForm");
    if (form) form.addEventListener("submit", function (event) { event.preventDefault(); createAssignment(form, true); });
    if (form) form.addEventListener("input", function () { captureAssignmentDraft(form); });
    var draftButton = document.getElementById("saveAssignmentDraft");
    if (draftButton) draftButton.addEventListener("click", function () { createAssignment(form, false); });
    var addQuestion = document.getElementById("addAssignmentQuestion");
    if (addQuestion) addQuestion.addEventListener("click", function () { captureAssignmentDraft(form); pedagogyState.assignmentDraftQuestions.push({ text: "", type: "Réponse courte", points: 1, answerSpace: "3 lignes", choices: "" }); renderPedagogyModule(); });
    document.querySelectorAll("[data-question-field]").forEach(function (control) {
      control.addEventListener("change", function () { var question = pedagogyState.assignmentDraftQuestions[Number(control.getAttribute("data-question-index"))]; var key = control.getAttribute("data-question-field"); question[key] = key === "points" ? Number(control.value || 0) : control.value; if (key === "type") { captureAssignmentDraft(form); renderPedagogyModule(); } });
      control.addEventListener("input", function () { var question = pedagogyState.assignmentDraftQuestions[Number(control.getAttribute("data-question-index"))]; var key = control.getAttribute("data-question-field"); question[key] = key === "points" ? Number(control.value || 0) : control.value; });
    });
    document.querySelectorAll("[data-remove-question]").forEach(function (button) { button.addEventListener("click", function () { captureAssignmentDraft(form); pedagogyState.assignmentDraftQuestions.splice(Number(button.getAttribute("data-remove-question")), 1); renderPedagogyModule(); }); });
    var previewAssignmentPdf = document.getElementById("previewAssignmentPdf");
    if (previewAssignmentPdf) previewAssignmentPdf.addEventListener("click", function () {
      if (!form.reportValidity()) { notify("Veuillez renseigner le titre du devoir avant de produire le PDF."); return; }
      var draft = captureAssignmentDraft(form);
      draft.questions = pedagogyState.assignmentDraftQuestions.slice();
      draft.version = 1;
      exportAssignmentPdf(draft);
    });
    document.querySelectorAll("[data-download-assignment]").forEach(function (button) { button.addEventListener("click", function () { exportAssignmentPdf(pedagogyState.assignments[Number(button.getAttribute("data-download-assignment"))]); }); });
    document.querySelectorAll("[data-grade-index]").forEach(function (control) {
      control.addEventListener("change", function () { var value = this.value; pedagogyState.assignments[pedagogyState.selectedAssignment].grades[Number(this.getAttribute("data-grade-index"))] = value === "" ? null : (this.tagName === "SELECT" ? value : Number(value)); });
    });
    var saveGrades = document.getElementById("saveGrades");
    if (saveGrades) saveGrades.addEventListener("click", function () { var assignment = pedagogyState.assignments[pedagogyState.selectedAssignment]; queueOfflineOperation("pedagogy", "Brouillon de cotations · " + assignment.title, { kind: "grade-draft", title: assignment.title, grades: assignment.grades.slice() }); notify("Cotations enregistrées comme brouillon local."); });
    var publishGrades = document.getElementById("publishGrades");
    if (publishGrades) publishGrades.addEventListener("click", function () { var assignment = pedagogyState.assignments[pedagogyState.selectedAssignment]; assignment.published = true; queueOfflineOperation("pedagogy", "Publication des cotations · " + assignment.title, { kind: "grade-publication", title: assignment.title, grades: assignment.grades.slice() }); notify(navigator.onLine ? "Cotations préparées pour publication et notification parent." : "Cotations conservées sur l’appareil; publication au retour de la connexion."); renderPedagogyModule(); });
    var rulesForm = document.getElementById("pedagogyRulesForm");
    if (rulesForm) rulesForm.addEventListener("submit", savePedagogyRules);
    var prepareBulletin = document.getElementById("prepareBulletin");
    if (prepareBulletin) prepareBulletin.addEventListener("click", function () { notify("Le PDF officiel attend la validation de la période et le logo de l’école."); });
    var validatePeriod = document.getElementById("validatePeriod");
    if (validatePeriod) validatePeriod.addEventListener("click", function () { var next = pedagogyState.periodStatuses.indexOf(false); if (next !== -1) pedagogyState.periodStatuses[next] = true; queueOfflineOperation("pedagogy", "Validation d’une période pédagogique", { kind: "period-validation", periodIndex: next }); notify("Période validée dans la démonstration locale."); renderPedagogyModule(); });
    var parentChildSelect = document.getElementById("parentChildSelect");
    if (parentChildSelect) parentChildSelect.addEventListener("change", function () { pedagogyState.selectedParentChild = Number(this.value); renderPedagogyModule(); });
    var parentBulletin = document.querySelector("[data-parent-bulletin]");
    if (parentBulletin) parentBulletin.addEventListener("click", function () { pedagogyState.activeTab = "bulletin"; renderPedagogyModule(); });
    var returnParent = document.querySelector("[data-return-parent]");
    if (returnParent) returnParent.addEventListener("click", function () { pedagogyState.activeTab = "parent"; renderPedagogyModule(); });
    document.querySelectorAll("[data-remediation-view]").forEach(function (button) {
      button.addEventListener("click", function () { pedagogyState.remediation.activeView = button.getAttribute("data-remediation-view"); renderPedagogyModule(); });
    });
    document.querySelectorAll("[data-remediation-case]").forEach(function (button) {
      button.addEventListener("click", function () { pedagogyState.remediation.selectedCase = Number(button.getAttribute("data-remediation-case")); renderPedagogyModule(); });
    });
    var remediationDecision = document.getElementById("remediationDecisionForm");
    if (remediationDecision) remediationDecision.addEventListener("submit", saveRemediationDecision);
    var cancelDetection = document.getElementById("cancelDetection");
    if (cancelDetection) cancelDetection.addEventListener("click", function () { var item = pedagogyState.remediation.cases[pedagogyState.remediation.selectedCase]; item.cancelled = true; item.status = "Détection annulée"; notify("Détection annulée avec justification locale."); renderPedagogyModule(); });
    document.querySelectorAll("[data-session-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) { event.preventDefault(); var data = new FormData(form); var item = pedagogyState.remediation.cases[Number(form.getAttribute("data-session-form"))]; var present = data.get("presence") === "present"; item.sessions.push({ date: data.get("date"), subject: data.get("subject"), present: present }); notify(present ? "Séance enregistrée." : "Absence enregistrée. Alerte parent et Responsable pédagogique préparée."); renderPedagogyModule(); });
    });
    document.querySelectorAll("[data-add-installment]").forEach(function (button) {
      button.addEventListener("click", function () { var item = pedagogyState.remediation.cases[Number(button.getAttribute("data-add-installment"))]; var remaining = item.price - item.paid; var installment = Math.min(remaining, Math.max(10000, Math.round(item.price / 3 / 1000) * 1000)); if (remaining <= 0) { notify("Le programme est déjà entièrement payé."); return; } item.paid += installment; if (/premier versement/i.test(item.status)) item.status = "Suivi en cours"; notify("Tranche de " + money(installment) + " enregistrée localement."); renderPedagogyModule(); });
    });
    var closeRemediationMonth = document.getElementById("closeRemediationMonth");
    if (closeRemediationMonth) closeRemediationMonth.addEventListener("click", function () { notify("Clôture préparée : 60 % enseignants, 40 % école, sur les montants encaissés."); });
    document.querySelectorAll("[data-report-index]").forEach(function (control) { control.addEventListener("change", function () { pedagogyState.remediation.cases[Number(control.getAttribute("data-report-index"))].report = control.value; }); });
    document.querySelectorAll("[data-save-report]").forEach(function (button) { button.addEventListener("click", function () { notify("Bilan enregistré et transmis au Responsable pédagogique."); }); });
    document.querySelectorAll("[data-validate-report]").forEach(function (button) { button.addEventListener("click", function () { var item = pedagogyState.remediation.cases[Number(button.getAttribute("data-validate-report"))]; item.validated = true; item.status = "Bilan validé"; notify("Bilan de rattrapage validé."); renderPedagogyModule(); }); });
    document.querySelectorAll("[data-cert-exam]").forEach(function (button) { button.addEventListener("click", function () { pedagogyState.certifications.activeExam = button.getAttribute("data-cert-exam"); pedagogyState.certifications.selectedCandidate = 0; pedagogyState.certifications.filters = { className: "Toutes", center: "Tous", decision: "Tous", option: "Toutes" }; renderPedagogyModule(); }); });
    document.querySelectorAll("[data-cert-view]").forEach(function (button) { button.addEventListener("click", function () { pedagogyState.certifications.activeView = button.getAttribute("data-cert-view"); renderPedagogyModule(); }); });
    document.querySelectorAll("[data-cert-filter]").forEach(function (control) { control.addEventListener("change", function () { pedagogyState.certifications.filters[control.getAttribute("data-cert-filter")] = control.value; renderPedagogyModule(); }); });
    document.querySelectorAll("[data-cert-candidate]").forEach(function (button) { button.addEventListener("click", function () { pedagogyState.certifications.selectedCandidate = Number(button.getAttribute("data-cert-candidate")); renderPedagogyModule(); }); });
    document.querySelectorAll("[data-export-cert]").forEach(function (button) { button.addEventListener("click", function () { exportCertificationPdf(button.getAttribute("data-export-cert")); }); });
    document.querySelectorAll("[data-export-cert-person]").forEach(function (button) { button.addEventListener("click", function () { exportCertificationPdf("individual", Number(button.getAttribute("data-export-cert-person"))); }); });
    var saveCertification = document.querySelector("[data-cert-save]");
    if (saveCertification) saveCertification.addEventListener("click", function () { notify("Contrôle du dossier enregistré localement."); });
  }

  function saveRemediationDecision(event) {
    event.preventDefault();
    var data = new FormData(event.currentTarget);
    var item = pedagogyState.remediation.cases[pedagogyState.remediation.selectedCase];
    item.teacher = data.get("teacher");
    item.price = Number(data.get("price"));
    item.start = data.get("start");
    item.end = data.get("end");
    item.status = item.teacher === "Non affecté" ? "Entretien requis" : (item.paid > 0 ? "Suivi en cours" : "En attente du premier versement");
    item.parentStatus = "Entretien effectué";
    notify("Programme mensuel validé et enseignant affecté.");
    renderPedagogyModule();
  }

  function createAssignment(form, published) {
    if (!form || !form.reportValidity()) return;
    var data = new FormData(form);
    var attachment = data.get("attachment");
    var format = attachment && attachment.name ? (/\.pdf$/i.test(attachment.name) ? "PDF" : "Images") : "Texte";
    var questions = pedagogyState.assignmentDraftQuestions.filter(function (question) { return question.text.trim(); }).map(function (question) { return Object.assign({}, question); });
    if (!questions.length && !attachment.name) { notify("Ajoutez au moins une question ou une pièce jointe."); return; }
    pedagogyState.assignments.unshift({ title: data.get("title"), subject: data.get("subject"), language: data.get("language"), className: data.get("className"), type: data.get("type"), due: data.get("due") || "À planifier", format: questions.length ? "PDF SchoolSafe" : format, scale: Number(data.get("scale")), published: published, teacher: data.get("teacher"), prerequisites: data.get("prerequisites") || "Aucun prérequis indiqué.", instructions: data.get("instructions") || "Consignes à compléter.", questions: questions, version: 1, grades: [null, null, null, null] });
    pedagogyState.selectedAssignment = 0;
    pedagogyState.assignmentDraftMeta = { title: "", className: "1re A", subject: "Mathématiques", language: "FR", type: "Devoir", teacher: data.get("teacher") || "Mme Y", scale: 10, due: "À planifier", prerequisites: "", instructions: "" };
    pedagogyState.assignmentDraftQuestions = [{ text: "", type: "Réponse courte", points: 1, answerSpace: "3 lignes", choices: "" }];
    queueOfflineOperation("assignment", (published ? "Publication du devoir · " : "Brouillon de devoir · ") + data.get("title"), { kind: published ? "assignment-publication" : "assignment-draft", title: data.get("title"), className: data.get("className"), subject: data.get("subject"), attachment: attachment && attachment.name ? attachment : null });
    notify(published ? (navigator.onLine ? "Devoir préparé pour publication dans la vue parent." : "Devoir conservé sur l’appareil; publication au retour de la connexion.") : "Devoir enregistré comme brouillon local.");
    renderPedagogyModule();
  }

  function savePedagogyRules(event) {
    event.preventDefault();
    var data = new FormData(event.currentTarget);
    var assessmentTotal = Number(data.get("homeworkWeight")) + Number(data.get("quizWeight")) + Number(data.get("examWeight"));
    var languageTotal = Number(data.get("frenchWeight")) + Number(data.get("englishWeight"));
    var conductTotal = Number(data.get("teacherConduct")) + Number(data.get("disciplineConduct"));
    if (assessmentTotal !== 100 || languageTotal !== 100 || conductTotal !== 100) {
      notify("Chaque groupe de poids doit totaliser 100 %.");
      return;
    }
    pedagogyState.periods.type = data.get("periodType");
    pedagogyState.periods.count = Number(data.get("periodCount"));
    pedagogyState.periods.passMark = Number(data.get("passMark"));
    pedagogyState.periods.precision = Number(data.get("precision"));
    pedagogyState.weights = { homework: Number(data.get("homeworkWeight")), quiz: Number(data.get("quizWeight")), exam: Number(data.get("examWeight")) };
    pedagogyState.languages[0].weight = Number(data.get("frenchWeight"));
    pedagogyState.languages[1].weight = Number(data.get("englishWeight"));
    pedagogyState.conduct = { teacher: Number(data.get("teacherConduct")), discipline: Number(data.get("disciplineConduct")) };
    queueOfflineOperation("pedagogy", "Modification des règles pédagogiques", { kind: "pedagogy-rules", periods: Object.assign({}, pedagogyState.periods), weights: Object.assign({}, pedagogyState.weights), conduct: Object.assign({}, pedagogyState.conduct) });
    notify("Règles pédagogiques enregistrées localement.");
  }

  function sessionDisplayName() {
    return (currentSession && currentSession.profile && currentSession.profile.display_name) || "";
  }

  function sessionInitials() {
    return initialsFromName(sessionDisplayName() || "SchoolSafe");
  }

  function sessionRoleLabel(roleKey) {
    var profile = roleCatalog[roleKey] || roleCatalog.admin;
    return profile.label;
  }

  function renderWorkspace(roleKey) {
    var profile = roleCatalog[roleKey] || roleCatalog.admin;
    currentDemoRole = roleCatalog[roleKey] ? roleKey : "admin";
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("securityModule").hidden = true;
    document.getElementById("pilotageModule").hidden = true;
    document.getElementById("feeControlModule").hidden = true;
    document.getElementById("accessConsole").hidden = true;
    document.getElementById("schoolModule").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    var liveName = sessionDisplayName();
    var liveInitials = sessionInitials();
    var roleLabel = sessionRoleLabel(currentDemoRole);
    var scopeText = (currentSession && currentSession.scopes && currentSession.scopes.length) ? scopeSummary(currentSession) : profile.scope;
    document.getElementById("workspaceRole").textContent = roleLabel;
    document.getElementById("workspaceTitle").textContent = "Tableau de bord";
    document.getElementById("workspaceInitials").textContent = liveInitials || profile.initials;
    document.getElementById("workspaceProfileName").textContent = liveName || profile.short;
    document.getElementById("workspaceEyebrow").textContent = profile.eyebrow;
    document.getElementById("workspaceWelcomeTitle").textContent = profile.welcome;
    document.getElementById("workspaceWelcomeCopy").textContent = profile.copy;
    document.getElementById("statusRole").textContent = roleLabel;
    document.getElementById("statusScope").textContent = scopeText;
    document.getElementById("priorityScope").textContent = (liveName || profile.short) + " · " + scopeText;
    document.getElementById("profileOverview").innerHTML = (profileIndicators[currentDemoRole] || profileIndicators.admin).map(function (indicator, index) {
      return '<article class="overview-stat overview-' + (index % 6) + '"><span><i data-lucide="' + indicator[2] + '"></i></span><div><small>' + indicator[0] + '</small><b>' + indicator[1] + "</b></div></article>";
    }).join("");

    var roleSwitch = document.getElementById("workspaceRoleSwitch");
    var userRoles = (currentSession && currentSession.roles) || [currentDemoRole];
    roleSwitch.innerHTML = userRoles.map(function (role) {
      var label = roleCatalog[role] ? roleCatalog[role].label : role;
      return '<option value="' + role + '"' + (role === currentDemoRole ? " selected" : "") + ">" + label + "</option>";
    }).join("");
    roleSwitch.hidden = userRoles.length <= 1;
    roleSwitch.disabled = userRoles.length <= 1;

    var visibleBranches = profile.branches.filter(function (item) {
      if (item.key !== "administration") return true;
      var perms = (currentSession && currentSession.permissions) || [];
      return perms.indexOf("school.manage") >= 0 || perms.indexOf("staff.manage") >= 0;
    });

    document.getElementById("workspaceNav").innerHTML = visibleBranches.map(function (item, index) {
      var definition = branchDefinitions[item.key];
      var mobileGroups = item.groups.map(function (workGroup) {
        var mobileActions = workGroup.actions.map(function (action) {
          return '<button class="nav-action" type="button" data-nav-branch="' + item.key + '" data-nav-action="' + action[0] + '"><i data-lucide="' + action[1] + '"></i><span>' + action[0] + "</span></button>";
        }).join("");
        return '<div class="nav-action-group"><span class="nav-group-label">' + workGroup.label + '</span>' + mobileActions + "</div>";
      }).join("");
      return '<div class="nav-branch-item' + (index === 0 ? " active" : "") + '"><button class="nav-branch-button' + (index === 0 ? " active" : "") + '" type="button" data-branch="' + item.key + '" aria-expanded="false"><i data-lucide="' + definition.icon + '"></i><span>' + definition.label + '</span><i class="nav-chevron" data-lucide="chevron-down"></i></button><div class="nav-submenu" hidden>' + mobileGroups + "</div></div>";
    }).join("");
    document.getElementById("statusBranchList").innerHTML = visibleBranches.map(function (item) {
      return "<span>" + branchDefinitions[item.key].label + "</span>";
    }).join("");

    var todayColors = [
      ["#1264df", "#dceaff"], ["#087a55", "#dff8ee"],
      ["#9b6700", "#fff2cd"], ["#6b42c7", "#eee7ff"]
    ];
    document.getElementById("workspaceToday").innerHTML = profile.today.map(function (item, index) {
      var colors = todayColors[index % todayColors.length];
      return '<div class="today-item" style="--item-color:' + colors[0] + ';--item-bg:' + colors[1] + '"><span><i data-lucide="' + item[2] + '"></i></span><div><b>' + item[0] + "</b><small>" + item[1] + "</small></div></div>";
    }).join("");

    document.getElementById("workspaceBranches").innerHTML = visibleBranches.map(function (item) {
      var definition = branchDefinitions[item.key];
      var groups = item.groups.map(function (workGroup) {
        var actions = workGroup.actions.map(function (action) {
          return '<button class="action-button" type="button" data-action="' + action[0] + '"><i data-lucide="' + action[1] + '"></i><span>' + action[0] + "</span></button>";
        }).join("");
        return '<div class="work-group"><h4>' + workGroup.label + '</h4><div class="action-list">' + actions + "</div></div>";
      }).join("");
      return '<section class="branch-section" id="branch-' + item.key + '" style="--branch-color:' + definition.color + ';--branch-bg:' + definition.background + '"><header class="branch-head"><span><i data-lucide="' + definition.icon + '"></i></span><div><h3>' + definition.label + "</h3><p>" + item.description + "</p></div></header>" + groups + "</section>";
    }).join("") + '<div class="scope-note"><i data-lucide="map-pin-check"></i><span><b>Périmètre appliqué :</b> ' + profile.scope + "</span></div>";

    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
    document.getElementById("permissionsNav").hidden = currentDemoRole !== "admin";
    document.getElementById("demoRole").value = currentDemoRole;
    document.querySelectorAll("#workspaceNav .nav-branch-button").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = button.closest(".nav-branch-item");
        if (window.matchMedia("(max-width: 620px)").matches) {
          var shouldOpen = !item.classList.contains("expanded");
          document.querySelectorAll("#workspaceNav .nav-branch-item").forEach(function (navItem) {
            navItem.classList.remove("expanded");
            navItem.querySelector(".nav-branch-button").setAttribute("aria-expanded", "false");
            navItem.querySelector(".nav-submenu").hidden = true;
          });
          item.classList.toggle("expanded", shouldOpen);
          button.setAttribute("aria-expanded", String(shouldOpen));
          item.querySelector(".nav-submenu").hidden = !shouldOpen;
          return;
        }
        var target = document.getElementById("branch-" + button.getAttribute("data-branch"));
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelectorAll("#workspaceNav .nav-branch-button").forEach(function (navButton) { navButton.classList.toggle("active", navButton === button); });
        closeWorkspaceMenu();
      });
    });
    document.querySelectorAll("#workspaceNav [data-nav-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var actionName = button.getAttribute("data-nav-action");
        var branchKey = button.getAttribute("data-nav-branch");
        var target = Array.prototype.find.call(document.querySelectorAll("#branch-" + branchKey + " [data-action]"), function (actionButton) {
          return actionButton.getAttribute("data-action") === actionName;
        });
        document.querySelectorAll("#workspaceBranches .action-button").forEach(function (actionButton) { actionButton.classList.remove("action-selected"); });
        document.querySelectorAll("#workspaceNav .nav-branch-button").forEach(function (navButton) { navButton.classList.toggle("active", navButton.getAttribute("data-branch") === branchKey); });
        if (target) {
          target.classList.add("action-selected");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.focus({ preventScroll: true });
        }
        document.getElementById("workspaceTitle").textContent = actionName;
        closeWorkspaceMenu();
        if (pedagogyTabForAction(actionName)) {
          openPedagogyModule(actionName);
          return;
        }
        if (financeTabForAction(actionName)) {
          openFinanceModule(actionName);
          return;
        }
        if (schoolTabForAction(actionName)) {
          openSchoolModule(schoolTabForAction(actionName));
          return;
        }
        notify(actionName + " — espace ouvert dans la branche " + branchDefinitions[branchKey].label + ".");
      });
    });
    document.querySelectorAll("#workspaceBranches [data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        var actionName = button.getAttribute("data-action");
        if (pedagogyTabForAction(actionName)) {
          openPedagogyModule(actionName);
          return;
        }
        if (financeTabForAction(actionName)) {
          openFinanceModule(actionName);
          return;
        }
        if (securityTabForAction(actionName)) {
          openSecurityModule(actionName);
          return;
        }
        if (pilotageTabForAction(actionName)) {
          openPilotageModule(actionName);
          return;
        }
        if (feeControlTabForAction(actionName)) {
          openFeeControlModule(actionName);
          return;
        }
        if (schoolTabForAction(actionName)) {
          openSchoolModule(schoolTabForAction(actionName));
          return;
        }
        notify(actionName + " — fonction à brancher dans l’étape métier correspondante.");
      });
    });
    icons();
    if (window.SchoolSafeCards) window.SchoolSafeCards.init();
  }

  function populateRoleSelect(select, value) {
    select.innerHTML = Array.prototype.map.call(document.getElementById("demoRole").options, function (option) {
      return '<option value="' + option.value + '"' + (option.value === value ? " selected" : "") + ">" + option.textContent + "</option>";
    }).join("");
  }

  function renderPermissionTree(roleKey) {
    var profile = roleCatalog[roleKey] || roleCatalog.guard;
    var person = staffSamples[selectedStaffIndex];
    person.permissions = person.permissions || {};
    person.actionLevels = person.actionLevels || {};
    person.dataViews = person.dataViews || {};
    document.getElementById("permissionTree").innerHTML = profile.branches.map(function (item) {
      var definition = branchDefinitions[item.key];
      var actionCount = item.groups.reduce(function (count, workGroup) { return count + workGroup.actions.length; }, 0);
      var groupMarkup = item.groups.map(function (workGroup) {
        var actionMarkup = workGroup.actions.map(function (action) {
          var permissionKey = item.key + "::" + action[0];
          var checked = person.permissions[permissionKey] !== false;
          var actionLevel = person.actionLevels[permissionKey] || (action[2] === "status" ? "view" : "execute");
          var dataView = person.dataViews[permissionKey] || (action[2] === "status" ? "status" : "useful");
          return '<div class="permission-row' + (checked ? "" : " disabled") + '"><label class="permission-toggle"><input type="checkbox" data-permission-key="' + permissionKey + '"' + (checked ? " checked" : "") + '><span>' + action[0] + '</span></label><label class="permission-choice"><span>Action</span><select data-action-level="' + permissionKey + '"><option value="view"' + (actionLevel === "view" ? " selected" : "") + '>Consulter</option><option value="execute"' + (actionLevel === "execute" ? " selected" : "") + '>Exécuter</option><option value="approve"' + (actionLevel === "approve" ? " selected" : "") + '>Valider</option><option value="admin"' + (actionLevel === "admin" ? " selected" : "") + '>Administrer</option></select></label><label class="permission-choice"><span>Données</span><select data-data-view="' + permissionKey + '"><option value="status"' + (dataView === "status" ? " selected" : "") + '>Statut uniquement</option><option value="useful"' + (dataView === "useful" ? " selected" : "") + '>Informations utiles</option><option value="detailed"' + (dataView === "detailed" ? " selected" : "") + '>Détails autorisés</option><option value="full"' + (dataView === "full" ? " selected" : "") + '>Données complètes</option></select></label></div>';
        }).join("");
        return '<div class="permission-group"><h4>' + workGroup.label + '</h4><div class="permission-rows">' + actionMarkup + "</div></div>";
      }).join("");
      return '<section class="permission-branch"><header><b>' + definition.label + '</b><span class="protected-state">' + actionCount + ' fonctions indépendantes</span></header>' + groupMarkup + "</section>";
    }).join("");
    document.querySelectorAll("[data-permission-key]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        person.permissions[checkbox.getAttribute("data-permission-key")] = checkbox.checked;
        checkbox.closest(".permission-row").classList.toggle("disabled", !checkbox.checked);
      });
    });
    document.querySelectorAll("[data-action-level]").forEach(function (select) {
      select.addEventListener("change", function () { person.actionLevels[select.getAttribute("data-action-level")] = select.value; });
    });
    document.querySelectorAll("[data-data-view]").forEach(function (select) {
      select.addEventListener("change", function () { person.dataViews[select.getAttribute("data-data-view")] = select.value; });
    });
  }

  function renderStaffList() {
    document.getElementById("staffList").innerHTML = staffSamples.map(function (person, index) {
      return '<button class="staff-item' + (index === selectedStaffIndex ? " active" : "") + '" type="button" data-staff-index="' + index + '"><span>' + person.initials + '</span><div><b>' + person.name + "</b><small>" + roleCatalog[person.role].short + "</small></div></button>";
    }).join("");
    document.querySelectorAll("[data-staff-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedStaffIndex = Number(button.getAttribute("data-staff-index"));
        renderPermissionEditor();
      });
    });
  }

  function renderPermissionEditor() {
    var person = staffSamples[selectedStaffIndex];
    document.getElementById("editorAvatar").textContent = person.initials;
    document.getElementById("editorName").textContent = person.name;
    document.getElementById("editorAssignment").textContent = roleCatalog[person.role].label + " · " + person.scope;
    populateRoleSelect(document.getElementById("editorRole"), person.role);
    document.getElementById("scopeType").value = person.scopeType;
    document.getElementById("scopeValue").value = person.scope;
    var policy = document.getElementById("accessDataPolicy");
    policy.hidden = person.role !== "pedagogy";
    if (person.role === "pedagogy") {
      policy.innerHTML = '<div><span><i data-lucide="shield-check"></i></span><div><b>Attribution financière limitée</b><p>Régularité scolaire · statut uniquement · périmètre ' + person.scope + '</p></div></div><ul><li>Visible : identité scolaire, classe, En ordre / À régulariser / Indisponible</li><li>Masqué : montants, soldes, paiements, reçus, caisse et trésorerie</li></ul>';
    }
    renderStaffList();
    renderPermissionTree(person.role);
    icons();
  }

  function openAccessConsole() {
    if (currentDemoRole !== "admin") {
      notify("Seul l’Administrateur principal peut attribuer les rôles et les accès.");
      return;
    }
    document.getElementById("pedagogyModule").hidden = true;
    document.getElementById("financeModule").hidden = true;
    document.getElementById("accessConsole").hidden = false;
    document.querySelector(".workspace-grid").hidden = true;
    document.getElementById("cardsProtected").hidden = true;
    closeWorkspaceMenu();
    renderPermissionEditor();
    document.getElementById("accessConsole").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeAccessConsole() {
    document.getElementById("accessConsole").hidden = true;
    document.querySelector(".workspace-grid").hidden = false;
    document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
  }

  function closeWorkspaceMenu() {
    var sidebar = document.getElementById("workspaceSidebar");
    sidebar.classList.remove("open");
    document.getElementById("cubeMenu").setAttribute("aria-expanded", "false");
  }

  function initParticles() {
    var container = document.getElementById("particles");
    if (!container || container.childElementCount) return;
    var colors = ["#ef5b5b", "#ff7a4d", "#eab308", "#2fbf8f", "#2f7bd6", "#9b6fd4", "#ec4899"];
    for (var index = 0; index < 25; index += 1) {
      var particle = document.createElement("span");
      var size = 2 + (index % 6);
      particle.className = "particle";
      particle.style.width = size + "px";
      particle.style.height = size + "px";
      particle.style.left = ((index * 37) % 100) + "%";
      particle.style.color = colors[index % colors.length];
      particle.style.background = colors[index % colors.length];
      particle.style.animationDuration = (5 + (index % 8)) + "s";
      particle.style.animationDelay = (-1 * (index % 7)) + "s";
      container.appendChild(particle);
    }
  }

  function icons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
  }

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle("active", key === name);
    });
    if (name === "auth") startImageRotation();
    else stopImageRotation();
    if (name === "guardian") startGuardianGallery();
    else stopGuardianGallery();
    if (name === "workspace") renderWorkspace(document.getElementById("demoRole").value || currentDemoRole);
    icons();
  }
  window.schoolSafeShow = showScreen;

  function notify(message) {
    var toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("show"); }, 3200);
  }
  window.SchoolSafeApp = window.SchoolSafeApp || {};
  window.SchoolSafeApp.notify = notify;

  function renderGuardianGallery(immediate) {
    var activeMedia = schoolMediaLibrary.filter(function (media) { return media.active; }).sort(function (a, b) { return a.order - b.order; });
    document.querySelectorAll("[data-gallery-slot]").forEach(function (figure, slot) {
      var media = activeMedia[(guardianGalleryIndex + slot) % activeMedia.length];
      var image = figure.querySelector("img");
      var applyFocus = function () {
        image.alt = media.alt;
        figure.style.setProperty("--face-desktop-x", media.desktop[0] + "%");
        figure.style.setProperty("--face-desktop-y", media.desktop[1] + "%");
        figure.style.setProperty("--face-mobile-x", media.mobile[0] + "%");
        figure.style.setProperty("--face-mobile-y", media.mobile[1] + "%");
        window.setTimeout(function () { figure.classList.remove("switching"); }, 60);
      };
      var applyMedia = function () {
        if (image.getAttribute("src") === media.src) {
          applyFocus();
          return;
        }
        var preloader = new Image();
        preloader.onload = function () {
          image.src = media.src;
          applyFocus();
        };
        preloader.onerror = function () { figure.classList.remove("switching"); };
        preloader.src = media.src;
      };
      if (immediate) applyMedia();
      else {
        figure.classList.add("switching");
        window.setTimeout(applyMedia, 360);
      }
    });
  }

  function startGuardianGallery() {
    renderGuardianGallery(true);
    if (guardianGalleryTimer) return;
    guardianGalleryTimer = window.setInterval(function () {
      guardianGalleryIndex = (guardianGalleryIndex + 1) % schoolMediaLibrary.length;
      renderGuardianGallery(false);
    }, 5000);
  }

  function stopGuardianGallery() {
    if (!guardianGalleryTimer) return;
    window.clearInterval(guardianGalleryTimer);
    guardianGalleryTimer = null;
  }

  function startImageRotation() {
    if (rotationTimer) return;
    rotationTimer = window.setInterval(function () {
      imageIndex = (imageIndex + 1) % loginImages.length;
      var a = document.getElementById("authImageA");
      var b = document.getElementById("authImageB");
      var incoming = imageFront === "A" ? b : a;
      var outgoing = imageFront === "A" ? a : b;
      incoming.src = loginImages[imageIndex];
      incoming.onload = function () {
        incoming.classList.add("visible");
        outgoing.classList.remove("visible");
        imageFront = imageFront === "A" ? "B" : "A";
      };
    }, 7000);
  }

  function stopImageRotation() {
    if (!rotationTimer) return;
    window.clearInterval(rotationTimer);
    rotationTimer = null;
  }

  document.getElementById("enterSplash").addEventListener("click", function () { showScreen("guardian"); });
  screens.splash.addEventListener("click", function (event) {
    if (event.target.closest("button") && event.target.id !== "enterSplash") return;
    showScreen("guardian");
  });
  screens.splash.addEventListener("dblclick", function () { showScreen("auth"); });
  document.getElementById("continueGuardian").addEventListener("click", function () { showScreen("auth"); });
  screens.guardian.addEventListener("click", function (event) {
    if (event.target.closest("button")) return;
    showScreen("auth");
  });
  document.getElementById("backToSplash").addEventListener("click", function () { showScreen("splash"); });
  document.getElementById("setupHome").addEventListener("click", function () { showScreen("splash"); });
  document.getElementById("closeSetup").addEventListener("click", function () { showScreen("auth"); });
  document.getElementById("startSetup").addEventListener("click", async function () {
    var token = window.prompt("Token de configuration de l'école :");
    if (!token) return;
    try {
      var config = await loadBackendConfig();
      if (!config) { notify("Serveur de configuration non disponible."); return; }
      var result = await apiPost("/setup/validate-token", { token: token });
      if (!result || !result.valid) { notify("Token de configuration invalide."); return; }
      setupToken = token;
      renderStep();
      showScreen("setup");
    } catch (error) {
      notify(error.message || "Impossible de valider le token.");
    }
  });
  document.getElementById("workspaceBack").addEventListener("click", async function () {
    clearSession();
    try { await getSupabaseClient()?.auth?.signOut(); } catch (e) {}
    document.getElementById("emailIdentifier").value = "";
    document.getElementById("phoneIdentifier").value = "";
    document.getElementById("password").value = "";
    document.getElementById("otpIdentifier").value = "";
    document.getElementById("otpIdentity").classList.add("hidden");
    pendingPhone = null;
    showScreen("auth");
  });
  document.getElementById("previewWorkspace").addEventListener("click", function () { showScreen("workspace"); });
  document.getElementById("returnSetup").addEventListener("click", function () { showScreen("setup"); });
  document.getElementById("closePedagogyModule").addEventListener("click", closePedagogyModule);
  document.querySelectorAll("#pedagogyTabs [data-pedagogy-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      pedagogyState.activeTab = button.getAttribute("data-pedagogy-tab");
      renderPedagogyModule();
    });
  });
  document.getElementById("closeFinanceModule").addEventListener("click", closeFinanceModule);
  document.querySelectorAll("#financeTabs [data-finance-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      financeState.activeTab = button.getAttribute("data-finance-tab");
      renderFinanceModule();
    });
  });
  document.getElementById("closeSecurityModule").addEventListener("click", closeSecurityModule);
  document.getElementById("closePilotageModule").addEventListener("click", closePilotageModule);
  document.getElementById("closeFeeControlModule").addEventListener("click", closeFeeControlModule);
  document.getElementById("closeSchoolModule").addEventListener("click", closeSchoolModule);
  document.querySelectorAll("#pilotageTabs [data-pilotage-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      document.querySelectorAll("#pilotageTabs [data-pilotage-tab]").forEach(function (b) { b.classList.remove("active"); });
      button.classList.add("active");
      renderPilotageTab(button.getAttribute("data-pilotage-tab"));
    });
  });
  document.getElementById("cubeMenu").addEventListener("click", function () {
    var sidebar = document.getElementById("workspaceSidebar");
    var isOpen = sidebar.classList.toggle("open");
    this.setAttribute("aria-expanded", String(isOpen));
  });
  document.getElementById("closeWorkspaceMenu").addEventListener("click", closeWorkspaceMenu);
  document.getElementById("workspaceMenuBackdrop").addEventListener("click", closeWorkspaceMenu);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeWorkspaceMenu();
    if (event.key === "Escape" && !document.getElementById("syncPanel").hidden) closeSyncPanel();
  });
  document.getElementById("syncStatusButton").addEventListener("click", openSyncPanel);
  document.getElementById("closeSyncPanel").addEventListener("click", closeSyncPanel);
  document.getElementById("syncPanelBackdrop").addEventListener("click", closeSyncPanel);
  document.getElementById("syncNowButton").addEventListener("click", function () {
    if (!navigator.onLine) { notify("Aucune connexion. La reprise restera automatique."); return; }
    window.SchoolSafeSync.syncNow();
  });
  document.getElementById("installPwaButton").addEventListener("click", function () {
    if (!deferredInstallPrompt) { notify("L’installation sera proposée lorsque le navigateur l’autorisera."); return; }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(function () { deferredInstallPrompt = null; document.getElementById("installPwaButton").hidden = true; });
  });
  document.getElementById("workspaceRoleSwitch").addEventListener("change", function () {
    closeAccessConsole();
    storageSet("schoolsafe-v2-active-role", this.value);
    renderWorkspace(this.value);
  });
  document.getElementById("permissionsNav").addEventListener("click", openAccessConsole);
  document.getElementById("closeAccessConsole").addEventListener("click", closeAccessConsole);
  document.getElementById("editorRole").addEventListener("change", function () {
    var person = staffSamples[selectedStaffIndex];
    person.role = this.value;
    document.getElementById("editorAssignment").textContent = roleCatalog[person.role].label + " · " + person.scope;
    renderStaffList();
    renderPermissionTree(person.role);
    icons();
  });
  document.getElementById("scopeType").addEventListener("change", function () {
    staffSamples[selectedStaffIndex].scopeType = this.value;
  });
  document.getElementById("scopeValue").addEventListener("input", function () {
    staffSamples[selectedStaffIndex].scope = this.value;
    document.getElementById("editorAssignment").textContent = roleCatalog[staffSamples[selectedStaffIndex].role].label + " · " + this.value;
  });
  document.getElementById("savePermissions").addEventListener("click", function () {
    var person = staffSamples[selectedStaffIndex];
    queueOfflineOperation("administration", "Modification des droits · " + person.name, { kind: "permission-change", person: person.name, role: person.role, scopeType: person.scopeType, scope: person.scope, permissions: Object.assign({}, person.permissions || {}), actionLevels: Object.assign({}, person.actionLevels || {}), dataViews: Object.assign({}, person.dataViews || {}) });
    notify("Brouillon d’accès enregistré localement. Aucun serveur n’a été modifié.");
  });

  document.getElementById("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var mode = document.querySelector("[data-login-mode].selected")?.getAttribute("data-login-mode") || "email";
    var client = getSupabaseClient();
    if (!client) {
      var config = await loadBackendConfig();
      if (!config || !config.supabase_url) {
        notify("Backend local non disponible — passage en démonstration.");
        enterDemo();
        return;
      }
      client = getSupabaseClient();
      if (!client) {
        notify("Impossible d’initialiser le client Supabase.");
        return;
      }
    }

    try {
      if (mode === "email") {
        var email = document.getElementById("emailIdentifier").value.trim();
        var password = document.getElementById("password").value;
        if (!email || !password) { notify("Renseignez l’e-mail et le mot de passe."); return; }
        var result = await client.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        var token = result.data.session.access_token;
        currentSession = { token: token };
        var bootstrap = await callBootstrap(token);
        applyBootstrap(bootstrap);
        enterLiveSession();
      } else {
        var phone = normalizePhone(document.getElementById("phoneIdentifier").value);
        var password = document.getElementById("password").value;
        if (!phone) { notify("Renseignez le numéro de téléphone."); return; }
        if (!password) { notify("Renseignez le mot de passe."); return; }

        var lookup = await apiPost("/auth/lookup-phone", { phone: phone });
        if (!lookup || !lookup.email) {
          notify("Aucun compte trouvé pour ce numéro.");
          return;
        }

        var result = await client.auth.signInWithPassword({ email: lookup.email, password: password });
        if (result.error) throw result.error;
        var token = result.data.session.access_token;
        currentSession = { token: token };
        var bootstrap = await callBootstrap(token);
        applyBootstrap(bootstrap);
        enterLiveSession();
      }
    } catch (error) {
      console.error("Login error", error);
      notify("Échec de connexion : " + (error.message || error.statusText || "erreur inconnue"));
    }
  });
  document.querySelectorAll("[data-login-mode]").forEach(function (button) {
    button.addEventListener("click", function () {
      var mode = button.getAttribute("data-login-mode");
      document.querySelectorAll("[data-login-mode]").forEach(function (item) {
        var selected = item === button;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      var emailGroup = document.getElementById("emailIdentity");
      var phoneGroup = document.getElementById("phoneIdentity");
      var otpGroup = document.getElementById("otpIdentity");
      var emailInput = document.getElementById("emailIdentifier");
      var phoneInput = document.getElementById("phoneIdentifier");
      var otpInput = document.getElementById("otpIdentifier");
      emailGroup.classList.toggle("hidden", mode !== "email");
      phoneGroup.classList.toggle("hidden", mode !== "phone");
      otpGroup.classList.add("hidden");
      otpInput.value = "";
      pendingPhone = null;
      emailInput.required = mode === "email";
      phoneInput.required = mode === "phone";
      otpInput.required = false;
      (mode === "email" ? emailInput : phoneInput).focus();
    });
  });
  document.getElementById("forgotPassword").addEventListener("click", function () {
    notify("Récupération prévue par e-mail, puis secours WhatsApp administré.");
  });
  document.getElementById("togglePassword").addEventListener("click", function () {
    var input = document.getElementById("password");
    var isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    this.setAttribute("aria-label", isPassword ? "Masquer le mot de passe" : "Afficher le mot de passe");
    this.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
    icons();
  });
  document.querySelectorAll(".language-switch button").forEach(function (button) {
    button.addEventListener("click", function () {
      var language = button.getAttribute("data-language") || "fr";
      window.SchoolSafeI18n.setLanguage(language);
      notify(language === "en" ? "English interface enabled." : "Interface française activée.");
    });
  });
  var pdfLanguageMode = document.getElementById("pdfLanguageMode");
  if (window.SchoolSafeI18n) pdfLanguageMode.value = window.SchoolSafeI18n.documentLanguage();
  pdfLanguageMode.addEventListener("change", function () {
    window.SchoolSafeI18n.setDocumentLanguage(this.value);
    queueOfflineOperation("administration", "Modification de la langue des documents PDF", { kind: "document-language", value: this.value });
    notify(window.SchoolSafeI18n.current() === "en" ? "PDF document language saved." : "Langue des documents PDF enregistrée.");
  });

  var stepIndex = 0;
  var stepLabels = [
    "Identité",
    "Cycles",
    "Année scolaire",
    "Coordonnées",
    "Identité visuelle",
    "Administrateur",
    "Vérification"
  ];
  var stepTitles = [
    "Identité de l’école",
    "Cycles d’enseignement",
    "Organisation de l’année scolaire",
    "Coordonnées officielles",
    "Identité visuelle et documents",
    "Administrateur principal",
    "Vérification de l’instance"
  ];
  var defaults = {
    schoolName: "",
    legalName: "",
    schoolType: "Privée agréée",
    schoolCode: "",
    cycles: ["primary"],
    yearLabel: "2026-2027",
    yearStart: "2026-09-01",
    yearEnd: "2027-07-15",
    periods: "Trimestres",
    country: "République démocratique du Congo",
    province: "Kinshasa",
    city: "Kinshasa",
    address: "",
    email: "",
    phone: "+243 ",
    website: "",
    websiteMode: "Créer un nouveau site SchoolSafe",
    websiteAddress: "",
    publicNews: "Après validation",
    publicGallery: "Après validation et consentement",
    publicHonors: "Après validation",
    primaryColor: "#071a3d",
    accentColor: "#e9a515",
    documentFooter: "",
    officialLogoData: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPhone: "+243 ",
    adminPassword: "",
    adminPasswordConfirm: ""
  };
  var state = loadDraft();

  function loadDraft() {
    try {
      var saved = window.localStorage.getItem("schoolsafe-v2-setup");
      return saved ? Object.assign({}, defaults, JSON.parse(saved)) : Object.assign({}, defaults);
    } catch (error) {
      return Object.assign({}, defaults);
    }
  }

  function saveDraft() {
    try { window.localStorage.setItem("schoolsafe-v2-setup", JSON.stringify(state)); } catch (error) {}
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function field(label, id, value, options) {
    var config = options || {};
    var wide = config.wide ? " wide" : "";
    var type = config.type || "text";
    var hint = config.hint ? "<small>" + config.hint + "</small>" : "";
    if (config.select) {
      return [
        '<div class="form-field' + wide + '">',
        "<label for=\"" + id + "\">" + label + "</label>",
        "<select id=\"" + id + "\" name=\"" + id + "\">",
        config.select.map(function (item) { return "<option" + (item === value ? " selected" : "") + ">" + item + "</option>"; }).join(""),
        "</select>", hint, "</div>"
      ].join("");
    }
    if (config.textarea) {
      return '<div class="form-field' + wide + '"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" name="' + id + '" placeholder="' + esc(config.placeholder || "") + '">' + esc(value) + "</textarea>" + hint + "</div>";
    }
    return '<div class="form-field' + wide + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + id + '" type="' + type + '" value="' + esc(value) + '" placeholder="' + esc(config.placeholder || "") + '">' + hint + "</div>";
  }

  function intro(title, copy) {
    return '<div class="section-intro"><h2>' + title + "</h2><p>" + copy + "</p></div>";
  }

  function renderIdentity() {
    return [
      intro("Présentez l’établissement", "Ces informations identifieront l’instance et alimenteront les en-têtes administratifs. Aucune école n’est préconfigurée."),
      '<div class="form-grid">',
      field("Nom usuel de l’école", "schoolName", state.schoolName, { placeholder: "Ex. Groupe scolaire..." }),
      field("Dénomination légale", "legalName", state.legalName, { placeholder: "Nom figurant sur les documents officiels" }),
      field("Statut de l’établissement", "schoolType", state.schoolType, { select: ["Privée agréée", "Publique", "Conventionnée", "Confessionnelle", "Autre"] }),
      field("Numéro d’agrément ou code école", "schoolCode", state.schoolCode, { placeholder: "À compléter selon les documents officiels" }),
      "</div>"
    ].join("");
  }

  function cycleCard(key, icon, title, description, color, background) {
    var selected = state.cycles.indexOf(key) !== -1;
    return [
      '<label class="cycle-option' + (selected ? " selected" : "") + '" style="--cycle:' + color + ";--cycle-bg:" + background + '">',
      '<input type="checkbox" name="cycles" value="' + key + '"' + (selected ? " checked" : "") + ">",
      '<span class="cycle-icon"><i data-lucide="' + icon + '"></i></span>',
      "<h3>" + title + "</h3><p>" + description + "</p></label>"
    ].join("");
  }

  function activeModules() {
    var modules = ["Pilotage", "Élèves", "Admissions", "Sécurité et accès", "Cartes élèves · protégées", "Finances", "Personnel", "Communication", "PDF officiels", "Audit"];
    if (state.cycles.indexOf("nursery") !== -1) modules.push("Éveil et suivi maternel", "Sorties autorisées", "Santé et cantine");
    if (state.cycles.indexOf("primary") !== -1) modules.push("Matières et devoirs", "Notes et bulletins", "Rattrapage", "TENAFEP / ENAFEP");
    if (state.cycles.indexOf("secondary") !== -1) modules.push("Coefficients", "Interrogations et examens", "Palmarès", "EXETAT");
    return modules;
  }

  function renderCycles() {
    return [
      intro("Choisissez les cycles présents", "SchoolSafe ouvrira les fonctions pédagogiques utiles à ces cycles. Les modules administratifs, financiers et de sécurité restent communs."),
      '<div class="cycle-grid">',
      cycleCard("nursery", "shapes", "Maternelle", "Suivi quotidien, éveil, santé, cantine et autorisations de sortie.", "#c64b45", "#ffe7e4"),
      cycleCard("primary", "book-open", "Primaire", "Classes, matières, devoirs, notes, bulletins et rattrapage.", "#087a55", "#dff8ee"),
      cycleCard("secondary", "graduation-cap", "Secondaire et Humanités", "Coefficients, évaluations, examens, palmarès et rapports officiels.", "#6b42c7", "#eee7ff"),
      '</div><div class="module-preview"><h3>Modules prévus pour cette instance</h3><div class="module-tags">',
      activeModules().map(function (module) { return '<span class="module-tag"><i data-lucide="check"></i>' + module + "</span>"; }).join(""),
      "</div></div>"
    ].join("");
  }

  function renderAcademicYear() {
    return [
      intro("Cadrez l’année scolaire", "Les périodes seront réutilisées dans les présences, les paiements, les évaluations, les bulletins et les rapports."),
      '<div class="form-grid">',
      field("Libellé de l’année scolaire", "yearLabel", state.yearLabel),
      field("Organisation pédagogique", "periods", state.periods, { select: ["Trimestres", "Semestres"] }),
      field("Date de début", "yearStart", state.yearStart, { type: "date" }),
      field("Date de fin", "yearEnd", state.yearEnd, { type: "date" }),
      "</div>"
    ].join("");
  }

  function renderContact() {
    return [
      intro("Renseignez les coordonnées", "Elles apparaîtront sur les documents officiels et serviront aux communications de l’établissement."),
      '<div class="form-grid">',
      field("Pays", "country", state.country),
      field("Province", "province", state.province),
      field("Ville ou territoire", "city", state.city),
      field("Adresse complète", "address", state.address, { placeholder: "Avenue, numéro, commune..." }),
      field("E-mail officiel", "email", state.email, { type: "email", placeholder: "contact@ecole.cd" }),
      field("Téléphone officiel", "phone", state.phone, { type: "tel" }),
      field("Site web actuel", "website", state.website, { wide: true, type: "url", placeholder: "https://..." }),
      "</div>",
      '<section class="school-site-setup"><div class="site-setup-head"><span><i data-lucide="globe-2"></i></span><div><h3>Application privée + site public de l’école</h3><p>SchoolSafe prépare le site avec l’école; seules les publications validées quittent l’espace privé.</p></div></div><div class="form-grid">',
      field("Mode du site", "websiteMode", state.websiteMode, { select: ["Créer un nouveau site SchoolSafe", "Relier un site existant", "Configurer plus tard"] }),
      field("Adresse souhaitée ou existante", "websiteAddress", state.websiteAddress, { type: "url", placeholder: "https://nom-ecole..." }),
      field("Publication des actualités", "publicNews", state.publicNews, { select: ["Après validation", "Désactivée"] }),
      field("Publication des photos", "publicGallery", state.publicGallery, { select: ["Après validation et consentement", "Désactivée"] }),
      field("Publication du palmarès", "publicHonors", state.publicHonors, { select: ["Après validation", "Désactivée"] }),
      '</div><div class="publication-flow"><span>Privé</span><i data-lucide="arrow-right"></i><span>Brouillon</span><i data-lucide="arrow-right"></i><span>Validation</span><i data-lucide="arrow-right"></i><span>Site public</span></div></section>'
    ].join("");
  }

  function renderBrand() {
    return [
      intro("Installez l’identité officielle", "Le logo validé sera obligatoire sur chaque PDF officiel. Les couleurs personnalisent l’interface sans modifier le moteur de cartes."),
      '<div class="form-grid">',
      '<div class="form-field wide"><label>Logo officiel de l’école</label><label class="logo-upload" for="officialLogoInput"><span><i data-lucide="image-up"></i><b>' + (state.officialLogoData ? "Logo officiel chargé" : "Sélectionner le logo officiel") + '</b><span>PNG haute définition, fond transparent recommandé</span></span><input id="officialLogoInput" type="file" accept="image/png,image/jpeg" hidden></label></div>',
      field("Couleur principale", "primaryColor", state.primaryColor, { type: "color" }),
      field("Couleur d’accent", "accentColor", state.accentColor, { type: "color" }),
      field("Mention de pied de page des PDF", "documentFooter", state.documentFooter, { wide: true, textarea: true, placeholder: "Adresse, contacts et références légales" }),
      "</div>"
    ].join("");
  }

  function renderAdmin() {
    return [
      intro("Créez le premier responsable", "L’Administrateur principal attribuera ensuite les profils, les modules, les actions et les périmètres de chaque membre du personnel."),
      '<div class="form-grid">',
      field("Prénom", "adminFirstName", state.adminFirstName),
      field("Nom", "adminLastName", state.adminLastName),
      field("E-mail professionnel", "adminEmail", state.adminEmail, { type: "email", placeholder: "direction@ecole.cd" }),
      field("Téléphone", "adminPhone", state.adminPhone, { type: "tel" }),
      field("Mot de passe", "adminPassword", state.adminPassword, { type: "password", placeholder: "Minimum 8 caractères" }),
      field("Confirmer le mot de passe", "adminPasswordConfirm", state.adminPasswordConfirm, { type: "password" }),
      '<div class="warning-note form-field wide"><i data-lucide="key-round"></i><span>Ce compte sera créé immédiatement. L’authentification forte sera exigée pour les profils sensibles.</span></div>',
      "</div>"
    ].join("");
  }

  function row(label, value) {
    return '<div class="review-row"><span>' + label + "</span><b>" + esc(value || "À compléter") + "</b></div>";
  }

  function renderReview() {
    var cycleNames = { nursery: "Maternelle", primary: "Primaire", secondary: "Secondaire et Humanités" };
    return [
      intro("Contrôlez avant de poursuivre", "Cette étape termine uniquement la maquette locale. Elle ne crée aucune base, aucun compte et aucun service sur le VPS."),
      '<div class="review-grid">',
      '<section class="review-block"><h3>Établissement</h3>',
      row("Nom", state.schoolName), row("Statut", state.schoolType), row("Code", state.schoolCode),
      '</section><section class="review-block"><h3>Cycles et année</h3>',
      row("Cycles", state.cycles.map(function (key) { return cycleNames[key]; }).join(", ")), row("Année", state.yearLabel), row("Périodes", state.periods),
      '</section><section class="review-block"><h3>Contact</h3>',
      row("Localisation", [state.city, state.province].filter(Boolean).join(", ")), row("E-mail", state.email), row("Téléphone", state.phone),
      row("Site", state.websiteMode), row("Adresse", state.websiteAddress || state.website), row("Publications", "Actualités, galerie et palmarès après validation"),
      '</section><section class="review-block"><h3>Administrateur principal</h3>',
      row("Nom", [state.adminFirstName, state.adminLastName].filter(Boolean).join(" ")), row("E-mail", state.adminEmail), row("Téléphone", state.adminPhone),
      '</section></div>',
      '<div class="warning-note"><i data-lucide="shield-alert"></i><span>La prochaine phase préparera l’analyse d’impact de l’authentification, des permissions et du schéma de données. Rien ne sera appliqué à Supabase ou au VPS sans autorisation explicite.</span></div>'
    ].join("");
  }

  var renderers = [renderIdentity, renderCycles, renderAcademicYear, renderContact, renderBrand, renderAdmin, renderReview];

  function collectFields() {
    document.querySelectorAll("#stepContent input:not([name=cycles]), #stepContent select, #stepContent textarea").forEach(function (control) {
      if (control.name) state[control.name] = control.value;
    });
    var cycleControls = Array.prototype.slice.call(document.querySelectorAll('input[name="cycles"]'));
    if (cycleControls.length) {
      state.cycles = cycleControls.filter(function (control) { return control.checked; }).map(function (control) { return control.value; });
    }
    saveDraft();
  }

  function renderNav() {
    var nav = document.getElementById("stepNav");
    nav.innerHTML = stepLabels.map(function (label, index) {
      var status = index === stepIndex ? " active" : index < stepIndex ? " done" : "";
      var endIcon = index < stepIndex ? '<i data-lucide="check"></i>' : "";
      return '<button class="step-link' + status + '" type="button" data-step="' + index + '"><span class="number">' + (index < stepIndex ? "✓" : index + 1) + '</span><span>' + label + "</span>" + endIcon + "</button>";
    }).join("");
    nav.querySelectorAll(".step-link").forEach(function (button) {
      button.addEventListener("click", function () {
        collectFields();
        stepIndex = Number(button.getAttribute("data-step"));
        renderStep();
      });
    });
  }

  function bindStepEvents() {
    document.querySelectorAll('input[name="cycles"]').forEach(function (control) {
      control.addEventListener("change", function () {
        collectFields();
        if (!state.cycles.length) {
          state.cycles = [control.value];
          control.checked = true;
        }
        renderStep();
      });
    });
    var upload = document.getElementById("officialLogoInput");
    if (upload) upload.addEventListener("change", function () {
      var file = upload.files && upload.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg)$/.test(file.type)) { notify("Utilisez un logo PNG ou JPEG."); return; }
      var reader = new FileReader();
      reader.onload = function () { state.officialLogoData = reader.result; saveDraft(); notify("Logo officiel enregistré dans le brouillon local."); renderStep(); };
      reader.readAsDataURL(file);
    });
    document.querySelectorAll("#stepContent input, #stepContent select, #stepContent textarea").forEach(function (control) {
      control.addEventListener("change", collectFields);
    });
  }

  function validateStep(index) {
    if (index === 0) {
      if (!state.schoolName.trim()) return "Le nom de l’école est obligatoire.";
    }
    if (index === 1) {
      if (!state.cycles.length) return "Sélectionnez au moins un cycle.";
    }
    if (index === 5) {
      if (!state.adminFirstName.trim() || !state.adminLastName.trim()) return "Le prénom et le nom sont obligatoires.";
      if (!state.adminEmail.trim()) return "L’e-mail de l’administrateur est obligatoire.";
      if (!state.adminPassword || state.adminPassword.length < 8) return "Le mot de passe doit faire au moins 8 caractères.";
      if (state.adminPassword !== state.adminPasswordConfirm) return "Les mots de passe ne correspondent pas.";
    }
    return null;
  }

  async function submitSetup() {
    if (!setupToken) throw new Error("Token de configuration manquant.");

    var schoolPayload = {
      token: setupToken,
      identity: {
        name_fr: state.schoolName,
        name_en: state.name_en || state.schoolName,
        legal_name: state.legalName,
        school_type: state.schoolType,
        approval_code: state.schoolCode
      },
      cycles: state.cycles,
      academic_year: {
        label: state.yearLabel,
        starts_on: state.yearStart,
        ends_on: state.yearEnd,
        periods: state.periods
      },
      contact: {
        country: state.country,
        province: state.province,
        city: state.city,
        address: state.address,
        email: state.email,
        phone: state.phone,
        website_url: state.website,
        website_mode: state.websiteMode,
        public_news: state.publicNews,
        public_gallery: state.publicGallery,
        public_honors: state.publicHonors
      },
      brand: {
        primary_color: state.primaryColor,
        accent_color: state.accentColor,
        document_footer: state.documentFooter,
        logo_path: state.officialLogoData || null
      }
    };

    await apiPost("/setup/school", schoolPayload);

    var adminPayload = {
      token: setupToken,
      email: state.adminEmail,
      password: state.adminPassword,
      first_name: state.adminFirstName,
      last_name: state.adminLastName,
      phone: state.adminPhone
    };

    await apiPost("/setup/admin", adminPayload);
  }

  function renderStep() {
    document.getElementById("stepCounter").textContent = "Étape " + (stepIndex + 1) + " sur " + stepLabels.length;
    document.getElementById("stepTitle").textContent = stepTitles[stepIndex];
    document.getElementById("progressBar").style.width = ((stepIndex + 1) / stepLabels.length * 100) + "%";
    document.getElementById("stepContent").innerHTML = renderers[stepIndex]();
    document.getElementById("prevStep").disabled = stepIndex === 0;
    document.getElementById("nextStep").innerHTML = stepIndex === stepLabels.length - 1
      ? 'Terminer la configuration <i data-lucide="check"></i>'
      : 'Continuer <i data-lucide="arrow-right"></i>';
    renderNav();
    bindStepEvents();
    icons();
    document.querySelector(".setup-main").scrollTo({ top: 0, behavior: "smooth" });
  }

  async function restoreSession() {
    var saved = loadSession();
    if (saved && saved.token) {
      try {
        var config = await loadBackendConfig();
        if (config && config.supabase_url) {
          currentSession = { token: saved.token };
          var bootstrap = await callBootstrap(saved.token);
          applyBootstrap(bootstrap);
          notify("Session restaurée.");
          return;
        }
      } catch (e) {
        console.warn("Session restore failed", e);
        clearSession();
      }
    }
    renderStep();
    initParticles();
    initPwaExperience();
    icons();
  }

  document.getElementById("prevStep").addEventListener("click", function () {
    collectFields();
    if (stepIndex > 0) stepIndex -= 1;
    renderStep();
  });
  document.getElementById("nextStep").addEventListener("click", async function () {
    collectFields();
    var error = validateStep(stepIndex);
    if (error) { notify(error); return; }

    if (stepIndex < stepLabels.length - 1) {
      stepIndex += 1;
      renderStep();
      return;
    }

    var button = document.getElementById("nextStep");
    button.disabled = true;
    button.innerHTML = 'Configuration en cours…';

    try {
      await submitSetup();
      storageRemove("schoolsafe-v2-setup");
      notify("Configuration enregistrée. Connectez-vous avec le compte administrateur.");
      window.setTimeout(function () {
        showScreen("auth");
        button.disabled = false;
      }, 900);
    } catch (error) {
      console.error("Setup error", error);
      notify("Échec de la configuration : " + (error.message || "erreur inconnue"));
      button.disabled = false;
      button.innerHTML = 'Terminer la configuration <i data-lucide="check"></i>';
      icons();
    }
  });

  restoreSession();
}());
