import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { FinancePaymentService } from "../src/finance/payments/service.js";
import type { AccessService } from "../src/access/service.js";

const mockService: FinancePaymentService = {
  async getStudentFeeWithPayments(schoolId, studentFeeId) {
    return {
      id: studentFeeId,
      school_id: schoolId,
      status: "partial",
      amount_expected: 300,
      amount_paid: 100,
      amount_remaining: 200,
      payments: [
        { id: "pay-1", amount: 100, status: "valid" },
      ],
    };
  },
  async cancelPayment(schoolId, profileId, paymentId, reason) {
    return {
      id: paymentId,
      school_id: schoolId,
      cancelled_by: profileId,
      status: "cancelled",
      cancellation_reason: reason,
    };
  },
};

const mockAccess: AccessService = {
  hasPermission: vi.fn().mockResolvedValue(true),
  hasScope: vi.fn().mockResolvedValue(true),
};

const mockResolve = async (token: string) =>
  token === "valid-token" ? { profileId: "resolved-profile-id", schoolId: "school-1" } : { profileId: null, schoolId: null };

function makeApp() {
  return buildApp({
    financePayments: {
      service: mockService,
      resolveProfileAndSchool: mockResolve,
      access: mockAccess,
    },
  });
}

describe("GET /finance/student-fees/:studentId", () => {
  it("returns a student fee with payment history", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/finance/student-fees/550e8400-e29b-41d4-a716-446655440000",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(body.data.payments).toHaveLength(1);
    expect(body.data.payments[0].status).toBe("valid");
  });
});

describe("POST /finance/payments/:id/cancel", () => {
  it("cancels a payment and returns cancellation metadata", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/finance/payments/550e8400-e29b-41d4-a716-446655440001/cancel",
      headers: { authorization: "Bearer valid-token" },
      payload: { reason: "Erreur de saisie" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe("cancelled");
    expect(body.data.cancellation_reason).toBe("Erreur de saisie");
  });

  it("rejects a cancellation without a reason", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/finance/payments/550e8400-e29b-41d4-a716-446655440001/cancel",
      headers: { authorization: "Bearer valid-token" },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_INVALID");
  });
});
