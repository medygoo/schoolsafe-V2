import { test, expect } from "@playwright/test";
import { enterDemoWorkspace, expectBranches, openAction, domClick } from "./helpers";

test.describe("Profil responsable financier", () => {
  test("affiche les branches finance et comptabilité", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await expectBranches(page, "finance");
    await expect(page.locator('[data-action="Tableau financier"]')).toBeVisible();
    await expect(page.locator('[data-action="Types de frais"]')).toBeVisible();
    await expect(page.locator('[data-action="Journal comptable"]')).toBeVisible();
  });

  test("peut ouvrir le module finance en supervision", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");

    await openAction(page, "Tableau financier");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator("#workspaceTitle")).toHaveText("Pilotage financier");
    await expect(page.locator('#financeTabs [data-finance-tab="overview"].active')).toBeVisible();
    await domClick(page, "#closeFinanceModule");
    await expect(page.locator("#financeModule")).toBeHidden();

    await openAction(page, "Types de frais");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator('#financeTabs [data-finance-tab="fees"].active')).toBeVisible();
  });

  test("ne voit pas les branches sécurité, pédagogie, administration", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    await expect(page.locator("#branch-security")).toHaveCount(0);
    await expect(page.locator("#branch-pedagogy")).toHaveCount(0);
    await expect(page.locator("#branch-administration")).toHaveCount(0);
  });
});
