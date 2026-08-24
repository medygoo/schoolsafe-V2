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

function button(props) {
  props = props || {};
  const attrs = Object.assign({}, props.attrs || {});
  if (props.disabled) attrs.disabled = "disabled";
  return "<button " + Object.keys(attrs).map(function (key) { return key + '=\"' + attrs[key] + '\"'; }).join(" ") + ">" + (props.label || "") + "</button>";
}

function createElement(id, elements, controls) {
  const listeners = {};
  let html = "";
  const element = {
    attributes: {},
    classList: { remove: function () {} },
    addEventListener: function (type, listener) { listeners[type] = listener; },
    getAttribute: function (name) { return this.attributes[name] || null; },
    hasListener: function (type) { return typeof listeners[type] === "function"; },
    trigger: function (type, event) { if (listeners[type]) listeners[type].call(this, event || { preventDefault: function () {} }); },
    querySelectorAll: function (selector) {
      if (selector === "input[name='feeControlCampaign']") return controls.radios;
      if (selector === "[data-result]") return controls.results;
      return [];
    },
    querySelector: function (selector) {
      if (selector === "#feeControlQrInput") return elements.feeControlQrInput || null;
      if (selector === "#feeControlResult") return elements.feeControlResult || null;
      return null;
    }
  };
  Object.defineProperty(element, "innerHTML", {
    get: function () { return html; },
    set: function (value) {
      html = String(value || "");
      if (id === "feeControlContent") {
        if (/id="feeControlQrInput"/.test(html)) {
          elements.feeControlQrInput = createElement("feeControlQrInput", elements, controls);
        }
        if (/id="feeControlResult"/.test(html)) {
          elements.feeControlResult = createElement("feeControlResult", elements, controls);
        }
        controls.results = Array.from(html.matchAll(/data-result="([^"]+)"/g), function (match) {
          const result = createElement("result-" + match[1], elements, controls);
          result.attributes["data-result"] = match[1];
          return result;
        });
        if (/id="feeControlCampaigns"/.test(html) && !elements.feeControlCampaigns) {
          elements.feeControlCampaigns = createElement("feeControlCampaigns", elements, controls);
        }
      }
      if (id === "feeControlCampaigns") {
        controls.radios = Array.from(html.matchAll(/name="feeControlCampaign" value="([^"]+)"/g), function (match) {
          const radio = createElement("campaign-" + match[1], elements, controls);
          radio.value = match[1];
          radio.attributes.name = "feeControlCampaign";
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

function loadController(options) {
  options = options || {};
  const elements = {};
  const controls = { radios: [], results: [] };
  const calls = { listCampaigns: 0, securityScan: 0, createScan: 0 };
  const access = loadAccess();
  const root = {
    schoolSafeDemoMode: !!options.demoMode,
    location: { hostname: options.demoMode ? "localhost" : "schoolsafe.example" },
    localStorage: { getItem: function () { return null; } },
    currentSession: options.session,
    currentDemoRole: options.demoMode ? "admin" : "guard",
    SchoolSafeAccess: access,
    SchoolSafeFinanceAPI: {
      listCampaigns: function () {
        calls.listCampaigns += 1;
        return Promise.resolve([{ id: "global-campaign", label: "Campagne globale", status: "published", description: "Instruction globale", fee_structures: { label: "Transport", amount: 450, currency: "USD" } }]);
      },
      createScan: function () { calls.createScan += 1; return Promise.resolve({}); }
    },
    SchoolSafeSecurityAPI: { scan: function () { calls.securityScan += 1; return Promise.resolve({}); } },
    ssState: state,
    ssBadge: function (props) { return "<span>" + (props.label || "") + "</span>"; },
    ssButton: button
  };
  const document = {
    getElementById: function (id) {
      if (!elements[id]) elements[id] = createElement(id, elements, controls);
      return elements[id];
    }
  };
  vm.runInNewContext(moduleSource, { window: root, document: document, Promise: Promise, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, console: console });
  return { module: root.SchoolSafeFeeControlModule, elements: elements, controls: controls, calls: calls };
}

async function render(subject) {
  subject.module.render("feeControlContent");
  await Promise.resolve();
  await Promise.resolve();
}

async function main() {
  const guard = { role: "guard", permissions: ["finance.control.scan"] };
  const access = loadAccess();
  assert.equal(access.isBranchVisible(guard, "feeControl"), true, "finance.control.scan seul doit ouvrir Contrôle des frais.");
  assert.equal(access.isBranchVisible(guard, "finance"), false, "finance.control.scan seul ne doit pas ouvrir Finance générale.");

  const real = loadController({ session: guard });
  await render(real);
  assert.equal(real.calls.listCampaigns, 0, "Le mode réel ne doit pas charger la liste globale non filtrée.");
  assert.match(real.elements.feeControlCampaigns.innerHTML, /BACKEND_LATER/, "Le mode réel doit expliquer que la projection autorisée doit être filtrée côté serveur.");
  assert.doesNotMatch(real.elements.feeControlCampaigns.innerHTML, /450|USD|Transport|Montant|Devise|Solde|Reçu|Transaction|Caisse/i, "Le rendu contrôleur réel ne doit exposer aucune donnée financière.");

  const demo = loadController({ demoMode: true, session: guard });
  await render(demo);
  assert.equal(demo.calls.listCampaigns, 0, "La projection démo ne doit pas appeler la liste serveur globale.");
  assert.match(demo.elements.feeControlCampaigns.innerHTML, /Mes campagnes autorisées/, "La projection démo doit présenter le titre cible.");
  assert.match(demo.elements.feeControlCampaigns.innerHTML, /DÉMO/, "La projection doit être explicitement démo.");
  assert.match(demo.elements.feeControlCampaigns.innerHTML, /Consigne/, "La consigne doit être visible au contrôleur.");
  assert.doesNotMatch(demo.elements.feeControlCampaigns.innerHTML, /USD|CDF|\$|FC|450|Montant|Devise|Solde|Reçu|Transaction|Caisse/i, "La projection démo ne doit contenir aucun montant, devise ou autre donnée financière.");
  assert.equal(demo.controls.radios.length, 1, "Une campagne démo doit être sélectionnable.");
  assert.equal(demo.controls.radios[0].hasListener("change"), true, "La sélection de campagne doit réagir au changement.");
  assert.equal(demo.controls.results.length, 0, "Aucun bouton de choix manuel du résultat ne doit rester dans la surface démo.");
  assert.equal(demo.calls.securityScan, 0, "Le rendu ne doit déclencher aucun scan Sécurité.");
  assert.equal(demo.calls.createScan, 0, "Le rendu ne doit créer aucun résultat de contrôle.");

  const denied = loadController({ session: { role: "guard", permissions: [] } });
  await render(denied);
  assert.match(denied.elements.feeControlCampaigns.innerHTML, /non autorisé/i, "Sans permission, la surface doit refuser par défaut.");
  assert.doesNotMatch(moduleSource, /role\s*===|role\s*!==/, "FE-FIN-07B ne doit pas introduire de contrôle de rôle.");
}

main().then(function () { console.log("FE-FIN-07B controller campaign surface: PASS"); }).catch(function (error) { console.error(error.stack || error.message); process.exitCode = 1; });
