import { z } from "zod";
import { currencySchema } from "../control/schema.js";

export const dailyReportQuerySchema = z.object({
  date: z.string().date(),
  currency: currencySchema.optional(),
});

export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;

export const closeCashRegisterSchema = z.object({
  date: z.string().date(),
  expected_amount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
