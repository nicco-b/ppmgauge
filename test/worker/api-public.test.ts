import { describe, it, expect } from "vitest";
import { SELF, env } from "cloudflare:test";

// The JSON twins of the shareable pages (routes/api-public.ts) — what the native
// iOS client reads instead of the web UI. These pin the public gate (a bean is
// only visible once shared=1) and the response shape the client decodes.
function postVerify(link: string) {
  return SELF.fetch(link, { redirect: "manual" });
}

async function signIn(email: string): Promise<string> {
  const login = await SELF.fetch("https://example.com/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const { link } = await login.json<{ link: string }>();
  const verify = await postVerify(link);
  return verify.headers.get("set-cookie")!.split(";")[0];
}

describe("GET /api/bean/:id — public bean passport", () => {
  it("404s for an unknown bean, and for a bean that isn't shared", async () => {
    const missing = await SELF.fetch("https://example.com/api/bean/nope-xyz");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not found" });

    const cookie = await signIn("private@bean.test");
    const created = await SELF.fetch("https://example.com/api/beans", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Kept Private", shared: 0 }),
    });
    const bean = await created.json<{ id: string }>();

    // Signed-out AND signed-in: an unshared bean has no public JSON face.
    expect((await SELF.fetch("https://example.com/api/bean/" + bean.id)).status).toBe(404);
    expect((await SELF.fetch("https://example.com/api/bean/" + bean.id, { headers: { cookie } })).status).toBe(404);
  });

  it("serves a shared bean signed-out, with its passport and shared brews/cuppings", async () => {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO ref_processes (id,name,category,explainer,flavor_effect,updated_at) VALUES (?,?,?,?,?,?)`
    ).bind("washed", "Washed", "washed", "Fruit removed before drying.", "Clean, high clarity", "2026-01-01T00:00:00Z").run();

    const cookie = await signIn("shared@bean.test");
    const created = await SELF.fetch("https://example.com/api/beans", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Guji Shared", origin: "Ethiopia", region: "Guji", varietal: "Heirloom",
        process: "Washed", tasting_notes: "peach, jasmine", shared: 1,
      }),
    });
    const bean = await created.json<{ id: string }>();

    await SELF.fetch("https://example.com/api/brews", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ bean_id: bean.id, tasting_note: "juicy", score: 4, shared: 1 }),
    });
    await SELF.fetch("https://example.com/api/brews", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ bean_id: bean.id, tasting_note: "secret", score: 2, shared: 0 }),
    });
    await SELF.fetch("https://example.com/api/cupping", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ bean_id: bean.id, notes: "bright", shared: 1 }),
    });

    const res = await SELF.fetch("https://example.com/api/bean/" + bean.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json<any>();

    expect(body.bean.id).toBe(bean.id);
    expect(body.bean.name).toBe("Guji Shared");
    expect(body.bean.tasting_notes).toBe("peach, jasmine");
    // Display-name fallback — never the email.
    expect(body.bean.by).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("@");

    // Process resolved through the enrichment graph into the passport.
    expect(body.passport.process?.name).toBe("Washed");
    expect(body.passport).toHaveProperty("variety");
    expect(body.passport).toHaveProperty("region");
    expect(body.passport).toHaveProperty("producer");

    // Only the SHARED brew crosses over.
    expect(body.brews.map((b: any) => b.tasting_note)).toEqual(["juicy"]);
    expect(body.cuppings.length).toBe(1);
    expect(body.cuppings[0].notes).toBe("bright");
    expect(Array.isArray(body.cuppings[0].attrs)).toBe(true);
    expect(Array.isArray(body.cuppings[0].flavors)).toBe(true);
  });
});

describe("GET /api/recipe/:id — public recipe with its chem model", () => {
  it("404s for an unknown recipe", async () => {
    const res = await SELF.fetch("https://example.com/api/recipe/nope-xyz");
    expect(res.status).toBe(404);
  });

  it("returns the same model numbers the HTML page renders, signed-out", async () => {
    const cookie = await signIn("recipe@public.test");
    const created = await SELF.fetch("https://example.com/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Public Model",
        mode: "single",
        ratios: JSON.stringify({
          s: { apax_tonik: 2, apax_jamm: 1, apax_lylac: 1 },
          vol: { s: 500 }, tgt: { s: 3.5 }, dpg: { s: 20 },
          brew: { grind: "medium-fine", dose_g: 18, ratio: 16.5 },
          pour: [{ w: "s", t: "bloom", g: 36, sec: 30 }],
        }),
        target_gl: 3.5,
        drops_per_g: 20,
        shared: 1,
      }),
    });
    const recipe = await created.json<{ id: string }>();

    const res = await SELF.fetch("https://example.com/api/recipe/" + recipe.id);
    expect(res.status).toBe(200);
    const body = await res.json<any>();

    expect(body.recipe.name).toBe("Public Model");
    expect(body.recipe.shared).toBe(1);
    expect(body.model.mode).toBe("single");
    expect(typeof body.model.ppm).toBe("number");
    expect(typeof body.model.GH).toBe("number");
    expect(typeof body.model.KH).toBe("number");
    expect(Array.isArray(body.model.breakdown)).toBe(true);
    expect(Array.isArray(body.model.streams)).toBe(true);
    expect(body.gear.grind).toBe("medium-fine");
    expect(body.gear.dose_g).toBe(18);
    expect(body.model.pour.length).toBe(1);
    expect(JSON.stringify(body)).not.toContain("@");

    // The HTML page and the JSON twin agree on the headline number.
    const html = await (await SELF.fetch("https://example.com/recipe/" + recipe.id)).text();
    expect(html).toContain(`${body.model.ppm} ppm`);
  });

  it("the singular routes are not shadowed by the generic /:res CRUD", async () => {
    // /api/beans (plural) is still the gated CRUD list; /api/bean/:id is public.
    expect((await SELF.fetch("https://example.com/api/beans")).status).toBe(401);
    expect((await SELF.fetch("https://example.com/api/recipes")).status).toBe(401);
  });
});
