// SchoolSafe V2 — Playwright E2E helpers for profile scenarios
// The PWA preview has no data-testid attributes, so we rely on stable IDs,
// data-action attributes and ARIA labels already present in app/index.html.

const { expect } = require("@playwright/test");

const ROLE_LABELS = {
  admin: "Administrateur principal",
  school_head: "Chef d’établissement",
  teacher: "Enseignant",
  cashier: "Agent de caisse",
  guard: "Agent de contrôle d’accès",
  parent: "Parent ou responsable légal",
};

const BRANCHES_BY_ROLE = {
  // Administration branch is hidden in demo mode when no live session has school.manage/staff.manage.
  admin: ["pilotage", "school", "people", "pedagogy", "security", "finance", "accounting", "communication", "reports"],
  school_head: ["pilotage", "school", "pedagogy", "security", "finance", "reports"],
  teacher: ["pedagogy", "communication"],
  cashier: ["finance"],
  guard: ["security"],
  parent: ["school", "finance", "communication"],
};

async function domClick(page, selector) {
  // Bypass CSS-animation stability checks that can block Playwright clicks
  // on elements inside animated screens (splash, workspace transitions).
  await page.locator(selector).evaluate((element) => element.click());
}

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

async function enterDemoWorkspace(page, role) {
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
    return route.continue();
  });
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

async function expectBranches(page, role) {
  const expected = BRANCHES_BY_ROLE[role];
  for (const key of expected) {
    await expect(page.locator(`#branch-${key}`)).toBeVisible();
  }
  return expected;
}

async function expectNoBranch(page, branchKey) {
  await expect(page.locator(`#branch-${branchKey}`)).toHaveCount(0);
}

async function openAction(page, actionName) {
  const button = page.locator(`[data-action="${actionName}"]`).first();
  await expect(button).toBeVisible();
  await button.evaluate((element) => element.click());
}

async function closeWorkspace(page) {
  await domClick(page, "#workspaceBack");
  await expect(page.locator("#auth.active")).toBeVisible();
}

module.exports = {
  ROLE_LABELS,
  BRANCHES_BY_ROLE,
  enterDemoWorkspace,
  expectBranches,
  expectNoBranch,
  openAction,
  closeWorkspace,
  domClick,
};
