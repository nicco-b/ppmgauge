// Bean detail page (/bean/:id) — owner-scoped "bean passport": the resolved ref_*
// graph (lib/passport) + a cupping section (saved cuppings + calibration vs the
// linked reference coffee + an add-cupping form with the flavor-wheel picker).
import type { Env } from "../types";
import type { User } from "../auth";
import { esc, json } from "../lib/http";
import { beanShell, BEAN_NAV } from "../lib/render";
import { resolveBeanLinks } from "../lib/graph";
import { assemblePassport, renderPassport } from "../lib/passport";
import { flavorTree, flavorSwatch, resolveFlavorText } from "../lib/flavors";
import { CUP_ATTRS } from "./api-cupping";

async function renderCuppingSection(env: Env, bean: any): Promise<string> {
  const cr = await env.DB.prepare("SELECT * FROM user_cuppings WHERE bean_id=? ORDER BY cupped_at DESC").bind(bean.id).all();
  const cuppings: any[] = (cr.results || []) as any[];
  const notesByCup: Record<string, any[]> = {};
  if (cuppings.length) {
    const ids = cuppings.map((c) => c.id);
    const ph = ids.map(() => "?").join(",");
    const fr = await env.DB.prepare(`SELECT ucf.cupping_id cid, f.id, f.name, f.color FROM user_cupping_flavors ucf JOIN ref_flavors f ON f.id=ucf.flavor_id WHERE ucf.cupping_id IN (${ph})`).bind(...ids).all();
    for (const r of (fr.results || []) as any[]) (notesByCup[r.cid] = notesByCup[r.cid] || []).push(r);
  }
  const tagFor = (n: any) => `<span class="tag">${flavorSwatch(n.color)}${esc(n.name)}</span>`;
  const fmt = (x: any) => (typeof x === "number" ? x.toFixed(2) : (x ?? "—"));
  // Bag notes: the printed flavor text resolved onto the wheel (the photo→notes loop).
  let bagNotes = "";
  if (bean.tasting_notes) {
    const bagFlavors = await resolveFlavorText(env, bean.tasting_notes);
    const chips = bagFlavors.map((f) => `<span class="tag">${esc(f.name)}</span>`).join(" ");
    bagNotes = `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">Bag notes</th></tr></thead><tbody>` +
      `<tr><th>Printed</th><td class="data">${esc(bean.tasting_notes)}</td></tr>` +
      (chips ? `<tr><th>On the wheel</th><td><div class="cluster gap">${chips}</div></td></tr>` : "") +
      `</tbody></table>`;
  }
  // Calibration: latest cupping vs the linked reference coffee's published score + notes.
  let calib = "";
  if (bean.coffee_id && cuppings.length) {
    const coffee: any = await env.DB.prepare("SELECT name,published_score FROM ref_coffees WHERE id=?").bind(bean.coffee_id).first();
    if (coffee) {
      const pf = await env.DB.prepare("SELECT f.id,f.name,f.color FROM ref_coffee_flavors cf JOIN ref_flavors f ON f.id=cf.flavor_id WHERE cf.coffee_id=?").bind(bean.coffee_id).all();
      const pub = (pf.results || []) as any[];
      const pubIds = new Set(pub.map((x) => x.id));
      const latest = cuppings[0];
      const mine = notesByCup[latest.id] || [];
      const mineIds = new Set(mine.map((m) => m.id));
      const matched = mine.filter((m) => pubIds.has(m.id));
      const youAdded = mine.filter((m) => !pubIds.has(m.id));
      const theyNoted = pub.filter((p) => !mineIds.has(p.id));
      const delta = (latest.total_score != null && coffee.published_score != null) ? latest.total_score - coffee.published_score : null;
      const deltaStr = delta == null ? "" : ` <span class="data">(${delta >= 0 ? "+" : ""}${delta.toFixed(2)})</span>`;
      calib =
        `<table class="ledger" style="margin-top:var(--space-4)"><thead><tr><th colspan="2" class="left">Calibration <span class="data">vs ${esc(coffee.name || "reference")}</span></th></tr></thead><tbody>` +
        `<tr><th>Your score</th><td><span class="numeric">${fmt(latest.total_score)}</span> vs published <span class="numeric">${coffee.published_score ?? "—"}</span>${deltaStr}</td></tr>` +
        (matched.length ? `<tr><th>Notes you matched</th><td><div class="cluster gap">${matched.map(tagFor).join("")}</div></td></tr>` : "") +
        (youAdded.length ? `<tr><th>You also found</th><td><div class="cluster gap">${youAdded.map(tagFor).join("")}</div></td></tr>` : "") +
        (theyNoted.length ? `<tr><th>Published, you missed</th><td><div class="cluster gap">${theyNoted.map(tagFor).join("")}</div></td></tr>` : "") +
        `</tbody></table>`;
    }
  }
  const cupList = cuppings.map((c) => {
    const when = String(c.cupped_at || "").slice(0, 10);
    const attrs = CUP_ATTRS.map(([k, label]) => `${esc(label.split(" ")[0])} ${c[k]}`).join(" · ");
    const notes = (notesByCup[c.id] || []).map(tagFor).join("");
    return `<table class="ledger" style="margin-top:var(--space-3)"><thead><tr><th class="left">Cupping <span class="data">${esc(when)}</span></th><th class="right"><span class="numeric" style="font-size:1.2em">${fmt(c.total_score)}</span></th></tr></thead><tbody>` +
      `<tr><td colspan="2" class="data" style="font-size:.85em">${esc(attrs)}${c.defects ? ` · defects −${c.defects}` : ""}</td></tr>` +
      (notes ? `<tr><td colspan="2"><div class="cluster gap">${notes}</div></td></tr>` : "") +
      (c.notes ? `<tr><td colspan="2" class="data">${esc(c.notes)}</td></tr>` : "") +
      `<tr class="action"><td colspan="2"><button class="button sm secondary" data-del-cup="${esc(c.id)}" type="button">Delete</button></td></tr>` +
      `</tbody></table>`;
  }).join("");
  const scoreRows = CUP_ATTRS.map(([k, label, def]) => `<tr><th>${esc(label)}</th><td><input class="input" id="cup_${k}" type="number" min="0" max="10" step="0.25" value="${def}" style="width:6rem"></td></tr>`).join("");
  const picker = await flavorTree(env, { mode: "select" });
  const form =
    `<div id="cupForm" hidden style="margin-top:var(--space-3)">` +
    `<table class="ledger"><thead><tr><th colspan="2" class="left">New cupping — SCA score</th></tr></thead><tbody>` +
    scoreRows +
    `<tr><th>Defects</th><td><input class="input" id="cup_defects" type="number" min="0" step="2" value="0" style="width:6rem"><span class="help" style="margin-left:var(--space-2)">2 per taint · 4 per fault</span></td></tr>` +
    `</tbody></table>` +
    `<p class="help" style="margin:var(--space-3) 0 var(--space-1)">Flavor notes — paste from the bag or tap to select</p>` +
    `<div class="cluster gap" style="margin:0 0 var(--space-2)"><input class="input" id="cup_parse" type="text" value="${esc(bean.tasting_notes || "")}" placeholder="e.g. white peach, milk chocolate, bergamot" style="flex:1;min-width:12rem"><button class="button sm secondary" id="cupParse" type="button">Find on wheel</button><span class="data" id="cupParseStatus"></span></div>` +
    `<div id="cupFlavors">${picker}</div>` +
    `<table class="ledger" style="margin-top:var(--space-3)"><tbody><tr><th>Notes</th><td><input class="input" id="cup_notes" type="text" placeholder="free-text impressions" style="width:100%"></td></tr>` +
    `<tr><th>Share</th><td><label class="cluster" style="gap:var(--space-2)"><input type="checkbox" id="cup_share"> <span class="data">share to community feed</span></label></td></tr>` +
    `<tr class="action"><th colspan="2"><span class="cluster"><button class="button secondary sm" id="cupCancel" type="button">Cancel</button><button class="button sm" id="cupSave" type="button">Save cupping</button></span></th></tr>` +
    `</tbody></table></div>`;
  return `<section class="section"><span class="eyebrow">cupping</span>` +
    bagNotes + calib + cupList +
    `<div style="margin-top:var(--space-3)"><button class="button sm" id="cupAdd" type="button">＋ Log a cupping</button></div>` +
    form +
    `</section>`;
}
const CUPPING_JS = `<script>
(function(){
  var $=function(id){return document.getElementById(id);};
  function api(path,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(path,opts).then(function(r){return r.json().catch(function(){return {};});});}
  var add=$('cupAdd'), form=$('cupForm');
  if(add) add.onclick=function(){ if(form)form.hidden=false; add.style.display='none'; };
  var cancel=$('cupCancel'); if(cancel) cancel.onclick=function(){ if(form)form.hidden=true; if(add)add.style.display=''; };
  var fl=$('cupFlavors');
  if(fl){ fl.addEventListener('change',function(e){ var i=e.target; if(i.classList&&i.classList.contains('flavor-pick')){ var chip=i.closest('.chip'); if(chip) chip.classList.toggle('active', i.checked); } }); }
  // paste free-text notes -> resolve to wheel ids -> auto-select the chips
  var parseBtn=$('cupParse');
  if(parseBtn) parseBtn.onclick=function(){
    var t=($('cup_parse')||{}).value||''; var st=$('cupParseStatus'); if(!t.trim()){ if(st)st.textContent=''; return; }
    parseBtn.disabled=true; if(st) st.textContent='…';
    api('/api/flavors/resolve',{method:'POST',body:JSON.stringify({text:t})}).then(function(r){
      var ids=(r&&r.flavors||[]).map(function(x){return x.id;}), n=0;
      ids.forEach(function(id){ var cb=fl&&fl.querySelector('.flavor-pick[value="'+id+'"]'); if(cb&&!cb.checked){ cb.checked=true; var c=cb.closest('.chip'); if(c)c.classList.add('active'); n++; } });
      if(st) st.textContent=ids.length?('matched '+ids.length+(n<ids.length?' ('+(ids.length-n)+' already on)':'')):'no wheel matches';
      parseBtn.disabled=false;
    }).catch(function(){ if(st) st.textContent='couldn’t resolve'; parseBtn.disabled=false; });
  };
  var save=$('cupSave');
  if(save) save.onclick=function(){
    var attrs=['fragrance','flavor','aftertaste','acidity','body','balance','uniformity','clean_cup','sweetness','overall'];
    var body={ bean_id:(window.__BEAN__||{}).id, defects:($('cup_defects')||{}).value, notes:($('cup_notes')||{}).value, shared:(($('cup_share')||{}).checked?1:0), flavors:[] };
    attrs.forEach(function(k){ var e=$('cup_'+k); if(e) body[k]=e.value; });
    if(fl) fl.querySelectorAll('.flavor-pick:checked').forEach(function(i){ body.flavors.push(i.value); });
    save.disabled=true; save.textContent='Saving…';
    api('/api/cupping',{method:'POST',body:JSON.stringify(body)}).then(function(r){ if(r&&r.ok){ location.reload(); } else { save.disabled=false; save.textContent='Save cupping'; alert((r&&r.error)||'Could not save'); } });
  };
  document.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('[data-del-cup]'); if(!b) return; if(!confirm('Delete this cupping?')) return; api('/api/cupping/'+b.getAttribute('data-del-cup'),{method:'DELETE'}).then(function(){ location.reload(); }); });
})();
</script>`;


// GET /recipes — the full community recipe pool: public, paginated, attributed, sortable
// (Top = most-saved then recent · Newest = recent). Signed-in viewers get a working ★ toggle.


// ---------- Public reference pages (crawlable): producers ----------


// GET /library/producers/:id — public "farm passport": facts + its lots, interlinked + SEO'd.

export async function beanPage(req: Request, env: Env, id: string, user: User | null): Promise<Response> {
  if (!user) return Response.redirect(new URL("/logbook", req.url).toString(), 302);
  const bean: any = await env.DB.prepare(`SELECT * FROM beans WHERE id=? AND owner=?`).bind(id, user.id).first();
  if (!bean) return beanShell("Not found", BEAN_NAV("log", user), `<a href="/logbook">Logbook</a><span aria-current="page">Not found</span>`, `<section class="section"><div class="signal" style="border-color:var(--negative)">Bean not found.</div><p><a href="/logbook">← Back to logbook</a></p></section>`);

  // Prev/next within this owner's bean list (newest-first, matching the logbook list order).
  const nav: any = await env.DB
    .prepare(`SELECT id FROM beans WHERE owner=? ORDER BY rowid DESC`).bind(user.id).all();
  const ids: string[] = (nav.results || []).map((r: any) => r.id);
  const idx = ids.indexOf(id);
  const prevId = idx > 0 ? ids[idx - 1] : null;       // newer
  const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null; // older
  const pager = (prevId || nextId)
    ? `<nav class="pager" style="margin-top:var(--space-4)">` +
      (prevId ? `<a class="prev" href="/bean/${esc(prevId)}">Newer bean</a>` : `<span class="prev muted">Newer bean</span>`) +
      `<span class="data">${idx + 1} / ${ids.length}</span>` +
      (nextId ? `<a class="next" href="/bean/${esc(nextId)}">Older bean</a>` : `<span class="next muted">Older bean</span>`) +
      `</nav>`
    : "";

  let sug: any = null;
  if (bean.suggestion) { try { sug = JSON.parse(bean.suggestion); } catch {} }
  let ctx: any = null;
  if (bean.context) { try { ctx = JSON.parse(bean.context); } catch {} }
  // Bean Passport: use the bean's stored ref_* links; if none are set (legacy bean
  // saved before wiring), resolve once now so viewing backfills it.
  let links: any = { region_id: bean.region_id, variety_id: bean.variety_id, process_id: bean.process_id, producer_id: bean.producer_id, roaster_id: bean.roaster_id };
  if (!links.region_id && !links.variety_id && !links.process_id && !links.producer_id && !links.roaster_id) {
    try { links = await resolveBeanLinks(env, bean); } catch {}
  }
  let passportHtml = "";
  try { passportHtml = renderPassport(await assemblePassport(env, links)); } catch {}
  let cuppingHtml = "";
  try { cuppingHtml = await renderCuppingSection(env, bean); } catch {}
  const fields = [
    ["name", "Name", "text", "Ethiopia Guji"], ["roaster", "Roaster", "text", ""],
    ["origin", "Origin", "text", "country"], ["region", "Region", "text", "growing region"],
    ["producer", "Producer", "text", "farm / washing station"], ["varietal", "Varietal", "text", "Geisha, Bourbon…"],
    ["process", "Process", "text", "washed / natural…"], ["altitude", "Altitude", "text", "e.g. 1800 masl"],
    ["harvest", "Harvest", "text", "e.g. May–Sept"], ["roast_date", "Roast date", "date", ""],
    ["tasting_notes", "Tasting notes", "text", "blackcurrant, cocoa, jasmine…"],
  ];
  const rows = fields.map(([k, label, type, ph]) =>
    `<tr><th>${esc(label)}</th><td><input class="input" id="f_${k}" type="${type}" value="${esc(bean[k] || "")}" placeholder="${esc(ph)}" style="width:100%"></td></tr>`
  ).join("");
  const accent = esc(bean.color || "#8a8f98");
  const inner =
    `<style>` +
    `.bean-ledger{border-top:6px solid var(--accent)}` +
    `.bean-title{margin:0;font:inherit;font-weight:600;color:var(--accent);cursor:pointer}` +
    `.bean-title:hover{filter:brightness(1.08)}` +
    `.bean-color-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}` +
    `</style>` +
    `<section class="section" id="beanHead" style="--accent:${accent}">` +
    `<input type="color" id="f_color" value="${accent}" class="bean-color-input" aria-label="accent color">` +
    `<form id="beanForm"><table class="ledger bean-ledger" id="beanLedger">` +
    `<thead><tr><th colspan="2" class="left"><h1 class="bean-title" id="beanAccent" title="Click to recolor the accent">${esc(bean.name)}</h1></th></tr></thead><tbody>` +
    rows +
    `<tr><th>Bag photo</th><td><input class="input" type="file" id="f_photo" accept="image/*"><span class="data" id="photoStatus" style="margin-left:var(--space-2)"></span><div class="help">re-scan the label to autofill · photo not saved</div></td></tr>` +
    `<tr class="action"><th colspan="2"><span class="cluster"><button class="button secondary sm" id="bDelete" type="button">Delete</button><button class="button sm" id="bSave" type="button">Save</button></span></th></tr>` +
    `</tbody></table></form>` +
    `<div id="suggestBox" style="margin-top:var(--space-4)"></div>` +
    `<div id="contextBox" style="margin-top:var(--space-4)"></div>` +
    `</section>` +
    passportHtml +
    cuppingHtml +
    pager +
    `<script>window.__BEAN__=${JSON.stringify({ id: bean.id, suggestion: sug, context: ctx, prev: prevId, next: nextId })};</script>` +
    BEAN_PAGE_JS +
    CUPPING_JS;
  return beanShell(bean.name, BEAN_NAV("log", user), `<a href="/logbook">Logbook</a><span aria-current="page">${esc(bean.name)}</span>`, inner);
}
const BEAN_PAGE_JS = `<script>
(function(){
  var B=window.__BEAN__||{}, $=function(id){return document.getElementById(id);};
  function val(id){var e=$(id);return e?e.value:'';}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function api(path,opts){opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});return fetch(path,opts).then(function(r){return r.json().catch(function(){return {};});});}
  var FK=['name','roaster','origin','region','producer','varietal','process','altitude','harvest','roast_date','tasting_notes','color'];
  function fields(){var o={}; FK.forEach(function(k){o[k]=val('f_'+k);}); return o;}
  $('bSave').onclick=function(){
    var b=$('bSave'),t=b.textContent; b.disabled=true; b.textContent='Saving…';
    api('/api/beans/'+B.id,{method:'PUT',body:JSON.stringify(fields())}).then(function(){ b.disabled=false; b.textContent='Saved ✓'; setTimeout(function(){b.textContent=t;},1200); maybeEnrich(); });
  };
  $('bDelete').onclick=function(){ if(!confirm('Delete this bean? This cannot be undone.')) return; api('/api/beans/'+B.id,{method:'DELETE'}).then(function(){ location.href='/logbook'; }); };
  // fine-tune the accent color — click the bar to open the picker; the --accent var
  // drives the bar, eyebrow and chip together, live, and saves with the bean.
  var beanHead=document.getElementById('beanHead');
  function openColor(){ var ci=$('f_color'); if(ci) ci.click(); }
  if($('beanAccent')){
    $('beanAccent').addEventListener('click',openColor);
    $('beanAccent').addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openColor(); } });
  }
  if($('f_color')) $('f_color').addEventListener('input',function(){ if(beanHead) beanHead.style.setProperty('--accent', this.value); });
  // ← / → navigate to the newer / older bean (matching the pager); ignored while typing
  document.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    var t=e.target;
    if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable)) return;
    if(e.key==='ArrowLeft'&&B.prev){ e.preventDefault(); location.href='/bean/'+B.prev; }
    else if(e.key==='ArrowRight'&&B.next){ e.preventDefault(); location.href='/bean/'+B.next; }
  });
  // photo re-scan (EXIF-aware downscale -> vision); photo not stored
  function loadDrawable(file){ if(window.createImageBitmap){ try{ return createImageBitmap(file,{imageOrientation:'from-image'}).then(function(b){return {src:b,w:b.width,h:b.height};}); }catch(e){} }
    return new Promise(function(res,rej){ var img=new Image(),u=URL.createObjectURL(file); img.onload=function(){res({src:img,w:img.width,h:img.height,url:u});}; img.onerror=function(){URL.revokeObjectURL(u);rej();}; img.src=u; }); }
  if($('f_photo')) $('f_photo').addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return; var st=$('photoStatus'); if(st) st.textContent='scanning…';
    loadDrawable(f).then(function(d){ var s=Math.min(1,1280/Math.max(d.w,d.h)),cw=Math.round(d.w*s),ch=Math.round(d.h*s);
      var cv=document.createElement('canvas');cv.width=cw;cv.height=ch;cv.getContext('2d').drawImage(d.src,0,0,cw,ch); if(d.url)URL.revokeObjectURL(d.url);
      api('/api/vision',{method:'POST',body:JSON.stringify({image:cv.toDataURL('image/jpeg',0.85)})}).then(function(r){ var fl=(r&&r.fields)||{},got=false;
        FK.forEach(function(k){ if(fl[k]){ var e=$('f_'+k); if(e){ e.value=fl[k]; got=true; } } });
        if(st) st.textContent=got?'scanned — check the fields, then Save':'couldn’t read the label';
      }).catch(function(){ if(st) st.textContent='scan unavailable'; });
    }).catch(function(){ if(st) st.textContent='could not read that image'; });
  });
  // suggested brew
  function renderSuggest(d){ var el=$('suggestBox'); if(!el) return;
    if(!d||!d.suggestion){ el.innerHTML=''; return; }
    var s=d.suggestion, r=s.ratio||{}, br=s.brew||{};
    var dots=[['TONIK','--cad-yellow',r.T],['JAMM','--cad-red',r.J],['LYLAC','--cad-violet',r.L]].map(function(p){return '<span style="margin-right:14px"><i style="display:inline-block;width:9px;height:9px;background:var('+p[1]+');margin-right:6px;vertical-align:middle;border:var(--border) solid var(--text)"></i>'+p[0]+' <b class="numeric">'+(+p[2]||0)+'</b></span>';}).join('');
    var brewBits=[br.ratio,br.grind,(br.temp_c?br.temp_c+'°C':''),br.time].filter(Boolean).map(function(x){return '<span class="numeric">'+esc(x)+'</span>';}).join(' · ');
    el.innerHTML='<table class="ledger"><thead><tr><th colspan="2" class="left">Suggested water <span class="data">'+(d.source==='ai'?'AI':'rule-based')+'</span></th></tr></thead><tbody>'
      +'<tr><th>Target</th><td>'+(+s.target_gl||0)+' g/L</td></tr>'
      +'<tr><th>Ratio</th><td>'+dots+'</td></tr>'
      +'<tr><th>Brew</th><td>'+(brewBits||'—')+'</td></tr>'
      +(s.rationale?'<tr><th>Why</th><td class="data">'+esc(s.rationale)+'</td></tr>':'')
      +'<tr class="action"><th colspan="2"><button class="button sm secondary" id="bReSuggest" type="button">Re-suggest</button></th></tr>'
      +'</tbody></table>';
    $('bReSuggest').onclick=doSuggest;
  }
  function doSuggest(){ var el=$('suggestBox'); if(el) el.innerHTML='<div class="signal info">Thinking up a water…</div>';
    api('/api/suggest',{method:'POST',body:JSON.stringify(fields())}).then(function(d){ renderSuggest(d);
      api('/api/beans/'+B.id,{method:'PUT',body:JSON.stringify({suggestion:JSON.stringify(d)})}); });
  }
  if(B.suggestion) renderSuggest(B.suggestion); else doSuggest();

  // region context — typical for the region, NOT lot-specific. Auto-generated when a
  // region/origin/producer is known, and refreshed automatically when those change. No button.
  function ctxSig(){ var f=fields(); return [f.origin,f.region,f.producer,f.process,f.varietal].join('|'); }
  var lastCtxSig=B.context?ctxSig():null;
  function renderContext(c){ var el=$('contextBox'); if(!el) return;
    var rows='';
    if(c){
      if(c.altitude_range) rows+='<tr><th>Altitude</th><td>'+esc(c.altitude_range)+'</td></tr>';
      if(c.harvest_window) rows+='<tr><th>Harvest</th><td>'+esc(c.harvest_window)+'</td></tr>';
      if(c.cup_profile) rows+='<tr><th>Cup</th><td>'+esc(c.cup_profile)+'</td></tr>';
      if(c.blurb) rows+='<tr><th>Notes</th><td class="data">'+esc(c.blurb)+'</td></tr>';
    }
    if(!rows){ var f=fields();
      var msg=(!f.origin&&!f.region)?'Add an origin or region (then Save) to see typical altitude, harvest &amp; cup for the area.':'No typical context found for this region.';
      el.innerHTML='<table class="ledger"><thead><tr><th class="left">Region context</th></tr></thead><tbody><tr><th class="left"><span class="help">'+msg+'</span></th></tr></tbody></table>';
      return;
    }
    var where=(c&&c.region)?esc(c.region):'region';
    var label=(c&&c.recognized&&c.producer)?('known producer · '+esc(c.producer)):('typical for '+where+' · not lot-specific');
    el.innerHTML='<table class="ledger"><thead><tr><th colspan="2" class="left">Region context <span class="data">'+label+'</span></th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function doEnrich(){ var el=$('contextBox'); var f=fields();
    if(!f.origin && !f.region){ renderContext(B.context||null); return; }
    if(el) el.innerHTML='<div class="signal info">Looking up typical context for '+esc(f.region||f.origin)+'…</div>';
    api('/api/enrich',{method:'POST',body:JSON.stringify({origin:f.origin,region:f.region,process:f.process,varietal:f.varietal,producer:f.producer,name:f.name})}).then(function(d){
      lastCtxSig=ctxSig();
      if(d&&d.context){ B.context=d.context; renderContext(d.context); api('/api/beans/'+B.id,{method:'PUT',body:JSON.stringify({context:JSON.stringify(d.context)})}); }
      else { renderContext(B.context||null); }
    }).catch(function(){ renderContext(B.context||null); });
  }
  // Show stored context if it still matches the fields; otherwise (re)generate it
  // automatically whenever there's a region/origin to go on.
  function maybeEnrich(){ var f=fields();
    if(!f.origin && !f.region){ renderContext(B.context||null); return; }
    if(B.context && ctxSig()===lastCtxSig){ renderContext(B.context); return; }
    doEnrich();
  }
  maybeEnrich();
})();
</script>`;
