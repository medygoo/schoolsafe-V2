import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");

const directory = path.resolve("tests/rls");
const files = (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  for (const file of files) {
    const sql = await fs.readFile(path.join(directory, file), "utf8");
    await client.query(sql);
    console.log(`PASS ${file}`);
  }
} finally {
  await client.end();
}
