import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { enterDemoWorkspace } from "./helpers";

async function openAdministration(page: Page, view = "dashboard") {
  await enterDemoWorkspace(page, "admin");
  await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.evaluate((target) => (window as any).SchoolSafeAdministration.open(target), view);
  await expect(page.locator("#administrationModule")).toBeVisible();
}

test.describe("Phase L8 — QA Administration et Jaspe", () => {
  test("inspecte toutes les portées reconnues avec leur contexte exact", async ({ page }) => {
    await openAdministration(page, "inspector");
    const results = await page.evaluate(() => {
      const inspect = (window as any).SchoolSafeAdministration.inspectAccess;
      const scenarios = [
        { key: "own", permission: "file.download", user: { userId: "user-1" }, context: {} },
        { key: "own_children", permission: "finance.receipt.read", user: { childIds: ["child-1"] }, context: { childId: "child-1" } },
        { key: "assigned_classes", permission: "pedagogy.grade.read", user: { assignedClassIds: ["class-1"] }, context: { classId: "class-1" } },
        { key: "assigned_subjects", permission: "pedagogy.subject.read", user: { assignedSubjectIds: ["subject-1"] }, context: { subjectId: "subject-1" } },
        { key: "assigned_portal", permission: "security.scan", user: { assignedPortalIds: ["portal-1"] }, context: { portalId: "portal-1" } },
        { key: "school", permission: "roles.manage", user: { schoolId: "school-1" }, context: { schoolId: "school-1" } },
      ];
      return scenarios.map((scenario) => ({
        key: scenario.key,
        result: inspect({
          ...scenario.user,
          permissions: [scenario.permission],
          scopes: [{ permission: scenario.permission, type: scenario.key }],
        }, scenario.permission, scenario.key, scenario.context),
      }));
    });

    for (const scenario of results) {
      expect(scenario.result, scenario.key).toMatchObject({ allowed: true, status: "AUTORISÉ", scope: scenario.key });
    }
  });

  test("refuse les contextes hors portée et ne donne aucun bypass à admin", async ({ page }) => {
    await openAdministration(page, "inspector");
    const results = await page.evaluate(() => {
      const inspect = (window as any).SchoolSafeAdministration.inspectAccess;
      return {
        child: inspect({ permissions: ["finance.receipt.read"], scopes: [{ permission: "finance.receipt.read", type: "own_children" }], childIds: ["child-1"] }, "finance.receipt.read", "own_children", { childId: "child-2" }),
        class: inspect({ permissions: ["pedagogy.grade.read"], scopes: [{ permission: "pedagogy.grade.read", type: "assigned_classes" }], assignedClassIds: ["class-1"] }, "pedagogy.grade.read", "assigned_classes", { classId: "class-2" }),
        subject: inspect({ permissions: ["pedagogy.subject.read"], scopes: [{ permission: "pedagogy.subject.read", type: "assigned_subjects" }], assignedSubjectIds: ["subject-1"] }, "pedagogy.subject.read", "assigned_subjects", { subjectId: "subject-2" }),
        portal: inspect({ permissions: ["security.scan"], scopes: [{ permission: "security.scan", type: "assigned_portal" }], assignedPortalIds: ["portal-1"] }, "security.scan", "assigned_portal", { portalId: "portal-2" }),
        school: inspect({ permissions: ["roles.manage"], scopes: [{ permission: "roles.manage", type: "school" }], schoolId: "school-1" }, "roles.manage", "school", { schoolId: "school-2" }),
        admin: inspect({ role: "admin", schoolId: "school-1", permissions: [], scopes: [] }, "roles.manage", "school", { schoolId: "school-1" }),
      };
    });

    for (const key of ["child", "class", "subject", "portal", "school"] as const) {
      expect(results[key]).toMatchObject({ allowed: false, status: "SCOPE INCOMPATIBLE" });
    }
    expect(results.admin).toMatchObject({ allowed: false, status: "PERMISSION ABSENTE" });
  });

  test("fait primer DENY sur grant et exception ALLOW", async ({ page }) => {
    await openAdministration(page, "inspector");
    const result = await page.evaluate(() => (window as any).SchoolSafeAdministration.inspectAccess({
      permissions: ["roles.manage"],
      scopes: [{ permission: "roles.manage", type: "school" }],
      permissionExceptions: [
        { permission: "roles.manage", effect: "allow", scope: "school" },
        { permission: "roles.manage", effect: "deny" },
      ],
      schoolId: "school-1",
    }, "roles.manage", "school", { schoolId: "school-1" }));
    expect(result).toMatchObject({ allowed: false, status: "DENY EXPLICITE", exception: "DENY" });
  });

  test("Jaspe exige sa garde puis la permission métier, la portée et le contexte", async ({ page }) => {
    await openAdministration(page, "jaspe");
    const results = await page.evaluate(() => {
      const route = (window as any).SchoolSafeJaspeCapabilityRouter.route;
      const base = { userId: "user-1", schoolId: "school-1", permissions: ["safe.assistant.use"], scopes: [{ permission: "safe.assistant.use", type: "own" }] };
      return {
        noSafe: route("Explique le rapport financier", { user: { userId: "user-1", permissions: ["finance.report.read"], scopes: [{ permission: "finance.report.read", type: "school" }] } }),
        noBusiness: route("Explique le rapport financier", { user: base }),
        wrongScope: route("Explique le rapport financier", { user: { ...base, permissions: [...base.permissions, "finance.report.read"], scopes: [...base.scopes, { permission: "finance.report.read", type: "own" }] } }),
        deny: route("Explique le rapport financier", { user: { ...base, permissions: [...base.permissions, "finance.report.read"], deniedPermissions: ["finance.report.read"], scopes: [...base.scopes, { permission: "finance.report.read", type: "school" }] } }),
        allowed: route("Explique le rapport financier", { user: { ...base, permissions: [...base.permissions, "finance.report.read"], scopes: [...base.scopes, { permission: "finance.report.read", type: "school" }] } }),
      };
    });
    expect(results.noSafe.reason).toBe("SAFE_PERMISSION_ABSENTE");
    expect(results.noBusiness.reason).toBe("BUSINESS_PERMISSION_ABSENTE");
    expect(results.wrongScope.reason).toBe("BUSINESS_SCOPE_INCOMPATIBLE");
    expect(results.deny.reason).toBe("BUSINESS_DENY_EXPLICITE");
    expect(results.allowed).toMatchObject({ allowed: true, permission: "finance.report.read", scope: "school", target: "finance" });
  });

  test("Jaspe refuse les mutations d’accès et ne présente aucune interaction 3D", async ({ page }) => {
    await openAdministration(page, "jaspe");
    const mutation = await page.evaluate(() => (window as any).SchoolSafeJaspeCapabilityRouter.route(
      "Attribue le rôle admin et ajoute la permission roles.manage à cet utilisateur",
      { activeRole: "admin", user: { userId: "admin-1", permissions: ["safe.assistant.use", "roles.manage"], scopes: [{ permission: "safe.assistant.use", type: "own" }, { permission: "roles.manage", type: "school" }] } },
    ));
    expect(mutation).toMatchObject({ allowed: false, reason: "ADMINISTRATION_ACCES_INTERDITE" });
    await expect(page.locator("#administrationModule canvas, #administrationModule model-viewer, #administrationModule [data-jaspe-3d], #administrationModule [data-3d]")).toHaveCount(0);
    await expect(page.locator("#administrationModule")).not.toContainText(/GLB|Blender|avatar 3D/i);
  });

  test("n’utilise que des permissions du catalogue canonique", async () => {
    const root = process.cwd();
    const catalog = JSON.parse(await readFile(path.join(root, "shared", "permissions.json"), "utf8"));
    const canonical = new Set<string>(catalog.map((entry: { code: string }) => entry.code));
    const files = [
      "app/modules/administration/administration-demo.js",
      "app/modules/safe/jaspe-governance.js",
      "app/modules/safe/jaspe-capability-router.js",
    ];
    const used = new Set<string>();
    for (const file of files) {
      const source = await readFile(path.join(root, file), "utf8");
      for (const match of source.matchAll(/["']((?:school|staff|roles|security|pedagogy|finance|reports|safe|canteen|communication|notification|email|file|palmarques)\.[a-z][a-z.-]+)["']/g)) used.add(match[1]);
    }
    expect([...used].filter((permission) => !canonical.has(permission))).toEqual([]);
  });

  test("reste lisible à 390, 834 et 1440 en clair et bleu nuit", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    await openAdministration(page, "jaspe");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.locator("#administrationModule").evaluate((root) => {
          const visible = (element: Element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          };
          const overflow = Array.from(root.querySelectorAll("*")).filter(visible).filter((element) => {
            const rect = element.getBoundingClientRect();
            const scroller = element.closest(".administration-table-wrap, .administration-permission-list");
            return !scroller && (rect.right > document.documentElement.clientWidth + 1 || rect.left < -1);
          }).map((element) => ({ tag: element.tagName, className: element.className }));
          const shortControls = Array.from(root.querySelectorAll("button, input, select, textarea")).filter(visible).filter((element) => element.getBoundingClientRect().height < 43.5).map((element) => ({ tag: element.tagName, height: element.getBoundingClientRect().height }));
          return { overflow, shortControls, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
        });
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
        expect(layout.overflow).toEqual([]);
        expect(layout.shortControls).toEqual([]);
      }
    }
  });
});
