const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const financeModule = fs.readFileSync(path.join(root, "app/modules/finance/finance-module.js"), "utf8");
const index = fs.readFileSync(path.join(root, "app/index.html"), "utf8");

function expect(pattern, message) {
  assert.match(financeModule, pattern, message);
}

assert.match(index, /data-finance-tab="assignments"/, "L'onglet Affectation des frais est absent.");
expect(/function renderFeeAssignment\(\)/, "Le rendu FE-FIN-03 est absent.");
expect(/Affecter un frais/, "Le titre FE-FIN-03 est absent.");
expect(/Cycle/, "Le ciblage par cycle est absent.");
expect(/Une classe/, "Le ciblage par classe est absent.");
expect(/Plusieurs classes/, "Le ciblage multi-classes est absent.");
expect(/Un élève/, "Le ciblage individuel est absent.");
expect(/Plusieurs élèves/, "Le ciblage multi-élèves est absent.");
expect(/Année scolaire : connexion backend requise/, "La dépendance d'année scolaire doit être explicite.");
expect(/Liste indisponible — connexion backend requise/, "L'absence de projection Finance classes/élèves doit être explicite.");
expect(/Configuration prête — connexion backend requise pour appliquer l’affectation\./, "La confirmation non connectée est absente.");
expect(/unique\(student_id, fee_structure_id\)/, "Le contrat anti-doublon doit être affiché.");
expect(/absence d’affectation/i, "Le contrat Contrôle des frais doit distinguer l'absence d'affectation.");
assert.doesNotMatch(financeModule, /createStudentFee|createFeeAssignment|applyFeeAssignment|\/finance\/fee-assignments/i, "FE-FIN-03 ne doit pas créer de route ou d'API d'affectation.");
assert.doesNotMatch(financeModule, /queueOfflineOperation\(\s*["']finance["']\s*,\s*["'][^"']*affect/i, "FE-FIN-03 ne doit pas créer d'opération hors-ligne fictive.");

const assignmentRenderer = financeModule.slice(
  financeModule.indexOf("function renderFeeAssignment()"),
  financeModule.indexOf("function renderCash()")
);
assert.doesNotMatch(assignmentRenderer, /\.createStudentFee|\.createFeeAssignment|\.applyFeeAssignment|\.listStudentFees|localStorage|queueOfflineOperation/, "Le rendu d'affectation ne doit ni appeler d'API, ni persister une intention locale.");

console.log("FE-FIN-03 static contract: PASS");
