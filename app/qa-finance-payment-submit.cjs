const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "modules/finance/finance-module.js"), "utf8");

function makeElement(attributes) {
  const listeners = {};
  return {
    attributes: attributes || {},
    fields: {},
    value: (attributes && (attributes["data-value"] || attributes.value)) || "",
    addEventListener: function (type, listener) { listeners[type] = listener; },
    trigger: function (type) { listeners[type].call(this, { preventDefault: function () {} }); },
    getAttribute: function (name) { return this.attributes[name] || null; }
  };
}

function attributesFromMarkup(markup) {
  const attributes = {};
  String(markup || "").replace(/([\w-]+)="([^"]*)"/g, function (_match, key, value) { attributes[key] = value; return _match; });
  return attributes;
}

function primitives(tag) {
  return function (props) {
    props = props || {};
    if (tag === "state") return '<section class="ss-state">' + (props.title || "") + " " + (props.message || "") + "</section>";
    if (tag === "field") return props.inputHtml || "";
    if (tag === "table") return "<table>" + (props.rows || "") + "</table>";
    if (tag === "badge" || tag === "icon") return "<span>" + (props.label || "") + "</span>";
    if (tag === "input") return '<input id="' + (props.id || "") + '" name="' + (props.name || "") + '" type="' + (props.type || "text") + '" min="' + (props.min == null ? "" : props.min) + '" max="' + (props.max == null ? "" : props.max) + '" step="' + (props.step == null ? "" : props.step) + '" value="' + (props.value || "") + '">';
    if (tag === "select") return '<select id="' + (props.id || "") + '" name="' + (props.name || "") + '" data-value="' + (props.value || "") + '">' + (props.options || []).map(function (option) { return '<option value="' + option.value + '">' + option.label + "</option>"; }).join("") + "</select>";
    if (tag === "button") return '<button type="' + (props.type || "button") + '">' + (props.label || "") + "</button>";
    return "";
  };
}

function loadModule(options) {
  options = options || {};
  const elements = {
    financeModule: makeElement(),
    financeModuleTitle: makeElement(),
    workspaceTitle: makeElement(),
    cardsProtected: makeElement()
  };
  let html = "";
  const content = makeElement();
  Object.defineProperty(content, "innerHTML", {
    get: function () { return html; },
    set: function (value) {
      html = value;
      ["financeCashStudent", "financeCashStudentFee", "paymentForm"].forEach(function (id) {
        const match = html.match(new RegExp("<(?:select|form)[^>]*id=\\\"" + id + "\\\"[^>]*>"));
        if (match) elements[id] = makeElement(attributesFromMarkup(match[0]));
        else delete elements[id];
      });
    }
  });
  elements.financeContent = content;
  const calls = [];
  const window = {
    schoolSafeDemoMode: options.demoMode !== false,
    location: { hostname: options.demoMode === false ? "schoolsafe.example" : "127.0.0.1" },
    localStorage: { getItem: function () { return null; } },
    currentSession: options.session || { role: "admin", permissions: [] },
    SchoolSafeAccess: { canAccess: function (user, permission) { return !!(user && (user.role === "admin" || (user.permissions || []).includes(permission))); } },
    SchoolSafeFinanceAPI: options.api || { createPayment: function (input) { calls.push(input); return Promise.resolve({ payment: { id: "payment-confirmed", student_fee_id: input.student_fee_id } }); } },
    ssState: primitives("state"), ssField: primitives("field"), ssTable: primitives("table"), ssBadge: primitives("badge"), ssIconButton: primitives("icon"), ssInput: primitives("input"), ssSelect: primitives("select"), ssButton: primitives("button"),
    money: function (amount) { return String(amount); }, certificationStatusClass: function () { return "info"; }, icons: function () {}, notify: function () {}
  };
  const document = {
    getElementById: function (id) { return elements[id] || null; },
    querySelector: function (selector) { if (selector === ".workspace-grid") return makeElement(); if (selector === ".workspace-content") return { scrollTo: function () {} }; return null; },
    querySelectorAll: function () { return []; }
  };
  function FormData(form) { this.get = function (name) { return form.fields[name] == null ? "" : form.fields[name]; }; }
  vm.runInNewContext(source, { window: window, document: document, console: console, Date: Date, Promise: Promise, Object: Object, Array: Array, Number: Number, String: String, RegExp: RegExp, JSON: JSON, setTimeout: setTimeout, FormData: FormData, navigator: options.navigator || { onLine: true } });
  return { module: window.SchoolSafeFinanceModule, elements: elements, calls: calls };
}

function realPaymentSubject(calls) {
  const studentFees = [
    { id: "demo-sf-lucas-school", student_id: "demo-s1", fee_structure_id: "demo-2", amount_expected: 450000, amount_paid: 350000, amount_remaining: 100000, status: "partial", students: { id: "demo-s1", first_name: "Lucas", last_name: "Martin" } },
    { id: "demo-sf-lucas-transport", student_id: "demo-s1", fee_structure_id: "demo-4", amount_expected: 100000, amount_paid: 0, amount_remaining: 100000, status: "pending", students: { id: "demo-s1", first_name: "Lucas", last_name: "Martin" } }
  ];
  const subject = loadModule({
    demoMode: false,
    session: { role: "cashier", permissions: ["finance.payment.record", "finance.fee.read"] },
    api: {
      listFeeStructures: function () { return Promise.resolve([{ id: "demo-2", label: "Frais scolaires", cycle_key: "primary", amount: 450000, currency: "CDF", is_active: true }, { id: "demo-4", label: "Transport scolaire", cycle_key: "primary", amount: 100000, currency: "USD", is_active: true }]); },
      listStudentFees: function () { return Promise.resolve(studentFees); },
      getDailyReport: function () { return Promise.resolve({ payments: [] }); },
      createPayment: function (input) { calls.push(input); return Promise.resolve({ payment: { id: "payment-confirmed", student_fee_id: input.student_fee_id } }); }
    }
  });
  return subject;
}

async function render(subject) {
  subject.module.render("financeModule", { action: "encaissement" });
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
}

async function submit(subject, fields) {
  subject.elements.paymentForm.fields = fields;
  subject.elements.paymentForm.trigger("submit");
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function main() {
  const transportCalls = [];
  const transport = realPaymentSubject(transportCalls);
  transport.module._state.selectedCashStudentId = "demo-s1";
  transport.module._state.selectedCashStudentFeeId = "demo-sf-lucas-transport";
  await render(transport);
  await submit(transport, { amount: "40.50", mode: "mobile_money", reference: "Transport août" });
  assert.equal(transportCalls.length, 1, "Transport doit produire un unique appel API.");
  assert.equal(transportCalls[0].student_fee_id, "demo-sf-lucas-transport", "Transport affiché doit envoyer exactement son student_fee_id.");
  assert.equal(transportCalls[0].currency, "USD", "Transport doit conserver USD.");
  assert.equal(transportCalls[0].amount, 40.5, "Le montant USD doit conserver ses décimales.");
  assert.equal(transportCalls[0].mode, "mobile_money", "Le mode sélectionné doit être conservé.");
  assert.equal(transportCalls[0].reference, "Transport août", "La référence doit être conservée.");

  const schoolCalls = [];
  const school = realPaymentSubject(schoolCalls);
  school.module._state.selectedCashStudentId = "demo-s1";
  school.module._state.selectedCashStudentFeeId = "demo-sf-lucas-school";
  await render(school);
  await submit(school, { amount: "1000", mode: "cash", reference: "Scolarité" });
  assert.equal(schoolCalls[0].student_fee_id, "demo-sf-lucas-school", "Scolarité affichée doit envoyer son student_fee_id.");
  assert.equal(schoolCalls[0].currency, "CDF", "CDF doit être conservé sans conversion.");

  const mismatchCalls = [];
  const mismatch = realPaymentSubject(mismatchCalls);
  mismatch.module._state.selectedCashStudentId = "demo-s1";
  mismatch.module._state.selectedCashStudentFeeId = "demo-sf-lucas-transport";
  await render(mismatch);
  mismatch.elements.paymentForm.attributes["data-student-fee-id"] = "demo-sf-lucas-school";
  await submit(mismatch, { amount: "10", mode: "cash", reference: "Ne doit pas passer" });
  assert.equal(mismatchCalls.length, 0, "Un formulaire dont le student_fee affiché diffère de la sélection active doit être bloqué.");

  const tooHighCalls = [];
  const tooHigh = realPaymentSubject(tooHighCalls);
  tooHigh.module._state.selectedCashStudentId = "demo-s1";
  tooHigh.module._state.selectedCashStudentFeeId = "demo-sf-lucas-transport";
  await render(tooHigh);
  await submit(tooHigh, { amount: "100001", mode: "cash", reference: "Trop élevé" });
  assert.equal(tooHighCalls.length, 0, "Un montant supérieur au restant doit être refusé.");

  const fractionalCdfCalls = [];
  const fractionalCdf = realPaymentSubject(fractionalCdfCalls);
  fractionalCdf.module._state.selectedCashStudentId = "demo-s1";
  fractionalCdf.module._state.selectedCashStudentFeeId = "demo-sf-lucas-school";
  await render(fractionalCdf);
  await submit(fractionalCdf, { amount: "0.5", mode: "cash", reference: "Décimale CDF" });
  assert.equal(fractionalCdfCalls.length, 0, "CDF doit refuser les décimales côté JavaScript.");

  const overPreciseUsdCalls = [];
  const overPreciseUsd = realPaymentSubject(overPreciseUsdCalls);
  overPreciseUsd.module._state.selectedCashStudentId = "demo-s1";
  overPreciseUsd.module._state.selectedCashStudentFeeId = "demo-sf-lucas-transport";
  await render(overPreciseUsd);
  await submit(overPreciseUsd, { amount: "40.501", mode: "cash", reference: "Trop de décimales" });
  assert.equal(overPreciseUsdCalls.length, 0, "USD doit refuser plus de deux décimales côté JavaScript.");

  const demo = loadModule();
  demo.module._state.selectedCashStudentId = "demo-s1";
  demo.module._state.selectedCashStudentFeeId = "demo-sf-lucas-transport";
  await render(demo);
  await submit(demo, { amount: "40.5", mode: "cash", reference: "Démo transport" });
  assert.equal(demo.calls.length, 0, "Le mode démo ne doit jamais appeler l’API de paiement.");
  assert.equal(demo.module._state.transactions[0].status, "Démonstration", "Le paiement démo doit rester explicitement non officiel.");
  assert.equal(demo.module._state.transactions[0].currency, "USD", "Le journal démo doit conserver la devise du student_fee.");
  assert.match(demo.elements.financeContent.innerHTML, /Montants mixtes non cumulés/, "Le journal de caisse ne doit jamais cumuler silencieusement CDF et USD.");

  const offlineCalls = [];
  const studentFee = { id: "sf-real", student_id: "student-real", fee_structure_id: "fee-real", amount_expected: 50, amount_paid: 0, amount_remaining: 50, status: "pending", students: { id: "student-real", first_name: "Jean", last_name: "Mbala" } };
  const offline = loadModule({
    demoMode: false,
    navigator: { onLine: false },
    session: { role: "cashier", permissions: ["finance.payment.record", "finance.fee.read"] },
    api: {
      listFeeStructures: function () { return Promise.resolve([{ id: "fee-real", label: "Transport", cycle_key: "primary", amount: 50, currency: "USD", is_active: true }]); },
      listStudentFees: function () { return Promise.resolve([studentFee]); },
      getDailyReport: function () { return Promise.resolve({ payments: [] }); },
      createPayment: function (input) { offlineCalls.push(input); return Promise.resolve({}); }
    }
  });
  await render(offline);
  assert.ok(offline.elements.paymentForm, "Le paiement réel doit être prêt avant le test offline.");
  await submit(offline, { amount: "10", mode: "cash", reference: "Hors connexion" });
  assert.equal(offlineCalls.length, 0, "Le mode réel hors connexion ne doit pas créer de paiement API.");
  assert.equal(offline.module._state.transactions.length, 0, "Le mode réel hors connexion ne doit pas créer de transaction locale fictive.");
}

main().then(function () { console.log("FE-FIN-05 payment payload: PASS"); }).catch(function (error) { console.error(error.stack || error.message); process.exitCode = 1; });
