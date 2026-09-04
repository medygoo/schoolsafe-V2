import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.resolve(here, "..");

async function readUnit(name) {
  return readFile(path.join(authDir, name), "utf8");
}

test("auth units are atomic and stop on error", async () => {
  for (const name of ["01_auth_tables.sql", "02_auth_api.sql"]) {
    const sql = await readUnit(name);
    assert.match(sql, /\\set ON_ERROR_STOP on/);
    assert.equal((sql.match(/^begin;$/gim) ?? []).length, 1);
    assert.equal((sql.match(/^commit;$/gim) ?? []).length, 1);
  }
});

test("auth schema stores no plaintext secrets and hashes sessions", async () => {
  const tables = await readUnit("01_auth_tables.sql");
  assert.match(tables, /password_hash/);
  assert.match(tables, /token_hash/);
  assert.doesNotMatch(tables, /\bpassword\s+text\b/i);
  assert.doesNotMatch(tables, /\btoken\s+text\b/i);
  assert.match(tables, /references iam\.users/);
});

test("auth api never exposes tables directly to schoolsafe_api", async () => {
  const api = await readUnit("02_auth_api.sql");
  assert.match(api, /revoke all on all tables in schema auth from schoolsafe_api/);
  assert.doesNotMatch(api, /grant\s+(select|insert|update|delete)[\s\S]{0,80}on auth\./i);
  const functions = [...api.matchAll(/create or replace function (api\.\w+)/g)].map(
    (m) => m[1],
  );
  assert.equal(functions.length, 7);
  for (const fn of functions) {
    assert.match(api, new RegExp(`grant execute on function ${fn.replace(".", "\\.")}`));
  }
});

test("auth api is anti-enumeration and fail-closed", async () => {
  const api = await readUnit("02_auth_api.sql");
  assert.match(api, /auth_resolve_identity[\s\S]*?limit 1/);
  assert.match(api, /auth_resolve_session[\s\S]*?revoked_at is null[\s\S]*?expires_at > /);
  assert.match(api, /status = 'active'/);
});

test("auth api enforces argon2id and token hash shape", async () => {
  const api = await readUnit("02_auth_api.sql");
  assert.match(api, /\$argon2id\$/);
  assert.match(api, /\^\[a-f0-9\]\{64\}/);
});
