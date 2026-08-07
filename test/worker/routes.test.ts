import { describe, it, expect } from "vitest";
import { SELF, env } from "cloudflare:test";

// Magic-link verify is one-step and idempotent: GET the link signs in directly.
function postVerify(link: string) {
  return SELF.fetch(link, { redirect: "manual" });
}

// Server-rendered pages, redirects and SEO routes are now served by the Hono app
// (the legacy dispatch only keeps /auth + /api + the asset fallthrough). These
// tests verify the migration: routing, params, ordering and the 301s.
describe("Hono-served leaf routes", () => {
  it("GET /robots.txt", async () => {
    const res = await SELF.fetch("https://example.com/robots.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("User-agent");
  });

  it("GET /sitemap.xml is XML", async () => {
    const res = await SELF.fetch("https://example.com/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toMatch(/xml/);
  });

  it("GET /library renders (200) on an empty DB", async () => {
    const res = await SELF.fetch("https://example.com/library");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toContain("text/html");
  });

  it("GET /recipes renders (200)", async () => {
    const res = await SELF.fetch("https://example.com/recipes");
    expect(res.status).toBe(200);
  });

  it("SPA shell route /water serves the index HTML", async () => {
    const res = await SELF.fetch("https://example.com/water");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<html");
  });

  it("vendored htmx is served and the SPA loads it", async () => {
    const lib = await SELF.fetch("https://example.com/htmx.min.js?v=2.0.4");
    expect(lib.status).toBe(200);
    expect(lib.headers.get("content-type") || "").toMatch(/javascript/);
    expect(await lib.text()).toContain('version:"2.0.4"');

    // The SPA shell references it (so the feed + future hx-* lists activate).
    const html = await (await SELF.fetch("https://example.com/")).text();
    expect(html).toContain('src="/htmx.min.js');
  });
});

describe("recipe page render (exercises lib/catalog recipe model + shell)", () => {
  it("a shared recipe renders its server-side page", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "recipe@render.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    const created = await SELF.fetch("https://example.com/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Render Me",
        mode: "single",
        ratios: JSON.stringify({
          s: { apax_tonik: 2, apax_jamm: 1, apax_lylac: 1 },
          vol: { s: 500 }, tgt: { s: 3.5 }, dpg: { s: 20 }, kits: { s: "apax" },
          brew: { grind: "medium-fine", dose_g: 18, ratio: 16.5 },
          pour: [{ w: "s", t: "bloom", g: 36, sec: 30 }],
        }),
        target_gl: 3.5,
        drops_per_g: 20,
        shared: 1,
      }),
    });
    const recipe = await created.json<{ id: string }>();
    expect(recipe.id).toBeTruthy();

    const page = await SELF.fetch("https://example.com/recipe/" + recipe.id);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type") || "").toContain("text/html");
    const html = await page.text();
    expect(html).toContain("Render Me");
    expect(html).toContain("How it"); // brewSection "How it's brewed" table

    // OG card (lib/og + workers-og + the bundled TTF fonts) renders a PNG.
    const og = await SELF.fetch("https://example.com/recipe/" + recipe.id + "/og.png");
    expect(og.status).toBe(200);
    expect(og.headers.get("content-type")).toContain("image/png");
  });
});

describe("library reference pages render (routes/library.ts)", () => {
  it("a seeded producer renders its detail page + appears in the index", async () => {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO ref_producers (id, name, kind, story, confidence, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind("test-farm", "Finca Render Test", "farm", "A test farm with a story so it indexes.", "firsthand", "2026-01-01T00:00:00Z").run();

    const page = await SELF.fetch("https://example.com/library/producers/test-farm");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type") || "").toContain("text/html");
    expect(await page.text()).toContain("Finca Render Test");

    const index = await SELF.fetch("https://example.com/library/producers");
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("Finca Render Test");

    // Unknown id → 404 via refNotFound (lib/render).
    const missing = await SELF.fetch("https://example.com/library/producers/nope-xyz");
    expect(missing.status).toBe(404);
  });

  it("the country origin map + flavor wheel pages render", async () => {
    const map = await SELF.fetch("https://example.com/library/map");
    expect(map.status).toBe(200);
    expect(map.headers.get("content-type") || "").toContain("text/html");

    const flavors = await SELF.fetch("https://example.com/library/flavors");
    expect(flavors.status).toBe(200);
    expect(await flavors.text()).toContain("Flavor wheel");
  });
});

describe("bean page render (exercises lib/render beanShell + cupping section)", () => {
  it("an owner's bean renders its server-side passport page", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bean@render.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    const created = await SELF.fetch("https://example.com/api/beans", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Render Bean",
        origin: "Ethiopia",
        process: "washed",
        varietal: "Heirloom",
        tasting_notes: "jasmine, bergamot, peach",
      }),
    });
    const bean = await created.json<{ id: string }>();
    expect(bean.id).toBeTruthy();

    // Owner-gated page: needs the session cookie.
    const page = await SELF.fetch("https://example.com/bean/" + bean.id, { headers: { cookie } });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type") || "").toContain("text/html");
    const html = await page.text();
    expect(html).toContain("Render Bean");

    // Signed-out → redirected to /logbook (beanPage is owner-scoped).
    const anon = await SELF.fetch("https://example.com/bean/" + bean.id, { redirect: "manual" });
    expect(anon.status).toBe(302);
  });
});

describe("301 redirects", () => {
  // NOTE: /index → /library is registered on the worker but can't be tested in
  // this pool — it needs wrangler's run_worker_first (set in prod wrangler.jsonc),
  // which the test runtime doesn't emulate, so the assets layer 307s it to /.
  const cases: [string, string][] = [
    ["/drops", "/water#drops"],
    ["/producers", "/library/producers"],
    ["/producer/some-farm", "/library/producers/some-farm"],
    ["/variety/geisha", "/library/varieties/geisha"],
    ["/coffee/lot-123", "/library/lots/lot-123"],
    ["/library/countries", "/library/map"],
    ["/library/coffee", "/library/lots"],
    ["/flavors", "/library/flavors"],
  ];
  for (const [from, to] of cases) {
    it(`GET ${from} → 301 ${to}`, async () => {
      const res = await SELF.fetch("https://example.com" + from, {
        redirect: "manual",
      });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toContain(to);
    });
  }
});
