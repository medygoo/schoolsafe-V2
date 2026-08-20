// SchoolSafe V2 — Playwright E2E helpers for profile scenarios
// The PWA preview has no data-testid attributes, so we rely on stable IDs,
// data-action attributes and ARIA labels already present in app/index.html.

import { expect, Page } from "@playwright/test";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur principal",
  school_head: "Chef d’établissement",
  teacher: "Enseignant",
  cashier: "Agent de caisse",
  guard: "Agent de contrôle d’accès",
  parent: "Parent ou responsable légal",
};

export const BRANCHES_BY_ROLE: Record<string, string[]> = {
  // Administration branch is hidden in demo mode when no live session has school.manage/staff.manage.
  admin: ["pilotage", "school", "people", "pedagogy", "security", "finance", "accounting", "communication", "reports"],
  school_head: ["pilotage", "school", "pedagogy", "security", "finance", "reports"],
  teacher: ["pedagogy", "communication"],
  cashier: ["finance"],
  guard: ["security"],
  parent: ["school", "finance", "communication"],
};

const DEMO_PENDING_STUDENT_FEE = {
  id: "sf-demo-lucas",
  student_id: "demo-s1",
  students: {
    first_name: "Lucas",
    last_name: "Martin",
    gender: "M",
    class_name: "6e A",
    guardian_name: "Mme Sophie Martin",
  },
  class_name: "6e A",
  guardian_name: "Mme Sophie Martin",
  amount_expected: 450000,
  amount_paid: 350000,
  amount_remaining: 100000,
  status: "pending",
  currency: "CDF",
};

const DEMO_DASHBOARD = {
  data: {
    date: "Aujourd’hui",
    kpis: [
      { code: "Présence", value: "94 %", unit: "élèves" },
      { code: "Filles", value: "648", unit: "élèves" },
      { code: "Garçons", value: "597", unit: "élèves" },
    ],
    latest_alerts: [],
    lockdown_active: false,
  },
};

const DEMO_ALERTS = {
  data: [],
  count: 0,
};

const DEMO_SCAN_RESULT = {
  data: {
    decision: "allowed",
    student: {
      first_name: "Lucas",
      last_name: "Martin",
      matricule: "MAT-001",
      class_name: "6e A",
    },
    authorized_persons: [],
    reason: "Scan de démonstration",
  },
};

async function setupRoutes(page: Page) {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("cdnjs.cloudflare.com")) {
      return route.abort("aborted");
    }
    if (url.includes("/pedagogy/pedagogy-module.js")) {
      // The loaded module does not support the static demo data used by app.js.
      // Block it so the richer app.js fallback renders assignments and certifications.
      return route.abort("aborted");
    }
    if (url.includes("/finance/student-fees?status=pending")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [DEMO_PENDING_STUDENT_FEE] }) });
    }
    if (url.includes("/finance/student-fees?status=partial")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
    }
    if (url.includes("/pilotage/dashboard")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEMO_DASHBOARD) });
    }
    if (url.includes("/pilotage/alerts?")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEMO_ALERTS) });
    }
    if (url.includes("/security/scan")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEMO_SCAN_RESULT) });
    }
    return route.continue();
  });
}

export async function domClick(page: Page, selector: string) {
  // Bypass CSS-animation stability checks that can block Playwright clicks
  // on elements inside animated screens (splash, workspace transitions).
  await page.locator(selector).evaluate((element: HTMLElement) => element.click());
}

export async function enterDemoWorkspace(page: Page, role: string) {
  await setupRoutes(page);
  await page.goto("/", { waitUntil: "load" });
  await domClick(page, "#enterSplash");
  await expect(page.locator("#guardian.active")).toBeVisible();
  await domClick(page, "#continueGuardian");
  await expect(page.locator("#auth.active")).toBeVisible();
  await page.locator("#demoRole").selectOption(role);
  await domClick(page, "#previewWorkspace");
  await expect(page.locator("#workspace.active")).toBeVisible();
  await expect(page.locator("#workspaceRole")).toHaveText(ROLE_LABELS[role]);
}

export async function expectBranches(page: Page, role: string) {
  const expected = BRANCHES_BY_ROLE[role];
  for (const key of expected) {
    await expect(page.locator(`#branch-${key}`)).toBeVisible();
  }
  return expected;
}

export async function expectNoBranch(page: Page, branchKey: string) {
  await expect(page.locator(`#branch-${branchKey}`)).toHaveCount(0);
}

export async function openAction(page: Page, actionName: string) {
  const button = page.locator(`[data-action="${actionName}"]`).first();
  await expect(button).toBeVisible();
  await button.evaluate((element: HTMLElement) => element.click());
}

export async function closeWorkspace(page: Page) {
  await domClick(page, "#workspaceBack");
  await expect(page.locator("#auth.active")).toBeVisible();
}

export async function openPermissionsConsole(page: Page) {
  // On mobile the workspace sidebar is collapsed; open it first.
  const cubeMenu = page.locator("#cubeMenu");
  if (await cubeMenu.isVisible().catch(() => false)) {
    await cubeMenu.evaluate((element: HTMLElement) => element.click());
  }
  await page.locator("#permissionsNav").evaluate((element: HTMLElement) => element.click());
}
