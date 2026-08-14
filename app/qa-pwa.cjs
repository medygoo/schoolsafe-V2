const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.SCHOOLSAFE_URL || "http://127.0.0.1:4175/";
const outputDir = path.join(__dirname, "qa-output");
let browser;

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function domClick(page, selector) {
  await page.locator(selector).evaluate((element) => element.click());
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(baseUrl + "?pwa=1", { waitUntil: "networkidle", timeout: 30000 });
  check(await page.locator('link[rel="manifest"]').count(), "Le manifeste PWA est absent");
  await page.evaluate(() => navigator.serviceWorker.ready);
  check(await page.evaluate(() => Boolean(navigator.serviceWorker.controller || navigator.serviceWorker.ready)), "Le Service Worker ne s'enregistre pas");

  await domClick(page, "#enterSplash");
  await domClick(page, "#continueGuardian");
  await domClick(page, "#previewWorkspace");
  check(await page.locator("#syncStatusButton").count(), "L'indicateur de synchronisation est absent");

  await context.setOffline(true);
  await page.waitForTimeout(250);
  check((await page.locator("#syncStatusButton").getAttribute("class")).includes("is-offline"), "L'état hors connexion n'est pas affiché");

  await page.locator("#workspaceRoleSwitch").selectOption("cashier");
  await page.locator('[data-action="Enregistrer un paiement"]').evaluate((element) => element.click());
  await page.locator("#financeStudentSelect").selectOption("0");
  await page.locator('#paymentForm input[name="amount"]').fill("50000");
  await page.locator('#paymentForm input[name="reference"]').fill("Tranche hors connexion");
  await domClick(page, '#paymentForm button[type="submit"]');
  check(await page.getByText("Après synchronisation", { exact: true }).count(), "Un numéro de reçu est produit hors connexion");
  check(await page.getByText("PDF après synchronisation", { exact: true }).count(), "L'attente du reçu officiel n'est pas indiquée");

  await page.evaluate(async () => {
    await window.SchoolSafeSync.enqueue({ type: "administration", label: "Configuration locale de test", role: "admin", payload: { test: true } });
    await window.SchoolSafeSync.enqueue({ type: "scan", label: "Scan prioritaire de test", role: "guard", payload: { test: true } });
  });
  const offlineState = await page.evaluate(() => window.SchoolSafeSync.state());
  check(offlineState.pending >= 3, "Les opérations hors connexion ne restent pas en attente");
  const pendingTypes = offlineState.operations.filter((item) => item.status === "pending").map((item) => item.type);
  check(pendingTypes.indexOf("scan") < pendingTypes.indexOf("administration"), "Le scan n'est pas prioritaire dans la file");

  await domClick(page, "#syncStatusButton");
  check(await page.locator("#syncPanel:not([hidden])").count(), "Le panneau de synchronisation ne s'ouvre pas");
  await page.screenshot({ path: path.join(outputDir, "pwa-offline-desktop.png"), fullPage: true });

  await context.setOffline(false);
  await page.waitForFunction(() => document.querySelector("#syncStatusLabel").textContent === "Synchronisé", null, { timeout: 15000 });
  const onlineState = await page.evaluate(() => window.SchoolSafeSync.state());
  check(onlineState.pending === 0, "La reprise automatique ne vide pas la file locale");
  await page.getByText("REC-2026-0588", { exact: true }).waitFor({ timeout: 10000 });

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
  check(await page.locator("#splash.active").count(), "L'application ne redémarre pas depuis le cache hors ligne");
  await context.setOffline(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await domClick(page, "#enterSplash");
  await domClick(page, "#continueGuardian");
  await domClick(page, "#previewWorkspace");
  await domClick(page, "#syncStatusButton");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Le panneau PWA déborde sur téléphone");
  await page.screenshot({ path: path.join(outputDir, "pwa-sync-mobile.png"), fullPage: true });

  check(errors.length === 0, `Erreurs navigateur: ${errors.join(" | ")}`);
  await browser.close();
  console.log(JSON.stringify({ ok: true, screenshots: ["pwa-offline-desktop.png", "pwa-sync-mobile.png"] }, null, 2));
})().catch(async (error) => {
  if (browser) await browser.close().catch(() => {});
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
