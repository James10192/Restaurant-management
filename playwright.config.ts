import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout — Joliba
 *
 * Ils s'exécutent contre une application qui tourne DÉJÀ (voir `e2e/README.md`) : un
 * backend Convex local, le serveur Vite, et un faux serveur de courrier qui recueille les
 * codes de connexion. Aucun service extérieur n'est appelé.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
