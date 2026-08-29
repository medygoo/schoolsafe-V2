import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const liveToken = "phase-m-live-session";

test.describe("M3 — séparation stricte live, démonstration et indisponible", () => {
  test("conserve des fixtures explicitement marquées en démonstration", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    await page.evaluate(() => {
      (window as any).SchoolSafeInventoryDemo.setSession(null);
      (window as any).SchoolSafeInventoryDemo.render("inventoryModule");
    });

    const inventory = page.locator("#inventoryModule");
    await expect(inventory.locator("[data-inventory-dashboard]")).toContainText("DÉMONSTRATION");
    await expect(inventory).toContainText("BACKEND_LATER");
  });

  test("ne révèle aucun enfant fictif dans une session Parent live", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");

    await page.evaluate((token) => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        token,
        permissions: ["school.student.read"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
        childIds: ["demo-parent-child-lucas"],
      });
    }, liveToken);

    const portal = page.locator("#parentPortal");
    await expect(portal).toContainText("DONNÉES INDISPONIBLES");
    await expect(portal).toContainText("BACKEND_LATER");
    await expect(portal).not.toContainText("Lucas Martin");
    await expect(portal.locator(".parent-dashboard-summary, .parent-child-identity")).toHaveCount(0);
  });

  test("ne révèle aucune classe, élève ou statistique pédagogique fictive en live", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");

    await page.evaluate((token) => {
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      (window as any).SchoolSafeTeacherPedagogy.render("teacherPedagogyPortal", {
        ...base,
        token,
        assignedClassIds: ["demo-class-1"],
        assignedSubjectIds: ["demo-subject-math"],
      });
    }, liveToken);

    const portal = page.locator("#teacherPedagogyPortal");
    await expect(portal).toContainText("DONNÉES INDISPONIBLES");
    await expect(portal).toContainText("BACKEND_LATER");
    await expect(portal).not.toContainText("Lucas Martin");
    await expect(portal).not.toContainText("6e A");
    await expect(portal.locator("form, [data-assigned-class], [data-assigned-subject]")).toHaveCount(0);
  });

  test("ne révèle aucun portail, élève ou événement Gardien fictif en live", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");

    await page.evaluate((token) => {
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      (window as any).SchoolSafeGuardSecurity.render("guardSecurityPortal", { ...base, token });
    }, liveToken);

    const portal = page.locator("#guardSecurityPortal");
    await expect(portal).toContainText("DONNÉES INDISPONIBLES");
    await expect(portal).toContainText("BACKEND_LATER");
    await expect(portal).not.toContainText("Lucas Martin");
    await expect(portal).not.toContainText("Portail principal");
    await expect(portal.locator("form, [data-guard-open]")).toHaveCount(0);
  });

  test("rend RH et Comptabilité indisponibles sans afficher leurs fixtures live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    await page.evaluate((token) => {
      const hr = (window as any).SchoolSafeHrDemo;
      hr.setSession({
        token,
        permissions: ["staff.read"],
        scopes: [{ permission: "staff.read", type: "school" }],
      });
      hr.render("hrModule");

      const accounting = (window as any).SchoolSafeAccountingTreasury;
      accounting.setSession({
        token,
        permissions: ["reports.financial.read"],
        scopes: [{ permission: "reports.financial.read", type: "school" }],
      });
      accounting.render("accountingModule");
    }, liveToken);

    const hr = page.locator("#hrContent");
    await expect(hr).toContainText("DONNÉES INDISPONIBLES");
    await expect(hr).toContainText("BACKEND_LATER");
    await expect(hr).not.toContainText("Aline Kalala");
    await expect(hr.locator("form, [data-hr-staff-original]")).toHaveCount(0);

    const accounting = page.locator("#accountingContent");
    await expect(accounting).toContainText("DONNÉES INDISPONIBLES");
    await expect(accounting).toContainText("BACKEND_LATER");
    await expect(accounting).not.toContainText("DÉMONSTRATION");
    await expect(accounting.locator("form, [data-accounting-dashboard]")).toHaveCount(0);
  });

  test("rend Finance et Contrôle des frais indisponibles sans données fictives live", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");

    await page.evaluate((token) => {
      const session = {
        token,
        permissions: ["finance.report.read", "finance.control.read"],
        scopes: [
          { permission: "finance.report.read", type: "school" },
          { permission: "finance.control.read", type: "school" },
        ],
      };
      (window as any).schoolSafeDemoMode = false;
      const finance = (window as any).SchoolSafeFinanceModule;
      finance.setSession(session);
      finance.render("financeModule", { tab: "overview" });

      const control = (window as any).SchoolSafeFeeControlModule;
      control.setSession(session);
      (document.getElementById("feeControlModule") as HTMLElement).hidden = false;
      control.render("feeControlContent");
    }, liveToken);

    const finance = page.locator("#financeContent");
    await expect(finance).toContainText("Vue d’ensemble non connectée");
    await expect(finance).toContainText("BACKEND_LATER");
    await expect(finance.locator("[data-finance-dashboard]")).toHaveCount(0);

    const control = page.locator("#feeControlContent");
    await expect(control).toContainText("DONNÉES INDISPONIBLES");
    await expect(control).toContainText("BACKEND_LATER");
    await expect(control).not.toContainText("Amina Kalonji");
    await expect(control.locator("form, [data-fee-control-campaign]")).toHaveCount(0);
  });

  test("n’expose ni ne persiste le dossier familial sensible en session live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    await page.evaluate((token) => {
      (window as any).schoolSafeDemoMode = false;
      (window as any).SchoolSafeStudentFamily.open(
        {
          id: "live-student-1",
          first_name: "Élève",
          last_name: "Réel",
          lifecycle_status: "draft",
          primary_parent: { display_name: "Parent réel" },
        },
        { token, permissions: ["school.student.manage"] },
      );
    }, liveToken);

    const modal = page.locator(".student-family-modal .ss-modal");
    await expect(modal).toContainText("DONNÉES INDISPONIBLES");
    await expect(modal).toContainText("BACKEND_LATER");
    await expect(modal.locator("form, .student-family-dossier")).toHaveCount(0);
    await expect(modal).not.toContainText("Mireille Wa Kalonji");
    expect(await page.evaluate(() => localStorage.getItem("schoolsafe-b2-family-demo-v1"))).toBeNull();
  });

  test("borne aussi la structure et le cycle scolaire B en session live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    await page.evaluate((token) => {
      const structureUser = {
        token,
        permissions: ["school.class.read", "school.structure.manage"],
        scopes: [
          { permission: "school.class.read", type: "school" },
          { permission: "school.structure.manage", type: "school" },
        ],
      };
      (window as any).SchoolSafeAcademicStructure.render(document.getElementById("schoolContent"), structureUser);
    }, liveToken);

    const structure = page.locator("#schoolContent");
    await expect(structure).toContainText("DONNÉES INDISPONIBLES");
    await expect(structure).toContainText("BACKEND_LATER");
    await expect(structure).not.toContainText("2026-2027");
    await expect(structure.locator("form, [data-academic-class]")).toHaveCount(0);

    await page.evaluate((token) => {
      (window as any).SchoolSafeStudentLifecycle.open(
        {
          id: "live-student-1",
          first_name: "Élève",
          last_name: "Réel",
          matricule: "LIVE-001",
          lifecycle_status: "active",
          class_id: "live-class-1",
          enrollment: { planned_class_name: "Classe réelle" },
        },
        {
          token,
          permissions: ["school.student.read", "school.enrollment.manage"],
          scopes: [
            { permission: "school.student.read", type: "school" },
            { permission: "school.enrollment.manage", type: "school" },
          ],
        },
      );
    }, liveToken);

    const lifecycle = page.locator(".student-lifecycle-modal .ss-modal");
    await expect(lifecycle).toContainText("DONNÉES INDISPONIBLES");
    await expect(lifecycle).toContainText("BACKEND_LATER");
    await expect(lifecycle.locator("form, [data-lifecycle-history-item]")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("schoolsafe-b5-lifecycle-demo-v1"))).toBeNull();
  });

  test("garde Communication et Stock bornés dans une session live", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");

    await page.evaluate((token) => {
      (window as any).SchoolSafeCommunication.setSession({ token, permissions: [], scopes: [] });
      (window as any).SchoolSafeCommunication.render("communicationModule");
      (window as any).SchoolSafeInventoryDemo.setSession({
        token,
        permissions: ["reports.operational.read"],
        scopes: [{ permission: "reports.operational.read", type: "school" }],
      });
      (window as any).SchoolSafeInventoryDemo.render("inventoryModule");
    }, liveToken);

    const communication = page.locator("#communicationContent");
    await expect(communication).toContainText("SESSION LIVE");
    await expect(communication).toContainText("DONNÉES RÉELLES INDISPONIBLES");
    await expect(communication.locator("[data-live-counter]")).toHaveCount(0);

    const inventory = page.locator("#inventoryContent");
    await expect(inventory).toContainText("AGRÉGATS AUTORISÉS");
    await expect(inventory).toContainText("Aucun détail opérationnel");
    await expect(inventory.locator("form, [data-inventory-item], [data-inventory-movement]")).toHaveCount(0);
  });
});
