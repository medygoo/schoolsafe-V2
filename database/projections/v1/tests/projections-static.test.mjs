import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projDir = path.resolve(here, "..");

async function readUnit(name) {
  return readFile(path.join(projDir, name), "utf8");
}

test("projection unit is atomic and stops on error", async () => {
  const sql = await readUnit("01_student_read.sql");
  assert.match(sql, /\\set ON_ERROR_STOP on/);
  assert.equal((sql.match(/^begin;$/gim) ?? []).length, 1);
  assert.equal((sql.match(/^commit;$/gim) ?? []).length, 1);
});

test("student_read enforces Access_Law before returning anything", async () => {
  const sql = await readUnit("01_student_read.sql");
  assert.match(sql, /iam\.require_access\('school\.student\.read'/);
  // la classe est résolue côté serveur, jamais fournie par le client
  assert.match(sql, /from app\.student_enrollments e[\s\S]*?e\.status = 'active'/);
  assert.doesNotMatch(sql, /p_class_id/);
});

test("student_read returns a filtered projection, never the raw row", async () => {
  const sql = await readUnit("01_student_read.sql");
  assert.match(sql, /jsonb_build_object\(/);
  assert.doesNotMatch(sql, /return pg_catalog\.to_jsonb\(v_student\)/);
  assert.doesNotMatch(sql, /photo_path/);
  assert.doesNotMatch(sql, /return v_student/);
});

test("student_read refuses a student of another school", async () => {
  const sql = await readUnit("01_student_read.sql");
  assert.match(sql, /s\.school_id = v_school_id/);
  assert.match(sql, /Student not found in the active school/);
});

test("execute is granted to schoolsafe_api only, never public", async () => {
  const sql = await readUnit("01_student_read.sql");
  assert.match(sql, /grant execute on function api\.student_read\(uuid\) to schoolsafe_api/);
  assert.doesNotMatch(sql, /to public/i);
  assert.doesNotMatch(sql, /to schoolsafe_auth/i);
});
