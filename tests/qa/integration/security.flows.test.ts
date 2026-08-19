import { describe, it, expect } from "vitest";
import { buildIntegrationHarness } from "./helpers/harness.js";

const guardAssignedToken = "guard-assigned-token";
const guardOtherToken = "guard-other-token";

const PORTAL_A = "550e8400-e29b-41d4-a716-446655440001";
const PORTAL_B = "550e8400-e29b-41d4-a716-446655440002";

const baseTokens = {
  [guardAssignedToken]: {
    profileId: "profile-guard-1",
    schoolId: "school-1",
    permissions: ["security.scan"],
    scopes: [{ type: "assigned_portal", id: PORTAL_A }],
  },
  [guardOtherToken]: {
    profileId: "profile-guard-2",
    schoolId: "school-1",
    permissions: ["security.scan"],
    scopes: [{ type: "assigned_portal", id: PORTAL_B }],
  },
};

const validScanPayload = {
  qr_payload: "schoolsafe://card/SS-TEST-001/sig",
  event_type: "entry",
  location_id: PORTAL_A,
};

describe("Security — QR scan", () => {
  it("guard can scan at assigned portal → 200", async () => {
    const { request } = buildIntegrationHarness({ tokens: baseTokens });

    const res = await request({
      method: "POST",
      url: "/security/scan",
      token: guardAssignedToken,
      payload: validScanPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { decision: string } };
    expect(body.data.decision).toBe("allowed");
  });

  it("scan at unassigned portal → 403 SCOPE_DENIED", async () => {
    const { request } = buildIntegrationHarness({ tokens: baseTokens });

    const res = await request({
      method: "POST",
      url: "/security/scan",
      token: guardOtherToken,
      payload: validScanPayload,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("SCOPE_DENIED");
  });

  it("scan without location_id → 400 VALIDATION_INVALID", async () => {
    const { request } = buildIntegrationHarness({ tokens: baseTokens });

    const res = await request({
      method: "POST",
      url: "/security/scan",
      token: guardAssignedToken,
      payload: { qr_payload: "schoolsafe://card/SS-TEST-001/sig", event_type: "entry" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { code: string };
    expect(body.code).toBe("VALIDATION_INVALID");
  });

  it("scan without security.scan permission → 403 ACCESS_DENIED", async () => {
    const { request } = buildIntegrationHarness({
      tokens: {
        "no-perm-token": {
          profileId: "profile-no-perm",
          schoolId: "school-1",
          permissions: [],
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/security/scan",
      token: "no-perm-token",
      payload: validScanPayload,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("ACCESS_DENIED");
  });
});
