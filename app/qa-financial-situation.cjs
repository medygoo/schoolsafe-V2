const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const moduleSource = fs.readFileSync(path.join(__dirname, "modules/finance/finance-module.js"), "utf8");

function primitive(tagName) {
  return function (props) {
    props = props || {};
    if (tagName === "table") return '<table class="finance-table">' + (props.rows || "") + "</table>";
    if (tagName === "state") return '<section class="ss-state"><h3>' + (props.title || "") + "</h3><p>" + (props.message || "") + "</p></section>";
    if (tagName === "field") return props.inputHtml || "";
    if (tagName === "input") return '<input id="' + (props.id || "") + '" value="' + (props.value || "") + '">';
    if (tagName === "select") return '<select id="' + (props.id || "") + '">' + (props.options || []).map(function (option) {
      return '<option value="' + option.value + '">' + option.label + "</option>";
    }).join("") + "</select>";
    return '<span class="ss-' + tagName + '">' + (props.label || "") + "</span>";
  };
}

function loadDemoModule() {
  const elements = {
    financeModule: { hidden: true },
    financeContent: { innerHTML: "" },
    financeModuleTitle: { textContent: "" },
    workspaceTitle: { textContent: "" },
    cardsProtected: { hidden: false }
  };
  const window = {
    schoolSafeDemoMode: true,
    location: { hostname: "127.0.0.1" },
    localStorage: { getItem: function () { return null; } },
    SchoolSafeAccess: {
      canAccess: function (user, permission) {
        return user && user.role === "admin" || !!(user && user.permissions && user.permissions.includes(permission));
      }
    },
    ssState: primitive("state"),
    ssTable: primitive("table"),
    ssBadge: primitive("badge"),
    ssField: primitive("field"),
    ssInput: primitive("input"),
    ssSelect: primitive("select"),
    ssButton: primitive("button"),
    ssIconButton: primitive("icon-button"),
    money: function (value) { return Number(value || 0).toLocaleString("fr-FR") + " FC"; },
    certificationStatusClass: function () { return "info"; },
    icons: function () {},
    notify: function () {},
    queueOfflineOperation: function () { return Promise.resolve(null); }
  };
  const document = {
    getElementById: function (id) { return elements[id] || null; },
    querySelector: function (selector) {
      if (selector === ".workspace-grid") return { hidden: false };
      if (selector === ".workspace-content") return { scrollTo: function () {} };
      return null;
    },
    querySelectorAll: function () { return []; }
  };
  vm.runInNewContext(moduleSource, { window: window, document: document, console: console, Date: Date, Promise: Promise, Object: Object, Array: Array, Number: Number, String: String, RegExp: RegExp, JSON: JSON, setTimeout: setTimeout });
  return { module: window.SchoolSafeFinanceModule, elements: elements };
}

async function renderSituation(subject) {
  subject.module.setRole("admin");
  subject.module.render("financeModule", { action: "soldes" });
  await Promise.resolve();
  await Promise.resolve();
  return subject.elements.financeContent.innerHTML;
}

async function main() {
  const subject = loadDemoModule();
  let html = await renderSituation(subject);
  const state = subject.module._state;

  assert.ok(Array.isArray(state.studentFinancialProfiles), "La projection studentFinancialProfiles doit exister.");
  assert.ok(Array.isArray(state.studentFees), "Les studentFees doivent être séparés des students.");
  assert.match(html, /id="financeFinancialStudent"/, "La situation doit sélectionner un élève unique.");
  assert.doesNotMatch(html, /id="paymentForm"/, "La situation financière ne doit pas déclencher un paiement.");

  const lucas = state.studentFinancialProfiles.find(function (profile) { return profile.student.id === "demo-s1"; });
  assert.equal(lucas.fees.length, 2, "Lucas doit présenter deux obligations financières distinctes.");
  assert.ok(lucas.fees.every(function (fee) {
    return fee.student_id === lucas.student.id && fee.student_fee_id !== lucas.student.id && fee.fee_structure_id;
  }), "Les identifiants élève, obligation et structure doivent rester distincts.");
  assert.match(html, /Transport scolaire/, "Le libellé doit être résolu depuis fee_structure.");
  assert.match(html, /100[\s\u202f]000 USD/, "La devise doit être résolue depuis fee_structure.");
  assert.match(html, /À payer/, "pending doit être affiché comme À payer.");
  assert.match(html, /Paiement partiel/, "partial doit être affiché comme Paiement partiel.");
  const selectedOptions = html.match(/<select id="financeFinancialStudent">([\s\S]*?)<\/select>/)[1].match(/<option /g) || [];
  assert.equal(selectedOptions.length, state.studentFinancialProfiles.length, "Chaque élève doit apparaître une seule fois dans la sélection.");

  assert.deepEqual(
    Array.from(new Set(state.studentFinancialProfiles.flatMap(function (profile) { return profile.fees.map(function (fee) { return fee.status; }); }))).sort(),
    ["exempted", "paid", "partial", "pending"],
    "Les quatre statuts financiers doivent être conservés dans la projection."
  );

  state.selectedFinancialStudentId = "demo-s2";
  html = await renderSituation(subject);
  assert.match(html, /En règle/, "paid doit être affiché comme En règle.");

  state.selectedFinancialStudentId = "demo-s5";
  html = await renderSituation(subject);
  assert.match(html, /Exempté/, "exempted doit être affiché comme Exempté.");

  state.selectedFinancialStudentId = "demo-student-no-fee";
  html = await renderSituation(subject);
  assert.match(html, /Aucune obligation financière affectée/, "Un élève sans frais ne doit pas être présenté comme non en règle.");
}

main().then(function () {
  console.log("FE-FIN-04 financial situation: PASS");
}).catch(function (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
