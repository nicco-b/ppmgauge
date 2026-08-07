// Tiny HTTP/templating helpers shared across the worker.
//   json() — JSON Response with the right content-type (also used in cron/email
//     contexts that have no Hono Context).
//   esc()  — HTML-escape for server-rendered markup (& < > " ').

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function esc(s: any): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

// Parse a request body as an object — accepts JSON (the app's fetch() calls) OR
// form-urlencoded (htmx's default hx-post/hx-put encoding), so mutation endpoints
// work for both without an htmx JSON extension. Reads the stream ONCE (a body can
// only be consumed once), then dispatches by content-type with a header-less
// fallback. Not for multipart — file uploads read req.arrayBuffer() directly.
// Returns {} on empty/garbage.
export async function readBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") || "";
  let text: string;
  try { text = await req.text(); } catch { return {}; }
  if (!text) return {};

  const asForm = () => {
    const o: Record<string, any> = {};
    for (const [k, v] of new URLSearchParams(text)) o[k] = v;
    return o;
  };
  if (ct.includes("application/json")) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  if (ct.includes("form-urlencoded")) return asForm();
  // no / unknown content-type: try JSON, else treat as form-encoded.
  try { return JSON.parse(text); } catch { return asForm(); }
}
