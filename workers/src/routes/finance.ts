import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { FinanceService } from "../services/finance.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const currencySchema = z.enum(["USD", "CDF"]);
const cycleKeySchema = z.enum(["nursery", "primary", "secondary"]);

const createFeeStructureSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  cycle_key: cycleKeySchema,
  label: z.string().min(1).max(200),
  amount: z.coerce.number().nonnegative(),
  currency: currencySchema.default("USD"),
  due_date: z.string().date().optional(),
  is_active: z.boolean().default(true),
});

const createPaymentSchema = z.object({
  student_fee_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: currencySchema.default("USD"),
  received_at: z.string().datetime().optional(),
  receipt_no: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export function createFinanceRouter(service: FinanceService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/finance/fee-structures", requirePermission(access, "finance.fee.read"), async (c) => {
    return c.json({ data: await service.listFeeStructures(c.get("schoolId")) });
  });

  router.post("/finance/fee-structures", requirePermission(access, "finance.fee.manage"), async (c) => {
    const body = createFeeStructureSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const profileId = c.get("profileId") as string;
    return c.json({ data: await service.createFeeStructure(c.get("schoolId"), { ...body.data, created_by: profileId }) }, 201);
  });

  router.get("/finance/student-fees", requirePermission(access, "finance.fee.read"), async (c) => {
    const q = c.req.query();
    return c.json({ data: await service.listStudentFees(c.get("schoolId"), { studentId: q.student_id, status: q.status }) });
  });

  router.post("/finance/payments", requirePermission(access, "finance.payment.record"), async (c) => {
    const body = createPaymentSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const profileId = c.get("profileId") as string;
    return c.json({ data: await service.createPayment(c.get("schoolId"), profileId, body.data) }, 201);
  });

  return router;
}
