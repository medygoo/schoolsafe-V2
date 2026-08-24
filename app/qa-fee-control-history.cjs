const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const moduleSource = fs.readFileSync(path.join(__dirname, "modules/finance/fee-control-module.js"), "utf8");
const accessSource = fs.readFileSync(path.join(__dirname, "modules/core/access.js"), "utf8");

function state(props) {
  props = props || {};
  return '<section data-state="' + (props.type || "") + '"><h3>' + (props.title || "") + "</h3><p>" + (props.message || "") + "</p><small>" + (props.details || "") + "</small></section>";
}

function createElement(id, elements, controls) {
  const listeners = {};
  let html = "";
  const element = {
    value: "",
    classList: { remove: function () {}, add: function () {} },
    addEventListener: function (type, listener) { listeners[type] = listener; },
    hasListener: function (type) { return typeof listeners[type] === "function"; },
    trigger: function (type, event) { if (listeners[type]) listeners[type].call(this, event || { preventDefault: function () {} }); },
    querySelectorAll: function (selector) {
      if (selector === "input[name='feeControlCampaign']") return controls.radios;
      return [];
    },
    querySelector: function (selector) {
      const idMatch = selector.match(/^#(.+)$/);
      return idMatch ? (elements[idMatch[1]] || null) : null;
    }
  };
  Object.defineProperty(element, "innerHTML", {
    get: function () { return html; },
    set: function (value) {
      html = String(value || "");
      if (id === "feeControlContent") {
        ["feeControlCampaigns", "feeControlHistory", "feeControlHistoryCampaign", "feeControlHistoryResult", "feeControlHistorySearch", "feeControlHistoryList"].forEach(function (childId) {
          if (new RegExp('id="' + childId + '"').test(html)) elements[childId] = createElement(childId, elements, controls);
        });
      }
      if (id === "feeControlCampaigns") {
        controls.radios = Array.from(html.matchAll(/name="feeControlCampaign" value="([^"]+)"/g), function (match) {
          const radio = createElement("campaign-" + match[1], elements, controls);
          radio.value = match[1];
          return radio;
        });
      }
    }
  });
  return element;
}

function loadAccess() {
  const context = { window: {} };
  vm.runInNewContext(accessSource, context);
  return context.window.SchoolSafeAccess;
}

function load(options) {
  options = options || {};
  const elements = {};
  const controls = { radios: [] };
  const calls = { securityScan: 0, createScan: 0, listCampaigns: 0 };
  const root = {
    schoolSafeDemoMode: !!options.demoMode,
    location: { hostname: options.demoMode ? "localhost" : "schoolsafe.example" },
    localStorage: { getItem: function () { return null; } },
    currentSession: { role: "guard", permissions: ["finance.control.scan"] },
    SchoolSafeAccess: loadAccess(),
    SchoolSafeSecurityAPI: { scan: function () { calls.securityScan += 1; return Promise.resolve({}); } },
    SchoolSafeFinanceAPI: {
      createScan: function () { calls.createScan += 1; return Promise.resolve({}); },
      listCampaigns: function () { calls.listCampaigns += 1; return Promise.resolve([]); }
    },
    ssState: state,
    ssBadge: function (props) { return "<span>" + (props.label || "") + "</span>"; },
    ssButton: function (props) { return "<button>" + (props.label || "") + "</button>"; }
  };
  const document = { getElementById: function (id) { if (!elements[id]) elements[id] = createElement(id, elements, controls); return elements[id]; } };
  vm.runInNewContext(moduleSource, { window: root, document: document, Promise: Promise, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, console: console });
  return { module: root.SchoolSafeFeeControlModule, elements: elements, calls: calls };
}

async function render(subject) {
  subject.module.render("feeControlContent");
  await Promise.resolve();
  await Promise.resolve();
}

async function main() {
  const demo = load({ demoMode: true });
  await render(demo);
  assert.ok(demo.elements.feeControlHistory, "Le mode démo doit créer la surface Historique autorisé.");
  assert.match(demo.elements.feeControlContent.innerHTML, /Historique autorisé/i, "Le mode démo doit rendre l’historique autorisé.");
  assert.match(demo.elements.feeControlContent.innerHTML, /DÉMO/, "L’historique local doit être explicitement démo.");
  assert.match(demo.elements.feeControlContent.innerHTML, /En règle/, "Le résultat ok doit être rendu.");
  assert.match(demo.elements.feeControlContent.innerHTML, /Paiement partiel/, "Le résultat partial doit être rendu.");
  assert.match(demo.elements.feeControlContent.innerHTML, /Non en règle/, "Le résultat unpaid doit être rendu.");
  assert.match(demo.elements.feeControlContent.innerHTML, /Exempté/, "Le résultat exempted doit être rendu.");
  assert.match(demo.elements.feeControlContent.innerHTML, /NO_STUDENT_FEE/, "NO_STUDENT_FEE doit rester une anomalie explicite.");
  assert.match(demo.elements.feeControlContent.innerHTML, /Doublon démo/, "Le doublon doit rester explicitement démo.");
  assert.doesNotMatch(demo.elements.feeControlContent.innerHTML, /Montant|Devise|Solde|Reçu|Transaction|Caisse|Tél|téléphone|personnes autorisées|photo|location_id|Security/i, "Aucune donnée financière ou Sécurité sensible ne doit être rendue.");

  demo.elements.feeControlHistoryResult.value = "anomaly";
  demo.elements.feeControlHistoryResult.trigger("change");
  assert.match(demo.elements.feeControlHistoryList.innerHTML, /NO_STUDENT_FEE/, "Le filtre résultat doit conserver l’anomalie choisie.");
  assert.doesNotMatch(demo.elements.feeControlHistoryList.innerHTML, /En règle/, "Le filtre résultat doit retirer les autres résultats.");

  demo.elements.feeControlHistoryCampaign.value = "demo-history-gate";
  demo.elements.feeControlHistoryCampaign.trigger("change");
  assert.match(demo.elements.feeControlHistoryList.innerHTML, /Portail · septembre/, "Le filtre campagne doit conserver les lignes de la campagne sélectionnée.");
  assert.doesNotMatch(demo.elements.feeControlHistoryList.innerHTML, /Bibliothèque · septembre/, "Le filtre campagne doit retirer les autres campagnes.");

  demo.elements.feeControlHistoryResult.value = "";
  demo.elements.feeControlHistorySearch.value = "DEMO-005";
  demo.elements.feeControlHistorySearch.trigger("input");
  assert.match(demo.elements.feeControlHistoryList.innerHTML, /Lina Kabasele/, "La recherche doit filtrer par matricule/identité démo.");
  assert.doesNotMatch(demo.elements.feeControlHistoryList.innerHTML, /Amina Kalonji/, "La recherche doit retirer les autres lignes.");

  assert.equal(demo.calls.listCampaigns, 0, "La projection démo ne doit charger aucune liste réelle.");
  assert.equal(demo.calls.securityScan, 0, "L’historique démo ne doit appeler aucune API Sécurité.");
  assert.equal(demo.calls.createScan, 0, "L’historique démo ne doit créer aucun scan réel.");
  assert.doesNotMatch(moduleSource, /listScans\s*[:(]/, "Le lot ne doit pas inventer listScans().");
  assert.doesNotMatch(moduleSource, /role\s*===|role\s*!==/, "Le lot ne doit pas introduire de contrôle de rôle.");

  const real = load({ demoMode: false });
  await render(real);
  assert.ok(real.elements.feeControlHistory, "Le mode réel doit créer la surface Historique autorisé.");
  assert.match(real.elements.feeControlContent.innerHTML, /BACKEND_LATER/, "Le mode réel doit rester BACKEND_LATER.");
  assert.match(real.elements.feeControlContent.innerHTML, /permission dédiée|filtres serveur|pagination/i, "Le mode réel doit annoncer les prérequis de lecture sûre.");
  assert.equal(real.calls.listCampaigns, 0, "Le mode réel ne doit pas charger une liste globale pour l’historique.");
  assert.equal(real.calls.securityScan, 0, "Le mode réel ne doit appeler aucune API Sécurité.");
  assert.equal(real.calls.createScan, 0, "Le mode réel ne doit créer aucun scan.");
}

main().then(function () { console.log("FE-FIN-09A demo authorized history: PASS"); }).catch(function (error) { console.error(error.stack || error.message); process.exitCode = 1; });
