import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const appDir = path.join(root, "app");

async function readApp(name) {
  return readFile(path.join(appDir, name), "utf8");
}

test("le service worker n'intercepte JAMAIS les chemins API (auth/native/api)", async () => {
  const sw = await readApp("sw.js");
  for (const prefix of ["/auth/", "/native/", "/api/"]) {
    assert.ok(sw.includes(`"${prefix}"`), `exclusion ${prefix} absente du service worker`);
  }
  assert.match(sw, /url\.pathname\.indexOf\("\/auth\/"\) === 0/);
});

test("le service worker ne touche que le GET même-origine", async () => {
  const sw = await readApp("sw.js");
  assert.match(sw, /request\.method !== "GET" \|\| url\.origin !== self\.location\.origin/);
  assert.match(sw, /response\.type !== "opaque"/);
});

test("le module auth native est chargé par la coquille", async () => {
  const html = await readApp("index.html");
  assert.ok(html.includes("./modules/authnative/auth-native.js"), "module auth native absent de index.html");
});

test("le client auth native ne stocke JAMAIS de token", async () => {
  const mod = await readApp("modules/authnative/auth-native.js");
  assert.doesNotMatch(mod, /localStorage\.setItem|sessionStorage\.setItem/);
  assert.doesNotMatch(mod, /\.token\b/);
  assert.match(mod, /credentials: "include"/);
  assert.match(mod, /HttpOnly|cookie parle|jamais/i);
});

test("le manifeste PWA est valide et complet", async () => {
  const raw = await readApp("manifest.webmanifest");
  const manifest = JSON.parse(raw);
  assert.ok(manifest.name && manifest.start_url && manifest.display);
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
});

test("les icônes du manifeste existent réellement", async () => {
  const raw = await readApp("manifest.webmanifest");
  const manifest = JSON.parse(raw);
  const { access } = await import("node:fs/promises");
  for (const icon of manifest.icons) {
    const file = path.join(appDir, icon.src.replace(/^\.\//, ""));
    await access(file); // lève si absent
  }
});

test("une session native se restaure hors-ligne en lecture seule", async () => {
  const app = await readFile(path.join(appDir, "app.js"), "utf8");
  assert.match(app, /saved\.native && saved\.profile/);
  assert.match(app, /Mode hors-ligne : données en lecture seule/);
  // jamais d'écriture de token même en repli hors-ligne
  assert.doesNotMatch(app, /storageSet\("schoolsafe-v2-session"[^)]*token/);
});
