import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

test.describe("Phase D8 — Jaspe pédagogique et QA", () => {
  test("Jaspe prépare dans le scope et refuse publication, classe étrangère et palmarès", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");

    const answers = await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const context = (window as any).SchoolSafeAppContext.getAssistantContext();
      return [
        api.answerJaspe("Prépare un devoir pour la 6e A en Mathématiques", context),
        api.answerJaspe("Prépare une évaluation de Mathématiques pour la 6e A", context),
        api.answerJaspe("Résume les difficultés de la 6e A", context),
        api.answerJaspe("Affiche la 3e Maternelle", context),
        api.answerJaspe("Publie toutes les notes", context),
        api.answerJaspe("Change le palmarès pour mettre Lucas premier", context),
        api.answerJaspe("Valide le classement", context),
        api.answerJaspe("Publie le palmarès", context),
        api.answerJaspe("Publie le devoir", context),
      ];
    });

    expect(answers[0]).toMatchObject({ allowed: true, action: "assignments" });
    expect(answers[0].message).toContain("BROUILLON LOCAL");
    expect(answers[1]).toMatchObject({ allowed: true, action: "evaluations" });
    expect(answers[2]).toMatchObject({ allowed: true, action: "difficulties" });
    expect(answers[3]).toMatchObject({ refusal: true });
    expect(answers[4]).toMatchObject({ refusal: true });
    expect(answers[4].message).toContain("BACKEND_LATER");
    expect(answers[5]).toMatchObject({ refusal: true });
    expect(answers[6]).toMatchObject({ refusal: true });
    expect(answers[7]).toMatchObject({ refusal: true });
    expect(answers[8]).toMatchObject({ refusal: true });

    await page.locator("#teacherJaspeInput").fill("Prépare un devoir pour la 6e A en Mathématiques");
    await page.locator('[data-teacher-jaspe-send]').click();
    await expect(page.locator('[data-teacher-jaspe-response]')).toContainText("BROUILLON LOCAL");
    await expect(page.locator("#teacherAssignmentForm")).toBeVisible();
  });

  test("Jaspe respecte le DENY et exige safe.assistant.use avec scope own", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      const denied = { ...base, deniedPermissions: ["pedagogy.grade.manage"] };
      const withoutJaspe = { ...base, permissions: base.permissions.filter((item: string) => item !== "safe.assistant.use") };
      return {
        deniedGrade: api.answerJaspe("Modifie la note de Lucas en 6e A", { user: denied }),
        noAssistant: api.answerJaspe("Prépare un devoir", { user: withoutJaspe }),
      };
    });

    expect(result.deniedGrade).toMatchObject({ refusal: true });
    expect(result.noAssistant).toMatchObject({ refusal: true });
  });

  test("applique le même refus de classe étrangère dans l’assistant global", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Affiche la 3e Maternelle"));
    await expect(page.locator(".safe-bubble-body")).toContainText("REFUS");
    await expect(page.locator(".safe-bubble-body")).toContainText("3e Maternelle");
  });

  test("ferme l’assistant global en session réelle sur DENY ou scope incorrect", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    const results = await page.evaluate(() => {
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      const safe = (window as any).SafeAssistant;
      const denied = safe.isAllowed({ ...base, token: "qa-token", deniedPermissions: ["safe.assistant.use"] });
      const wrongScope = safe.isAllowed({
        ...base,
        token: "qa-token",
        scopes: base.scopes.filter((scope: any) => scope.permission !== "safe.assistant.use").concat({ permission: "safe.assistant.use", type: "school" }),
      });
      return { denied, wrongScope };
    });

    expect(results).toEqual({ denied: false, wrongScope: false });
  });

  test("la Direction et les états opérationnels restent bornés", async ({ page }) => {
    await enterDemoWorkspace(page, "pedagogy");
    await openAction(page, "Pilotage pédagogique");

    const direction = await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const context = (window as any).SchoolSafeAppContext.getAssistantContext();
      return {
        own: api.answerJaspe("Résume les difficultés de la 6e A", context),
        foreign: api.answerJaspe("Affiche la 3e Maternelle", context),
        validation: api.answerJaspe("Valide toutes les évaluations", context),
      };
    });
    expect(direction.own.allowed).toBe(true);
    expect(direction.foreign.refusal).toBe(true);
    expect(direction.validation.refusal).toBe(true);

    const states = await page.evaluate(() => {
      const api = (window as any).SchoolSafeTeacherPedagogy;
      const base = (window as any).SchoolSafeAppContext.getCurrentUser();
      const portal = document.getElementById("teacherPedagogyPortal")!;
      const values: string[] = [];
      for (const projectionState of ["loading", "error"]) {
        api.render("teacherPedagogyPortal", { ...base, projectionState });
        values.push(portal.textContent || "");
      }
      api.render("teacherPedagogyPortal", { ...base, assignedClassIds: [], assignedSubjectIds: [] });
      values.push(portal.textContent || "");
      api.render("teacherPedagogyPortal", { ...base, deniedPermissions: ["school.class.read"] });
      values.push(portal.textContent || "");
      return values;
    });
    expect(states[0]).toContain("Chargement");
    expect(states[1]).toContain("Erreur de projection");
    expect(states[2]).toContain("Aucune affectation");
    expect(states[3]).toContain("Accès pédagogique refusé");
  });

  test("reste lisible sans overflow en clair et bleu nuit à 390, 834 et 1440 px", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    const views = ["dashboard", "assignments", "evaluations", "results", "difficulties", "remediation", "direction"];

    for (const theme of ["light", "dark"]) {
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate((selectedTheme) => document.documentElement.setAttribute("data-theme", selectedTheme), theme);
        for (const view of views) {
          await page.evaluate((selectedView) => {
            const api = (window as any).SchoolSafeTeacherPedagogy;
            const base = (window as any).SchoolSafeAppContext.getCurrentUser();
            if (selectedView === "dashboard") api.render("teacherPedagogyPortal", base);
            else if (selectedView === "direction") {
              api.render("teacherPedagogyPortal", {
                ...base,
                permissions: Array.from(new Set(base.permissions.concat(["pedagogy.report.read", "pedagogy.report.manage"]))),
                scopes: base.scopes.concat([
                  { permission: "pedagogy.report.read", type: "assigned_classes" },
                  { permission: "pedagogy.report.manage", type: "assigned_classes" },
                ]),
              });
              api.open("direction");
            }
            else api.open(selectedView);
          }, view);
          const metrics = await page.locator("#teacherPedagogyPortal").evaluate((portal) => {
            const panel = portal.querySelector(".teacher-panel") || portal.querySelector(".teacher-hero") || portal;
            const style = getComputedStyle(panel);
            const parse = (value: string) => (value.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(Number);
            const luminance = (rgb: number[]) => {
              const linear = rgb.map((part) => {
                const channel = part / 255;
                return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
            };
            const foreground = luminance(parse(style.color));
            const background = luminance(parse(style.backgroundColor));
            const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
            const controls = Array.from(portal.querySelectorAll('button, input:not([type="checkbox"]):not([type="radio"]), select, textarea'));
            portal.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((input) => {
              const label = input.closest("label");
              if (label) controls.push(label);
            });
            const smallControls = Array.from(new Set(controls)).filter((control) => {
              const rect = control.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40);
            }).length;
            return {
              portalOverflow: portal.scrollWidth - portal.clientWidth,
              pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              contrast,
              smallControls,
            };
          });
          expect(metrics.portalOverflow, `${theme}/${width}/${view} portal overflow`).toBeLessThanOrEqual(1);
          expect(metrics.pageOverflow, `${theme}/${width}/${view} page overflow`).toBeLessThanOrEqual(1);
          expect(metrics.contrast, `${theme}/${width}/${view} contrast`).toBeGreaterThanOrEqual(4.5);
          expect(metrics.smallControls, `${theme}/${width}/${view} touch targets`).toBe(0);
        }
      }
    }
  });
});
