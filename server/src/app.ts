import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { registerBootstrapRoutes, type BootstrapRouteDependencies } from "./bootstrap/routes.js";
import { registerCardRoutes, type CardRouteDependencies } from "./cards/routes.js";
import { defaultReadinessProbe, type ReadinessProbe } from "./health/readiness.js";
import { SchoolSafeError, type ApiErrorBody } from "./http/errors.js";
import { newRequestId } from "./http/request-id.js";
import { registerSetupRoutes, type SetupRouteDependencies } from "./setup/routes.js";
import { requirePermission } from "./access/guard.js";
import type { AccessService } from "./access/service.js";

export type BuildAppOptions = {
  testRoutes?: boolean;
  readinessProbe?: ReadinessProbe;
  bootstrap?: BootstrapRouteDependencies;
  setup?: SetupRouteDependencies;
  cards?: CardRouteDependencies;
  access?: AccessService;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const readinessProbe = options.readinessProbe ?? defaultReadinessProbe;

  app.setErrorHandler((error, _request, reply) => {
    const requestId = newRequestId();
    const known = error instanceof SchoolSafeError;
    const isValidation = error instanceof ZodError;
    const body: ApiErrorBody = known
      ? {
          code: error.code,
          message: error.publicMessage,
          request_id: requestId,
          retryable: error.retryable
        }
      : isValidation
        ? {
            code: "VALIDATION_INVALID",
            message: "Donnée invalide",
            request_id: requestId,
            retryable: false
          }
        : {
            code: "INTERNAL_ERROR",
            message: "Erreur interne",
            request_id: requestId,
            retryable: false
          };
    reply.status(known ? error.statusCode : isValidation ? 400 : 500).send(body);
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

  if (options.cards) {
    registerCardRoutes(app, options.cards);
  }

  if (options.testRoutes) {
    app.get("/__test/error", async () => {
      throw new SchoolSafeError(400, "VALIDATION_INVALID", "Donnée invalide", false);
    });

    if (options.access) {
      app.get(
        "/__test/protected",
        { preHandler: [requirePermission(options.access, "test.protected", { type: "school", id: "school-1" })] },
        async () => ({ status: "ok" as const }),
      );
    }
  }

  return app;
}
