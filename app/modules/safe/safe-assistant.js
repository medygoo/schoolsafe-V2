(function (global) {
  "use strict";

  var ASSET_BASE = "./safe2d/";
  var DEFAULT_POSE = "sourire";

  var faq = [
    { keywords: ["ajouter", "élève"], question: "Comment ajouter un élève ?", answer: "Va dans Élèves, clique sur « + Ajouter », remplis les informations puis enregistre.", pose: "pointe" },
    { keywords: ["présence", "appel"], question: "Comment faire l’appel ?", answer: "Va dans Présences, choisis ta classe et la date, marque les absents/retards, puis valide.", pose: "pointe" },
    { keywords: ["paiement", "caisse"], question: "Comment enregistrer un paiement ?", answer: "Dans Caisse, clique « + Nouveau paiement », choisis l’élève, le type de frais et le montant.", pose: "pointe" },
    { keywords: ["rapport"], question: "Comment générer un rapport ?", answer: "Va dans Rapports, choisis le type et la période, puis clique « Générer ».", pose: "pointe" },
    { keywords: ["palmarès", "classement"], question: "C’est quoi le Palmarès ?", answer: "Le Palmarès montre le Top 10 de chaque classe et de toute l’école, basé sur les cotes publiées du mois.", pose: "trophy" },
    { keywords: ["qui", "safe"], question: "Qui es-tu ?", answer: "Je suis Safe, ton assistante SchoolSafe ! Pose-moi tes questions.", pose: "clin" },
    { keywords: ["bonjour", "salut"], question: "Bonjour !", answer: "Bonjour ! Que veux-tu faire aujourd’hui dans SchoolSafe ?", pose: "salue" },
    { keywords: ["aide"], question: "J’ai besoin d’aide", answer: "Je suis là ! Choisis un sujet ci-dessous ou pose ta question.", pose: "accueil" },
  ];

  var onboardingSteps = [
    { pose: "accueil", message: "Bonjour ! Je suis Safe, ton assistante SchoolSafe. Je te fais découvrir l’application en 2 minutes ?" },
    { pose: "pointe", message: "Le menu à gauche te donne accès à toutes les fonctions : élèves, classes, présences, caisse, rapports…" },
    { pose: "saute", message: "Tu connais les bases ! Clique sur moi quand tu as une question. 🎉" },
  ];

  var state = {
    open: false,
    minimized: false,
    pose: DEFAULT_POSE,
    currentMessage: "",
    suggestions: ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"],
    onboardingIndex: -1,
  };

  var container = null;

  function init() {
    if (container) return;
    container = document.createElement("div");
    container.className = "safe-assistant";
    container.setAttribute("aria-label", "Assistant Safe");
    document.body.appendChild(container);
    render();
    maybeStartOnboarding();
    listenToAppEvents();
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
      state.pose = "sourire";
      render();
      return;
    }
    state.pose = step.pose;
    state.currentMessage = step.message;
    state.suggestions = state.onboardingIndex < onboardingSteps.length - 1
      ? ["Continuer", "Plus tard"]
      : ["Terminer"];
    render();
  }

  function assetUrl(pose) {
    return ASSET_BASE + "safe_" + pose + ".png";
  }

  function escape(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render() {
    if (!container) return;
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
    html += '<div class="safe-avatar' + (state.minimized ? " safe-minimized" : "") + '" role="button" tabindex="0" aria-label="Ouvrir Safe">';
    html += '<img src="' + assetUrl(state.pose) + '" alt="Safe">';
    html += '</div>';
    container.innerHTML = html;
    bindEvents();
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
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") handleUserInput(input.value); });
  }

  function toggleOpen() {
    state.open = !state.open;
    if (state.open && !state.currentMessage) {
      state.currentMessage = "Bonjour ! Je suis Safe, ton assistante SchoolSafe. 😊";
      state.pose = "salue";
      state.suggestions = ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"];
    }
    render();
  }

  function closeBubble() {
    state.open = false;
    render();
  }

  function openWithQuery(query) {
    state.open = true;
    state.currentMessage = "";
    if (query) {
      handleUserInput(query);
    } else {
      state.currentMessage = "Bonjour ! Je suis Safe, ton assistante SchoolSafe. 😊";
      state.pose = "salue";
      state.suggestions = ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"];
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
        state.pose = "sourire";
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

    if (best && bestScore >= 1) {
      state.currentMessage = best.answer;
      state.pose = best.pose;
    } else {
      state.currentMessage = "Hmm, je ne suis pas sûre de comprendre. Essaie avec d’autres mots, ou choisis un sujet.";
      state.pose = "pense";
    }
    state.suggestions = ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"];
    render();
  }

  function listenToAppEvents() {
    global.addEventListener("safe:event", function (e) {
      var detail = e.detail || {};
      if (detail.type === "action:success") { state.pose = "pouce"; state.currentMessage = "Parfait, c’est enregistré ! 👍"; }
      else if (detail.type === "action:big_success") { state.pose = "saute"; state.currentMessage = "Félicitations ! 🎉"; }
      else if (detail.type === "action:error") { state.pose = "reflechie"; state.currentMessage = "Oups ! " + (detail.message || "Quelque chose n’a pas marché.") + " On réessaie ?"; }
      else if (detail.type === "loading:start") { state.pose = "pense"; }
      else if (detail.type === "loading:stop") { state.pose = "sourire"; }
      if (state.open) render();
    });
  }

  global.SafeAssistant = { init: init, openWithQuery: openWithQuery };
  if (global.document && (global.document.readyState === "complete" || global.document.readyState === "interactive")) {
    init();
  } else if (global.addEventListener) {
    global.addEventListener("DOMContentLoaded", init);
  }
})(window);
