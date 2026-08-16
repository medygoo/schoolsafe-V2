import Fastify, { type FastifyInstance } from "fastify";
import { registerBootstrapRoutes, type BootstrapRouteDependencies } from "./bootstrap/routes.js";
import { defaultReadinessProbe, type ReadinessProbe } from "./health/readiness.js";
import { SchoolSafeError, type ApiErrorBody } from "./http/errors.js";
import { newRequestId } from "./http/request-id.js";
import { registerSetupRoutes, type SetupRouteDependencies } from "./setup/routes.js";

export type BuildAppOptions = {
  testRoutes?: boolean;
  readinessProbe?: ReadinessProbe;
  bootstrap?: BootstrapRouteDependencies;
  setup?: SetupRouteDependencies;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const readinessProbe = options.readinessProbe ?? defaultReadinessProbe;

  app.setErrorHandler((error, _request, reply) => {
    const requestId = newRequestId();
    const known = error instanceof SchoolSafeError;
    const body: ApiErrorBody = {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.publicMessage : "Erreur interne",
      request_id: requestId,
      retryable: known ? error.retryable : false
    };
    reply.status(known ? error.statusCode : 500).send(body);
  });

  app.get("/health", async () => ({ status: "ok" as const }));

  app.get("/ready", async () => {
    const result = await readinessProbe();
    if (!result.ready) {
      throw new SchoolSafeError(503, "DEPENDENCY_UNAVAILABLE", "Service temporairement indisponible", true);
    }
    return { status: "ready" as const };
  });

  if (options.bootstrap) {
    registerBootstrapRoutes(app, options.bootstrap);
  }

  if (options.setup) {
    registerSetupRoutes(app, options.setup);
  }

  if (options.testRoutes) {
    app.get("/__test/error", async () => {
      throw new SchoolSafeError(400, "VALIDATION_INVALID", "Donnée invalide", false);
    });
  }

  return app;
}
