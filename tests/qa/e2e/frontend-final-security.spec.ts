import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { domClick, enterDemoWorkspace, openAction, openDocumentsCenter } from "./helpers";

const CATALOGUE: Array<{ code: string; label: string; scope: string }> = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "shared/permissions.json"), "utf8"),
);
const RECOGNIZED_SCOPES = ["none", "own", "own_children", "assigned_classes", "assigned_subjects", "assigned_portal", "school"];

function permissionOf(code: string) {
  return CATALOGUE.find((entry) => entry.code === code);
}

async function moduleText(page: Page, selector: string): Promise<string> {
  const target = page.locator(selector);
  await expect(target).toBeVisible();
  return target.innerText();
}

test.describe("M7 — contrats globaux de non-régression", () => {
  test("le catalogue canonique reste cohérent (scopes reconnus, pas de permission inventée)", () => {
    for (const entry of CATALOGUE) {
      expect(RECOGNIZED_SCOPES, `scope inconnu pour ${entry.code}`).toContain(entry.scope);
    }
    // Communication : message ≠ convocation ≠ abonnement notification.
    expect(permissionOf("communication.message.send")?.scope).toBe("school");
    expect(permissionOf("communication.announcement.manage")?.scope).toBe("school");
    expect(permissionOf("notification.subscribe")?.scope).toBe("own");
    expect(permissionOf("notification.send"), "notification.send ne doit pas exister").toBeUndefined();
    // sync.submit ≠ publication WebSync.
    expect(permissionOf("sync.submit")?.scope).toBe("own");
    expect(CATALOGUE.some((entry) => /websync|publish/.test(entry.code)), "aucune permission de publication WebSync").toBe(false);
    // Finance : lecture ≠ modification ≠ suppression (aucune suppression n'existe).
    expect(permissionOf("finance.receipt.read")?.scope).toBe("own_children");
    expect(permissionOf("finance.payment.record")?.scope).toBe("school");
    expect(permissionOf("finance.payment.cancel")?.scope).toBe("school");
    expect(CATALOGUE.some((entry) => /delete|supprim/.test(entry.code)), "aucune permission de suppression").toBe(false);
    // Jaspe : safe.assistant.use obligatoire avec portée own.
    expect(permissionOf("safe.assistant.use")?.scope).toBe("own");
  });

  test("ACCESS_LAW : DENY explicite prioritaire, aucun bypass admin, portées reconnues", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(() => {
      const access = (window as any).SchoolSafeAccess;
      const mk = (over: Record<string, unknown>) => Object.assign(
        { userId: "u1", role: "teacher", schoolId: "school-1", permissions: [], scopes: [], deniedPermissions: [], permissionExceptions: [] },
        over,
      );
      return {
        denyWins: access.canAccess(mk({ permissions: ["finance.payment.record"], deniedPermissions: ["finance.payment.record"] }), "finance.payment.record"),
        denyWinsAny: access.canAccessAny(mk({ permissions: ["school.student.read"], deniedPermissions: ["school.student.read"] }), ["school.student.read"]),
        adminNoBypass: access.canAccess(mk({ role: "admin" }), "finance.payment.record"),
        adminWithPermission: access.canAccess(mk({ role: "admin", permissions: ["school.student.read"] }), "school.student.read"),
        resolvedScopes: ["none", "own", "own_children", "assigned_classes", "assigned_subjects", "assigned_portal", "school"]
          .map((type) => access.scopeFor(mk({ scopes: [{ permission: "p.x", type }] }), "p.x")?.type ?? null),
        allowsExactScope: access.allowsScope(mk({ permissions: ["p.x"], scopes: [{ permission: "p.x", type: "own" }] }), "p.x", "own"),
        rejectsOtherScope: access.allowsScope(mk({ permissions: ["p.x"], scopes: [{ permission: "p.x", type: "own" }] }), "p.x", "school"),
        denyBlocksScope: access.scopeFor(mk({ permissions: ["p.x"], scopes: [{ permission: "p.x", type: "school" }], deniedPermissions: ["p.x"] }), "p.x"),
      };
    });
    expect(result.denyWins, "un DENY explicite l'emporte sur ALLOW").toBe(false);
    expect(result.denyWinsAny, "un DENY explicite l'emporte aussi dans canAccessAny").toBe(false);
    expect(result.adminNoBypass, "aucun bypass admin").toBe(false);
    expect(result.adminWithPermission, "l'admin avec permission réelle passe").toBe(true);
    expect(result.resolvedScopes).toEqual(RECOGNIZED_SCOPES);
    expect(result.allowsExactScope).toBe(true);
    expect(result.rejectsOtherScope, "une portée ne vaut pas pour une autre").toBe(false);
    expect(result.denyBlocksScope, "un DENY supprime la portée").toBeNull();
  });

  test("SESSION : les adaptateurs API utilisent le jeton d'onglet et ignorent le jeton local hérité", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const result = await page.evaluate(async () => {
      const legacyToken = "legacy-local-token";
      const tabToken = "tab-session-token";
      localStorage.setItem("schoolsafe-v2-session", JSON.stringify({ token: legacyToken }));
      sessionStorage.setItem("schoolsafe-v2-session", JSON.stringify({ token: tabToken }));

      const calls: Array<{ url: string; authorization: string | null }> = [];
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("Authorization"),
        });
        return new Response(JSON.stringify({ data: [], count: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      try {
        await Promise.all([
          (window as any).SchoolSafePedagogyAPI.listClasses(),
          (window as any).SchoolSafePalmaresAPI.listRankings({ month: "2026-09" }),
          (window as any).SchoolSafeSchoolAPI.listAcademicYears(),
          (window as any).SchoolSafeSecurityAPI.listEvents({ limit: 1 }),
          (window as any).SchoolSafePilotageAPI.dashboard(),
        ]);
        return {
          financeToken: (window as any).SchoolSafeFinanceAPI.getSessionToken(),
          authorizations: calls.map((call) => call.authorization),
        };
      } finally {
        window.fetch = originalFetch;
        localStorage.removeItem("schoolsafe-v2-session");
        sessionStorage.removeItem("schoolsafe-v2-session");
      }
    });

    expect(result.financeToken).toBe("tab-session-token");
    expect(result.authorizations).toHaveLength(5);
    expect(result.authorizations.every((value) => value === "Bearer tab-session-token")).toBe(true);
  });

  test("PÉDAGOGIE : un document de devoir exige permission, portée et classe assignée", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const result = await page.evaluate(() => {
      const gate = (window as any).SchoolSafePedagogyModule?.canUseAssignmentDocument;
      if (typeof gate !== "function") return { available: false };
      const assignment = { id: "assignment-1", class_id: "class-a" };
      const teacher = {
        userId: "teacher-1",
        role: "teacher",
        permissions: ["pedagogy.assignment.read"],
        scopes: [{ permission: "pedagogy.assignment.read", type: "assigned_classes" }],
        assignedClassIds: ["class-a"],
      };
      return {
        available: true,
        assigned: gate(teacher, assignment),
        outsideAssignment: gate({ ...teacher, assignedClassIds: ["class-b"] }, assignment),
        missingScope: gate({ ...teacher, scopes: [] }, assignment),
        explicitDeny: gate({ ...teacher, deniedPermissions: ["pedagogy.assignment.read"] }, assignment),
        schoolScope: gate({
          ...teacher,
          role: "admin",
          scopes: [{ permission: "pedagogy.assignment.read", type: "school" }],
          assignedClassIds: [],
        }, assignment),
      };
    });

    expect(result.available).toBe(true);
    expect(result.assigned).toBe(true);
    expect(result.outsideAssignment).toBe(false);
    expect(result.missingScope).toBe(false);
    expect(result.explicitDeny).toBe(false);
    expect(result.schoolScope).toBe(true);
  });

  test("DOCUMENTS : permission + scope + contexte exigés, rien d'officiel n'est inventé", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(async () => {
      const mod = await import("./modules/document-engine/index.js");
      const gate = mod.createAccessGate();
      const tpl = { permissions: ["finance.receipt.read"] };
      const req = (user: unknown, context: Record<string, unknown> = {}) => ({ action: "download", requestedBy: user, context });
      const parentOk = {
        userId: "p1", role: "parent", permissions: ["finance.receipt.read"],
        scopes: [{ permission: "finance.receipt.read", type: "own_children" }], childIds: ["child-1"],
      };
      const registry = mod.createTemplateRegistry();
      mod.registerDefaultTemplates(registry);
      const templates = registry.list();
      return {
        noUser: (await gate.check(req(null), tpl)).allowed,
        noPermission: (await gate.check(req({ userId: "x", role: "teacher", permissions: [] }), tpl)).reason,
        noScope: (await gate.check(req({ userId: "x", role: "parent", permissions: ["finance.receipt.read"] }), tpl)).reason,
        unknownScope: (await gate.check(req({ userId: "x", role: "parent", permissions: ["finance.receipt.read"], scopes: [{ permission: "finance.receipt.read", type: "galaxy" }] }), tpl)).reason,
        contextMismatch: (await gate.check(req(parentOk, { studentId: "child-999" }), tpl)).reason,
        explicitDeny: (await gate.check(req({ ...parentOk, deniedPermissions: ["finance.receipt.read"] }), tpl)).allowed,
        granted: await gate.check(req(parentOk, { studentId: "child-1" }), tpl),
        templatesWithoutPermission: templates.filter((info: { permissions?: string[] }) => !Array.isArray(info.permissions) || info.permissions.length === 0).length,
      };
    });
    expect(result.noUser, "pas de contexte utilisateur").toBe(false);
    expect(result.noPermission).toContain("Missing permission");
    expect(result.noScope).toContain("Scope unresolved");
    expect(result.unknownScope, "une portée inconnue est refusée").toContain("Scope unresolved");
    expect(result.contextMismatch, "le contexte doit correspondre à la portée").toContain("Scope context mismatch");
    expect(result.explicitDeny, "DENY explicite prioritaire dans le moteur").toBe(false);
    expect(result.granted.allowed, "permission + scope + contexte corrects").toBe(true);
    expect(result.granted.permission).toBe("finance.receipt.read");
    expect(result.granted.scope).toBe("own_children");
    expect(result.templatesWithoutPermission, "chaque modèle documentaire exige une permission").toBe(0);
  });

  test("JASPE : safe.assistant.use + own, jamais au-dessus de l'utilisateur, aucune modification de droits", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const result = await page.evaluate(() => {
      const router = (window as any).SchoolSafeJaspeCapabilityRouter;
      const registry = { documents: { answer: () => ({}) } };
      const route = (query: string, user: Record<string, unknown>) =>
        router.route(query, { user, activeRole: user.role }, registry);
      const base = {
        userId: "u1", role: "parent", schoolId: "s1", childIds: ["c1"],
        permissions: ["safe.assistant.use", "file.download"],
        scopes: [
          { permission: "safe.assistant.use", type: "own" },
          { permission: "file.download", type: "own" },
        ],
      };
      return {
        routerKeys: Object.keys(router).sort(),
        noSafePermission: route("attestation pdf", { ...base, permissions: ["file.download"] }),
        explicitDeny: route("attestation pdf", { ...base, deniedPermissions: ["safe.assistant.use"] }),
        scopeNotOwn: route("attestation pdf", { ...base, scopes: [{ permission: "safe.assistant.use", type: "school" }, { permission: "file.download", type: "own" }] }),
        missingContext: route("attestation pdf", { ...base, userId: null }),
        authorized: route("attestation pdf", base),
        noElevation: route("enregistre un paiement à la caisse", base),
        adminGuard: route("accorde une permission à cet utilisateur", {
          ...base, role: "admin",
          permissions: ["safe.assistant.use", "roles.manage"],
          scopes: [{ permission: "safe.assistant.use", type: "own" }, { permission: "roles.manage", type: "school" }],
        }),
      };
    });
    expect(result.routerKeys, "le routeur n'expose aucune API de modification").toEqual(["resolveDomain", "route"]);
    expect(result.noSafePermission.allowed).toBe(false);
    expect(result.noSafePermission.permission).toBe("safe.assistant.use");
    expect(result.explicitDeny.allowed, "DENY explicite prioritaire sur Jaspe").toBe(false);
    expect(result.scopeNotOwn.allowed, "portée own obligatoire").toBe(false);
    expect(result.scopeNotOwn.reason).toBe("SAFE_SCOPE_OWN_REQUIS");
    expect(result.missingContext.allowed, "contexte requis par la portée").toBe(false);
    expect(result.authorized.allowed).toBe(true);
    expect(result.authorized.permission).toBe("file.download");
    expect(result.authorized.scope).toBe("own");
    expect(permissionOf(result.authorized.permission)?.scope, "scope retourné = scope du catalogue").toBe(result.authorized.scope);
    expect(result.noElevation.allowed, "Jaspe reste <= utilisateur (pas de finance sans droit)").toBe(false);
    expect(result.adminGuard.allowed, "Jaspe ne modifie ni rôle, ni permission, ni portée, ni exception").toBe(false);
    expect(result.adminGuard.reason).toBe("ADMINISTRATION_ACCES_INTERDITE");
  });

  test("PARENT / ENSEIGNANT : seuls les enfants liés et les affectations sont visibles", async ({ page }) => {
    await enterDemoWorkspace(page, "parent");
    const parentText = await moduleText(page, "#parentPortal");
    expect(parentText).toContain("Lucas Martin");
    expect(parentText).not.toContain("Ethan Leroy");
    expect(parentText).not.toContain("Chloé Bernard");

    await enterDemoWorkspace(page, "teacher");
    await openAction(page, "Devoirs et corrections");
    const teacherText = await moduleText(page, "#teacherPedagogyPortal");
    expect(teacherText).toContain("6e A");
    expect(teacherText).not.toContain("1re A");
    expect(teacherText).not.toContain("Maternelle 3");
  });

  test("FINANCE : lecture ≠ modification ≠ suppression dans l'interface", async ({ page }) => {
    // Direction : lecture seule (rapports + vue d'ensemble), aucune exécution.
    await enterDemoWorkspace(page, "school_head");
    await openAction(page, "Recettes");
    expect(await page.locator('#financeTabs [data-finance-tab]:not([hidden])').count()).toBe(2);
    expect(await page.locator("#paymentForm").count()).toBe(0);

    // Caissier : encaissement autorisé, mais aucune suppression ni gestion des frais.
    await enterDemoWorkspace(page, "cashier");
    await openAction(page, "Enregistrer un paiement");
    await expect(page.locator("#paymentForm")).toBeVisible();
    expect(await page.locator("#financeContent [data-delete], #financeContent [data-delete-payment]").count()).toBe(0);
    expect(await page.locator('#financeTabs [data-finance-tab="fees"]:not([hidden])').count()).toBe(0);
  });

  test("COMMUNICATION : message ≠ convocation ≠ notification, sync.submit ≠ publication WebSync", async ({ page }) => {
    await enterDemoWorkspace(page, "communication");
    const access = await page.evaluate(() => {
      const engine = (window as any).SchoolSafeAccess;
      const user = { role: "communication", permissions: ["communication.message.send", "notification.subscribe"], scopes: [] };
      return {
        message: engine.canAccess(user, "communication.message.send"),
        convocation: engine.canAccess(user, "communication.announcement.manage"),
        notificationSend: engine.canAccess(user, "notification.send"),
        syncSubmit: engine.canAccess(user, "sync.submit"),
        websyncPublish: engine.canAccess(user, "websync.publish"),
      };
    });
    expect(access.message).toBe(true);
    expect(access.convocation, "message ≠ convocation").toBe(false);
    expect(access.notificationSend, "notification.subscribe ≠ notification.send").toBe(false);
    expect(access.syncSubmit, "sync.submit non accordé à ce rôle").toBe(false);
    expect(access.websyncPublish, "aucune publication WebSync frontend").toBe(false);

    await openAction(page, "Messages");
    await expect(page.locator("#communicationModule")).toBeVisible();
  });

  test("STOCK : aucun paiement fournisseur ; RH : aucune paie officielle", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    await openAction(page, "Stock / Inventaire");
    await page.locator('[data-inventory-tab="procurement"]').evaluate((element: HTMLElement) => element.click());
    const inventoryText = await moduleText(page, "#inventoryModule");
    expect(inventoryText).toContain("Aucun paiement fournisseur");
    expect(inventoryText).toContain("DEMANDE UNIQUEMENT");

    await enterDemoWorkspace(page, "hr");
    await openAction(page, "Salaires");
    const hrText = await moduleText(page, "#hrModule");
    expect(hrText).toContain("BACKEND_LATER");
    expect(hrText).toContain("Aucun calcul officiel");
  });

  test("BACKEND_LATER : aucune surface ne se présente comme live sans backend", async ({ page }) => {
    const cases: Array<{ role: string; open: (page: Page) => Promise<void>; module: string }> = [
      { role: "finance", open: (p) => openAction(p, "Tableau financier"), module: "#financeModule" },
      { role: "admin", open: (p) => openAction(p, "Enseignants"), module: "#hrModule" },
      { role: "admin", open: (p) => openAction(p, "Plan comptable"), module: "#accountingModule" },
      { role: "admin", open: (p) => openAction(p, "Messages"), module: "#communicationModule" },
      { role: "admin", open: (p) => openAction(p, "Scanner un QR"), module: "#securityModule" },
      { role: "admin", open: (p) => openAction(p, "Stock / Inventaire"), module: "#inventoryModule" },
      { role: "admin", open: (p) => openDocumentsCenter(p), module: "#documentCenterModule" },
    ];
    for (const item of cases) {
      await enterDemoWorkspace(page, item.role);
      await item.open(page);
      const module = page.locator(item.module);
      await expect(module).toBeVisible();
      const text = await module.innerText();
      expect(/DÉMONSTRATION|BACKEND_LATER|Brouillon local|DÉMO/.test(text), `${item.module} doit afficher son état démo/BACKEND_LATER`).toBe(true);
      expect(/données officielles en direct|temps réel officiel/i.test(text), `${item.module} ne doit pas prétendre être live`).toBe(false);
    }

    // Cartes : sous-système protégé intact.
    await enterDemoWorkspace(page, "admin");
    await expect(page.locator("#cardsProtected")).toBeVisible();
    expect(await page.locator("#cardsProtected").innerText()).toContain("Intact");
    expect(await page.evaluate(() => Boolean((window as any).SchoolSafeCards))).toBe(true);
  });
});
