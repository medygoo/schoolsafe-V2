import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { domClick, enterDemoWorkspace, openDocumentsCenter } from "./helpers";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.resolve(ROOT, relative), "utf8");
const normalizedSha256 = (relative: string) => createHash("sha256").update(read(relative).replace(/\r\n/g, "\n"), "utf8").digest("hex");

const ACCESS_LAW_HASHES = {
  "shared/permissions.json": "6cfa44ce804bc7fc22985a1ba6e3c8d4afe95b092ec1fa4ce29403fa1438373f",
  "app/modules/core/access.js": "319d5e5aab7545f186b5c57cb742cee1f72093e75dec2f70099b4b879ac7b0e7",
} as const;

const PHASE_SPECS = [
  "frontend-final-baseline.spec.ts",
  "frontend-final-navigation.spec.ts",
  "frontend-final-live-demo.spec.ts",
  "frontend-final-responsive.spec.ts",
  "frontend-final-legacy.spec.ts",
  "frontend-final-runtime.spec.ts",
  "frontend-domain-identities.spec.ts",
  "frontend-subfeature-harmony.spec.ts",
  "frontend-deep-visual-harmony.spec.ts",
  "frontend-executive-kpi.spec.ts",
  "frontend-final-security.spec.ts",
];

test.describe("M8 — gel final du frontend métier B à L", () => {
  test("publie un inventaire factuel sans permission inventée", () => {
    const inventory = read("docs/FRONTEND_BACKEND_LATER_INVENTORY.md");
    const catalogue: Array<{ code: string }> = JSON.parse(read("shared/permissions.json"));
    const canonicalCodes = new Set(catalogue.map((entry) => entry.code));

    for (const marker of ["BACKEND_LATER", "PERMISSION_FUTURE", "SAFE_CONTROL_LATER", "JASPE_3D_LATER"]) {
      expect(inventory, `marqueur ${marker}`).toContain(marker);
    }
    for (const domain of ["Élèves", "Parent / tuteur", "Pédagogie", "Sécurité", "Finance", "Comptabilité / trésorerie", "Personnel / RH", "Stock / inventaire / achats internes", "Documents", "Communication", "Administration", "Jaspe"]) {
      expect(inventory, `domaine ${domain}`).toContain(`## ${domain}`);
    }
    expect(inventory.match(/Modules? frontend sources? pour toutes les lignes ci-dessous/g)?.length).toBe(12);

    const documentedCodes = Array.from(inventory.matchAll(/`([^`]+)`/g), (match) => match[1])
      .filter((token) => /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+$/.test(token) && !/\.(?:css|js|json|md|ts)$/.test(token));
    expect(documentedCodes.length).toBeGreaterThan(20);
    for (const code of documentedCodes) expect(canonicalCodes.has(code), `${code} doit être canonique`).toBe(true);
    expect(inventory).toContain("code non défini");
    expect(inventory).toContain("ne définit ni API, ni table, ni permission");
  });

  test("verrouille Access_Law et les contrats QA déjà validés", () => {
    for (const [relative, expectedHash] of Object.entries(ACCESS_LAW_HASHES)) {
      expect(normalizedSha256(relative), `${relative} a changé`).toBe(expectedHash);
    }
    for (const spec of PHASE_SPECS) {
      expect(existsSync(path.resolve(ROOT, "tests/qa/e2e", spec)), `${spec} présent`).toBe(true);
    }

    const identity = read("app/styles/modules/domain-identity.css");
    for (const selector of [".school-module", ".parent-portal", ".teacher-pedagogy-portal", ".security-module", ".finance-module", ".accounting-module", ".hr-module", ".document-center-module", ".communication-module", ".administration-module", ".jaspe-card"]) {
      expect(identity, `identité ${selector}`).toContain(selector);
    }
    expect(identity, "les statuts universels restent hors des identités de domaine").not.toMatch(/\.ss-badge--/);
    expect(read("app/styles/modules/inventory.css")).toMatch(/linear-gradient/);

    const index = read("app/index.html");
    const deepStyles = [
      "deep-school-harmony.css",
      "deep-operations-harmony.css",
      "deep-governance-harmony.css",
    ];
    for (const style of deepStyles) {
      expect(index, `${style} chargé`).toContain(`./styles/modules/${style}`);
      expect(index.indexOf(style), `${style} chargé après domain-identity.css`).toBeGreaterThan(index.indexOf("domain-identity.css"));
    }
    for (const style of deepStyles) {
      const source = read(`app/styles/modules/${style}`);
      expect(source, `${style} conserve les statuts universels`).not.toMatch(/\.ss-badge--(?:success|danger|warning|info|neutral)/);
      expect(source, `${style} ne contient aucun rendu 3D`).not.toMatch(/three\.js|model-viewer|\.glb|\.fbx|\.obj/i);
    }
  });

  test("conserve B à L, la navigation finale et les Executive KPI", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const runtime = await page.evaluate(() => ({
      B: Boolean((window as any).SchoolSafeAcademicStructure),
      C: Boolean((window as any).SchoolSafeParentPortal),
      D: Boolean((window as any).SchoolSafeTeacherPedagogy),
      E: Boolean((window as any).SchoolSafeGuardSecurity),
      F: Boolean((window as any).SchoolSafeFinanceModule),
      G: Boolean((window as any).SchoolSafeAccountingTreasury),
      H: Boolean((window as any).SchoolSafeHrDemo),
      I: Boolean((window as any).SchoolSafeInventoryDemo),
      J: Boolean((window as any).SchoolSafeDocumentCenter),
      K: Boolean((window as any).SchoolSafeCommunication),
      L: Boolean((window as any).SchoolSafeAdministration && (window as any).SchoolSafeJaspeGovernance && (window as any).SchoolSafeJaspeCapabilityRouter),
    }));
    expect(runtime).toEqual({ B: true, C: true, D: true, E: true, F: true, G: true, H: true, I: true, J: true, K: true, L: true });

    for (const branch of ["school", "people", "pedagogy", "security", "finance", "accounting", "inventory", "communication", "administration"]) {
      await expect(page.locator(`button[data-branch="${branch}"]:visible`).first(), `navigation ${branch}`).toBeVisible();
    }
    await expect(page.locator("#documentsNav")).toBeVisible();
    await expect(page.locator("#dashboardKpi .kpi-card--executive")).toHaveCount(6);
    await expect(page.locator("#dashboardKpi")).toContainText("DÉMONSTRATION");
  });

  test("maintient la séparation live / démo et un BACKEND_LATER explicite", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    const demoPortal = page.locator("#parentPortal");
    await expect(demoPortal).toContainText("Lucas Martin");
    await expect(demoPortal).toContainText("DÉMONSTRATION");

    await page.evaluate(() => {
      (window as any).SchoolSafeParentPortal.render("parentPortal", {
        token: "m8-live-token",
        permissions: ["school.student.read"],
        scopes: [{ permission: "school.student.read", type: "own_children" }],
        childIds: ["demo-parent-child-lucas"],
      });
    });
    await expect(demoPortal).toContainText("DONNÉES INDISPONIBLES");
    await expect(demoPortal).toContainText("BACKEND_LATER");
    await expect(demoPortal).not.toContainText("Lucas Martin");
  });

  test("confirme DENY prioritaire, aucun bypass admin et Jaspe <= utilisateur", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(() => {
      const access = (window as any).SchoolSafeAccess;
      const router = (window as any).SchoolSafeJaspeCapabilityRouter;
      const base = {
        userId: "m8-user",
        role: "admin",
        schoolId: "m8-school",
        permissions: ["safe.assistant.use", "file.download"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "file.download", type: "own" },
        ],
      };
      return {
        denyWins: access.canAccess({ ...base, permissions: ["finance.payment.record"], deniedPermissions: ["finance.payment.record"] }, "finance.payment.record"),
        adminNoBypass: access.canAccess({ role: "admin", permissions: [], scopes: [] }, "finance.payment.record"),
        jaspeOwn: router.route("attestation pdf", { user: base, activeRole: base.role }, { documents: { answer: () => ({}) } }),
        jaspeNoElevation: router.route("enregistre un paiement", { user: base, activeRole: base.role }, { finance: { answer: () => ({}) } }),
        jaspeDeny: router.route("attestation pdf", { user: { ...base, deniedPermissions: ["safe.assistant.use"] }, activeRole: base.role }, { documents: { answer: () => ({}) } }),
      };
    });
    expect(result.denyWins).toBe(false);
    expect(result.adminNoBypass).toBe(false);
    expect(result.jaspeOwn.allowed).toBe(true);
    expect(result.jaspeNoElevation.allowed).toBe(false);
    expect(result.jaspeDeny.allowed).toBe(false);
  });

  test("préserve Documents, Cartes, Splash et Guardian", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    expect(await page.locator("#particles .particle").count()).toBeGreaterThanOrEqual(12);
    await domClick(page, "#enterSplash");
    await expect(page.locator("#guardian.active")).toBeVisible();
    await expect(page.locator("#continueGuardian")).toBeVisible();

    await enterDemoWorkspace(page, "admin");
    await expect(page.locator("#cardsProtected")).toContainText("Intact");
    expect(await page.evaluate(() => Boolean((window as any).SchoolSafeCards))).toBe(true);
    await openDocumentsCenter(page);
    await expect(page.locator("#documentCenterModule")).toContainText("BACKEND_LATER");

    const gate = await page.evaluate(async () => {
      const documents = await import("./modules/document-engine/index.js");
      const accessGate = documents.createAccessGate();
      return accessGate.check(
        { action: "download", requestedBy: { userId: "m8-parent", permissions: [] }, context: { studentId: "child-1" } },
        { permissions: ["finance.receipt.read"] },
      );
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain("Missing permission");
  });
});
