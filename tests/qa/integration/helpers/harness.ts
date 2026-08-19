import { buildApp } from "../../../../server/src/app.js";
import type { FastifyInstance } from "fastify";
import type { AccessService } from "../../../../server/src/access/service.js";
import type { FinancePaymentService } from "../../../../server/src/finance/payments/service.js";
import type { SecurityService } from "../../../../server/src/security/service.js";
import type { PedagogyService } from "../../../../server/src/pedagogy/service.js";
import type { ApprovalService } from "../../../../server/src/pilotage/approvals/service.js";
import type { AuditService } from "../../../../server/src/audit/service.js";
import { vi } from "vitest";

export type TokenClaims = {
  profileId: string;
  schoolId: string;
  permissions: string[];
  scopes?: Array<{ type: string; id?: string | null }>;
};

export type HarnessOptions = {
  tokens: Record<string, TokenClaims>;
  financePayments?: Partial<FinancePaymentService>;
  security?: Partial<SecurityService>;
  pedagogy?: Partial<PedagogyService>;
  approvals?: Partial<ApprovalService>;
  audit?: AuditService;
};

export type IntegrationHarness = {
  app: FastifyInstance;
  access: AccessService;
  auditLog: Array<{ schoolId: string; actorProfileId: string; eventType: string; payload: Record<string, unknown> }>;
  request(options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    url: string;
    token: string;
    payload?: unknown;
  }): Promise<{ statusCode: number; json: () => unknown }>;
};

export function buildIntegrationHarness(options: HarnessOptions): IntegrationHarness {
  const permissionMap = new Map<string, Set<string>>();
  const scopeMap = new Map<string, Array<{ type: string; id?: string | null }>>();

  for (const [token, claims] of Object.entries(options.tokens)) {
    permissionMap.set(token, new Set(claims.permissions));
    scopeMap.set(token, claims.scopes ?? []);
  }

  const access: AccessService = {
    async hasPermission(token, permissionCode) {
      return permissionMap.get(token)?.has(permissionCode) ?? false;
    },
    async hasScope(token, scopeType, scopeId) {
      const scopes = scopeMap.get(token) ?? [];
      return scopes.some((s) => s.type === scopeType && (scopeId === undefined || scopeId === null || s.id === scopeId));
    },
  };

  const resolveProfileAndSchool = async (token: string) => {
    const claims = options.tokens[token];
    if (!claims) return { profileId: null, schoolId: null };
    return { profileId: claims.profileId, schoolId: claims.schoolId };
  };

  const resolveProfileId = async (token: string) => {
    return options.tokens[token]?.profileId ?? null;
  };

  const auditLog: IntegrationHarness["auditLog"] = [];
  const auditService: AuditService =
    options.audit ??
    ({
      async insert(event) {
        auditLog.push(event);
      },
    } as AuditService);

  const defaultFinancePayments: FinancePaymentService = {
    async getStudentFeeWithPayments() {
      return { id: "sf-1", payments: [] };
    },
    async recordPayment() {
      return { payment: { id: "pay-new", status: "valid" }, student_fee: { id: "sf-1", status: "partial" } };
    },
    async cancelPayment() {
      return { payment: { id: "pay-1", status: "cancelled" }, student_fee: { id: "sf-1", status: "pending" } };
    },
  };

  const defaultSecurity: SecurityService = {
    async createCard() {
      return { card_number: "SS-TEST-001", signature: "sig" };
    },
    async scan(input) {
      return {
        decision: "allowed" as const,
        student: {
          id: "student-1",
          matricule: "MAT-001",
          first_name: "Grâce",
          last_name: "Kabamba",
          class_name: "4e primaire",
          photo_path: null,
        },
        authorized_persons: [],
        event: { id: "evt-1", event_type: input.event_type, decision: "allowed" as const, occurred_at: new Date().toISOString() },
      };
    },
    async setLockdown(active) {
      return { active, activated_at: active ? new Date().toISOString() : null, activated_by: "profile-1" };
    },
    async listEvents() {
      return { data: [], count: 0 };
    },
  };

  const defaultPedagogy: PedagogyService = {
    async listClasses() {
      return [];
    },
    async listSubjects() {
      return [];
    },
    async createSubject(schoolId, input) {
      return { id: "subject-1", school_id: schoolId, ...input };
    },
    async listTeacherAssignments() {
      return [];
    },
    async createTeacherAssignment(schoolId, input) {
      return { id: "ta-1", school_id: schoolId, ...input };
    },
    async deleteTeacherAssignment() {},
    async listAssignments() {
      return [];
    },
    async createAssignment(schoolId, profileId, input) {
      return { id: "assignment-1", school_id: schoolId, teacher_id: profileId, status: "draft", ...input };
    },
    async updateAssignment(schoolId, profileId, assignmentId, input) {
      return { id: assignmentId, school_id: schoolId, teacher_id: profileId, ...input };
    },
    async publishAssignment(schoolId, profileId, assignmentId) {
      return { id: assignmentId, school_id: schoolId, teacher_id: profileId, status: "published" };
    },
    async getAssignmentGrades() {
      return [];
    },
    async saveGrades(schoolId, profileId, assignmentId, grades) {
      return grades.map((g, i) => ({ id: `grade-${i}`, school_id: schoolId, assignment_id: assignmentId, ...g }));
    },
    async publishGrades(schoolId, profileId, assignmentId) {
      return [];
    },
    async listLessonPlans() {
      return [];
    },
    async createLessonPlan(schoolId, profileId, input) {
      return { id: "lp-1", school_id: schoolId, teacher_id: profileId, ...input };
    },
    async updateLessonPlan(schoolId, profileId, lessonPlanId, input) {
      return { id: lessonPlanId, school_id: schoolId, teacher_id: profileId, ...input };
    },
    async deleteLessonPlan() {},
    async getParentChildren() {
      return [];
    },
    async getStudentGradesForParent() {
      return { student: {}, grades: [] };
    },
    async computeStudentAverages() {
      return { student: {}, averages: [] };
    },
  };

  const defaultApprovals: ApprovalService = {
    async list() {
      return { data: [], count: 0 };
    },
    async create(schoolId, profileId, input) {
      return {
        id: "approval-1",
        school_id: schoolId,
        request_type: input.request_type,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        requested_by: profileId,
        requested_at: new Date().toISOString(),
        status: "pending",
        decided_by: null,
        decided_at: null,
        expected_version: input.expected_version ?? 1,
        payload: input.payload ?? {},
        reason: input.reason ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    async decide(approvalId, schoolId, profileId, input) {
      return {
        id: approvalId,
        school_id: schoolId,
        request_type: "payment_cancel",
        entity_type: "payment",
        entity_id: "payment-1",
        requested_by: "profile-1",
        requested_at: new Date().toISOString(),
        status: input.decision,
        decided_by: profileId,
        decided_at: new Date().toISOString(),
        expected_version: 1,
        payload: {},
        reason: input.reason ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
  };

  const financePaymentsService: FinancePaymentService = {
    ...defaultFinancePayments,
    ...options.financePayments,
  };

  const securityService: SecurityService = {
    ...defaultSecurity,
    ...options.security,
  };

  const pedagogyService: PedagogyService = {
    ...defaultPedagogy,
    ...options.pedagogy,
  };

  const approvalService: ApprovalService = {
    ...defaultApprovals,
    ...options.approvals,
  };

  const app = buildApp({
    financePayments: {
      service: financePaymentsService,
      resolveProfileAndSchool,
      access,
      audit: auditService,
    },
    security: {
      service: securityService,
      resolveProfileId,
      access,
    },
    pedagogy: {
      service: pedagogyService,
      resolveProfileAndSchool,
      access,
    },
    approvals: {
      service: approvalService,
      resolveProfileAndSchool,
      access,
    },
  });

  return {
    app,
    access,
    auditLog,
    async request({ method, url, token, payload }) {
      const res = await app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
      return {
        statusCode: res.statusCode,
        json: () => res.json(),
      };
    },
  };
}

export function spyService<T extends object>(base: T): T {
  const spied = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(spied)) {
    if (typeof spied[key] === "function") {
      spied[key] = vi.fn(spied[key] as (...args: unknown[]) => unknown);
    }
  }
  return spied as T;
}
