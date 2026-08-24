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

describe("Permission catalog scopes", () => {
  const catalog = loadCatalog();

  it("has at least one permission", () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("every permission has a valid scope", () => {
    for (const permission of catalog) {
      expect(validScopes).toContain(permission.scope);
    }
  });

  it("every permission has a non-empty code and label", () => {
    for (const permission of catalog) {
      expect(typeof permission.code).toBe("string");
      expect(permission.code.length).toBeGreaterThan(0);
      expect(typeof permission.label).toBe("string");
      expect(permission.label.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate permission codes", () => {
    const codes = catalog.map((p) => p.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});
