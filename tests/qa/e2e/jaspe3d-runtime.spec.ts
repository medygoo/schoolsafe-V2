import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { enterDemoWorkspace } from "./helpers";

const ROOT = process.cwd();
const EXPECTED_SHA256 = "38d6d8f391c6a6eb0a8b53870eda9959040e4df2080e6cda43f78d00c163a515";
const EXPECTED_ACTIONS = [
  "Idle",
  "Wave",
  "TalkHandsOpen",
  "TalkPassionately",
  "Shrug",
  "Listening",
  "FormalBow",
  "Agree",
];

function absolute(relative: string) {
  return path.resolve(ROOT, relative);
}

test.describe("JASPE 3D — runtime isolé", () => {
  test("embarque l’unique GLB validé et Three.js 0.185.1 en local", () => {
    const modelPath = absolute("app/assets/jaspe3d/jaspe-web-v2.glb");
    expect(existsSync(modelPath)).toBe(true);
    expect(createHash("sha256").update(readFileSync(modelPath)).digest("hex")).toBe(EXPECTED_SHA256);

    for (const relative of [
      "app/vendor/three/LICENSE",
      "app/vendor/three/three.core.js",
      "app/vendor/three/three.module.js",
      "app/vendor/three/addons/loaders/GLTFLoader.js",
      "app/vendor/three/addons/utils/BufferGeometryUtils.js",
      "app/vendor/three/addons/utils/SkeletonUtils.js",
    ]) {
      expect(existsSync(absolute(relative)), `${relative} présent`).toBe(true);
    }

    const index = readFileSync(absolute("app/index.html"), "utf8");
    expect(index).toContain('"three": "./vendor/three/three.module.js"');
    expect(index).toContain('"three/addons/": "./vendor/three/addons/"');
    expect(index).not.toMatch(/https?:\/\/[^"']*three/i);
  });

  test("charge une seule scène, valide les huit clips et lance Idle", async ({ page }) => {
    let modelRequests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/assets/jaspe3d/jaspe-web-v2.glb")) modelRequests += 1;
    });

    await enterDemoWorkspace(page, "admin");
    await page.waitForFunction(() => {
      const diagnostics = (window as any).__SCHOOLSAFE_JASPE3D__;
      return diagnostics?.loaded === true || diagnostics?.errors?.length > 0;
    });

    const diagnostics = await page.evaluate(() => (window as any).__SCHOOLSAFE_JASPE3D__);
    expect(diagnostics.errors).toEqual([]);
    expect(diagnostics.loaded).toBe(true);
    expect(diagnostics.threeVersion).toBe("185");
    expect([...diagnostics.clipNames].sort()).toEqual([...EXPECTED_ACTIONS].sort());
    expect(diagnostics.currentAction).toBe("Idle");
    expect(diagnostics.instanceCount).toBe(1);
    expect(modelRequests).toBe(1);
    await expect(page.locator(".safe-3d-stage canvas")).toHaveCount(1);
  });
});
