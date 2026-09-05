import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const accessCode = await readFile(path.join(root, "app/modules/core/access.js"), "utf8");

function loadAccess() {
  const window = {};
  const fakeFetch = async () => ({ ok: true, json: async () => [] });
  new Function("window", "fetch", "console", accessCode)(window, fakeFetch, console);
  return window.SchoolSafeAccess;
}

const access = loadAccess();

test("normalizeScopes : canonique, natif provisoire, legacy écarté", () => {
  const normalized = access.normalizeScopes([
    { permission: "school.student.read", type: "school", target: null }, // canonique
    { permission: "pedagogy.grade.manage", scope: "assigned_classes", target: "c1" }, // natif provisoire
    { permission: null, type: "school", target: "legacy-1" }, // legacy : écarté
    { type: "own" }, // sans permission : interdit → écarté
    "garbage",
    null,
  ]);
  assert.equal(normalized.length, 2);
  assert.deepEqual(normalized[0], { permission: "school.student.read", type: "school", target: null });
  assert.deepEqual(normalized[1], { permission: "pedagogy.grade.manage", type: "assigned_classes", target: "c1" });
});

test("scope lié au bon code de permission, plusieurs portées différentes", () => {
  const user = {
    permissions: ["pedagogy.grade.read", "pedagogy.grade.manage", "finance.status.read"],
    scopes: [
      { permission: "pedagogy.grade.read", type: "own_children", target: null },
      { permission: "pedagogy.grade.manage", type: "assigned_classes", target: null },
      { permission: "finance.status.read", type: "school", target: null },
    ],
  };
  assert.equal(access.scopeFor(user, "pedagogy.grade.read").type, "own_children");
  assert.equal(access.scopeFor(user, "pedagogy.grade.manage").type, "assigned_classes");
  assert.equal(access.scopeFor(user, "finance.status.read").type, "school");
});

test("même type de portée sur deux permissions sans confusion", () => {
  const user = {
    permissions: ["pedagogy.assignment.read", "pedagogy.grade.manage"],
    scopes: [
      { permission: "pedagogy.assignment.read", type: "assigned_classes", target: "A" },
      { permission: "pedagogy.grade.manage", type: "assigned_classes", target: "B" },
    ],
  };
  assert.equal(access.scopeFor(user, "pedagogy.assignment.read").target, "A");
  assert.equal(access.scopeFor(user, "pedagogy.grade.manage").target, "B");
});

test("admin avec DENY explicite : permission retirée ET portée nulle", () => {
  const user = {
    roles: ["admin"],
    permissions: ["finance.payment.record"],
    deniedPermissions: ["finance.payment.record"],
    scopes: [{ permission: "finance.payment.record", type: "school", target: null }],
  };
  assert.equal(access.canAccess(user, "finance.payment.record"), false);
  assert.equal(access.scopeFor(user, "finance.payment.record"), null);
  assert.equal(access.allowsScope(user, "finance.payment.record", "school"), false);
});

test("aucun bypass admin : un admin sans permission réelle n'a rien", () => {
  const adminSansDroits = { roles: ["admin"], permissions: [] };
  assert.equal(access.canAccess(adminSansDroits, "school.manage"), false);
});

test("multi-rôles : l'union des permissions fonctionne, DENY reste prioritaire", () => {
  const user = {
    roles: ["teacher", "parent"],
    permissions: ["pedagogy.grade.read", "security.pickup.read"],
    deniedPermissions: ["security.pickup.read"],
    scopes: [
      { permission: "pedagogy.grade.read", type: "assigned_classes", target: null },
      { permission: "security.pickup.read", type: "own_children", target: null },
    ],
  };
  assert.equal(access.canAccess(user, "pedagogy.grade.read"), true);
  assert.equal(access.canAccess(user, "security.pickup.read"), false);
});

test("legacy transitoire : portée sans permission = allowsScope faux (fail-closed)", () => {
  const user = {
    permissions: ["pilotage.alerts.read"],
    scopes: [{ permission: null, type: "assigned_classes", target: "x" }],
  };
  assert.equal(access.canAccess(user, "pilotage.alerts.read"), true);
  assert.equal(access.allowsScope(user, "pilotage.alerts.read", "assigned_classes"), false);
});
