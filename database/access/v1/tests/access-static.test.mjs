import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const accessDir = path.resolve(here, "..");

async function readUnit(name) {
  return readFile(path.join(accessDir, name), "utf8");
}

// Extrait la matrice d'un rôle : chaque insert se termine par "on conflict
// do nothing;" — on découpe là-dessus, puis on retient le bloc du rôle.
async function roleMatrix(roleCode) {
  const sql = await readUnit("01_role_templates.sql");
  const chunk = sql
    .split("on conflict do nothing;")
    .find((c) => c.includes(`where t.code = '${roleCode}'`));
  assert.ok(chunk, `matrice introuvable pour ${roleCode}`);
  // ne conserver que le bloc VALUES (sinon les contraintes CHECK polluent)
  const start = chunk.indexOf("from (values");
  const end = chunk.indexOf(") as v(");
  assert.ok(start > -1 && end > start, `bloc VALUES introuvable pour ${roleCode}`);
  const valuesPart = chunk.slice(start, end);
  const rows = [];
  const rowPattern = /\('([^']+)',\s*'([^']+)'(?:,('[^']*'|null))?(?:,('[^']*'|null))?\)/g;
  let m;
  while ((m = rowPattern.exec(valuesPart)) !== null) {
    const params = m[4] && m[4] !== "null" ? JSON.parse(m[4].slice(1, -1)) : null;
    rows.push([m[1], m[2], m[3] ? m[3].slice(1, -1) : null, params]);
  }
  return rows;
}

test("access unit is atomic and stops on error", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /\\set ON_ERROR_STOP on/);
  assert.equal((sql.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((sql.match(/^commit;$/gim) ?? []).length, 1);
});

test("teacher: grade.read = assigned_classes, jamais own_children", async () => {
  const matrix = await roleMatrix("teacher");
  const gradeRead = matrix.find((r) => r[0] === "pedagogy.grade.read");
  assert.equal(gradeRead[1], "assigned_classes");
  const palmares = matrix.find((r) => r[0] === "palmarques.read");
  assert.equal(palmares[1], "assigned_classes");
  const guardian = matrix.find((r) => r[0] === "school.guardian.read");
  assert.equal(guardian[1], "assigned_classes");
  assert.ok(matrix.every((r) => r[1] !== "own_children"));
});

test("parent: tout est own_children, sans exception", async () => {
  const matrix = await roleMatrix("parent");
  for (const code of ["pedagogy.grade.read", "palmarques.read", "finance.status.read", "finance.receipt.read", "security.pickup.read", "school.guardian.read"]) {
    const row = matrix.find((r) => r[0] === code);
    assert.ok(row, `${code} absent du parent`);
    assert.equal(row[1], "own_children", `${code} doit être own_children`);
  }
});

test("guard: tout est assigned_portal, jamais assigned_classes", async () => {
  const matrix = await roleMatrix("guard");
  const scan = matrix.find((r) => r[0] === "security.scan");
  assert.equal(scan[1], "assigned_portal");
  const events = matrix.find((r) => r[0] === "security.events.read");
  assert.equal(events[1], "assigned_portal");
  assert.ok(matrix.every((r) => r[1] === "assigned_portal" || ["none", "own"].includes(r[1])));
});

test("cashier: finance en school + annulation conditionnée 24h", async () => {
  const matrix = await roleMatrix("cashier");
  const status = matrix.find((r) => r[0] === "finance.status.read");
  assert.equal(status[1], "school");
  const fee = matrix.find((r) => r[0] === "finance.fee.read");
  assert.equal(fee[1], "school");
  const cancel = matrix.find((r) => r[0] === "finance.payment.cancel");
  assert.equal(cancel[2], "within_cancellation_window");
  assert.deepEqual(cancel[3], { max_age_hours: 24 });
});

test("direction et pedagogy: aucune portée own_children accidentelle", async () => {
  for (const role of ["school_head", "pedagogy"]) {
    const matrix = await roleMatrix(role);
    assert.ok(
      matrix.every((r) => r[1] !== "own_children"),
      `${role} ne doit rien borner à own_children`,
    );
    const gradeRead = matrix.find((r) => r[0] === "pedagogy.grade.read");
    if (gradeRead) assert.equal(gradeRead[1], "school");
  }
});

test("admin: snapshot figé des 60 codes explicites, aucune jointure aveugle", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.doesNotMatch(sql, /cross join iam\.permissions/i);
  const matrix = await roleMatrix("admin");
  assert.equal(matrix.length, 60, "admin doit figer exactement 60 permissions explicites");
  assert.ok(matrix.some((r) => r[0] === "school.student.create"));
});

test("les quatre rôles manquants existent avec leurs matrices", async () => {
  for (const role of ["fee_control", "hr", "staff", "hikvision_admin"]) {
    const matrix = await roleMatrix(role);
    assert.ok(matrix.length >= 6, `${role} doit avoir au moins le bloc commun`);
  }
});

test("aucune permission future inventée (biométrie, audit.read)", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.doesNotMatch(sql, /"biometric\./);
  assert.doesNotMatch(sql, /"audit\.read"/);
});

test("reference tables are FORCE RLS with zero policy and no direct grants", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /grant\s+\w+[\s\S]{0,80}on iam\.role_template/i);
});
