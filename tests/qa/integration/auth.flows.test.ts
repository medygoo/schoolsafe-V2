import { describe, it, expect } from "vitest";
import { buildIntegrationHarness } from "./helpers/harness.js";

describe("Auth — required on sensitive flows", () => {
  it("returns 401 when no authorization header is provided", async () => {
    const { app } = buildIntegrationHarness({
      tokens: {
        "valid-token": {
          profileId: "profile-1",
          schoolId: "school-1",
          permissions: ["finance.payment.cancel"],
        },
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/finance/payments/pay-1/cancel",
      payload: { reason: "Test" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as { code: string };
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  it("returns 403 ACCESS_DENIED for a token without permission", async () => {
    const { request } = buildIntegrationHarness({
      tokens: {
        "valid-token": {
          profileId: "profile-1",
          schoolId: "school-1",
          permissions: ["finance.payment.cancel"],
        },
        "no-perm-token": {
          profileId: "profile-no-perm",
          schoolId: "school-1",
          permissions: [],
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/finance/payments/pay-1/cancel",
      token: "no-perm-token",
      payload: { reason: "Test" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("ACCESS_DENIED");
  });
});
