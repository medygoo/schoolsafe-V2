// SchoolSafe V2 — Playwright E2E helpers for profile scenarios
// The PWA preview has no data-testid attributes, so we rely on stable IDs,
// data-action attributes and ARIA labels already present in app/index.html.

import { expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const CANONICAL_PERMISSIONS = readFileSync(path.resolve(process.cwd(), "shared/permissions.json"), "utf8");

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur principal",
  school_head: "Chef d’établissement",
  pedagogy: "Responsable pédagogique",
  admissions: "Responsable administratif et admissions",
  secretary: "Secrétaire scolaire",
  finance: "Responsable financier",
  cashier: "Agent de caisse",
  accountant: "Comptable",
  hr: "Responsable RH",
  teacher: "Enseignant",
  guard: "Agent de contrôle d’accès",
  nurse: "Infirmier",
  canteen: "Responsable cantine",
  communication: "Responsable communication et site",
  parent: "Parent ou responsable légal",
};

export const BRANCHES_BY_ROLE: Record<string, string[]> = {
  // Administration branch is hidden in demo mode when no live session has school.manage/staff.manage.
  admin: ["pilotage", "school", "people", "pedagogy", "security", "finance", "accounting", "communication", "reports"],
  school_head: ["pilotage", "school", "pedagogy", "security", "finance", "reports"],
  pedagogy: ["pedagogy", "finance", "reports"],
  admissions: ["school"],
  secretary: ["communication"],
  finance: ["finance", "accounting"],
  cashier: ["finance"],
  accountant: ["accounting"],
  hr: ["people"],
  teacher: ["school", "pedagogy", "communication"],
  guard: ["security"],
  nurse: ["care"],
  canteen: ["care"],
  communication: ["communication"],
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

const DEMO_STUDENTS = [
  {
    id: "demo-draft-student",
    matricule: "B1-0002",
    first_name: "Amina",
    last_name: "Mbuyi",
    lifecycle_status: "draft",
    class_id: null,
    enrollment: {
      status: "draft",
      academic_year_label: "2026-2027",
      planned_class_id: "demo-class-2",
      planned_class_name: "5e A",
      starts_on: "2026-09-01",
    },
    primary_parent: {
      id: "demo-parent-1",
      display_name: "Sarah Mbuyi",
      first_name: "Sarah",
      last_name: "Mbuyi",
      phone: "+243 810 000 111",
      email: "sarah.mbuyi@example.test",
      guardian_type: "mere",
      account_status: "pending_activation",
    },
  },
  {
    id: "demo-active-student",
    matricule: "B1-0001",
    first_name: "Lucas",
    last_name: "Martin",
    lifecycle_status: "active",
    class_id: "demo-class-1",
    enrollment: { status: "active", planned_class_id: "demo-class-1", planned_class_name: "6e A" },
    primary_parent: { id: "demo-parent-2", display_name: "Sophie Martin", account_status: "active" },
  },
];

async function setupRoutes(page: Page) {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("/shared/permissions.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: CANONICAL_PERMISSIONS });
    }
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
    if (url.includes("/school/settings")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          identity: { name: "École de démonstration", primary_color: "#071a3d", accent_color: "#e9a515" },
          contact: { country: "RDC", province: "Kinshasa", city: "Kinshasa" },
          brand: { primary_color: "#071a3d", accent_color: "#e9a515" },
          academic_years: [],
          cycles: [],
        }),
      });
    }
    if (/\/school\/students\/[^/]+$/.test(new URL(url).pathname)) {
      const studentId = new URL(url).pathname.split("/").pop();
      const student = DEMO_STUDENTS.find((item) => item.id === studentId);
      return route.fulfill({
        status: student ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(student || { code: "STUDENT_NOT_FOUND" }),
      });
    }
    if (url.includes("/school/students?") || /\/school\/students$/.test(new URL(url).pathname)) {
      const status = new URL(url).searchParams.get("status");
      const data = status ? DEMO_STUDENTS.filter((student) => student.lifecycle_status === status) : DEMO_STUDENTS;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }
    if (url.includes("/school/parents?")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "demo-parent-2", display_name: "Sophie Martin", account_status: "active" }]),
      });
    }
    if (url.includes("/school/academic-years")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "demo-year-1", label: "2026-2027", is_active: true }]),
      });
    }
    if (url.includes("/pedagogy/classes")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "demo-class-1", name: "6e A" }, { id: "demo-class-2", name: "5e A" }]),
      });
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
  await page.waitForFunction(() => Boolean((window as any).SchoolSafeDocumentContextReady));
  await page.evaluate(() => (window as any).SchoolSafeDocumentContextReady);
}

export async function expectBranches(page: Page, role: string) {
  const expected = BRANCHES_BY_ROLE[role];
  for (const key of expected) {
    await expect(page.locator(`[data-branch="${key}"]:visible`).first()).toBeVisible();
  }
  return expected;
}

export async function expectNoBranch(page: Page, branchKey: string) {
  await expect(page.locator(`[data-branch="${branchKey}"]:visible`)).toHaveCount(0);
}

export async function openAction(page: Page, actionName: string) {
  const button = page.locator(`[data-action="${actionName}"]:visible`).first();
  if (await button.count() === 0) {
    const hiddenAction = page.locator(`[data-action="${actionName}"]`).first();
    await expect(hiddenAction).toHaveCount(1);
    await hiddenAction.evaluate((element: HTMLElement) => element.click());
    return;
  }
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

export async function openDocumentsCenter(page: Page) {
  // Sur mobile, le Centre se trouve dans la sidebar ouverte depuis le menu bas.
  const mobileMenu = page.locator('[data-bottom-nav="menu"]');
  if (await mobileMenu.isVisible().catch(() => false)) {
    await domClick(page, '[data-bottom-nav="menu"]');
    await expect(page.locator("#workspaceSidebar.open")).toBeVisible();
  }
  await domClick(page, "#documentsNav");
  await expect(page.locator("#documentCenterModule")).toBeVisible();
  await page.evaluate(() => (window as any).SchoolSafeDocumentContextReady);
}
