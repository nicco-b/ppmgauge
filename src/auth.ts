// Passwordless magic-link auth, all-Cloudflare.
//   POST /auth/login  { email }     -> issues a sign-in link (KV, 15 min TTL); emails or (dev) returns it
//   GET  /auth/verify ?token=...    -> idempotent sign-in: upserts user, sets session cookie, redirects /
//   POST /auth/logout               -> clears session
//   GET  /auth/me                   -> { id, email } | null
// Sessions are opaque random ids stored in KV (server-side), so no cookie signing is needed.

import type { Env } from "./types";
import { uid, nowISO } from "./db";
import { magicLinkEmail } from "./email";
import { json, readBody } from "./lib/http";
import { Hono } from "hono";

const SESSION_COOKIE = "wl_session";
const TOKEN_TTL = 60 * 15;            // magic link: 15 min
const SESSION_TTL = 60 * 60 * 24 * 30; // session: 30 days
const RL_MAX = 10;                    // max link requests per window, per email
const RL_WINDOW = 60 * 15;            // 15 min (fixed window, not sliding)

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

function cookie(name: string, value: string, maxAge: number): string {
  const a = [`${name}=${value}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax"];
  a.push(`Max-Age=${maxAge > 0 ? maxAge : 0}`);
  return a.join("; ");
}

function readCookie(req: Request, name: string): string | null {
  const h = req.headers.get("Cookie") || "";
  const m = h.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

function randToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normEmail = (e: string) => (e || "").trim().toLowerCase();
const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export async function getUser(req: Request, env: Env): Promise<User | null> {
  const sid = readCookie(req, SESSION_COOKIE);
  if (!sid) return null;
  const userId = await env.SESSIONS.get("sess:" + sid);
  if (!userId) return null;
  return await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(userId).first<User>();
}

// Mounted at /auth by the root app (app.route("/auth", authRouter)). Self-
// contained: /auth/me resolves the user directly (the sub-router carries no
// session middleware), keeping the auth module free of the lib/middleware import.
export const authRouter = new Hono<{ Bindings: Env }>();
authRouter.post("/login", (c) => login(c.req.raw, c.env, new URL(c.req.url)));
authRouter.get("/verify", (c) => verify(c.req.raw, c.env, new URL(c.req.url).searchParams.get("token") || ""));
// Transitional alias: a confirm page from the previous (two-step) deploy may still be
// open in a browser and POST its token. Route it through the same idempotent handler so
// nobody mid-sign-in is stranded. Safe to remove a cycle from now (tokens expire in 15 min).
authRouter.post("/verify", async (c) => verify(c.req.raw, c.env, String((await readBody(c.req.raw)).token || "")));
authRouter.post("/logout", (c) => logout(c.req.raw, c.env));
authRouter.get("/me", async (c) => {
  const u = await getUser(c.req.raw, c.env);
  return json(u ? { id: u.id, email: u.email, display_name: u.display_name } : null);
});

async function login(req: Request, env: Env, url: URL): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const email = normEmail(body?.email);
  if (!validEmail(email)) return json({ error: "invalid email" }, 400);

  // rate-limit per email, FIXED window (value = "count:windowStartMs") so retries
  // don't extend the block. Prevents link-bombing / enumeration without trapping legit users.
  const rlKey = "rl:" + email;
  const now = Date.now();
  const raw = await env.SESSIONS.get(rlKey);
  let count = 0, start = now;
  if (raw) {
    const i = raw.indexOf(":");
    const c = parseInt(i < 0 ? raw : raw.slice(0, i), 10) || 0;
    const s = i < 0 ? 0 : parseInt(raw.slice(i + 1), 10) || 0;
    if (s && now - s < RL_WINDOW * 1000) { count = c; start = s; } // still inside the window
  }
  if (count >= RL_MAX) return json({ error: "too many sign-in requests — please wait a few minutes and try again" }, 429);
  await env.SESSIONS.put(rlKey, `${count + 1}:${start}`, { expirationTtl: RL_WINDOW });

  const token = randToken();
  await env.SESSIONS.put("magic:" + token, email, { expirationTtl: TOKEN_TTL });
  const link = `${url.origin}/auth/verify?token=${token}`;

  const dev = env.DEV_EMAIL === "1" || !env.EMAIL;
  if (dev) {
    console.log("[dev magic link]", email, link);
    return json({ ok: true, dev: true, link });
  }
  const mail = magicLinkEmail(link, url.host);
  try {
    await env.EMAIL!.send({
      from: `ppmgauge <${env.FROM_ADDRESS}>`,
      to: email,
      replyTo: env.FROM_ADDRESS,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch {
    return json({ error: "could not send the sign-in email — please try again shortly" }, 502);
  }
  return json({ ok: true });
}

// /auth/verify — idempotent magic-link sign-in. ONE step (GET signs in directly; no confirm page).
//
// Prefetch safety WITHOUT a second click: the token is NOT consumed on use. It stays redeemable for
// its full 15-min TTL, so an email-app/scanner that prefetches the GET does not burn it before the
// human clicks — the human's click redeems the same token and still signs in. (The old single-use
// GET was the bug: a prefetch deleted the token, stranding the human on /?auth=expired. A confirm
// interstitial fixed that but added a dead-end second click that stranded users in in-app webviews.)
//
// A prefetch redemption just mints a session the scanner discards (a harmless orphan that auto-
// expires) and may create the user row a moment early; the human then finds that row and signs in
// (→ /?auth=ok instead of new, which is cosmetic — onboarding keys off display_name, not this flag).
async function verify(req: Request, env: Env, token: string): Promise<Response> {
  const redirect = (q: string) =>
    new Response(null, { status: 302, headers: { Location: "/?auth=" + q, "Cache-Control": "no-store" } });
  if (!token) return redirect("error");
  // Already signed in (valid session)? Skip — don't churn a new session on a re-click.
  if (await getUser(req, env))
    return new Response(null, { status: 302, headers: { Location: "/", "Cache-Control": "no-store" } });
  const email = await env.SESSIONS.get("magic:" + token); // PEEK — do NOT delete (keep redeemable)
  if (!email) return redirect("expired");

  // Race-safe upsert: a prefetch and the human can redeem within the same second, both seeing no
  // row. ON CONFLICT(email) DO NOTHING lets the loser's INSERT no-op; the re-SELECT returns whoever
  // won. isNew is best-effort (drives only the cosmetic ?auth= flag).
  let user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first<User>();
  const isNew = !user;
  if (!user) {
    await env.DB.prepare(
      "INSERT INTO users (id,email,display_name,created_at) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING"
    ).bind(uid(), email, null, nowISO()).run();
    user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first<User>();
    if (!user) return redirect("error"); // unreachable: row exists after upsert
  }

  const sid = randToken();
  await env.SESSIONS.put("sess:" + sid, user.id, { expirationTtl: SESSION_TTL });
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/?auth=" + (isNew ? "new" : "ok"),
      "Set-Cookie": cookie(SESSION_COOKIE, sid, SESSION_TTL),
      "Cache-Control": "no-store",
    },
  });
}

async function logout(req: Request, env: Env): Promise<Response> {
  const sid = readCookie(req, SESSION_COOKIE);
  if (sid) await env.SESSIONS.delete("sess:" + sid);
  return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION_COOKIE, "", 0) });
}
