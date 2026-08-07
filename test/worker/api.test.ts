import { describe, it, expect } from "vitest";
import { SELF, env } from "cloudflare:test";

// Magic-link verify is one-step and idempotent: GET the link signs in directly and sets the
// session cookie. The name is kept so the many call sites below read unchanged.
function postVerify(link: string) {
  return SELF.fetch(link, { redirect: "manual" });
}

describe("public API routes", () => {
  it("GET /api/catalog returns JSON", async () => {
    const res = await SELF.fetch("https://example.com/api/catalog");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toBeTypeOf("object");
  });

  it("GET /api/feed is viewable signed-out", async () => {
    const res = await SELF.fetch("https://example.com/api/feed");
    expect(res.status).toBe(200);
  });
});

describe("API gating (sessionMiddleware + requireUser/requireAdmin)", () => {
  it("GET /api/recipes is 401 signed-out", async () => {
    const res = await SELF.fetch("https://example.com/api/recipes");
    expect(res.status).toBe(401);
  });

  it("GET an unknown resource is 401 signed-out (user gate runs before the FIELDS check)", async () => {
    const res = await SELF.fetch("https://example.com/api/zzz-nope");
    expect(res.status).toBe(401);
  });

  it("POST /api/ingest is 403 without admin (admin gate runs before the user gate)", async () => {
    const res = await SELF.fetch("https://example.com/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });

  // End-to-end through the generic /:res CRUD: sign in, then create + list a recipe.
  it("authed round-trip: create → list a recipe via the generic router", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "crud@trip.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    const created = await SELF.fetch("https://example.com/api/recipes", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Test Recipe",
        mode: "single",
        ratios: "{}",
        target_gl: 70,
        drops_per_g: 0.1,
      }),
    });
    expect(created.status).toBe(200);

    const list = await SELF.fetch("https://example.com/api/recipes", {
      headers: { cookie },
    });
    expect(list.status).toBe(200);
    const rows = await list.json<any[]>();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r) => r.name === "Test Recipe")).toBe(true);

    // 404 for a resource not in the FIELDS whitelist (now signed in).
    const unknown = await SELF.fetch("https://example.com/api/zzz-nope", { headers: { cookie } });
    expect(unknown.status).toBe(404);
  });
});

describe("htmx logbook partials (Phase 1)", () => {
  it("GET /partials/brews is 401 signed-out", async () => {
    const res = await SELF.fetch("https://example.com/partials/brews");
    expect(res.status).toBe(401);
  });

  it("authed /partials/brews renders the brew ledger with joined names", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "brews@partial.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    // Empty state first.
    const empty = await SELF.fetch("https://example.com/partials/brews", { headers: { cookie } });
    expect(empty.status).toBe(200);
    expect(empty.headers.get("content-type") || "").toContain("text/html");
    expect(await empty.text()).toContain("No brews logged yet");

    // Seed a recipe + bean + brew that references both.
    const recipe = await (await SELF.fetch("https://example.com/api/recipes", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Partial Recipe", mode: "single", ratios: "{}", target_gl: 70, drops_per_g: 0.1 }),
    })).json<{ id: string }>();
    const bean = await (await SELF.fetch("https://example.com/api/beans", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Partial Bean" }),
    })).json<{ id: string }>();
    await SELF.fetch("https://example.com/api/brews", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        recipe_id: recipe.id, bean_id: bean.id, gh: 50, kh: 40, tds: 90,
        score: 4, tasting_note: "bright and juicy",
      }),
    });

    const res = await SELF.fetch("https://example.com/partials/brews", { headers: { cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<table class="ledger">');
    expect(html).toContain("bright and juicy");
    expect(html).toContain("Partial Recipe"); // recipe name JOINed server-side
    expect(html).toContain("Partial Bean");   // bean name JOINed server-side
    expect(html).toContain("GH 50 · KH 40 · TDS 90");
    expect(html).toContain('hx-delete="/api/brews/');
    expect(html).toContain("★★★★☆"); // score 4
  });

  it("GET /partials/readings is 401 signed-out", async () => {
    const res = await SELF.fetch("https://example.com/partials/readings");
    expect(res.status).toBe(401);
  });

  it("authed /partials/readings renders measured values + modeled T/J/L", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "readings@partial.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    const empty = await (await SELF.fetch("https://example.com/partials/readings", { headers: { cookie } })).text();
    expect(empty).toContain("No readings yet");

    await SELF.fetch("https://example.com/api/readings", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ ratios: JSON.stringify({ T: 2, J: 1, L: 1 }), ppm: 90, measured_gh: 55, measured_kh: 38 }),
    });

    const html = await (await SELF.fetch("https://example.com/partials/readings", { headers: { cookie } })).text();
    expect(html).toContain("GH 55 · KH 38");
    expect(html).toContain("T2 · J1 · L1 ppm");
    expect(html).toContain('hx-delete="/api/readings/');
    // tbody fragment — no table wrapper
    expect(html).not.toContain('<table');
  });

  it("GET /partials/beans is 401 signed-out", async () => {
    const res = await SELF.fetch("https://example.com/partials/beans");
    expect(res.status).toBe(401);
  });

  it("authed /partials/beans renders clickable bean rows", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "beans@partial.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    const empty = await (await SELF.fetch("https://example.com/partials/beans", { headers: { cookie } })).text();
    expect(empty).toContain("No beans yet");

    await SELF.fetch("https://example.com/api/beans", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Partial Bean B", roaster: "Test Roastery", origin: "Kenya", process: "washed" }),
    });

    const html = await (await SELF.fetch("https://example.com/partials/beans", { headers: { cookie } })).text();
    expect(html).toContain("Partial Bean B");
    expect(html).toContain("Test Roastery · Kenya · washed");
    expect(html).toContain('class="clickable" data-bean=');
    expect(html).not.toContain('<table');
  });

  it("mutations send HX-Trigger only for htmx requests (Phase 2)", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "hx@trigger.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const cookie = (await postVerify(link)).headers.get("set-cookie")!.split(";")[0];

    const bean = await (await SELF.fetch("https://example.com/api/beans", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Trigger Bean" }),
    })).json<{ id: string }>();

    // Plain API delete → no HX-Trigger.
    const plain = await SELF.fetch("https://example.com/api/beans/" + bean.id, {
      method: "DELETE", headers: { cookie },
    });
    expect(plain.status).toBe(200);
    expect(plain.headers.get("HX-Trigger")).toBeNull();

    // htmx delete → HX-Trigger: beans:changed.
    const bean2 = await (await SELF.fetch("https://example.com/api/beans", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Trigger Bean 2" }),
    })).json<{ id: string }>();
    const hx = await SELF.fetch("https://example.com/api/beans/" + bean2.id, {
      method: "DELETE", headers: { cookie, "HX-Request": "true" },
    });
    expect(hx.status).toBe(200);
    expect(hx.headers.get("HX-Trigger")).toBe("beans:changed");

    // htmx bean CREATE → HX-Redirect to the new bean's page (no :changed).
    const created = await SELF.fetch("https://example.com/api/beans", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "HX-Request": "true" },
      body: "name=Redirect+Bean&origin=Peru",
    });
    expect(created.status).toBe(200);
    expect(created.headers.get("HX-Redirect") || "").toMatch(/^\/bean\/.+/);
  });

  it("mutation endpoints accept htmx's form-encoded body (favorite + share toggle)", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "form@body.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const cookie = (await postVerify(link)).headers.get("set-cookie")!.split(";")[0];

    const recipe = await (await SELF.fetch("https://example.com/api/recipes", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Form Recipe", mode: "single", ratios: "{}", target_gl: 70, drops_per_g: 0.1 }),
    })).json<{ id: string }>();

    // Favorite via form-encoded body (what htmx sends) → 200 favorited + HX-Trigger.
    const fav = await SELF.fetch("https://example.com/api/favorites", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "HX-Request": "true" },
      body: "kind=recipe&ref_id=" + recipe.id,
    });
    expect(fav.status).toBe(200);
    expect((await fav.json<{ favorited: boolean }>()).favorited).toBe(true);
    expect(fav.headers.get("HX-Trigger")).toBe("recipes:changed");

    // Share toggle via form-encoded {shared:1} → recipe becomes shared.
    const share = await SELF.fetch("https://example.com/api/recipes/" + recipe.id, {
      method: "PUT",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "HX-Request": "true" },
      body: "shared=1",
    });
    expect(share.status).toBe(200);
    expect((await share.json<{ shared: number }>()).shared).toBe(1);
  });

  it("POST /api/coach returns HTML for htmx, JSON for the API (Phase 3)", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "coach@hx.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const cookie = (await postVerify(link)).headers.get("set-cookie")!.split(";")[0];

    // htmx (form-encoded + HX-Request) → an HTML fragment (no AI in tests → graceful msg).
    const hx = await SELF.fetch("https://example.com/api/coach", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "HX-Request": "true" },
      body: "note=too+sour&gh=50&kh=20",
    });
    expect(hx.headers.get("content-type") || "").toContain("text/html");
    expect(await hx.text()).toContain('class="signal');

    // Plain API (JSON) → JSON error shape, unchanged.
    const api = await SELF.fetch("https://example.com/api/coach", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ note: "too sour", chemistry: { gh: 50 } }),
    });
    expect(api.headers.get("content-type") || "").toContain("application/json");
    expect(await api.json<any>()).toHaveProperty("error");
  });

  it("GET /partials/recipes is 401 signed-out", async () => {
    const res = await SELF.fetch("https://example.com/partials/recipes");
    expect(res.status).toBe(401);
  });

  it("recipe partials: mine (chips + owner actions), pool, favorites", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "recipes@partial.test" }),
    });
    const { link } = await login.json<{ link: string }>();
    const verify = await postVerify(link);
    const cookie = verify.headers.get("set-cookie")!.split(";")[0];

    const recipe = await (await SELF.fetch("https://example.com/api/recipes", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "Chip Recipe", mode: "single",
        ratios: JSON.stringify({ s: { apax_tonik: 2, apax_jamm: 1, apax_lylac: 1 }, vol: { s: 500 }, tgt: { s: 3.5 }, dpg: { s: 20 }, kits: { s: "apax" } }),
        target_gl: 3.5, drops_per_g: 20, shared: 1,
      }),
    })).json<{ id: string }>();

    // Mine: ledger title, name, stat chips (icon placeholders), owner actions.
    const mine = await (await SELF.fetch("https://example.com/partials/recipes", { headers: { cookie } })).text();
    expect(mine).toContain("My recipes");
    expect(mine).toContain("Chip Recipe");
    expect(mine).toContain('hx-post="/api/favorites"'); // star (htmx json-enc)
    expect(mine).toContain('data-act="rload"');  // Load (stays JS)
    expect(mine).toContain('hx-put="/api/recipes/'); // owner → Share (htmx json-enc)
    expect(mine).toContain('hx-delete="/api/recipes/'); // owner → Delete (htmx)
    expect(mine).not.toContain('/adopt'); // not Adopt (it's mine)
    expect(mine).toContain("data-icon=");        // chip icons (hydrated client-side)
    expect(mine).toContain("GH ");

    // Pool: my shared recipe shows, with the pool chrome.
    const pool = await (await SELF.fetch("https://example.com/partials/recipes/pool", { headers: { cookie } })).text();
    expect(pool).toContain("Top community recipes");
    expect(pool).toContain("Chip Recipe");
    expect(pool).toContain("Browse all community recipes");

    // Favorites: empty fragment until starred, then present.
    const favEmpty = await (await SELF.fetch("https://example.com/partials/recipes/favorites", { headers: { cookie } })).text();
    expect(favEmpty.trim()).toBe("");
    await SELF.fetch("https://example.com/api/favorites", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ kind: "recipe", ref_id: recipe.id }),
    });
    const fav = await (await SELF.fetch("https://example.com/partials/recipes/favorites", { headers: { cookie } })).text();
    expect(fav).toContain("★ Favorites");
    expect(fav).toContain("Chip Recipe");
  });
});

describe("auth magic-link (dev mode returns the link inline)", () => {
  it("POST /auth/login issues a dev link", async () => {
    const res = await SELF.fetch("https://example.com/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "Test@Example.com" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ dev: boolean; link: string }>();
    expect(body.dev).toBe(true);
    expect(body.link).toContain("/auth/verify?token=");
  });

  it("login → verify → /auth/me round-trip persists a user in D1", async () => {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "round@trip.test" }),
    });
    const { link } = await login.json<{ link: string }>();

    const verify = await postVerify(link);
    expect(verify.status).toBe(302);
    const cookie = verify.headers.get("set-cookie");
    expect(cookie).toContain("wl_session=");

    const me = await SELF.fetch("https://example.com/auth/me", {
      headers: { cookie: cookie!.split(";")[0] },
    });
    const user = await me.json<{ email: string } | null>();
    expect(user?.email).toBe("round@trip.test");

    const row = await env.DB.prepare("SELECT email FROM users WHERE email=?")
      .bind("round@trip.test")
      .first();
    expect(row).toBeTruthy();
  });
});

describe("auth verify is idempotent + prefetch-safe (one-step GET sign-in)", () => {
  async function freshLink(email: string) {
    const login = await SELF.fetch("https://example.com/auth/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
    });
    return (await login.json<{ link: string }>()).link;
  }

  it("GET /auth/verify signs in directly: creates the user + sets the session cookie", async () => {
    const link = await freshLink("direct@signin.test");
    const get = await SELF.fetch(link, { redirect: "manual" });
    expect(get.status).toBe(302);
    expect(get.headers.get("location")).toContain("/?auth=new");
    expect(get.headers.get("set-cookie")).toContain("wl_session=");
    expect(get.headers.get("cache-control")).toContain("no-store"); // redirect-with-cookie must not cache
    expect(await env.DB.prepare("SELECT 1 FROM users WHERE email=?").bind("direct@signin.test").first()).toBeTruthy();
  });

  it("idempotent: redeeming the same token twice both succeed (a prefetch can't lock the human out)", async () => {
    const link = await freshLink("prefetch@safe.test");
    // 1st redemption = the email-client prefetch. It mints a session the scanner discards.
    const prefetch = await SELF.fetch(link, { redirect: "manual" });
    expect(prefetch.status).toBe(302);
    expect(prefetch.headers.get("location")).toContain("/?auth=new");
    expect(prefetch.headers.get("set-cookie")).toContain("wl_session=");

    // 2nd redemption = the human, same still-valid token. Still signs in; row already exists → ?auth=ok.
    const human = await SELF.fetch(link, { redirect: "manual" });
    expect(human.status).toBe(302);
    expect(human.headers.get("location")).toContain("/?auth=ok");
    const cookie = human.headers.get("set-cookie");
    expect(cookie).toContain("wl_session=");

    // The human's session actually resolves to the user.
    const me = await SELF.fetch("https://example.com/auth/me", { headers: { cookie: cookie!.split(";")[0] } });
    expect((await me.json<{ email: string }>()).email).toBe("prefetch@safe.test");

    // Exactly one row despite two redemptions (race-safe upsert).
    const rows = await env.DB.prepare("SELECT COUNT(*) n FROM users WHERE email=?").bind("prefetch@safe.test").first<{ n: number }>();
    expect(rows!.n).toBe(1);
  });

  it("an expired/unknown token → /?auth=expired", async () => {
    const res = await SELF.fetch("https://example.com/auth/verify?token=deadbeefdeadbeef", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/?auth=expired");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("an already-signed-in re-click skips straight to / (no new session churn)", async () => {
    const cookie = (await postVerify(await freshLink("already@in.test"))).headers.get("set-cookie")!.split(";")[0];
    // A fresh link, but the browser is already authed → straight to /.
    const get = await SELF.fetch(await freshLink("already@in.test"), { headers: { cookie }, redirect: "manual" });
    expect(get.status).toBe(302);
    expect(get.headers.get("location")).toBe("/");
  });

  it("the transitional POST alias still signs in (in-flight confirm pages from the old deploy)", async () => {
    const link = await freshLink("postalias@safe.test");
    const token = new URL(link).searchParams.get("token")!;
    const post = await SELF.fetch("https://example.com/auth/verify", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "token=" + token, redirect: "manual",
    });
    expect(post.status).toBe(302);
    expect(post.headers.get("location")).toContain("/?auth=new");
    expect(post.headers.get("set-cookie")).toContain("wl_session=");
  });
});
