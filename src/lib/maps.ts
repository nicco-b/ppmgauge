// Map rendering helpers (pure string → HTML, no DB). The single-point locator map
// (topographic relief under coastlines, with a flat dotted-outline fallback) for
// producer/region/roaster pages, and the pannable country origin map. CC_NUM maps
// world-atlas numeric ISO ids → alpha-2; CODE_NUM is its reverse.
import { esc } from "./http";

// ── Locator map ─────────────────────────────────────────────────────────────────────────
// Flip this to false to instantly revert to the flat dotted-outline map (locatorMapFlat).
const LOCATOR_TOPO = true;
export function locatorMap(lat: number, lng: number, caption: string): string {
  return LOCATOR_TOPO ? locatorMapTopo(lat, lng, caption) : locatorMapFlat(lat, lng, caption);
}

// Topographic locator: a quiet Natural-Earth gray hillshade (clipped to land) under thin
// monochrome coastlines + 110m rivers/lakes, with the accent pin on top. Equirectangular so
// the global relief raster (public/relief-2048.webp, ~88 KB) aligns without reprojection.
function locatorMapTopo(lat: number, lng: number, caption: string): string {
  const W = 600, H = 380, K = 620;  // equirectangular scale ≈ country + neighbours; tuned visually
  return (
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">Location</th></tr></thead><tbody><tr><td style="padding:0;border-left:4px solid var(--rule)">` +
    `<div id="locmap" style="width:100%;line-height:0"></div>` +
    (caption ? `<div class="data" style="font-size:.72rem;padding:6px 8px">${esc(caption)}</div>` : "") +
    `</td></tr></tbody></table>` +
    `<style>#locmap svg{display:block;width:100%;height:auto}` +
    `#locmap .l-sea{fill:var(--bg-soft)}` +
    `#locmap .l-relief{opacity:.42}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #locmap .l-relief{filter:invert(1) hue-rotate(180deg);opacity:.3}}` +
    `:root[data-theme=dark] #locmap .l-relief{filter:invert(1) hue-rotate(180deg);opacity:.3}` +
    `#locmap .l-border{fill:none;stroke:var(--rule);stroke-opacity:.7;stroke-width:.5}` +
    `#locmap .l-river{fill:none;stroke:#8aa6b3;stroke-opacity:.6;stroke-width:.6}` +
    `#locmap .l-lake{fill:#8aa6b3;fill-opacity:.22;stroke:#8aa6b3;stroke-opacity:.45;stroke-width:.4}` +
    `#locmap .l-ring{fill:none;stroke:var(--accent,#b06a39);stroke-opacity:.5}` +
    `#locmap .l-pin{fill:var(--accent,#b06a39);stroke:var(--bg);stroke-width:1.2}</style>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>` +
    `<script>(function(){function go(){var el=document.getElementById('locmap');if(!el||!window.d3)return;` +
    `var W=${W},H=${H},LA=${lat},LO=${lng};` +
    `var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('width','100%');` +
    `var proj=d3.geoEquirectangular().center([LO,LA]).scale(${K}).translate([W/2,H/2]);` +
    `var path=d3.geoPath(proj);var defs=svg.append('defs');` +
    `svg.append('rect').attr('class','l-sea').attr('width',W).attr('height',H);` +
    // global relief image, placed over the whole projected world, clipped to land
    `var tl=proj([-180,90]),br=proj([180,-90]);` +
    `defs.append('clipPath').attr('id','lclip').append('path').attr('class','lclipP');` +
    `svg.append('image').attr('class','l-relief').attr('href','/relief-2048.webp')` +
    `.attr('x',tl[0]).attr('y',tl[1]).attr('width',br[0]-tl[0]).attr('height',br[1]-tl[1])` +
    `.attr('preserveAspectRatio','none').attr('clip-path','url(#lclip)');` +
    `var border=svg.append('path').attr('class','l-border');` +
    `var rivers=svg.append('path').attr('class','l-river');var lakes=svg.append('path').attr('class','l-lake');` +
    `d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(w){var fc=topojson.feature(w,w.objects.countries);svg.select('.lclipP').attr('d',path(fc));border.datum(fc).attr('d',path);}).catch(function(){});` +
    `d3.json('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_rivers_lake_centerlines.geojson').then(function(r){rivers.datum(r).attr('d',path);}).catch(function(){});` +
    `d3.json('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_lakes.geojson').then(function(l){lakes.datum(l).attr('d',path);}).catch(function(){});` +
    `var c=proj([LO,LA]);` +
    `svg.append('circle').attr('class','l-ring').attr('cx',c[0]).attr('cy',c[1]).attr('r',11);` +
    `svg.append('circle').attr('class','l-pin').attr('cx',c[0]).attr('cy',c[1]).attr('r',5);` +
    `}if(document.readyState!='loading')go();else document.addEventListener('DOMContentLoaded',go);})();</script>`
  );
}

// Flat dotted-outline locator (the pre-topo version) — kept as the LOCATOR_TOPO=false fallback.
function locatorMapFlat(lat: number, lng: number, caption: string): string {
  const W = 600, H = 380, K = 950;
  return (
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">Location</th></tr></thead><tbody><tr><td style="padding:0;border-left:4px solid var(--rule)">` +
    `<div id="locmap" style="width:100%;line-height:0"></div>` +
    (caption ? `<div class="data" style="font-size:.72rem;padding:6px 8px">${esc(caption)}</div>` : "") +
    `</td></tr></tbody></table>` +
    `<style>#locmap svg{display:block;width:100%;height:auto}` +
    `#locmap .l-sea{fill:var(--rule);fill-opacity:.08}` +
    `#locmap .l-grat{fill:none;stroke:var(--rule);stroke-opacity:.18;stroke-width:.5}` +
    `#locmap .l-land{fill:var(--rule);fill-opacity:.55;stroke:var(--rule);stroke-opacity:.5;stroke-width:.4}` +
    `#locmap .l-ring{fill:none;stroke:var(--accent,#b06a39);stroke-opacity:.45}` +
    `#locmap .l-pin{fill:var(--accent,#b06a39);stroke:var(--bg-0,#fff);stroke-width:1.2}</style>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>` +
    `<script>(function(){function go(){var el=document.getElementById('locmap');if(!el||!window.d3)return;` +
    `var W=${W},H=${H},LA=${lat},LO=${lng};` +
    `var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('width','100%');` +
    `var proj=d3.geoMercator().center([LO,LA]).scale(${K}).translate([W/2,H/2]);` +
    `var path=d3.geoPath(proj);` +
    `svg.append('rect').attr('class','l-sea').attr('width',W).attr('height',H);` +
    `svg.append('path').datum(d3.geoGraticule10()).attr('class','l-grat').attr('d',path);` +
    `var land=svg.append('path').attr('class','l-land');` +
    `d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(w){land.datum(topojson.feature(w,w.objects.countries)).attr('d',path);}).catch(function(){});` +
    `var c=proj([LO,LA]);` +
    `svg.append('circle').attr('class','l-ring').attr('cx',c[0]).attr('cy',c[1]).attr('r',11);` +
    `svg.append('circle').attr('class','l-pin').attr('cx',c[0]).attr('cy',c[1]).attr('r',5);` +
    `}if(document.readyState!='loading')go();else document.addEventListener('DOMContentLoaded',go);})();</script>`
  );
}

// numeric ISO 3166-1 (world-atlas topojson id) → ppmgauge alpha-2 country code (lowercase).
// Only the coffee countries — built by name-join + manual fixes (CI/US/MU).
const CC_NUM: Record<string, string> = { "104": "mm", "108": "bi", "156": "cn", "158": "tw", "170": "co", "188": "cr", "218": "ec", "222": "sv", "231": "et", "320": "gt", "332": "ht", "340": "hn", "356": "in", "360": "id", "392": "jp", "404": "ke", "418": "la", "454": "mw", "484": "mx", "558": "ni", "591": "pa", "598": "pg", "604": "pe", "608": "ph", "646": "rw", "704": "vn", "764": "th", "800": "ug", "834": "tz", "894": "zm", "068": "bo", "076": "br", "384": "ci", "840": "us", "480": "mu" };
export const CODE_NUM: Record<string, string> = Object.fromEntries(Object.entries(CC_NUM).map(([n, c]) => [c, n]));

// The pannable/zoomable country origin map: topo style (relief + rivers/lakes) with three
// pin tiers (regions accent → producers → lots), lots revealed on zoom-in to stay scannable.
// `blob` = JSON {num, regions[], producers[], lots[]}; click a pin → its detail page.
export function countryMapHtml(blob: string): string {
  return (
    `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th class="left">Origin map <span class="data" style="font-weight:400">— regions, producers & lots · scroll / pinch / ± to zoom · drag to pan</span></th></tr></thead><tbody><tr><td style="padding:0;border-left:4px solid var(--rule)">` +
    `<div id="cmap" style="position:relative;width:100%;line-height:0"><div class="c-zoom"><button type="button" class="c-zin" aria-label="Zoom in">+</button><button type="button" class="c-zout" aria-label="Zoom out">−</button></div></div>` +
    `</td></tr></tbody></table>` +
    `<style>#cmap svg{display:block;width:100%;height:auto;cursor:grab;touch-action:none}` +
    `#cmap svg:active{cursor:grabbing}` +
    `#cmap .c-sea{fill:var(--bg-soft)}#cmap .c-relief{opacity:.42}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #cmap .c-relief{filter:invert(1) hue-rotate(180deg);opacity:.3}}` +
    `:root[data-theme=dark] #cmap .c-relief{filter:invert(1) hue-rotate(180deg);opacity:.3}` +
    `#cmap .c-border{fill:none;stroke:var(--rule);stroke-opacity:.7;stroke-width:.5}` +
    `#cmap .c-river{fill:none;stroke:#8aa6b3;stroke-opacity:.6;stroke-width:.6}` +
    `#cmap .c-lake{fill:#8aa6b3;fill-opacity:.22;stroke:#8aa6b3;stroke-opacity:.45;stroke-width:.4}` +
    `#cmap .c-reg{fill:var(--accent,#003B5C);stroke:var(--bg);stroke-width:.8}` +
    `#cmap .c-prod{fill:var(--text);fill-opacity:.5}#cmap .c-lot{fill:var(--text);fill-opacity:.4}` +
    `#cmap .c-tip{position:absolute;pointer-events:none;opacity:0;background:var(--text);color:#fff;font-size:.9rem;line-height:1.3;padding:5px 10px;border-radius:4px;white-space:nowrap;z-index:6;transition:opacity .1s;font-family:var(--mono,monospace)}` +
    `#cmap .c-zoom{position:absolute;top:8px;right:8px;z-index:5;display:flex;flex-direction:column;gap:4px}` +
    `#cmap .c-zoom button{width:30px;height:30px;font-size:18px;line-height:1;background:var(--bg-0,#fff);border:1px solid var(--rule);border-radius:4px;cursor:pointer;color:var(--text)}</style>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>` +
    `<script defer src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>` +
    `<script>window.__CMAP__=${blob};</script>` +
    `<script>(function(){function go(){var D=window.__CMAP__,el=document.getElementById('cmap');if(!el||!window.d3)return;` +
    `var W=Math.max(320,el.clientWidth),H=Math.round(W*0.62);` +
    `var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('width','100%');var defs=svg.append('defs');` +
    `svg.append('rect').attr('class','c-sea').attr('width',W).attr('height',H);` +
    `defs.append('clipPath').attr('id','cclip').append('path').attr('class','cclipP');` +
    `var img=svg.append('image').attr('class','c-relief').attr('href','/relief-2048.webp').attr('preserveAspectRatio','none').attr('clip-path','url(#cclip)');` +
    `var border=svg.append('path').attr('class','c-border');var rivers=svg.append('path').attr('class','c-river');var lakes=svg.append('path').attr('class','c-lake');` +
    `var lotG=svg.append('g');var prodG=svg.append('g');var regG=svg.append('g');` +
    `var tip=d3.select(el).append('div').attr('class','c-tip');var proj=d3.geoEquirectangular();var landFC,riverFC,lakeFC,s0,t0;` +
    `function pin(g,arr,cls,r,href){return g.selectAll('circle').data(arr).enter().append('circle').attr('class',cls).attr('r',r).style('cursor','pointer')` +
    `.on('mouseover',function(e,d){tip.style('opacity',1).text(d.name);}).on('mousemove',function(e){var b=el.getBoundingClientRect();tip.style('left',(e.clientX-b.left+12)+'px').style('top',(e.clientY-b.top+12)+'px');})` +
    `.on('mouseout',function(){tip.style('opacity',0);}).on('click',function(e,d){location.href=href(d);});}` +
    `var regS=pin(regG,D.regions,'c-reg',5.5,function(d){return '/library/regions/'+d.id;});` +
    `var prodS=pin(prodG,D.producers,'c-prod',3.4,function(d){return '/library/producers/'+d.id;});` +
    `var lotS=pin(lotG,D.lots,'c-lot',2.6,function(d){return '/library/lots/'+d.id;});` +
    `function place(s){s.attr('cx',function(d){return proj([d.lng,d.lat])[0];}).attr('cy',function(d){return proj([d.lng,d.lat])[1];});}` +
    `function redraw(){var path=d3.geoPath(proj);if(landFC){border.attr('d',path(landFC));svg.select('.cclipP').attr('d',path(landFC));}if(riverFC)rivers.attr('d',path(riverFC));if(lakeFC)lakes.attr('d',path(lakeFC));` +
    `var tl=proj([-180,90]),br=proj([180,-90]);img.attr('x',tl[0]).attr('y',tl[1]).attr('width',br[0]-tl[0]).attr('height',br[1]-tl[1]);place(regS);place(prodS);place(lotS);}` +
    `d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(function(w){var all=topojson.feature(w,w.objects.countries);landFC=all;` +
    `var feat=all.features.filter(function(f){return ''+f.id===D.num;});var fitTo=feat.length?{type:'FeatureCollection',features:feat}:all;` +
    `proj.fitExtent([[14,14],[W-14,H-14]],fitTo);s0=proj.scale();t0=proj.translate();redraw();}).catch(function(){proj.scale(W/2).translate([W/2,H/2]);s0=proj.scale();t0=proj.translate();redraw();});` +
    `d3.json('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_rivers_lake_centerlines.geojson').then(function(r){riverFC=r;redraw();}).catch(function(){});` +
    `d3.json('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_lakes.geojson').then(function(l){lakeFC=l;redraw();}).catch(function(){});` +
    `var zoom=d3.zoom().scaleExtent([1,60]).on('zoom',function(e){var tr=e.transform;if(s0){proj.scale(s0*tr.k).translate([t0[0]*tr.k+tr.x,t0[1]*tr.k+tr.y]);redraw();}});` +
    `svg.call(zoom);` +
    `d3.select(el).select('.c-zin').on('click',function(){svg.transition().duration(220).call(zoom.scaleBy,1.6);});` +
    `d3.select(el).select('.c-zout').on('click',function(){svg.transition().duration(220).call(zoom.scaleBy,0.625);});` +
    `}if(document.readyState!='loading')go();else document.addEventListener('DOMContentLoaded',go);})();</script>`
  );
}
