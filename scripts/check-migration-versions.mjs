// Garde-fou : chaque version de migration Supabase doit être unique.
// Une version dupliquée casse `supabase db reset` (schema_migrations_pkey)
// et fait sauter silencieusement des fichiers dans push-migrations.cjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
const byVersion = new Map();
for (const file of files) {
  const version = file.split("_")[0];
  if (!byVersion.has(version)) byVersion.set(version, []);
  byVersion.get(version).push(file);
}

const duplicates = [...byVersion.entries()].filter(([, names]) => names.length > 1);
if (duplicates.length > 0) {
  console.error("Duplicate migration versions detected:");
  for (const [version, names] of duplicates) {
    console.error(`  ${version}: ${names.join(", ")}`);
  }
  process.exit(1);
}
console.log(`Migration versions OK: ${files.length} files, ${byVersion.size} unique versions.`);
