// SchoolSafe — adaptateur : fait parler le service d'authentification native
// (authnative) avec le pool PostgreSQL réel via l'interface AuthDatabase.
import type { Pool } from "pg";
import type { AuthDatabase } from "../authnative/service.js";

export function createPgAuthDatabase(pool: Pool): AuthDatabase {
  return {
    async query<T>(sql: string, params: unknown[]): Promise<{ rows: T[] }> {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
}
