import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { enterDemoWorkspace, openAction } from "./helpers";

const accountingUser = (permissions: string[], deniedPermissions: string[] = [], role = "accountant") => ({
  role,
  permissions: ["safe.assistant.use", ...permissions],
  scopes: [
    { permission: "safe.assistant.use", type: "own" },
    ...permissions.map((permission) => ({ permission, type: "school" })),
  ],
  deniedPermissions,
});

async function askGlobalJaspe(page: Page, query: string) {
  await page.evaluate((value) => (window as any).SafeAssistant.openWithQuery(value), query);
  const bubble = page.locator(".safe-bubble-body");
  await expect(bubble).toBeVisible();
  return bubble;
}

test.describe("G8-FE — Jaspe Comptabilité et QA finale", () => {
  test("explique uniquement les données comptables visibles sans mutation", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    const result = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeAccountingTreasury;
      const finance = (window as any).SchoolSafeFinanceModule._state;
      const context = { activeRole: "accountant", user };
      const before = JSON.stringify({ transactions: finance.transactions, expenses: finance.expenses, studentFees: finance.studentFees });
      const answers = {
        movement: api.answerJaspe("Explique le mouvement REC-2026-0586", context),
        treasury: api.answerJaspe("Explique la trésorerie CDF par devise", context),
        anomaly: api.answerJaspe("Explique les anomalies du rapprochement", context),
        report: api.answerJaspe("Explique le rapport financier frontend", context),
      };
      return { answers, unchanged: before === JSON.stringify({ transactions: finance.transactions, expenses: finance.expenses, studentFees: finance.studentFees }) };
    }, accountingUser(["reports.financial.read"]));

    expect(result.answers.movement).toMatchObject({ allowed: true, action: "journal" });
    expect(result.answers.movement.message).toContain("REC-2026-0586");
    expect(result.answers.treasury).toMatchObject({ allowed: true, action: "treasury" });
    expect(result.answers.treasury.message).toContain("AUCUNE CONVERSION");
    expect(result.answers.anomaly).toMatchObject({ allowed: true, action: "reconciliation" });
    expect(result.answers.report).toMatchObject({ allowed: true, action: "reports" });
    expect(result.unchanged).toBe(true);
  });

  test("refuse toutes les écritures, altérations et inventions comptables", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    const result = await page.evaluate((user) => {
      const api = (window as any).SchoolSafeAccountingTreasury;
      const context = { activeRole: "accountant", user };
      const finance = (window as any).SchoolSafeFinanceModule._state;
      const before = JSON.stringify(finance);
      const queries = [
        "Crée une dépense officielle",
        "Crée une écriture comptable débit crédit",
        "Modifie le paiement REC-2026-0586",
        "Supprime la transaction REC-2026-0586",
        "Fabrique un reçu",
        "Change le montant et la devise",
        "Applique un taux FX de conversion",
        "Clôture officiellement la caisse",
        "Invente le solde d'ouverture",
        "Produis un bilan légal et un compte de résultat",
      ];
      const answers = queries.map((query) => api.answerJaspe(query, context));
      return { answers, unchanged: before === JSON.stringify(finance) };
    }, accountingUser(["reports.financial.read", "finance.cash_register.close"]));

    for (const answer of result.answers) {
      expect(answer).toMatchObject({ refusal: true });
      expect(answer.message).toContain("REFUS");
    }
    expect(result.unchanged).toBe(true);
  });

  test("borne la clôture à sa permission et fait primer les DENY", async ({ page }) => {
    await enterDemoWorkspace(page, "finance");
    const result = await page.evaluate(({ closer, reader, deniedClose, deniedRead }) => {
      const api = (window as any).SchoolSafeAccountingTreasury;
      return {
        closer: api.answerJaspe("Aide-moi à préparer l'observation de clôture", { activeRole: "finance", user: closer }),
        reader: api.answerJaspe("Aide-moi à préparer l'observation de clôture", { activeRole: "accountant", user: reader }),
        deniedClose: api.answerJaspe("Aide-moi à préparer l'observation de clôture", { activeRole: "finance", user: deniedClose }),
        deniedRead: api.answerJaspe("Explique le journal de trésorerie", { activeRole: "accountant", user: deniedRead }),
      };
    }, {
      closer: accountingUser(["finance.cash_register.close"], [], "finance"),
      reader: accountingUser(["reports.financial.read"]),
      deniedClose: accountingUser(["finance.cash_register.close"], ["finance.cash_register.close"], "finance"),
      deniedRead: accountingUser(["reports.financial.read"], ["reports.financial.read"]),
    });

    expect(result.closer).toMatchObject({ allowed: true, action: "closing" });
    expect(result.closer.message).toContain("BROUILLON LOCAL");
    for (const answer of [result.reader, result.deniedClose, result.deniedRead]) expect(answer).toMatchObject({ refusal: true });
  });

  test("ne révèle aucun journal global au Parent, Gardien ou contrôleur des frais", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    const result = await page.evaluate(({ parent, guard, controller }) => {
      const api = (window as any).SchoolSafeAccountingTreasury;
      return {
        parent: api.answerJaspe("Montre le journal global et les montants", { activeRole: "parent", user: parent }),
        guard: api.answerJaspe("Montre le journal global et la caisse", { activeRole: "guard", user: guard }),
        controller: api.answerJaspe("Montre le journal comptable et la caisse", { activeRole: "finance", user: controller }),
      };
    }, {
      parent: accountingUser([], [], "parent"),
      guard: accountingUser([], [], "guard"),
      controller: {
        role: "finance",
        permissions: ["safe.assistant.use", "finance.control.scan"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "finance.control.scan", type: "assigned_classes", classIds: ["demo-class-1"] },
        ],
      },
    });

    for (const answer of [result.parent, result.guard, result.controller]) {
      expect(answer).toMatchObject({ refusal: true });
      expect(answer.message).not.toMatch(/450[\s.]?000|350[\s.]?000/);
    }
  });

  test("route Jaspe vers la trésorerie Comptabilité avec les permissions réelles", async ({ page }) => {
    await enterDemoWorkspace(page, "accountant");
    const bubble = await askGlobalJaspe(page, "Explique la trésorerie CDF par devise");
    await expect(bubble).toContainText("AUCUNE CONVERSION");
    await expect(page.locator("#accountingModule")).toBeVisible();
    await expect(page.locator("[data-accounting-treasury]")).toBeVisible();
  });

  test("reste lisible à 390, 834 et 1440 en clair et bleu nuit sans overflow", async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name === "chromium-mobile", "La matrice redimensionnable s’exécute sur desktop.");
    await enterDemoWorkspace(page, "accountant");
    await openAction(page, "Journal comptable");
    await page.locator('[data-accounting-open="journal"]').click();
    await askGlobalJaspe(page, "Explique le journal de trésorerie");

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      for (const viewport of [{ width: 390, height: 844 }, { width: 834, height: 1112 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const visible = (node: Element) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const insideScroller = (node: Element) => {
            let parent = node.parentElement;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if ((style.overflowX === "auto" || style.overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true;
              parent = parent.parentElement;
            }
            return false;
          };
          const overflow = Array.from(document.querySelectorAll("#accountingModule *, .safe-assistant *"))
            .filter(visible)
            .filter((node) => !insideScroller(node))
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
            })
            .map((node) => ({ tag: node.tagName, className: (node as HTMLElement).className }));
          const shortButtons = Array.from(document.querySelectorAll("#accountingModule button, .safe-assistant button"))
            .filter(visible)
            .filter((node) => node.getBoundingClientRect().height < 43.5)
            .map((node) => ({ text: (node.textContent || "").trim(), height: node.getBoundingClientRect().height }));
          return { overflow, shortButtons, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
        });
        expect(layout, `${theme} ${viewport.width}px`).toEqual({ overflow: [], shortButtons: [], bodyOverflow: false });
      }
    }
  });
});
