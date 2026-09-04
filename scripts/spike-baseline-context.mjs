// Spike baseline v1 — prouve les REFUS fail-closed sur schoolsafe_test uniquement.
// Jamais de PROD, jamais de seed : on vérifie que SANS identité valide, tout est refusé.
import pg from "pg";

function fail(message) {
  console.error(JSON.stringify({ ok: false, reason: message }));
  process.exit(1);
}

if (process.env.SCHOOLSAFE_SPIKE_CONFIRM !== "SPIKE_SCHOOLSAFE_TEST_ONLY") {
  fail("missing confirmation token");
}
if (process.env.PGDATABASE !== "schoolsafe_test") fail("PGDATABASE must be schoolsafe_test");
if (process.env.PGUSER !== "schoolsafe_api") fail("PGUSER must be schoolsafe_api");
if (!process.env.PGPASSWORD) fail("PGPASSWORD env required (never printed)");

const client = new pg.Client();
await client.connect();

const result = { contextRejected: false, accessDenied: false, tableDenied: false };
try {
  await client.query("BEGIN");

  // 1. Contexte incomplet refusé (fail-closed)
  try {
    await client.query("select api.set_request_context($1, $2, $3, $4)", [null, null, null, null]);
  } catch (err) {
    result.contextRejected = /Complete SchoolSafe request context is required/.test(err.message);
  }

  // 2. check_access sans contexte valide => false (DENY par défaut)
  const { rows } = await client.query("select api.check_access($1) as allowed", ["school.manage"]);
  result.accessDenied = rows[0] && rows[0].allowed === false;

  // 3. Lecture directe de table métier refusée au rôle schoolsafe_api (ACL fonctions seules)
  try {
    await client.query("select count(*) from app.schools");
  } catch (err) {
    result.tableDenied = /permission denied/i.test(err.message);
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}

const ok = result.contextRejected && result.accessDenied && result.tableDenied;
console.log(JSON.stringify({ ok, ...result }));
process.exit(ok ? 0 : 1);
