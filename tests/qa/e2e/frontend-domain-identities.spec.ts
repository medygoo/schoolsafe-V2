import { expect, test, type Page } from "@playwright/test";
import { domClick, enterDemoWorkspace, openAction, openDocumentsCenter } from "./helpers";

function rgb(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

async function headerGradient(page: Page, selector: string): Promise<string> {
  const header = page.locator(selector).first();
  await expect(header).toBeVisible();
  return header.evaluate((element) => getComputedStyle(element).backgroundImage);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

type DomainCase = {
  name: string;
  role: string;
  open: (page: Page) => Promise<void>;
  container: string;
  header: string;
  a: string;
  b: string;
};

const DOMAIN_CASES: DomainCase[] = [
  {
    name: "Élèves / Scolarité", role: "admin", container: "#schoolModule", header: "#schoolModule .module-header", a: "#1d4ed8", b: "#06b6d4",
    open: (page) => openAction(page, "Élèves"),
  },
  {
    name: "Pédagogie / Enseignant", role: "teacher", container: "#teacherPedagogyPortal", header: "#teacherPedagogyPortal .teacher-hero", a: "#7c3aed", b: "#2563eb",
    open: async (page) => {
      await openAction(page, "Devoirs et corrections");
      // La vue Devoirs Phase D est un shell de travail ; le hero est sur le tableau de bord enseignant.
      await page.locator("#teacherPedagogyPortal [data-teacher-back]").first().evaluate((element: HTMLElement) => element.click());
    },
  },
  {
    name: "Sécurité", role: "admin", container: "#securityModule", header: "#securityModule .security-module-header", a: "#1e293b", b: "#7c2d12",
    open: (page) => openAction(page, "Scanner un QR"),
  },
  {
    name: "Finance", role: "finance", container: "#financeModule", header: "#financeModule .finance-module-header", a: "#d97706", b: "#f59e0b",
    open: (page) => openAction(page, "Tableau financier"),
  },
  {
    name: "Comptabilité / Trésorerie", role: "admin", container: "#accountingModule", header: "#accountingModule .accounting-module-header", a: "#3a6ea5", b: "#475569",
    open: (page) => openAction(page, "Plan comptable"),
  },
  {
    name: "RH / Personnel", role: "admin", container: "#hrModule", header: "#hrModule .hr-module-header", a: "#8e4585", b: "#a83a54",
    open: (page) => openAction(page, "Enseignants"),
  },
  {
    name: "Stock / Inventaire", role: "admin", container: "#inventoryModule", header: "#inventoryModule .inventory-module-header", a: "#0f766e", b: "#2563eb",
    open: (page) => openAction(page, "Stock / Inventaire"),
  },
  {
    name: "Documents", role: "admin", container: "#documentCenterModule", header: "#documentCenterModule .document-center-module-header", a: "#0d5c6b", b: "#475569",
    open: (page) => openDocumentsCenter(page),
  },
  {
    name: "Communication", role: "admin", container: "#communicationModule", header: "#communicationModule .communication-module-header", a: "#0ea5e9", b: "#8b5cf6",
    open: (page) => openAction(page, "Messages"),
  },
  {
    name: "Administration", role: "admin", container: "#administrationModule", header: "#administrationModule .administration-header", a: "#1e3a8a", b: "#64748b",
    open: async (page) => {
      await page.locator('#branch-administration [data-action="Paramètres"]').first().evaluate((element: HTMLElement) => element.click());
    },
  },
  {
    name: "Parent / Tuteur", role: "parent", container: "#parentPortal", header: "#parentPortal .parent-dashboard-header", a: "#4f46e5", b: "#8b5cf6",
    open: async () => {},
  },
];

test.describe("Identités visuelles par domaine", () => {
  test("chaque grand domaine a un hero dégradé identifiable et distinct", async ({ page }) => {
    const gradients = new Map<string, string>();
    for (const domain of DOMAIN_CASES) {
      await test.step(domain.name, async () => {
        await enterDemoWorkspace(page, domain.role);
        await domain.open(page);
        await expect(page.locator(domain.container)).toBeVisible();
        const gradient = await headerGradient(page, domain.header);
        expect(gradient, `${domain.name} : couleur principale ${domain.a}`).toContain(rgb(domain.a));
        expect(gradient, `${domain.name} : couleur secondaire ${domain.b}`).toContain(rgb(domain.b));
        gradients.set(domain.name, gradient);
      });
    }
    expect(new Set(gradients.values()).size).toBe(DOMAIN_CASES.length);
  });

  test("la structure commune SchoolSafe est conservée dans les modules", async ({ page }) => {
    const shared = DOMAIN_CASES.filter((domain) => ["Finance", "Comptabilité / Trésorerie", "RH / Personnel", "Stock / Inventaire", "Documents", "Communication", "Sécurité"].includes(domain.name));
    for (const domain of shared) {
      await enterDemoWorkspace(page, domain.role);
      await domain.open(page);
      const module = page.locator(domain.container);
      await expect(module.locator(".pedagogy-module-header")).toBeVisible();
      await expect(module.locator(".pedagogy-module-header .ss-button").first()).toContainText("Tableau de bord");
    }
  });

  test("responsive 390/834/1440 en clair et bleu nuit, sans overflow", async ({ page }) => {
    for (const theme of ["light", "dark"]) {
      for (const width of [390, 834, 1440]) {
        await page.addInitScript((value) => localStorage.setItem("ss-theme", value), theme);
        await enterDemoWorkspace(page, "finance");
        await openAction(page, "Tableau financier");
        await page.setViewportSize({ width, height: 844 });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expectNoHorizontalOverflow(page);
        const tabHeights = await page.locator("#financeTabs button:visible").evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().height),
        );
        for (const height of tabHeights) expect(height).toBeGreaterThanOrEqual(44);
        const gradient = await headerGradient(page, "#financeModule .finance-module-header");
        expect(gradient).toContain(theme === "light" ? rgb("#d97706") : rgb("#57360a"));
      }
    }
  });

  test("Splash et Guardian restent visuellement intacts", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    expect(await page.locator("#particles .particle").count()).toBeGreaterThanOrEqual(12);
    await expect(page.locator("#splash img").first()).toBeVisible();
    await expect(page.locator("#enterSplash")).toBeVisible();
    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    expect(await page.locator("#guardian img").count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator("#continueGuardian")).toBeVisible();
  });
});
