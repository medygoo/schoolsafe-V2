import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

async function askGlobalJaspe(page: Page, query: string) {
  await page.evaluate((value) => (window as any).SafeAssistant.openWithQuery(value), query);
  const bubble = page.locator(".safe-bubble-body");
  await expect(bubble).toBeVisible();
  return bubble;
}

const scopedUser = (permissions: string[], deniedPermissions: string[] = []) => ({
  role: "finance",
  permissions: ["safe.assistant.use", ...permissions],
  scopes: [
    { permission: "safe.assistant.use", type: "own" },
    ...permissions.map((permission) => ({ permission, type: permission === "finance.control.scan" ? "assigned_classes" : "school" })),
  ],
  deniedPermissions,
});

test.describe("F8-FE — Jaspe Finance et QA finale", () => {
  test("prépare une saisie de paiement autorisée sans modifier aucune donnée", async ({ page }) => {
    await enterDemoWorkspace(page, "cashier");
    await expect.poll(() => page.evaluate(() => (window as any).SafeAssistant.isAllowed())).toBe(true);
    const before = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      return JSON.stringify({ transactions: state.transactions, studentFees: state.studentFees, paymentDraft: state.paymentDraft });
    });

    const bubble = await askGlobalJaspe(page, "Prépare la saisie du paiement de Lucas Martin pour son obligation de frais scolaires");
    await expect(bubble).toContainText("BROUILLON LOCAL");
    await expect(bubble).toContainText("finance.payment.record");
    await expect(page.locator("#financeModule")).toBeVisible();
    await expect(page.locator("#paymentForm")).toBeVisible();

    const after = await page.evaluate(() => {
      const state = (window as any).SchoolSafeFinanceModule._state;
      return JSON.stringify({ transactions: state.transactions, studentFees: state.studentFees, paymentDraft: state.paymentDraft });
    });
    expect(after).toBe(before);
  });

  test("explique les cinq statuts et retrouve une obligation précise sans la modifier", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const result = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeFinanceModule;
      const context = { activeRole: "finance", user };
      const state = api._state;
      const before = JSON.stringify(state.studentFees);
      const answers = ["paid", "partial", "pending", "exempted", "anomaly"].map((status) => api.answerJaspe(`Explique le statut ${status}`, context));
      const obligation = api.answerJaspe("Retrouve l'obligation demo-sf-lucas-transport", context);
      return { answers, obligation, unchanged: before === JSON.stringify(state.studentFees) };
    }, scopedUser(["finance.status.read", "finance.fee.read"]));

    expect(result.answers.map((answer: any) => answer.message)).toEqual(expect.arrayContaining([
      expect.stringContaining("En règle"),
      expect.stringContaining("Paiement partiel"),
      expect.stringContaining("À payer"),
      expect.stringContaining("Exempté"),
      expect.stringContaining("Anomalie à examiner"),
    ]));
    expect(result.obligation).toMatchObject({ allowed: true, action: "balances" });
    expect(result.obligation.message).toContain("demo-sf-lucas-transport");
    expect(result.obligation.message).toContain("Lucas Martin");
    expect(result.unchanged).toBe(true);
  });

  test("borne chaque préparation à sa permission Finance exacte", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const result = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeFinanceModule;
      const context = { activeRole: "finance", user };
      const assignedOnly = {
        role: "finance",
        permissions: ["safe.assistant.use", "finance.fee.read"],
        assignedClassIds: ["demo-class-1"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "finance.fee.read", type: "assigned_classes", classIds: ["demo-class-1"] },
        ],
      };
      return {
        assignment: api.answerJaspe("Prépare une affectation de frais", context),
        receipt: api.answerJaspe("Explique le reçu REC-2026-0586", context),
        report: api.answerJaspe("Aide-moi à préparer un rapport financier", context),
        payment: api.answerJaspe("Prépare un paiement", context),
        unprojectedScope: api.answerJaspe("Retrouve l'obligation demo-sf-lucas-transport", { activeRole: "finance", user: assignedOnly }),
      };
    }, scopedUser(["finance.fee.manage", "finance.receipt.read", "finance.report.read"]));

    expect(result.assignment).toMatchObject({ allowed: true, action: "assignments" });
    expect(result.receipt).toMatchObject({ allowed: true, action: "receipts" });
    expect(result.report).toMatchObject({ allowed: true, action: "reports" });
    expect(result.payment).toMatchObject({ refusal: true });
    expect(result.payment.message).toContain("finance.payment.record");
    expect(result.unprojectedScope).toMatchObject({ refusal: true });
    expect(result.unprojectedScope.message).not.toContain("100 000");
  });

  test("laisse un contrôleur expliquer le contrôle sans ouvrir Caisse, reçus ni rapports", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const result = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeFinanceModule;
      const context = { activeRole: "finance", user };
      return {
        control: api.answerJaspe("Explique la campagne et le résultat du contrôle", context),
        payment: api.answerJaspe("Enregistre un paiement", context),
        cash: api.answerJaspe("Ouvre la caisse", context),
        receipt: api.answerJaspe("Montre le reçu REC-2026-0586", context),
        report: api.answerJaspe("Prépare le rapport financier", context),
      };
    }, scopedUser(["finance.control.scan"]));

    expect(result.control).toMatchObject({ allowed: true, action: "fee-control" });
    for (const answer of [result.payment, result.cash, result.receipt, result.report]) {
      expect(answer).toMatchObject({ refusal: true });
    }
    expect(JSON.stringify(result)).not.toContain("450000");
    expect(JSON.stringify(result)).not.toContain("350000");
  });

  test("fait primer les DENY, refuse l’annulation absente et exclut tout élève draft", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const result = await page.evaluate(({ paymentUser, deniedPaymentUser, deniedAssistantUser }) => {
      const api = (window as any).SchoolSafeFinanceModule;
      const context = (user: any) => ({ activeRole: "finance", user });
      const before = JSON.stringify({ transactions: api._state.transactions, studentFees: api._state.studentFees });
      const answers = {
        cancel: api.answerJaspe("Annule le paiement REC-2026-0586", context(paymentUser)),
        deniedPayment: api.answerJaspe("Prépare un paiement", context(deniedPaymentUser)),
        deniedAssistant: api.answerJaspe("Explique pending", context(deniedAssistantUser)),
        draft: api.answerJaspe("Prépare un paiement officiel pour Amina Mbuyi", context(paymentUser)),
      };
      return { answers, unchanged: before === JSON.stringify({ transactions: api._state.transactions, studentFees: api._state.studentFees }) };
    }, {
      paymentUser: scopedUser(["finance.payment.record"]),
      deniedPaymentUser: scopedUser(["finance.payment.record"], ["finance.payment.record"]),
      deniedAssistantUser: scopedUser(["finance.status.read"], ["safe.assistant.use"]),
    });

    expect(result.answers.cancel).toMatchObject({ refusal: true });
    expect(result.answers.cancel.message).toContain("finance.payment.cancel");
    expect(result.answers.deniedPayment).toMatchObject({ refusal: true });
    expect(result.answers.deniedAssistant).toMatchObject({ refusal: true });
    expect(result.answers.draft).toMatchObject({ refusal: true });
    expect(result.answers.draft.message).toContain("DOSSIER NON ACTIF");
    expect(result.unchanged).toBe(true);
  });

  test("conserve own_children pour le Parent et ne donne aucun détail financier au Gardien", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    const result = await page.evaluate(() => {
      const parent = (window as any).SchoolSafeParentPortal;
      const parentContext = (window as any).SchoolSafeAppContext.getAssistantContext();
      const finance = (window as any).SchoolSafeFinanceModule;
      const guard = {
        role: "guard",
        permissions: ["safe.assistant.use", "security.scan"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "security.scan", type: "assigned_portal", portalIds: ["demo-portal-main"] },
        ],
      };
      return {
        own: parent.answerJaspe("Résume la situation financière de mon enfant", parentContext),
        foreign: parent.answerJaspe("Donne la situation financière de Ethan Leroy", parentContext),
        guard: finance.answerJaspe("Donne les montants payés par Lucas Martin", { activeRole: "guard", user: guard }),
      };
    });

    expect(result.own.message).toContain("Lucas Martin");
    expect(result.own.message).not.toContain("Ethan Leroy");
    expect(result.foreign).toMatchObject({ refusal: true });
    expect(result.guard).toMatchObject({ refusal: true });
    expect(result.guard.message).not.toMatch(/450[\s.]?000|350[\s.]?000/);
  });

  test("reste lisible à 390, 834 et 1440 en clair et bleu nuit sans overflow", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    await enterDemoWorkspace(page, "finance");
    await page.evaluate(() => (window as any).SchoolSafeFinanceModule.render("financeModule", { tab: "overview" }));
    await askGlobalJaspe(page, "Explique le statut partial");

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const visible = (node: Element) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const insideHorizontalScroller = (node: Element) => {
            let parent = node.parentElement;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true;
              parent = parent.parentElement;
            }
            return false;
          };
          const overflow = Array.from(document.querySelectorAll("#financeModule *, .safe-assistant *"))
            .filter(visible)
            .filter((node) => !insideHorizontalScroller(node))
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
            })
            .map((node) => ({ tag: node.tagName, className: (node as HTMLElement).className }));
          const shortButtons = Array.from(document.querySelectorAll("#financeModule button, .safe-assistant button"))
            .filter(visible)
            .filter((node) => node.getBoundingClientRect().height < 43.5)
            .map((node) => ({ text: (node.textContent || "").trim(), height: node.getBoundingClientRect().height }));
          const rgb = (value: string) => {
            const match = value.match(/[\d.]+/g);
            return match && match.length >= 3 ? match.slice(0, 3).map(Number) : null;
          };
          const luminance = (color: number[]) => color.map((channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
          }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
          const effectiveBackground = (node: Element) => {
            let current: Element | null = node;
            while (current) {
              const value = getComputedStyle(current).backgroundColor;
              if (value && value !== "transparent" && !/rgba\([^)]*,\s*0\s*\)$/.test(value)) return rgb(value);
              current = current.parentElement;
            }
            return [255, 255, 255];
          };
          const contrastFailures = ["#financeContent", ".safe-bubble-body"].flatMap((selector) => {
            const node = document.querySelector(selector);
            if (!node || !visible(node)) return [];
            const foreground = rgb(getComputedStyle(node).color);
            const background = effectiveBackground(node);
            if (!foreground || !background) return [{ selector, ratio: 0 }];
            const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
            const ratio = (values[0] + 0.05) / (values[1] + 0.05);
            return ratio < 4.5 ? [{ selector, ratio }] : [];
          });
          return { overflow, shortButtons, contrastFailures, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
        });
        expect(layout, `${theme} ${viewport.width}px`).toEqual({ overflow: [], shortButtons: [], contrastFailures: [], bodyOverflow: false });
      }
    }
  });
});
