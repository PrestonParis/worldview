import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests: pure functions and scripts' helpers. Browser smoke tests are
// Playwright (tests/e2e, playwright.config.ts).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
});
