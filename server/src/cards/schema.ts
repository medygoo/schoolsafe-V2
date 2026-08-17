import { z } from "zod";

export const requestCardPrintSchema = z.object({
  student_id: z.string().uuid(),
  format: z.enum(["badge", "carte"]),
  front_image_base64: z.string().min(1),
  back_image_base64: z.string().min(1),
  academic_year_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({})
});

export type RequestCardPrintInput = z.infer<typeof requestCardPrintSchema>;
