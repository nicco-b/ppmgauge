// PRESS-styled, email-safe HTML. Email clients don't support external CSS, <link>,
// or CSS custom properties — so we hardcode PRESS's design tokens as inline styles on
// a table layout. Reusable shell so all transactional mail (sign-in, Phase 6 digests)
// shares the look.

// PRESS tokens (mirrored from press.css :root — hardcoded because var() doesn't work in email)
const C = {
  bg: "#ffffff",
  soft: "#fafafa",
  text: "#000000",
  text2: "#555555",
  muted: "#999999",
  rule: "#c9c9c9",
  faint: "#e5e5e5",
  accent: "#003B5C", // Insignia Blue
  link: "#0B3D91",   // NASA Meatball Blue
};
const MONO = "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export function emailShell(opts: { host: string; eyebrow: string; title: string; bodyHtml: string }): string {
  const { host, eyebrow, title, bodyHtml } = opts;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.soft};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${C.bg};border:1px solid ${C.text};">
        <tr><td style="border-bottom:1px solid ${C.rule};padding:12px 20px;font-family:${MONO};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${C.text};">ppmgauge</td></tr>
        <tr><td style="padding:24px 20px;font-family:${SANS};color:${C.text};line-height:1.5;">
          <p style="margin:0 0 4px;font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};">${eyebrow}</p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:${C.text};">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="border-top:1px solid ${C.faint};padding:12px 20px;font-family:${MONO};font-size:11px;color:${C.muted};">ppmgauge · ${host} · brew water for coffee</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// A PRESS-style button (bordered/filled rectangle, square corners, mono uppercase label).
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0;"><tr>` +
    `<td style="background:${C.link};">` +
    `<a href="${href}" style="display:inline-block;padding:11px 22px;font-family:${MONO};font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${label}</a>` +
    `</td></tr></table>`;
}

export function magicLinkEmail(link: string, host: string): { subject: string; html: string; text: string } {
  const body =
    `<p style="margin:0 0 20px;font-size:14px;color:${C.text2};">Use the button below to sign in. The link works once and expires in 15 minutes.</p>` +
    emailButton(link, "Sign in →") +
    `<p style="margin:20px 0 0;font-size:12px;color:${C.text2};">Or paste this link into your browser:</p>` +
    `<p style="margin:4px 0 0;font-family:${MONO};font-size:12px;color:${C.link};word-break:break-all;">${link}</p>` +
    `<p style="margin:20px 0 0;font-size:12px;color:${C.muted};">If you didn't request this, you can safely ignore this email.</p>`;
  const html = emailShell({ host, eyebrow: "Sign-in link", title: "Sign in to ppmgauge", bodyHtml: body });
  const text =
`Sign in to ppmgauge

Use this link to sign in:
${link}

The link works once and expires in 15 minutes. If you didn't request it, you can ignore this email.

ppmgauge — brew water for coffee
https://${host}`;
  return { subject: "Your ppmgauge sign-in link", html, text };
}

// Phase 6 — bean freshness reminder (one email lists all of a user's beans hitting a threshold).
export function freshnessEmail(beans: { name: string; roaster?: string | null; days: number; stage: string }[], host: string) {
  const items = beans.map((b) =>
    `<div style="border-bottom:1px solid ${C.faint};padding:8px 0;font-size:14px">` +
    `<b>${esc(b.name)}</b>${b.roaster ? ` <span style="color:${C.muted}">· ${esc(b.roaster)}</span>` : ""}<br>` +
    `<span style="font-size:13px;color:${C.text2}">Day ${b.days} — ${esc(b.stage)}</span></div>`).join("");
  const body = `<p style="margin:0 0 16px;font-size:14px;color:${C.text2}">A quick freshness check on your beans:</p>${items}` +
    `<p style="margin:16px 0 0;font-size:12px;color:${C.muted}">Peak filter flavor is usually ~4–21 days off roast.</p>`;
  const html = emailShell({ host, eyebrow: "Bean freshness", title: "Your coffee is in its window", bodyHtml: body });
  const text = "Bean freshness check:\n" +
    beans.map((b) => `- ${b.name}${b.roaster ? ` (${b.roaster})` : ""}: day ${b.days}, ${b.stage}`).join("\n") +
    `\n\nppmgauge — https://${host}`;
  return { subject: "Your coffee is hitting its peak", html, text };
}

// Phase 6 — weekly digest.
export function digestEmail(stats: { count: number; avg: number | null; best: { score: number; tasting_note?: string | null } | null }, host: string) {
  const avgTxt = stats.avg != null ? `${stats.avg.toFixed(1)} / 5` : "—";
  const bestTxt = stats.best ? `${"★".repeat(stats.best.score)}${"☆".repeat(5 - stats.best.score)} — &ldquo;${esc(stats.best.tasting_note || "(no note)")}&rdquo;` : "—";
  const cell = `font-family:${MONO};text-align:right`;
  const body = `<p style="margin:0 0 16px;font-size:14px;color:${C.text2}">Here's your week in coffee:</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
    `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.faint};color:${C.text2}">Brews logged</td><td style="padding:6px 0;border-bottom:1px solid ${C.faint};${cell}"><b>${stats.count}</b></td></tr>` +
    `<tr><td style="padding:6px 0;border-bottom:1px solid ${C.faint};color:${C.text2}">Average score</td><td style="padding:6px 0;border-bottom:1px solid ${C.faint};${cell}"><b>${avgTxt}</b></td></tr>` +
    `<tr><td style="padding:6px 0;color:${C.text2}">Best cup</td><td style="padding:6px 0;text-align:right">${bestTxt}</td></tr>` +
    `</table>`;
  const html = emailShell({ host, eyebrow: "Weekly digest", title: "Your week in coffee", bodyHtml: body });
  const text = `Your week in coffee:\nBrews logged: ${stats.count}\nAverage score: ${avgTxt}\n` +
    `Best cup: ${stats.best ? `${stats.best.score}/5 — ${stats.best.tasting_note || ""}` : "—"}\n\nppmgauge — https://${host}`;
  return { subject: "Your ppmgauge week in coffee", html, text };
}
