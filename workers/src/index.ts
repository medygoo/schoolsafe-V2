import { Hono } from "hono";
import { errorHandler } from "./middleware/error.js";
import { corsMiddleware } from "./middleware/cors.js";
import { authMiddleware, schoolContextMiddleware } from "./middleware/auth.js";
import { parseEnv, type AppEnv } from "./env.js";
import { createSetupService } from "./services/setup.js";
import { createSetupRouter } from "./routes/setup.js";
import { createBootstrapService } from "./services/bootstrap.js";
import { createBootstrapRouter } from "./routes/bootstrap.js";
import { createAccessService } from "./services/access.js";
import { createSchoolService } from "./services/school.js";
import { createSchoolRouter } from "./routes/school.js";

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const parsedEnv = parseEnv(env);
    const allowedOrigins = parsedEnv.ALLOWED_ORIGINS.split(",").map((s) => s.trim());

    const setupService = createSetupService(
      parsedEnv.SUPABASE_URL,
      parsedEnv.SUPABASE_ANON_KEY,
      parsedEnv.SETUP_TOKEN,
    );
    const bootstrapService = createBootstrapService(
      parsedEnv.SUPABASE_URL,
      parsedEnv.SUPABASE_ANON_KEY,
      parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
    );
    const accessService = createAccessService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_ANON_KEY);
    const schoolService = createSchoolService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY);

    const app = new Hono();
    app.use(errorHandler);
    app.use(corsMiddleware(allowedOrigins));

    app.get("/health", (c) => c.json({ status: "ok" }));
    app.get("/ready", (c) => c.json({ status: "ready" }));

    app.route("/", createSetupRouter(setupService));
    app.route("/", createBootstrapRouter(bootstrapService));

    app.use("/school/*", authMiddleware());
    app.use("/school/*", schoolContextMiddleware(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_ANON_KEY));
    app.route("/", createSchoolRouter(schoolService, accessService));

    return app.fetch(request, env);
  },
};
