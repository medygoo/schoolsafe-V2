import { z } from "zod";

export const cancelPaymentSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;
