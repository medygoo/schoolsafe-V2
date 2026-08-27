import { test, expect } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openCommunications(page: any) {
  await page.locator('[data-parent-shortcut="communications"]').click();
  const view = page.locator(".parent-communications");
  await expect(view).toBeVisible();
  return view;
}

test.describe("C3-FE — communications, convocations et notifications", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
  });

  test("affiche uniquement l’historique autorisé de l’enfant sélectionné", async ({ page }) => {
    const view = await openCommunications(page);
    await expect(view).toContainText("Lucas Martin");
    await expect(view.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Convocations" })).toBeVisible();
    await expect(view.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(view).not.toContainText("Emma Martin");
    await expect(view).not.toContainText("Ethan Leroy");
  });

  test("suit le changement d’enfant sans sortir de own_children", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-parent-child-emma");
    const view = await openCommunications(page);
    await expect(view).toContainText("Emma Martin");
    await expect(view).not.toContainText("Lucas Martin");
  });

  test("prépare un brouillon vers la Direction sans effectuer d’envoi", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read", "communication.message.send"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "communication.message.send", type: "own_children" },
        ],
      });
    });
    const view = await openCommunications(page);
    await expect(view.locator("[data-parent-message-recipient]")).toContainText("Direction de l’établissement");
    await expect(view).not.toContainText("Enseignant destinataire");
    await expect(view.getByRole("button", { name: "Envoyer" })).toHaveCount(0);

    await view.locator("#parentMessageDraft").fill("Je souhaite demander un rendez-vous pour Lucas.");
    await view.getByRole("button", { name: "Préparer le message" }).click();
    await expect(view.locator(".parent-message-draft-state")).toContainText("Brouillon local préparé");
    await expect(view.locator(".parent-message-draft-state")).toContainText("BACKEND_LATER");
  });

  test("fait primer un DENY explicite sur l’autorisation de préparer un message", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        role: "parent",
        permissions: ["school.student.read", "communication.message.send"],
        deniedPermissions: ["communication.message.send"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "communication.message.send", type: "own_children" },
        ],
      });
    });
    const view = await openCommunications(page);
    await expect(view.locator(".parent-communication-denied")).toContainText("Préparation de message indisponible");
    await expect(view.locator("#parentMessageDraft")).toHaveCount(0);
    await expect(view.getByRole("button", { name: "Préparer le message" })).toHaveCount(0);
  });

  test("refuse une ouverture directe pour un enfant non lié", async ({ page }) => {
    const opened = await page.evaluate(() => {
      const portal = (window as any).SchoolSafeParentPortal;
      return portal.openCommunications("demo-unrelated-child-ethan", {
        role: "parent",
        permissions: ["school.student.read", "communication.message.send"],
        childIds: ["demo-parent-child-lucas"],
        scopes: [
          { permission: "school.student.read", type: "own_children" },
          { permission: "communication.message.send", type: "own_children" },
        ],
      });
    });
    expect(opened).toBe(false);
    await expect(page.locator(".parent-communications")).toHaveCount(0);
  });

  test("n’invente aucun historique officiel pour un dossier en préparation", async ({ page }) => {
    await page.locator("#parentChildSelect").selectOption("demo-draft-student");
    const view = await openCommunications(page);
    await expect(view).toContainText("Aucun historique officiel");
    await expect(view).toContainText("EN PRÉPARATION");
  });
});
