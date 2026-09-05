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

test("access unit is atomic and stops on error", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /\\set ON_ERROR_STOP on/);
  assert.equal((sql.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((sql.match(/^commit;$/gim) ?? []).length, 1);
});

test("the four missing roles exist as templates", async () => {
  const sql = await readUnit("01_role_templates.sql");
  for (const code of ["fee_control", "hr", "staff", "hikvision_admin"]) {
    assert.match(sql, new RegExp(`'${code}'`));
  }
});

test("admin template is an explicit snapshot, never a permanent blind join", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /snapshot EXPLICITE/);
  // la jointure complète n'existe que pour la graine admin, une seule fois
  const crossJoins = sql.match(/cross join iam\.permissions/g) ?? [];
  assert.equal(crossJoins.length, 1);
});

test("parent palmarès is bound to own_children, never school", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /when p\.code = 'palmarques\.read' then 'own_children'/);
});

test("cashier cancellation is conditioned, never free", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /when p\.code = 'finance\.payment\.cancel' then 'within_cancellation_window'/);
  assert.match(sql, /"max_age_hours":24/);
});

test("reference tables are FORCE RLS with zero policy and no direct grants", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /grant\s+\w+[\s\S]{0,80}on iam\.role_template/i);
});

test("hikvision_admin invents no permission (catalogue lock)", async () => {
  const sql = await readUnit("01_role_templates.sql");
  assert.doesNotMatch(sql, /biometric\./i);
  assert.match(sql, /PERMISSION_FUTURE/);
});
