import { defineConfig } from "vitest/config";

// First test infra in the repo (added with the Legislation & Courts plan,
// docs/legislation-plan.md). Deliberately narrow: pure functions and, later,
// schema round-trips against a scratch DB — not component or route tests.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
});
