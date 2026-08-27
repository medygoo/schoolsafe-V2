import { test, expect, type Locator, type Page } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openFamilyDossier(page: Page) {
  const schoolBranch = page.locator('[data-branch="school"]:visible').first();
  await expect(schoolBranch).toBeVisible();
  await schoolBranch.evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-school-tab="students"]').click();
  await page.locator('[data-student-id="demo-draft-student"] [data-student-detail]').click();
  const dossier = page.locator(".student-family-dossier");
  await expect(dossier).toBeVisible();
  return dossier;
}

async function settleModalScroll(modal: Locator, top?: number) {
  await modal.evaluate(async (element, requestedTop) => {
    if (typeof requestedTop === "number") element.scrollTo({ top: requestedTop, left: 0, behavior: "auto" });
    await new Promise<void>((resolve) => {
      let stableFrames = 0;
      let lastTop = element.scrollTop;
      let lastLeft = element.scrollLeft;
      const observe = () => {
        const isStable = Math.abs(element.scrollTop - lastTop) < 1 && Math.abs(element.scrollLeft - lastLeft) < 1;
        stableFrames = isStable ? stableFrames + 1 : 0;
        lastTop = element.scrollTop;
        lastLeft = element.scrollLeft;
        if (stableFrames >= 3) resolve();
        else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
  }, top);
}

function waitForModalScrollEnd(modal: Locator) {
  return modal.evaluate((element) => new Promise<void>((resolve) => {
    element.addEventListener("scrollend", () => resolve(), { once: true });
  }));
}

test.describe("B2-FE — dossier familial et urgence", () => {
  test("présente le parent principal et toutes les sections du dossier", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openFamilyDossier(page);

    await expect(dossier.getByRole("heading", { name: "Identité", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Scolarité prévue", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Parent principal", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Tuteurs secondaires", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Contact d’urgence", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Photos et identités", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Checklist", exact: true })).toBeVisible();
    await expect(dossier.getByRole("heading", { name: "Historique du brouillon", exact: true })).toBeVisible();

    const parent = dossier.locator("[data-primary-parent]");
    await expect(parent.getByText("Sarah Mbuyi")).toBeVisible();
    await expect(parent.getByText("Mère", { exact: true })).toBeVisible();
    await expect(parent.getByText("+243 810 000 111")).toBeVisible();
    await expect(parent.getByText("sarah.mbuyi@example.test")).toBeVisible();
    await expect(parent.getByText("PARENT À ACTIVER")).toBeVisible();
  });

  test("affiche exactement trois tuteurs et sépare le contact d’urgence", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openFamilyDossier(page);

    const guardians = dossier.locator("[data-secondary-guardian]");
    await expect(guardians).toHaveCount(3);
    await expect(guardians.nth(0).getByText("Tuteur secondaire 1")).toBeVisible();
    await expect(guardians.nth(1).getByText("Tuteur secondaire 2")).toBeVisible();
    await expect(guardians.nth(2).getByText("Tuteur secondaire 3")).toBeVisible();
    await expect(guardians.locator(".ss-badge").filter({ hasText: "AUTORISÉ" })).toHaveCount(2);
    await expect(guardians.locator(".ss-badge").filter({ hasText: "SUSPENDU" })).toHaveCount(1);

    const emergency = dossier.locator("[data-emergency-contact]");
    await expect(emergency).toBeVisible();
    await expect(emergency.getByRole("heading", { name: "CONTACT D’URGENCE", exact: true })).toBeVisible();
    await expect(emergency.getByText("Tuteur secondaire 1")).toHaveCount(0);
    await expect(dossier.locator("[data-call-order] li")).toHaveText([
      "1 Parent principal",
      "2 Contact d’urgence",
      "3 Direction",
    ]);
  });

  test("prévisualise, zoome, repositionne et supprime une photo en démonstration", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openFamilyDossier(page);
    const guardian = dossier.locator('[data-secondary-guardian="2"]');

    await expect(guardian.getByText("Photo manquante")).toBeVisible();
    await guardian.locator('input[type="file"]').setInputFiles({
      name: "guardian.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });

    const preview = guardian.locator("[data-photo-preview]");
    await expect(preview).toBeVisible();
    const zoom = guardian.getByLabel("Zoom photo");
    await zoom.fill("135");
    await expect(preview).toHaveCSS("transform", /matrix\(1\.35/);
    await guardian.getByLabel("Position horizontale").fill("20");
    await guardian.getByLabel("Position verticale").fill("-15");
    await expect(guardian.getByText("Déplacement : 20 / -15")).toBeVisible();

    await guardian.getByRole("button", { name: "Supprimer la photo" }).click();
    await expect(guardian.getByText("Photo manquante")).toBeVisible();
    await expect(dossier.getByText("BACKEND_LATER").first()).toBeVisible();
  });

  test("rend la checklist et les états de complétion sans activation", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const dossier = await openFamilyDossier(page);
    const checklist = dossier.locator(".family-completion");

    await expect(checklist.locator("[data-completion-item]")).toHaveCount(8);
    await expect(checklist.getByText("INCOMPLET", { exact: true })).toBeVisible();
    await expect(checklist.getByText("EN COURS", { exact: true })).toBeVisible();
    await expect(checklist.getByText("PRÊT POUR VÉRIFICATION", { exact: true })).toBeVisible();
    await expect(checklist.getByRole("button", { name: /activer/i })).toHaveCount(0);
    await expect(checklist.getByRole("button", { name: /valider/i })).toHaveCount(0);
  });

  test("navigue sans débordement en clair et sombre aux trois largeurs", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice 390/834/1440 utilise un contexte desktop redimensionnable ; les scénarios fonctionnels couvrent séparément l’émulation mobile.");
    await enterDemoWorkspace(page, "admin");

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 834, height: 1112 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        const existing = page.locator(".student-family-dossier");
        if (!(await existing.isVisible().catch(() => false))) await openFamilyDossier(page);
        const dossier = page.locator(".student-family-dossier");
        const modal = page.locator(".student-family-modal .ss-modal");
        await settleModalScroll(modal, 0);
        await expect(dossier.locator(".family-dossier-hero")).toBeInViewport();
        await expect(dossier.getByRole("heading", { name: "Amina Mbuyi", exact: true })).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`b2-family-top-${theme}-${viewport.width}.png`) });
        const scrollEnded = waitForModalScrollEnd(modal);
        await dossier.getByRole("button", { name: "Contact d’urgence" }).click();
        await scrollEnded;
        const emergency = dossier.locator("#student-dossier-emergency");
        await expect(emergency).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`b2-family-${theme}-${viewport.width}.png`) });
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
