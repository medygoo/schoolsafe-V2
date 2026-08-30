import { expect, test, type Locator, type Page } from "@playwright/test";
import { enterDemoWorkspace, openAction, openDocumentsCenter } from "./helpers";

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

  test("Documents porte le bleu pétrole jusque dans les cartes et filtres", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openDocumentsCenter(page);
    const center = page.locator("#documentCenterModule");
    await expectDomainCard(center.locator(".document-card").first(), "#0d5c6b");
    const filter = center.locator('[data-document-filter="sourceModule"]');
    await expectTouchTarget(filter);
    await expectDomainFocus(filter, "#0d5c6b");
  });

  test("Communication porte le bleu clair jusque dans les cartes et le compositeur", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
    await expectDomainCard(page.locator(".communication-card").first(), "#0ea5e9");
    await page.locator('[data-communication-tab="messages"]').evaluate((element: HTMLElement) => element.click());
    const form = page.locator("[data-message-form]");
    await expectDomainCard(form, "#0ea5e9");
    const subject = form.locator('[name="subject"]');
    await expectTouchTarget(subject);
    await expectDomainFocus(subject, "#0ea5e9");
  });

  test("Administration porte le marine jusque dans les cartes, filtres et tableaux", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
    await expectDomainCard(page.locator(".administration-card").first(), "#1e3a8a");
    await page.evaluate(() => (window as any).SchoolSafeAdministration.open("permissions"));
    const catalog = page.locator("[data-permission-catalog]");
    await expectDomainTable(catalog.locator("table"), "#1e3a8a");
    const search = catalog.getByLabel("Rechercher une permission");
    await expectTouchTarget(search);
    await expectDomainFocus(search, "#1e3a8a");
  });

  test("Jaspe logiciel porte le bleu électrique sans aucune surface 3D", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
    await page.evaluate(() => (window as any).SchoolSafeAdministration.open("jaspe"));
    const jaspe = page.locator(".administration-jaspe");
    await expectDomainCard(jaspe, "#2f6bff");
    await expectDomainCard(jaspe.locator(".administration-jaspe-domain").first(), "#2f6bff");
    await expect(page.locator("#administrationModule canvas, #administrationModule model-viewer, #administrationModule [data-jaspe-3d], #administrationModule [data-3d]")).toHaveCount(0);
    await expect(page.locator("#administrationModule")).not.toContainText(/GLB|FBX|OBJ|Three\.js|Blender|avatar 3D/i);
  });

  test("matrice profonde 390/834/1440 en clair et bleu nuit sans overflow ni cible trop courte", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute dans le projet desktop.");

    const surfaces = [
      {
        key: "school-modal",
        root: ".academic-structure-modal .ss-modal",
        probe: ".academic-structure-modal .ss-modal",
        light: "#1d4ed8",
        dark: "#60a5fa",
        modal: true,
        open: async () => {
          await enterDemoWorkspace(page, "admin");
          await openAcademicStructure(page);
          await page.getByRole("button", { name: "Préparer une classe" }).click();
        },
      },
      {
        key: "inventory-catalog",
        root: "[data-inventory-catalog]",
        probe: "[data-inventory-item-form]",
        light: "#0f766e",
        dark: "#5eead4",
        modal: false,
        open: async () => {
          await enterDemoWorkspace(page, "admin");
          await openAction(page, "Catalogue articles");
        },
      },
      {
        key: "jaspe-governance",
        root: ".administration-jaspe",
        probe: ".administration-jaspe",
        light: "#2f6bff",
        dark: "#6ea8ff",
        modal: false,
        open: async () => {
          await enterDemoWorkspace(page, "admin");
          await page.locator('button[data-branch="administration"]:visible').first().evaluate((element: HTMLElement) => element.click());
          await page.evaluate(() => (window as any).SchoolSafeAdministration.open("jaspe"));
        },
      },
    ];

    for (const surface of surfaces) {
      await surface.open();
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
          await page.setViewportSize(viewport);
          const root = page.locator(surface.root);
          await expect(root).toBeVisible();
          const layout = await root.evaluate((element) => {
            const visible = (candidate: Element) => {
              const rect = candidate.getBoundingClientRect();
              const style = getComputedStyle(candidate);
              return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
            };
            const viewportWidth = document.documentElement.clientWidth;
            const scrollSelector = '[class*="table-wrap"], [class*="table-wrapper"], .pedagogy-tabs, .school-tabs, .administration-permission-list';
            const overflow = Array.from(element.querySelectorAll("*")).filter(visible).filter((candidate) => {
              const rect = candidate.getBoundingClientRect();
              return !candidate.closest(scrollSelector) && (rect.left < -1 || rect.right > viewportWidth + 1);
            }).map((candidate) => ({ tag: candidate.tagName, className: (candidate as HTMLElement).className }));
            const shortControls = Array.from(element.querySelectorAll("button, input, select, textarea")).filter(visible).filter((candidate) => {
              if (candidate instanceof HTMLInputElement && ["checkbox", "radio", "file"].includes(candidate.type)) return false;
              return candidate.getBoundingClientRect().height < 43.5;
            }).map((candidate) => ({ tag: candidate.tagName, height: Math.round(candidate.getBoundingClientRect().height) }));
            const style = getComputedStyle(element);
            return {
              overflow,
              shortControls,
              pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              color: style.color,
              background: style.backgroundColor,
              height: element.getBoundingClientRect().height,
              viewportHeight: window.innerHeight,
            };
          });
          expect(layout.pageOverflow, `${surface.key} ${theme} ${viewport.width}`).toBeLessThanOrEqual(1);
          expect(layout.overflow, `${surface.key} ${theme} ${viewport.width}`).toEqual([]);
          expect(layout.shortControls, `${surface.key} ${theme} ${viewport.width}`).toEqual([]);
          expect(layout.color).not.toBe(layout.background);
          if (surface.modal) expect(layout.height).toBeLessThanOrEqual(layout.viewportHeight + 1);

          const border = await page.locator(surface.probe).evaluate((element) => getComputedStyle(element).borderTopColor);
          expect(border, `${surface.key} ${theme} ${viewport.width}`).toBe(rgb(theme === "light" ? surface.light : surface.dark));

          if (viewport.width !== 834) {
            await page.screenshot({ path: testInfo.outputPath(`deep-${surface.key}-${theme}-${viewport.width}.png`), fullPage: true });
          }
        }
      }
    }
  });
});
