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

async function downloadFrom(page, selector, filename) {
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
  await domClick(page, selector);
  const download = await downloadPromise;
  const target = path.join(outputDir, filename);
  await download.saveAs(target);
  check(fs.statSync(target).size > 1000, `${filename} est vide ou incomplet`);
  return target;
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  check(await page.locator("#splash.active").count(), "L'écran bleu n'est pas actif");
  check((await page.locator("#particles .particle").count()) >= 12, "Les particules animées ne sont pas créées");

  await domClick(page, "#enterSplash");
  check(await page.locator("#guardian.active").count(), "La galerie d'élèves ne s'ouvre pas");
  await domClick(page, "#continueGuardian");
  check(await page.locator("#auth.active").count(), "L'écran de connexion ne s'ouvre pas");
  await page.locator("#demoRole").selectOption("admin");
  await domClick(page, "#previewWorkspace");
  check(await page.locator("#workspace.active").count(), "Le tableau de bord ne s'ouvre pas");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outputDir, "dashboard-desktop.png"), fullPage: true });

  await page.locator('[data-action="ENAFEP"]').first().evaluate((element) => element.click());
  check(await page.locator(".certification-workspace").count(), "Le module des épreuves nationales ne s'ouvre pas");
  await domClick(page, '[data-cert-view="results"]');
  check(await page.getByText("Résultats officiels enregistrés").count(), "La vue des résultats est absente");
  await downloadFrom(page, '[data-export-cert="all"]', "resultats-enafep.pdf");
  await page.screenshot({ path: path.join(outputDir, "epreuves-nationales.png"), fullPage: true });

  await domClick(page, '[data-cert-exam="EXETAT"]');
  check(await page.getByText("Examen d’État", { exact: true }).count(), "L'EXETAT ne s'ouvre pas");
  await domClick(page, '[data-cert-view="stages"]');
  check((await page.locator(".certification-stage-grid article").count()) === 9, "Le parcours EXETAT est incomplet");
  await page.evaluate(() => document.querySelector("#toast").classList.remove("show"));
  await page.screenshot({ path: path.join(outputDir, "exetat-desktop.png"), fullPage: true });
  await page.locator(".certification-stages").screenshot({ path: path.join(outputDir, "exetat-etapes-desktop.png") });
  await domClick(page, '[data-cert-view="results"]');
  await downloadFrom(page, '[data-export-cert="all"]', "resultats-exetat.pdf");
  await page.setViewportSize({ width: 390, height: 844 });
  await domClick(page, '[data-cert-view="stages"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Le module EXETAT déborde horizontalement sur téléphone");
  await page.evaluate(() => document.querySelector("#toast").classList.remove("show"));
  await page.screenshot({ path: path.join(outputDir, "exetat-mobile.png"), fullPage: true });
  await page.locator(".certification-stages").screenshot({ path: path.join(outputDir, "exetat-etapes-mobile.png") });
  await page.locator(".workspace-main").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(300);
  check(await page.locator(".certification-stage-grid article").last().evaluate((element) => { const box = element.getBoundingClientRect(); return box.top < window.innerHeight && box.bottom > 0; }), "La dernière étape EXETAT n'est pas accessible sur téléphone");
  await page.screenshot({ path: path.join(outputDir, "exetat-mobile-bottom.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await domClick(page, "#closePedagogyModule");
  await page.locator('[data-action="Devoirs et corrections"]').first().evaluate((element) => element.click());
  check(await page.locator("#assignmentForm").count(), "Le compositeur de devoir ne s'ouvre pas");
  await page.locator('input[name="title"]').fill("Devoir de contrôle");
  await downloadFrom(page, "#previewAssignmentPdf", "devoir-compose.pdf");

  await domClick(page, "#closePedagogyModule");
  await page.locator("#workspaceRoleSwitch").selectOption("cashier");
  await page.locator('[data-action="Enregistrer un paiement"]').evaluate((element) => element.click());
  check(await page.locator("#financeModule:not([hidden])").count(), "Le module de caisse ne s'ouvre pas");
  check(await page.locator("#paymentForm").count(), "Le formulaire d'encaissement de la Caisse est absent");
  await page.locator("#financeStudentSelect").selectOption("0");
  await page.locator('#paymentForm input[name="amount"]').fill("50000");
  await page.locator('#paymentForm input[name="reference"]').fill("Troisième tranche de démonstration");
  await domClick(page, '#paymentForm button[type="submit"]');
  await page.getByText("REC-2026-0588", { exact: true }).waitFor({ timeout: 10000 });
  check(await page.getByText("REC-2026-0588", { exact: true }).count(), "Le nouveau reçu n'est pas créé après confirmation locale");
  await downloadFrom(page, '[data-export-receipt="0"]', "recu-paiement.pdf");
  await page.screenshot({ path: path.join(outputDir, "finance-desktop.png"), fullPage: true });
  await domClick(page, '[data-finance-tab="reports"]');
  await downloadFrom(page, "#exportCashReport", "rapport-caisse.pdf");
  check(await page.locator("#submitCashDay").count(), "La Caisse ne peut pas soumettre sa journée");
  await domClick(page, "#submitCashDay");
  check(await page.getByText("Soumise", { exact: true }).count(), "La journée de caisse n'est pas soumise");

  await domClick(page, "#closeFinanceModule");
  await page.locator("#workspaceRoleSwitch").selectOption("finance");
  await page.locator('[data-action="Tableau financier"]').evaluate((element) => element.click());
  check((await page.locator('#financeTabs [data-finance-tab]:not([hidden])').count()) === 6, "Le Responsable financier n'a pas les six branches prévues");
  await domClick(page, '[data-finance-tab="cash"]');
  check((await page.locator("#paymentForm").count()) === 0, "Le Responsable financier exécute un encaissement de guichet");

  await domClick(page, "#closeFinanceModule");
  await page.locator("#workspaceRoleSwitch").selectOption("school_head");
  await page.locator('[data-action="Recettes"]').evaluate((element) => element.click());
  check((await page.locator('#financeTabs [data-finance-tab]:not([hidden])').count()) === 2, "La Direction reçoit trop de branches financières");
  check((await page.locator('#financeTabs [data-finance-tab="cash"]:not([hidden]), #financeTabs [data-finance-tab="fees"]:not([hidden])').count()) === 0, "La Direction reçoit des fonctions financières d'exécution");

  await domClick(page, "#closeFinanceModule");
  await page.locator("#workspaceRoleSwitch").selectOption("pedagogy");
  await page.locator('[data-action="Voir les élèves en ordre ou à régulariser"]').evaluate((element) => element.click());
  check((await page.locator('#financeTabs [data-finance-tab]:not([hidden])').count()) === 1, "Le profil pédagogique reçoit plus que le statut administratif");
  const pedagogyFinanceTableText = await page.locator("#financeContent .finance-table").innerText();
  check(!/\bFC\b|Montant|Reçu|Trésorerie|Paiement|Solde/i.test(pedagogyFinanceTableText), "Le profil pédagogique voit des données financières interdites");
  check((await page.locator("#financeContent [data-export-receipt], #financeContent #paymentForm").count()) === 0, "Le profil pédagogique reçoit une action financière interdite");
  check(await page.getByText("Aucun chiffre financier n’est exposé dans ce profil.").count(), "La limite pédagogique n'est pas expliquée");

  await domClick(page, "#closeFinanceModule");
  await page.locator("#workspaceRoleSwitch").selectOption("parent");
  await page.locator('[data-action="Frais scolaires"]').evaluate((element) => element.click());
  check((await page.locator('#financeTabs [data-finance-tab]:not([hidden])').count()) === 1, "Le Parent reçoit plus que sa situation familiale");
  const familyFinanceText = await page.locator("#financeContent").innerText();
  check(familyFinanceText.includes("Lucas Martin") && !familyFinanceText.includes("Ethan Leroy") && !familyFinanceText.includes("Chloé Bernard"), "Le Parent voit des enfants qui ne lui sont pas rattachés");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Le module financier familial déborde sur téléphone");
  await page.screenshot({ path: path.join(outputDir, "finance-parent-mobile.png"), fullPage: true });

  await domClick(page, "#closeFinanceModule");
  await page.locator("#workspaceRoleSwitch").selectOption("cashier");
  await page.locator('[data-action="Produire un reçu PDF"]').evaluate((element) => element.click());
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Le registre des reçus déborde sur téléphone");
  await page.screenshot({ path: path.join(outputDir, "finance-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await domClick(page, "#closeFinanceModule");
  await page.locator("#workspaceRoleSwitch").selectOption("teacher");
  await page.locator('[data-action="Préparation aux épreuves certificatives"]').evaluate((element) => element.click());
  check(await page.locator('[data-cert-view="stages"]').count(), "L'enseignant ne voit pas les étapes EXETAT");
  check(await page.locator('[data-cert-view="preparation"]').count(), "L'enseignant ne voit pas la préparation EXETAT");
  check((await page.locator('[data-cert-view="candidates"], [data-cert-view="results"]').count()) === 0, "L'enseignant reçoit un accès EXETAT trop large");

  await domClick(page, "#closePedagogyModule");
  await page.locator("#workspaceRoleSwitch").selectOption("secretary");
  await page.locator('[data-action="Dossiers ENAFEP, TENASOSP et EXETAT"]').evaluate((element) => element.click());
  check(await page.locator('[data-cert-view="candidates"]').count(), "Le secrétariat ne voit pas les dossiers EXETAT");
  check(await page.locator('[data-cert-view="stages"]').count(), "Le secrétariat ne voit pas les étapes EXETAT");
  check((await page.locator('[data-cert-view="preparation"], [data-cert-view="results"]').count()) === 0, "Le secrétariat reçoit un accès EXETAT trop large");

  await domClick(page, "#closePedagogyModule");
  await page.locator("#workspaceRoleSwitch").selectOption("parent");
  await page.locator('[data-action="Épreuves certificatives"]').evaluate((element) => element.click());
  check(await page.locator('[data-cert-view="stages"]').count(), "Le parent ne voit pas le calendrier EXETAT");
  check(await page.locator('[data-cert-view="parent"]').count(), "Le parent ne voit pas son résultat EXETAT");
  check((await page.locator('[data-cert-view="candidates"], [data-cert-view="preparation"], [data-cert-view="results"]').count()) === 0, "Le parent reçoit un accès EXETAT trop large");
  await domClick(page, '[data-cert-view="parent"]');
  check(await page.locator(".certification-parent").count(), "Le relevé EXETAT du parent ne s'affiche pas");

  await page.setViewportSize({ width: 390, height: 844 });
  await domClick(page, "#closePedagogyModule");
  await domClick(page, "#workspaceBack");
  await domClick(page, "#backToSplash");
  await domClick(page, "#enterSplash");
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outputDir, "galerie-mobile.png"), fullPage: true });
  check(await page.locator("#guardian.active").count(), "La galerie mobile n'est pas active");

  check(errors.length === 0, `Erreurs navigateur: ${errors.join(" | ")}`);
  await browser.close();
  console.log(JSON.stringify({ ok: true, outputDir, files: fs.readdirSync(outputDir) }, null, 2));
})().catch(async (error) => {
  if (browser) await browser.close().catch(() => {});
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
