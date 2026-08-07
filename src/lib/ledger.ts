// Server-side mirrors of the app IIFE's generic list builders (public/index.html
// `row`/`ledger`/`thumb`), so the htmx list partials render byte-identical HTML to
// what the client JS produces today. Kept dumb on purpose — list-specific row
// content lives in each partial.
import { esc } from "./http";

// One ledger row: title cell (th) · muted sub cell · right-aligned actions cluster.
// `title`/`sub`/`actions` are pre-built HTML (callers esc their own text).
export function row(title: string, sub: string, actions = ""): string {
  return (
    "<tr><th>" + title + '</th><td class="data">' + sub + "</td>" +
    '<td><span class="cluster" style="justify-content:flex-end;gap:var(--space-2)">' +
    actions + "</span></td></tr>"
  );
}

// Wrap row HTML in a titled (optional) PRESS ledger table.
export function ledger(rowsHtml: string, title = "", cols = 3): string {
  return (
    '<table class="ledger">' +
    (title ? '<thead><tr><th colspan="' + cols + '" class="left">' + title + "</th></tr></thead>" : "") +
    "<tbody>" + rowsHtml + "</tbody></table>"
  );
}

// Owner-scoped photo thumbnail (served by /api/photo/:key). Empty string when no key.
export function thumb(key: string | null | undefined, sz = 34): string {
  if (!key) return "";
  return (
    '<img src="/api/photo/' + esc(key) + '" style="height:' + sz + "px;width:" + sz +
    'px;object-fit:cover;border:var(--border) solid var(--rule);border-radius:2px;margin-right:6px;vertical-align:middle">'
  );
}

// Standard htmx partial response — HTML fragment, never shared-cached (always fresh).
export function htmlFragment(html: string): Response {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
