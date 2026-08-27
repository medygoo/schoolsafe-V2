import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const catalogPath = resolve(__dirname, "../../../shared/permissions.json");

const validScopes = [
  "own",
  "own_children",
  "assigned_classes",
  "assigned_subjects",
  "assigned_portal",
  "school",
  "none",
];

interface PermissionEntry {
  code: string;
  label: string;
  scope: string;
}

function loadCatalog(): PermissionEntry[] {
  const raw = readFileSync(catalogPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("permissions.json must be an array");
  }
  return parsed as PermissionEntry[];
}

describe("Permission catalog completeness", () => {
  const catalog = loadCatalog();
  const codes = new Set(catalog.map((p) => p.code));

  it("contains 60 permissions including school.student.create", () => {
    expect(catalog.length).toBe(60);
    expect(catalog.some((permission) => permission.code === "school.student.create" && permission.scope === "school")).toBe(true);
  });

  it("does not create a dedicated remediation permission for the frontend draft", () => {
    expect(codes.has("pedagogy.remediation.manage")).toBe(false);
  });

  it("has no duplicate codes", () => {
    expect(codes.size).toBe(catalog.length);
  });

  it("has only non-ambiguous, single-purpose permissions", () => {
    for (const permission of catalog) {
      expect(permission.code).toMatch(/^[a-z][a-z0-9._-]+$/);
    }
  });

  it("includes the 15 missing-module permissions", () => {
    const missing = [
      "pedagogy.report.read",
      "pedagogy.report.manage",
      "palmarques.read",
      "palmarques.manage",
      "staff.read",
      "staff.attendance.read",
      "canteen.manage",
      "infirmary.manage",
      "communication.announcement.manage",
      "communication.message.send",
      "safe.assistant.use",
      "reports.operational.read",
      "reports.financial.read",
      "reports.security.read",
      "reports.hr.read",
    ];
    for (const code of missing) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("separates reports into distinct single-purpose permissions", () => {
    const reportCodes = [
      "reports.operational.read",
      "reports.financial.read",
      "reports.security.read",
      "reports.hr.read",
    ];
    for (const code of reportCodes) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("every permission has a valid scope", () => {
    for (const permission of catalog) {
      expect(validScopes).toContain(permission.scope);
    }
  });
});
