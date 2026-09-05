// SchoolSafe — première lecture métier réelle : projection élève.
// Chaîne complète : session (lot 2.3) → contexte serveur → Access_Law en base
// (lot 3.1) → RPC de projection filtrée (database/projections/v1).
import type { PoolClient } from "pg";
import type { BusinessPool } from "../db/pool.js";
import { withAuthorizedContext, type AccessTarget } from "../db/access.js";
import type { RequestContext } from "../db/context.js";

export type StudentProjection = {
  id: string;
  matricule: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_name: string | null;
  school_id: string;
  lifecycle_status: string;
};

export function createStudentsNativeService(businessPool: BusinessPool) {
  return {
    async readStudent(context: RequestContext, studentId: string): Promise<StudentProjection> {
      return withAuthorizedContext(
        businessPool,
        context,
        "school.student.read",
        { studentId } as AccessTarget,
        async (client: PoolClient) => {
          const result = await client.query<{ student_read: StudentProjection }>(
            "select api.student_read($1) as student_read",
            [studentId],
          );
          return result.rows[0].student_read;
        },
      );
    },
  };
}

export type StudentsNativeService = ReturnType<typeof createStudentsNativeService>;
