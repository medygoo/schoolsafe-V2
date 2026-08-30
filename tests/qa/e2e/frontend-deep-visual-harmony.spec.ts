import { expect, test, type Locator, type Page } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

function rgb(hex: string): string {
  const value = hex.replace("#", "");
  return `rgb(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)})`;
}

async function expectDomainCard(card: Locator, accent: string) {
  await expect(card).toBeVisible();
  const style = await card.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      borderTopColor: computed.borderTopColor,
      borderTopWidth: computed.borderTopWidth,
      radius: Number.parseFloat(computed.borderRadius),
    };
  });
  expect(style.borderTopColor).toBe(rgb(accent));
  expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThanOrEqual(3);
  expect(style.radius).toBeGreaterThanOrEqual(8);
}

async function expectTouchTarget(control: Locator) {
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

async function expectDomainFocus(control: Locator, accent: string) {
  await control.evaluate((element: HTMLElement) => element.focus());
  const focus = await control.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.outlineColor, style: computed.outlineStyle, width: computed.outlineWidth };
  });
  expect(focus.color).toBe(rgb(accent));
  expect(focus.style).not.toBe("none");
  expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
}

async function expectDomainTable(table: Locator, accent: string) {
  await expect(table).toBeVisible();
  const header = table.locator("thead th").first();
  const style = await header.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { borderColor: computed.borderBottomColor, borderWidth: computed.borderBottomWidth, background: computed.backgroundColor };
  });
  expect(style.borderColor).toBe(rgb(accent));
  expect(Number.parseFloat(style.borderWidth)).toBeGreaterThanOrEqual(2);
  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
}

async function openAcademicStructure(page: Page) {
  await page.locator('[data-branch="school"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="structure"]').click();
  await expect(page.locator(".academic-structure")).toBeVisible();
}

test.describe("Harmonisation visuelle profonde post-M8", () => {
  test("Élèves / Scolarité porte le bleu royal jusque dans les cartes et la modale métier", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAcademicStructure(page);

    await expectDomainCard(page.locator(".academic-year-card").first(), "#1d4ed8");
    await expectTouchTarget(page.getByRole("button", { name: "Préparer une classe" }));
    await page.getByRole("button", { name: "Préparer une classe" }).click();

    const modal = page.locator(".academic-structure-modal .ss-modal");
    await expectDomainCard(modal, "#1d4ed8");
    const field = modal.getByLabel("Nom de la classe");
    await expectTouchTarget(field);
    await expectDomainFocus(field, "#1d4ed8");
    const bounds = await modal.boundingBox();
    expect(bounds?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(900);
  });

  test("Parent porte l’indigo jusque dans les résumés, la navigation et les champs", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await expectDomainCard(page.locator(".parent-summary-card").first(), "#4f46e5");
    await expectDomainCard(page.locator(".parent-shortcut").first(), "#4f46e5");
    const child = page.locator("#parentChildSelect");
    await expectTouchTarget(child);
    await expectDomainFocus(child, "#4f46e5");
  });

  test("Pédagogie porte le violet jusque dans les priorités et formulaires enseignant", async ({ page }) => {
    await enterDemoWorkspace(page, "teacher");
    await expectDomainCard(page.locator(".teacher-priority-card").first(), "#7c3aed");
    await page.locator('[data-teacher-open="evaluations"]').click();
    const form = page.locator("#teacherEvaluationForm");
    await expectDomainCard(form, "#7c3aed");
    const title = form.locator('[name="title"]');
    await expectTouchTarget(title);
    await expectDomainFocus(title, "#7c3aed");
  });

  test("Sécurité opérationnelle porte le bleu nuit jusque dans les panneaux et le formulaire incident", async ({ page }) => {
    await enterDemoWorkspace(page, "guard");
    await page.locator("[data-guard-security-operations]").click();
    const view = page.locator("[data-security-operations]");
    await expect(view).toBeVisible();
    await expectDomainCard(view.locator(".guard-security-panel").first(), "#1e293b");
    const field = view.locator('[name="incident_type"]');
    await expectTouchTarget(field);
    await expectDomainFocus(field, "#1e293b");
  });

  test("Finance porte l’ambre jusque dans les KPI et raccourcis opérationnels", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await openAction(page, "Tableau financier");
    await expectDomainCard(page.locator(".finance-dashboard-metric").first(), "#d97706");
    const shortcut = page.locator(".finance-dashboard-action").first();
    await expectDomainCard(shortcut, "#d97706");
    await expectTouchTarget(shortcut);
    await expectDomainFocus(shortcut, "#d97706");
  });

  test("Comptabilité porte le bleu acier jusque dans les synthèses, filtres et tableaux", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-open="journal"]').click();
    const journal = page.locator("[data-accounting-journal]");
    await expectDomainCard(journal.locator(".accounting-currency-summaries > article").first(), "#3a6ea5");
    await expectDomainTable(journal.locator("table"), "#3a6ea5");
    const search = journal.locator("#journalSearch");
    await expectTouchTarget(search);
    await expectDomainFocus(search, "#3a6ea5");
  });

  test("RH porte le prune jusque dans le dossier et la préparation locale", async ({ page }) => {
    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Personnel");
    const surface = page.locator("[data-hr-staff]");
    await surface.locator('[data-hr-staff-row="hr-demo-1"]').click();
    await expectDomainCard(surface.locator(".hr-staff-dossier"), "#8e4585");
    const form = surface.locator("[data-hr-staff-form]");
    await expectDomainCard(form, "#8e4585");
    const service = form.locator('[name="service"]');
    await expectTouchTarget(service);
    await expectDomainFocus(service, "#8e4585");
  });

  test("Stock porte le teal jusque dans le catalogue, le formulaire et son tableau", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Catalogue articles");
    const catalog = page.locator("[data-inventory-catalog]");
    const form = catalog.locator("[data-inventory-item-form]");
    await expectDomainCard(form, "#0f766e");
    await expectDomainTable(catalog.locator("table"), "#0f766e");
    const category = form.locator('[name="category"]');
    await expectTouchTarget(category);
    await expectDomainFocus(category, "#0f766e");
  });
});
