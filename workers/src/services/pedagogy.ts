import { createServiceClient } from "../lib/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PedagogyService {
  listClasses(schoolId: string): Promise<unknown[]>;
  listSubjects(schoolId: string): Promise<unknown[]>;
  createSubject(schoolId: string, input: Record<string, unknown>): Promise<unknown>;
  listTeacherAssignments(schoolId: string): Promise<unknown[]>;
  createTeacherAssignment(schoolId: string, input: Record<string, unknown>): Promise<unknown>;
  deleteTeacherAssignment(schoolId: string, id: string): Promise<void>;
  listAssignments(schoolId: string, options: Record<string, string | undefined>): Promise<unknown[]>;
  createAssignment(schoolId: string, profileId: string, input: Record<string, unknown>): Promise<unknown>;
  updateAssignment(schoolId: string, profileId: string, id: string, input: Record<string, unknown>): Promise<unknown>;
  publishAssignment(schoolId: string, profileId: string, id: string): Promise<unknown>;
  getAssignmentGrades(schoolId: string, id: string): Promise<unknown[]>;
  saveGrades(schoolId: string, profileId: string, id: string, grades: unknown[]): Promise<unknown[]>;
  listLessonPlans(schoolId: string, options: Record<string, string | undefined>): Promise<unknown[]>;
  createLessonPlan(schoolId: string, profileId: string, input: Record<string, unknown>): Promise<unknown>;
}

export function createPedagogyService(supabaseUrl: string, serviceRoleKey: string): PedagogyService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async listClasses(schoolId) {
      const { data, error } = await client.from("classes").select("*").eq("school_id", schoolId).order("name");
      if (error) throw new Error(`List classes failed: ${error.message}`);
      return data ?? [];
    },
    async listSubjects(schoolId) {
      const { data, error } = await client.from("subjects").select("*").eq("school_id", schoolId).order("name");
      if (error) throw new Error(`List subjects failed: ${error.message}`);
      return data ?? [];
    },
    async createSubject(schoolId, input) {
      const { data, error } = await client.from("subjects").insert({ school_id: schoolId, ...input }).select("*").single();
      if (error || !data) throw new Error(`Create subject failed: ${error?.message}`);
      return data;
    },
    async listTeacherAssignments(schoolId) {
      const { data, error } = await client
        .from("teacher_assignments")
        .select("*, subjects(*), classes(*), profiles:teacher_id(id, display_name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`List teacher assignments failed: ${error.message}`);
      return data ?? [];
    },
    async createTeacherAssignment(schoolId, input) {
      const { data, error } = await client
        .from("teacher_assignments")
        .insert({ school_id: schoolId, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`Create teacher assignment failed: ${error?.message}`);
      return data;
    },
    async deleteTeacherAssignment(schoolId, id) {
      const { error } = await client.from("teacher_assignments").delete().eq("id", id).eq("school_id", schoolId);
      if (error) throw new Error(`Delete teacher assignment failed: ${error.message}`);
    },
    async listAssignments(schoolId, options) {
      let q = client
        .from("assignments")
        .select("*, subjects(*), classes(*), profiles:teacher_id(id, display_name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (options.classId) q = q.eq("class_id", options.classId);
      if (options.subjectId) q = q.eq("subject_id", options.subjectId);
      if (options.teacherId) q = q.eq("teacher_id", options.teacherId);
      const { data, error } = await q;
      if (error) throw new Error(`List assignments failed: ${error.message}`);
      return data ?? [];
    },
    async createAssignment(schoolId, profileId, input) {
      const now = new Date().toISOString();
      const { data: assignment, error } = await client
        .from("assignments")
        .insert({ school_id: schoolId, teacher_id: profileId, status: "draft", ...input, created_at: now })
        .select("*")
        .single();
      if (error || !assignment) throw new Error(`Create assignment failed: ${error?.message}`);
      const questions = (input.questions as unknown[]) ?? [];
      if (questions.length > 0) {
        const { error: qErr } = await client.from("assignment_questions").insert(
          questions.map((q, i) => ({
            assignment_id: assignment.id,
            ...(q as object),
            order_index: (q as { order_index?: number }).order_index ?? i,
          })),
        );
        if (qErr) throw new Error(`Create questions failed: ${qErr.message}`);
      }
      return assignment;
    },
    async updateAssignment(schoolId, profileId, id, input) {
      const update: Record<string, unknown> = { ...input, updated_by: profileId, updated_at: new Date().toISOString() };
      if (input.status === "published") update.published_at = new Date().toISOString();
      const { data, error } = await client
        .from("assignments")
        .update(update)
        .eq("id", id)
        .eq("school_id", schoolId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`Update assignment failed: ${error?.message}`);
      return data;
    },
    async publishAssignment(schoolId, profileId, id) {
      return this.updateAssignment(schoolId, profileId, id, { status: "published" });
    },
    async getAssignmentGrades(schoolId, id) {
      const { data, error } = await client
        .from("grades")
        .select("*, students(id, matricule, first_name, last_name)")
        .eq("assignment_id", id)
        .eq("school_id", schoolId);
      if (error) throw new Error(`Get grades failed: ${error.message}`);
      return data ?? [];
    },
    async saveGrades(schoolId, profileId, id, grades) {
      const now = new Date().toISOString();
      for (const g of grades) {
        const values = { ...(g as object), updated_by: profileId, updated_at: now };
        const existing = await client
          .from("grades")
          .select("id")
          .eq("assignment_id", id)
          .eq("student_id", (g as { student_id: string }).student_id)
          .maybeSingle();
        if (existing.data) {
          const { error } = await client.from("grades").update(values).eq("id", existing.data.id);
          if (error) throw new Error(`Update grade failed: ${error.message}`);
        } else {
          const { error } = await client
            .from("grades")
            .insert({ school_id: schoolId, assignment_id: id, created_by: profileId, created_at: now, ...values });
          if (error) throw new Error(`Insert grade failed: ${error.message}`);
        }
      }
      return this.getAssignmentGrades(schoolId, id);
    },
    async listLessonPlans(schoolId, options) {
      let q = client
        .from("lesson_plans")
        .select("*, subjects(*), classes(*), profiles:teacher_id(id, display_name)")
        .eq("school_id", schoolId)
        .order("lesson_date", { ascending: false });
      if (options.classId) q = q.eq("class_id", options.classId);
      if (options.subjectId) q = q.eq("subject_id", options.subjectId);
      if (options.teacherId) q = q.eq("teacher_id", options.teacherId);
      const { data, error } = await q;
      if (error) throw new Error(`List lesson plans failed: ${error.message}`);
      return data ?? [];
    },
    async createLessonPlan(schoolId, profileId, input) {
      const { data, error } = await client
        .from("lesson_plans")
        .insert({ school_id: schoolId, teacher_id: profileId, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`Create lesson plan failed: ${error?.message}`);
      return data;
    },
  };
}
