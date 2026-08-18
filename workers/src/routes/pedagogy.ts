import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { PedagogyService } from "../services/pedagogy.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const createSubjectSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  cycle_key: z.enum(["nursery", "primary", "secondary"]),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  language: z.enum(["FR", "EN"]),
  subject_family_code: z.string().max(50).optional(),
  is_active: z.boolean().default(true),
});

const createAssignmentSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  type: z.enum(["homework", "quiz", "exam", "compensatory"]),
  scale_mode: z.enum(["numeric", "qualitative", "custom"]).default("numeric"),
  scale_max: z.coerce.number().nonnegative().optional(),
  scale_label: z.string().max(100).optional(),
  coefficient: z.coerce.number().positive().default(1),
  due_date: z.string().date().optional(),
  prerequisites: z.string().max(2000).optional(),
  instructions: z.string().max(5000).optional(),
  language: z.enum(["FR", "EN"]),
  questions: z
    .array(
      z.object({
        text: z.string(),
        type: z.string(),
        points: z.coerce.number().optional(),
        answer_space: z.string().optional(),
        choices: z.string().optional(),
        order_index: z.coerce.number().default(0),
      }),
    )
    .default([]),
});

const createLessonPlanSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  lesson_date: z.string().date(),
  objectives: z.string().max(2000).optional(),
  materials: z.string().max(2000).optional(),
  procedure: z.string().max(5000).optional(),
  homework_assignment_id: z.string().uuid().optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })).default([]),
});

export function createPedagogyRouter(service: PedagogyService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/pedagogy/classes", requirePermission(access, "pedagogy.assignment.read"), async (c) =>
    c.json({ data: await service.listClasses(c.get("schoolId")) }),
  );

  router.get("/pedagogy/subjects", requirePermission(access, "pedagogy.subject.read"), async (c) =>
    c.json({ data: await service.listSubjects(c.get("schoolId")) }),
  );

  router.post("/pedagogy/subjects", requirePermission(access, "pedagogy.subject.manage"), async (c) => {
    const body = createSubjectSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.createSubject(c.get("schoolId"), body.data) }, 201);
  });

  router.get("/pedagogy/teacher-assignments", requirePermission(access, "pedagogy.assignment.read"), async (c) =>
    c.json({ data: await service.listTeacherAssignments(c.get("schoolId")) }),
  );

  router.post("/pedagogy/teacher-assignments", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    const body = await c.req.json();
    return c.json({ data: await service.createTeacherAssignment(c.get("schoolId"), body) }, 201);
  });

  router.delete("/pedagogy/teacher-assignments/:id", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    await service.deleteTeacherAssignment(c.get("schoolId"), c.req.param("id")!);
    return c.json({ success: true });
  });

  router.get("/pedagogy/assignments", requirePermission(access, "pedagogy.assignment.read"), async (c) => {
    const q = c.req.query();
    return c.json({
      data: await service.listAssignments(c.get("schoolId"), {
        classId: q.class_id,
        subjectId: q.subject_id,
        teacherId: q.teacher_id,
      }),
    });
  });

  router.post("/pedagogy/assignments", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    const body = createAssignmentSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.createAssignment(c.get("schoolId"), c.get("profileId"), body.data) }, 201);
  });

  router.patch("/pedagogy/assignments/:id", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    const body = await c.req.json();
    return c.json({
      data: await service.updateAssignment(c.get("schoolId"), c.get("profileId"), c.req.param("id")!, body),
    });
  });

  router.post("/pedagogy/assignments/:id/publish", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    return c.json({ data: await service.publishAssignment(c.get("schoolId"), c.get("profileId"), c.req.param("id")!) });
  });

  router.get("/pedagogy/assignments/:id/grades", requirePermission(access, "pedagogy.grade.read"), async (c) =>
    c.json({ data: await service.getAssignmentGrades(c.get("schoolId"), c.req.param("id")!) }),
  );

  router.post("/pedagogy/assignments/:id/grades", requirePermission(access, "pedagogy.grade.manage"), async (c) => {
    const body = (await c.req.json()) as { grades: unknown[] };
    return c.json({
      data: await service.saveGrades(c.get("schoolId"), c.get("profileId"), c.req.param("id")!, body.grades ?? []),
    });
  });

  router.get("/pedagogy/lesson-plans", requirePermission(access, "pedagogy.lesson-plan.read"), async (c) => {
    const q = c.req.query();
    return c.json({
      data: await service.listLessonPlans(c.get("schoolId"), {
        classId: q.class_id,
        subjectId: q.subject_id,
        teacherId: q.teacher_id,
      }),
    });
  });

  router.post("/pedagogy/lesson-plans", requirePermission(access, "pedagogy.lesson-plan.manage"), async (c) => {
    const body = createLessonPlanSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.createLessonPlan(c.get("schoolId"), c.get("profileId"), body.data) }, 201);
  });

  return router;
}
