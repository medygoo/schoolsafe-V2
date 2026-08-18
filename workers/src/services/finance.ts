import { createServiceClient } from "../lib/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FinanceService {
  listFeeStructures(schoolId: string): Promise<unknown[]>;
  createFeeStructure(schoolId: string, input: Record<string, unknown>): Promise<unknown>;
  listStudentFees(schoolId: string, options: { studentId?: string; status?: string }): Promise<unknown[]>;
  createPayment(schoolId: string, profileId: string, input: Record<string, unknown>): Promise<unknown>;
}

export function createFinanceService(supabaseUrl: string, serviceRoleKey: string): FinanceService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async listFeeStructures(schoolId) {
      const { data, error } = await client.from("fee_structures").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (error) throw new Error(`List fee structures failed: ${error.message}`);
      return data ?? [];
    },
    async createFeeStructure(schoolId, input) {
      const { data, error } = await client.from("fee_structures").insert({ school_id: schoolId, ...input }).select("*").single();
      if (error || !data) throw new Error(`Create fee structure failed: ${error?.message}`);
      return data;
    },
    async listStudentFees(schoolId, options) {
      let q = client.from("student_fees").select("*, students!inner(id, matricule, first_name, last_name)").eq("school_id", schoolId);
      if (options.studentId) q = q.eq("student_id", options.studentId);
      if (options.status) q = q.eq("status", options.status);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw new Error(`List student fees failed: ${error.message}`);
      return data ?? [];
    },
    async createPayment(schoolId, profileId, input) {
      const feeId = input.student_fee_id as string;
      const { data: fee, error: feeError } = await client
        .from("student_fees")
        .select("id, amount_paid, amount_expected, amount_remaining, status")
        .eq("id", feeId)
        .eq("school_id", schoolId)
        .single();
      if (feeError || !fee) throw new Error(`Student fee not found: ${feeError?.message}`);
      const { data: payment, error } = await client
        .from("fee_payments")
        .insert({
          school_id: schoolId,
          student_fee_id: feeId,
          amount: input.amount,
          currency: input.currency,
          received_by: profileId,
          received_at: input.received_at ?? new Date().toISOString(),
          receipt_no: input.receipt_no ?? null,
          metadata: input.metadata,
        })
        .select("*")
        .single();
      if (error || !payment) throw new Error(`Create payment failed: ${error?.message}`);
      const newPaid = Number(fee.amount_paid) + Number(input.amount);
      const newRemaining = Math.max(Number(fee.amount_expected) - newPaid, 0);
      let status = fee.status as string;
      if (newRemaining <= 0) status = "paid";
      else if (newPaid > 0) status = "partial";
      const { error: upd } = await client.from("student_fees").update({ amount_paid: newPaid, amount_remaining: newRemaining, status }).eq("id", feeId);
      if (upd) throw new Error(`Update fee failed: ${upd.message}`);
      return payment;
    },
  };
}
