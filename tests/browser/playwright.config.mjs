import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: packageRoot,
  testMatch: "synthesis.spec.mjs",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory ../..",
    cwd: packageRoot,
    url: `${baseURL}/synthesis.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: "ignore",
    stderr: "ignore",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "chromium-mobile-390",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-desktop",
      use: { browserName: "webkit", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "webkit-mobile-390",
      use: { browserName: "webkit", viewport: { width: 390, height: 844 } },
    },
  ],
});
