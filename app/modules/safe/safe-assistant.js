(function (global) {
  "use strict";

  var ASSET_BASE = "./safe2d/";
  var DEFAULT_ANIMATION = "Idle";

  // Branche de navigation associée à chaque entrée FAQ qui pointe vers une
  // fonctionnalité (null = sujet général, toujours disponible).
  var faq = [
    { keywords: ["ajouter", "élève"], question: "Comment ajouter un élève ?", answer: "Va dans Élèves, clique sur « + Ajouter », remplis les informations puis enregistre.", animation: "TalkHandsOpen", branch: "school" },
    { keywords: ["présence", "appel"], question: "Comment faire l’appel ?", answer: "Va dans Présences, choisis ta classe et la date, marque les absents/retards, puis valide.", animation: "TalkHandsOpen", branch: "pedagogy" },
    { keywords: ["paiement", "caisse"], question: "Comment enregistrer un paiement ?", answer: "Dans Caisse, clique « + Nouveau paiement », choisis l’élève, le type de frais et le montant.", animation: "TalkHandsOpen", branch: "finance" },
    { keywords: ["rapport"], question: "Comment générer un rapport ?", answer: "Va dans Rapports, choisis le type et la période, puis clique « Générer ».", animation: "TalkHandsOpen", branch: "reports" },
    { keywords: ["palmarès", "classement"], question: "C’est quoi le Palmarès ?", answer: "Le Palmarès montre le Top 10 de chaque classe et de toute l’école, basé sur les cotes publiées du mois.", animation: "TalkPassionately", branch: "pedagogy" },
    { keywords: ["qui", "safe"], question: "Qui es-tu ?", answer: "Je suis Safe, ton assistante SchoolSafe ! Pose-moi tes questions.", animation: "TalkHandsOpen", branch: null },
    { keywords: ["bonjour", "salut"], question: "Bonjour !", answer: "Bonjour ! Que veux-tu faire aujourd’hui dans SchoolSafe ?", animation: "FormalBow", branch: null },
    { keywords: ["aide"], question: "J’ai besoin d’aide", answer: "Je suis là ! Choisis un sujet ci-dessous ou pose ta question.", animation: "TalkHandsOpen", branch: null },
  ];

  // Suggestions par défaut, chacune rattachée à sa branche de navigation.
  var DEFAULT_SUGGESTIONS = [
    { text: "Comment ajouter un élève ?", branch: "school" },
    { text: "Comment faire l’appel ?", branch: "pedagogy" },
    { text: "Comment enregistrer un paiement ?", branch: "finance" },
  ];

  var onboardingSteps = [
    { animation: "Wave", message: "Bonjour ! Je suis Safe, ton assistante SchoolSafe. Je te fais découvrir l’application en 2 minutes ?" },
    { animation: "TalkHandsOpen", message: "Le menu à gauche te donne accès à toutes les fonctions : élèves, classes, présences, caisse, rapports…" },
    { animation: "TalkPassionately", message: "Tu connais les bases ! Clique sur moi quand tu as une question. 🎉" },
  ];

  // Session réelle = token présent (window.currentSession exposé par app.js,
  // sinon session persistée en localStorage pendant la restauration asynchrone).
  // Sans session : mode démo, comportement historique inchangé.
  function sessionUser() {
    var live = global.currentSession;
    if (live && live.token) return live;
    try {
      var raw = global.localStorage && global.localStorage.getItem("schoolsafe-v2-session");
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.token) return saved;
      }
    } catch (e) { /* session illisible : traiter comme démo */ }
    return null;
  }

  function assistantUser() {
    var live = sessionUser();
    if (live) return live;
    if (global.document && global.document.body && global.document.body.classList.contains("screen-workspace") && global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getCurrentUser === "function") {
      return global.SchoolSafeAppContext.getCurrentUser();
    }
    return null;
  }

  // En session réelle, Jaspe exige la permission safe.assistant.use (DENY par défaut).
  function isAllowed(userOverride) {
    var user = userOverride || assistantUser();
    if (!user) return true;
    var access = global.SchoolSafeAccess;
    if (!access || typeof access.allowsScope !== "function") return false;
    return access.allowsScope(user, "safe.assistant.use", "own");
  }

  // En session réelle, une branche n’est proposée que si elle est visible pour l’utilisateur.
  function branchVisible(branchKey) {
    if (!branchKey) return true;
    var user = assistantUser();
    if (!user) return true;
    var access = global.SchoolSafeAccess;
    if (!access || typeof access.isBranchVisible !== "function") return false;
    return access.isBranchVisible(user, branchKey);
  }

  function defaultSuggestions() {
    return DEFAULT_SUGGESTIONS.filter(function (s) { return branchVisible(s.branch); })
      .map(function (s) { return s.text; });
  }

  var state = {
    open: false,
    minimized: false,
    animation: DEFAULT_ANIMATION,
    currentMessage: "",
    suggestions: defaultSuggestions(),
    onboardingIndex: -1,
  };

  var container = null;

  function init() {
    if (container) return;
    if (!isAllowed()) return; // session réelle sans safe.assistant.use : Jaspe ne s’initialise pas
    container = document.createElement("div");
    container.className = "safe-assistant";
    container.setAttribute("aria-label", "Assistant Safe");
    document.body.appendChild(container);
    render();
    maybeStartOnboarding();
    listenToAppEvents();
  }

  function refreshAccess() {
    if (!container) {
      init();
      return !!container;
    }
    if (!isAllowed()) {
      container.innerHTML = "";
      container.hidden = true;
      if (global.SchoolSafeJaspe3D && typeof global.SchoolSafeJaspe3D.destroy === "function") global.SchoolSafeJaspe3D.destroy();
      return false;
    }
    container.hidden = false;
    render();
    return true;
  }

  function hasCompletedOnboarding() {
    try { return localStorage.getItem("safe_onboarding_done") === "1"; } catch (e) { return true; }
  }

  function markOnboardingDone() {
    try { localStorage.setItem("safe_onboarding_done", "1"); } catch (e) {}
  }

  function maybeStartOnboarding() {
    if (hasCompletedOnboarding()) return;
    // L'onboarding démarre uniquement dans l'espace de travail : l'utilisateur est alors authentifié
    if (!document.body.classList.contains("screen-workspace")) return;
    state.onboardingIndex = 0;
    state.open = true;
    showOnboardingStep();
  }

  function showOnboardingStep() {
    var step = onboardingSteps[state.onboardingIndex];
    if (!step) {
      state.onboardingIndex = -1;
      state.currentMessage = "Tu peux me poser tes questions quand tu veux !";
      state.animation = "Idle";
      render();
      return;
    }
    state.animation = step.animation;
    state.currentMessage = step.message;
    state.suggestions = state.onboardingIndex < onboardingSteps.length - 1
      ? ["Continuer", "Plus tard"]
      : ["Terminer"];
    render();
  }

  function legacyFallbackUrl() {
    return ASSET_BASE + "safe_sourire.png";
  }

  function escape(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render() {
    if (!container) return;
    if (!isAllowed()) { // session devenue réelle sans safe.assistant.use : masquer Jaspe
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var html = "";
    if (state.open) {
      html += '<div class="safe-bubble">';
      html += '<div class="safe-bubble-header"><strong>Safe</strong><button class="safe-bubble-close" aria-label="Fermer">✕</button></div>';
      html += '<div class="safe-bubble-body"><p>' + escape(state.currentMessage) + '</p>';
      if (state.suggestions.length) {
        html += '<div class="safe-suggestions">';
        state.suggestions.forEach(function (s) {
          html += '<button type="button" data-suggestion="' + escape(s) + '">' + escape(s) + '</button>';
        });
        html += '</div>';
      }
      html += '<div class="safe-input-row"><input type="text" id="safeInput" placeholder="Pose ta question…"><button type="button" id="safeSend">Envoyer</button></div>';
      html += '</div></div>';
    }
    html += '<div class="safe-avatar' + (state.minimized ? " safe-minimized" : "") + '" role="button" tabindex="0" aria-label="Ouvrir Jaspe">';
    html += '<div class="safe-3d-stage" aria-hidden="true"><span class="safe-3d-fallback"><img src="' + legacyFallbackUrl() + '" alt=""><span>Jaspe</span></span></div>';
    html += '</div>';
    container.innerHTML = html;
    bindEvents();
    mountJaspe3D();
  }

  function mountJaspe3D() {
    var stage = container && container.querySelector(".safe-3d-stage");
    if (!stage || !global.SchoolSafeJaspe3D || typeof global.SchoolSafeJaspe3D.mount !== "function") return;
    global.SchoolSafeJaspe3D.mount(stage).then(function () {
      playVisual(state.animation, { once: state.animation !== "Idle" && state.animation !== "Listening" });
    });
  }

  function playVisual(animation, options) {
    state.animation = animation;
    if (!global.SchoolSafeJaspe3D || typeof global.SchoolSafeJaspe3D.play !== "function") return;
    global.SchoolSafeJaspe3D.play(animation, options || { once: animation !== "Idle" && animation !== "Listening" });
  }

  function bindEvents() {
    var avatar = container.querySelector(".safe-avatar");
    if (avatar) avatar.addEventListener("click", toggleOpen);

    var closeBtn = container.querySelector(".safe-bubble-close");
    if (closeBtn) closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeBubble(); });

    var suggestions = container.querySelectorAll("[data-suggestion]");
    suggestions.forEach(function (btn) {
      btn.addEventListener("click", function () { handleSuggestion(btn.getAttribute("data-suggestion")); });
    });

    var input = container.querySelector("#safeInput");
    var sendBtn = container.querySelector("#safeSend");
    if (sendBtn) sendBtn.addEventListener("click", function () { if (input) handleUserInput(input.value); });
    if (input) input.addEventListener("input", function () { playVisual("Listening", { once: false }); });
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") handleUserInput(input.value); });
  }

  function toggleOpen() {
    if (!isAllowed()) { render(); return; }
    state.open = !state.open;
    if (state.open && !state.currentMessage) {
      state.currentMessage = "Bonjour ! Je suis Safe, ton assistante SchoolSafe. 😊";
      state.animation = "Wave";
      state.suggestions = defaultSuggestions();
    }
    render();
  }

  function closeBubble() {
    state.open = false;
    state.animation = "Idle";
    render();
  }

  function openWithQuery(query) {
    if (!isAllowed()) { render(); return; }
    state.open = true;
    state.currentMessage = "";
    if (query) {
      handleUserInput(query);
    } else {
      state.currentMessage = "Bonjour ! Je suis Safe, ton assistante SchoolSafe. 😊";
      state.animation = "Wave";
      state.suggestions = defaultSuggestions();
      render();
    }
  }

  function handleSuggestion(text) {
    if (state.onboardingIndex >= 0) {
      if (text === "Continuer") {
        state.onboardingIndex++;
        showOnboardingStep();
      } else if (text === "Plus tard") {
        state.onboardingIndex = -1;
        markOnboardingDone();
        closeBubble();
      } else if (text === "Terminer") {
        state.onboardingIndex = -1;
        markOnboardingDone();
        state.currentMessage = "Tu peux me poser tes questions quand tu veux !";
        state.animation = "Agree";
        state.suggestions = [];
        render();
      }
      return;
    }
    handleUserInput(text);
  }

  function handleUserInput(raw) {
    var text = String(raw || "").toLowerCase();
    if (!text) return;
    playVisual("Listening", { once: false });

    var routingContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
      ? global.SchoolSafeAppContext.getAssistantContext()
      : { user: assistantUser() };
    if (!global.SchoolSafeJaspeCapabilityRouter || typeof global.SchoolSafeJaspeCapabilityRouter.route !== "function") {
      state.currentMessage = "Jaspe refuse cette demande : le routeur central de capacités est indisponible.";
      state.animation = "Shrug";
      state.suggestions = [];
      render();
      return;
    }
    var routingDecision = global.SchoolSafeJaspeCapabilityRouter.route(raw, routingContext);
    if (routingDecision && routingDecision.matched && !routingDecision.allowed) {
      state.currentMessage = routingDecision.message;
      state.animation = "Shrug";
      state.suggestions = [];
      render();
      return;
    }
    var routedTarget = routingDecision && routingDecision.matched ? routingDecision.target : null;
    function routeAllows(target) {
      return !routedTarget || routedTarget === "legacy" || routedTarget === target;
    }

    if (routeAllows("documents") && global.SchoolSafeDocumentAssistant && typeof global.SchoolSafeDocumentAssistant.answer === "function") {
      var documentContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var documentAnswer = global.SchoolSafeDocumentAssistant.answer(raw, documentContext);
      if (documentAnswer) {
        state.currentMessage = documentAnswer.message;
        state.animation = documentAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        if (!documentAnswer.refusal && documentAnswer.action === "documents" && global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.openDocuments === "function") {
          global.SchoolSafeAppContext.openDocuments();
        }
        render();
        return;
      }
    }

    if (routeAllows("communication") && global.SchoolSafeCommunication && typeof global.SchoolSafeCommunication.answerJaspe === "function") {
      var communicationContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var communicationAnswer = communicationContext
        ? global.SchoolSafeCommunication.answerJaspe(raw, communicationContext)
        : null;
      if (communicationAnswer) {
        state.currentMessage = communicationAnswer.message;
        state.animation = communicationAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        if (!communicationAnswer.refusal && communicationAnswer.action && global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.openCommunication === "function") {
          global.SchoolSafeAppContext.openCommunication(communicationAnswer.action);
        }
        render();
        return;
      }
    }

    if (routeAllows("parent") && global.SchoolSafeParentPortal && typeof global.SchoolSafeParentPortal.answerJaspe === "function") {
      var assistantContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var parentAnswer = assistantContext && assistantContext.activeRole === "parent"
        ? global.SchoolSafeParentPortal.answerJaspe(raw, assistantContext)
        : null;
      if (parentAnswer) {
        state.currentMessage = parentAnswer.message;
        state.animation = parentAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        render();
        return;
      }
    }

    if (routeAllows("teacher") && global.SchoolSafeTeacherPedagogy && typeof global.SchoolSafeTeacherPedagogy.answerJaspe === "function") {
      var pedagogyContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var pedagogyAnswer = pedagogyContext && (pedagogyContext.activeRole === "teacher" || pedagogyContext.activeRole === "pedagogy")
        ? global.SchoolSafeTeacherPedagogy.answerJaspe(raw, pedagogyContext)
        : null;
      if (pedagogyAnswer) {
        state.currentMessage = pedagogyAnswer.message;
        state.animation = pedagogyAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        render();
        return;
      }
    }

    if (routeAllows("security") && global.SchoolSafeGuardSecurity && typeof global.SchoolSafeGuardSecurity.answerJaspe === "function") {
      var securityContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var securityAnswer = securityContext && securityContext.activeRole === "guard"
        ? global.SchoolSafeGuardSecurity.answerJaspe(raw, securityContext)
        : null;
      if (securityAnswer) {
        state.currentMessage = securityAnswer.message;
        state.animation = securityAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        render();
        return;
      }
    }

    if (routeAllows("staff") && global.SchoolSafeHrDemo && typeof global.SchoolSafeHrDemo.answerJaspe === "function") {
      var hrContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var hrAnswer = hrContext && hrContext.activeRole === "hr"
        ? global.SchoolSafeHrDemo.answerJaspe(raw, hrContext)
        : null;
      if (hrAnswer) {
        state.currentMessage = hrAnswer.message;
        state.animation = hrAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        if (hrAnswer.action && global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.openHr === "function") {
          global.SchoolSafeAppContext.openHr(hrAnswer.action);
        }
        render();
        return;
      }
    }

    if (routeAllows("inventory") && global.SchoolSafeInventoryDemo && typeof global.SchoolSafeInventoryDemo.answerJaspe === "function") {
      var inventoryContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var inventoryAnswer = inventoryContext
        ? global.SchoolSafeInventoryDemo.answerJaspe(raw, inventoryContext)
        : null;
      if (inventoryAnswer) {
        state.currentMessage = inventoryAnswer.message;
        state.animation = inventoryAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        if (!inventoryAnswer.refusal && inventoryAnswer.action && global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.openInventory === "function") {
          global.SchoolSafeAppContext.openInventory(inventoryAnswer.action);
        }
        render();
        return;
      }
    }

    if (routeAllows("accounting") && global.SchoolSafeAccountingTreasury && typeof global.SchoolSafeAccountingTreasury.answerJaspe === "function") {
      var accountingContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var accountingAnswer = accountingContext
        ? global.SchoolSafeAccountingTreasury.answerJaspe(raw, accountingContext)
        : null;
      if (accountingAnswer) {
        state.currentMessage = accountingAnswer.message;
        state.animation = accountingAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        if (accountingAnswer.action && global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.openAccounting === "function") {
          global.SchoolSafeAppContext.openAccounting(accountingAnswer.action);
        }
        render();
        return;
      }
    }

    if (routeAllows("finance") && global.SchoolSafeFinanceModule && typeof global.SchoolSafeFinanceModule.answerJaspe === "function") {
      var financeContext = global.SchoolSafeAppContext && typeof global.SchoolSafeAppContext.getAssistantContext === "function"
        ? global.SchoolSafeAppContext.getAssistantContext()
        : null;
      var reservedRole = financeContext && ["parent", "teacher", "pedagogy", "guard"].indexOf(financeContext.activeRole) >= 0;
      var financeAnswer = financeContext && !reservedRole
        ? global.SchoolSafeFinanceModule.answerJaspe(raw, financeContext)
        : null;
      if (financeAnswer) {
        state.currentMessage = financeAnswer.message;
        state.animation = financeAnswer.refusal ? "Shrug" : "TalkHandsOpen";
        state.suggestions = [];
        if (financeAnswer.action && financeAnswer.action !== "fee-control" && typeof global.SchoolSafeFinanceModule.render === "function") {
          global.SchoolSafeFinanceModule.render("financeModule", { tab: financeAnswer.action });
        }
        render();
        return;
      }
    }

    if (/autorise|autoriser|valide|valider/.test(text) && /sortie|remise|récup|recup/.test(text)) {
      state.currentMessage = "Je ne peux pas autoriser une sortie, valider une remise, suspendre ou rétablir une personne. Ces actions exigent les droits utilisateur correspondants et restent sous contrôle humain.";
      state.animation = "Shrug";
      state.suggestions = defaultSuggestions();
      render();
      return;
    }

    if (/activ/.test(text) && /dossier|élève|eleve/.test(text)) {
      state.currentMessage = "Je ne peux pas exécuter une activation. Ouvrez le dossier élève : l’action exige school.student.activate et reste BACKEND_LATER.";
      state.animation = "Shrug";
      state.suggestions = defaultSuggestions();
      render();
      return;
    }

    if (/valid|change|transf|départ|depart|inactif|archiv/.test(text) && /réinscri|reinscri|classe|élève|eleve|dossier|départ|depart|archiv/.test(text)) {
      state.currentMessage = "Je peux expliquer le parcours, préparer un résumé, une demande ou un brouillon. Je ne peux pas valider une réinscription, changer une classe, transférer un élève, enregistrer un départ, rendre un dossier inactif ou l’archiver.";
      state.animation = "Shrug";
      state.suggestions = defaultSuggestions();
      render();
      return;
    }

    var best = null;
    var bestScore = 0;
    for (var i = 0; i < faq.length; i++) {
      var item = faq[i];
      var score = 0;
      for (var j = 0; j < item.keywords.length; j++) {
        if (text.indexOf(item.keywords[j]) >= 0) score++;
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }

    if (best && bestScore >= 1 && !branchVisible(best.branch)) {
      // La réponse pointe vers une branche inaccessible : ne pas la proposer.
      best = null;
    }

    if (best && bestScore >= 1) {
      state.currentMessage = best.answer;
      state.animation = best.animation;
    } else {
      state.currentMessage = "Hmm, je ne suis pas sûre de comprendre. Essaie avec d’autres mots, ou choisis un sujet.";
      state.animation = "Shrug";
    }
    state.suggestions = defaultSuggestions();
    render();
  }

  function listenToAppEvents() {
    global.addEventListener("safe:event", function (e) {
      var detail = e.detail || {};
      if (detail.type === "action:success") { state.animation = "Agree"; state.currentMessage = "Parfait, c’est enregistré ! 👍"; }
      else if (detail.type === "action:big_success") { state.animation = "TalkPassionately"; state.currentMessage = "Félicitations ! 🎉"; }
      else if (detail.type === "action:error") { state.animation = "Shrug"; state.currentMessage = "Oups ! " + (detail.message || "Quelque chose n’a pas marché.") + " On réessaie ?"; }
      else if (detail.type === "loading:start") { state.animation = "Listening"; }
      else if (detail.type === "loading:stop") { state.animation = "Idle"; }
      if (state.open) render();
    });
  }

  global.SafeAssistant = { init: init, isAllowed: isAllowed, openWithQuery: openWithQuery, refreshAccess: refreshAccess };
  if (global.document && (global.document.readyState === "complete" || global.document.readyState === "interactive")) {
    init();
  } else if (global.addEventListener) {
    global.addEventListener("DOMContentLoaded", init);
  }
})(window);
