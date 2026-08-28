import { expect, test, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { enterDemoWorkspace } from "./helpers";

function communicationUser(permission?: string, live = false, deniedPermissions: string[] = []) {
  return {
    ...(live ? { token: "live-test" } : {}),
    userId: "communication-1",
    schoolId: "school-1",
    role: "communication",
    permissions: ["safe.assistant.use", ...(permission ? [permission] : [])],
    scopes: [
      { permission: "safe.assistant.use", type: "own" },
      ...(permission ? [{ permission, type: permission === "notification.subscribe" ? "own" : "school" }] : []),
    ],
    deniedPermissions,
  };
}

test.describe("Phase K8 — Jaspe Communication et QA", () => {
  test("exige safe.assistant.use + own puis la permission exacte de l’action", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    const answers = await page.evaluate(({ message, announcement, email, notification, missing, denied }) => {
      const api = (window as any).SchoolSafeCommunication;
      return {
        message: api.answerJaspe("Aide-moi à rédiger un message", { user: message }),
        announcement: api.answerJaspe("Reformule une annonce", { user: announcement }),
        email: api.answerJaspe("Prépare le ton d'un email", { user: email }),
        notification: api.answerJaspe("Explique mes notifications", { user: notification }),
        missing: api.answerJaspe("Aide-moi à rédiger un message", { user: missing }),
        denied: api.answerJaspe("Aide-moi à rédiger un message", { user: denied }),
      };
    }, {
      message: communicationUser("communication.message.send"),
      announcement: communicationUser("communication.announcement.manage"),
      email: communicationUser("email.send"),
      notification: communicationUser("notification.subscribe"),
      missing: communicationUser(),
      denied: communicationUser("communication.message.send", false, ["communication.message.send"]),
    });
    expect(answers.message).toMatchObject({ allowed: true, action: "messages" });
    expect(answers.announcement).toMatchObject({ allowed: true, action: "announcements" });
    expect(answers.email).toMatchObject({ allowed: true, action: "channels" });
    expect(answers.notification).toMatchObject({ allowed: true, action: "notifications" });
    expect(answers.missing).toMatchObject({ refusal: true });
    expect(answers.denied).toMatchObject({ refusal: true });
  });

  test("refuse envoi, publication, convocation réelle, élargissement, lecture globale, WebSync et urgence", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    const queries = [
      "Envoie ce message maintenant", "Publie cette annonce", "Convoque ce parent officiellement",
      "Élargis les destinataires à toute l'école", "Lis toutes les notifications", "Publie sur WebSync",
      "Déclenche une alerte de sécurité urgente",
    ];
    const answers = await page.evaluate(({ user, queries }) => {
      const api = (window as any).SchoolSafeCommunication;
      return queries.map((query: string) => ({ query, answer: api.answerJaspe(query, { user }) }));
    }, { user: communicationUser("communication.message.send"), queries });
    for (const item of answers) {
      if (!item.answer) throw new Error(`Aucune réponse Jaspe pour : ${item.query}`);
      expect(item.answer, item.query).toMatchObject({ refusal: true });
      expect(item.answer.message, item.query).toContain("REFUS");
    }
  });

  test("autorise seulement l’explication démo d’une convocation", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    const answers = await page.evaluate(({ demo, live }) => {
      const api = (window as any).SchoolSafeCommunication;
      return {
        demo: api.answerJaspe("Explique une convocation démo", { user: demo }),
        live: api.answerJaspe("Explique une convocation", { user: live }),
      };
    }, { demo: communicationUser(), live: communicationUser(undefined, true) });
    expect(answers.demo).toMatchObject({ allowed: true, action: "convocations" });
    expect(answers.demo.message).toContain("DÉMONSTRATION");
    expect(answers.live).toMatchObject({ refusal: true });
    expect(answers.live.message).toContain("PERMISSION CONVOCATION DÉDIÉE REQUISE");
  });

  test("route une aide de rédaction dans le Jaspe global sans exécuter l’action", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    await page.evaluate(() => (window as any).SafeAssistant.openWithQuery("Aide-moi à rédiger une annonce"));
    await expect(page.locator(".safe-bubble-body")).toContainText("ANNONCE");
    await expect(page.locator("#communicationModule")).toBeVisible();
    await expect(page.locator("[data-announcement-form]")).toBeVisible();
    await expect(page.locator("[data-announcement-draft]")).toHaveCount(0);
  });

  test("ne crée aucune permission Communication, Convocation, Notification ou WebSync", async () => {
    const permissions = JSON.parse(await readFile(path.join(process.cwd(), "shared", "permissions.json"), "utf8"));
    const codes = permissions.map((item: { code: string }) => item.code);
    for (const forbidden of ["communication.convocation.manage", "notification.send", "notification.manage", "websync.publish", "communication.event.publish"]) {
      expect(codes).not.toContain(forbidden);
    }
    for (const existing of ["communication.announcement.manage", "communication.message.send", "email.send", "notification.subscribe", "safe.assistant.use"]) {
      expect(codes).toContain(existing);
    }
  });

  test("reste lisible à 390, 834 et 1440 px dans les thèmes clair et bleu nuit", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "Matrice redimensionnable exécutée sur desktop.");
    await enterDemoWorkspace(page, "communication");
    await page.evaluate(() => (window as any).SchoolSafeAppContext.openCommunication("dashboard"));

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const width of [390, 834, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 1000 });
        const layout = await page.evaluate(() => {
          const visible = (node: Element) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
          const insideScroller = (node: Element) => {
            let parent = node.parentElement;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true;
              parent = parent.parentElement;
            }
            return false;
          };
          const overflow = Array.from(document.querySelectorAll("#communicationModule *")).filter(visible).filter((node) => !insideScroller(node)).filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
          }).length;
          const shortControls = Array.from(document.querySelectorAll("#communicationModule button, #communicationModule input, #communicationModule select, #communicationModule textarea")).filter(visible).filter((node) => node.getBoundingClientRect().height < 43.5).length;
          const module = document.querySelector("#communicationModule") as HTMLElement;
          const style = getComputedStyle(module);
          return { overflow, shortControls, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, color: style.color, background: style.backgroundColor };
        });
        expect(layout.overflow, `${theme} ${width}px`).toBe(0);
        expect(layout.shortControls, `${theme} ${width}px`).toBe(0);
        expect(layout.bodyOverflow, `${theme} ${width}px`).toBe(false);
        expect(layout.color).not.toBe(layout.background);
      }
    }
  });
});
