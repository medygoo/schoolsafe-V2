import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface FinancePaymentService {
  getStudentFeeWithPayments(schoolId: string, studentFeeId: string): Promise<unknown>;
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
