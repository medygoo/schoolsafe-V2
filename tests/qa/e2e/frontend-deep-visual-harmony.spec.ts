import { expect, test, type Locator, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

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
});
