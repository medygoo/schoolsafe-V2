import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { domClick, enterDemoWorkspace } from "./helpers";

function cardText(page: Page, title: string) {
  const card = page.locator(".kpi-card--executive").filter({ has: page.getByText(title, { exact: true }) }).first();
  return card;
}

async function subValue(card: ReturnType<typeof cardText>, label: string): Promise<number> {
  const text = await card.locator(".kpi-exec-sub", { hasText: label }).first().innerText();
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

test.describe("Dashboard Executive KPI", () => {
  test("les cartes executive démo sont détaillées, cohérentes et marquées DÉMONSTRATION", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enterDemoWorkspace(page, "admin");

    const cards = page.locator("#dashboardKpi .kpi-card--executive");
    expect(await cards.count()).toBe(6);

    // Chaque carte : icône, titre, grand total, sous-indicateurs libellés (pas de couleur seule).
    for (let index = 0; index < 6; index += 1) {
      const card = cards.nth(index);
      await expect(card.locator(".kpi-icon")).toBeVisible();
      await expect(card.locator(".kpi-exec-title")).not.toBeEmpty();
      await expect(card.locator(".kpi-exec-value")).not.toBeEmpty();
      expect(await card.locator(".kpi-exec-sub").count()).toBeGreaterThanOrEqual(1);
    }

    // Élèves inscrits : total = Maternelle + Primaire, calculé depuis les classes démo.
    const students = cardText(page, "Élèves inscrits");
    await expect(students.locator(".kpi-exec-chip")).toHaveText("DÉMONSTRATION");
    const studentsTotal = Number(await students.locator(".kpi-exec-value").innerText());
    const mat = await subValue(students, "Maternelle");
    const prim = await subValue(students, "Primaire");
    expect(studentsTotal).toBeGreaterThan(0);
    expect(mat + prim, "total élèves = Maternelle + Primaire").toBe(studentsTotal);
    await expect(students.locator(".kpi-exec-bar")).toBeVisible();

    // Personnel : total cohérent par genre et par famille de métier.
    const staff = cardText(page, "Personnel");
    const staffTotal = Number(await staff.locator(".kpi-exec-value").innerText());
    const women = await subValue(staff, "Femmes");
    const men = await subValue(staff, "Hommes");
    const teachers = await subValue(staff, "Enseignants");
    const administration = await subValue(staff, "Administration");
    expect(women + men, "total personnel = femmes + hommes").toBe(staffTotal);
    expect(teachers + administration, "total personnel = enseignants + administration/autres").toBe(staffTotal);

    // Classes et Matières : présentes et détaillées.
    const classes = cardText(page, "Classes");
    expect(await classes.locator(".kpi-exec-sub").count()).toBe(4);
    await expect(classes.locator(".kpi-exec-sub", { hasText: "Maternelle" })).toHaveCount(1);
    await expect(classes.locator(".kpi-exec-sub", { hasText: "Primaire" })).toHaveCount(1);
    await expect(classes.locator(".kpi-exec-sub", { hasText: "actives" })).toHaveCount(1);
    const subjects = cardText(page, "Matières");
    const assigned = await subValue(subjects, "attribuées");
    const unassigned = await subValue(subjects, "non attribuée");
    const subjectsTotal = Number(await subjects.locator(".kpi-exec-value").innerText());
    expect(assigned + unassigned, "total matières = attribuées + non attribuées").toBe(subjectsTotal);
    await expect(subjects.locator(".kpi-exec-sub", { hasText: "enseignant" })).toHaveCount(1);

    for (const card of await cards.all()) {
      expect(await card.locator(".kpi-exec-sub").count(), "2 à 4 sous-indicateurs par carte").toBeGreaterThanOrEqual(2);
      expect(await card.locator(".kpi-exec-sub").count(), "2 à 4 sous-indicateurs par carte").toBeLessThanOrEqual(4);
    }

    // Finance et Alertes : aucun chiffre fictif.
    const finance = cardText(page, "Recettes (mois)");
    await expect(finance.locator(".kpi-exec-value")).toHaveText("—");
    expect(await finance.innerText()).toContain("Non disponible");
    const alerts = cardText(page, "Alertes actives");
    await expect(alerts.locator(".kpi-exec-value")).toHaveText("0");
    await expect(alerts.locator(".kpi-exec-chip")).toHaveText("DÉMONSTRATION");
  });

  test("le mode live rend uniquement les chiffres reçus et jamais les fixtures démo", async ({ page }) => {
    await page.route("http://127.0.0.1:8787/config", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ supabase_url: "https://example.invalid", supabase_anon_key: "demo" }),
    }));
    await page.route("http://127.0.0.1:8787/session/bootstrap", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: { id: "live-admin", display_name: "Admin Live" },
        roles: ["admin"],
        permissions: ["pilotage.dashboard.read"],
        scopes: [{ type: "school" }],
        school: { id: "live-school", name: "École Live" },
      }),
    }));
    await page.route("http://127.0.0.1:8787/pilotage/dashboard", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { kpis: [{ code: "students", value: 7, trend: "Source live" }] } }),
    }));
    await page.addInitScript(() => sessionStorage.setItem("schoolsafe-v2-session", JSON.stringify({ token: "live-token" })));
    await page.goto("/", { waitUntil: "load" });
    await page.waitForFunction(() => Boolean((window as any).schoolSafeShow));
    await page.evaluate(() => (window as any).schoolSafeShow("workspace"));
    await expect(page.locator("#workspace.active")).toBeVisible();
    await expect(page.locator("#dashboardKpi")).toContainText("7");
    await expect(page.locator("#dashboardKpi")).toContainText("Source live");
    await expect(page.locator("#dashboardKpi")).not.toContainText("DÉMONSTRATION");
    await expect(page.locator("#dashboardKpi")).not.toContainText("82");

    const source = readFileSync(path.resolve(process.cwd(), "app/app.js"), "utf8");
    expect(source).toMatch(/if \(!hasToken\) \{\s*renderDemoExecutiveKpis/);
  });

  test("responsive 390/834/1440 en clair et bleu nuit, sans overflow", async ({ browser }) => {
    for (const theme of ["light", "dark"]) {
      for (const width of [390, 834, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("ss-theme", value), theme);
        await enterDemoWorkspace(page, "admin");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const overflow = await page.evaluate(() => ({
          amount: document.documentElement.scrollWidth - window.innerWidth,
          offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
            .map((element) => {
              const box = element.getBoundingClientRect();
              return { tag: element.tagName.toLowerCase(), id: element.id, className: String(element.className || ""), right: Math.round(box.right), width: Math.round(box.width) };
            })
            .filter((item) => item.right > window.innerWidth + 1 && item.width > 0)
            .slice(0, 8),
        }));
        expect(overflow.amount, `overflow ${theme} ${width}px · ${JSON.stringify(overflow.offenders)}`).toBeLessThanOrEqual(1);
        const container = width <= 768 ? "#mobileKpi" : "#dashboardKpi";
        const firstCard = page.locator(`${container} .kpi-card--executive`).first();
        await expect(firstCard).toBeVisible();
        const box = await firstCard.boundingBox();
        expect(box!.width, `carte KPI dans le viewport ${width}px`).toBeLessThanOrEqual(width);
        await context.close();
      }
    }
  });

  test("Splash et Guardian restent visuellement intacts", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    expect(await page.locator("#particles .particle").count()).toBeGreaterThanOrEqual(12);
    await expect(page.locator("#enterSplash")).toBeVisible();
    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    await expect(page.locator("#continueGuardian")).toBeVisible();
  });
});
