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

export function createFinancePaymentService(supabaseUrl: string, serviceRoleKey: string): FinancePaymentService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);

  return {
    async getStudentFeeWithPayments(schoolId, studentFeeId) {
      const { data: studentFee, error: feeError } = await client
        .from("student_fees")
        .select("*, students!inner(id, matricule, first_name, last_name), fee_structures(id, label, amount, currency)")
        .eq("id", studentFeeId)
        .eq("school_id", schoolId)
        .single();
      if (feeError || !studentFee) throw new Error(`Frais etudiant introuvable : ${feeError?.message}`);

      const { data: payments, error: paymentsError } = await client
        .from("fee_payments")
        .select("*")
        .eq("student_fee_id", studentFeeId)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (paymentsError) throw new Error(`Echec du chargement des paiements : ${paymentsError.message}`);

      return { ...studentFee, payments: payments ?? [] };
    },

    async cancelPayment(schoolId, profileId, paymentId, reason) {
      const { data: payment, error: paymentError } = await client
        .from("fee_payments")
        .select("id, student_fee_id, amount, status")
        .eq("id", paymentId)
        .eq("school_id", schoolId)
        .single();
      if (paymentError || !payment) throw new Error(`Paiement introuvable : ${paymentError?.message}`);
      if (payment.status === "cancelled") throw new Error("Le paiement est deja annule");

      const { data: studentFee, error: feeError } = await client
        .from("student_fees")
        .select("id, amount_expected, amount_paid, amount_remaining, status")
        .eq("id", payment.student_fee_id)
        .eq("school_id", schoolId)
        .single();
      if (feeError || !studentFee) throw new Error(`Frais etudiant introuvable : ${feeError?.message}`);

      const { data: cancelledPayment, error: cancelError } = await client
        .from("fee_payments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: profileId,
          cancellation_reason: reason,
        })
        .eq("id", paymentId)
        .eq("school_id", schoolId)
        .select("*")
        .single();
      if (cancelError || !cancelledPayment) throw new Error(`Echec de l annulation : ${cancelError?.message}`);

      const newPaid = Math.max(Number(studentFee.amount_paid) - Number(payment.amount), 0);
      const newRemaining = Math.max(Number(studentFee.amount_expected) - newPaid, 0);
      let newStatus = "pending";
      if (newRemaining <= 0) newStatus = "paid";
      else if (newPaid > 0) newStatus = "partial";

      const { error: updateError } = await client
        .from("student_fees")
        .update({ amount_paid: newPaid, amount_remaining: newRemaining, status: newStatus })
        .eq("id", studentFee.id);
      if (updateError) throw new Error(`Echec de la mise a jour du solde : ${updateError.message}`);

      return cancelledPayment;
    },
  };
}
