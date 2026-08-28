import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function openHandoffs(page: import("@playwright/test").Page) {
  await page.locator('button[data-branch="communication"]:visible').first().evaluate((element: HTMLElement) => element.click());
  await page.locator('[data-communication-tab="handoffs"]').evaluate((element: HTMLElement) => element.click());
}

test.describe("Phase K7 — liaisons transversales", () => {
  test("exige successivement l’accès source puis message et minimise le contexte", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    await page.evaluate(() => (window as any).SchoolSafeCommunication.setSession(null));
    const result = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const base = {
        childIds: ["child-1"],
        scopes: [
          { permission: "security.events.read", type: "own_children" },
          { permission: "communication.message.send", type: "own_children" },
        ],
      };
      const payload = {
        source: "security",
        sourcePermission: "security.events.read",
        context: { type: "child", id: "child-1" },
        summaryCategory: "Anomalie de passage",
        rawStudentName: "NE DOIT PAS SORTIR",
        rawDetails: "Donnée sensible",
      };
      return {
        allowed: api.prepareHandoff(payload, { ...base, permissions: ["security.events.read", "communication.message.send"] }),
        noSource: api.prepareHandoff(payload, { ...base, permissions: ["communication.message.send"] }),
        noMessage: api.prepareHandoff(payload, { ...base, permissions: ["security.events.read"] }),
        otherChild: api.prepareHandoff({ ...payload, context: { type: "child", id: "child-2" } }, { ...base, permissions: ["security.events.read", "communication.message.send"] }),
      };
    });

    expect(result.allowed.allowed).toBe(true);
    expect(result.allowed.context).toEqual({ source: "security", contextType: "child", contextId: "child-1", summaryCategory: "Anomalie de passage" });
    expect(JSON.stringify(result.allowed)).not.toContain("NE DOIT PAS SORTIR");
    expect(result.noSource.reason).toBe("SOURCE_NON_AUTORISÉE");
    expect(result.noMessage.reason).toBe("MESSAGE_NON_AUTORISÉ");
    expect(result.otherChild.reason).toBe("PORTÉE_SOURCE_REFUSÉE");
  });

  test("le DENY source ou communication reste prioritaire", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    const outcomes = await page.evaluate(() => {
      const api = (window as any).SchoolSafeCommunication;
      const payload = { source: "finance", sourcePermission: "finance.status.read", context: { type: "child", id: "child-1" }, summaryCategory: "Situation à expliquer" };
      const common = {
        permissions: ["finance.status.read", "communication.message.send"],
        childIds: ["child-1"],
        scopes: [
          { permission: "finance.status.read", type: "own_children" },
          { permission: "communication.message.send", type: "own_children" },
        ],
      };
      return [
        api.prepareHandoff(payload, { ...common, deniedPermissions: ["finance.status.read"] }),
        api.prepareHandoff(payload, { ...common, deniedPermissions: ["communication.message.send"] }),
      ];
    });
    expect(outcomes[0].reason).toBe("SOURCE_NON_AUTORISÉE");
    expect(outcomes[1].reason).toBe("MESSAGE_NON_AUTORISÉ");
  });

  test("affiche les quatre sources et ouvre seulement une préparation de message", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await openHandoffs(page);
    await page.evaluate(() => {
      (window as any).SchoolSafeCommunication.setSession({
        token: "live-test",
        schoolId: "demo-school-1",
        permissions: ["security.events.read", "pedagogy.report.read", "finance.status.read", "pilotage.dashboard.read", "communication.message.send"],
        scopes: [
          { permission: "security.events.read", type: "school" },
          { permission: "pedagogy.report.read", type: "school" },
          { permission: "finance.status.read", type: "school" },
          { permission: "pilotage.dashboard.read", type: "school" },
          { permission: "communication.message.send", type: "school" },
        ],
      });
      (window as any).SchoolSafeCommunication.open("handoffs");
    });

    const sources = page.locator("[data-handoff-grid]");
    for (const label of ["Sécurité", "Pédagogie", "Finance", "Direction"]) {
      await expect(sources.getByText(label, { exact: true })).toBeVisible();
    }
    await page.locator('[data-handoff-prepare="security"]').click();
    await expect(page.locator("[data-message-form]")).toBeVisible();
    await expect(page.locator('[name="subject"]')).toHaveValue(/Sécurité/);
    await expect(page.locator("[data-message-draft]")).toHaveCount(0);
    await expect(page.locator("[data-handoff-pending]")).toContainText("PRÉPARATION UNIQUEMENT");
  });
});
