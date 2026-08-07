# ppmgauge — Local dev & testing

## One-time setup
```bash
npm install                 # dev deps (vitest, wrangler, pool-workers, typescript, hono)
cp .dev.vars.example .dev.vars   # DEV_EMAIL=1 → /auth/login returns the magic link inline
npm run seed:local          # apply schema.sql + a minimal reference seed to local D1
```

## Daily loop
```bash
npm run dev                 # wrangler dev (reads .dev.vars + local D1)
npm run test:watch          # vitest unit tests, watch mode
```

## Commands
| Command | What |
|---|---|
| `npm run dev` | `wrangler dev` |
| `npm test` | **unit** tests (pure logic, `src/chem.ts`) — fast, no bindings |
| `npm run test:watch` | unit tests in watch mode |
| `npm run test:worker` | **integration** tests inside workerd/miniflare with real D1/KV/R2 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | boot `wrangler dev --local` and curl key routes (`/`, `/water`, `/library`, `/api/catalog`) |
| `npm run seed:local` | schema + minimal seed → local D1 (`-- --full` for the heavy enrichment files) |
| `npm run deploy` | `wrangler deploy` |

## Test layout
```
test/
  unit/chem.test.ts        # node pool — priorYields + calibration solver
  worker/
    api.test.ts            # workerd pool — /api/catalog, /api/feed, auth round-trip
    apply-schema.ts        # setup: applies schema.sql to the ephemeral test D1
    env.d.ts, raw.d.ts     # ambient types (cloudflare:test, *?raw imports)
vitest.config.ts           # default = unit (node)
vitest.config.workers.ts   # worker integration (uses wrangler.test.jsonc)
wrangler.test.jsonc        # trimmed config for tests (see below)
```

### How the worker tests work
`@cloudflare/vitest-pool-workers` boots **workerd via miniflare** and gives tests
real `env` bindings. They hit routes via `SELF.fetch(...)`, so they're
**router-agnostic** — they survive router refactors unchanged.

`schema.sql` is inlined at bundle time (`import schema from "../../schema.sql?raw"`)
and applied in a `beforeAll` (can't read files at runtime inside workerd).

### `wrangler.test.jsonc` (why a separate config)
The bundled test runtime is older than production's compat date and **cannot
emulate the `AI` or `send_email` bindings**. The test config therefore:
- pins an older `compatibility_date` the runtime supports,
- **omits** `ai`, `send_email`, custom-domain `routes`, crons, and `run_worker_first`,
- keeps `DB`/`SESSIONS`/`PHOTOS` (miniflare emulates these),
- sets `DEV_EMAIL=1`.

The worker degrades gracefully without AI/email (`if (!env.AI)` → rules fallback;
`!env.EMAIL` + `DEV_EMAIL` → `/auth/login` returns the link inline), so the
omissions are safe. The AI code path is untested-by-design.

## Toolchain pinning note
Dev deps are pinned to a **known-compatible older set** (vitest 2 / pool-workers
0.5 / wrangler 3) chosen for install reliability. Production deploys still use
your global `npx wrangler` (4.x). If you later want the worker tests on a newer
runtime (e.g. to match the 2026 compat date exactly), bump to
vitest 3 + `@cloudflare/vitest-pool-workers` 0.9 + wrangler 4 **in lockstep**
(the pool is tightly coupled to a Vitest version range).

## CI
`.github/workflows/ci.yml` runs `typecheck → unit → worker` on push/PR. No
Cloudflare account needed (miniflare runs locally). The smoke test is a local
pre-deploy check, not a CI step (booting `wrangler dev` in CI is flakier than the
in-process `SELF.fetch` worker tests).
