import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const reportUser = (deniedPermissions: string[] = []) => ({
  userId: "finance-1",
  role: "finance",
  schoolId: "school-1",
  permissions: ["finance.report.read", "reports.financial.read"],
  deniedPermissions,
  scopes: [
    { permission: "finance.report.read", type: "school" },
    { permission: "reports.financial.read", type: "school" },
  ],
});

const descriptors = [
  {
    id: "cash-report",
    type: "cash-report",
    label: "Rapport de caisse",
    sourceModule: "finance",
    nature: "DOCUMENT",
    date: "2026-08-28",
    status: "draft",
    sensitivity: "confidential",
    formats: ["pdf"],
    permission: "finance.report.read",
    scope: "school",
    context: { schoolId: "school-1" },
  },
  {
    id: "financial-summary",
    type: "financial-summary",
    label: "Situation financière",
    sourceModule: "accounting",
    nature: "REGISTRE/LISTE IMPRIMABLE",
    date: "2026-08-27",
    status: "generated",
    sensitivity: "internal",
    formats: ["pdf", "csv"],
    permission: "reports.financial.read",
    scope: "school",
    context: { schoolId: "school-1" },
  },
  {
    id: "hr-secret",
    type: "hr-report",
    label: "Rapport RH interdit",
    sourceModule: "hr",
    nature: "DOCUMENT",
    date: "2026-08-28",
    status: "draft",
    sensitivity: "restricted",
    formats: ["pdf"],
    permission: "reports.hr.read",
    scope: "school",
    context: { schoolId: "school-1" },
  },
];

async function renderCenter(page: any, user = reportUser()) {
  await page.evaluate(({ descriptors, user }) => {
    const api = (window as any).SchoolSafeDocumentCenter;
    api.clearRegistry();
    api.registerMany(descriptors);
    api.render("documentCenterContent", user);
  }, { descriptors, user });
}

test.describe("J3 — Centre de documents", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await page.locator("#documentsNav").click();
    await expect(page.locator("#documentCenterModule")).toBeVisible();
  });

  test("n’affiche que les documents autorisés et fait primer DENY", async ({ page }) => {
    await renderCenter(page);
    await expect(page.locator("[data-document-id]")) .toHaveCount(2);
    await expect(page.locator("[data-document-id='hr-secret']")).toHaveCount(0);

    await renderCenter(page, reportUser(["finance.report.read"]));
    await expect(page.locator("[data-document-id='cash-report']")).toHaveCount(0);
    await expect(page.locator("[data-document-id='financial-summary']")).toBeVisible();
  });

  test("filtre module, type, nature, date, statut, sensibilité et format", async ({ page }) => {
    await renderCenter(page);
    const filters = [
      ["sourceModule", "accounting", "financial-summary"],
      ["type", "cash-report", "cash-report"],
      ["nature", "REGISTRE/LISTE IMPRIMABLE", "financial-summary"],
      ["date", "2026-08-27", "financial-summary"],
      ["status", "generated", "financial-summary"],
      ["sensitivity", "confidential", "cash-report"],
      ["format", "csv", "financial-summary"],
    ];

    for (const [name, value, expectedId] of filters) {
      await page.locator("[data-document-filter-reset]").click();
      const filter = page.locator(`[data-document-filter='${name}']`);
      if (name === "date") await filter.fill(value);
      else await filter.selectOption(value);
      await expect(page.locator("[data-document-id]:visible")).toHaveCount(1);
      await expect(page.locator(`[data-document-id='${expectedId}']`)).toBeVisible();
    }
  });

  test("propose les actions bornées et ne garde que des métadonnées de session", async ({ page }) => {
    await renderCenter(page);
    const card = page.locator("[data-document-id='cash-report']");
    for (const action of ["preview", "pdf", "print", "download"]) {
      await expect(card.locator(`[data-document-action='${action}']`)).toBeVisible();
    }

    await card.locator("[data-document-action='preview']").click();
    await expect(page.locator("[data-document-history-item]")).toHaveCount(1);

    const storageAndHistory = await page.evaluate(() => {
      const api = (window as any).SchoolSafeDocumentCenter;
      api.recordHistory({
        descriptorId: "cash-report",
        label: "Rapport de caisse",
        action: "download",
        format: "pdf",
        content: { amount: 999, student: "Secret" },
        context: { childId: "secret-child" },
        blob: "sensitive-pdf",
      });
      return {
        history: api.getHistory(),
        storageKeys: Object.keys(localStorage),
        serialized: JSON.stringify(api.getHistory()),
      };
    });
    expect(storageAndHistory.history).toHaveLength(2);
    expect(storageAndHistory.serialized).not.toContain("Secret");
    expect(storageAndHistory.serialized).not.toContain("secret-child");
    expect(storageAndHistory.serialized).not.toContain("sensitive-pdf");
    expect(storageAndHistory.storageKeys.some((key: string) => /document|pdf|archive/i.test(key))).toBe(false);
    await expect(page.locator("#documentCenterModule")).toContainText("HISTORIQUE / ARCHIVAGE OFFICIEL — BACKEND_LATER");
  });

  test("reste lisible sans overflow en clair et bleu nuit à 390, 834 et 1440 px", async ({ page }) => {
    await renderCenter(page);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const state = await page.evaluate(() => {
          const root = document.querySelector(".document-center") as HTMLElement;
          const style = getComputedStyle(root);
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            color: style.color,
            background: style.backgroundColor,
          };
        });
        expect(state.overflow).toBeLessThanOrEqual(1);
        expect(state.color).not.toBe(state.background);
      }
    }
  });
});
