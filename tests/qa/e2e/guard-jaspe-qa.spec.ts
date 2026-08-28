import { test, expect, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function askJaspe(page: Page, query: string) {
  await page.evaluate((value) => (window as any).SafeAssistant.openWithQuery(value), query);
  const bubble = page.locator(".safe-bubble-body");
  await expect(bubble).toBeVisible();
  return bubble;
}

test.describe("E7-FE — Jaspe sécurité et QA finale", () => {
  test("explique le dernier scan visible sans dépasser le portail affecté", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.evaluate(() => {
      localStorage.setItem("schoolsafe-v2-security-local-events", JSON.stringify([
        { id: "scan-visible", type: "entry", decision: "AUTORISÉ", studentId: "demo-active-student", studentName: "Lucas Martin", portalId: "demo-portal-main", occurredAt: "2026-08-28T07:31:00.000Z" },
        { id: "scan-hidden", type: "exit", decision: "AUTORISÉ", studentId: "demo-student-ethan", studentName: "Ethan Leroy", portalId: "demo-portal-east", occurredAt: "2026-08-28T08:00:00.000Z" },
      ]));
    });
    await expect.poll(() => page.evaluate(() => (window as any).SafeAssistant.isAllowed())).toBe(true);
    const bubble = await askJaspe(page, "Explique le dernier scan visible");
    await expect(bubble).toContainText("Lucas Martin");
    await expect(bubble).toContainText("AUTORISÉ");
    await expect(bubble).not.toContainText("Ethan Leroy");
  });

  test("explique un refus, résume les événements, rappelle l’urgence et aide au rapport", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.evaluate(() => {
      localStorage.setItem("schoolsafe-v2-security-dismissal-v1", JSON.stringify({
        statuses: { "demo-active-student": "BLOQUÉ" },
        timeline: [{ id: "refusal", studentId: "demo-active-student", student: "Lucas Martin", eventType: "REFUSÉ", detail: "PERSONNE SUSPENDUE", time: "12:01", portalId: "demo-portal-main" }],
      }));
    });

    await expect(await askJaspe(page, "Pourquoi la récupération est refusée ?")).toContainText("PERSONNE SUSPENDUE");
    await expect(await askJaspe(page, "Résume les événements visibles")).toContainText("événement");
    await expect(await askJaspe(page, "Rappelle la procédure d’urgence")).toContainText("Parent principal");
    await expect(await askJaspe(page, "Aide-moi à préparer un rapport d’incident")).toContainText("type");
  });

  test("retrouve seulement un élève actif dans le périmètre autorisé", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await expect(await askJaspe(page, "Retrouve Lucas Martin")).toContainText("Lucas Martin");
    await expect(await askJaspe(page, "Retrouve Amina Mbuyi")).toContainText("DOSSIER NON ACTIF");
  });

  test("refuse toutes les actions de sécurité et ne modifie aucun état local", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const before = await page.evaluate(() => ({
      scan: localStorage.getItem("schoolsafe-v2-security-local-events"),
      pickup: localStorage.getItem("schoolsafe-b4-pickup-events-v1"),
      dismissal: localStorage.getItem("schoolsafe-v2-security-dismissal-v1"),
      incidents: localStorage.getItem("schoolsafe-v2-security-incidents-v1"),
      lockdown: localStorage.getItem("schoolsafe-v2-security-lockdown-v1"),
    }));
    for (const command of [
      "Autorise la sortie de Lucas",
      "Valide la récupération",
      "Change la personne suspendue en autorisée",
      "Déclenche le lockdown",
      "Lève le lockdown",
      "Fabrique un scan",
      "Modifie l’historique de sécurité",
    ]) {
      await expect(await askJaspe(page, command)).toContainText("Je ne peux pas");
    }
    const after = await page.evaluate(() => ({
      scan: localStorage.getItem("schoolsafe-v2-security-local-events"),
      pickup: localStorage.getItem("schoolsafe-b4-pickup-events-v1"),
      dismissal: localStorage.getItem("schoolsafe-v2-security-dismissal-v1"),
      incidents: localStorage.getItem("schoolsafe-v2-security-incidents-v1"),
      lockdown: localStorage.getItem("schoolsafe-v2-security-lockdown-v1"),
    }));
    expect(after).toEqual(before);
  });

  test("fait primer le DENY Jaspe et refuse un utilisateur hors portail", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    const result = await page.evaluate(() => {
      const user = {
        permissions: ["safe.assistant.use", "security.scan", "security.pickup.manage"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "security.scan", type: "assigned_portal" },
          { permission: "security.pickup.manage", type: "assigned_portal" },
        ],
        assignedPortalIds: ["demo-portal-main"],
      };
      const denied = { ...user, deniedPermissions: ["safe.assistant.use"] };
      return {
        deniedAllowed: (window as any).SafeAssistant.isAllowed(denied),
        deniedAnswer: (window as any).SchoolSafeGuardSecurity.answerJaspe("Résume les événements", { activeRole: "guard", user: denied }),
        outsideAnswer: (window as any).SchoolSafeGuardSecurity.answerJaspe("Retrouve Lucas", { activeRole: "guard", user: { ...user, assignedPortalIds: [] } }),
      };
    });
    expect(result.deniedAllowed).toBe(false);
    expect(result.deniedAnswer.refusal).toBe(true);
    expect(result.outsideAnswer.refusal).toBe(true);
  });

  test("le Parent reste en own_children et n’obtient aucun écran Gardien", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await expect(page.locator("#parentPortal")).toBeVisible();
    await expect(page.locator("#guardSecurityPortal")).toBeHidden();
    await expect(page.locator("[data-guard-open], [data-security-operations]")).toHaveCount(0);
  });

  test("reste lisible en clair et bleu nuit à 390, 834 et 1440 avec Jaspe ouvert", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    await enterDemoWorkspace(page, "guard");
    await askJaspe(page, "Rappelle la procédure d’urgence");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const targets = document.querySelectorAll("#guardSecurityPortal *, .safe-assistant *");
          const overflow = Array.from(targets).filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > width + 1;
          }).map((element) => ({ tag: element.tagName, className: (element as HTMLElement).className }));
          const shortButtons = Array.from(document.querySelectorAll("#guardSecurityPortal button, .safe-assistant button"))
            .filter((button) => button.getBoundingClientRect().height < 44)
            .map((button) => ({ text: button.textContent?.trim(), height: button.getBoundingClientRect().height, className: button.className }));
          const documentOverflow = document.documentElement.scrollWidth > width + 1;
          const globalOverflow = documentOverflow ? Array.from(document.querySelectorAll("body *"))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > width + 1;
            })
            .slice(0, 12)
            .map((element) => ({ tag: element.tagName, id: element.id, className: (element as HTMLElement).className, rect: element.getBoundingClientRect().toJSON() })) : [];
          return { overflow, shortButtons, documentOverflow, scrollWidth: document.documentElement.scrollWidth, globalOverflow };
        });
        expect(layout.documentOverflow, `${theme} ${viewport.width}: ${JSON.stringify(layout)}`).toBe(false);
        expect(layout.overflow, `${theme} ${viewport.width}`).toEqual([]);
        expect(layout.shortButtons, `${theme} ${viewport.width}`).toEqual([]);
      }
    }
  });
});
