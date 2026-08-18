import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { FinanceReportsService, ReceiptData, DailyReport } from "../src/finance/reports/service.js";
import type { AccessService } from "../src/access/service.js";

const mockReceipt: ReceiptData = {
  receiptNumber: "REC-2026-00001",
  generatedAt: "2026-08-18T10:00:00.000Z",
  school: {
    name: "École SchoolSafe",
    address: "123 Avenue de l'École",
    phone: "+243 000 000 000",
    email: "contact@schoolsafe.com",
    website: "https://schoolsafe.com",
    logo_url: "https://schoolsafe.com/logo.png",
    currency: "USD",
    activeAcademicYear: { id: "year-1", label: "2025-2026" },
  },
  student: {
    id: "student-1",
    matricule: "MAT-001",
    first_name: "Jean",
    last_name: "Dupont",
    class_name: "3ème Primaire",
    photo_url: "https://schoolsafe.com/photos/student-1.jpg",
  },
  payment: {
    id: "payment-1",
    amount: 150,
    currency: "USD",
    received_at: "2026-08-18T09:30:00.000Z",
    mode: "cash",
    reference: "REF-001",
    fee_label: "Frais scolaires",
    expected_amount: 300,
    remaining_amount: 150,
    cashier_name: "Marie Curie",
    verification_code: "VERIF-001",
  },
};

const mockDailyReport: DailyReport = {
  date: "2026-08-18",
  total_amount: 450,
  transaction_count: 3,
  currency: "USD",
  by_mode: [
    { mode: "cash", amount: 300, count: 2 },
    { mode: "card", amount: 150, count: 1 },
  ],
  by_fee_type: [
    { fee_label: "Frais scolaires", amount: 450, count: 3 },
  ],
  payments: [
    {
      id: "payment-1",
      amount: 150,
      currency: "USD",
      received_at: "2026-08-18T09:30:00.000Z",
      mode: "cash",
      reference: "REF-001",
      student: { id: "student-1", matricule: "MAT-001", first_name: "Jean", last_name: "Dupont" },
      fee_label: "Frais scolaires",
    },
  ],
};

const mockService: FinanceReportsService = {
  async getReceiptData(schoolId, paymentId) {
    return paymentId === "missing-payment-id" ? null : { ...mockReceipt, payment: { ...mockReceipt.payment, id: paymentId } };
  },
  async getDailyReport(schoolId, date, currency) {
    return { ...mockDailyReport, date, currency: currency ?? mockDailyReport.currency };
  },
  async closeCashRegister(schoolId, profileId, input) {
    return {
      closure: {
        id: "closure-1",
        school_id: schoolId,
        closure_date: input.date,
        closed_by: profileId,
        total_amount: 450,
        expected_amount: input.expected_amount ?? 450,
        difference: 450 - (input.expected_amount ?? 450),
        notes: input.notes ?? null,
        status: "closed",
      },
      alreadyClosed: false,
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
    financeReports: {
      service: mockService,
      resolveProfileAndSchool: mockResolve,
      access: mockAccess,
    },
  });
}

describe("GET /finance/receipts/:paymentId", () => {
  it("returns structured receipt data", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/finance/receipts/payment-1",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.receiptNumber).toBe("REC-2026-00001");
    expect(body.data.school.name).toBe("École SchoolSafe");
    expect(body.data.student.matricule).toBe("MAT-001");
    expect(body.data.payment.amount).toBe(150);
    expect(body.data.payment.cashier_name).toBe("Marie Curie");
  });

  it("returns 404 when receipt is not found", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/finance/receipts/missing-payment-id",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_FOUND");
  });
});

describe("GET /finance/reports/daily", () => {
  it("returns the daily report for a given date", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/finance/reports/daily?date=2026-08-18",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.date).toBe("2026-08-18");
    expect(body.data.total_amount).toBe(450);
    expect(body.data.transaction_count).toBe(3);
    expect(body.data.by_mode).toHaveLength(2);
    expect(body.data.by_fee_type).toHaveLength(1);
  });

  it("rejects an invalid date", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/finance/reports/daily?date=not-a-date",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_INVALID");
  });
});

describe("POST /finance/cash-register/close", () => {
  it("closes the cash register for a date", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/finance/cash-register/close",
      headers: { authorization: "Bearer valid-token" },
      payload: { date: "2026-08-18", expected_amount: 400, notes: "Clôture test" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.closure.closure_date).toBe("2026-08-18");
    expect(body.data.closure.total_amount).toBe(450);
    expect(body.data.closure.expected_amount).toBe(400);
    expect(body.data.closure.difference).toBe(50);
    expect(body.data.closure.notes).toBe("Clôture test");
  });

  it("rejects a missing date", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/finance/cash-register/close",
      headers: { authorization: "Bearer valid-token" },
      payload: { notes: "Clôture test" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_INVALID");
  });

  it("rejects a negative expected amount", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/finance/cash-register/close",
      headers: { authorization: "Bearer valid-token" },
      payload: { date: "2026-08-18", expected_amount: -10 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_INVALID");
  });
});
