// OG card for /recipe/:id/og.png — satori (via workers-og) renders the document-
// style card to a PNG, cached in R2 keyed by the recipe's updated_at + template
// version. Isolated here so the workers-og / TTF / R2 coupling stays out of the
// page router. Mirrors the press light-theme tokens so the image matches the page.
import type { Env } from "../types";
import { esc } from "./http";
import { loadDropModel, recipeModel } from "./catalog";
import { ImageResponse } from "workers-og";
// @ts-ignore — .ttf resolves to ArrayBuffer at bundle time
import jbMonoRegular from "../../fonts/JetBrainsMono-Regular.ttf";
// @ts-ignore
import jbMonoBold from "../../fonts/JetBrainsMono-Bold.ttf";

// satori (via workers-og) renders the HTML below; the PNG is cached in R2 keyed by the
// recipe's updated_at, so an edit naturally busts it and only the first share renders.
export async function recipeOgImage(env: Env, id: string): Promise<Response> {
  const rec: any = await env.DB.prepare("SELECT * FROM recipes WHERE id=?").bind(id).first();
  if (!rec) return new Response("recipe not found", { status: 404 });
  // Bump OG_TMPL whenever the card template changes — old PNGs share an updated_at, so the
  // version segment is what busts them out of R2.
  const OG_TMPL = "v6"; // v6: resolve custom-drop names (was the raw id)
  const key = `og/${OG_TMPL}/${id}/${rec.updated_at}.png`;
  const pngHeaders = (extra: Record<string, string> = {}) =>
    ({ "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", ...extra });
  if (env.PHOTOS) {
    const hit = await env.PHOTOS.get(key);
    if (hit) return new Response(hit.body, { headers: pngHeaders({ "X-Og-Cache": "hit" }) });
  }
  const M = await loadDropModel(env, [rec.owner]); // resolve the author's custom drops
  const st = recipeModel(rec, M);
  const img = new ImageResponse(ogCardHtml(rec, st), {
    width: 1200, height: 630,
    fonts: [
      { name: "JetBrains Mono", data: jbMonoRegular, weight: 400, style: "normal" },
      { name: "JetBrains Mono", data: jbMonoBold, weight: 700, style: "normal" },
    ],
  });
  const buf = await img.arrayBuffer();
  if (env.PHOTOS) await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: "image/png" } });
  return new Response(buf, { headers: pngHeaders({ "X-Og-Cache": "miss" }) });
}

// Press light-theme tokens (press.css :root) — match the site byte-for-byte. The recipe
// page sets no data-theme, so it renders the light :root; the OG card (a static image)
// mirrors it. Concentrate colors are stored as var(--cad-…)/var(--…) tokens, which satori
// can't resolve, so pressColor() maps them to the same hexes the browser would paint.
const PRESS = { bg: "#fff", ink: "#000", muted: "#555", rule: "#c9c9c9", accent: "#003B5C" };
const PRESS_VARS: Record<string, string> = {
  "cad-vermilion": "#e34a2c", "cad-red": "#d72027", "cad-orange": "#e76f00", "cad-yellow": "#f5b800",
  "cad-lemon": "#f0d61f", "cad-sap": "#6aa324", "cad-emerald": "#16b56b", "cad-viridian": "#0ba17a",
  "cad-turquoise": "#0eb5a8", "cad-cerulean": "#0083c4", "cad-cobalt": "#1d5fcc", "cad-ultramarine": "#2a3aa6",
  "cad-violet": "#5e2c91", "cad-magenta": "#c0257d", "cad-rose": "#e3447b", "cad-coral": "#ee6655",
  "positive": "#00843D", "negative": "#C8102E", "info": "#0B3D91", "accent": "#003B5C",
};
function pressColor(c?: string): string {
  if (!c) return PRESS.muted;
  const v = String(c).trim();
  const m = v.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (m && PRESS_VARS[m[1].toLowerCase()]) return PRESS_VARS[m[1].toLowerCase()];
  if (/^#|^rgb/i.test(v)) return v;        // already a literal color
  return PRESS.muted;
}

// Document-style OG card — the same surface as /recipe/:id (white bg, black ink, Insignia-
// Blue accent, JetBrains Mono). Two-column body: per-concentrate drop breakdown (what you
// dispense) left, signature stats as a mini ledger right. satori needs explicit
// display:flex on every multi-child box.
function ogCardHtml(rec: any, st: any): string {
  const name = esc(String(rec.name || "Recipe").slice(0, 34));
  // Starting-water source (the GH/KH/ions in st.* already include its contribution).
  const startLabel = st.start
    ? (st.start.type === "ro" ? null : `from ${st.start.type} water`)
    : null;
  const sub = esc([st.kit, st.style, st.vol, startLabel].filter(Boolean).join(" · "));

  const all = Array.isArray(st.breakdown) ? st.breakdown : [];
  const rows = all.slice(0, 5);
  const extra = all.length - rows.length;
  const bRow = (x: any) =>
    `<div style="display:flex;flex-direction:row;width:100%;align-items:center;justify-content:space-between;margin-bottom:18px">` +
      `<div style="display:flex;flex-direction:row;align-items:center">` +
        `<div style="display:flex;width:22px;height:22px;border-radius:5px;background:${pressColor(x.color)};margin-right:16px"></div>` +
        `<div style="display:flex;font-size:31px;font-weight:700;color:${PRESS.ink}">${esc(String(x.name || ""))}</div>` +
      `</div>` +
      `<div style="display:flex;font-size:27px;color:${PRESS.muted}">${esc(String(x.drops))} drops · ${esc(Number(x.grams).toFixed(2))} g</div>` +
    `</div>`;
  const breakdown = all.length
    ? rows.map(bRow).join("") + (extra > 0 ? `<div style="display:flex;font-size:24px;color:${PRESS.muted};margin-top:2px">+${extra} more</div>` : "")
    : `<div style="display:flex;font-size:28px;color:${PRESS.muted}">${st.start ? "Starting water only." : "No concentrate."}</div>`;

  const mgca = st.mgca == null ? "all Mg" : `${Number(st.mgca).toFixed(1)} : 1`;
  const sRow = (label: string, val: string) =>
    `<div style="display:flex;flex-direction:row;width:100%;justify-content:space-between;align-items:flex-end;margin-bottom:14px">` +
      `<div style="display:flex;font-size:22px;letter-spacing:2px;color:${PRESS.muted}">${esc(label)}</div>` +
      `<div style="display:flex;font-size:31px;font-weight:700;color:${PRESS.ink}">${esc(val)}</div>` +
    `</div>`;

  return `<div style="display:flex;flex-direction:column;width:1200px;height:630px;background:${PRESS.bg};font-family:'JetBrains Mono'">` +
    `<div style="display:flex;flex-direction:column;width:100%;flex:1;padding:56px 72px;justify-content:space-between">` +
      // header
      `<div style="display:flex;flex-direction:column;width:100%">` +
        `<div style="display:flex;font-size:25px;letter-spacing:6px;color:${PRESS.muted}">PPMGAUGE — BREW-WATER RECIPE</div>` +
        `<div style="display:flex;font-size:60px;font-weight:700;color:${PRESS.ink};margin-top:14px;line-height:1.05">${name}</div>` +
        `<div style="display:flex;font-size:31px;color:${PRESS.muted};margin-top:12px">${sub}</div>` +
      `</div>` +
      // body: breakdown | stats
      `<div style="display:flex;flex-direction:row;width:100%;flex:1;margin-top:22px;padding-top:22px;border-top:4px solid ${PRESS.ink}">` +
        `<div style="display:flex;flex-direction:column;flex:3;padding-right:40px">` +
          `<div style="display:flex;font-size:22px;letter-spacing:3px;color:${PRESS.muted};margin-bottom:24px">WHAT YOU DISPENSE</div>` +
          breakdown +
        `</div>` +
        `<div style="display:flex;flex-direction:column;flex:2;padding-left:48px;border-left:2px solid ${PRESS.rule}">` +
          sRow("STRENGTH", `${st.ppm} ppm`) +
          sRow("HARDNESS · GH", String(st.GH)) +
          sRow("ALKALINITY · KH", String(st.KH)) +
          sRow("MG : CA", mgca) +
          sRow("TOTAL DROPS", String(st.drops)) +
        `</div>` +
      `</div>` +
      // footer
      `<div style="display:flex;flex-direction:row;width:100%;justify-content:space-between;align-items:flex-end;margin-top:16px">` +
        `<div style="display:flex;font-size:28px;font-weight:700;color:${PRESS.ink}">ppmgauge.com</div>` +
        `<div style="display:flex;font-size:22px;color:${PRESS.muted}">analytical brew-water dosing</div>` +
      `</div>` +
    `</div>` +
  `</div>`;
}
