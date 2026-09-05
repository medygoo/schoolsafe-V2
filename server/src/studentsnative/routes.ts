// SchoolSafe — route de lecture élève (première route métier sur PostgreSQL).
// Le client ne fournit QUE l'id de l'élève dans l'URL ; user/profile/school
// viennent de la session résolue côté serveur (jamais du navigateur).
import type { FastifyInstance } from "fastify";
import { SchoolSafeError } from "../http/errors.js";
import { newRequestId } from "../http/request-id.js";
import { requireAuthSession } from "../authnative/middleware.js";
import type { AuthNativeService } from "../authnative/service.js";
import type { StudentsNativeService } from "./service.js";

export type StudentsNativeRouteDependencies = {
  authService: AuthNativeService;
  service: StudentsNativeService;
};

export function registerStudentsNativeRoutes(
  app: FastifyInstance,
  dependencies: StudentsNativeRouteDependencies,
): void {
  const requireSession = requireAuthSession(dependencies.authService);

  app.get("/native/students/:id", { preHandler: requireSession }, async (request) => {
    const { id } = request.params as { id: string };
    const session = request.authSession!;

    const student = await dependencies.service.readStudent(
      {
        userId: session.userId,
        profileId: session.profileId,
        schoolId: session.schoolId,
        requestId: newRequestId(),
      },
      id,
    );

    if (!student) {
      throw new SchoolSafeError(404, "NOT_FOUND", "Élève introuvable", false);
    }
    return { data: student, request_id: newRequestId() };
  });
}
