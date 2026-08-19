import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CreatePaymentInput } from "../control/schema.js";

export interface FinancePaymentService {
  getStudentFeeWithPayments(schoolId: string, studentFeeId: string): Promise<unknown>;
  recordPayment(schoolId: string, profileId: string, input: CreatePaymentInput): Promise<unknown>;
  cancelPayment(schoolId: string, profileId: string, paymentId: string, reason: string): Promise<unknown>;
}

function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createFinancePaymentService(
  clientOrUrl: SupabaseClient | string,
  serviceRoleKey?: string,
): FinancePaymentService {
  const client = typeof clientOrUrl === "string" ? createServiceClient(clientOrUrl, serviceRoleKey!) : clientOrUrl;

  return {
    async getStudentFeeWithPayments(schoolId, studentFeeId) {
      const { data: studentFee, error: feeError } = await client
        .from("student_fees")
        .select("*, students!inner(id, matricule, first_name, last_name), fee_structures(id, label, amount, currency)")
        .eq("id", studentFeeId)
        .eq("school_id", schoolId)
        .single();
      if (feeError || !studentFee) throw new Error(`Frais étudiant introuvable : ${feeError?.message ?? "inconnu"}`);

      const { data: payments, error: paymentsError } = await client
        .from("fee_payments")
        .select("*")
        .eq("student_fee_id", studentFeeId)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (paymentsError) throw new Error(`Échec du chargement des paiements : ${paymentsError.message}`);

      return { ...studentFee, payments: payments ?? [] };
    },

    async recordPayment(schoolId, profileId, input) {
      const { data, error } = await client.rpc("record_payment", {
        p_school_id: schoolId,
        p_profile_id: profileId,
        p_student_fee_id: input.student_fee_id,
        p_amount: input.amount,
        p_currency: input.currency,
        p_received_at: input.received_at ?? new Date().toISOString(),
        p_receipt_no: input.receipt_no ?? null,
        p_mode: input.mode,
        p_reference: input.reference,
        p_metadata: input.metadata,
      });

      if (error || !data) {
        throw new Error(`Échec de l'enregistrement du paiement : ${error?.message ?? "inconnu"}`);
      }

      return data;
    },

    async cancelPayment(schoolId, profileId, paymentId, reason) {
      const { data, error } = await client.rpc("cancel_payment", {
        p_school_id: schoolId,
        p_profile_id: profileId,
        p_payment_id: paymentId,
        p_reason: reason,
      });
      if (error || !data) throw new Error(`Échec de l'annulation : ${error?.message ?? "inconnu"}`);

      return data;
    },
  };
}
