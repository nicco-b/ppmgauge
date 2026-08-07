// R2 photo storage + AI bag-label vision. Degrade gracefully when the bindings
// are unbound (503), which keeps the worker testable without R2/AI.
//   POST /api/upload — store an owner-scoped image in R2, return its key
//   GET  /api/photo/* — serve an owner-scoped image (private cache)
//   POST /api/vision  — OCR a bag label into structured bean fields
import type { Env } from "../types";
import { uid } from "../db";
import { json } from "../lib/http";

export async function runUpload(req: Request, env: Env, owner: string): Promise<Response> {
  if (!env.PHOTOS) return json({ error: "storage not configured" }, 503);
  const ct = req.headers.get("content-type") || "image/jpeg";
  if (!ct.startsWith("image/")) return json({ error: "expected an image" }, 400);
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: "empty upload" }, 400);
  if (buf.byteLength > 8 * 1024 * 1024) return json({ error: "image too large (max 8MB)" }, 413);
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const key = `${owner}/${uid()}.${ext}`;
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: ct } });
  return json({ key });
}

export async function servePhoto(req: Request, env: Env, owner: string): Promise<Response> {
  if (!env.PHOTOS) return json({ error: "storage not configured" }, 503);
  const key = new URL(req.url).pathname.split("/").filter(Boolean).slice(2).join("/");
  if (!key || !key.startsWith(owner + "/")) return json({ error: "not found" }, 404); // owner-scoped
  const obj = await env.PHOTOS.get(key);
  if (!obj) return json({ error: "not found" }, 404);
  const h = new Headers();
  h.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
  h.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers: h });
}

export async function runVision(req: Request, env: Env): Promise<Response> {
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  const image = b?.image;
  if (!image || typeof image !== "string") return json({ error: "no image" }, 400);
  if (!env.AI) return json({ error: "AI not configured" }, 503);
  const model = "@cf/meta/llama-3.2-11b-vision-instruct";
  const messages = [
    { role: "system", content: "You read coffee bag labels. Reply with ONLY a compact JSON object — no prose, no code fence. Keys: name (the coffee's name/title), roaster, origin (country), region (growing region/area within the country), producer (farm/washing station/cooperative/producer name), varietal (cultivar, e.g. Geisha, Bourbon, Caturra, SL28), process (e.g. washed, natural, honey, anaerobic), altitude (elevation as printed, e.g. '1800 masl' or '1600-1900m'), harvest (harvest period/date if shown), roast_date (YYYY-MM-DD if a roast date is shown, else empty string), tasting_notes (the printed flavor/tasting notes exactly as written, comma-separated, e.g. 'blackcurrant, cocoa, jasmine'). Use an empty string for anything not clearly visible on the label. Transcribe only what is printed — do not guess or infer." },
    { role: "user", content: "Extract the coffee details from this bag label as JSON." },
  ];
  const ask = () => env.AI!.run(model, { messages, image, max_tokens: 300 });
  let out: any;
  try { out = await ask(); }
  catch { try { await env.AI.run(model, { prompt: "agree" }); } catch {} out = await ask(); } // one-time Meta license
  // Normalize: this model returns `response` as an already-parsed object; others return a string.
  const resp = out && out.response;
  let fields: any = {};
  if (resp && typeof resp === "object" && !Array.isArray(resp)) {
    fields = resp;
  } else {
    const raw = typeof out === "string" ? out : typeof resp === "string" ? resp : JSON.stringify(out ?? "");
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { fields = JSON.parse(m[0]); } catch {} }
  }
  const pick = (k: string) => (typeof fields[k] === "string" ? fields[k].trim() : "");
  return json({ fields: { name: pick("name"), roaster: pick("roaster"), origin: pick("origin"), region: pick("region"), producer: pick("producer"), varietal: pick("varietal"), process: pick("process"), altitude: pick("altitude"), harvest: pick("harvest"), roast_date: pick("roast_date"), tasting_notes: pick("tasting_notes") } });
}
