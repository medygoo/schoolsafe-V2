import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SchoolSafeError } from "../http/errors.js";
import { extractBearerToken } from "../auth/session.js";
import type { CardService } from "./service.js";
import { requestCardPrintSchema } from "./schema.js";

export type ResolveProfileId = (token: string) => Promise<string | null>;

export type CardRouteDependencies = {
  service: CardService;
  resolveProfileId: ResolveProfileId;
};

export function registerCardRoutes(app: FastifyInstance, dependencies: CardRouteDependencies): void {
  app.post("/cards/request-print", async (request: FastifyRequest, _reply: FastifyReply) => {
    let token: string;
    try {
      token = extractBearerToken(request.headers.authorization);
    } catch {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
    }

    const profileId = await dependencies.resolveProfileId(token);
    if (!profileId) {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Profil non trouvé", false);
    }

    const body = requestCardPrintSchema.parse(request.body);
    const result = await dependencies.service.requestPrint(profileId, body);
    return { data: result };
  });
}
