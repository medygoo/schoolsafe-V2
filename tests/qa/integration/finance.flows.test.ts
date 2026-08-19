import { describe, it, expect, vi } from "vitest";
import { SchoolSafeError } from "../../../server/src/http/errors.js";
import { buildIntegrationHarness } from "./helpers/harness.js";

const financeManagerToken = "finance-manager-token";
const cashierToken = "cashier-token";

const baseTokens = {
  [financeManagerToken]: {
    profileId: "profile-finance-manager",
    schoolId: "school-1",
    permissions: ["finance.payment.cancel", "finance.payment.record", "finance.fee.read"],
  },
  [cashierToken]: {
    profileId: "profile-cashier",
    schoolId: "school-1",
    permissions: ["finance.payment.record", "finance.fee.read"],
  },
};

describe("Finance — payment cancellation", () => {
  it("finance manager can cancel a recent payment → 200", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
    });

    const res = await request({
      method: "POST",
      url: "/finance/payments/pay-recent/cancel",
      token: financeManagerToken,
      payload: { reason: "Erreur de saisie" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { payment: { status: string } } };
    expect(body.data.payment.status).toBe("cancelled");
  });

  it("cancellation outside allowed window → 403 CONDITION_DENIED", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
      financePayments: {
        async cancelPayment() {
          throw new SchoolSafeError(403, "CONDITION_DENIED", "Délai d'annulation dépassé", false);
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/finance/payments/pay-old/cancel",
      token: financeManagerToken,
      payload: { reason: "Trop tard" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("CONDITION_DENIED");
  });

  it("cashier cannot cancel → 403 ACCESS_DENIED and audit event is logged", async () => {
    const { request, auditLog } = buildIntegrationHarness({
      tokens: baseTokens,
    });

    const res = await request({
      method: "POST",
      url: "/finance/payments/pay-1/cancel",
      token: cashierToken,
      payload: { reason: "Tentative non autorisée" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("ACCESS_DENIED");

    const deniedEntries = auditLog.filter((e) => e.eventType === "access.denied");
    expect(deniedEntries).toHaveLength(1);
    expect(deniedEntries[0].actorProfileId).toBe("profile-cashier");
    expect(deniedEntries[0].payload.permission).toBe("finance.payment.cancel");
    expect(deniedEntries[0].payload.reason).toBe("ACCESS_DENIED");
    expect(deniedEntries[0].payload.resource_id).toBe("pay-1");
  });
});

describe("Finance — payment recording isolation", () => {
  it("records a payment for an allowed profile", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
      financePayments: {
        async recordPayment(schoolId, profileId, input) {
          return {
            payment: {
              id: "pay-new",
              school_id: schoolId,
              student_fee_id: input.student_fee_id,
              amount: input.amount,
              currency: input.currency,
              received_by: profileId,
              mode: input.mode,
              reference: input.reference,
              status: "valid",
            },
            student_fee: { id: input.student_fee_id, status: "partial" },
          };
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/finance/payments",
      token: financeManagerToken,
      payload: {
        student_fee_id: "550e8400-e29b-41d4-a716-446655440000",
        amount: 100,
        currency: "USD",
        mode: "cash",
        reference: "Paiement test",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { payment: { amount: number } } };
    expect(body.data.payment.amount).toBe(100);
  });
});
