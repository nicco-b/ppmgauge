// SEO endpoints — XML sitemap (curated to indexable reference pages) + robots.txt.
import type { Env } from "../types";
import { esc } from "../lib/http";
import { SITE } from "../lib/render";

export async function sitemapXml(env: Env): Promise<Response> {
  const loc = (path: string) => `${SITE}${path}`;
  const urls = [loc("/"), loc("/recipes"), loc("/library"), loc("/library/map"), loc("/library/producers"), loc("/library/lots"), loc("/library/roasters"), loc("/library/varieties"), loc("/library/regions"), loc("/library/processes"), loc("/library/flavors"), loc("/library/brewers"), loc("/library/grinders")];
  const push = (rows: any[], pre: string) => { for (const r of rows) urls.push(loc(`${pre}/${encodeURIComponent(r.id)}`)); };
  // Country drill-down pages (one per coffee-producing country).
  push(((await env.DB.prepare(`SELECT DISTINCT LOWER(country_code) id FROM ref_producers WHERE country_code IS NOT NULL ORDER BY id`).all()).results || []) as any[], "/library/countries");
  push(((await env.DB.prepare(`SELECT id FROM ref_varieties ORDER BY id`).all()).results || []) as any[], "/library/varieties");
  push(((await env.DB.prepare(`SELECT id FROM ref_regions ORDER BY id`).all()).results || []) as any[], "/library/regions");
  push(((await env.DB.prepare(`SELECT id FROM ref_processes ORDER BY id`).all()).results || []) as any[], "/library/processes");
  push(((await env.DB.prepare(`SELECT id FROM ref_brewers ORDER BY id`).all()).results || []) as any[], "/library/brewers");
  push(((await env.DB.prepare(`SELECT id FROM ref_grinders ORDER BY id`).all()).results || []) as any[], "/library/grinders");
  push(((await env.DB.prepare(
    `SELECT DISTINCT p.id FROM ref_producers p LEFT JOIN ref_coffees c ON c.producer_id=p.id
     WHERE (p.story IS NOT NULL AND p.story!='') OR c.published_score IS NOT NULL ORDER BY p.id`
  ).all()).results || []) as any[], "/library/producers");
  // Roasters with ≥2 lots — matches roasterPage's non-thin index policy (skip name-only stubs).
  push(((await env.DB.prepare(
    `SELECT r.id FROM ref_roasters r JOIN ref_coffees c ON c.roaster_id=r.id GROUP BY r.id HAVING COUNT(c.id) >= 2 ORDER BY r.id`
  ).all()).results || []) as any[], "/library/roasters");
  // Lots with a cup score AND a resolved variety — rich enough to index (skip the
  // thin/scoreless CQI mass that would otherwise dilute crawl budget).
  push(((await env.DB.prepare(
    `SELECT DISTINCT c.id FROM ref_coffees c JOIN ref_coffee_varieties cv ON cv.coffee_id=c.id
     WHERE c.published_score IS NOT NULL ORDER BY c.id`
  ).all()).results || []) as any[], "/library/lots");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls.map((u) => `<url><loc>${esc(u)}</loc></url>`).join("") + `</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
export function robotsTxt(): Response {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nSitemap: ${SITE}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
