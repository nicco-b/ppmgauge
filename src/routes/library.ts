// Public reference library (/library + crawlable detail pages): producers,
// roasters, varieties, regions, processes, lots, brewers, grinders, filters, the
// country origin map, and the flavor wheel. All server-rendered + SEO'd via
// seoShell; reads only ref_* reference data so they're safe to serve anonymously.
import type { Env } from "../types";
import type { User } from "../auth";
import { isAdmin } from "../lib/auth-middleware";
import { esc, json } from "../lib/http";
import {
  seoShell, refNotFound, SITE, seoRow, seoLed, seoStat, seoStrip, seoAbout,
  seoTags, lotsLedger, coffeeLotRow, coffeeLabel, jsonArr,
} from "../lib/render";
import { locatorMap, countryMapHtml, CODE_NUM } from "../lib/maps";
import { varietyFamily, fmtAlt, PP_MONTHS } from "../lib/passport";
import { flavorTree, flavorSwatch } from "../lib/flavors";

export async function flavorsPage(req: Request, env: Env, user: User | null): Promise<Response> {
  const ledgers = await flavorTree(env, { mode: "explore" });
  const inner =
    `<section class="section">` +
    `<span class="eyebrow">reference</span><h1 style="margin:0 0 var(--space-2)">Flavor wheel</h1>` +
    `<p class="help" style="margin:0 0 var(--space-3)">The SCA · World Coffee Research tasting vocabulary, grouped by category. Tap a note to see which coffees in the library show it; a number marks how many.</p>` +
    `<div id="flavorDetail" style="position:sticky;top:0;z-index:2;background:var(--bg);padding:var(--space-2) 0"><table class="ledger"><thead><tr><th class="left">Flavor note</th></tr></thead><tbody><tr><td class="data">Tap any note below to see which coffees show it.</td></tr></tbody></table></div>` +
    ledgers +
    `</section>`;
  return seoShell({
    title: "Coffee flavor wheel — ppmgauge", desc: "The SCA · World Coffee Research coffee tasting vocabulary, grouped by category, cross-referenced to the coffees that show each note.",
    canonical: `${SITE}/library/flavors`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Flavors</span>`,
  }, inner);
}

export async function producerPage(req: Request, env: Env, id: string, user: User | null): Promise<Response> {
  const admin = isAdmin(req, env, user);
  const p: any = await env.DB.prepare("SELECT * FROM ref_producers WHERE id=?").bind(id).first();
  if (!p) return seoShell({ title: "Producer not found — ppmgauge", desc: "This coffee producer isn’t on ppmgauge.", index: false, status: 404, user, crumbs: `<a href="/library">Library</a><span aria-current="page">Not found</span>` },
    `<section class="section"><div class="signal" style="border-color:var(--negative)">No producer with that id.</div><p style="margin-top:var(--space-3)"><a class="button sm" href="/library/producers">Browse producers →</a></p></section>`);
  const country: any = p.country_code ? await env.DB.prepare("SELECT name FROM ref_countries WHERE code=?").bind(p.country_code).first() : null;
  const region: any = p.region_id ? await env.DB.prepare("SELECT name FROM ref_regions WHERE id=?").bind(p.region_id).first() : null;
  const lotsRes = await env.DB.prepare("SELECT id,name,crop_year,published_score,process_id FROM ref_coffees WHERE producer_id=? ORDER BY published_score DESC, crop_year DESC LIMIT 100").bind(id).all();
  const lots = (lotsRes.results || []) as any[];
  const procRes = await env.DB.prepare("SELECT id,name FROM ref_processes").all();
  const procMap: Record<string, string> = {}; for (const pr of (procRes.results || []) as any[]) procMap[pr.id] = pr.name;
  const varMap: Record<string, { id: string; name: string; lineage: string }> = {};
  if (lots.length) {
    const ph = lots.map(() => "?").join(",");
    const vr = await env.DB.prepare(`SELECT cv.coffee_id cid, v.id vid, v.name vname, v.lineage lin FROM ref_coffee_varieties cv JOIN ref_varieties v ON v.id=cv.variety_id WHERE cv.coffee_id IN (${ph})`).bind(...lots.map((l) => l.id)).all();
    for (const r of (vr.results || []) as any[]) varMap[r.cid] = { id: r.vid, name: r.vname, lineage: r.lin };
  }
  const scores = lots.map((l) => l.published_score).filter((s) => s != null) as number[];
  const top = scores.length ? Math.max(...scores) : null;
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const varieties = [...new Set(Object.values(varMap).map((v) => v.name))];
  const place = [region?.name, country?.name].filter(Boolean).join(", ");
  const thin = !p.story && top == null && lots.length < 2;  // nothing unique to rank on

  // prev/next across all producers in the same order as /library (best score first),
  // so the detail pager mirrors stepping through the index.
  const ordRes = await env.DB.prepare(
    `SELECT p.id, p.name FROM ref_producers p LEFT JOIN ref_coffees c ON c.producer_id=p.id
     GROUP BY p.id ORDER BY (MAX(c.published_score) IS NULL), MAX(c.published_score) DESC, p.name`
  ).all();
  const ord = (ordRes.results || []) as any[];
  const oi = ord.findIndex((r) => r.id === id);
  const prev = oi > 0 ? ord[oi - 1] : null;                          // higher-ranked
  const next = oi >= 0 && oi < ord.length - 1 ? ord[oi + 1] : null;  // lower-ranked
  const detailPager = (prev || next)
    ? `<nav class="pager" style="margin-top:var(--space-5)">` +
      (prev ? `<a class="prev" href="/library/producers/${encodeURIComponent(prev.id)}">${esc(prev.name)}</a>` : `<span class="prev muted">Top of list</span>`) +
      `<span class="data">${oi + 1} / ${ord.length}</span>` +
      (next ? `<a class="next" href="/library/producers/${encodeURIComponent(next.id)}">${esc(next.name)}</a>` : `<span class="next muted">End of list</span>`) +
      `</nav>`
    : "";

  const stat = (label: string, val: string, hint?: string) =>
    `<div style="flex:1;min-width:90px"><div class="data" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em">${label}</div>` +
    `<div class="numeric" style="font-size:1.35rem;font-weight:600;line-height:1.15">${val}</div>` +
    (hint ? `<div class="data" style="font-size:.72rem">${hint}</div>` : "") + `</div>`;
  const row = (h: string, d: string) => (d ? `<tr><th>${esc(h)}</th><td>${d}</td></tr>` : "");

  const lotRows = lots.map((l) => {
    const v = varMap[l.id]; const fam = v ? varietyFamily(v.lineage) : null;
    const varChip = v ? `<a class="tag" href="/library/varieties/${encodeURIComponent(v.id)}"><i data-icon="${fam!.icon}"></i> ${esc(v.name)}</a>` : "";
    const proc = l.process_id ? `<a class="data" href="/library/processes/${encodeURIComponent(l.process_id)}">${esc(procMap[l.process_id] || l.process_id)}</a>` : "";
    const sc = l.published_score != null ? `<b>${l.published_score}</b>` : "<span class=\"data\">—</span>";
    return `<tr><th class="left"><a href="/library/lots/${encodeURIComponent(l.id)}">${esc(coffeeLabel(l, p.name))}</a>${l.crop_year ? ` <span class="data">${esc(l.crop_year)}</span>` : ""}</th>` +
      `<td>${[varChip, proc].filter(Boolean).join(" ")}</td><td class="numeric">${sc}</td></tr>`;
  }).join("");

  // Locator: stored coords with an honest precision label (point = geocoded farm,
  // region = region centroid, country = country centroid). All producers carry coords.
  let locHtml = "";
  if (p.lat != null && p.lng != null && p.lat !== 0) {
    const prec = p.geo_precision || "point";
    const cap = prec === "region" ? `${place || country?.name || ""} · region-level`
      : prec === "country" ? `${country?.name || p.country_code || ""} · country-level (approximate)`
      : `${place || country?.name || ""} · geocoded location`;
    locHtml = locatorMap(p.lat, p.lng, cap);
  }

  const conf = `${esc(p.confidence || "low")} confidence`;
  const srcLink = p.source_url ? `<a href="${esc(p.source_url)}" class="data" target="_blank" rel="noopener">${esc(p.source || "source")}</a>` : `<span class="data">${esc(p.source || "")}</span>`;

  // Admin-only firsthand editor (the "write about farms" path). Only renders for the
  // admin session; the page is private/no-store when signed in, so it never gets
  // shared-cached and never reaches anonymous crawlers.
  const numv = (x: any) => (x == null ? "" : String(x));
  const editor = admin
    ? `<form id="storyForm" data-pid="${esc(p.id)}" style="margin-top:var(--space-4)">` +
      `<table class="ledger"><thead><tr><th colspan="2" class="left">Edit producer <span class="data">firsthand · admin only</span></th></tr></thead><tbody>` +
      `<tr><th>Story</th><td><textarea class="input" name="story" rows="6" style="width:100%" placeholder="Firsthand prose: the people, the place, history, what makes the cup — this is what flips the page from thin to indexable.">${esc(p.story || "")}</textarea></td></tr>` +
      `<tr><th>Owner</th><td><input class="input" name="owner" value="${esc(p.owner || "")}" style="width:100%"></td></tr>` +
      `<tr><th>Founded</th><td><input class="input" name="founded" value="${esc(p.founded || "")}" style="width:12rem"></td></tr>` +
      `<tr><th>Hectares</th><td><input class="input" name="hectares" type="number" step="0.1" value="${numv(p.hectares)}" style="width:8rem"></td></tr>` +
      `<tr><th>Altitude m</th><td><input class="input" name="altitude_min_m" type="number" value="${numv(p.altitude_min_m)}" style="width:7rem" placeholder="min"> – <input class="input" name="altitude_max_m" type="number" value="${numv(p.altitude_max_m)}" style="width:7rem" placeholder="max"></td></tr>` +
      `<tr><th>Website</th><td><input class="input" name="website" value="${esc(p.website || "")}" style="width:100%" placeholder="https://"></td></tr>` +
      `<tr><th>Source URL</th><td><input class="input" name="source_url" value="${esc(p.source_url || "")}" style="width:100%" placeholder="optional citation for the story"></td></tr>` +
      `<tr class="action"><td colspan="2"><span class="data" id="storyMsg" style="margin-right:var(--space-2)"></span><button class="button sm" type="submit">Save firsthand</button></td></tr>` +
      `</tbody></table></form>` +
      `<script>(function(){var f=document.getElementById('storyForm');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var m=document.getElementById('storyMsg');m.textContent='Saving…';var b={};new FormData(f).forEach(function(v,k){b[k]=v;});fetch('/api/producer/'+encodeURIComponent(f.dataset.pid)+'/story',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json();}).then(function(d){if(d&&d.ok){m.textContent='Saved \\u2713';location.reload();}else{m.textContent='Error: '+((d&&d.error)||'failed');}}).catch(function(){m.textContent='Network error';});});})();</script>`
    : "";
  const inner =
    `<section class="section">` +
    `<span class="eyebrow">${esc(p.kind || "producer")}${place ? ` · ${esc(place)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(p.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">coffee producer · <span class="tag">${conf}</span> ${srcLink}</p>` +
    (lots.length
      ? `<div class="cluster" style="gap:var(--space-4);flex-wrap:wrap;border-top:2px solid var(--text);border-bottom:1px solid var(--rule);padding:var(--space-3) 0">` +
        stat("Lots", String(lots.length)) +
        (top != null ? stat("Top score", String(top), "cup points") : "") +
        (avg != null ? stat("Avg score", avg.toFixed(1), "cup points") : "") +
        (varieties.length ? stat("Varieties", String(varieties.length)) : "") +
        `</div>`
      : "") +
    (p.story ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">About</th></tr></thead><tbody><tr><td class="left" style="border-left:4px solid var(--rule)">${esc(p.story)}</td></tr></tbody></table>` : "") +
    editor +
    locHtml +
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">Producer</th></tr></thead><tbody>` +
    row("Country", esc(country?.name || p.country_code || "")) +
    row("Region", esc(region?.name || "")) +
    row("Owner", esc(p.owner || "")) +
    row("Altitude", esc(fmtAlt(p.altitude_min_m, p.altitude_max_m))) +
    row("Hectares", p.hectares ? `${esc(p.hectares)} ha` : "") +
    row("Founded", esc(p.founded || "")) +
    row("Website", p.website ? `<a href="${esc(p.website)}" class="data" target="_blank" rel="noopener">${esc(String(p.website).replace(/^https?:\/\//, ""))}</a>` : "") +
    `</tbody></table>` +
    (lots.length
      ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="3" class="left">Lots <span class="data">${lots.length} on ppmgauge</span></th></tr></thead><tbody>${lotRows}</tbody></table>`
      : `<p class="data" style="margin-top:var(--space-4)">No lots recorded yet.</p>`) +
    detailPager +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/producers">← All producers</a> <a class="button" href="/">Build brew water →</a></p>` +
    `<p class="data" style="margin-top:var(--space-3)">ppmgauge — specialty-coffee reference + analytical brew-water dosing</p>` +
    `</section>`;

  const jsonLd: any = {
    "@context": "https://schema.org", "@type": (p.lat && p.lng) ? "Place" : "Organization",
    name: p.name,
    ...(p.website ? { url: p.website } : {}),
    ...(country ? { address: { "@type": "PostalAddress", addressCountry: country.name, ...(region ? { addressRegion: region.name } : {}) } } : {}),
    ...(p.lat && p.lng ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } } : {}),
    ...(p.story ? { description: p.story } : {}),
  };
  const desc = p.story ? String(p.story).slice(0, 155)
    : `${p.name}${place ? `, a coffee producer in ${place}` : " — coffee producer"}.${lots.length ? ` ${lots.length} lot(s)${top != null ? `, top cup score ${top}` : ""} on ppmgauge.` : ""}`;
  return seoShell({
    title: `${p.name}${country ? ` — ${country.name}` : ""} coffee producer · ppmgauge`,
    desc, canonical: `${SITE}/library/producers/${encodeURIComponent(id)}`, jsonLd, index: !thin,
    user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">${esc(p.name)}</span>`,
  }, inner);
}

// GET /library — the reference hub: a ledger that indexes the sections (Producers,
// Varieties, Regions, Processes, Flavors) with a one-line blurb + entry count each.
// The full producer ledger lives one level down at /library/producers.
export async function libraryHub(req: Request, env: Env, user: User | null): Promise<Response> {
  const cnt = (sql: string) => env.DB.prepare(sql).first().then((r: any) => r?.n || 0);
  const [producers, lots, roasters, varieties, regions, processes, flavors, brewers, grinders] = await Promise.all([
    cnt("SELECT COUNT(*) n FROM ref_producers"),
    cnt("SELECT COUNT(*) n FROM ref_coffees"),
    cnt("SELECT COUNT(*) n FROM ref_roasters"),
    cnt("SELECT COUNT(*) n FROM ref_varieties"),
    cnt("SELECT COUNT(*) n FROM ref_regions"),
    cnt("SELECT COUNT(*) n FROM ref_processes"),
    cnt("SELECT COUNT(*) n FROM ref_flavors"),
    cnt("SELECT COUNT(*) n FROM ref_brewers"),
    cnt("SELECT COUNT(*) n FROM ref_grinders"),
  ]);
  const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sections: [string, string, number, string][] = [
    ["/library/producers", "Producers", producers, "Farms, estates & washing stations, ranked by cup score."],
    ["/library/map", "Map", regions, "Origins plotted — regions and producers on an interactive map."],
    ["/library/lots", "Lots", lots, "Individual competition & reference coffees, best cup score first."],
    ["/library/roasters", "Roasters", roasters, "Specialty roasters worldwide and the lots they roast."],
    ["/library/varieties", "Varieties", varieties, "Arabica cultivars — genealogy, terroir & the lots that grow them."],
    ["/library/regions", "Regions", regions, "Origins — altitude band, harvest window & typical processes."],
    ["/library/processes", "Processes", processes, "How the fruit is removed & dried, and the cup signature."],
    ["/library/flavors", "Flavor wheel", flavors, "The SCA · WCR tasting vocabulary, tied to the coffees that show it."],
    ["/library/brewers", "Brewers", brewers, "Drippers, immersion, siphons & machines — with each one’s cup signature."],
    ["/library/grinders", "Grinders", grinders, "Hand & electric burr grinders — burr type and what each is known for."],
  ];
  const rows = sections.map(([href, name, n, desc]) =>
    `<tr><th class="left"><a href="${href}">${esc(name)}</a></th>` +
    `<td>${esc(desc)}</td><td class="numeric data">${fmtN(n)}</td></tr>`).join("");
  const inner =
    `<section class="section">` +
    `<table class="ledger">` +
    `<caption>Library <span class="data" style="font-weight:400">— the ppmgauge coffee reference: producers and the seed-to-cup taxonomy. Pick a section.</span></caption>` +
    `<thead><tr><th class="left">Section</th><th class="left">What’s inside</th><th class="left">Entries</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>` +
    `</section>`;
  return seoShell({
    title: "Library — ppmgauge coffee reference",
    desc: "The ppmgauge coffee reference library: producers, varieties, regions, processing methods and the SCA flavor wheel, interlinked seed-to-cup.",
    canonical: `${SITE}/library`, index: true, user, navCurrent: "library",
    crumbs: `<span aria-current="page">Library</span>`,
  }, inner);
}


// GET /library/countries/:code — country drill-down: topo origin map (pan/zoom, 3 pin tiers)
// + a paged producer ledger. Reached by clicking a country on the /library/map globe.
export async function countryPage(req: Request, env: Env, codeRaw: string, url: URL, user: User | null): Promise<Response> {
  const code = String(codeRaw || "").toUpperCase().slice(0, 2);
  const country: any = await env.DB.prepare("SELECT code,name FROM ref_countries WHERE code=?").bind(code).first();
  if (!country) return refNotFound(user, "country", "Countries", "/library/map");
  const cnt: any = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM ref_producers WHERE country_code=?1) producers,(SELECT COUNT(*) FROM ref_coffees WHERE country_code=?1) lots,(SELECT COUNT(*) FROM ref_regions WHERE country_code=?1) regions"
  ).bind(code).first();
  if (!cnt || (!cnt.producers && !cnt.lots)) return refNotFound(user, "country", "Countries", "/library/map");

  const regionsR = ((await env.DB.prepare(
    "SELECT r.id,r.name,r.lat,r.lng,COUNT(p.id) n FROM ref_regions r LEFT JOIN ref_producers p ON p.region_id=r.id WHERE r.country_code=? AND r.lat IS NOT NULL GROUP BY r.id"
  ).bind(code).all()).results || []) as any[];
  // Map pins are PRECISE locations only — country-level-jittered producers would pile into an
  // unreadable blob, so they live in the list instead, not on the map.
  const producersR = ((await env.DB.prepare(
    "SELECT id,name,lat,lng FROM ref_producers WHERE country_code=? AND lat IS NOT NULL AND lat!=0 AND geo_precision!='country' LIMIT 4000"
  ).bind(code).all()).results || []) as any[];
  // Lots take a precise producer's spot, else their region's (also real); country-level lots drop off the map.
  const lotsR = ((await env.DB.prepare(
    "SELECT c.id,c.name nm,p.name pn,COALESCE(p.lat,r.lat) lat,COALESCE(p.lng,r.lng) lng FROM ref_coffees c LEFT JOIN ref_producers p ON p.id=c.producer_id AND p.geo_precision!='country' LEFT JOIN ref_regions r ON r.id=c.region_id WHERE c.country_code=? AND COALESCE(p.lat,r.lat) IS NOT NULL LIMIT 2500"
  ).bind(code).all()).results || []) as any[];

  const num = CODE_NUM[code.toLowerCase()] || "";
  const mapData = {
    num,
    regions: regionsR.map((r) => ({ id: r.id, name: esc(`${r.name} · ${r.n} producers`), lat: r.lat, lng: r.lng })),
    producers: producersR.map((p) => ({ id: p.id, name: esc(p.name || "Producer"), lat: p.lat, lng: p.lng })),
    lots: lotsR.map((l) => ({ id: l.id, name: esc(l.nm || l.pn || "Lot"), lat: l.lat, lng: l.lng })),
  };
  const blob = JSON.stringify(mapData).replace(/</g, "\\u003c");

  // Producer list (best cup score first), paged.
  const pageN = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const per = 60, off = (pageN - 1) * per;
  const pages = Math.max(1, Math.ceil((cnt.producers || 0) / per));
  const listR = ((await env.DB.prepare(
    `SELECT p.id,p.name, COUNT(c.id) lots, MAX(c.published_score) top FROM ref_producers p LEFT JOIN ref_coffees c ON c.producer_id=p.id
     WHERE p.country_code=? GROUP BY p.id ORDER BY (MAX(c.published_score) IS NULL), MAX(c.published_score) DESC, p.name LIMIT ? OFFSET ?`
  ).bind(code, per, off).all()).results || []) as any[];
  const listBody = listR.map((r) =>
    `<tr><th class="left"><a href="/library/producers/${encodeURIComponent(r.id)}">${esc(r.name)}</a></th>` +
    `<td class="numeric data">${r.lots || 0}</td><td class="numeric">${r.top != null ? `<b>${r.top}</b>` : '<span class="data">—</span>'}</td></tr>`).join("");
  const pager =
    `<nav class="pager" style="margin-top:var(--space-3)">` +
    (pageN > 1 ? `<a class="prev" href="/library/countries/${code.toLowerCase()}?page=${pageN - 1}">Previous</a>` : `<span class="prev muted">Previous</span>`) +
    `<span class="data">Page ${pageN} / ${pages} · ${(cnt.producers || 0).toLocaleString()} producers</span>` +
    (pageN < pages ? `<a class="next" href="/library/countries/${code.toLowerCase()}?page=${pageN + 1}">Next</a>` : `<span class="next muted">Next</span>`) +
    `</nav>`;

  const plotted = producersR.length;
  const inner =
    `<section class="section">` +
    `<span class="eyebrow">coffee origin</span>` +
    `<h1 style="margin:6px 0 2px">${esc(country.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-3)">${(cnt.producers || 0).toLocaleString()} producers · ${(cnt.lots || 0).toLocaleString()} lots · ${cnt.regions || 0} regions${plotted < (cnt.producers || 0) ? ` · ${plotted.toLocaleString()} mapped` : ""}.</p>` +
    seoStrip([seoStat("Producers", (cnt.producers || 0).toLocaleString()), seoStat("Lots", (cnt.lots || 0).toLocaleString()), cnt.regions ? seoStat("Regions", String(cnt.regions)) : ""]) +
    countryMapHtml(blob) +
    `<table class="ledger" style="margin-top:var(--space-4)"><caption>Producers <span class="data" style="font-weight:400">— best cup score first</span></caption>` +
    `<thead><tr><th class="left">Producer</th><th class="left">Lots</th><th class="left">Top</th></tr></thead><tbody>${listBody}</tbody></table>` +
    pager +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/map">← All countries</a></p>` +
    `</section>`;
  return seoShell({
    title: `${country.name} coffee producers — ppmgauge`,
    desc: `${(cnt.producers || 0).toLocaleString()} coffee producers and ${(cnt.lots || 0).toLocaleString()} lots from ${country.name}, on an interactive origin map with cup scores.`,
    canonical: `${SITE}/library/countries/${code.toLowerCase()}`, index: true, user, navCurrent: "library",
    crumbs: `<a href="/library">Library</a><a href="/library/map">Countries</a><span aria-current="page">${esc(country.name)}</span>`,
  }, inner);
}

// GET /library/map — interactive origin GLOBE: a country picker (click a country → drill in).
export async function mapPage(req: Request, env: Env, user: User | null): Promise<Response> {
  const esc2 = (s: any) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "‹", ">": "›", "&": "+" }[c] || c));
  // Pre-aggregate producers and lots SEPARATELY, then join on country — joining both tables in one
  // statement builds a producers×lots cartesian product per country (seconds of COUNT(DISTINCT) work).
  const rows = ((await env.DB.prepare(
    `SELECT co.code, co.name, COALESCE(p.n,0) producers, COALESCE(c.n,0) lots
     FROM ref_countries co
     LEFT JOIN (SELECT country_code, COUNT(*) n FROM ref_producers GROUP BY country_code) p ON p.country_code=co.code
     LEFT JOIN (SELECT country_code, COUNT(*) n FROM ref_coffees   GROUP BY country_code) c ON c.country_code=co.code
     WHERE COALESCE(p.n,0)>0 OR COALESCE(c.n,0)>0`
  ).all()).results || []) as any[];
  const byNum: Record<string, any> = {}; let totalP = 0, totalL = 0;
  for (const r of rows) {
    const num = CODE_NUM[String(r.code).toLowerCase()];
    totalP += r.producers || 0; totalL += r.lots || 0;
    if (num) byNum[num] = { code: String(r.code).toLowerCase(), name: esc2(r.name), p: r.producers || 0, l: r.lots || 0 };
  }
  const blob = JSON.stringify(byNum).replace(/</g, "\\u003c");
  const inner =
    `<section class="section">` +
    `<h1 style="margin:0 0 2px">Coffee origins</h1>` +
    `<p class="data" style="margin:0 0 var(--space-3)">${rows.length} producing countries · ${totalP.toLocaleString()} producers · ${totalL.toLocaleString()} lots. Drag to spin the globe; click a highlighted country to drill into its producers, lots and regions on a pannable map.</p>` +
    `<style>` +
    `#originwrap{position:relative;max-width:540px;margin:var(--space-2) auto 0}` +
    `#originmap{position:relative;width:100%}` +
    `#originmap svg{display:block;width:100%;height:auto;cursor:grab;touch-action:none}` +
    `#originmap svg:active{cursor:grabbing}` +
    `.g-sea{fill:var(--bg-soft);stroke:var(--rule);stroke-opacity:.5;stroke-width:.8}` +
    `.g-grat{fill:none;stroke:var(--rule);stroke-opacity:.18;stroke-width:.4}` +
    `.g-off{fill:var(--rule);fill-opacity:.32;stroke:var(--bg);stroke-width:.3}` +
    // dark mode: var(--rule) over the dark sea is nearly invisible — lift the land to a readable grey
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .g-off{fill:color-mix(in srgb,var(--text) 20%,transparent);fill-opacity:1}}` +
    `:root[data-theme=dark] .g-off{fill:color-mix(in srgb,var(--text) 20%,transparent);fill-opacity:1}` +
    `.g-on{fill:var(--accent,#003B5C);fill-opacity:.5;stroke:var(--bg);stroke-width:.5;cursor:pointer}` +
    `.g-on:hover{fill-opacity:.82}` +
    `.g-tip{position:absolute;pointer-events:none;opacity:0;background:var(--text);color:#fff;font-size:.72rem;line-height:1.3;padding:3px 7px;border-radius:3px;white-space:nowrap;z-index:6;transition:opacity .1s;font-family:var(--mono,monospace)}` +
    `.g-legend{display:flex;gap:var(--space-4);justify-content:center;margin-top:var(--space-2)}` +
    `.g-legend span{display:inline-flex;align-items:center;gap:6px}` +
    `.g-dot{width:9px;height:9px;border-radius:2px;display:inline-block}` +
    `</style>` +
    `<div id="originwrap"><div id="originmap"></div>` +
    `<div class="g-legend data"><span><i class="g-dot" style="background:var(--accent,#003B5C);opacity:.6"></i> producing country</span>` +
    `<span><i class="g-dot" style="background:var(--rule)"></i> other</span></div></div>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>` +
    `<script>window.__ORIGINMAP__=${blob};</script>` +
    `<script>(function(){function go(){var D=window.__ORIGINMAP__,el=document.getElementById('originmap');if(!el||!window.d3)return;` +
    `var W=Math.max(280,el.clientWidth),H=W;` +
    `var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H);` +
    `var proj=d3.geoOrthographic().scale(W/2-6).translate([W/2,H/2]).rotate([60,-15]).clipAngle(90);` +
    `var path=d3.geoPath(proj);` +
    `var sea=svg.append('path').datum({type:'Sphere'}).attr('class','g-sea');` +
    `var grat=svg.append('path').datum(d3.geoGraticule10()).attr('class','g-grat');` +
    `var cG=svg.append('g');var tip=d3.select(el).append('div').attr('class','g-tip');var sel;` +
    `function draw(){sea.attr('d',path);grat.attr('d',path);if(sel)sel.attr('d',path);}` +
    `d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(w){var f=topojson.feature(w,w.objects.countries).features;` +
    `sel=cG.selectAll('path').data(f).enter().append('path').attr('class',function(d){return D[d.id]?'g-on':'g-off';})` +
    `.on('mouseover',function(e,d){if(!D[d.id])return;tip.style('opacity',1).text(D[d.id].name+' \\u00b7 '+D[d.id].p+' producers \\u00b7 '+D[d.id].l+' lots');})` +
    `.on('mousemove',function(e){var b=el.getBoundingClientRect();tip.style('left',(e.clientX-b.left+12)+'px').style('top',(e.clientY-b.top+12)+'px');})` +
    `.on('mouseout',function(){tip.style('opacity',0);})` +
    `.on('click',function(e,d){if(D[d.id])location.href='/library/countries/'+D[d.id].code;});draw();}).catch(function(){draw();});` +
    `var v0,r0;svg.call(d3.drag().on('start',function(e){v0=[e.x,e.y];r0=proj.rotate();})` +
    `.on('drag',function(e){var k=0.4;proj.rotate([r0[0]+(e.x-v0[0])*k,Math.max(-85,Math.min(85,r0[1]-(e.y-v0[1])*k))]);draw();}));` +
    `draw();}if(document.readyState!='loading')go();else document.addEventListener('DOMContentLoaded',go);})();</script>` +
    `</section>`;
  return seoShell({
    title: "Coffee origin countries — ppmgauge",
    desc: `Interactive globe of ${rows.length} coffee-producing countries — click through to ${totalP.toLocaleString()} producers and ${totalL.toLocaleString()} lots, seed-to-cup.`,
    canonical: `${SITE}/library/map`, index: true, user, navCurrent: "library",
    crumbs: `<a href="/library">Library</a><span aria-current="page">Countries</span>`,
  }, inner);
}

// GET /library/producers — the producer ledger (crawl entry point), best-scored first, paginated.
export async function producersIndex(req: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const per = 60, off = (page - 1) * per;
  const totalRow: any = await env.DB.prepare("SELECT COUNT(*) n FROM ref_producers").first();
  const total = totalRow?.n || 0; const pages = Math.max(1, Math.ceil(total / per));
  const res = await env.DB.prepare(
    `SELECT p.id, p.name, co.name country, COUNT(c.id) lots, MAX(c.published_score) top
     FROM ref_producers p LEFT JOIN ref_countries co ON co.code=p.country_code LEFT JOIN ref_coffees c ON c.producer_id=p.id
     GROUP BY p.id ORDER BY (MAX(c.published_score) IS NULL), MAX(c.published_score) DESC, p.name LIMIT ? OFFSET ?`
  ).bind(per, off).all();
  const rows = (res.results || []) as any[];
  const body = rows.map((r) =>
    `<tr><th class="left"><a href="/library/producers/${encodeURIComponent(r.id)}">${esc(r.name)}</a></th>` +
    `<td>${esc(r.country || "")}</td><td class="numeric data">${r.lots || 0}</td>` +
    `<td class="numeric">${r.top != null ? `<b>${r.top}</b>` : "<span class=\"data\">—</span>"}</td></tr>`).join("");
  const pager =
    `<nav class="pager" style="margin-top:var(--space-4)">` +
    (page > 1 ? `<a class="prev" href="/library/producers?page=${page - 1}">Previous</a>` : `<span class="prev muted">Previous</span>`) +
    `<span class="data">Page ${page} / ${pages} · ${total} producers</span>` +
    (page < pages ? `<a class="next" href="/library/producers?page=${page + 1}">Next</a>` : `<span class="next muted">Next</span>`) +
    `</nav>`;
  const inner =
    `<section class="section">` +
    `<table class="ledger">` +
    `<caption>Producers <span class="data" style="font-weight:400">— farms, estates and washing stations in the ppmgauge graph, best cup score first.</span></caption>` +
    `<thead><tr><th class="left">Producer</th><th class="left">Country</th><th class="left">Lots</th><th class="left">Top</th></tr></thead><tbody>${body}</tbody></table>` +
    pager + `</section>`;
  return seoShell({
    title: "Coffee producers — ppmgauge", desc: `${total} coffee farms, estates and washing stations in the ppmgauge reference, with their lots and cup scores.`,
    canonical: `${SITE}/library/producers${page > 1 ? `?page=${page}` : ""}`, index: page === 1,
    user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Producers</span>`,
  }, inner);
}

// GET /library/roasters — the roaster directory (crawl entry point), A→Z.
export async function roastersIndex(req: Request, env: Env, user: User | null): Promise<Response> {
  const rows = ((await env.DB.prepare(
    `SELECT r.id, r.name, r.city, co.name country, COUNT(c.id) lots
     FROM ref_roasters r LEFT JOIN ref_countries co ON co.code=r.country_code LEFT JOIN ref_coffees c ON c.roaster_id=r.id
     GROUP BY r.id ORDER BY r.name`
  ).all()).results || []) as any[];
  const body = rows.map((r) =>
    `<tr><th class="left"><a href="/library/roasters/${encodeURIComponent(r.id)}">${esc(r.name)}</a></th>` +
    `<td>${esc([r.city, r.country].filter(Boolean).join(", "))}</td><td class="numeric data">${r.lots || 0}</td></tr>`).join("");
  const inner =
    `<section class="section">` +
    `<table class="ledger">` +
    `<caption>Roasters <span class="data" style="font-weight:400">— specialty coffee roasters in the ppmgauge graph and the lots they’ve roasted.</span></caption>` +
    `<thead><tr><th class="left">Roaster</th><th class="left">Location</th><th class="left">Lots</th></tr></thead><tbody>${body}</tbody></table>` +
    `</section>`;
  return seoShell({
    title: "Coffee roasters — ppmgauge", desc: `${rows.length} specialty coffee roasters in the ppmgauge reference, with the lots they roast.`,
    canonical: `${SITE}/library/roasters`, index: true, user, navCurrent: "library",
    crumbs: `<a href="/library">Library</a><span aria-current="page">Roasters</span>`,
  }, inner);
}

// GET /library/roasters/:id — public roaster page: facts + the lots they’ve roasted.
export async function roasterPage(req: Request, env: Env, id: string, user: User | null): Promise<Response> {
  const r: any = await env.DB.prepare("SELECT * FROM ref_roasters WHERE id=?").bind(id).first();
  if (!r) return refNotFound(user, "roaster", "Roasters", "/library/roasters");
  const country: any = r.country_code ? await env.DB.prepare("SELECT name FROM ref_countries WHERE code=?").bind(r.country_code).first() : null;
  const lots = ((await env.DB.prepare(
    `SELECT c.id, c.name, c.crop_year, c.published_score, p.id pid, p.name pname, co.name country
     FROM ref_coffees c LEFT JOIN ref_producers p ON p.id=c.producer_id LEFT JOIN ref_countries co ON co.code=c.country_code
     WHERE c.roaster_id=? ORDER BY (c.published_score IS NULL), c.published_score DESC, c.crop_year DESC LIMIT 100`
  ).bind(id).all()).results || []) as any[];
  const scores = lots.map((l) => l.published_score).filter((s) => s != null) as number[];
  const top = scores.length ? Math.max(...scores) : null;
  const place = [r.city, country?.name].filter(Boolean).join(", ");
  const thin = lots.length < 1 && !r.about;  // an about blurb or any lots → worth indexing

  // prev/next across all roasters (A→Z), mirroring the index order.
  const ord = ((await env.DB.prepare("SELECT id,name FROM ref_roasters ORDER BY name").all()).results || []) as any[];
  const oi = ord.findIndex((x) => x.id === id);
  const prev = oi > 0 ? ord[oi - 1] : null;
  const next = oi >= 0 && oi < ord.length - 1 ? ord[oi + 1] : null;
  const detailPager = (prev || next)
    ? `<nav class="pager" style="margin-top:var(--space-5)">` +
      (prev ? `<a class="prev" href="/library/roasters/${encodeURIComponent(prev.id)}">${esc(prev.name)}</a>` : `<span class="prev muted">Start of list</span>`) +
      `<span class="data">${oi + 1} / ${ord.length}</span>` +
      (next ? `<a class="next" href="/library/roasters/${encodeURIComponent(next.id)}">${esc(next.name)}</a>` : `<span class="next muted">End of list</span>`) +
      `</nav>`
    : "";

  const stat = (label: string, val: string, hint?: string) =>
    `<div style="flex:1;min-width:90px"><div class="data" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em">${label}</div>` +
    `<div class="numeric" style="font-size:1.35rem;font-weight:600;line-height:1.15">${val}</div>` +
    (hint ? `<div class="data" style="font-size:.72rem">${hint}</div>` : "") + `</div>`;
  const row = (h: string, d: string) => (d ? `<tr><th>${esc(h)}</th><td>${d}</td></tr>` : "");
  const webHost = r.website ? String(r.website).replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const webCell = r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(webHost)}</a>` : "";

  const inner =
    `<section class="section">` +
    `<span class="eyebrow">roaster${place ? ` · ${esc(place)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(r.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">coffee roaster · <span class="tag">${esc(r.confidence || "medium")} confidence</span></p>` +
    (lots.length
      ? `<div class="cluster" style="gap:var(--space-4);flex-wrap:wrap;border-top:2px solid var(--text);border-bottom:1px solid var(--rule);padding:var(--space-3) 0">` +
        stat("Lots", String(lots.length)) +
        (top != null ? stat("Top score", String(top), "cup points") : "") +
        `</div>`
      : "") +
    (r.about ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">About</th></tr></thead><tbody><tr><td class="left" style="border-left:4px solid var(--rule)">${esc(r.about)}</td></tr></tbody></table>` : "") +
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">Roaster</th></tr></thead><tbody>` +
    row("Location", esc(place)) +
    row("Founded", esc(r.founded || "")) +
    row("Website", webCell) +
    row("Instagram", r.instagram ? `<a href="https://instagram.com/${esc(r.instagram)}" target="_blank" rel="noopener">@${esc(r.instagram)}</a>` : "") +
    row("Source", esc(r.source || "")) +
    `</tbody></table>` +
    (r.lat != null && r.lng != null ? locatorMap(r.lat, r.lng, place) : "") +
    lotsLedger(lots.map((l) => coffeeLotRow(l)).join(""), lots.length) +
    detailPager +
    `</section>`;
  return seoShell({
    title: `${r.name} — coffee roaster · ppmgauge`,
    desc: r.about ? String(r.about).slice(0, 200) : `${r.name}${place ? ` (${place})` : ""} — specialty coffee roaster${lots.length ? ` with ${lots.length} lot${lots.length === 1 ? "" : "s"} on ppmgauge` : ""}.`,
    canonical: `${SITE}/library/roasters/${encodeURIComponent(id)}`, index: !thin, user, navCurrent: "library",
    crumbs: `<a href="/library">Library</a><a href="/library/roasters">Roasters</a><span aria-current="page">${esc(r.name)}</span>`,
    jsonLd: { "@context": "https://schema.org", "@type": "Organization", name: r.name, ...(r.website ? { url: r.website } : {}), ...(place ? { address: { "@type": "PostalAddress", ...(r.city ? { addressLocality: r.city } : {}), ...(country?.name ? { addressCountry: country.name } : {}) } } : {}) },
  }, inner);
}

// GET /library/lots — the lots ledger (crawl entry point), best-scored first, paginated.
export async function coffeesIndex(req: Request, env: Env, url: URL, user: User | null): Promise<Response> {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1") || 1);
  const per = 60, off = (page - 1) * per;
  const totalRow: any = await env.DB.prepare("SELECT COUNT(*) n FROM ref_coffees").first();
  const total = totalRow?.n || 0; const pages = Math.max(1, Math.ceil(total / per));
  const res = await env.DB.prepare(
    `SELECT c.id, c.name, c.crop_year, c.published_score, p.id pid, p.name pname, co.name country
     FROM ref_coffees c LEFT JOIN ref_producers p ON p.id=c.producer_id LEFT JOIN ref_countries co ON co.code=c.country_code
     ORDER BY (c.published_score IS NULL), c.published_score DESC, c.name LIMIT ? OFFSET ?`
  ).bind(per, off).all();
  const rows = (res.results || []) as any[];
  const body = rows.map((c) => coffeeLotRow(c)).join("");
  const pager =
    `<nav class="pager" style="margin-top:var(--space-4)">` +
    (page > 1 ? `<a class="prev" href="/library/lots?page=${page - 1}">Previous</a>` : `<span class="prev muted">Previous</span>`) +
    `<span class="data">Page ${page} / ${pages} · ${total.toLocaleString()} lots</span>` +
    (page < pages ? `<a class="next" href="/library/lots?page=${page + 1}">Next</a>` : `<span class="next muted">Next</span>`) +
    `</nav>`;
  const inner =
    `<section class="section">` +
    `<table class="ledger">` +
    `<caption>Lots <span class="data" style="font-weight:400">— individual competition & reference coffees in the graph, best cup score first.</span></caption>` +
    `<thead><tr><th class="left">Coffee</th><th class="left">Producer</th><th class="left">Score</th></tr></thead><tbody>${body}</tbody></table>` +
    pager + `</section>`;
  return seoShell({
    title: "Coffee lots — ppmgauge", desc: `${total.toLocaleString()} individual coffee lots — competition winners and reference coffees, with producer and cup score.`,
    canonical: `${SITE}/library/lots${page > 1 ? `?page=${page}` : ""}`, index: page === 1,
    user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Lots</span>`,
  }, inner);
}

// GET /library/varieties/:slug — variety reference: genealogy + the lots that use it.
export async function varietyPage(req: Request, env: Env, slug: string, user: User | null): Promise<Response> {
  const v: any = await env.DB.prepare("SELECT * FROM ref_varieties WHERE id=?").bind(slug).first();
  if (!v) return refNotFound(user, "variety", "Varieties", "/library/varieties");
  const parents = ((await env.DB.prepare(`SELECT vr.id,vr.name,l.relation FROM ref_variety_lineage l JOIN ref_varieties vr ON vr.id=l.parent_id WHERE l.child_id=? ORDER BY vr.name`).bind(slug).all()).results || []) as any[];
  const children = ((await env.DB.prepare(`SELECT vr.id,vr.name,l.relation FROM ref_variety_lineage l JOIN ref_varieties vr ON vr.id=l.child_id WHERE l.parent_id=? ORDER BY vr.name`).bind(slug).all()).results || []) as any[];
  const coffees = ((await env.DB.prepare(
    `SELECT c.id,c.name,c.crop_year,c.lot_number,c.published_score, p.id pid, p.name pname, co.name country
     FROM ref_coffee_varieties cv JOIN ref_coffees c ON c.id=cv.coffee_id
     LEFT JOIN ref_producers p ON p.id=c.producer_id LEFT JOIN ref_countries co ON co.code=c.country_code
     WHERE cv.variety_id=? ORDER BY (c.published_score IS NULL), c.published_score DESC, c.crop_year DESC LIMIT 40`
  ).bind(slug).all()).results || []) as any[];
  const cnt: any = await env.DB.prepare("SELECT COUNT(*) n FROM ref_coffee_varieties WHERE variety_id=?").bind(slug).first();
  const lotCount = cnt?.n || 0;
  const fam = varietyFamily(v.lineage);
  const aliases = jsonArr(v.aliases);
  const top = coffees.length && coffees[0].published_score != null ? coffees[0].published_score : null;
  const lTag = (x: any) => `<a class="tag" href="/library/varieties/${encodeURIComponent(x.id)}">${esc(x.name)}${x.relation ? ` <span class="data">${esc(x.relation)}</span>` : ""}</a>`;

  const facts =
    seoRow("Species", esc(v.species || "")) +
    seoRow("Family", `<span class="cluster gap" style="align-items:center"><i data-icon="${fam.icon}"></i> ${esc(fam.label)}</span>`) +
    seoRow("Lineage", esc(v.lineage || "")) +
    seoRow("Optimal altitude", esc(fmtAlt(v.optimal_alt_min_m, v.optimal_alt_max_m))) +
    seoRow("Yield", esc(v.yield_potential || "")) +
    seoRow("Leaf-rust", esc(v.rust_resistance || "")) +
    seoRow("Bean size", esc(v.bean_size || "")) +
    seoRow("In the cup", esc(v.flavor_potential || "")) +
    seoRow("Also known as", aliases.map(esc).join(", ")) +
    (v.source_url ? seoRow("Source", `<a href="${esc(v.source_url)}" class="data" target="_blank" rel="noopener">${esc(v.source || "source")}</a>`) : "");

  const inner =
    `<section class="section">` +
    `<span class="eyebrow"><i data-icon="${fam.icon}"></i> ${esc(v.species || "coffee")} variety</span>` +
    `<h1 style="margin:6px 0 2px">${esc(v.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">${esc(fam.label)}</p>` +
    seoStrip([seoStat("Lots", String(lotCount), "on ppmgauge"), top != null ? seoStat("Top score", String(top), "cup points") : "", parents.length ? seoStat("Parents", String(parents.length)) : "", children.length ? seoStat("Descendants", String(children.length)) : ""]) +
    seoAbout("About", v.notes || "") +
    seoLed("Variety", "World Coffee Research", facts) +
    seoTags("Parent varieties", parents.map(lTag).join("")) +
    seoTags("Descended varieties", children.map(lTag).join("")) +
    lotsLedger(coffees.map(coffeeLotRow).join(""), lotCount) +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/varieties">← All varieties</a> <a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;

  const desc = String(v.flavor_potential ? `${v.name}: ${v.flavor_potential}.` : v.notes ? v.notes : `${v.name}, ${v.species} coffee variety.`).slice(0, 200);
  const jsonLd = { "@context": "https://schema.org", "@type": "DefinedTerm", name: v.name, ...(v.notes || v.flavor_potential ? { description: v.notes || v.flavor_potential } : {}), inDefinedTermSet: `${SITE}/library/varieties` };
  return seoShell({ title: `${v.name} — coffee variety · ppmgauge`, desc, canonical: `${SITE}/library/varieties/${encodeURIComponent(slug)}`, jsonLd, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/varieties">Varieties</a><span aria-current="page">${esc(v.name)}</span>` }, inner);
}

// GET /library/regions/:slug — origin reference: terroir + producers working there.
export async function regionPage(req: Request, env: Env, slug: string, user: User | null): Promise<Response> {
  const r: any = await env.DB.prepare("SELECT * FROM ref_regions WHERE id=?").bind(slug).first();
  if (!r) return refNotFound(user, "region", "Regions", "/library/regions");
  const country: any = r.country_code ? await env.DB.prepare("SELECT name,hemisphere FROM ref_countries WHERE code=?").bind(r.country_code).first() : null;
  const harvest = ((await env.DB.prepare("SELECT label,start_month,end_month FROM ref_harvest_windows WHERE country_code=? ORDER BY rowid").bind(r.country_code).all()).results || []) as any[];
  const producers = ((await env.DB.prepare(
    `SELECT p.id,p.name,p.kind, COUNT(c.id) lots, MAX(c.published_score) top FROM ref_producers p
     LEFT JOIN ref_coffees c ON c.producer_id=p.id WHERE p.region_id=?
     GROUP BY p.id ORDER BY (MAX(c.published_score) IS NULL), MAX(c.published_score) DESC, p.name LIMIT 60`
  ).bind(slug).all()).results || []) as any[];
  const procIds = jsonArr(r.typical_processes);
  const procMap: Record<string, string> = {};
  for (const pr of ((await env.DB.prepare("SELECT id,name FROM ref_processes").all()).results || []) as any[]) procMap[pr.id] = pr.name;
  const aliases = jsonArr(r.aliases);
  const harvestStr = harvest.map((h) => [h.label, h.start_month && h.end_month ? `${PP_MONTHS[h.start_month]}–${PP_MONTHS[h.end_month]}` : ""].filter(Boolean).join(" ")).filter(Boolean).join(" · ");
  const procTags = procIds.map((id) => `<a class="tag" href="/library/processes/${encodeURIComponent(id)}">${esc(procMap[id] || id)}</a>`).join("");
  const top = producers.length ? producers.map((p) => p.top).filter((s) => s != null)[0] ?? null : null;

  const facts =
    seoRow("Country", esc(country?.name || r.country_code || "")) +
    seoRow("Altitude", esc(fmtAlt(r.altitude_min_m, r.altitude_max_m))) +
    seoRow("Harvest", esc(harvestStr)) +
    seoRow("Coordinates", r.lat != null && r.lng != null ? `<span class="data numeric">${esc(r.lat)}, ${esc(r.lng)}</span>` : "") +
    seoRow("Also known as", aliases.map(esc).join(", "));

  const prodRows = producers.map((p) =>
    `<tr><th class="left"><a href="/library/producers/${encodeURIComponent(p.id)}">${esc(p.name)}</a>${p.kind ? ` <span class="data">${esc(p.kind)}</span>` : ""}</th>` +
    `<td class="numeric data">${p.lots || 0}</td><td class="numeric">${p.top != null ? `<b>${p.top}</b>` : '<span class="data">—</span>'}</td></tr>`).join("");

  const inner =
    `<section class="section">` +
    `<span class="eyebrow">coffee region${country ? ` · ${esc(country.name)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(r.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">${esc(fmtAlt(r.altitude_min_m, r.altitude_max_m) || "specialty origin")}</p>` +
    seoStrip([seoStat("Producers", String(producers.length), "on ppmgauge"), top != null ? seoStat("Top score", String(top), "cup points") : ""]) +
    seoLed("Origin", "reference", facts) +
    (r.lat != null && r.lng != null ? locatorMap(r.lat, r.lng, `${r.name}${country ? `, ${country.name}` : ""}`) : "") +
    seoTags("Typical processes", procTags) +
    (producers.length
      ? `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">Producer</th><th class="left">Lots</th><th class="left">Top</th></tr></thead><tbody>${prodRows}</tbody></table>`
      : `<p class="data" style="margin-top:var(--space-4)">No producers recorded in this region yet.</p>`) +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/regions">← All regions</a> <a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;

  const desc = `${r.name}${country ? `, ${country.name}` : ""} — coffee growing region${r.altitude_min_m ? ` at ${fmtAlt(r.altitude_min_m, r.altitude_max_m)}` : ""}.${producers.length ? ` ${producers.length} producer(s) on ppmgauge.` : ""}`.slice(0, 200);
  const jsonLd: any = {
    "@context": "https://schema.org", "@type": "Place", name: `${r.name}${country ? `, ${country.name}` : ""}`,
    ...(country ? { address: { "@type": "PostalAddress", addressCountry: country.name } } : {}),
    ...(r.lat != null && r.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng } } : {}),
  };
  return seoShell({ title: `${r.name}${country ? `, ${country.name}` : ""} — coffee region · ppmgauge`, desc, canonical: `${SITE}/library/regions/${encodeURIComponent(slug)}`, jsonLd, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/regions">Regions</a><span aria-current="page">${esc(r.name)}</span>` }, inner);
}

// GET /library/processes/:slug — processing-method reference: what happens + example lots.
export async function processPage(req: Request, env: Env, slug: string, user: User | null): Promise<Response> {
  const pr: any = await env.DB.prepare("SELECT * FROM ref_processes WHERE id=?").bind(slug).first();
  if (!pr) return refNotFound(user, "process", "Processes", "/library/processes");
  const coffees = ((await env.DB.prepare(
    `SELECT c.id,c.name,c.crop_year,c.lot_number,c.published_score, p.id pid, p.name pname, co.name country
     FROM ref_coffees c LEFT JOIN ref_producers p ON p.id=c.producer_id LEFT JOIN ref_countries co ON co.code=c.country_code
     WHERE c.process_id=? ORDER BY (c.published_score IS NULL), c.published_score DESC, c.crop_year DESC LIMIT 40`
  ).bind(slug).all()).results || []) as any[];
  const cnt: any = await env.DB.prepare("SELECT COUNT(*) n FROM ref_coffees WHERE process_id=?").bind(slug).first();
  const lotCount = cnt?.n || 0;
  const regionsTypical = ((await env.DB.prepare(`SELECT id,name FROM ref_regions WHERE typical_processes LIKE ? ORDER BY name`).bind(`%"${slug}"%`).all()).results || []) as any[];
  const related = ((await env.DB.prepare(`SELECT id,name FROM ref_processes WHERE category=? AND id!=? ORDER BY name`).bind(pr.category, slug).all()).results || []) as any[];
  const aliases = jsonArr(pr.aliases);
  const top = coffees.length && coffees[0].published_score != null ? coffees[0].published_score : null;

  const facts =
    seoRow("Category", esc(pr.category || "")) +
    seoRow("In the cup", esc(pr.flavor_effect || "")) +
    seoRow("Also known as", aliases.map(esc).join(", "));

  const inner =
    `<section class="section">` +
    `<span class="eyebrow">processing method${pr.category ? ` · ${esc(pr.category)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(pr.name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">${esc(pr.flavor_effect || "")}</p>` +
    seoStrip([seoStat("Lots", String(lotCount), "on ppmgauge"), top != null ? seoStat("Top score", String(top), "cup points") : ""]) +
    seoAbout("What happens", pr.explainer || "") +
    seoLed("Process", "reference", facts) +
    seoTags("Typical in regions", regionsTypical.map((x) => `<a class="tag" href="/library/regions/${encodeURIComponent(x.id)}">${esc(x.name)}</a>`).join("")) +
    seoTags("Related methods", related.map((x) => `<a class="tag" href="/library/processes/${encodeURIComponent(x.id)}">${esc(x.name)}</a>`).join("")) +
    lotsLedger(coffees.map(coffeeLotRow).join(""), lotCount) +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/processes">← All processes</a> <a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;

  const desc = String(pr.explainer || pr.flavor_effect || `${pr.name} coffee processing method.`).slice(0, 200);
  const jsonLd = { "@context": "https://schema.org", "@type": "DefinedTerm", name: pr.name, ...(pr.explainer ? { description: pr.explainer } : {}), inDefinedTermSet: `${SITE}/library/processes` };
  return seoShell({ title: `${pr.name} coffee process — ppmgauge`, desc, canonical: `${SITE}/library/processes/${encodeURIComponent(slug)}`, jsonLd, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/processes">Processes</a><span aria-current="page">${esc(pr.name)}</span>` }, inner);
}

// GET /library/lots/:id — single lot: the hub tying producer/variety/region/process/flavor together.
export async function coffeePage(req: Request, env: Env, id: string, user: User | null): Promise<Response> {
  const c: any = await env.DB.prepare("SELECT * FROM ref_coffees WHERE id=?").bind(id).first();
  if (!c) return refNotFound(user, "coffee lot", "Library", "/library");
  const producer: any = c.producer_id ? await env.DB.prepare("SELECT id,name,kind,country_code,region_id FROM ref_producers WHERE id=?").bind(c.producer_id).first() : null;
  const roaster: any = c.roaster_id ? await env.DB.prepare("SELECT id,name,website FROM ref_roasters WHERE id=?").bind(c.roaster_id).first() : null;
  const ccode = c.country_code || producer?.country_code;
  const country: any = ccode ? await env.DB.prepare("SELECT name FROM ref_countries WHERE code=?").bind(ccode).first() : null;
  const regId = c.region_id || producer?.region_id;
  const region: any = regId ? await env.DB.prepare("SELECT id,name,lat,lng FROM ref_regions WHERE id=?").bind(regId).first() : null;
  const process: any = c.process_id ? await env.DB.prepare("SELECT id,name,category FROM ref_processes WHERE id=?").bind(c.process_id).first() : null;
  const varieties = ((await env.DB.prepare(`SELECT v.id,v.name,v.lineage FROM ref_coffee_varieties cv JOIN ref_varieties v ON v.id=cv.variety_id WHERE cv.coffee_id=? ORDER BY v.name`).bind(id).all()).results || []) as any[];
  const flavors = ((await env.DB.prepare(`SELECT f.id,f.name,f.color FROM ref_coffee_flavors cf JOIN ref_flavors f ON f.id=cf.flavor_id WHERE cf.coffee_id=? ORDER BY f.name`).bind(id).all()).results || []) as any[];

  const label = coffeeLabel(c, producer?.name);
  const place = [region?.name, country?.name].filter(Boolean).join(", ");
  const thin = c.published_score == null && varieties.length === 0 && flavors.length === 0;
  const conf = `${esc(c.confidence || "low")} confidence`;

  const facts =
    seoRow("Producer", producer ? `<a href="/library/producers/${encodeURIComponent(producer.id)}">${esc(producer.name)}</a>${producer.kind ? ` <span class="data">${esc(producer.kind)}</span>` : ""}` : "") +
    seoRow("Roaster", roaster ? (roaster.website ? `<a href="${esc(roaster.website)}" class="data" target="_blank" rel="noopener">${esc(roaster.name)}</a>` : esc(roaster.name)) : "") +
    seoRow("Country", esc(country?.name || "")) +
    seoRow("Region", region ? `<a href="/library/regions/${encodeURIComponent(region.id)}">${esc(region.name)}</a>` : "") +
    seoRow("Process", process ? `<a href="/library/processes/${encodeURIComponent(process.id)}">${esc(process.name)}</a>${process.category ? ` <span class="data">${esc(process.category)}</span>` : ""}` : "") +
    seoRow("Crop year", esc(c.crop_year || "")) +
    seoRow("Lot number", esc(c.lot_number || "")) +
    seoRow("Roast level", esc(c.roast_level || "")) +
    seoRow("Cup score", c.published_score != null ? `<b>${c.published_score}</b>${c.score_source ? ` <span class="data">${esc(c.score_source)}</span>` : ""}` : "") +
    seoRow("Price", c.price != null ? `<span class="numeric">${esc(c.price)}${c.currency ? ` ${esc(c.currency)}` : ""}</span>${c.weight_g ? ` <span class="data">/ ${esc(c.weight_g)} g</span>` : ""}` : "") +
    (c.source_url ? seoRow("Source", `<a href="${esc(c.source_url)}" class="data" target="_blank" rel="noopener">${esc(c.source || "source")}</a>`) : seoRow("Source", esc(c.source || "")));

  const varTags = varieties.map((v) => { const fam = varietyFamily(v.lineage); return `<a class="tag" href="/library/varieties/${encodeURIComponent(v.id)}"><i data-icon="${fam.icon}"></i> ${esc(v.name)}</a>`; }).join("");
  const flavTags = flavors.map((f) => `<a class="tag" href="/library/flavors">${flavorSwatch(f.color)}${esc(f.name)}</a>`).join("");

  // Locator: the lot's region coords if known, else its country centroid.
  let locHtml = "";
  {
    let la = region?.lat, ln = region?.lng, cap = "";
    if (la != null && ln != null) cap = `${region.name}${country ? `, ${country.name}` : ""}`;
    else if (ccode) {
      const cc2: any = await env.DB.prepare("SELECT AVG(lat) la, AVG(lng) ln FROM ref_regions WHERE country_code=? AND lat IS NOT NULL").bind(ccode).first();
      if (cc2 && cc2.la != null) { la = cc2.la; ln = cc2.ln; cap = `${country?.name || ccode} · country-level`; }
    }
    if (la != null && ln != null) locHtml = locatorMap(la, ln, cap);
  }

  const inner =
    `<section class="section">` +
    `<span class="eyebrow">coffee lot${place ? ` · ${esc(place)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(label)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">${producer ? `<a href="/library/producers/${encodeURIComponent(producer.id)}">${esc(producer.name)}</a> · ` : ""}<span class="tag">${conf}</span></p>` +
    seoStrip([c.published_score != null ? seoStat("Cup score", String(c.published_score), c.score_source || "cup points") : "", varieties.length ? seoStat("Varieties", String(varieties.length)) : "", c.crop_year ? seoStat("Crop", String(c.crop_year)) : ""]) +
    seoLed("Lot", conf, facts) +
    locHtml +
    seoTags("Varieties", varTags) +
    seoTags("Tasting notes", flavTags) +
    `<p style="margin-top:var(--space-5)">${producer ? `<a class="button sm secondary" href="/library/producers/${encodeURIComponent(producer.id)}">← ${esc(producer.name)}</a> ` : ""}<a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;

  const desc = `${label}${producer ? ` from ${producer.name}` : ""}${place ? `, ${place}` : ""}.${c.published_score != null ? ` Cup score ${c.published_score}.` : ""}${varieties.length ? ` ${varieties.map((v) => v.name).join(", ")}.` : ""}`.slice(0, 200);
  const titleBase = producer && !label.toLowerCase().includes(producer.name.toLowerCase()) ? `${label} — ${producer.name}` : label;
  // Breadcrumb: Library / Lot / [name] (producer stays linked in the body + back button).
  return seoShell({ title: `${titleBase} · ppmgauge`, desc, canonical: `${SITE}/library/lots/${encodeURIComponent(id)}`, index: !thin, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/lots">Lot</a><span aria-current="page">${esc(label)}</span>` }, inner);
}

// GET /library/varieties — curated variety index (crawl entry point), most-used first.
export async function varietiesIndex(req: Request, env: Env, user: User | null): Promise<Response> {
  const rows = ((await env.DB.prepare(
    `SELECT v.id,v.name,v.species,v.lineage,v.optimal_alt_min_m,v.optimal_alt_max_m, COUNT(cv.coffee_id) lots
     FROM ref_varieties v LEFT JOIN ref_coffee_varieties cv ON cv.variety_id=v.id
     GROUP BY v.id ORDER BY lots DESC, v.name`
  ).all()).results || []) as any[];
  const body = rows.map((r) => {
    const fam = varietyFamily(r.lineage);
    return `<tr><th class="left"><a href="/library/varieties/${encodeURIComponent(r.id)}"><i data-icon="${fam.icon}"></i> ${esc(r.name)}</a></th>` +
      `<td>${esc(r.species || "")}</td><td class="data">${esc(fmtAlt(r.optimal_alt_min_m, r.optimal_alt_max_m))}</td><td class="numeric data">${r.lots || 0}</td></tr>`;
  }).join("");
  const inner =
    `<section class="section">` +
    `<h1 style="margin:0 0 2px">Coffee varieties</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">Arabica cultivars in the ppmgauge graph — genealogy, terroir and the lots that grow them.</p>` +
    `<table class="ledger"><thead><tr><th class="left">Variety</th><th class="left">Species</th><th class="left">Optimal</th><th class="left">Lots</th></tr></thead><tbody>${body}</tbody></table>` +
    `</section>`;
  return seoShell({ title: "Coffee varieties — ppmgauge", desc: `${rows.length} arabica varieties with genealogy, optimal altitude and the lots that grow them.`, canonical: `${SITE}/library/varieties`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Varieties</span>` }, inner);
}

// GET /library/regions — curated origin index.
export async function regionsIndex(req: Request, env: Env, user: User | null): Promise<Response> {
  const rows = ((await env.DB.prepare(
    `SELECT r.id,r.name, co.name country, r.altitude_min_m,r.altitude_max_m, COUNT(DISTINCT p.id) producers
     FROM ref_regions r LEFT JOIN ref_countries co ON co.code=r.country_code LEFT JOIN ref_producers p ON p.region_id=r.id
     GROUP BY r.id ORDER BY co.name, r.name`
  ).all()).results || []) as any[];
  const body = rows.map((r) => {
    const alt = fmtAlt(r.altitude_min_m, r.altitude_max_m);
    return `<tr><th class="left"><a href="/library/regions/${encodeURIComponent(r.id)}">${esc(r.name)}</a>${alt ? `<br><span class="data" style="font-weight:400">${esc(alt)}</span>` : ""}</th>` +
      `<td>${esc(r.country || "")}</td><td class="numeric data">${r.producers || 0}</td></tr>`;
  }).join("");
  const inner =
    `<section class="section">` +
    `<h1 style="margin:0 0 2px">Coffee regions</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">Signature growing regions — altitude band, harvest window and the producers working there.</p>` +
    `<table class="ledger"><thead><tr><th class="left">Region</th><th class="left">Country</th><th class="left">Producers</th></tr></thead><tbody>${body}</tbody></table>` +
    `</section>`;
  return seoShell({ title: "Coffee regions — ppmgauge", desc: `${rows.length} specialty coffee regions with altitude bands, harvest windows and their producers.`, canonical: `${SITE}/library/regions`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Regions</span>` }, inner);
}

// GET /library/processes — curated processing-method index.
export async function processesIndex(req: Request, env: Env, user: User | null): Promise<Response> {
  const rows = ((await env.DB.prepare(
    `SELECT pr.id,pr.name,pr.category,pr.flavor_effect, COUNT(c.id) lots
     FROM ref_processes pr LEFT JOIN ref_coffees c ON c.process_id=pr.id
     GROUP BY pr.id ORDER BY pr.category, lots DESC, pr.name`
  ).all()).results || []) as any[];
  const body = rows.map((r) =>
    `<tr><th class="left"><a href="/library/processes/${encodeURIComponent(r.id)}">${esc(r.name)}</a>${r.flavor_effect ? `<br><span class="data" style="font-weight:400">${esc(r.flavor_effect)}</span>` : ""}</th>` +
    `<td>${esc(r.category || "")}</td><td class="numeric data">${r.lots || 0}</td></tr>`).join("");
  const inner =
    `<section class="section">` +
    `<h1 style="margin:0 0 2px">Coffee processing methods</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">How the fruit is removed and dried — and how that shows up in the cup.</p>` +
    `<table class="ledger"><thead><tr><th class="left">Process</th><th class="left">Category</th><th class="left">Lots</th></tr></thead><tbody>${body}</tbody></table>` +
    `</section>`;
  return seoShell({ title: "Coffee processing methods — ppmgauge", desc: `${rows.length} coffee processing methods explained, with the cup signature and example lots.`, canonical: `${SITE}/library/processes`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Processes</span>` }, inner);
}

// ---- Gear reference pages (brewers + grinders) — clone of the taxonomy template ----

// Render a gear "Source" cell: a link when it's a URL, plain text otherwise.
const gearSource = (s: any) => {
  const v = String(s || "");
  return /^https?:\/\//.test(v)
    ? `<a href="${esc(v)}" class="data" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>`
    : esc(v);
};
// prev/next pager stepping the full ordered gear list (mirrors the producer detail pager).
function gearPager(ord: any[], id: string, base: string): string {
  const oi = ord.findIndex((r) => r.id === id);
  if (oi < 0) return "";
  const prev = oi > 0 ? ord[oi - 1] : null, next = oi < ord.length - 1 ? ord[oi + 1] : null;
  if (!prev && !next) return "";
  const label = (r: any) => esc(`${r.brand} ${r.model}`.trim());
  return `<nav class="pager" style="margin-top:var(--space-5)">` +
    (prev ? `<a class="prev" href="${base}/${encodeURIComponent(prev.id)}">${label(prev)}</a>` : `<span class="prev muted">Start of list</span>`) +
    `<span class="data">${oi + 1} / ${ord.length}</span>` +
    (next ? `<a class="next" href="${base}/${encodeURIComponent(next.id)}">${label(next)}</a>` : `<span class="next muted">End of list</span>`) +
    `</nav>`;
}

// GET /library/brewers — brand-ordered brewer index (crawl entry point).
export async function brewersIndex(req: Request, env: Env, user: User | null): Promise<Response> {
  const rows = ((await env.DB.prepare(
    `SELECT id,brand,model,type,signature,icon,discontinued FROM ref_brewers ORDER BY brand, sort, model`
  ).all()).results || []) as any[];
  const brands = new Set(rows.map((r) => r.brand)).size;
  const body = rows.map((r) =>
    `<tr><th class="left"><a href="/library/brewers/${encodeURIComponent(r.id)}"><i data-icon="${esc(r.icon || "dripper")}"></i> ${esc(r.model)}</a>${r.signature ? `<br><span class="data" style="font-weight:400">${esc(r.signature)}</span>` : ""}</th>` +
    `<td>${esc(r.brand || "")}</td><td>${esc(r.type || "")}${r.discontinued ? ' <span class="tag sm">disc.</span>' : ""}</td></tr>`).join("");
  const inner =
    `<section class="section">` +
    `<h1 style="margin:0 0 2px">Coffee brewers</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">Drippers, immersion brewers, siphons and machines — ${rows.length} models across ${brands} brands, with the cup signature of each.</p>` +
    `<table class="ledger"><thead><tr><th class="left">Brewer</th><th class="left">Brand</th><th class="left">Type</th></tr></thead><tbody>${body}</tbody></table>` +
    `</section>`;
  return seoShell({ title: "Coffee brewers — ppmgauge", desc: `${rows.length} pour-over, immersion and other coffee brewers across ${brands} brands, each with its cup signature.`, canonical: `${SITE}/library/brewers`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Brewers</span>` }, inner);
}

// GET /library/brewers/:slug — single brewer: signature + facts + compatible filters + siblings.
export async function brewerPage(req: Request, env: Env, slug: string, user: User | null): Promise<Response> {
  const b: any = await env.DB.prepare("SELECT * FROM ref_brewers WHERE id=?").bind(slug).first();
  if (!b) return refNotFound(user, "brewer", "Brewers", "/library/brewers");
  const siblings = ((await env.DB.prepare(`SELECT id,model FROM ref_brewers WHERE brand=? AND id!=? ORDER BY sort, model LIMIT 30`).bind(b.brand, slug).all()).results || []) as any[];
  // Compatible filters: brewer filter_format can be a "/"-joined list of accepted formats.
  const formats = String(b.filter_format || "").split("/").map((s) => s.trim()).filter(Boolean);
  let filters: any[] = [];
  if (formats.length) {
    const ph = formats.map(() => "?").join(",");
    filters = ((await env.DB.prepare(`SELECT id,brand,model,material FROM ref_filters WHERE format IN (${ph}) ORDER BY brand, sort LIMIT 24`).bind(...formats).all()).results || []) as any[];
  }
  const ord = ((await env.DB.prepare(`SELECT id,brand,model FROM ref_brewers ORDER BY brand, sort, model`).all()).results || []) as any[];
  const name = `${b.brand || ""} ${b.model || ""}`.trim();
  const conf = `${esc(b.confidence || "low")} confidence`;
  const facts =
    seoRow("Brand", esc(b.brand || "")) +
    seoRow("Type", esc(b.type || "")) +
    seoRow("Filter format", esc(b.filter_format || "")) +
    seoRow("Status", b.discontinued ? "Discontinued" : "In production") +
    seoRow("Source", gearSource(b.source));
  const inner =
    `<section class="section">` +
    `<span class="eyebrow"><i data-icon="${esc(b.icon || "dripper")}"></i> ${esc(b.type || "brewer")}${b.filter_format ? ` · ${esc(b.filter_format)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">coffee brewer · <span class="tag">${conf}</span></p>` +
    seoAbout("In the cup", b.signature || "") +
    seoLed("Brewer", "reference", facts) +
    seoTags("Compatible filters", filters.map((f) => `<a class="tag" href="/library/filters/${encodeURIComponent(f.id)}"><i data-icon="filter-flat"></i> ${esc(`${f.brand} ${f.model}`.trim())}</a>`).join("")) +
    seoTags(`More from ${esc(b.brand || "this brand")}`, siblings.map((s) => `<a class="tag" href="/library/brewers/${encodeURIComponent(s.id)}">${esc(s.model)}</a>`).join("")) +
    gearPager(ord, slug, "/library/brewers") +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/brewers">← All brewers</a> <a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;
  const desc = String(b.signature || `${name} coffee brewer.`).slice(0, 200);
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name, category: "Coffee brewer", ...(b.brand ? { brand: { "@type": "Brand", name: b.brand } } : {}), ...(b.signature ? { description: b.signature } : {}) };
  return seoShell({ title: `${name} — coffee brewer · ppmgauge`, desc, canonical: `${SITE}/library/brewers/${encodeURIComponent(slug)}`, jsonLd, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/brewers">Brewers</a><span aria-current="page">${esc(name)}</span>` }, inner);
}

// GET /library/grinders — brand-ordered grinder index.
export async function grindersIndex(req: Request, env: Env, user: User | null): Promise<Response> {
  const rows = ((await env.DB.prepare(
    `SELECT id,brand,model,hand_electric,burr_type,burr_mm,known_for,icon,discontinued FROM ref_grinders ORDER BY brand, sort, model`
  ).all()).results || []) as any[];
  const brands = new Set(rows.map((r) => r.brand)).size;
  const burrSpec = (r: any) => [r.burr_mm ? `${r.burr_mm}mm` : "", r.burr_type ? `${r.burr_type}` : ""].filter(Boolean).join(" ");
  const body = rows.map((r) =>
    `<tr><th class="left"><a href="/library/grinders/${encodeURIComponent(r.id)}"><i data-icon="${esc(r.icon || "grinder")}"></i> ${esc(r.model)}</a>${r.known_for ? `<br><span class="data" style="font-weight:400">${esc(r.known_for)}</span>` : ""}</th>` +
    `<td>${esc(r.brand || "")}</td><td>${esc(burrSpec(r))}${r.discontinued ? ' <span class="tag sm">disc.</span>' : ""}</td></tr>`).join("");
  const inner =
    `<section class="section">` +
    `<h1 style="margin:0 0 2px">Coffee grinders</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">Hand and electric burr grinders — ${rows.length} models across ${brands} brands, with what each is known for.</p>` +
    `<table class="ledger"><thead><tr><th class="left">Grinder</th><th class="left">Brand</th><th class="left">Burr</th></tr></thead><tbody>${body}</tbody></table>` +
    `</section>`;
  return seoShell({ title: "Coffee grinders — ppmgauge", desc: `${rows.length} hand and electric coffee grinders across ${brands} brands, with burr type and what each is known for.`, canonical: `${SITE}/library/grinders`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><span aria-current="page">Grinders</span>` }, inner);
}

// GET /library/grinders/:slug — single grinder: known-for + facts + siblings.
export async function grinderPage(req: Request, env: Env, slug: string, user: User | null): Promise<Response> {
  const g: any = await env.DB.prepare("SELECT * FROM ref_grinders WHERE id=?").bind(slug).first();
  if (!g) return refNotFound(user, "grinder", "Grinders", "/library/grinders");
  const siblings = ((await env.DB.prepare(`SELECT id,model FROM ref_grinders WHERE brand=? AND id!=? ORDER BY sort, model LIMIT 30`).bind(g.brand, slug).all()).results || []) as any[];
  const ord = ((await env.DB.prepare(`SELECT id,brand,model FROM ref_grinders ORDER BY brand, sort, model`).all()).results || []) as any[];
  const name = `${g.brand || ""} ${g.model || ""}`.trim();
  const conf = `${esc(g.confidence || "low")} confidence`;
  const drive = g.hand_electric === "hand" ? "Hand" : g.hand_electric === "electric" ? "Electric" : (g.hand_electric || "");
  const facts =
    seoRow("Brand", esc(g.brand || "")) +
    seoRow("Drive", esc(drive)) +
    seoRow("Burr type", esc(g.burr_type || "")) +
    seoRow("Burr size", g.burr_mm ? `${esc(String(g.burr_mm))} mm` : "") +
    seoRow("Status", g.discontinued ? "Discontinued" : "In production") +
    seoRow("Source", gearSource(g.source));
  const inner =
    `<section class="section">` +
    `<span class="eyebrow"><i data-icon="${esc(g.icon || "grinder")}"></i> ${esc(drive ? `${drive.toLowerCase()} grinder` : "grinder")}${g.burr_type ? ` · ${esc(g.burr_type)} burr` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">coffee grinder · <span class="tag">${conf}</span></p>` +
    seoAbout("Known for", g.known_for || "") +
    seoLed("Grinder", "reference", facts) +
    seoTags(`More from ${esc(g.brand || "this brand")}`, siblings.map((s) => `<a class="tag" href="/library/grinders/${encodeURIComponent(s.id)}">${esc(s.model)}</a>`).join("")) +
    gearPager(ord, slug, "/library/grinders") +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/grinders">← All grinders</a> <a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;
  const desc = String(g.known_for || `${name} coffee grinder.`).slice(0, 200);
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name, category: "Coffee grinder", ...(g.brand ? { brand: { "@type": "Brand", name: g.brand } } : {}), ...(g.known_for ? { description: g.known_for } : {}) };
  return seoShell({ title: `${name} — coffee grinder · ppmgauge`, desc, canonical: `${SITE}/library/grinders/${encodeURIComponent(slug)}`, jsonLd, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/grinders">Grinders</a><span aria-current="page">${esc(name)}</span>` }, inner);
}

// GET /library/filters/:slug — single filter (linked from brewer "compatible filters").
export async function filterPage(req: Request, env: Env, slug: string, user: User | null): Promise<Response> {
  const f: any = await env.DB.prepare("SELECT * FROM ref_filters WHERE id=?").bind(slug).first();
  if (!f) return refNotFound(user, "filter", "Brewers", "/library/brewers");
  // Brewers that accept this filter's format (format token appears in their filter_format list).
  const brewers = f.format ? ((await env.DB.prepare(`SELECT id,brand,model FROM ref_brewers WHERE filter_format LIKE ? ORDER BY brand, sort LIMIT 24`).bind(`%${f.format}%`).all()).results || []) as any[] : [];
  const siblings = ((await env.DB.prepare(`SELECT id,model FROM ref_filters WHERE brand=? AND id!=? ORDER BY sort, model LIMIT 30`).bind(f.brand, slug).all()).results || []) as any[];
  const name = `${f.brand || ""} ${f.model || ""}`.trim();
  const conf = `${esc(f.confidence || "low")} confidence`;
  const facts =
    seoRow("Brand", esc(f.brand || "")) +
    seoRow("Format", esc(f.format || "")) +
    seoRow("Material", esc(f.material || "")) +
    seoRow("Status", f.discontinued ? "Discontinued" : "In production") +
    seoRow("Source", gearSource(f.source));
  const inner =
    `<section class="section">` +
    `<span class="eyebrow"><i data-icon="${esc(f.icon || "filter-flat")}"></i> ${esc(f.material || "filter")}${f.format ? ` · ${esc(f.format)}` : ""}</span>` +
    `<h1 style="margin:6px 0 2px">${esc(name)}</h1>` +
    `<p class="data" style="margin:0 0 var(--space-4)">coffee filter · <span class="tag">${conf}</span></p>` +
    seoAbout("In the cup", f.trait || "") +
    seoLed("Filter", "reference", facts) +
    seoTags("Fits these brewers", brewers.map((x) => `<a class="tag" href="/library/brewers/${encodeURIComponent(x.id)}"><i data-icon="dripper"></i> ${esc(`${x.brand} ${x.model}`.trim())}</a>`).join("")) +
    seoTags(`More from ${esc(f.brand || "this brand")}`, siblings.map((s) => `<a class="tag" href="/library/filters/${encodeURIComponent(s.id)}">${esc(s.model)}</a>`).join("")) +
    `<p style="margin-top:var(--space-5)"><a class="button sm secondary" href="/library/brewers">← Brewers</a> <a class="button" href="/">Build brew water →</a></p>` +
    `</section>`;
  const desc = String(f.trait || `${name} coffee filter.`).slice(0, 200);
  return seoShell({ title: `${name} — coffee filter · ppmgauge`, desc, canonical: `${SITE}/library/filters/${encodeURIComponent(slug)}`, index: true, user, navCurrent: "library", crumbs: `<a href="/library">Library</a><a href="/library/brewers">Brewers</a><span aria-current="page">${esc(name)}</span>` }, inner);
}

// GET /sitemap.xml — the crawlable reference surface: section indexes, the curated
// taxonomy (every variety/region/process), producers and lots with something to
// rank on (a score or a story). Thin lots stay out (they're noindex anyway).

