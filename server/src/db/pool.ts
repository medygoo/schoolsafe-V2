// SchoolSafe — pool PostgreSQL direct (baseline VPS).
// Le rôle configuré doit être schoolsafe_api : aucun accès table direct,
// uniquement les fonctions du schéma api (vérifié par la baseline).
import { Pool } from "pg";
import type { AppEnv } from "../config/env.js";

export function createPgPool(env: AppEnv): Pool {
  if (!env.PGHOST || !env.PGDATABASE || !env.PGUSER || !env.PGPASSWORD) {
    throw new Error("PGHOST, PGDATABASE, PGUSER et PGPASSWORD sont requis pour le pool PostgreSQL");
  }
  return new Pool({
    host: env.PGHOST,
    port: env.PGPORT,
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    max: env.PG_POOL_MAX,
    statement_timeout: env.PG_STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: 5000,
  });
}
