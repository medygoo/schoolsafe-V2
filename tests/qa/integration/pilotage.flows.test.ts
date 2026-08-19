import { describe, it, expect } from "vitest";
import { SchoolSafeError } from "../../../server/src/http/errors.js";
import { buildIntegrationHarness } from "./helpers/harness.js";

const managerToken = "manager-token";

const baseTokens = {
  [managerToken]: {
    profileId: "profile-manager-1",
    schoolId: "school-1",
    permissions: ["pilotage.approvals.manage", "pilotage.approvals.read"],
  },
};

describe("Pilotage — approvals", () => {
  it("manager can approve pending request → 200", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
      approvals: {
        async decide(approvalId, schoolId, profileId, input) {
          return {
            id: approvalId,
            school_id: schoolId,
            request_type: "payment_cancel",
            entity_type: "payment",
            entity_id: "payment-1",
            requested_by: "profile-1",
            requested_at: new Date().toISOString(),
            status: input.decision,
            decided_by: profileId,
            decided_at: new Date().toISOString(),
            expected_version: 1,
            payload: {},
            reason: input.reason ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/pilotage/approvals/approval-pending/decide",
      token: managerToken,
      payload: { decision: "approved", reason: "Validé" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { status: string } };
    expect(body.data.status).toBe("approved");
  });

  it("approving already-processed request → 403 CONDITION_DENIED", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
      approvals: {
        async decide() {
          throw new SchoolSafeError(403, "CONDITION_DENIED", "La demande est déjà approved", false);
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/pilotage/approvals/approval-approved/decide",
      token: managerToken,
      payload: { decision: "approved", reason: "Tentative invalide" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("CONDITION_DENIED");
  });
});
