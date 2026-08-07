# ppmgauge

Brew-water instrument + logbook for Apax mineral concentrates (TONIK / JAMM / LYLAC).
Design, calibrate, and log the mineral content of your coffee water.

**Live:** https://ppmgauge.com

A Cloudflare Worker that links the [`press`](https://press.gldn.workers.dev) design library over the
network (so press stays the single source of truth for design — never embedded).

## What it does

- **Calculator** — scales TONIK/JAMM/LYLAC to a target strength (g/L → ppm), single or two-water split,
  grams + drops, with a live in-cup strength gauge.
- **Chemistry** — GH/KH/TDS + Ca/Mg/HCO₃ ion profile and a hardness-vs-alkalinity extraction map.
- **Self-calibrating chemistry** — enter measured GH/KH for a known water and a ridge least-squares
  solver fits the real per-concentrate mineral yields, replacing the estimate.
- **Logbook** — passwordless accounts (magic link), private-by-default recipes/beans/brews with an
  opt-in community pool (share + adopt recipes and calibrations).
- **Insights** — your brews plotted on the GH/KH map by score, plus an AI tasting coach that maps a
  sensory note to concrete concentrate adjustments.
- **Capture** — AI reads a coffee-bag photo to autofill origin/process/roaster/date and pulls an
  accent color (the photo isn't stored); cup photos attach to brews.
- **Ambient & share** — cron bean-freshness reminders + a weekly digest email (PRESS-styled), and a
  shareable PNG brew card rendered via Browser Rendering.

## Stack

Cloudflare Workers (static assets + a TypeScript Worker) with:

| Binding | Use |
|---|---|
| `DB` (D1) | users, recipes, beans, brews, calibrations, readings |
| `SESSIONS` (KV) | magic-link tokens + sessions + rate-limit counters |
| `PHOTOS` (R2) | brew cup photos |
| `AI` (Workers AI) | tasting coach (`llama-3.1-8b`), bag-label vision (`llama-3.2-11b-vision`) |
| `EMAIL` (Email Sending) | magic links + digests |
| `BROWSER` (Browser Rendering) | shareable brew-card PNG |
| `ASSETS` | static `public/` |

Plus two cron triggers (daily freshness, weekly digest). Auth is roll-our-own passwordless
magic-link (no third party); sessions are opaque KV-backed tokens in an HttpOnly cookie.

## Project structure

```
public/index.html   calculator + logbook UI (links press.css/press.js)
src/index.ts        Worker: router, session middleware, REST API, scheduled() cron handler
src/auth.ts         magic-link issue/verify, session cookie, rate-limit
src/email.ts        PRESS-styled email templates + brew-card HTML
src/chem.ts         chemistry constants + ridge least-squares calibration solver
src/db.ts           id/time helpers
schema.sql          D1 schema
wrangler.jsonc      bindings, routes, crons
docs/DEV.md         local dev & test guide
```

## Develop & deploy

```bash
npx wrangler dev      # local
npx wrangler deploy   # deploy

# DB schema / migrations
npx wrangler d1 execute water-lab --remote --file=schema.sql
```

Note: if your Cloudflare token can't enumerate account memberships, pass the account
explicitly: `CLOUDFLARE_ACCOUNT_ID=<id> npx wrangler deploy`.

Email Sending requires the domain to be onboarded to Cloudflare Email Service (SPF/DKIM/MX on the
`cf-bounce` subdomain). Set `DEV_EMAIL=1` in `vars` to return magic links in the response instead of
emailing (local/dev).
