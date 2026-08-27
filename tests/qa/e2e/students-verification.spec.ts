import { test, expect, type Locator, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const PHOTO_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function completeFamilyState() {
  const photo = () => ({ src: PHOTO_DATA, zoom: 100, x: 0, y: 0 });
  return {
    studentPhoto: photo(),
    guardians: [
      { relation: "tante", lastName: "Kalonji", middleName: "Wa", firstName: "Mireille", phone: "+243 820 100 201", email: "mireille@example.test", idType: "Carte d’électeur", idNumber: "EL-0091842", status: "authorized", photo: photo() },
      { relation: "oncle", lastName: "Mbuyi", middleName: "Kabeya", firstName: "Patrick", phone: "+243 820 100 202", email: "patrick@example.test", idType: "Passeport", idNumber: "OP-441082", status: "authorized", photo: photo() },
      { relation: "grand-parent", lastName: "Mbuyi", middleName: "Tshibangu", firstName: "Jeanne", phone: "+243 820 100 203", email: "", idType: "Carte d’électeur", idNumber: "EL-0076139", status: "authorized", photo: photo() },
    ],
    emergency: {
      relation: "Grand-mère", lastName: "Mbuyi", middleName: "Tshibangu", firstName: "Jeanne",
      phonePrimary: "+243 820 100 203", phoneSecondary: "+243 890 300 203", email: "",
      idType: "Carte d’électeur", idNumber: "EL-0076139", callOrder: "2", photo: photo(),
    },
    parentSnapshot: {
      name: "Sarah Mbuyi", relation: "mere", phone: "+243 810 000 111",
      email: "sarah.mbuyi@example.test", accountStatus: "active",
    },
    history: [
      { at: "Aujourd’hui · 09:40", label: "Dossier familial ouvert en démonstration" },
      { at: "Hier · 16:15", label: "Parent principal rattaché au brouillon" },
      { at: "Hier · 15:52", label: "Dossier élève créé en préparation" },
    ],
    verification: { status: "incomplete" },
  };
}

async function openVerificationDossier(page: Page) {
  const schoolBranch = page.locator('[data-branch="school"]:visible').first();
  await expect(schoolBranch).toBeVisible();
  await schoolBranch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="students"]').click();
  await page.locator('[data-student-id="demo-draft-student"] [data-student-detail]').click();
  const dossier = page.locator(".student-family-dossier");
  await expect(dossier).toBeVisible();
  return dossier;
}

async function seedCompleteDossier(page: Page) {
  const state = completeFamilyState();
  await page.evaluate((value) => {
    localStorage.setItem("schoolsafe-b2-family-demo-v1", JSON.stringify({ "demo-draft-student": value }));
  }, state);
}

async function waitForModalScrollEnd(modal: Locator) {
  await modal.evaluate((element) => new Promise<void>((resolve) => {
    element.addEventListener("scrollend", () => resolve(), { once: true });
  }));
}

function currentStatus(verification: Locator) {
  return verification.locator(".student-verification__lead .ss-badge");
}

test.describe("B3-FE — vérification et activation de démonstration", () => {
  test("bloque précisément un dossier incomplet et masque la confirmation finale", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openVerificationDossier(page);
    const verification = dossier.locator("[data-verification-section]");

    await expect(verification.getByRole("heading", { name: "Vérification et activation", exact: true })).toBeVisible();
    await expect(verification.locator("[data-verification-condition]")).toHaveCount(10);
    await expect(currentStatus(verification)).toHaveText("INCOMPLET");
    const corrections = verification.locator(".student-verification__missing");
    await expect(corrections.getByText("Compte Parent actif", { exact: true })).toBeVisible();
    await expect(corrections.getByText("Photos présentes", { exact: true })).toBeVisible();
    await expect(verification.getByText("school.student.activate — BACKEND_LATER", { exact: true })).toBeVisible();
    await expect(verification.getByRole("button", { name: "Vérifier le dossier" })).toBeVisible();
    await expect(verification.getByRole("button", { name: "Activer dans la démonstration" })).toHaveCount(0);
    await expect(page.getByRole("dialog").getByText(/confirmer l.activation/i)).toHaveCount(0);
  });

  test("fait passer un dossier complet de la vérification à l’activation locale sans écriture réseau", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await seedCompleteDossier(page);
    const dossier = await openVerificationDossier(page);
    const verification = dossier.locator("[data-verification-section]");
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/school/students") && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
    });

    await verification.getByRole("button", { name: "Vérifier le dossier" }).click();
    await expect(currentStatus(verification)).toHaveText("EN COURS DE VÉRIFICATION");
    await expect(verification.getByText("Aucune information obligatoire ne manque.")).toBeVisible();
    await verification.getByRole("button", { name: "Marquer prêt pour activation" }).click();
    await expect(currentStatus(verification)).toHaveText("PRÊT POUR ACTIVATION");

    await verification.getByRole("button", { name: "Activer dans la démonstration" }).click();
    const confirmation = page.getByRole("dialog").last();
    await expect(confirmation.getByRole("heading", { name: "Activation de démonstration" })).toBeVisible();
    await expect(confirmation.getByText(/aucune activation serveur/i)).toBeVisible();
    await confirmation.getByRole("button", { name: "Confirmer la démonstration" }).click();

    await expect(currentStatus(verification)).toHaveText("ACTIF");
    await expect(verification.locator("[data-next-function]")).toHaveText(["Carte élève", "QR", "Présence", "Finance", "Pédagogie", "Documents"]);
    await expect(dossier.getByText("Activation de démonstration", { exact: true })).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("reste en consultation sans permission et Jaspe ne déclenche aucune activation", async ({ page }) => {
    await enterDemoWorkspace(page, "admissions");
    const dossier = await openVerificationDossier(page);
    const verification = dossier.locator("[data-verification-section]");
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/school/students") && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
    });

    await expect(verification.getByText("Consultation uniquement", { exact: true })).toBeVisible();
    await expect(verification.getByRole("button", { name: /vérifier|retourner|marquer prêt|activer/i })).toHaveCount(0);
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Active ce dossier élève"));
    await expect(page.locator(".safe-bubble-body")).toContainText("Je ne peux pas exécuter une activation");
    await expect(currentStatus(verification)).toHaveText("INCOMPLET");
    expect(writes).toEqual([]);
  });

  test("retourne un dossier vérifié pour correction avec une trace visuelle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openVerificationDossier(page);
    const verification = dossier.locator("[data-verification-section]");

    await verification.getByRole("button", { name: "Vérifier le dossier" }).click();
    await expect(currentStatus(verification)).toHaveText("EN COURS DE VÉRIFICATION");
    await verification.getByRole("button", { name: "Retourner pour correction" }).click();
    await expect(currentStatus(verification)).toHaveText("INCOMPLET");
    await expect(dossier.getByText("Retourné pour correction", { exact: true })).toBeVisible();
  });

  test("reste lisible en clair et sombre aux largeurs 390, 834 et 1440", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice multi-viewport s’exécute dans le contexte desktop redimensionnable.");
    await enterDemoWorkspace(page, "admin");

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const existing = page.locator(".student-family-dossier");
        if (!(await existing.isVisible().catch(() => false))) await openVerificationDossier(page);
        const dossier = page.locator(".student-family-dossier");
        const modal = page.locator(".student-family-modal .ss-modal");
        await modal.evaluate((element) => element.scrollTo({ top: 0, left: 0, behavior: "auto" }));
        const scrollEnded = waitForModalScrollEnd(modal);
        await dossier.getByRole("button", { name: "Vérification et activation" }).click();
        await scrollEnded;
        const verification = dossier.locator("[data-verification-section]");
        await expect(verification).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`b3-verification-${theme}-${viewport.width}.png`) });
        const overflow = await dossier.evaluate((root) => {
          const viewportWidth = document.documentElement.clientWidth;
          return Array.from(root.querySelectorAll("*"))
            .filter((element) => {
              if (element.classList.contains("sr-only") || element instanceof HTMLInputElement && element.type === "file") return false;
              const rect = element.getBoundingClientRect();
              return rect.right > viewportWidth + 1 || rect.left < -1;
            })
            .map((element) => ({ tag: element.tagName, className: element.className }));
        });
        expect(overflow, `${theme} ${viewport.width}: ${JSON.stringify(overflow)}`).toEqual([]);
      }
    }
  });
});
