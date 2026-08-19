import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export interface RlsTestResult {
  passed: number;
  failed: number;
  error?: string;
}

export async function runRlsTestFile(fileName: string): Promise<RlsTestResult> {
  const sql = readFileSync(resolve("tests/qa/rls", fileName), "utf8");
  const connectionString = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    return { passed: 1, failed: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { passed: 0, failed: 1, error: message };
  } finally {
    await client.end();
  }
}
