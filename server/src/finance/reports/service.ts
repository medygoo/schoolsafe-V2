import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CloseCashRegisterInput } from "./schema.js";

export interface ReceiptData {
  receiptNumber: string;
  generatedAt: string;
  school: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logo_url?: string;
    currency?: string;
    activeAcademicYear?: { id: string; label: string };
  };
  student: {
    id: string;
    matricule: string;
    first_name: string;
    last_name: string;
    class_name?: string;
    photo_url?: string;
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    received_at: string;
    mode?: string;
    reference?: string;
    fee_label: string;
    expected_amount: number;
    remaining_amount: number;
    cashier_name?: string;
    verification_code?: string;
  };
}

export interface ModeBreakdown {
  mode: string;
  amount: number;
  count: number;
}

export interface FeeTypeBreakdown {
  fee_label: string;
  amount: number;
  count: number;
}

export interface DailyReportPayment {
  id: string;
  amount: number;
  currency: string;
  received_at: string;
  mode?: string;
  reference?: string;
  student: { id: string; matricule: string; first_name: string; last_name: string };
  fee_label: string;
}

export interface DailyReport {
  date: string;
  total_amount: number;
  transaction_count: number;
  currency: string;
  by_mode: ModeBreakdown[];
  by_fee_type: FeeTypeBreakdown[];
  payments: DailyReportPayment[];
}

export interface FinanceReportsService {
  getReceiptData(schoolId: string, paymentId: string): Promise<ReceiptData | null>;
  getDailyReport(schoolId: string, date: string, currency?: string): Promise<DailyReport>;
  closeCashRegister(schoolId: string, profileId: string, input: CloseCashRegisterInput): Promise<unknown>;
}

function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function toDateRange(date: string): { start: string; end: string } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createFinanceReportsService(
  clientOrUrl: SupabaseClient | string,
  serviceRoleKey?: string,
): FinanceReportsService {
  const client = typeof clientOrUrl === "string" ? createServiceClient(clientOrUrl, serviceRoleKey!) : clientOrUrl;

  async function ensureReceiptNumber(payment: Record<string, unknown>, schoolId: string): Promise<string> {
    const existing = payment.receipt_no as string | null | undefined;
    if (existing) return existing;

    const { data, error } = await client.rpc("next_document_number", {
      p_school_id: schoolId,
      p_document_type: "receipt",
      p_prefix: "REC-",
    });
    if (error || !data) throw new Error(`Échec de la génération du numéro de reçu : ${error?.message ?? "inconnu"}`);

    const { error: updateError } = await client
      .from("fee_payments")
      .update({ receipt_no: data })
      .eq("id", payment.id as string)
      .eq("school_id", schoolId);
    if (updateError) throw new Error(`Échec de l'enregistrement du numéro de reçu : ${updateError.message}`);

    return data;
  }

  return {
    async getReceiptData(schoolId, paymentId) {
      const { data: payment, error: paymentError } = await client
        .from("fee_payments")
        .select("*, student_fees!inner(*, fee_structures(*), students!inner(*, classes(name), photo_path))")
        .eq("id", paymentId)
        .eq("school_id", schoolId)
        .single();
      if (paymentError || !payment) return null;

      const feePayment = payment as Record<string, unknown>;
      const studentFee = (feePayment.student_fees ?? {}) as Record<string, unknown>;
      const feeStructure = (studentFee.fee_structures ?? {}) as Record<string, unknown>;
      const student = (studentFee.students ?? {}) as Record<string, unknown>;
      const studentClass = (student.classes ?? {}) as Record<string, unknown> | undefined;

      const receiptNumber = await ensureReceiptNumber(feePayment, schoolId);

      const [{ data: schoolData }, { data: contactsData }, { data: academicYearData }, { data: cashierData }] =
        await Promise.all([
          client.from("school").select("*").eq("id", schoolId).single(),
          client.from("school_contacts").select("*").eq("school_id", schoolId).maybeSingle(),
          client.from("academic_years").select("id, label").eq("school_id", schoolId).eq("is_active", true).maybeSingle(),
          client.from("profiles").select("display_name, first_name, last_name").eq("id", feePayment.received_by).maybeSingle(),
        ]);

      const school = (schoolData ?? {}) as Record<string, unknown>;
      const contacts = (contactsData ?? {}) as Record<string, unknown>;
      const academicYear = academicYearData as { id: string; label: string } | null;
      const cashier = (cashierData ?? {}) as Record<string, unknown>;

      const cashierName =
        (cashier.display_name as string) ||
        `${(cashier.first_name as string) ?? ""} ${(cashier.last_name as string) ?? ""}`.trim() ||
        undefined;

      const metadata = (feePayment.metadata ?? {}) as Record<string, unknown>;

      return {
        receiptNumber,
        generatedAt: new Date().toISOString(),
        school: {
          name: (school.name as string) ?? "",
          address: (contacts.address as string) ?? undefined,
          phone: (contacts.phone as string) ?? undefined,
          email: (contacts.email as string) ?? undefined,
          website: (contacts.website_url as string) ?? undefined,
          logo_url: (school.logo_path as string) ?? undefined,
          currency: (school.currency as string) ?? undefined,
          activeAcademicYear: academicYear ?? undefined,
        },
        student: {
          id: (student.id as string) ?? "",
          matricule: (student.matricule as string) ?? "",
          first_name: (student.first_name as string) ?? "",
          last_name: (student.last_name as string) ?? "",
          class_name: (studentClass?.name as string) ?? undefined,
          photo_url: (student.photo_path as string) ?? undefined,
        },
        payment: {
          id: (feePayment.id as string) ?? "",
          amount: Number(feePayment.amount ?? 0),
          currency: (feePayment.currency as string) ?? "USD",
          received_at: (feePayment.received_at as string) ?? new Date().toISOString(),
          mode: ((feePayment.mode as string) ?? (metadata.mode as string)) || undefined,
          reference: ((feePayment.reference as string) ?? (metadata.reference as string)) || undefined,
          fee_label: (feeStructure.label as string) ?? "",
          expected_amount: Number(studentFee.amount_expected ?? 0),
          remaining_amount: Number(studentFee.amount_remaining ?? 0),
          cashier_name: cashierName,
          verification_code: (metadata.verification_code as string) ?? undefined,
        },
      };
    },

    async getDailyReport(schoolId, date, currency) {
      const { start, end } = toDateRange(date);

      let query = client
        .from("fee_payments")
        .select("*, student_fees!inner(amount_expected, amount_remaining, fee_structures(label)), students!inner(id, matricule, first_name, last_name)")
        .eq("school_id", schoolId)
        .gte("received_at", start)
        .lt("received_at", end)
        .eq("status", "valid")
        .order("received_at", { ascending: false });

      if (currency) {
        query = query.eq("currency", currency);
      }

      const { data: payments, error } = await query;
      if (error) throw new Error(`Échec du chargement du rapport journalier : ${error.message}`);

      const rows = (payments ?? []) as Record<string, unknown>[];
      const currencyCode = currency ?? (rows[0]?.currency as string) ?? "USD";

      const byMode = new Map<string, ModeBreakdown>();
      const byFeeType = new Map<string, FeeTypeBreakdown>();
      let total = 0;

      const reportPayments: DailyReportPayment[] = rows.map((row) => {
        const amount = Number(row.amount ?? 0);
        const studentFee = (row.student_fees ?? {}) as Record<string, unknown>;
        const feeStructure = (studentFee.fee_structures ?? {}) as Record<string, unknown>;
        const student = (row.students ?? {}) as Record<string, unknown>;
        const mode = ((row.mode as string) ?? "unknown").toLowerCase();
        const feeLabel = (feeStructure.label as string) ?? "Non spécifié";

        total += amount;

        const modeEntry = byMode.get(mode) ?? { mode, amount: 0, count: 0 };
        modeEntry.amount += amount;
        modeEntry.count += 1;
        byMode.set(mode, modeEntry);

        const feeEntry = byFeeType.get(feeLabel) ?? { fee_label: feeLabel, amount: 0, count: 0 };
        feeEntry.amount += amount;
        feeEntry.count += 1;
        byFeeType.set(feeLabel, feeEntry);

        return {
          id: (row.id as string) ?? "",
          amount,
          currency: (row.currency as string) ?? currencyCode,
          received_at: (row.received_at as string) ?? "",
          mode: (row.mode as string) ?? undefined,
          reference: (row.reference as string) ?? undefined,
          student: {
            id: (student.id as string) ?? "",
            matricule: (student.matricule as string) ?? "",
            first_name: (student.first_name as string) ?? "",
            last_name: (student.last_name as string) ?? "",
          },
          fee_label: feeLabel,
        };
      });

      return {
        date,
        total_amount: total,
        transaction_count: rows.length,
        currency: currencyCode,
        by_mode: Array.from(byMode.values()),
        by_fee_type: Array.from(byFeeType.values()),
        payments: reportPayments,
      };
    },

    async closeCashRegister(schoolId, profileId, input) {
      const { date, expected_amount, notes } = input;

      const { data: existingClosure, error: existingError } = await client
        .from("cash_register_closures")
        .select("*")
        .eq("school_id", schoolId)
        .eq("closure_date", date)
        .maybeSingle();
      if (existingError) throw new Error(`Échec de la vérification de la clôture : ${existingError.message}`);
      if (existingClosure) {
        return { closure: existingClosure, alreadyClosed: true };
      }

      const report = await this.getDailyReport(schoolId, date);
      const totalAmount = report.total_amount;
      const expectedAmount = expected_amount ?? totalAmount;
      const difference = totalAmount - expectedAmount;

      const { data: closure, error } = await client
        .from("cash_register_closures")
        .insert({
          school_id: schoolId,
          closure_date: date,
          closed_by: profileId,
          total_amount: totalAmount,
          expected_amount: expectedAmount,
          difference,
          notes: notes ?? null,
          status: "closed",
          metadata: {},
        })
        .select("*")
        .single();
      if (error || !closure) throw new Error(`Échec de la clôture de caisse : ${error?.message ?? "inconnu"}`);

      return { closure, alreadyClosed: false };
    },
  };
}
