import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createFinancePaymentService } from "../src/finance/payments/service.js";
import type { FinancePaymentService } from "../src/finance/payments/service.js";
import type { AccessService } from "../src/access/service.js";
import type { SupabaseClient } from "@supabase/supabase-js";

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
      payment: {
        id: paymentId,
        school_id: schoolId,
        cancelled_by: profileId,
        status: "cancelled",
        cancellation_reason: reason,
      },
      student_fee: {
        id: "sf-1",
        amount_expected: 300,
        amount_paid: 0,
        amount_remaining: 300,
        status: "pending",
      },
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

describe("GET /finance/student-fees/:studentFeeId", () => {
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
    expect(body.data.payment.status).toBe("cancelled");
    expect(body.data.payment.cancellation_reason).toBe("Erreur de saisie");
    expect(body.data.student_fee.status).toBe("pending");
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

function makeRpcClient(rpcResult: unknown) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
  } as unknown as SupabaseClient;
}

describe("createFinancePaymentService.cancelPayment", () => {
  it("returns paid status when the balance is cleared", async () => {
    const client = makeRpcClient({
      payment: { id: "pay-1", status: "cancelled", cancellation_reason: "Erreur" },
      student_fee: {
        id: "sf-1",
        amount_expected: 300,
        amount_paid: 300,
        amount_remaining: 0,
        status: "paid",
      },
    });
    const service = createFinancePaymentService(client);

    const result = (await service.cancelPayment("school-1", "profile-1", "pay-1", "Erreur")) as {
      student_fee: { amount_paid: number; amount_remaining: number; status: string };
    };

    expect(client.rpc).toHaveBeenCalledWith("cancel_payment", {
      p_school_id: "school-1",
      p_profile_id: "profile-1",
      p_payment_id: "pay-1",
      p_reason: "Erreur",
    });
    expect(result.student_fee.status).toBe("paid");
    expect(result.student_fee.amount_paid).toBe(300);
    expect(result.student_fee.amount_remaining).toBe(0);
  });

  it("returns partial status when some amount remains", async () => {
    const client = makeRpcClient({
      payment: { id: "pay-1", status: "cancelled", cancellation_reason: "Remboursement partiel" },
      student_fee: {
        id: "sf-1",
        amount_expected: 300,
        amount_paid: 100,
        amount_remaining: 200,
        status: "partial",
      },
    });
    const service = createFinancePaymentService(client);

    const result = (await service.cancelPayment("school-1", "profile-1", "pay-1", "Remboursement partiel")) as {
      student_fee: { amount_paid: number; amount_remaining: number; status: string };
    };

    expect(result.student_fee.status).toBe("partial");
    expect(result.student_fee.amount_paid).toBe(100);
    expect(result.student_fee.amount_remaining).toBe(200);
  });

  it("returns pending status when nothing remains paid", async () => {
    const client = makeRpcClient({
      payment: { id: "pay-1", status: "cancelled", cancellation_reason: "Erreur" },
      student_fee: {
        id: "sf-1",
        amount_expected: 300,
        amount_paid: 0,
        amount_remaining: 300,
        status: "pending",
      },
    });
    const service = createFinancePaymentService(client);

    const result = (await service.cancelPayment("school-1", "profile-1", "pay-1", "Erreur")) as {
      student_fee: { amount_paid: number; amount_remaining: number; status: string };
    };

    expect(result.student_fee.status).toBe("pending");
    expect(result.student_fee.amount_paid).toBe(0);
    expect(result.student_fee.amount_remaining).toBe(300);
  });
});
