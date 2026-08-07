// Boot `wrangler dev --local` and smoke-test key routes. Exits non-zero on failure.
//   npm run smoke   (optionally run `npm run seed:local` first for richer pages)
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

// Markers kept loose so an empty local DB still passes (we assert "doesn't 500").
const CHECKS = [
  { path: "/", expect: ["<html"] },
  { path: "/water", expect: ["<html"] }, // SPA shell
  { path: "/library", expect: ["<html"] }, // server-rendered hub
  { path: "/api/catalog", expect: ["{"] }, // public JSON
];

const dev = spawn(
  "npx",
  ["wrangler", "dev", "--local", "--port", String(PORT), "--ip", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, DEV_EMAIL: "1" } },
);

async function waitReady(timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(1500) });
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("wrangler dev did not become ready in time");
}

let failures = 0;
try {
  await waitReady();
  for (const c of CHECKS) {
    const res = await fetch(BASE + c.path, { redirect: "manual" });
    const ok = res.status >= 200 && res.status < 400;
    const body = await res.text();
    const missing = c.expect.filter((m) => !body.includes(m));
    if (!ok || missing.length) {
      failures++;
      console.error(
        `✗ ${c.path} — status ${res.status}` +
          (missing.length ? `, missing: ${missing.join(", ")}` : ""),
      );
    } else {
      console.log(`✓ ${c.path} — ${res.status}`);
    }
  }
} catch (e) {
  failures++;
  console.error("smoke error:", e.message);
} finally {
  dev.kill("SIGTERM");
  await sleep(300);
  if (!dev.killed) dev.kill("SIGKILL");
}

process.exit(failures ? 1 : 0);
