import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SCHOOLSAFE_URL || "http://127.0.0.1:4175";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "tests/qa/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: executablePath ? "off" : "retain-on-failure",
    headless: true,
    locale: "fr-FR",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "node app/server.mjs",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
