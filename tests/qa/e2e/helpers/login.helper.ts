import { Page, expect } from "@playwright/test";

/**
 * Attempts a live login with email and password.
 * In the current static preview the login form falls back to demo mode when
 * the backend is unreachable; this helper is provided for real-environment tests.
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/", { waitUntil: "load" });
  await page.locator("#enterSplash").click();
  await expect(page.locator("#guardian.active")).toBeVisible();
  await page.locator("#continueGuardian").click();
  await expect(page.locator("#auth.active")).toBeVisible();

  await page.locator("#emailIdentifier").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#loginForm").locator('button[type="submit"]').click();

  await expect(page.locator("#workspace.active")).toBeVisible();
}
