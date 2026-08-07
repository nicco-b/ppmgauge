import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// Worker integration tests: run inside workerd (miniflare) with real D1/KV/R2
// bindings pulled from wrangler.jsonc. Run with `npm run test:worker`.
//
// AI + send_email are NOT emulated — leave them unbound; the worker degrades
// gracefully (if (!env.AI) → rules fallback; DEV_EMAIL=1 → /auth/login returns
// the magic link inline instead of emailing).
export default defineWorkersConfig({
  test: {
    include: ["test/worker/**/*.test.ts"],
    setupFiles: ["./test/worker/apply-schema.ts"],
    poolOptions: {
      workers: {
        // trimmed test config (no AI/email/routes; D1/KV/R2 emulated)
        wrangler: { configPath: "./wrangler.test.jsonc" },
      },
    },
  },
});
