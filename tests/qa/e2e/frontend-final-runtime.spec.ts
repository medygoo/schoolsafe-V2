import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve(process.cwd(), "app");
const CANONICAL_PERMISSIONS = readFileSync(path.resolve(process.cwd(), "shared/permissions.json"), "utf8");

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

function localHtmlReferences(html: string) {
  return Array.from(html.matchAll(/(?:src|href)=["'](\.\/[^"'?#]+)(?:[?#][^"']*)?["']/g), (match) => match[1]);
}

function moduleReferences(file: string, source: string) {
  const executableSource = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const references = [
    ...Array.from(executableSource.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1]),
    ...Array.from(executableSource.matchAll(/\bfrom\s+["']([^"']+)["']/g), (match) => match[1]),
  ];
  return references.filter((reference) => reference.startsWith(".")).map((reference) => path.resolve(path.dirname(file), reference));
}

test.describe("M6 — intégrité PWA, runtime et assets", () => {
  test("toutes les références frontend locales et imports dynamiques existent", () => {
    const index = readFileSync(path.join(APP_DIR, "index.html"), "utf8");
    const htmlAssets = localHtmlReferences(index).map((reference) => path.resolve(APP_DIR, reference));
    for (const asset of htmlAssets) expect(existsSync(asset), path.relative(APP_DIR, asset)).toBe(true);

    const scriptFiles = filesUnder(APP_DIR).filter((file) => file.endsWith(".js"));
    for (const file of scriptFiles) {
      const source = readFileSync(file, "utf8");
      for (const imported of moduleReferences(file, source)) {
        expect(existsSync(imported), `${path.relative(APP_DIR, file)} -> ${path.relative(APP_DIR, imported)}`).toBe(true);
      }
    }

    const manifest = JSON.parse(readFileSync(path.join(APP_DIR, "manifest.webmanifest"), "utf8"));
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) expect(existsSync(path.resolve(APP_DIR, icon.src))).toBe(true);
  });

  test("le service worker reste relatif, offline et sans connexion Push réelle", () => {
    const register = readFileSync(path.join(APP_DIR, "sw-register.js"), "utf8");
    const worker = readFileSync(path.join(APP_DIR, "sw.js"), "utf8");
    const application = readFileSync(path.join(APP_DIR, "app.js"), "utf8");
    const index = readFileSync(path.join(APP_DIR, "index.html"), "utf8");
    expect(register).toContain('.register("./sw.js"');
    expect(register).not.toMatch(/PushManager|Notification\.requestPermission|\/push\/|pushManager\.subscribe/);
    expect(worker).toMatch(/addEventListener\("install"/);
    expect(worker).toMatch(/addEventListener\("activate"/);
    expect(worker).toMatch(/addEventListener\("fetch"/);
    expect(worker).toMatch(/addEventListener\("sync"/);
    expect(worker).not.toMatch(/addEventListener\("push"|showNotification|notificationclick/);
    expect(worker).not.toMatch(/['"]\//);
    expect(application).toMatch(/addEventListener\("beforeinstallprompt"/);
    expect(application).toMatch(/addEventListener\("appinstalled"/);
    expect(index).toContain('id="installPwaButton"');
  });

  test("la première ouverture et le reload chargent les moteurs sans 404 locale", async ({ page }) => {
    const localFailures: string[] = [];
    const pageErrors: string[] = [];
    const unexpectedConsoleErrors: string[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === "http://127.0.0.1:4175" && response.status() >= 400 && ["document", "script", "stylesheet", "image", "font", "manifest"].includes(response.request().resourceType())) {
        localFailures.push(`${response.status()} ${url.pathname}`);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (!text.includes("ERR_NETWORK_ACCESS_DENIED")) unexpectedConsoleErrors.push(text);
    });
    await page.route("**/shared/permissions.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: CANONICAL_PERMISSIONS }),
    );
    await page.addInitScript(() => localStorage.setItem("ss-theme", "dark"));
    await page.goto("/?runtime=direct", { waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();

    const runtime = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      lucide: Boolean((window as any).lucide),
      jspdf: Boolean((window as any).jspdf?.jsPDF),
      sdk: Boolean((window as any).SchoolSafeSupabaseSDK?.createClient),
      documents: Boolean((window as any).SchoolSafeDocumentCenter && (window as any).SchoolSafeDocumentRuntime),
      cards: Boolean((window as any).SchoolSafeCards?.init),
      sync: Boolean((window as any).SchoolSafeSync?.init),
    }));
    expect(runtime).toEqual({ theme: "dark", lucide: true, jspdf: true, sdk: true, documents: true, cards: true, sync: true });

    await page.locator("#enterSplash").evaluate((element: HTMLElement) => element.click());
    await page.locator("#continueGuardian").evaluate((element: HTMLElement) => element.click());
    await page.locator("#previewWorkspace").evaluate((element: HTMLElement) => element.click());
    await expect(page.locator("#workspace.active")).toBeVisible();
    await page.waitForFunction(() => Boolean((window as any).SchoolSafeDocumentContextReady));
    await page.evaluate(() => (window as any).SchoolSafeDocumentContextReady);

    await page.reload({ waitUntil: "load" });
    await expect(page.locator("#splash.active")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(localFailures).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(unexpectedConsoleErrors).toEqual([]);
  });
});
