import { describe, it, expect } from "vitest";
import { SchoolSafeError } from "../../../server/src/http/errors.js";
import { buildIntegrationHarness } from "./helpers/harness.js";

const teacherToken = "teacher-token";

const baseTokens = {
  [teacherToken]: {
    profileId: "profile-teacher-1",
    schoolId: "school-1",
    permissions: ["pedagogy.grade.manage", "pedagogy.assignment.manage"],
    scopes: [{ type: "assigned_classes", id: "class-a" }],
  },
};

describe("Pedagogy — grade management", () => {
  it("teacher can update draft grade → 200", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
      pedagogy: {
        async saveGrades(_schoolId, _profileId, assignmentId, grades) {
          return grades.map((g, i) => ({
            id: `grade-${i}`,
            assignment_id: assignmentId,
            student_id: g.student_id,
            value_numeric: g.value_numeric,
            status: g.status,
          }));
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/pedagogy/assignments/assignment-draft/grades",
      token: teacherToken,
      payload: {
        grades: [
          {
            student_id: "550e8400-e29b-41d4-a716-446655440001",
            value_numeric: 14,
            status: "draft",
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: Array<{ value_numeric: number }> };
    expect(body.data[0].value_numeric).toBe(14);
  });

  it("teacher cannot update published grade → 403 CONDITION_DENIED", async () => {
    const { request } = buildIntegrationHarness({
      tokens: baseTokens,
      pedagogy: {
        async saveGrades() {
          throw new SchoolSafeError(
            403,
            "CONDITION_DENIED",
            "Modification refusée : une cote publiée ne peut être changée sans motif",
            false,
          );
        },
      },
    });

    const res = await request({
      method: "POST",
      url: "/pedagogy/assignments/assignment-published/grades",
      token: teacherToken,
      payload: {
        grades: [
          {
            student_id: "550e8400-e29b-41d4-a716-446655440001",
            value_numeric: 16,
            status: "published",
          },
        ],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { code: string };
    expect(body.code).toBe("CONDITION_DENIED");
  });
});

describe("Pedagogy — assignment publication", () => {
  it("teacher can publish a draft assignment → 200", async () => {
    const { request } = buildIntegrationHarness({ tokens: baseTokens });

    const res = await request({
      method: "POST",
      url: "/pedagogy/assignments/assignment-draft/publish",
      token: teacherToken,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { status: string } };
    expect(body.data.status).toBe("published");
  });
});
