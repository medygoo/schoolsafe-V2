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
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(baseUrl + "?i18n=1", { waitUntil: "networkidle", timeout: 30000 });
  await domClick(page, "#enterSplash");
  await domClick(page, "#continueGuardian");
  await domClick(page, '.auth-topbar [data-language="en"]');
  await page.waitForTimeout(100);
  check(await page.getByText("Welcome to your secure workspace.", { exact: true }).count(), "La connexion ne passe pas en anglais");
  check((await page.locator("html").getAttribute("lang")) === "en", "La langue du document n'est pas EN");

  await page.locator("#demoRole").selectOption("teacher");
  await domClick(page, "#previewWorkspace");
  await page.waitForTimeout(150);
  check(await page.getByText("Teacher", { exact: true }).count(), "Le profil Enseignant n'est pas traduit");
  check(await page.getByText("Dashboard", { exact: true }).count(), "Le tableau de bord n'est pas traduit");
  check(await page.getByText("Assignments and grading", { exact: true }).count(), "Une action pédagogique dynamique reste en français");

  await page.locator('[data-action="Devoirs et corrections"]').first().evaluate((element) => element.click());
  await page.waitForTimeout(100);
  check(await page.getByText("Assignments", { exact: true }).count(), "Le module Devoirs n'est pas traduit");
  check(await page.getByText("Create a SchoolSafe assignment", { exact: true }).count(), "Le formulaire de devoir n'est pas traduit");
  check(await page.getByText("Translation unavailable: original content retained.", { exact: true }).count(), "L'absence de traduction du contenu n'est pas signalée");

  await page.locator("#pdfLanguageMode").selectOption("en");
  await page.locator('input[name="title"]').fill("Fractions practice");
  check(await page.evaluate(() => window.SchoolSafeI18n.documentLanguage()) === "en", "La langue PDF EN n'est pas mémorisée");
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
  await domClick(page, "#previewAssignmentPdf");
  const download = await downloadPromise;
  const pdfPath = path.join(outputDir, "devoir-anglais.pdf");
  await download.saveAs(pdfPath);
  check(fs.statSync(pdfPath).size > 1000, "Le PDF anglais est vide");
  await page.screenshot({ path: path.join(outputDir, "interface-english-desktop.png"), fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  check(await page.getByText("Tap to continue", { exact: true }).count(), "La préférence anglaise ne persiste pas");

  await domClick(page, "#enterSplash");
  await domClick(page, "#continueGuardian");
  await page.locator("#demoRole").selectOption("teacher");
  await domClick(page, "#previewWorkspace");
  await page.setViewportSize({ width: 390, height: 844 });
  await domClick(page, "#cubeMenu");
  await page.waitForTimeout(100);
  check(await page.getByText("PDF documents", { exact: true }).count(), "Le réglage PDF n'est pas accessible sur téléphone");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "L'interface anglaise déborde sur téléphone");
  await page.screenshot({ path: path.join(outputDir, "interface-english-mobile.png"), fullPage: true });

  await domClick(page, '.workspace-language-switch [data-language="fr"]');
  await page.waitForTimeout(100);
  check(await page.getByText("Tableau de bord", { exact: true }).count(), "Le retour au français ne fonctionne pas");
  check((await page.locator("html").getAttribute("lang")) === "fr", "La langue du document ne revient pas à FR");

  check(errors.length === 0, `Erreurs navigateur: ${errors.join(" | ")}`);
  await browser.close();
  console.log(JSON.stringify({ ok: true, pdf: pdfPath, screenshots: ["interface-english-desktop.png", "interface-english-mobile.png"] }, null, 2));
})().catch(async (error) => {
  if (browser) await browser.close().catch(() => {});
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
