// Water Lab worker: session middleware -> /auth/* + /api/* -> else static assets.
import { authRouter } from "./auth";
import { json } from "./lib/http";
import { FIELDS } from "./lib/resources";
import { runFeed, feedPartial } from "./lib/feed";
import {
  saveProducerStory,
  runIngest,
  listStaging,
  promoteStaging,
  rejectStaging,
} from "./routes/api-admin";
import {
  saveCupping,
  deleteCupping,
  resolveFlavorsEndpoint,
} from "./routes/api-cupping";
import { flavorNoteDetail } from "./lib/flavors";
import { beanPage } from "./routes/bean";
import { publicBeanJson, publicRecipeJson } from "./routes/api-public";
import {
  listRows,
  getOne,
  createRow,
  updateRow,
  deleteRow,
  adoptRow,
} from "./routes/api-crud";
import { runCatalog, toggleFavorite } from "./routes/api-catalog";
import { accountGet, accountUpdate, accountDelete } from "./routes/api-account";
import { runCalibrate } from "./routes/api-calibrate";
import { runSuggest, runEnrich, runCoach } from "./routes/api-ai";
import { runUpload, servePhoto, runVision } from "./routes/api-media";
import { recipeOgImage } from "./lib/og";
import { appPage } from "./lib/app-shell";
import {
  brewsPartial,
  readingsPartial,
  beansPartial,
  recipesMinePartial,
  recipesFavPartial,
  recipesPoolPartial,
} from "./routes/partials";
import { sitemapXml, robotsTxt } from "./routes/seo";
import { recipesIndex, recipePage } from "./routes/recipes";
import {
  flavorsPage,
  libraryHub,
  mapPage,
  countryPage,
  producersIndex,
  producerPage,
  roastersIndex,
  roasterPage,
  varietiesIndex,
  varietyPage,
  regionsIndex,
  regionPage,
  processesIndex,
  processPage,
  coffeesIndex,
  coffeePage,
  brewersIndex,
  brewerPage,
  grindersIndex,
  grinderPage,
  filterPage,
} from "./routes/library";
import { freshnessReminders, weeklyDigest } from "./cron";
import type { Env } from "./types";
import {
  type AppEnv,
  isAdmin,
  sessionMiddleware,
  requireUser,
  requireAdmin,
} from "./lib/auth-middleware";
import { Hono } from "hono";

// Env now lives in ./types (breaks the index.ts <-> auth.ts cycle); re-exported
// here so existing `import { Env } from "./index"` sites keep working.
export type { Env };


// Cron: weekly digest (Mon 15:00 UTC) + daily bean-freshness reminders (14:00 UTC).
async function scheduled(
  event: { cron: string },
  env: Env,
  ctx: { waitUntil: (p: Promise<unknown>) => void },
) {
  if (event.cron === "0 15 * * 1") ctx.waitUntil(weeklyDigest(env));
  else ctx.waitUntil(freshnessReminders(env));
}

// ── Hono app ─────────────────────────────────────────────────────────────────
// The single entry router: mounts the /auth + /api sub-routers and delegates every
// page/SEO route to a handler in lib/ or routes/. This file is now just the wiring
// — all handler bodies live in their modules. Worker tests hit routes via
// SELF.fetch, so they verify behavior across the router.
const app = new Hono<AppEnv>();

// One error boundary replaces the ~25 per-route try/catch blocks. API/auth
// return JSON; pages return text (matching the previous behavior).
app.onError((err: any, c) => {
  const msg = err?.message || "server error";
  const p = c.req.path;
  if (p.startsWith("/api/") || p.startsWith("/auth/"))
    return c.json({ error: msg }, 500);
  return c.text((p.endsWith("/og.png") ? "og error: " : "error: ") + msg, 500);
});

// ── App pages — each is a real server-rendered page (shared shell + body
// fragment), plain <a href> navigation, no client router. /water carries the
// calculator island; the rest are HTML + htmx. ──
app.get("/", (c) => appPage(c, "home", false));
// sessionMiddleware so appPage can inline a user-aware catalog (custom drops +
// favorites) into the page; the page stays renderable signed-out (user = null).
app.get("/water", sessionMiddleware, (c) => appPage(c, "water", true));
// sessionMiddleware so appPage can server-render the logbook lists inline (no
// empty-then-fill shift); stays renderable signed-out (user = null → lists stay empty).
app.get("/logbook", sessionMiddleware, (c) => appPage(c, "logbook", true));
app.get("/account", (c) => appPage(c, "account", true));
// legacy water aliases
app.get("/build", (c) => c.redirect("/water", 301));
app.get("/chemistry", (c) => c.redirect("/water", 301));
app.get("/drops", (c) =>
  c.redirect(new URL("/water#drops", c.req.url).toString(), 301),
);

// ── htmx partials ──
app.get("/partials/feed", (c) => feedPartial(c.env));
// Auth-gated logbook list fragments (hx-get targets). sessionMiddleware →
// requireUser so they 401 signed-out; the handler reads c.var.user.
app.get("/partials/brews", sessionMiddleware, requireUser, (c) =>
  brewsPartial(c.env, c.var.user!.id),
);
app.get("/partials/readings", sessionMiddleware, requireUser, (c) =>
  readingsPartial(c.env, c.var.user!.id),
);
app.get("/partials/beans", sessionMiddleware, requireUser, (c) =>
  beansPartial(c.env, c.var.user!.id),
);
app.get("/partials/recipes", sessionMiddleware, requireUser, (c) =>
  recipesMinePartial(c.env, c.var.user!, c.req.query("expand") === "1"),
);
app.get("/partials/recipes/favorites", sessionMiddleware, requireUser, (c) =>
  recipesFavPartial(c.env, c.var.user!, c.req.query("expand") === "1"),
);
app.get("/partials/recipes/pool", sessionMiddleware, requireUser, (c) =>
  recipesPoolPartial(c.env, c.var.user!),
);

// The crawlable pages below read the signed-in user from c.var (resolved once by
// sessionMiddleware) rather than each handler calling getUser itself. Scoped to
// these prefixes so plain static-asset requests never pay a session lookup. Must
// be registered before the matching GET handlers so the middleware wraps them.
// (/recipe/:id + its og.png are intentionally excluded — neither needs the user.)
app.use("/recipes", sessionMiddleware);
app.use("/bean/*", sessionMiddleware);
app.use("/library", sessionMiddleware);
app.use("/library/*", sessionMiddleware);

// ── Bean detail (server-rendered, own URL) ──
app.get("/bean/:id", (c) => beanPage(c.req.raw, c.env, c.req.param("id"), c.var.user));

// ── Library / reference (public, crawlable) ──
app.get("/library", (c) => libraryHub(c.req.raw, c.env, c.var.user));
app.get("/library/map", (c) => mapPage(c.req.raw, c.env, c.var.user));
app.get("/library/countries", (c) =>
  c.redirect(new URL("/library/map", c.req.url).toString(), 301),
);
app.get("/library/countries/:code", (c) =>
  countryPage(c.req.raw, c.env, c.req.param("code"), new URL(c.req.url), c.var.user),
);
app.get("/library/producers", (c) =>
  producersIndex(c.req.raw, c.env, new URL(c.req.url), c.var.user),
);
app.get("/library/producers/:slug", (c) =>
  producerPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/roasters", (c) => roastersIndex(c.req.raw, c.env, c.var.user));
app.get("/library/roasters/:slug", (c) =>
  roasterPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/varieties", (c) => varietiesIndex(c.req.raw, c.env, c.var.user));
app.get("/library/varieties/:slug", (c) =>
  varietyPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/regions", (c) => regionsIndex(c.req.raw, c.env, c.var.user));
app.get("/library/regions/:slug", (c) =>
  regionPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/processes", (c) => processesIndex(c.req.raw, c.env, c.var.user));
app.get("/library/processes/:slug", (c) =>
  processPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/lots", (c) => coffeesIndex(c.req.raw, c.env, new URL(c.req.url), c.var.user));
app.get("/library/lots/:slug", (c) =>
  coffeePage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/brewers", (c) => brewersIndex(c.req.raw, c.env, c.var.user));
app.get("/library/brewers/:slug", (c) =>
  brewerPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/grinders", (c) => grindersIndex(c.req.raw, c.env, c.var.user));
app.get("/library/grinders/:slug", (c) =>
  grinderPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/filters/:slug", (c) =>
  filterPage(c.req.raw, c.env, c.req.param("slug"), c.var.user),
);
app.get("/library/flavors", (c) => flavorsPage(c.req.raw, c.env, c.var.user));
app.get("/library/flavors/note/:note", async (c) =>
  c.html(await flavorNoteDetail(c.env, c.req.param("note"))),
);

// ── SEO ──
app.get("/robots.txt", () => robotsTxt());
app.get("/sitemap.xml", (c) => sitemapXml(c.env));

// ── Recipes (the OG card route MUST be registered before the recipe page) ──
app.get("/recipe/:id/og.png", (c) =>
  recipeOgImage(c.env, c.req.param("id")),
);
app.get("/recipes", (c) => recipesIndex(c.req.raw, c.env, new URL(c.req.url), c.var.user));
app.get("/recipe/:id", (c) => recipePage(c.req.raw, c.env, c.req.param("id")));

// ── 301s from the old flat reference URLs → their /library/* homes ──
const r301 = (c: any, dest: string) =>
  c.redirect(
    new URL(dest + new URL(c.req.url).search, c.req.url).toString(),
    301,
  );
app.get("/index", (c) => r301(c, "/library"));
app.get("/producers", (c) => r301(c, "/library/producers"));
app.get("/producer/:slug", (c) =>
  r301(c, "/library/producers/" + c.req.param("slug")),
);
app.get("/varieties", (c) => r301(c, "/library/varieties"));
app.get("/variety/:slug", (c) =>
  r301(c, "/library/varieties/" + c.req.param("slug")),
);
app.get("/regions", (c) => r301(c, "/library/regions"));
app.get("/region/:slug", (c) =>
  r301(c, "/library/regions/" + c.req.param("slug")),
);
app.get("/processes", (c) => r301(c, "/library/processes"));
app.get("/process/:slug", (c) =>
  r301(c, "/library/processes/" + c.req.param("slug")),
);
app.get("/coffee/:slug", (c) =>
  r301(c, "/library/lots/" + c.req.param("slug")),
);
app.get("/library/coffee", (c) => r301(c, "/library/lots"));
app.get("/library/coffee/:slug", (c) =>
  r301(c, "/library/lots/" + c.req.param("slug")),
);
app.get("/flavors", (c) => r301(c, "/library/flavors"));
app.get("/flavors/note/:note", (c) =>
  r301(c, "/library/flavors/note/" + c.req.param("note")),
);

// ── /auth/* — magic-link auth sub-router ──
app.route("/auth", authRouter);

// ── /api/* — native Hono sub-router ──────────────────────────────────────────
// Registration order encodes the old handleApi gating sequence: sessionMiddleware
// resolves the user once; PUBLIC routes (feed/catalog) match first and short-
// circuit; ADMIN routes carry requireAdmin (403 before the user gate); then
// `api.use(requireUser)` gates everything registered after it (401). The generic
// /:res CRUD is registered LAST so it can't shadow the named resources above.
const api = new Hono<AppEnv>();
api.use("*", sessionMiddleware);

// PUBLIC: community feed (only shared/public events) + the drops/salt catalog —
// reference data the calculator needs before sign-in.
api.get("/feed", (c) => runFeed(c.env));
api.get("/catalog", (c) => runCatalog(c.env, c.var.user));
// PUBLIC: JSON twins of the pages the feed links to, for native clients. Same gate
// as the pages they mirror (bean: shared=1; recipe: by id, like /recipe/:id).
// Registered here — before the user gate — and singular, so the generic /:res CRUD
// ("beans"/"recipes") can never shadow them.
api.get("/bean/:id", (c) => publicBeanJson(c.env, c.req.param("id")));
api.get("/recipe/:id", (c) => publicRecipeJson(c.env, c.req.param("id")));

// ADMIN: graph ingestion + staging review + firsthand producer stories. Gated by
// admin session OR INGEST_TOKEN bearer; placed before the user gate for the token path.
api.post("/ingest", requireAdmin, (c) => runIngest(c.req.raw, c.env));
api.get("/staging", requireAdmin, (c) => listStaging(c.env, new URL(c.req.url)));
api.post("/staging/:id/promote", requireAdmin, (c) => promoteStaging(c.env, c.req.param("id")));
api.post("/staging/:id/reject", requireAdmin, (c) => rejectStaging(c.env, c.req.param("id")));
api.post("/producer/:id/story", requireAdmin, (c) => saveProducerStory(c.req.raw, c.env, c.req.param("id")));

// Everything below requires a signed-in user (401 otherwise).
api.use("*", requireUser);
const uid_ = (c: any) => c.var.user!.id as string;

// Phase 2: tag a successful mutation with an HX-Trigger header when it's an htmx
// request, so the affected list partials (hx-trigger="<res>:changed from:body")
// re-fetch themselves. No-op for plain JSON/API clients (no HX-Request header).
async function hxNotify(c: any, resP: Promise<Response>, evt: string): Promise<Response> {
  const res = await resP;
  if (c.req.header("HX-Request") && res.ok) res.headers.set("HX-Trigger", evt);
  return res;
}

// Custom drops CRUD — /api/drops alias over user_drops (read path is /api/catalog).
api.post("/drops", (c) => createRow(c.req.raw, c.env, "user_drops", uid_(c)));
api.get("/drops/:id", (c) => getOne(c.env, "user_drops", uid_(c), c.req.param("id")));
api.put("/drops/:id", (c) => updateRow(c.req.raw, c.env, "user_drops", uid_(c), c.req.param("id")));
api.delete("/drops/:id", (c) => deleteRow(c.env, "user_drops", uid_(c), c.req.param("id")));

// Gear favorites: toggle a brewer/filter/grinder/recipe favorite (read path = /api/catalog).
// A recipe favorite toggles its star across the mine/fav/pool lists → recipes:changed.
api.post("/favorites", (c) => hxNotify(c, toggleFavorite(c.req.raw, c.env, uid_(c)), "recipes:changed"));

// Account page: profile + stats, rename, delete-everything.
api.get("/account", (c) => accountGet(c.env, uid_(c)));
api.put("/account", (c) => accountUpdate(c.req.raw, c.env, uid_(c)));
api.delete("/account", (c) => accountDelete(c.env, uid_(c)));

api.post("/calibrate", (c) => runCalibrate(c.env, uid_(c)));         // calibration solver over the user's readings
api.post("/coach", (c) => runCoach(c.req.raw, c.env));                // AI tasting coach
api.post("/cupping", (c) => saveCupping(c.req.raw, c.env, uid_(c))); // save an SCA-form tasting
api.delete("/cupping/:id", (c) => deleteCupping(c.env, uid_(c), c.req.param("id")));
api.post("/flavors/resolve", (c) => resolveFlavorsEndpoint(c.req.raw, c.env)); // free-text notes → flavor-wheel ids
api.post("/suggest", (c) => runSuggest(c.req.raw, c.env));            // AI water+brew suggestion for a bean
api.post("/enrich", (c) => runEnrich(c.req.raw, c.env));             // origin-level context for a bean
api.post("/upload", (c) => runUpload(c.req.raw, c.env, uid_(c)));    // R2 photo upload
api.post("/vision", (c) => runVision(c.req.raw, c.env));             // AI bag-label vision
api.get("/photo", (c) => servePhoto(c.req.raw, c.env, uid_(c)));    // serve an owner-scoped photo

// Generic resource CRUD over the FIELDS whitelist — registered LAST.
const knownRes: typeof requireUser = async (c, next) => {
  const res = c.req.param("res") || "";
  if (!(res in FIELDS)) return c.json({ error: "unknown resource" }, 404);
  await next();
};
const changed = (c: any) => c.req.param("res") + ":changed";
api.get("/:res", knownRes, (c) => listRows(c.env, c.req.param("res"), uid_(c), new URL(c.req.url)));
api.post("/:res", knownRes, async (c) => {
  const res = c.req.param("res");
  const r = await createRow(c.req.raw, c.env, res, uid_(c));
  // htmx: a new bean navigates to its detail page; other creates just refresh the list.
  if (c.req.header("HX-Request") && r.ok && res === "beans") {
    const bean: any = await r.clone().json().catch(() => null);
    if (bean && bean.id) r.headers.set("HX-Redirect", "/bean/" + bean.id);
    return r;
  }
  return hxNotify(c, Promise.resolve(r), changed(c));
});
api.post("/:res/:id/adopt", knownRes, (c) => hxNotify(c, adoptRow(c.env, c.req.param("res"), uid_(c), c.req.param("id")), changed(c)));
api.get("/:res/:id", knownRes, (c) => getOne(c.env, c.req.param("res"), uid_(c), c.req.param("id")));
api.put("/:res/:id", knownRes, (c) => hxNotify(c, updateRow(c.req.raw, c.env, c.req.param("res"), uid_(c), c.req.param("id")), changed(c)));
api.delete("/:res/:id", knownRes, (c) => hxNotify(c, deleteRow(c.env, c.req.param("res"), uid_(c), c.req.param("id")), changed(c)));

app.route("/api", api);

// static assets (/, /favicon.svg, /relief-*.webp, …)
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  scheduled,
};



// GET /library/flavors — public, crawlable flavor-wheel reference (htmx note detail). Reads
// only the reference coffee library, so it's safe to serve anonymously.
