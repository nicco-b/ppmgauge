// Scheduled-handler jobs (independent of the request router).
//   freshnessReminders — daily: nudge owners when a bean hits its peak/past-peak window.
//   weeklyDigest       — Mon: per-owner summary of the last 7 days of brews.
// Both are no-op senders (return the recipient count, sent: 0) when EMAIL is unbound,
// which keeps them safe to invoke in tests / dev.
import type { Env } from "./types";
import { freshnessEmail, digestEmail } from "./email";

const FROM = (env: Env) => `ppmgauge <${env.FROM_ADDRESS}>`;
const HOST = "ppmgauge.com";

export async function freshnessReminders(env: Env): Promise<{ recipients: number; sent: number }> {
  const { results } = await env.DB.prepare(
    "SELECT b.name, b.roaster, b.roast_date, u.email FROM beans b JOIN users u ON b.owner=u.id WHERE b.roast_date IS NOT NULL AND b.roast_date<>''").all();
  const now = Date.now();
  const byEmail: Record<string, any[]> = {};
  for (const b of (results || []) as any[]) {
    const t = Date.parse(b.roast_date + "T00:00:00Z");
    if (isNaN(t)) continue;
    const days = Math.floor((now - t) / 86400000);
    let stage: string | null = null;
    if (days === 4) stage = "entering its peak window";
    else if (days === 21) stage = "past peak — brew it soon";
    if (!stage) continue;
    (byEmail[b.email] ||= []).push({ name: b.name, roaster: b.roaster, days, stage });
  }
  const entries = Object.entries(byEmail);
  if (!env.EMAIL) return { recipients: entries.length, sent: 0 };
  const out = await Promise.allSettled(entries.map(([email, beans]) => {
    const m = freshnessEmail(beans, HOST);
    return env.EMAIL!.send({ from: FROM(env), to: email, replyTo: env.FROM_ADDRESS, subject: m.subject, text: m.text, html: m.html });
  }));
  return { recipients: entries.length, sent: out.filter((o) => o.status === "fulfilled").length };
}

export async function weeklyDigest(env: Env): Promise<{ recipients: number; sent: number }> {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT br.score, br.tasting_note, u.email FROM brews br JOIN users u ON br.owner=u.id WHERE br.brewed_at>=?").bind(cutoff).all();
  const byEmail: Record<string, any[]> = {};
  for (const r of (results || []) as any[]) (byEmail[r.email] ||= []).push(r);
  const entries = Object.entries(byEmail);
  if (!env.EMAIL) return { recipients: entries.length, sent: 0 };
  const out = await Promise.allSettled(entries.map(([email, brews]) => {
    const scored = brews.filter((b) => b.score != null);
    const avg = scored.length ? scored.reduce((s, b) => s + b.score, 0) / scored.length : null;
    const best = scored.slice().sort((a, b) => b.score - a.score)[0] || null;
    const m = digestEmail({ count: brews.length, avg, best }, HOST);
    return env.EMAIL!.send({ from: FROM(env), to: email, replyTo: env.FROM_ADDRESS, subject: m.subject, text: m.text, html: m.html });
  }));
  return { recipients: entries.length, sent: out.filter((o) => o.status === "fulfilled").length };
}
