// Community feed — the public activity stream (only opt-in/shared rows; NEVER an
// email). Served as JSON (/api/feed) and as an htmx press-ledger partial
// (/partials/feed). Every event's optional href points at a PUBLIC detail page.
import type { Env } from "../types";
import { json, esc } from "./http";

// Build the public feed — only opt-in/shared rows, and NEVER any email (display name or a
// neutral fallback). Each typed event carries an optional href to its PUBLIC detail page.
async function feedEvents(env: Env): Promise<any[]> {
  const ev: any[] = [];
  const actor = (dn: any) => (dn && String(dn).trim()) || "a brewer";
  const stars = (s: any) => (s ? "★".repeat(Math.max(0, Math.min(5, +s))) : "");
  const fmt = (x: any) => (typeof x === "number" ? x.toFixed(2) : x);

  let q = await env.DB.prepare(
    "SELECT r.id, r.name, r.updated_at AS ts, u.display_name dn FROM recipes r JOIN users u ON r.owner=u.id WHERE r.shared=1 ORDER BY r.updated_at DESC LIMIT 30").all();
  for (const r of (q.results || []) as any[]) ev.push({ ts: r.ts, type: "recipe", tone: "", text: `${actor(r.dn)} shared the recipe “${r.name}”`, href: `/recipe/${r.id}` });

  q = await env.DB.prepare(
    "SELECT c.name, c.reading_count rc, c.updated_at AS ts, u.display_name dn FROM calibrations c JOIN users u ON c.owner=u.id WHERE c.shared=1 ORDER BY c.updated_at DESC LIMIT 30").all();
  for (const c of (q.results || []) as any[]) ev.push({ ts: c.ts, type: "calibration", tone: "", text: `${actor(c.dn)} shared a calibration “${c.name}”`, badges: [`${c.rc || 0} readings`] });

  // NEW: shared beans → their passport
  q = await env.DB.prepare(
    "SELECT b.id, b.name, b.varietal, b.region, b.origin, b.created_at AS ts, u.display_name dn FROM beans b JOIN users u ON b.owner=u.id WHERE b.shared=1 ORDER BY b.created_at DESC LIMIT 30").all();
  for (const b of (q.results || []) as any[]) ev.push({ ts: b.ts, type: "bean", tone: "active", text: `${actor(b.dn)} added ${b.name}`, href: `/bean/${b.id}`, badges: [b.varietal, b.region || b.origin].filter(Boolean) });

  q = await env.DB.prepare(
    "SELECT br.tasting_note tn, br.score sc, br.brewed_at AS ts, br.bean_id bid, u.display_name dn, b.name bean FROM brews br JOIN users u ON br.owner=u.id LEFT JOIN beans b ON br.bean_id=b.id WHERE br.shared=1 ORDER BY br.brewed_at DESC LIMIT 30").all();
  for (const b of (q.results || []) as any[]) ev.push({ ts: b.ts, type: "brew", tone: "positive", text: `${actor(b.dn)} brewed ${b.bean || "a coffee"}${b.tn ? ` “${b.tn}”` : ""}`, href: b.bid ? `/bean/${b.bid}` : undefined, badges: b.sc ? [stars(b.sc)] : [] });

  // NEW: shared cuppings → score + top flavor notes, linking to the bean
  q = await env.DB.prepare(
    "SELECT uc.id, uc.bean_id bid, uc.total_score sc, uc.cupped_at AS ts, u.display_name dn, b.name bean FROM user_cuppings uc JOIN users u ON uc.owner=u.id LEFT JOIN beans b ON uc.bean_id=b.id WHERE uc.shared=1 ORDER BY uc.cupped_at DESC LIMIT 30").all();
  const cups = (q.results || []) as any[];
  const cupNotes: Record<string, string[]> = {};
  if (cups.length) {
    const ids = cups.map((c) => c.id); const ph = ids.map(() => "?").join(",");
    const fr = await env.DB.prepare(`SELECT ucf.cupping_id cid, f.name FROM user_cupping_flavors ucf JOIN ref_flavors f ON f.id=ucf.flavor_id WHERE ucf.cupping_id IN (${ph})`).bind(...ids).all();
    for (const r of (fr.results || []) as any[]) (cupNotes[r.cid] = cupNotes[r.cid] || []).push(r.name);
  }
  for (const c of cups) ev.push({ ts: c.ts, type: "cupping", tone: "positive", text: `${actor(c.dn)} cupped ${c.bean || "a coffee"}`, href: c.bid ? `/bean/${c.bid}` : undefined, badges: [c.sc != null ? String(fmt(c.sc)) : null, ...(cupNotes[c.id] || []).slice(0, 3)].filter(Boolean) });

  q = await env.DB.prepare("SELECT display_name dn, created_at AS ts FROM users ORDER BY created_at DESC LIMIT 15").all();
  for (const u of (q.results || []) as any[]) ev.push({ ts: u.ts, type: "member", tone: "active", text: `${actor(u.dn)} joined ppmgauge` });

  ev.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return ev.slice(0, 40);
}

export async function runFeed(env: Env): Promise<Response> {
  return json({ events: await feedEvents(env) });
}

// Relative timestamp for the server-rendered feed (recomputed each poll).
function feedRelTime(iso: string): string {
  const t = Date.parse(iso); if (isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 604800) return Math.floor(s / 86400) + "d ago";
  return new Date(t).toISOString().slice(0, 10);
}

// The feed as a press ledger (htmx partial). Rows carry a data-href the SPA delegates clicks
// on; every destination is a PUBLIC page (recipe / bean), so the links work signed-out too.
function feedLedgerHtml(events: any[]): string {
  const rows = events.length
    ? events.map((e) => {
        const color = e.tone === "positive" ? "var(--positive)" : e.tone === "active" ? "var(--accent)" : "";
        const bar = color ? ` style="border-left-color:${color}"` : "";
        const badges = ((e.badges || []) as any[]).map((b) => `<span class="tag">${esc(b)}</span>`).join(" ");
        const txt = esc(e.text) + (badges ? " " + badges : "");
        const link = e.href ? ` data-href="${esc(e.href)}" style="cursor:pointer"` : "";
        return `<tr${link}><th${bar}><time class="numeric">${esc(feedRelTime(e.ts))}</time></th><td>${txt}</td></tr>`;
      }).join("")
    : `<tr><th colspan="2" class="left"><span class="help">Nothing shared yet — share a recipe, calibration, brew, bean, or cupping to start the feed.</span></th></tr>`;
  return `<table class="ledger"><thead><tr><th colspan="2" class="left">Feed <span class="data">community activity</span></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// GET /partials/feed — htmx target (load + every 60s). Public; no-store so polling is always fresh.
export async function feedPartial(env: Env): Promise<Response> {
  const html = feedLedgerHtml(await feedEvents(env));
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
