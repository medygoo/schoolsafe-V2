import { expect, test, type Page } from "@playwright/test";
import { enterDemoWorkspace, openDocumentsCenter } from "./helpers";

type Surface = {
  phase: string;
  label: string;
  role: string;
  selector: string;
  branch?: string;
  documents?: boolean;
};

const SURFACES: Surface[] = [
  { phase: "B", label: "Élèves", role: "admin", branch: "school", selector: "#schoolModule" },
  { phase: "C", label: "Parent", role: "parent", selector: "#parentPortal" },
  { phase: "D", label: "Pédagogie Enseignant", role: "teacher", selector: "#teacherPedagogyPortal" },
  { phase: "E", label: "Sécurité Gardien", role: "guard", selector: "#guardSecurityPortal" },
  { phase: "F", label: "Finance", role: "finance", branch: "finance", selector: "#financeModule" },
  { phase: "G", label: "Comptabilité", role: "accountant", branch: "accounting", selector: "#accountingModule" },
  { phase: "H", label: "Personnel / RH", role: "hr", branch: "people", selector: "#hrModule" },
  { phase: "I", label: "Stock", role: "admin", branch: "inventory", selector: "#inventoryModule" },
  { phase: "J", label: "Documents", role: "admin", documents: true, selector: "#documentCenterModule" },
  { phase: "K", label: "Communication", role: "communication", branch: "communication", selector: "#communicationModule" },
  { phase: "L", label: "Administration / Jaspe", role: "admin", branch: "administration", selector: "#administrationModule" },
];

async function openSurface(page: Page, surface: Surface) {
  await enterDemoWorkspace(page, surface.role);
  if (surface.documents) {
    await openDocumentsCenter(page);
  } else if (surface.branch) {
    const entry = page.locator(`button[data-branch="${surface.branch}"]:visible`).first();
    await expect(entry).toBeVisible();
    await entry.evaluate((element: HTMLElement) => element.click());
  }
}

test.describe("Phase M1 — baseline finale du frontend B à L", () => {
  for (const surface of SURFACES) {
    test(`${surface.phase} — ${surface.label} reste accessible à un profil autorisé`, async ({ page }) => {
      await openSurface(page, surface);
      await expect(page.locator(surface.selector)).toBeVisible();
    });
  }

  test("charge les moteurs frontend et feuilles de style validés", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const runtime = await page.evaluate(() => ({
      globals: {
        academic: Boolean((window as any).SchoolSafeAcademicStructure),
        parent: Boolean((window as any).SchoolSafeParentPortal),
        teacher: Boolean((window as any).SchoolSafeTeacherPedagogy),
        guard: Boolean((window as any).SchoolSafeGuardSecurity),
        finance: Boolean((window as any).SchoolSafeFinanceModule),
        accounting: Boolean((window as any).SchoolSafeAccountingTreasury),
        hr: Boolean((window as any).SchoolSafeHrDemo),
        inventory: Boolean((window as any).SchoolSafeInventoryDemo),
        documents: Boolean((window as any).SchoolSafeDocumentCenter),
        communication: Boolean((window as any).SchoolSafeCommunication),
        administration: Boolean((window as any).SchoolSafeAdministration),
        jaspe: Boolean((window as any).SchoolSafeJaspeGovernance && (window as any).SchoolSafeJaspeCapabilityRouter),
      },
      styles: Array.from(document.styleSheets).map((sheet) => sheet.href ? new URL(sheet.href).pathname.replace(/\\/g, "/") : ""),
    }));
    expect(Object.values(runtime.globals).every(Boolean)).toBe(true);
    for (const stylesheet of [
      "/styles/modules/academic-structure.css",
      "/styles/modules/parent-portal.css",
      "/styles/modules/teacher-pedagogy.css",
      "/styles/modules/guard-security.css",
      "/styles/modules/finance.css",
      "/styles/modules/accounting-treasury.css",
      "/styles/modules/hr.css",
      "/styles/modules/inventory.css",
      "/styles/modules/document-center.css",
      "/styles/modules/communication.css",
      "/styles/modules/administration.css",
    ]) expect(runtime.styles).toContain(stylesheet);
  });

  test("le parcours d’entrée et le workspace ne produisent aucune erreur JavaScript inexpliquée", async ({ page }) => {
    const pageErrors: string[] = [];
    const unexpectedConsoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      const explainedByHarness = text.includes("ERR_NETWORK_ACCESS_DENIED") || text.startsWith("[SW] Registration failed");
      if (!explainedByHarness) unexpectedConsoleErrors.push(text);
    });
    await enterDemoWorkspace(page, "admin");
    for (const branch of ["school", "finance", "accounting", "inventory", "communication", "administration"]) {
      const entry = page.locator(`button[data-branch="${branch}"]:visible`).first();
      await entry.evaluate((element: HTMLElement) => element.click());
      await page.waitForTimeout(50);
      await page.evaluate(() => (window as any).SchoolSafeAppContext.showDashboard());
    }
    expect(pageErrors).toEqual([]);
    expect(unexpectedConsoleErrors).toEqual([]);
  });
});
