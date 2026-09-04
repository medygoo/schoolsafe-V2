import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../scripts/spike-baseline-context.mjs", import.meta.url), "utf8");

test("spike refuses any database other than schoolsafe_test", () => {
  assert.match(src, /PGDATABASE\s*!==\s*"schoolsafe_test"/);
});

test("spike refuses any role other than schoolsafe_api", () => {
  assert.match(src, /PGUSER\s*!==\s*"schoolsafe_api"/);
});

test("spike requires an explicit confirmation token", () => {
  assert.match(src, /SPIKE_SCHOOLSAFE_TEST_ONLY/);
});

test("spike never prints the password", () => {
  assert.doesNotMatch(src, /console\.(log|info|error)\([^)]*PGPASSWORD/);
});

test("spike calls api.set_request_context with parameters, never string interpolation", () => {
  assert.match(src, /api\.set_request_context\(\$1,\s*\$2,\s*\$3,\s*\$4\)/);
});

test("spike always rolls back", () => {
  assert.match(src, /ROLLBACK/);
});
