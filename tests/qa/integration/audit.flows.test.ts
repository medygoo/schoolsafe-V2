import { describe, it, expect, vi } from "vitest";
import { createFinancePaymentService } from "../../../server/src/finance/payments/service.js";
import { SchoolSafeError } from "../../../server/src/http/errors.js";
import { buildIntegrationHarness } from "./helpers/harness.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const financeManagerToken = "finance-manager-token";

function createMockSupabaseClient(auditLog: Array<Record<string, unknown>>, createdAt?: string) {
  const paymentCreatedAt = createdAt ?? new Date().toISOString();
  return {
    from: vi.fn((table: string) => {
      if (table === "fee_payments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: { id: "pay-recent", created_at: paymentCreatedAt },
                    error: null,
                  }),
                ),
              })),
            })),
          })),
        };
      }
      if (table === "audit_events") {
        return {
          insert: vi.fn((row: Record<string, unknown>) => {
            auditLog.push(row);
            return { error: null };
          }),
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
      };
    }),
    rpc: vi.fn(() =>
      Promise.resolve({
        data: {
          payment: { id: "pay-recent", status: "cancelled" },
          student_fee: { id: "sf-1", status: "pending" },
        },
        error: null,
      }),
    ),
  } as unknown as SupabaseClient;
}

describe("Audit — payment cancellation", () => {
  it("successful payment cancellation is logged in audit_events", async () => {
    const auditLog: Array<Record<string, unknown>> = [];
    const client = createMockSupabaseClient(auditLog);
    const financeService = createFinancePaymentService(client);

    const { request } = buildIntegrationHarness({
      tokens: {
        [financeManagerToken]: {
          profileId: "profile-finance-manager",
          schoolId: "school-1",
          permissions: ["finance.payment.cancel"],
        },
      },
      financePayments: financeService,
    });

    const res = await request({
      method: "POST",
      url: "/finance/payments/pay-recent/cancel",
      token: financeManagerToken,
      payload: { reason: "Erreur de saisie" },
    });

    expect(res.statusCode).toBe(200);
    const auditEntries = auditLog.filter((e) => e.event_type === "finance.payment.cancelled");
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].actor_profile_id).toBe("profile-finance-manager");
    expect((auditEntries[0].payload as Record<string, unknown>).payment_id).toBe("pay-recent");
  });

  it("refused cancellation (outside window) is logged in audit_events with reason code", async () => {
    const serviceAuditLog: Array<Record<string, unknown>> = [];
    const oldCreatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const client = createMockSupabaseClient(serviceAuditLog, oldCreatedAt);
    const financeService = createFinancePaymentService(client);

    const { request } = buildIntegrationHarness({
      tokens: {
        [financeManagerToken]: {
          profileId: "profile-finance-manager",
          schoolId: "school-1",
          permissions: ["finance.payment.cancel"],
        },
      },
      financePayments: financeService,
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

    const deniedEntries = serviceAuditLog.filter((e) => e.event_type === "finance.payment.cancel.denied");
    expect(deniedEntries).toHaveLength(1);
    expect(deniedEntries[0].actor_profile_id).toBe("profile-finance-manager");
    expect((deniedEntries[0].payload as Record<string, unknown>).payment_id).toBe("pay-old");
    expect((deniedEntries[0].payload as Record<string, unknown>).reason).toBe("outside_cancellation_window");
  });
});
