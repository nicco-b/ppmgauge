// AI-assisted endpoints (Workers AI). All degrade gracefully when AI is unbound:
//   POST /api/suggest — deterministic water (rule engine) + an AI-rewritten rationale
//   POST /api/enrich  — origin-level CONTEXT for a coffee (typical-for-region, never lot facts)
//   POST /api/coach   — map a tasting note + current chemistry → concrete mineral moves
import type { Env } from "../types";
import { json, esc, readBody } from "../lib/http";

type Suggestion = { ratio: { T: number; J: number; L: number }; target_gl: number; brew: { ratio: string; grind: string; temp_c: number; time: string }; rationale: string };

// Deterministic water engine. Same bean in → same numbers out (no AI randomness).
// Signals: process (clarity vs body), varietal/origin (aromatics), roast (strength/temp).
function ruleSuggest(bean: any): Suggestion {
  const p = String(bean.process || "").toLowerCase();
  const v = String(bean.varietal || "").toLowerCase();
  const n = `${bean.name || ""} ${bean.origin || ""}`.toLowerCase();
  const why: string[] = [];

  // Base profile from process.
  let ratio = { T: 2, J: 1, L: 1 };
  if (/wash/.test(p)) { ratio = { T: 2.5, J: 0.5, L: 1 }; why.push("washed → clarity & acidity (TONIK-forward)"); }
  else if (/natural|carbonic/.test(p)) { ratio = { T: 1, J: 2.5, L: 0.5 }; why.push("natural → sweetness & body (JAMM-forward)"); }
  else if (/honey|pulped/.test(p)) { ratio = { T: 1.5, J: 2, L: 0.5 }; why.push("honey → rounded sweetness with structure"); }
  else if (/anaerobic|ferment|thermal|maceration/.test(p)) { ratio = { T: 1, J: 2, L: 1 }; why.push("fermented → body + a touch of aromatic lift"); }
  else why.push("balanced starting point");

  // Aromatic varietals / origins → bump LYLAC (magnesium) for florals.
  if (/geisha|gesha|sl28|sl34|wush|sudan|rume/.test(v) || /ethiopia|yirg|guji|sidamo|gedeb|geisha|gesha/.test(n)) {
    ratio.L += 1; if (ratio.J > 0.5) ratio.J -= 0.5;
    why.push("aromatic varietal/origin → more LYLAC (magnesium) for florals");
  }
  // Classic sweet-bodied varietals → nudge JAMM.
  else if (/bourbon|caturra|catuai|typica|mundo novo|pacamara/.test(v)) {
    ratio.J += 0.5; why.push(`${bean.varietal} → lean into sweetness (JAMM)`);
  }

  // Roast/format → overall strength + temp.
  let target = 3.5, temp = 94;
  if (/light|filter|omni|nordic/.test(n)) { target = 3.75; temp = 96; why.push("light/filter roast → a bit stronger, hotter"); }
  else if (/dark|espresso|french|italian/.test(n)) { target = 3.25; temp = 92; why.push("darker roast → softer strength, cooler"); }

  // Round to clean 0.05 steps so the displayed drops are tidy & stable.
  const r2 = (x: number) => Math.round(Math.max(0, x) * 20) / 20;
  ratio = { T: r2(ratio.T), J: r2(ratio.J), L: r2(ratio.L) };
  return { ratio, target_gl: target, brew: { ratio: "1:16.5", grind: "medium-fine", temp_c: temp, time: "2:45" }, rationale: why.join("; ") + "." };
}

export async function runSuggest(req: Request, env: Env): Promise<Response> {
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const bean = { name: b?.name || "", origin: b?.origin || "", process: b?.process || "", varietal: b?.varietal || "", roaster: b?.roaster || "", roast_date: b?.roast_date || "" };
  let daysOff: number | null = null;
  if (bean.roast_date) { const t = Date.parse(bean.roast_date + "T00:00:00Z"); if (!isNaN(t)) daysOff = Math.floor((Date.now() - t) / 86400000); }
  // The WATER is deterministic — computed by the rule engine, identical every call.
  // The AI only rewrites the rationale into nicer prose; if it fails we keep the engine's.
  const base = ruleSuggest(bean);
  if (!env.AI) return json({ suggestion: base, source: "rules", daysOff });

  const sys =
`You are a coffee brew-water expert. Given a coffee and a chosen Apax concentrate water (TONIK = acidity & clarity; JAMM = sweetness & body; LYLAC = floral & magnesium), write ONE short sentence (max 22 words) explaining why this water suits the coffee. Reply with ONLY the sentence — no JSON, no quotes, no preamble. Do not propose different numbers.`;
  const user = `Coffee: ${bean.name || "(unnamed)"} · origin ${bean.origin || "?"} · process ${bean.process || "?"} · varietal ${bean.varietal || "?"}${daysOff != null ? ` · ${daysOff} days off roast` : ""}. Chosen water — TONIK ${base.ratio.T} : JAMM ${base.ratio.J} : LYLAC ${base.ratio.L} at ${base.target_gl} g/L.`;

  let rationale = base.rationale;
  try {
    const out: any = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 80 });
    const resp = out && out.response;
    const text = (typeof resp === "string" ? resp : "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
    if (text && text.length >= 8) rationale = text.slice(0, 160);
  } catch {}
  return json({ suggestion: { ...base, rationale }, source: env.AI ? "ai" : "rules", daysOff });
}

// Origin-level CONTEXT for a coffee — typical altitude / harvest / cup tendency for the
// region+process. Explicitly NOT lot-specific facts (the model has no web access), so the
// prompt forbids inventing producer/farm specifics and the UI labels it "typical for region".
export async function runEnrich(req: Request, env: Env): Promise<Response> {
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const origin = String(b?.origin || "").trim();
  const region = String(b?.region || "").trim();
  const process = String(b?.process || "").trim();
  const varietal = String(b?.varietal || "").trim();
  const producer = String(b?.producer || "").trim();
  const lot = String(b?.name || "").trim();
  if (!origin && !region) return json({ error: "need at least an origin or region" }, 400);
  if (!env.AI) return json({ error: "AI not configured" }, 503);

  const where = [region, origin].filter(Boolean).join(", ");
  const sys =
`You are a coffee origin reference. Give background tailored to the supplied coffee. You have NO web access and cannot verify a specific farm or lot.
Rules:
- Use the producer/lot to TAILOR the regional context (e.g. smallholder washing-station lot vs. famous estate), but do NOT invent biography, plot size, family history, or exact numbers for a producer you don't genuinely recognize.
- Speak in ranges and tendencies ("typically", "often") for altitude/harvest.
- Set "recognized" to true ONLY if you genuinely know this specific, well-documented producer/farm from training (e.g. Hacienda La Esmeralda, Ninety Plus); otherwise false. When false, "blurb" must describe GENERAL patterns for that region + producer type, not invented specifics.
Reply with ONLY a compact JSON object — no prose, no code fence:
{"recognized":true|false,"altitude_range":"e.g. 1500–1900 masl (typical)","harvest_window":"e.g. May–September","cup_profile":"short phrase of typical flavors","blurb":"2 sentences of background — geography, common varietals/processing, cup tendency; tailored to the producer type"}
If you don't know the region at all, use empty strings.`;
  const user = `Coffee: ${lot || "(unnamed lot)"}${producer ? ` · producer ${producer}` : ""} · region ${where || "unknown"}${process ? ` · process ${process}` : ""}${varietal ? ` · varietal ${varietal}` : ""}. Give tailored regional context.`;

  let parsed: any = null;
  try {
    const out: any = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 360 });
    const resp = out && out.response;
    if (resp && typeof resp === "object" && !Array.isArray(resp)) parsed = resp;
    else { const raw = typeof resp === "string" ? resp : JSON.stringify(out ?? ""); const m = raw.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
  } catch { return json({ error: "enrich failed" }, 502); }
  const s = (k: string) => (parsed && typeof parsed[k] === "string" ? parsed[k].slice(0, 280) : "");
  const recognized = parsed && parsed.recognized === true && !!producer;
  const ctx = { altitude_range: s("altitude_range"), harvest_window: s("harvest_window"), cup_profile: s("cup_profile"), blurb: s("blurb"), region: where, producer, recognized };
  if (!ctx.altitude_range && !ctx.harvest_window && !ctx.cup_profile && !ctx.blurb) return json({ error: "no context available" }, 404);
  return json({ context: ctx });
}

export async function runCoach(req: Request, env: Env): Promise<Response> {
  const b = await readBody(req); // JSON (legacy API) or form-encoded (htmx)
  const hx = !!req.headers.get("HX-Request");
  // htmx wants an HTML fragment to swap into #coachOut; the JSON API keeps {response}.
  const htmlSignal = (inner: string, cls: string) =>
    new Response(`<div class="signal ${cls}" style="white-space:pre-wrap">${inner}</div>`,
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  const fail = (msg: string, status = 400) =>
    hx ? htmlSignal(esc(msg), "") : json({ error: msg }, status);

  const note = String(b?.note || "").slice(0, 400).trim();
  if (!note) return fail("describe how it tasted");
  if (!env.AI) return fail("AI not configured", 503);
  // chemistry: flat top-level fields (htmx form) OR a nested object (legacy JSON).
  const c: any = b.chemistry && typeof b.chemistry === "object" ? b.chemistry : b;

  const sys =
`You are a coffee brew-water chemistry coach for the Apax mineral concentrate system. The three concentrates:
- TONIK: acidity & clarity (calcium/chloride forward)
- JAMM: sweetness & body (more bicarbonate -> raises KH / buffering)
- LYLAC: floral & magnesium (magnesium sulfate/chloride -> soft, aromatic, juicy)
Brewing chemistry:
- GH (general hardness = Ca+Mg) drives extraction, body, texture. SCA range ~17-85 ppm CaCO3; aim ~50-70.
- KH (alkalinity = bicarbonate) buffers acidity. Too low -> sour, sharp, hollow; too high -> flat, dull, chalky. Aim ~40 ppm.
- Mg:Ca ratio: more Mg -> brighter/juicier/aromatic; more Ca -> heavier/rounder/sweeter.
- Total strength (g/L -> TDS ppm): low -> thin, watery, weak; high -> intense, muddy, harsh.
Map the taster's words to concrete moves. Reply as 2-4 short bullet points starting with "- ". Each: the likely cause in THEIR numbers, then a specific action (raise/lower a named concentrate, or a target GH/KH/strength shift). Be concrete and brief. No preamble, no disclaimer.`;

  const user =
`Current water (${b.source || "cup"}): GH ${c.gh} ppm, KH ${c.kh} ppm, TDS ${c.tds} ppm, Ca ${c.ca} mg/L, Mg ${c.mg} mg/L, HCO3 ${c.hco3} mg/L, Mg:Ca ${c.mgca || "?"}. Target strength ${b.target_gl} g/L. Concentrate ratio T:J:L = ${b.ratio || "?"}.
Tasting note: "${note}"
What should I adjust?`;

  const out = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", {
    messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    max_tokens: 400,
  });
  const text = (out && out.response) || "(no suggestion returned)";
  return hx ? htmlSignal(esc(text), "info") : json({ response: text });
}
