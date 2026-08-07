// Applies schema.sql to the ephemeral test D1 once per worker test file.
// schema.sql is idempotent (CREATE TABLE IF NOT EXISTS), so re-runs are safe.
// SQL is inlined at bundle time via Vite's `?raw` (no fs at runtime — the setup
// file executes inside workerd). We strip comments (including inline ones, which
// would otherwise eat the rest of a line) and run each statement individually.
import { beforeAll } from "vitest";
import { env } from "cloudflare:test";
import schemaSql from "../../schema.sql?raw";

const statements = schemaSql
  .replace(/--[^\n]*/g, "") // strip line + inline comments
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

beforeAll(async () => {
  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
});
