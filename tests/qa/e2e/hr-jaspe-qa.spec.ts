import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const hrUser = (permissions: string[], deniedPermissions: string[] = [], role = "hr") => ({
  role,
  permissions: ["safe.assistant.use", ...permissions],
  scopes: [
    { permission: "safe.assistant.use", type: "own" },
    ...permissions.map((permission) => ({ permission, type: "school" })),
  ],
  deniedPermissions,
});

async function askGlobalJaspe(page: Page, query: string) {
  await page.evaluate((value) => (window as any).SafeAssistant.openWithQuery(value), query);
  const bubble = page.locator(".safe-bubble-body");
  await expect(bubble).toBeVisible();
  return bubble;
}

test.describe("H8-FE — Jaspe RH et QA finale", () => {
  test("consulte un dossier visible avec staff.read sans autoriser sa modification", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const result = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeHrDemo;
      const context = { activeRole: "hr", user };
      return {
        lookup: api.answerJaspe("Retrouve la fiche RH de Aline Kalala", context),
        change: api.answerJaspe("Modifie officiellement le statut de Aline Kalala", context),
      };
    }, hrUser(["staff.read"]));
    expect(result.lookup).toMatchObject({ allowed: true, action: "staff" });
    expect(result.lookup.message).toContain("HR-DEM-001");
    expect(result.change).toMatchObject({ refusal: true });
  });

  test("prépare un brouillon RH local avec staff.manage sans ouvrir la Paie", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const user = hrUser(["staff.read", "staff.manage"]);
    const result = await page.evaluate((subject) => {
      const api = (window as any).SchoolSafeHrDemo;
      api.setSession(subject);
      const context = { activeRole: "hr", user: subject };
      const draft = api.answerJaspe("Prépare un brouillon d’observation RH pour Aline Kalala", context);
      const payroll = api.answerJaspe("Crée une prime et une avance pour Aline Kalala", context);
      api.render("hrModule");
      api.open("staff");
      return { draft, payroll };
    }, user);
    expect(result.draft).toMatchObject({ allowed: true, action: "staff" });
    expect(result.draft.message).toContain("BROUILLON LOCAL");
    expect(result.payroll).toMatchObject({ refusal: true });
    await expect(page.locator('[data-hr-staff-draft="hr-demo-1"]')).toContainText("Préparé par Jaspe");
    await expect(page.locator('[data-hr-staff-original="hr-demo-1"]')).toContainText("ACTIF");
  });

  test("applique les permissions exactes présence et rapports avec DENY prioritaire", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const result = await page.evaluate(({ attendance, reports, deniedAttendance, deniedReports }) => {
      const api = (window as any).SchoolSafeHrDemo;
      return {
        attendance: api.answerJaspe("Résume la présence du personnel et les retards", { activeRole: "hr", user: attendance }),
        reports: api.answerJaspe("Explique le rapport RH global", { activeRole: "hr", user: reports }),
        deniedAttendance: api.answerJaspe("Résume la présence du personnel", { activeRole: "hr", user: deniedAttendance }),
        deniedReports: api.answerJaspe("Explique le rapport RH global", { activeRole: "hr", user: deniedReports }),
      };
    }, {
      attendance: hrUser(["staff.attendance.read"]),
      reports: hrUser(["reports.hr.read"]),
      deniedAttendance: hrUser(["staff.attendance.read"], ["staff.attendance.read"]),
      deniedReports: hrUser(["reports.hr.read"], ["reports.hr.read"]),
    });
    expect(result.attendance).toMatchObject({ allowed: true, action: "attendance" });
    expect(result.reports).toMatchObject({ allowed: true, action: "reports" });
    expect(result.deniedAttendance).toMatchObject({ refusal: true });
    expect(result.deniedReports).toMatchObject({ refusal: true });
  });

  test("ne révèle aucune donnée RH générale au Parent, Gardien ou Enseignant standard", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const answers = await page.evaluate((subjects) => {
      const api = (window as any).SchoolSafeHrDemo;
      return subjects.map((user: any) => api.answerJaspe("Montre le dossier RH de Aline Kalala", { activeRole: user.role, user }));
    }, [hrUser(["staff.read"], [], "parent"), hrUser(["staff.read"], [], "guard"), hrUser(["staff.read"], [], "teacher")]);
    for (const answer of answers) {
      expect(answer).toMatchObject({ refusal: true });
      expect(answer.message).not.toContain("HR-DEM-001");
    }
  });

  test("refuse toutes les décisions, écritures Paie et captures biométriques", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const answers = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeHrDemo;
      const context = { activeRole: "hr", user };
      return [
        "Licencie officiellement Aline Kalala",
        "Réactive officiellement Jean Kabeya",
        "Approuve le congé de Patrick Mbala",
        "Change le contrat officiel de Aline Kalala",
        "Modifie l’affectation officielle de Patrick Mbala",
        "Corrige la présence officielle de Chantal Lukusa",
        "Crée un salaire et calcule la paie officielle",
        "Crée une prime, une avance et applique une retenue",
        "Produis un bulletin officiel et paie le salarié",
        "Enregistre une biométrie et capture une empreinte",
        "Capture le visage avec la webcam",
      ].map((query) => api.answerJaspe(query, context));
    }, hrUser(["staff.read", "staff.manage", "staff.attendance.read", "reports.hr.read"]));
    for (const answer of answers) {
      expect(answer).toMatchObject({ refusal: true });
      expect(answer.message).toContain("REFUS");
    }
  });

  test("route le Jaspe global vers le dossier RH avec les permissions réelles", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    const bubble = await askGlobalJaspe(page, "Retrouve la fiche RH de Aline Kalala");
    await expect(bubble).toContainText("HR-DEM-001");
    await expect(page.locator("#hrModule")).toBeVisible();
    await expect(page.locator("[data-hr-staff]")).toBeVisible();
  });

  test("reste lisible à 390, 834 et 1440 en clair et bleu nuit sans overflow", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    await enterDemoWorkspace(page, "hr");
    await askGlobalJaspe(page, "Explique le rapport RH global");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const visible = (node: Element) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
          const insideScroller = (node: Element) => {
            let parent = node.parentElement;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true;
              parent = parent.parentElement;
            }
            return false;
          };
          const overflow = Array.from(document.querySelectorAll("#hrModule *, .safe-assistant *")).filter(visible).filter((node) => !insideScroller(node)).filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
          }).map((node) => ({ tag: node.tagName, className: (node as HTMLElement).className }));
          const shortControls = Array.from(document.querySelectorAll("#hrModule button, #hrModule input, #hrModule select, #hrModule textarea, .safe-assistant button, .safe-assistant input")).filter(visible).filter((node) => node.getBoundingClientRect().height < 43.5).map((node) => ({ tag: node.tagName, height: node.getBoundingClientRect().height }));
          return { overflow, shortControls, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
        });
        expect(layout, `${theme} ${viewport.width}px`).toEqual({ overflow: [], shortControls: [], bodyOverflow: false });
      }
    }
  });
});
