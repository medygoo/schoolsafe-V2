import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { enterDemoWorkspace } from "./helpers";

const repoRoot = path.resolve(process.cwd());
const phaseI = "f06ff2b13b5fa30d8064fd7c16a5afd3a56d26df";
const protectedPaths = [
  "app/modules/cards",
  "app/modules/school/student-card-preparation-demo.js",
  "app/styles/modules/student-card-preparation.css",
  "docs/CARDS_IMMUTABILITY.md",
];

test.describe("J5 — Contrat cartes SchoolSafe", () => {
  test("conserve tous les fichiers cartes bit pour bit depuis Phase I", async () => {
    const changed = execFileSync("git", ["diff", "--name-only", phaseI, "--", ...protectedPaths], { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(changed).toBe("");
  });

  test("expose uniquement un adaptateur d’aperçu vers la préparation existante", async ({ page }) => {
    await enterDemoWorkspace(page, "admin");
    const card = await page.evaluate(() => (window as any).SchoolSafeDocumentCenter.listRegistered()
      .find((item: any) => item.id === "school-card-preparation"));
    expect(card).toMatchObject({
      type: "student-card-preparation",
      permission: "security.card.create",
      scope: "school",
      formats: ["png"],
      actions: ["preview"],
      authority: "preview",
    });
    expect(card.officialBoundary).toContain("BACKEND_LATER");
    expect(card.officialBoundary).toContain("Safe Control");
  });
});
