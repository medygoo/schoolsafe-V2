// SchoolSafe — pools PostgreSQL séparés par rôle (verrou d'architecture) :
//   schoolsafe_auth  → RPC d'authentification uniquement ;
//   schoolsafe_api   → RPC métier / ACCESS_LAW uniquement.
// Les deux types sont nominalement incompatibles : un pool ne peut jamais
// être branché à la place de l'autre (vérifié par le compilateur).
import { Pool } from "pg";
import type { AppEnv } from "../config/env.js";

declare const authPoolBrand: unique symbol;
declare const businessPoolBrand: unique symbol;

export type AuthPool = Pool & { readonly [authPoolBrand]: "schoolsafe_auth" };
export type BusinessPool = Pool & { readonly [businessPoolBrand]: "schoolsafe_api" };

function baseConfig(env: AppEnv) {
  if (!env.PGHOST || !env.PGDATABASE) {
    throw new Error("PGHOST et PGDATABASE sont requis pour le pool PostgreSQL");
  }
  return {
    host: env.PGHOST,
    port: env.PGPORT,
    database: env.PGDATABASE,
    max: env.PG_POOL_MAX,
    statement_timeout: env.PG_STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: 5000,
  };
}

// Pool AUTH : identité uniquement (api.auth_*).
export function createAuthPool(env: AppEnv): AuthPool {
  if (!env.PGAUTH_USER || !env.PGAUTH_PASSWORD) {
    throw new Error("PGAUTH_USER et PGAUTH_PASSWORD sont requis pour le pool d'authentification");
  }
  return new Pool({
    ...baseConfig(env),
    user: env.PGAUTH_USER,
    password: env.PGAUTH_PASSWORD,
  }) as AuthPool;
}

// Pool MÉTIER : contexte schoolsafe.* + Access_Law uniquement.
export function createBusinessPool(env: AppEnv): BusinessPool {
  if (!env.PGUSER || !env.PGPASSWORD) {
    throw new Error("PGUSER et PGPASSWORD sont requis pour le pool métier");
  }
  return new Pool({
    ...baseConfig(env),
    user: env.PGUSER,
    password: env.PGPASSWORD,
  }) as BusinessPool;
}
