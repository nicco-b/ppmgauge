import { defineConfig } from "vitest/config";

// Default config: fast unit tests for pure logic (src/chem.ts), plain node — no
// bindings, no workerd. Worker integration tests live in vitest.config.workers.ts
// (run with `npm run test:worker`).
export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
  },
});
