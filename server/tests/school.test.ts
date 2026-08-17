import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AccessService } from "../src/access/service.js";
import type { SchoolService } from "../src/school/service.js";

function accessService(mock: { permission?: boolean; scope?: boolean } = {}): AccessService {
  return {
    hasPermission: vi.fn().mockResolvedValue(mock.permission ?? true),
    hasScope: vi.fn().mockResolvedValue(mock.scope ?? true),
  };
}

function createMockService(): SchoolService {
  return {
    getSettings: vi.fn().mockResolvedValue({
      identity: { name: "École Test", name_en: null, legal_name: null, school_type: "Privée", approval_code: "TEST-001" },
      brand: { primary_color: "#071a3d", accent_color: "#e9a515", document_footer: null, logo_path: null },
      contact: {
        country: "RDC", province: "Kinshasa", city: "Kinshasa", address: null,
        email: "contact@ecole.cd", phone: null, website_url: null, website_mode: "Créer un nouveau site SchoolSafe",
        public_news: "Après validation", public_gallery: "Après validation", public_honors: "Après validation",
      },
    }),
    updateSettings: vi.fn().mockResolvedValue({
      identity: { name: "École Test Mise à jour", name_en: null, legal_name: null, school_type: "Privée", approval_code: "TEST-001" },
      brand: { primary_color: "#071a3d", accent_color: "#e9a515", document_footer: null, logo_path: null },
      contact: {
        country: "RDC", province: "Kinshasa", city: "Kinshasa", address: null,
        email: "contact@ecole.cd", phone: null, website_url: null, website_mode: "Créer un nouveau site SchoolSafe",
        public_news: "Après validation", public_gallery: "Après validation", public_honors: "Après validation",
      },
    }),
    listStaff: vi.fn().mockResolvedValue([
      {
        id: "profile-1",
        first_name: "Jean",
        last_name: "Admin",
        display_name: "Jean Admin",
        email: "admin@ecole.cd",
        phone: null,
        is_active: true,
        roles: [{ id: "20000000-0000-0000-0000-000000000001", code: "admin", label: "Administrateur" }],
      },
    ]),
    inviteStaff: vi.fn().mockResolvedValue({ profile_id: "profile-2", user_id: "user-2" }),
    updateStaffRoles: vi.fn().mockResolvedValue(undefined),
    toggleStaffActive: vi.fn().mockResolvedValue(undefined),
    listRoles: vi.fn().mockResolvedValue([
      { id: "20000000-0000-0000-0000-000000000001", code: "admin", label: "Administrateur" },
      { id: "20000000-0000-0000-0000-000000000002", code: "teacher", label: "Enseignant" },
    ]),
    listPermissions: vi.fn().mockResolvedValue([
      { id: "perm-1", code: "school.manage", description: "Gérer l'école" },
      { id: "perm-2", code: "staff.manage", description: "Gérer le personnel" },
    ]),
  };
}

function buildTestApp(service: SchoolService, access: AccessService) {
  return buildApp({
    school: {
      service,
      resolveProfileAndSchool: vi.fn().mockResolvedValue({ profileId: "profile-1", schoolId: "school-1" }),
      access,
    },
    access,
  });
}

describe("School & Staff routes", () => {
  it("GET /school/settings returns school settings", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "GET",
      url: "/school/settings",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ identity: { name: "École Test" } });
    await app.close();
  });

  it("PUT /school/settings updates school settings", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "PUT",
      url: "/school/settings",
      headers: { authorization: "Bearer valid-token" },
      payload: { identity: { name: "École Test Mise à jour" } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ identity: { name: "École Test Mise à jour" } });
    await app.close();
  });

  it("GET /school/staff returns staff list", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "GET",
      url: "/school/staff",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    await app.close();
  });

  it("POST /school/staff/invite creates a staff member", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "POST",
      url: "/school/staff/invite",
      headers: { authorization: "Bearer valid-token" },
      payload: {
        email: "teacher@ecole.cd",
        first_name: "Marie",
        last_name: "Enseignante",
        role_ids: ["20000000-0000-0000-0000-000000000002"],
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ profile_id: "profile-2" });
    await app.close();
  });

  it("PUT /school/staff/:id/roles updates roles", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "PUT",
      url: "/school/staff/profile-1/roles",
      headers: { authorization: "Bearer valid-token" },
      payload: { role_ids: ["20000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000002"] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("POST /school/staff/:id/toggle toggles active state", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "POST",
      url: "/school/staff/profile-1/toggle",
      headers: { authorization: "Bearer valid-token" },
      payload: { is_active: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("GET /school/roles returns roles", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "GET",
      url: "/school/roles",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    await app.close();
  });

  it("GET /school/permissions returns permissions", async () => {
    const app = buildTestApp(createMockService(), accessService());
    const response = await app.inject({
      method: "GET",
      url: "/school/permissions",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    await app.close();
  });

  it("rejects requests without permission", async () => {
    const app = buildTestApp(createMockService(), accessService({ permission: false }));
    const response = await app.inject({
      method: "GET",
      url: "/school/staff",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ACCESS_DENIED" });
    await app.close();
  });
});
