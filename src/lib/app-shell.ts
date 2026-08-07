// De-SPA app shell. Each app route is a real server-rendered page: the worker
// reads the shared chrome (_shell.html: head + nav + auth overlays + footer +
// placeholders) and the page body (_body/<page>.html) from the ASSETS binding,
// then fills the placeholders. No client router — navigation is plain <a href>.
// Only /water loads the calculator island (water.js); every page loads app.js.
import type { Env } from "../types";
import type { User } from "../auth";
import { buildCatalogData } from "../routes/api-catalog";
import {
  brewsPartial, beansPartial, recipesMinePartial, recipesFavPartial, recipesPoolPartial,
} from "../routes/partials";

type Page = "home" | "water" | "logbook" | "account";

async function readAsset(env: Env, origin: string, path: string): Promise<string> {
  const res = await env.ASSETS.fetch(new Request(new URL(path, origin)));
  return res.ok ? await res.text() : "";
}

// Inline JSON into a <script> safely: only `<` needs escaping to prevent a
// drop name/note from closing the tag early (</script>). Stays valid JSON.
const inlineJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

// Server-render the logbook's htmx list fragments so the page arrives populated
// instead of revealing empty containers that fill on the first refresh (the shift).
// The htmx triggers stay, so the client's refreshAll re-swaps identical content
// (and hydrates Press icons via htmx:afterSwap) — additive, no client change.
async function renderLogbookLists(
  env: Env, user: User,
): Promise<Record<string, string>> {
  const txt = (p: Promise<Response>) => p.then((r) => r.text());
  const [fav, rec, pool, beans, brews] = await Promise.all([
    txt(recipesFavPartial(env, user, false)),
    txt(recipesMinePartial(env, user, false)),
    txt(recipesPoolPartial(env, user)),
    txt(beansPartial(env, user.id)),
    txt(brewsPartial(env, user.id)),
  ]);
  return { FAVLIST: fav, RECLIST: rec, POOLLIST: pool, BNLIST: beans, BRLIST: brews };
}

// Render an app page by wrapping its body fragment in the shared shell.
// authRequired pages render with data-auth="required"; app.js shows the signin
// overlay on boot if there's no session (server stays stateless about the view).
export async function appPage(
  c: any, page: Page, authRequired: boolean,
): Promise<Response> {
  const origin = new URL(c.req.url).origin;
  const user = (c.var?.user as User | undefined) || null;
  // For /water, build the catalog server-side and inline it so the calc island
  // renders its rows synchronously on load instead of fetching /api/catalog first
  // (that fetch-then-build gap is what made the page reveal empty, then shift).
  // includeGear=false → drops/salts/brands + the user's custom drops/favorites only
  // (~2KB); the island fetches the bulky gear lists async (they fill <select>s, no
  // shift). For /logbook, server-render the htmx lists. Both run in parallel with
  // the asset reads; user-aware via sessionMiddleware.
  const [shell, body, catalog, lists] = await Promise.all([
    readAsset(c.env, origin, "/_shell.html"),
    readAsset(c.env, origin, `/_body/${page}.html`),
    page === "water" ? buildCatalogData(c.env, user, false) : Promise.resolve(null),
    page === "logbook" && user ? renderLogbookLists(c.env, user) : Promise.resolve(null),
  ]);
  if (!shell || !body) return c.text("page unavailable", 500);

  // Fill the logbook list placeholders (function replacements so user content with
  // `$` can't be misread as a $-pattern). Signed-out: tokens stay as harmless
  // comments inside the hidden logBody.
  let filledBody = body;
  if (lists)
    for (const [token, htmlFrag] of Object.entries(lists))
      filledBody = filledBody.replace("<!--" + token + "-->", () => htmlFrag);

  // water.js (the calc island) before app.js, so window.WaterLab exists when app.js runs.
  // The inline __CATALOG__ (a plain, non-deferred script) runs before the deferred
  // island, so window.__CATALOG__ exists when water.js boots.
  const scripts =
    (catalog ? `<script>window.__CATALOG__=${inlineJson(catalog)}</script>\n        ` : "") +
    (page === "water" ? '<script src="/water.js?v=13" defer></script>\n        ' : "") +
    '<script src="/app.js?v=5" defer></script>';

  const html = shell
    .replace("<!--BODY-->", () => filledBody)
    .replace("<!--SCRIPTS-->", () => scripts)
    .replace("__PAGE__", page)
    .replace("__AUTH__", authRequired ? "required" : "");

  // App HTML is never shared-cached — the auth-aware nav is filled by app.js, but
  // we keep the document itself always-fresh so deploys land immediately.
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
