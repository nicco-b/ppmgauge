// Water calculator — the stateful JS island (loaded only on /water).
// Extracted verbatim from index.html; exposes window.WaterLab + fires waterlab:ready.
            (function () {
                function $(id) {
                    return document.getElementById(id);
                }

                // ---- catalog-driven state (fetched from /api/catalog at boot) ----
                var ION = { Ca: 40.08, Mg: 24.31, HCO3: 61.02 }; // ion molar masses
                var SALTS = {}; // saltKey -> {name,formula,mm,Ca,Mg,HCO3,contributes,flavor,explainer}
                var SALT_ORDER = []; // canonical salt order for the composition table
                var DROP = {}; // dropId -> drop record
                var KITS = []; // [{id,name,blurb,drops:[dropRecord...]}] — blendable kits only
                var COMP_OVR = {}; // dropId -> {saltKey: fraction} (composition-model edits)
                var COMP_OPEN = false; // composition model collapsed by default; its header row is the toggle
                var CALIB = null; // calibrated ion yields, keyed T/J/L (Apax classic — Phase 3 bridge)
                var KIT_OF = { s: "apax", a: "apax", b: "apax" }; // which kit each water uses
                var DEFAULT_KIT = "apax";
                var MY_DROPS = [],
                    DROP_EDIT = null,
                    DROP_EDIT_P = null; // user's custom drops + which one the editor is on ('__new__' | id | null) + which water panel hosts the open form
                // Apax classic drops → the T/J/L calibration slots (the solver is Apax-3 only).
                var APAX_LETTER = {
                    apax_tonik: "T",
                    apax_jamm: "J",
                    apax_lylac: "L",
                };
                var BREWERS = [],
                    FILTERS = [],
                    GRINDERS = [],
                    BREWER_BY = {},
                    FILTER_BY = {},
                    GRINDER_BY = {}; // brew-gear reference (from /api/catalog), brand→model
                var FAVS = { brewer: {}, filter: {}, grinder: {} }; // user's favorited gear ids by kind (float to top of each picker)

                // Per-water concentrate SET — the ordered drop ids in each water's ledger.
                // Drops are mix-and-match across brands + custom (added one at a time via the
                // ledger's "+ Add a drop" picker), NOT locked to one kit. activeDrops(p) reads this.
                var DSET = { s: [], a: [], b: [] };
                // A small, tasteful set of starter profiles. Each is self-contained ({dropId: g/L});
                // picking one sets the water's drop SET + ratios. Hand-editing flips Profile to "Custom".
                // Filtered at render to presets whose drops exist in the loaded catalog.
                // Preset doses sum to ~2 g/L so the out-of-box strength lands ~60 ppm on RO water
                // (× 30). Flavour proportions are unchanged from the classic ratios — only the overall
                // concentration was halved. Strength is derived, so these sums ARE the resulting ppm/30.
                var PRESETS = [
                    { key: "washed", label: "Apax · Washed", r: { apax_tonik: 1.25, apax_jamm: 0.25, apax_lylac: 0.5 } },
                    { key: "bright", label: "Apax · Bright", r: { apax_tonik: 1.25, apax_jamm: 0, apax_lylac: 0.75 } },
                    { key: "sweet", label: "Apax · Sweet", r: { apax_tonik: 0.25, apax_jamm: 1.25, apax_lylac: 0.5 } },
                    { key: "lotus", label: "Lotus · Spring", r: { lotus_calcium: 0.67, lotus_magnesium: 0.67, lotus_alk_k: 0.67 } },
                    { key: "blank", label: "Blank", r: {} },
                ];
                function presetByKey(k) {
                    for (var i = 0; i < PRESETS.length; i++)
                        if (PRESETS[i].key === k) return PRESETS[i];
                    return null;
                }
                // Presets offered in the Profile picker: only those whose drops are all in the catalog
                // (so "Lotus · Spring" hides if the Lotus kit isn't seeded). Blank is always offered.
                function availablePresets() {
                    return PRESETS.filter(function (P) {
                        return (
                            P.key === "blank" ||
                            Object.keys(P.r).every(function (id) {
                                return DROP[id];
                            })
                        );
                    });
                }
                function kitById(id) {
                    for (var i = 0; i < KITS.length; i++)
                        if (KITS[i].id === id) return KITS[i];
                    return null;
                }
                // The drops in water p's concentrate ledger = its explicit set (any brand + custom).
                function activeDrops(p) {
                    return (DSET[p] || [])
                        .map(function (id) {
                            return DROP[id];
                        })
                        .filter(Boolean);
                }
                function compFor(id) {
                    var d = DROP[id];
                    return COMP_OVR[id] || (d && d.comp) || null;
                }

                function compute(r, gl, ml, dpg) {
                    var ids = Object.keys(r),
                        sum = 0;
                    ids.forEach(function (k) {
                        sum += r[k] || 0;
                    });
                    var vL = ml / 1000,
                        s = sum > 0 ? gl / sum : 0,
                        g = {},
                        d = {},
                        tot = 0,
                        totd = 0;
                    ids.forEach(function (k) {
                        var gv = (r[k] || 0) * s * vL,
                            dr = gv * dpg;
                        g[k] = gv;
                        d[k] = dr;
                        tot += gv;
                        totd += dr;
                    });
                    return { g: g, d: d, tot: tot, totd: totd, ids: ids };
                }
                var fg = function (n) {
                    return n < 0.005 ? "0" : n.toFixed(2);
                };
                var fd = function (n) {
                    return Math.round(n);
                };

                // Populate the Profile picker with the available starter presets + "Custom"
                // (Custom is the state once you hand-edit; it never "applies" anything).
                function fillPreset(p) {
                    var sel = $(p + "_preset");
                    if (!sel) return;
                    sel.innerHTML = "";
                    availablePresets().forEach(function (P) {
                        var o = document.createElement("option");
                        o.value = P.key;
                        o.textContent = P.label;
                        sel.appendChild(o);
                    });
                    var c = document.createElement("option");
                    c.value = "custom";
                    c.textContent = "Custom";
                    sel.appendChild(c);
                }
                // Apply a starter preset: replace the water's drop SET with the preset's drops
                // (those in the catalog), rebuild the ledger, then write each drop's g/L.
                function applyPreset(p, key) {
                    var P = presetByKey(key);
                    if (!P) return;
                    DSET[p] = Object.keys(P.r).filter(function (id) {
                        return DROP[id];
                    });
                    fillConcLedger(p);
                    DSET[p].forEach(function (id) {
                        var el = $(p + "_" + id);
                        if (el) el.value = P.r[id] || 0;
                    });
                }
                // Full water block (setup ledger + concentrate ledger) for one water — single source
                // of truth so Single and each Split column are structurally identical.
                function waterPanelHtml(p, cfg) {
                    var accent = cfg.accent || "var(--text)";
                    var sub = cfg.sub
                        ? '<span class="data">' + cfg.sub + "</span>"
                        : "";
                    var rm = cfg.removable
                        ? '<button class="button secondary sm water-remove" data-wkey="' +
                          p +
                          '" type="button">× Remove</button>'
                        : "";
                    return (
                        "" +
                        '<table class="ledger">' +
                        '<thead><tr><th colspan="2" class="left"><span class="cluster" style="justify-content:space-between;align-items:center;gap:var(--space-3)">' +
                        '<span style="color:' +
                        accent +
                        ';font-weight:600">' +
                        cfg.title +
                        "</span>" +
                        '<span class="cluster gap" style="align-items:center;gap:var(--space-2)">' +
                        sub +
                        rm +
                        "</span>" +
                        "</span></th></tr></thead>" +
                        "<tbody>" +
                        '<tr><th style="white-space:nowrap">Water to make</th><td><span class="cluster gap" style="align-items:center;flex-wrap:wrap">' +
                        '<span class="input-group" style="max-width:7.5rem"><input class="input numeric" type="number" id="' +
                        p +
                        '_vol" value="' +
                        cfg.vol +
                        '" min="0" step="50"><span class="input-addon">mL</span></span>' +
                        '<span class="input-group" style="max-width:6rem"><input class="input numeric" type="number" id="' +
                        p +
                        '_temp" value="' +
                        cfg.temp +
                        '" min="0" max="100" step="1"><span class="input-addon">°C</span></span>' +
                        "</span></td></tr>" +
                        // Strength is DERIVED (read-only) — total dissolved minerals = drops + starting
                        // water, in ppm. Set by the drop steppers / Profile, not typed. Empty set → 0 (or
                        // the starting water's own ppm). Mirrors the Analyze panel's TDS.
                        '<tr><th style="white-space:nowrap">Strength <button class="hint" type="button" data-hint="Total dissolved minerals in the cup — concentrate plus starting water. Specialty sweet spot ≈ 50–80 ppm.">?</button></th><td><span class="cluster gap" style="align-items:baseline;flex-wrap:wrap">' +
                        '<span class="cluster" style="gap:4px;align-items:baseline"><b class="numeric" id="' +
                        p +
                        '_ppm" style="font-size:1.05rem">0</b><span class="data">ppm</span></span>' +
                        '<span class="data">· <b id="' +
                        p +
                        '_targetTag">0.0 g/L</b></span>' +
                        '</span><input type="hidden" id="' +
                        p +
                        '_target" value="0"></td></tr>' +
                        // Concentrate is mix-and-match per drop (added in the ledger below); the old
                        // brand "Drops" lock is gone. "Profile" just seeds a starter composition.
                        "<tr" +
                        (p === "s" ? ' id="drops"' : "") +
                        '><th>Profile</th><td><select class="input" id="' +
                        p +
                        '_preset" style="width:100%"></select></td></tr>' +
                        "</tbody>" +
                        "</table>" +
                        '<table class="ledger" style="margin-top:var(--space-3)">' +
                        "<thead>" +
                        '<tr><th colspan="3" class="left"><span class="cluster" style="justify-content:space-between;align-items:baseline;gap:var(--space-3)">' +
                        '<span>Concentrate</span><span class="data">Σ <b id="' +
                        p +
                        '_totg">0</b> g · <b id="' +
                        p +
                        '_totd">0</b> drops</span></span></th></tr>' +
                        '<tr><th class="left">drop</th><th class="numeric">dose</th><th class="numeric">drops</th></tr>' +
                        "</thead>" +
                        '<tbody class="conc-rows" data-prefix="' +
                        p +
                        '"></tbody>' +
                        '<tbody><tr><td colspan="3" class="left" style="border-left:4px solid var(--rule)"><details class="dropper"><summary style="cursor:pointer"><span class="data">Dropper · <b id="' +
                        p +
                        '_dpgTag">20</b> drops/g</span></summary>' +
                        '<div style="margin-top:var(--space-2)"><input class="slider" type="range" id="' +
                        p +
                        '_dpg" min="10" max="40" step="1" value="20"><span class="help">Drops to fill 1&nbsp;mL — calibrate for exact drop counts.</span></div></details></td></tr></tbody>' +
                        "</table>"
                    );
                }
                // One dense row per concentrate: colour accent + dot · name [+ ✎ for custom] · × remove ·
                // share gauge · dose (g) · ± drops. Mix-and-match across brands + custom; rows come from
                // DSET[p]. A "+ Add a drop…" picker sits at the bottom — same shape as the post-brew ledger.
                function fillConcLedger(p) {
                    var tb = document.querySelector(
                        '.conc-rows[data-prefix="' + p + '"]',
                    );
                    if (!tb) return;
                    var prev = readRatio(p); // preserve typed ratios across re-render (add/edit/remove shouldn't wipe the dose)
                    var html = activeDrops(p)
                        .map(function (d) {
                            var custom =
                                d.brand_id === "you" ||
                                d.provenance === "custom";
                            var r =
                                "<tr>" +
                                '<th class="left" style="border-left-color:' +
                                d.color +
                                ';width:99%" title="' +
                                (d.note || "") +
                                '">' +
                                '<span class="cluster gap" style="align-items:center;line-height:1.25"><span><i class="cdot" style="--c:' +
                                d.color +
                                '"></i>' +
                                d.name +
                                (d.tag
                                    ? ' <span class="muted" style="font-weight:400">' +
                                      d.tag +
                                      "</span>"
                                    : "") +
                                "</span>" +
                                (custom
                                    ? '<button class="button secondary sm conc-edit" data-id="' +
                                      d.id +
                                      '" type="button" title="Edit drop">✎</button>'
                                    : "") +
                                '<button class="button secondary sm conc-del" data-prefix="' +
                                p +
                                '" data-id="' +
                                d.id +
                                '" type="button" title="Remove">×</button>' +
                                "</span>" +
                                '<div class="gauge thin" style="--fill:' +
                                d.color +
                                ';margin-top:5px"><div class="fill" id="' +
                                p +
                                "_" +
                                d.id +
                                '_bar" style="width:0"></div></div>' +
                                "</th>" +
                                // Dose by weight. g/L is the stored canonical (drives the
                                // chemistry + scales with volume); the +/- steppers set it.
                                // Kept as a hidden input so readRatio/presets/recipe-save
                                // keep working unchanged.
                                '<td class="numeric" style="white-space:nowrap;vertical-align:top"><input type="hidden" class="ratio-input" data-prefix="' +
                                p +
                                '" id="' +
                                p +
                                "_" +
                                d.id +
                                '" value="' +
                                (prev[d.id] || 0) +
                                '"><b id="' +
                                p +
                                "_" +
                                d.id +
                                '_g">0</b> g</td>' +
                                // Drops — the +/- stepper is the control.
                                '<td class="numeric" style="white-space:nowrap;vertical-align:top"><span class="cluster" style="display:inline-flex;flex-wrap:nowrap;gap:3px;align-items:center;justify-content:flex-end">' +
                                '<button class="button sm secondary drop-step" style="padding:0 6px;min-width:0" data-prefix="' +
                                p +
                                '" data-id="' +
                                d.id +
                                '" data-step="-1" type="button" tabindex="-1" title="one less drop">−</button>' +
                                '<span style="min-width:1.5em;text-align:center"><b id="' +
                                p +
                                "_" +
                                d.id +
                                '_d">0</b></span>' +
                                '<button class="button sm secondary drop-step" style="padding:0 6px;min-width:0" data-prefix="' +
                                p +
                                '" data-id="' +
                                d.id +
                                '" data-step="1" type="button" tabindex="-1" title="one more drop">+</button>' +
                                "</span></td>" +
                                "</tr>";
                            if (DROP_EDIT === d.id && DROP_EDIT_P === p)
                                r += dropFormRow(p, d);
                            return r;
                        })
                        .join("");
                    // Inline "new custom drop" form (opened from the picker's "+ New custom drop…").
                    if (DROP_EDIT === "__new__" && DROP_EDIT_P === p)
                        html += dropFormRow(p, null);
                    html += concPickRow(p);
                    tb.innerHTML = html;
                    wireConcEditors(p);
                }
                // The "+ Add a drop…" picker row: every catalog drop (grouped by brand) + your custom
                // drops that aren't already in this water, plus a "+ New custom drop…" entry when signed in.
                function concPickRow(p) {
                    var inSet = {};
                    (DSET[p] || []).forEach(function (id) {
                        inSet[id] = 1;
                    });
                    var groups = {},
                        order = [];
                    KITS.forEach(function (k) {
                        k.drops.forEach(function (d) {
                            if (inSet[d.id]) return;
                            if (!groups[k.name]) {
                                groups[k.name] = [];
                                order.push(k.name);
                            }
                            groups[k.name].push(d);
                        });
                    });
                    var opts = '<option value="">+ Add a drop…</option>';
                    order.forEach(function (kn) {
                        opts +=
                            '<optgroup label="' +
                            escH(kn) +
                            '">' +
                            groups[kn]
                                .map(function (d) {
                                    return (
                                        '<option value="' +
                                        d.id +
                                        '">' +
                                        escH(d.name) +
                                        "</option>"
                                    );
                                })
                                .join("") +
                            "</optgroup>";
                    });
                    if (AUTH)
                        opts +=
                            '<optgroup label="—"><option value="__new__">+ New custom drop…</option></optgroup>';
                    return (
                        '<tr><td colspan="3" class="left" style="border-left:4px solid var(--rule)"><select class="input conc-pick" data-prefix="' +
                        p +
                        '" id="' +
                        p +
                        '_concPick" style="max-width:18rem">' +
                        opts +
                        "</select></td></tr>"
                    );
                }
                // Add / remove a drop from a water's concentrate set, then re-render + recompute.
                function addDropToWater(p, id) {
                    if (id === "__new__") {
                        DROP_EDIT = "__new__";
                        DROP_EDIT_P = p;
                        renderConc();
                        return;
                    }
                    if (!DROP[id] || (DSET[p] || []).indexOf(id) >= 0) return;
                    DSET[p] = (DSET[p] || []).concat(id);
                    fillConcLedger(p);
                    var el = $(p + "_" + id);
                    if (el) el.value = 0; // added at 0 g/L; the stepper dials it up
                    markCustomPreset(p);
                    update();
                }
                function removeDropFromWater(p, id) {
                    DSET[p] = (DSET[p] || []).filter(function (x) {
                        return x !== id;
                    });
                    fillConcLedger(p);
                    markCustomPreset(p);
                    update();
                }
                // Adding/removing/editing a drop means the composition no longer matches a preset.
                function markCustomPreset(p) {
                    var sel = $(p + "_preset");
                    if (sel) sel.value = "custom";
                }
                // Re-render every mounted concentrate panel — keeps single + split in lockstep (custom drops are global per-user,
                // and ensures only ONE editor form (the panel matching DROP_EDIT_P) is ever in the DOM, so md-* ids stay unique.
                function renderConc() {
                    ["s", "a", "b"].forEach(function (p) {
                        if (
                            document.querySelector(
                                '.conc-rows[data-prefix="' + p + '"]',
                            )
                        )
                            fillConcLedger(p);
                    });
                }
                function readRatio(p) {
                    var r = {};
                    activeDrops(p).forEach(function (d) {
                        var el = $(p + "_" + d.id);
                        r[d.id] = el ? +el.value || 0 : 0;
                    });
                    return r;
                }
                // Each concentrate's bar fills against a FIXED strength scale (g/L, so it's
                // volume-independent), not relative to the biggest drop. That keeps the bars
                // stable: changing one concentrate only moves its own bar — the old code
                // scaled every bar to the largest, so bumping one rescaled them all.
                var BAR_FULL_GL = 3; // g/L of a single concentrate that fills its bar
                function paint(p, res) {
                    var vL = (+($(p + "_vol") || {}).value || 0) / 1000 || 1;
                    res.ids.forEach(function (k) {
                        var bar = $(p + "_" + k + "_bar");
                        if (bar)
                            bar.style.width =
                                Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        (res.g[k] / vL / BAR_FULL_GL) * 100,
                                    ),
                                ) + "%";
                        var gel = $(p + "_" + k + "_g");
                        if (gel) gel.textContent = fg(res.g[k]);
                        var del = $(p + "_" + k + "_d");
                        if (del) del.textContent = fd(res.d[k]);
                    });
                    if ($(p + "_totg"))
                        $(p + "_totg").textContent = fg(res.tot);
                    if ($(p + "_totd"))
                        $(p + "_totd").textContent = fd(res.totd);
                }
                // +/- one drop of concentrate `id` in water `p`. Drops are coupled (the
                // ratios are weights normalised to the target strength gl), so to nudge one
                // concentrate's drop count by 1 while leaving the others put, we rebuild
                // every concentrate's absolute g/L from its target drop count
                // (drops ÷ dpg ÷ volume_L) and set the strength to their sum. That stores
                // g/L (so the recipe still scales with batch volume) yet lands exact whole
                // drops. The strength (ppm) rises/falls by the one drop you added/removed.
                function stepDrop(p, id, step) {
                    var ml = +($(p + "_vol") || {}).value || 0;
                    if (!ml) return;
                    var vL = ml / 1000,
                        dpg = dpgFor(p),
                        gl = +($(p + "_target") || {}).value || 0;
                    var res = compute(readRatio(p), gl, ml, dpg);
                    var gPerL = {},
                        sumGL = 0;
                    res.ids.forEach(function (k) {
                        var cur = Math.round(res.d[k] || 0),
                            next = k === id ? Math.max(0, cur + step) : cur;
                        // per-drop absolute g/L; 3dp keeps the round-trip exact to the drop
                        gPerL[k] = +(next / dpg / vL).toFixed(3);
                        sumGL += gPerL[k];
                    });
                    res.ids.forEach(function (k) {
                        var el = $(p + "_" + k);
                        if (el) el.value = gPerL[k];
                    });
                    var tgt = $(p + "_target");
                    if (tgt) tgt.value = +sumGL.toFixed(3);
                    markCustomPreset(p); // hand-editing the dose is a custom composition
                    update();
                }
                // (re)build a water's UI: Profile preset picker + the concentrate ledger (rows from DSET).
                function buildWater(p) {
                    fillPreset(p);
                    fillConcLedger(p);
                }
                function dpgFor(p) {
                    var el = $(p + "_dpg");
                    return el ? +el.value || 20 : 20;
                }

                // Update one water (prefix s/a/b). Strength is DERIVED: the canonical g/L (_target) is
                // the actual sum of per-drop doses, and the displayed ppm = drops + starting water
                // (= drop g/L × 30 + startTDS), exactly like the Analyze panel's TDS. Read-only.
                function waterUpdate(p) {
                    var r = readRatio(p),
                        ml = +$(p + "_vol").value || 0,
                        dpg = dpgFor(p);
                    var gl = 0;
                    for (var k in r) gl += r[k] || 0; // actual dosed concentrate g/L
                    if ($(p + "_target")) $(p + "_target").value = +gl.toFixed(3); // keep canonical in sync for save/chem
                    var totalPpm = Math.round(gl * 30) + startTDS(); // drops + starting water
                    var inRange = totalPpm >= 50 && totalPpm <= 80;
                    if ($(p + "_volTag"))
                        $(p + "_volTag").textContent =
                            ml >= 1000 ? ml / 1000 + " L" : ml + " mL";
                    if ($(p + "_targetTag"))
                        $(p + "_targetTag").textContent = gl.toFixed(1) + " g/L";
                    if ($(p + "_dpgTag")) $(p + "_dpgTag").textContent = dpg;
                    var ppmEl = $(p + "_ppm");
                    if (ppmEl) {
                        ppmEl.textContent = totalPpm;
                        ppmEl.style.color = inRange
                            ? "var(--positive)"
                            : "var(--warn)";
                    }
                    var res = compute(r, gl, ml, dpg);
                    paint(p, res);
                    return res;
                }
                // Live "what you're saving" summary in the Save ledger — icon + current value.
                // Chip icons come from the press design library (Press.icon) — single source in ops-ui.
                // Resolved at render time (press.js loads deferred, before the first update()).
                function pIcon(name) {
                    return window.Press && Press.icon ? Press.icon(name) : "";
                }
                function svChip(ic, val) {
                    return (
                        '<span class="cluster" style="gap:5px;align-items:center;white-space:nowrap">' +
                        ic +
                        "<b>" +
                        val +
                        "</b></span>"
                    );
                }
                function presetLabel(p) {
                    var s = $(p + "_preset");
                    if (!s || s.value === "custom") return "Custom";
                    return s.options[s.selectedIndex].text;
                }
                function kitName(id) {
                    var k = kitById(id);
                    return k ? k.name : id || "?";
                }
                function escH(s) {
                    return String(s == null ? "" : s).replace(
                        /[&<>"]/g,
                        function (c) {
                            return {
                                "&": "&amp;",
                                "<": "&lt;",
                                ">": "&gt;",
                                '"': "&quot;",
                            }[c];
                        },
                    );
                }

                // Fold legacy {T,J,L} ratio keys onto the real Apax drop ids so old recipes resolve
                // their chemistry + breakdown (compute sums any keys, but blendIons/DROP need ids).
                function dropMeta(id) {
                    var d = DROP[id] || {};
                    return {
                        name: d.name || id,
                        color: d.color || "var(--text-2)",
                    };
                }
                // [{id,name,color,drops,grams}] for every non-zero drop, summed across waters.
                function breakdownFrom(parts) {
                    var acc = {},
                        order = [];
                    parts.forEach(function (c) {
                        c.ids.forEach(function (id) {
                            if (!acc[id]) {
                                acc[id] = { id: id, drops: 0, grams: 0 };
                                order.push(id);
                            }
                            acc[id].drops += c.d[id] || 0;
                            acc[id].grams += c.g[id] || 0;
                        });
                    });
                    return order
                        .map(function (id) {
                            var m = dropMeta(id);
                            return {
                                id: id,
                                name: m.name,
                                color: m.color,
                                drops: Math.round(acc[id].drops),
                                grams: acc[id].grams,
                            };
                        })
                        .filter(function (x) {
                            return x.drops > 0 || x.grams > 0.005;
                        });
                }

                // Glanceable stats for a water setup, computed purely from a parsed ratios object
                // (`r` has vol/tgt/dpg/preset/kits + drop-keyed ratios s/a/b). Used live for the Save
                // summary AND for every saved recipe in the logbook, so the two always match.
                function setupStats(mode, r) {
                    r = r || {};
                    var vol = r.vol || {},
                        tgt = r.tgt || {},
                        dpg = r.dpg || {},
                        pre = r.preset || {};
                    var ppmOf = function (p) {
                        return Math.round((+tgt[p] || 0) * 30);
                    };
                    var drops = 0,
                        grams = 0,
                        ions,
                        ppm,
                        kit,
                        style,
                        volL,
                        glL,
                        breakdown;
                    // keys for the active waters. New recipes carry r.waters; old recipes are
                    // derived from mode (old split stored data in a,b, not s).
                    var nWaters = r.waters || (mode === "split" ? 2 : 1);
                    var keys =
                        mode === "split" && r.waters == null
                            ? ["a", "b"]
                            : ["s", "a", "b"].slice(0, nWaters);
                    var parts = [],
                        tv = 0,
                        accCa = 0,
                        accMg = 0,
                        accH = 0,
                        accPpm = 0,
                        totVol = 0,
                        gls = [];
                    keys.forEach(function (k) {
                        var rk = r[k] || {};
                        var ck = compute(
                            rk,
                            +tgt[k] || 0,
                            +vol[k] || 0,
                            +dpg[k] || 20,
                        );
                        parts.push(ck);
                        drops += ck.totd;
                        grams += ck.tot;
                        var v = +vol[k] || 0,
                            pk = ppmOf(k),
                            ik = blendIons(rk, pk);
                        accCa += v * ik.Ca;
                        accMg += v * ik.Mg;
                        accH += v * ik.HCO3;
                        accPpm += v * pk;
                        tv += v;
                        totVol += v;
                        gls.push((+tgt[k] || 0).toFixed(1));
                    });
                    if (tv <= 0) tv = 1;
                    breakdown = breakdownFrom(parts);
                    ions = { Ca: accCa / tv, Mg: accMg / tv, HCO3: accH / tv };
                    ppm = Math.round(accPpm / tv);
                    kit = "";
                    if (keys.length > 1) {
                        style = keys.length + " waters";
                        volL = totVol + " mL";
                        glL = gls.join("/") + " g/L";
                    } else {
                        style = pre[keys[0]] || "Custom";
                        volL = totVol + " mL";
                        glL = gls[0] + " g/L";
                    }
                    var brew = r.brew;
                    if (typeof brew === "string") {
                        try {
                            brew = JSON.parse(brew);
                        } catch (e) {
                            brew = null;
                        }
                    }
                    var bw = brew && BREWER_BY[brew.brewer],
                        gr = brew && GRINDER_BY[brew.grinder];
                    return {
                        kit: kit,
                        style: style,
                        vol: volL,
                        gl: glL,
                        ppm: ppm,
                        drops: Math.round(drops),
                        grams: grams,
                        breakdown: breakdown,
                        GH: Math.round(ions.Ca * 2.497 + ions.Mg * 4.118),
                        KH: Math.round(ions.HCO3 * 0.8197),
                        brewer: bw ? bw.brand + " " + bw.model : "",
                        brewerIcon: (bw && bw.icon) || "dripper",
                        grinder: gr ? gr.brand + " " + gr.model : "",
                        grinderIcon: (gr && gr.icon) || "grinder",
                    };
                }
                // Per-drop breakdown line — colored dot + name + drop count, shown under the chips.
                function breakdownHtml(st) {
                    var b = st.breakdown || [];
                    if (!b.length) return "";
                    return (
                        '<span class="cluster" style="gap:var(--space-3);flex-wrap:wrap;margin-top:4px;font-size:.85em;color:var(--text-2)">' +
                        b
                            .map(function (x) {
                                return (
                                    '<span style="white-space:nowrap"><i class="cdot" style="--c:' +
                                    x.color +
                                    '"></i>' +
                                    escH(x.name) +
                                    " <b>" +
                                    x.drops +
                                    "</b> dr</span>"
                                );
                            })
                            .join("") +
                        "</span>"
                    );
                }
                // The canonical chip row + breakdown — identical markup wherever a setup is summarized.
                // Icons are press names (defined in ops-ui): droplet=kit, coffee-process=profile,
                // flask=volume, target=strength, dropper=drops, gem=GH·hardness, droplet-fizz=KH·alkalinity.
                function statChipsHtml(st) {
                    return (
                        '<span class="cluster" style="gap:var(--space-3);flex-wrap:wrap;color:var(--text-2)">' +
                        svChip(pIcon("coffee-process"), st.style) +
                        svChip(pIcon("flask"), st.vol) +
                        svChip(pIcon("target"), st.ppm + " ppm · " + st.gl) +
                        svChip(pIcon("dropper"), st.drops + " drops") +
                        svChip(pIcon("gem"), "GH " + st.GH) +
                        svChip(pIcon("droplet-fizz"), "KH " + st.KH) +
                        (st.brewer
                            ? svChip(pIcon(st.brewerIcon), escH(st.brewer))
                            : "") +
                        (st.grinder
                            ? svChip(pIcon(st.grinderIcon), escH(st.grinder))
                            : "") +
                        "</span>" +
                        breakdownHtml(st)
                    );
                }
                // Snapshot the live calculator state as a parsed ratios object (object form of readSetup).
                function liveRatios() {
                    var o = {
                        vol: {
                            s: +$("s_vol").value || 0,
                            a: +$("a_vol").value || 0,
                            b: +$("b_vol").value || 0,
                        },
                        tgt: {
                            s: +$("s_target").value || 0,
                            a: +$("a_target").value || 0,
                            b: +$("b_target").value || 0,
                        },
                        dpg: { s: dpgFor("s"), a: dpgFor("a"), b: dpgFor("b") },
                        preset: {
                            s: presetLabel("s"),
                            a: presetLabel("a"),
                            b: presetLabel("b"),
                        },
                        waters: WATERS,
                    };
                    o.brew = {
                        brewer: ($("bmBrewer") || {}).value || "",
                        filter: ($("bmFilter") || {}).value || "",
                        grinder: ($("bmGrinder") || {}).value || "",
                    };
                    ["s", "a", "b"].forEach(function (p) {
                        o[p] = readRatio(p);
                    });
                    return o;
                }
                function renderSaveSummary() {
                    var el = $("saveSummary");
                    if (!el) return;
                    el.innerHTML = statChipsHtml(
                        setupStats(pourIsSplit() ? "split" : "single", liveRatios()),
                    );
                }

                // ---- pour structure (editable, per-step water) ----
                var POUR = null; // custom steps [{w,t}] (w = water key 'a'|'b'|'s'|''), or null = auto
                var POUR_EDIT = false; // edit mode
                // ---- post-brew drops: minerals stirred into the finished cup (dropId -> g/L of cup) ----
                var POST_BREW = {};
                var POSTBREW_SIG = null; // drop-set signature; rebuild rows only when it changes (keeps focus)
                // ---- waters: A (key 's'), B ('a'), C ('b'); WATERS = how many are active (1-3) ----
                var WATERS = 1;
                var WKEYS = ["s", "a", "b"]; // index 0..2 -> Water A / B / C
                function activeWaterKeys() {
                    return WKEYS.slice(0, WATERS);
                }
                function pourIsSplit() {
                    return WATERS > 1;
                }
                // show/hide water cards, manage add/remove buttons + the Analyze source options, recompute
                function syncWaters() {
                    WKEYS.forEach(function (k, i) {
                        var c = document.querySelector(
                            '.water-card[data-wkey="' + k + '"]',
                        );
                        if (c) c.hidden = i >= WATERS;
                    });
                    // only the last active water is removable
                    ["a", "b"].forEach(function (k) {
                        var btn = document.querySelector(
                            '.water-remove[data-wkey="' + k + '"]',
                        );
                        if (btn)
                            btn.style.display =
                                k === WKEYS[WATERS - 1] ? "" : "none";
                    });
                    var add = $("addWater");
                    if (add) add.style.display = WATERS >= 3 ? "none" : "";
                    buildChemSourceOptions();
                    update();
                }
                // Analyze source <select>: each active water + a blended-cup option when >1
                function buildChemSourceOptions() {
                    var sel = $("chemSource");
                    if (!sel) return;
                    var cur = sel.value;
                    var labels = { s: "Water A", a: "Water B", b: "Water C" };
                    var o = "";
                    activeWaterKeys().forEach(function (k) {
                        o +=
                            '<option value="' +
                            (k === "s" ? "single" : k) +
                            '">' +
                            labels[k] +
                            "</option>";
                    });
                    if (WATERS > 1) o += '<option value="cup">Blended cup</option>';
                    sel.innerHTML = o;
                    var ok = Array.prototype.some.call(
                        sel.options,
                        function (op) {
                            return op.value === cur;
                        },
                    );
                    sel.value = ok ? cur : WATERS > 1 ? "cup" : "single";
                }
                function waterMeta(w) {
                    if (w === "s")
                        return {
                            name: "Water A",
                            temp: ($("s_temp") || {}).value,
                            c: "var(--text-2)",
                        };
                    if (w === "a")
                        return {
                            name: "Water B",
                            temp: ($("a_temp") || {}).value,
                            c: "var(--international-orange)",
                        };
                    if (w === "b")
                        return {
                            name: "Water C",
                            temp: ($("b_temp") || {}).value,
                            c: "var(--cad-cerulean)",
                        };
                    return { name: "", temp: "", c: "var(--rule)" };
                }
                // Auto pour schedule: incremental per-pour grams that sum to the total water.
                // Total water = Dose & ratio (dose×ratio); bloom = ~2.5× dose, then the rest split into two pours.
                function autoSteps() {
                    var dose = +($("bmDose") || {}).value || 0,
                        ratio = +($("bmRatio") || {}).value || 0;
                    var bloomG = dose ? Math.round(dose * 2.5) : 0;
                    if (pourIsSplit()) {
                        // Multi-water: bloom on Water A, then a pour for each water (its builder volume).
                        var steps = [];
                        activeWaterKeys().forEach(function (k, idx) {
                            var v = +($(k + "_vol") || {}).value || 0;
                            if (idx === 0) {
                                var bloom = Math.min(bloomG || 0, v),
                                    build = Math.max(v - bloom, 0);
                                steps.push({
                                    w: k,
                                    t: "Bloom — wet evenly",
                                    g: bloom || "",
                                    sec: 45,
                                });
                                if (build > 0)
                                    steps.push({
                                        w: k,
                                        t: "Build with " + waterMeta(k).name,
                                        g: build,
                                    });
                            } else if (v > 0) {
                                steps.push({
                                    w: k,
                                    t: "Pour " + waterMeta(k).name,
                                    g: v,
                                });
                            }
                        });
                        return steps;
                    }
                    var W =
                        (dose > 0 && ratio > 0
                            ? Math.round(dose * ratio)
                            : 0) ||
                        +$("s_vol").value ||
                        0;
                    if (!W)
                        return [
                            {
                                w: "s",
                                t: "Bloom — wet evenly",
                                g: bloomG || "",
                                sec: 45,
                            },
                        ];
                    var bloom = Math.min(bloomG, W),
                        rem = W - bloom,
                        p1 = Math.round(rem / 2),
                        p2 = rem - p1;
                    var out = [
                        {
                            w: "s",
                            t: "Bloom — wet evenly",
                            g: bloom || "",
                            sec: 45,
                        },
                    ];
                    if (p1 > 0) out.push({ w: "s", t: "First pour", g: p1 });
                    if (p2 > 0)
                        out.push({ w: "s", t: "Pour to finish", g: p2 });
                    return out;
                }
                // Total water each pour stream should reach: per-water builder volumes (split) or dose×ratio (single).
                function pourTargets() {
                    var dose = +($("bmDose") || {}).value || 0,
                        ratio = +($("bmRatio") || {}).value || 0;
                    if (pourIsSplit())
                        return {
                            a: +($("a_vol") || {}).value || 0,
                            b: +($("b_vol") || {}).value || 0,
                        };
                    var W =
                        (dose > 0 && ratio > 0
                            ? Math.round(dose * ratio)
                            : 0) ||
                        +($("s_vol") || {}).value ||
                        0;
                    return { s: W };
                }
                // Re-balance custom pours so each water's pours sum to its target (the last pour absorbs the slack).
                function reflowPours() {
                    if (!POUR || !POUR.length) return;
                    var split = pourIsSplit(),
                        tg = pourTargets(),
                        byW = {};
                    POUR.forEach(function (s, i) {
                        var w = s.w || (split ? "a" : "s");
                        (byW[w] = byW[w] || []).push(i);
                    });
                    for (var w in byW) {
                        if (tg[w] == null) continue;
                        var idxs = byW[w],
                            last = idxs[idxs.length - 1],
                            other = 0;
                        idxs.forEach(function (i) {
                            if (i !== last) other += +POUR[i].g || 0;
                        });
                        var rem = tg[w] - other;
                        POUR[last].g = rem > 0 ? rem : 0;
                    }
                }
                function pad2(n) {
                    return (n < 10 ? "0" : "") + n;
                }
                function pourSame(a, b) {
                    return (
                        a.length === b.length &&
                        a.every(function (s, i) {
                            var x = b[i];
                            return (
                                s.w === x.w &&
                                s.t === x.t &&
                                (s.g || "") === (x.g || "") &&
                                (s.sec || "") === (x.sec || "") &&
                                (s.temp || "") === (x.temp || "") &&
                                (s.agit || "") === (x.agit || "")
                            );
                        })
                    );
                }
                var AGIT = {
                    swirl: "Gentle swirl",
                    stir: "Stir",
                    "swirl-tap": "Swirl + tap",
                    none: "None (still)",
                };
                function agitLabel(a) {
                    return AGIT[a] || a || "";
                }
                function agitOptions(v) {
                    var o = '<option value="">Agitation…</option>';
                    for (var k in AGIT) {
                        o +=
                            '<option value="' +
                            k +
                            '"' +
                            (v === k ? " selected" : "") +
                            ">" +
                            AGIT[k] +
                            "</option>";
                    }
                    return o;
                }
                // Each pour renders as its own .ledger: water · time · temperature · agitation · note.
                // force=true rebuilds even mid-edit; from update() it's a no-op while editing (preserves focus).
                function renderPour(force) {
                    var tb = $("pourRows");
                    if (!tb) return;
                    if (POUR_EDIT && !force) return;
                    var eb = $("pourEdit");
                    if (eb) eb.textContent = POUR_EDIT ? "Done" : "Edit";
                    var custom = !!(POUR && POUR.length),
                        split = pourIsSplit();
                    var steps = custom ? POUR : autoSteps();
                    // The step label (number tag + bloom + water tags) — shared by both modes.
                    function stepLabel(s, i) {
                        var m = waterMeta(s.w);
                        return (
                            '<span class="tag numeric" style="color:' +
                            m.c +
                            ";border-color:" +
                            m.c +
                            '">' +
                            pad2(i + 1) +
                            "</span>" +
                            (m.name
                                ? ' <span class="tag" style="color:' +
                                  m.c +
                                  ";border-color:" +
                                  m.c +
                                  '">' +
                                  m.name +
                                  "</span>"
                                : "")
                        );
                    }
                    // Running total vs the water target (dose×ratio, or the split builder volumes).
                    var sumG = steps.reduce(function (a, s) {
                        return a + (+s.g || 0);
                    }, 0);
                    var tg = pourTargets(),
                        totalTarget = 0;
                    for (var tk in tg) totalTarget += tg[tk] || 0;
                    var totalOff = totalTarget > 0 && Math.abs(sumG - totalTarget) > 2;
                    // Footer stats: total water (color-coded green on-target / red off) +
                    // pour count + brew temp. No total-time, no row fill.
                    var temps = [];
                    steps.forEach(function (s) {
                        var t =
                            s.temp != null && s.temp !== ""
                                ? +s.temp
                                : +waterMeta(s.w).temp;
                        if (t) temps.push(t);
                    });
                    var tempStat = "";
                    if (temps.length) {
                        var lo = Math.min.apply(null, temps),
                            hi = Math.max.apply(null, temps);
                        tempStat = (lo === hi ? lo : lo + "–" + hi) + " °C";
                    }
                    var totalRow =
                        totalTarget > 0
                            ? '<tr><th class="left">Total water</th><td class="numeric"><b style="color:var(--' +
                              (totalOff ? "negative" : "positive") +
                              ')">' +
                              sumG +
                              ' g</b><span class="data"> · ' +
                              steps.length +
                              " pours" +
                              (tempStat ? " · " + tempStat : "") +
                              "</span></td></tr>"
                            : "";
                    // One ledger for both modes (#pourRows is the <tbody> now): a row per
                    // pour step, then the total, then (edit only) the add/balance/reset row.
                    var rows = steps
                        .map(function (s, i) {
                            var m = waterMeta(s.w),
                                accent =
                                    ' class="left" style="border-left-color:' +
                                    m.c +
                                    '"';
                            if (POUR_EDIT) {
                                var sel = split
                                    ? '<select class="input pour-water" data-i="' +
                                      i +
                                      '" style="width:8rem">' +
                                      activeWaterKeys()
                                          .map(function (k) {
                                              return (
                                                  '<option value="' +
                                                  k +
                                                  '"' +
                                                  (s.w === k ? " selected" : "") +
                                                  ">" +
                                                  waterMeta(k).name +
                                                  "</option>"
                                              );
                                          })
                                          .join("") +
                                      "</select>"
                                    : "";
                                // Edit step: a step header (water icon + designator, the
                                // split picker, ✕) followed by one labeled name|input row per
                                // field — like the Water/Brew-method ledgers.
                                var designator = m.name.replace(/^Water\s+/, "");
                                return (
                                    '<tr><th colspan="2" class="left" style="border-left-color:' +
                                    m.c +
                                    '"><span class="cluster gap" style="justify-content:space-between;align-items:center;flex-wrap:wrap">' +
                                    '<span style="display:inline-flex;align-items:center;gap:4px;color:' +
                                    m.c +
                                    ';font-weight:600">' +
                                    pIcon("droplet") +
                                    " " +
                                    designator +
                                    '</span><span class="cluster gap" style="align-items:center">' +
                                    sel +
                                    '<button class="button sm secondary pour-del" data-i="' +
                                    i +
                                    '" type="button" title="remove pour">✕</button>' +
                                    "</span></span></th></tr>" +
                                    '<tr><th>Title</th><td><input class="input pour-step" data-i="' +
                                    i +
                                    '" value="' +
                                    escH(s.t) +
                                    '" placeholder="describe this pour" style="width:100%"></td></tr>' +
                                    '<tr><th>Pour</th><td><span class="input-group" style="width:7rem"><input class="input numeric pour-g" data-i="' +
                                    i +
                                    '" type="number" min="0" step="5" value="' +
                                    escH(s.g != null ? s.g : "") +
                                    '"><span class="input-addon">g</span></span></td></tr>' +
                                    '<tr><th>Time</th><td><span class="input-group" style="width:7rem"><input class="input numeric pour-sec" data-i="' +
                                    i +
                                    '" type="number" min="0" step="5" value="' +
                                    escH(s.sec != null ? s.sec : "") +
                                    '"><span class="input-addon">s</span></span></td></tr>' +
                                    '<tr><th>Temp</th><td><span class="input-group" style="width:7rem"><input class="input numeric pour-temp" data-i="' +
                                    i +
                                    '" type="number" min="0" step="1" value="' +
                                    escH(s.temp != null ? s.temp : "") +
                                    '" placeholder="' +
                                    escH(m.temp || "") +
                                    '"><span class="input-addon">°C</span></span></td></tr>' +
                                    '<tr><th>Method</th><td><input class="input pour-agit" data-i="' +
                                    i +
                                    '" list="agitDL" value="' +
                                    escH(agitLabel(s.agit)) +
                                    '" placeholder="swirl · stir · Rao spin…" style="width:100%"></td></tr>'
                                );
                            }
                            var effTemp =
                                s.temp != null && s.temp !== "" ? s.temp : m.temp;
                            var detail = [
                                s.g ? escH(s.g) + " g" : "",
                                s.sec ? escH(s.sec) + " s" : "",
                                effTemp ? escH(effTemp) + " °C" : "",
                                s.agit ? escH(agitLabel(s.agit)) : "",
                            ]
                                .filter(Boolean)
                                .join(" · ");
                            return (
                                "<tr><th" +
                                accent +
                                ">" +
                                stepLabel(s, i) +
                                (s.t
                                    ? ' <span style="font-weight:600">' +
                                      escH(s.t) +
                                      "</span>"
                                    : "") +
                                '</th><td class="numeric">' +
                                (detail || "—") +
                                "</td></tr>"
                            );
                        })
                        .join("");
                    var html = rows + totalRow;
                    if (POUR_EDIT) {
                        html +=
                            '<tr><td colspan="2"><div class="cluster gap">' +
                            '<button class="button sm secondary" id="pourAdd" type="button">+ Add pour</button>' +
                            (custom
                                ? '<button class="button sm secondary" id="pourBalance" type="button">Balance to target</button>'
                                : "") +
                            (custom
                                ? '<button class="button sm secondary" id="pourReset" type="button">Reset to auto</button>'
                                : "") +
                            "</div></td></tr>";
                    }
                    tb.innerHTML = html;
                }
                function pourToggleEdit() {
                    if (POUR_EDIT) {
                        POUR_EDIT = false;
                        if (POUR) {
                            POUR = POUR.filter(function (s) {
                                return (
                                    s &&
                                    ((s.t && s.t.trim()) ||
                                        s.g ||
                                        s.sec ||
                                        s.temp ||
                                        s.agit)
                                );
                            });
                            if (!POUR.length || pourSame(POUR, autoSteps()))
                                POUR = null; // unchanged → stay live-derived
                        }
                    } else {
                        if (!POUR)
                            POUR = autoSteps().map(function (s) {
                                return {
                                    w: s.w,
                                    t: s.t,
                                    g: s.g,
                                    sec: s.sec,
                                    temp: s.temp,
                                    agit: s.agit,
                                };
                            });
                        POUR_EDIT = true;
                    }
                    renderPour(true);
                }

                function update() {
                    if ($("swType")) readSW(); // refresh starting-water state before recomputing
                    waterUpdate("s"); // single
                    var ra = waterUpdate("a"),
                        rb = waterUpdate("b"); // split A + B (each its own volume + target + dropper)

                    renderPour();
                    renderPostBrew();
                    paintPostBrew();
                    renderChem();
                    renderBrew();
                    renderSaveSummary();
                }

                // ---- water chemistry ----
                // SALTS / ION are loaded from the catalog (buildCatalog). Per-drop composition
                // comes from compFor(id); calibrated Apax yields (CALIB) override the salt model.

                // Ion mg/L delivered by a drop blend at a given total dissolved-mineral load (ppm).
                // r is keyed by drop id (any kit); each drop's salt comp drives the stoichiometry.
                // ---- starting water (the source water before concentrate) ----
                var SW = {
                    type: "ro",
                    gh: 0,
                    kh: 0,
                    hard: "ca",
                };
                var SW_PRESET = {
                    ro: { gh: 0, kh: 0 },
                    soft: { gh: 40, kh: 30 },
                    hard: { gh: 120, kh: 80 },
                    spring: { gh: 80, kh: 50 },
                };
                function startIons() {
                    if (!SW || SW.type === "ro")
                        return { Ca: 0, Mg: 0, HCO3: 0 };
                    var gh = +SW.gh || 0,
                        kh = +SW.kh || 0,
                        HCO3 = kh / 0.8197,
                        Ca = 0,
                        Mg = 0;
                    if (SW.hard === "mg") Mg = gh / 4.118;
                    else if (SW.hard === "both") {
                        Ca = gh / 2 / 2.497;
                        Mg = gh / 2 / 4.118;
                    } else Ca = gh / 2.497;
                    return { Ca: Ca, Mg: Mg, HCO3: HCO3 };
                }
                function startTDS() {
                    return !SW || SW.type === "ro"
                        ? 0
                        : Math.round((+SW.gh || 0) + (+SW.kh || 0));
                }
                function readSW() {
                    var t = ($("swType") || {}).value || "ro";
                    SW.type = t;
                    SW.hard = ($("swHard") || {}).value || "ca";
                    if (t === "custom") {
                        SW.gh = +($("swGH") || {}).value || 0;
                        SW.kh = +($("swKH") || {}).value || 0;
                    } else {
                        var p = SW_PRESET[t] || { gh: 0, kh: 0 };
                        SW.gh = p.gh;
                        SW.kh = p.kh;
                    }
                }
                function initSW() {
                    var ty = $("swType");
                    if (!ty) return;
                    function sync() {
                        readSW();
                        if ($("swCustomRow"))
                            $("swCustomRow").style.display =
                                ty.value === "custom" ? "" : "none";
                        if (typeof update === "function") update();
                    }
                    ty.addEventListener("change", sync);
                    ["swGH", "swKH", "swHard"].forEach(
                        function (id) {
                            var e = $(id);
                            if (e) e.addEventListener("input", sync);
                            if (e) e.addEventListener("change", sync);
                        },
                    );
                    readSW();
                }

                function blendIons(r, ppm, force) {
                    var out = { Ca: 0, Mg: 0, HCO3: 0 };
                    var ids = Object.keys(r),
                        sum = 0;
                    ids.forEach(function (k) {
                        sum += r[k] || 0;
                    });
                    if (sum <= 0) return out;
                    ids.forEach(function (id) {
                        var massC = ppm * ((r[id] || 0) / sum);
                        if (massC <= 0) return;
                        var letter = APAX_LETTER[id];
                        if (
                            CALIB &&
                            CALIB.yields &&
                            letter &&
                            CALIB.yields[letter]
                        ) {
                            // calibrated Apax slot: use solved yields
                            var y = CALIB.yields[letter];
                            out.Ca += massC * y.Ca;
                            out.Mg += massC * y.Mg;
                            out.HCO3 += massC * y.HCO3;
                            return;
                        }
                        var comp = compFor(id);
                        if (!comp) return;
                        var keys = Object.keys(comp),
                            wsum = 0;
                        keys.forEach(function (s) {
                            wsum += comp[s] || 0;
                        });
                        if (wsum <= 0) return;
                        keys.forEach(function (s) {
                            var sm = massC * ((comp[s] || 0) / wsum),
                                S = SALTS[s];
                            if (!S) return;
                            out.Ca += (sm * S.Ca * ION.Ca) / S.mm;
                            out.Mg += (sm * S.Mg * ION.Mg) / S.mm;
                            out.HCO3 += (sm * S.HCO3 * ION.HCO3) / S.mm;
                        });
                    });
                    return out;
                }

                // Build the post-brew g/L inputs from the current kit's drops. Rebuilds only when the
                // drop set changes, so typing into a field never loses focus on every recompute.
                // Post-brew lets you dose ANY drop (any brand + your custom drops), added via a picker.
                // Rebuilds the rows only when the added-set changes, so typing a g/L never loses focus.
                function renderPostBrew() {
                    var host = $("postBrewRows");
                    if (!host) return;
                    var all = [];
                    KITS.forEach(function (k) {
                        k.drops.forEach(function (d) {
                            all.push({ kit: k.name, d: d });
                        });
                    });
                    var added = Object.keys(POST_BREW);
                    var sig = added.slice().sort().join(",");
                    if (sig === POSTBREW_SIG) return;
                    POSTBREW_SIG = sig;
                    var rows = added
                        .map(function (id) {
                            var d = DROP[id] || {},
                                col = d.color || "var(--rule)",
                                v = POST_BREW[id] != null ? POST_BREW[id] : "";
                            // one dense row, identical to a concentrate row: colour accent + dot,
                            // name (× to remove), share gauge, g/L input, dose.
                            return (
                                "<tr>" +
                                '<th class="left" style="border-left-color:' +
                                col +
                                ';width:99%">' +
                                '<span class="cluster gap" style="align-items:center;line-height:1.25"><span><i class="cdot" style="--c:' +
                                (d.color || "") +
                                '"></i>' +
                                (d.name || id) +
                                (d.tag
                                    ? ' <span class="muted" style="font-weight:400">' +
                                      d.tag +
                                      "</span>"
                                    : "") +
                                "</span>" +
                                '<button class="button secondary sm postbrew-del" data-drop="' +
                                id +
                                '" type="button" title="Remove">×</button></span>' +
                                '<div class="gauge thin" style="--fill:' +
                                col +
                                ';margin-top:5px"><div class="fill" id="pb_' +
                                id +
                                '_bar" style="width:0"></div></div>' +
                                "</th>" +
                                // g/L is the stored value (POST_BREW); the +/- steppers set it.
                                // Hidden input mirrors the concentrate ledger's shape.
                                '<td class="numeric" style="white-space:nowrap;vertical-align:top"><input type="hidden" class="postbrew-input" data-drop="' +
                                id +
                                '" value="' +
                                v +
                                '"><b id="pb_' +
                                id +
                                '_g">0</b> g</td>' +
                                '<td class="numeric" style="white-space:nowrap;vertical-align:top"><span class="cluster" style="display:inline-flex;flex-wrap:nowrap;gap:3px;align-items:center;justify-content:flex-end">' +
                                '<button class="button sm secondary postbrew-step" style="padding:0 6px;min-width:0" data-drop="' +
                                id +
                                '" data-step="-1" type="button" tabindex="-1" title="one less drop">−</button>' +
                                '<span style="min-width:1.5em;text-align:center"><b id="pb_' +
                                id +
                                '_d">0</b></span>' +
                                '<button class="button sm secondary postbrew-step" style="padding:0 6px;min-width:0" data-drop="' +
                                id +
                                '" data-step="1" type="button" tabindex="-1" title="one more drop">+</button>' +
                                "</span></td>" +
                                "</tr>"
                            );
                        })
                        .join("");
                    var avail = all.filter(function (x) {
                        return POST_BREW[x.d.id] == null;
                    });
                    var groups = {};
                    avail.forEach(function (x) {
                        (groups[x.kit] = groups[x.kit] || []).push(x.d);
                    });
                    var opts = '<option value="">+ Add a drop…</option>';
                    Object.keys(groups).forEach(function (kn) {
                        opts +=
                            '<optgroup label="' +
                            escH(kn) +
                            '">' +
                            groups[kn]
                                .map(function (d) {
                                    return (
                                        '<option value="' +
                                        d.id +
                                        '">' +
                                        escH(d.name) +
                                        "</option>"
                                    );
                                })
                                .join("") +
                            "</optgroup>";
                    });
                    var pick =
                        '<tr><td colspan="3" class="left" style="border-left:4px solid var(--rule)"><select class="input" id="postBrewPick" style="max-width:18rem">' +
                        opts +
                        "</select></td></tr>";
                    host.innerHTML = rows + pick;
                    paintPostBrew();
                }
                // Post-brew dose is ABSOLUTE g/L of the cup (not scaled to a target like the
                // concentrate): grams = g/L × cup volume; drops = grams × dropper. Mirrors paint().
                function paintPostBrew() {
                    var ids = Object.keys(POST_BREW);
                    var ml = 0;
                    activeWaterKeys().forEach(function (k) {
                        ml += +($(k + "_vol") || {}).value || 0;
                    });
                    var dpg = +($("s_dpg") || {}).value || 20;
                    var vL = ml / 1000;
                    var g = {},
                        d = {},
                        tot = 0,
                        totd = 0,
                        max = 0.0001;
                    ids.forEach(function (id) {
                        var gv = (+POST_BREW[id] || 0) * vL,
                            dr = gv * dpg;
                        g[id] = gv;
                        d[id] = dr;
                        tot += gv;
                        totd += dr;
                        if (gv > max) max = gv;
                    });
                    ids.forEach(function (id) {
                        var bar = $("pb_" + id + "_bar");
                        // fixed g/L scale (POST_BREW[id] is the absolute g/L), like the
                        // concentrate bars — stable, not relative to the biggest.
                        if (bar)
                            bar.style.width =
                                Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        ((+POST_BREW[id] || 0) / BAR_FULL_GL) *
                                            100,
                                    ),
                                ) + "%";
                        var gel = $("pb_" + id + "_g");
                        if (gel) gel.textContent = fg(g[id]);
                        var del = $("pb_" + id + "_d");
                        if (del) del.textContent = fd(d[id]);
                    });
                    if ($("pb_totg")) $("pb_totg").textContent = fg(tot);
                    if ($("pb_totd")) $("pb_totd").textContent = fd(totd);
                }
                // +/- one drop of a post-brew addition. POST_BREW holds absolute g/L (no
                // normalisation), so this just sets the g/L for the new whole-drop count.
                function stepPostBrewDrop(id, step) {
                    var ml = 0;
                    activeWaterKeys().forEach(function (k) {
                        ml += +($(k + "_vol") || {}).value || 0;
                    });
                    var vL = ml / 1000;
                    if (!vL) return;
                    var dpg = +($("s_dpg") || {}).value || 20;
                    var curDrops = Math.round((+POST_BREW[id] || 0) * vL * dpg);
                    var next = Math.max(0, curDrops + step);
                    POST_BREW[id] = +(next / dpg / vL).toFixed(3);
                    update();
                }
                // The finished cup = brew-water ions (already incl. starting water) + post-brew dose
                // (g/L of cup -> +ppm = g/L * 30). Shown as a second readout; hidden when nothing dosed.
                function renderInCup(ions, ppm) {
                    var tbl = $("inCupTable");
                    if (!tbl) return;
                    var sum = 0,
                        k;
                    for (k in POST_BREW) sum += +POST_BREW[k] || 0;
                    if (sum <= 0) {
                        tbl.style.display = "none";
                        return;
                    }
                    var pbPpm = Math.round(sum * 30);
                    var pb = blendIons(POST_BREW, pbPpm, true);
                    var ci = {
                        Ca: ions.Ca + pb.Ca,
                        Mg: ions.Mg + pb.Mg,
                        HCO3: ions.HCO3 + pb.HCO3,
                    };
                    var GH = ci.Ca * 2.497 + ci.Mg * 4.118,
                        KH = ci.HCO3 * 0.8197;
                    var mgca =
                        ci.Ca > 0 ? ci.Mg / 24.31 / (ci.Ca / 40.08) : null;
                    $("cupGH").textContent = Math.round(GH);
                    $("cupKH").textContent = Math.round(KH);
                    $("cupTDS").textContent = ppm + pbPpm;
                    $("cupMgCa").textContent =
                        mgca === null ? "all Mg" : mgca.toFixed(1) + " : 1";
                    tbl.style.display = "";
                }

                function renderChem() {
                    if (!$("chemSource")) return;
                    var src = $("chemSource").value,
                        ions,
                        ppm;
                    var ppmOf = function (p) {
                        return Math.round((+$(p + "_target").value || 0) * 30);
                    };
                    if (src === "cup") {
                        // blend every active water by its volume; each at its own target
                        var tv = 0,
                            cCa = 0,
                            cMg = 0,
                            cH = 0,
                            cPpm = 0;
                        activeWaterKeys().forEach(function (k) {
                            tv += +($(k + "_vol") || {}).value || 0;
                        });
                        if (tv <= 0) tv = 1;
                        activeWaterKeys().forEach(function (k) {
                            var v = +($(k + "_vol") || {}).value || 0,
                                pk = ppmOf(k),
                                ik = blendIons(readRatio(k), pk);
                            cCa += v * ik.Ca;
                            cMg += v * ik.Mg;
                            cH += v * ik.HCO3;
                            cPpm += v * pk;
                        });
                        ions = { Ca: cCa / tv, Mg: cMg / tv, HCO3: cH / tv };
                        ppm = Math.round(cPpm / tv);
                    } else {
                        var p = src === "a" ? "a" : src === "b" ? "b" : "s";
                        ppm = ppmOf(p);
                        ions = blendIons(readRatio(p), ppm);
                    }
                    // total water = drops + starting water (RO/distilled adds 0; an empty drop set = starting water only)
                    var si = startIons();
                    ions = {
                        Ca: ions.Ca + si.Ca,
                        Mg: ions.Mg + si.Mg,
                        HCO3: ions.HCO3 + si.HCO3,
                    };
                    ppm = ppm + startTDS();
                    var GH = ions.Ca * 2.497 + ions.Mg * 4.118,
                        KH = ions.HCO3 * 0.8197;
                    var mgca =
                        ions.Ca > 0
                            ? ions.Mg / 24.31 / (ions.Ca / 40.08)
                            : null;
                    $("chGH").textContent = Math.round(GH);
                    $("chKH").textContent = Math.round(KH);
                    $("chTDS").textContent = ppm;
                    $("chMgCa").textContent =
                        mgca === null ? "all Mg" : mgca.toFixed(1) + " : 1";
                    $("chCa").textContent = Math.round(ions.Ca);
                    $("chMg").textContent = Math.round(ions.Mg);
                    $("chHCO3").textContent = Math.round(ions.HCO3);
                    renderChart(GH, KH);
                    renderInCup(ions, ppm);
                    // Persist the live chemistry so the brew-log form (on /logbook, where
                    // the calculator isn't loaded) can read it cross-page via localStorage.
                    try {
                        localStorage.setItem(
                            "wl_chem",
                            JSON.stringify({
                                gh: Math.round(GH),
                                kh: Math.round(KH),
                                tds: ppm,
                                volume: +($("volume") ? $("volume").value : 0) || 0,
                            }),
                        );
                    } catch (e) {}
                }

                // Hardness (x) vs alkalinity (y) scatter, both as ppm CaCO3, PRESS-styled.
                function renderChart(gh, kh) {
                    var Lm = 46,
                        Rm = 14,
                        Tm = 12,
                        Bm = 34,
                        W = 340,
                        H = 230,
                        pw = W - Lm - Rm,
                        ph = H - Tm - Bm,
                        xMax = 250,
                        yMax = 150;
                    function X(v) {
                        return (
                            Lm + (Math.max(0, Math.min(xMax, v)) / xMax) * pw
                        );
                    }
                    function Y(v) {
                        return (
                            Tm +
                            ph -
                            (Math.max(0, Math.min(yMax, v)) / yMax) * ph
                        );
                    }
                    var g =
                        '<rect class="area" x="' +
                        Lm +
                        '" y="' +
                        Tm +
                        '" width="' +
                        pw +
                        '" height="' +
                        ph +
                        '"/>';
                    [0, 50, 100, 150, 200, 250].forEach(function (v) {
                        var x = X(v);
                        g +=
                            '<line class="grid" x1="' +
                            x +
                            '" y1="' +
                            Tm +
                            '" x2="' +
                            x +
                            '" y2="' +
                            (Tm + ph) +
                            '"/>';
                        g +=
                            '<text class="label" x="' +
                            x +
                            '" y="' +
                            (Tm + ph + 13) +
                            '" text-anchor="middle">' +
                            v +
                            "</text>";
                    });
                    [0, 30, 60, 90, 120, 150].forEach(function (v) {
                        var y = Y(v);
                        g +=
                            '<line class="grid" x1="' +
                            Lm +
                            '" y1="' +
                            y +
                            '" x2="' +
                            (Lm + pw) +
                            '" y2="' +
                            y +
                            '"/>';
                        g +=
                            '<text class="label" x="' +
                            (Lm - 6) +
                            '" y="' +
                            (y + 3) +
                            '" text-anchor="end">' +
                            v +
                            "</text>";
                    });
                    var bx = X(17),
                        bx2 = X(85),
                        by = Y(75),
                        by2 = Y(25);
                    g +=
                        '<rect class="zone" x="' +
                        bx +
                        '" y="' +
                        by +
                        '" width="' +
                        (bx2 - bx) +
                        '" height="' +
                        (by2 - by) +
                        '"/>';
                    g +=
                        '<text class="zone-lbl" x="' +
                        (bx + 4) +
                        '" y="' +
                        (by + 11) +
                        '">SCA reference</text>';
                    g +=
                        '<line class="axis" x1="' +
                        Lm +
                        '" y1="' +
                        Tm +
                        '" x2="' +
                        Lm +
                        '" y2="' +
                        (Tm + ph) +
                        '"/>';
                    g +=
                        '<line class="axis" x1="' +
                        Lm +
                        '" y1="' +
                        (Tm + ph) +
                        '" x2="' +
                        (Lm + pw) +
                        '" y2="' +
                        (Tm + ph) +
                        '"/>';
                    var dx = X(gh),
                        dy = Y(kh);
                    g +=
                        '<line class="guide" x1="' +
                        Lm +
                        '" y1="' +
                        dy +
                        '" x2="' +
                        dx +
                        '" y2="' +
                        dy +
                        '"/>';
                    g +=
                        '<line class="guide" x1="' +
                        dx +
                        '" y1="' +
                        (Tm + ph) +
                        '" x2="' +
                        dx +
                        '" y2="' +
                        dy +
                        '"/>';
                    g +=
                        '<circle class="point warn" cx="' +
                        dx +
                        '" cy="' +
                        dy +
                        '" r="5"/>';
                    var lx = dx + 9,
                        anchor = "start";
                    if (dx > Lm + pw - 46) {
                        lx = dx - 9;
                        anchor = "end";
                    }
                    g +=
                        '<text class="value" x="' +
                        lx +
                        '" y="' +
                        (dy - 7) +
                        '" text-anchor="' +
                        anchor +
                        '">GH ' +
                        Math.round(gh) +
                        " \u00b7 KH " +
                        Math.round(kh) +
                        "</text>";
                    g +=
                        '<text class="title" x="' +
                        (Lm + pw / 2) +
                        '" y="' +
                        (H - 2) +
                        '" text-anchor="middle">Hardness \u00b7 GH (ppm CaCO\u2083)</text>';
                    g +=
                        '<text class="title" transform="translate(11,' +
                        (Tm + ph / 2) +
                        ') rotate(-90)" text-anchor="middle">Alkalinity \u00b7 KH (ppm CaCO\u2083)</text>';
                    $("chemChart").innerHTML =
                        '<svg viewBox="0 0 ' +
                        W +
                        " " +
                        H +
                        '">' +
                        g +
                        "</svg>";
                }

                // drops feeding the composition table = those in the currently-analyzed water(s)
                function compDropsForSource() {
                    var src = $("chemSource")
                        ? $("chemSource").value
                        : "single";
                    if (src === "cup") {
                        var seen = {},
                            out = [];
                        ["a", "b"].forEach(function (p) {
                            activeDrops(p).forEach(function (d) {
                                if (!seen[d.id]) {
                                    seen[d.id] = 1;
                                    out.push(d);
                                }
                            });
                        });
                        return out;
                    }
                    var p = src === "a" ? "a" : src === "b" ? "b" : "s";
                    return activeDrops(p);
                }
                function provLabel(p) {
                    return p === "exact"
                        ? "exact \u2014 published dose"
                        : p === "labeled"
                          ? "ingredients labeled, split estimated"
                          : p === "published-profile"
                            ? "published profile"
                            : p === "custom"
                              ? "your recipe"
                              : "estimated";
                }
                function buildComp() {
                    var el = $("compEditor");
                    if (!el) return;
                    var drops = compDropsForSource().filter(function (d) {
                        return compFor(d.id);
                    });
                    if (!drops.length) {
                        el.innerHTML =
                            '<p class="data">This water uses complete profiles (e.g. Third Wave Water) \u2014 no editable salt split.</p>';
                        return;
                    }
                    var present = {};
                    drops.forEach(function (d) {
                        var c = compFor(d.id);
                        for (var s in c) present[s] = 1;
                    });
                    var order = SALT_ORDER.filter(function (s) {
                        return present[s];
                    });
                    var span = drops.length + 1;
                    var hid = COMP_OPEN ? "" : " hidden"; // the header row is the toggle; the rest shows only when open
                    var h =
                        '<table class="ledger"><thead>' +
                        '<tr class="comp-head" style="cursor:pointer"><th colspan="' +
                        span +
                        '" class="left"><span class="cluster" style="justify-content:space-between;align-items:center;gap:var(--space-3)"><span><span class="dq-arrow">' +
                        (COMP_OPEN ? "▾" : "▸") +
                        '</span> Composition model <button class="hint" type="button" data-hint="Salt weight per drop. Tap a salt to see what it does.">?</button> <span class="data" style="font-weight:400">— salt recipe behind each drop</span></span>' +
                        (COMP_OPEN
                            ? '<button class="button sm secondary" id="compReset" type="button">Reset model</button>'
                            : "") +
                        "</span></th></tr>" +
                        "<tr" +
                        hid +
                        "><th>salt</th>" +
                        drops
                            .map(function (d) {
                                return (
                                    '<th class="left"><i class="cdot" style="--c:' +
                                    d.color +
                                    '"></i>' +
                                    d.name +
                                    "</th>"
                                );
                            })
                            .join("") +
                        "</tr>" +
                        "</thead><tbody>";
                    order.forEach(function (s) {
                        var S = SALTS[s] || { name: s, formula: s };
                        h +=
                            "<tr" +
                            hid +
                            '><th class="left"><button type="button" class="salt-term" data-salt="' +
                            s +
                            '" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;font:inherit;text-decoration:underline dotted;text-underline-offset:3px">' +
                            (S.formula || S.name) +
                            "</button></th>";
                        drops.forEach(function (d) {
                            var c = compFor(d.id),
                                v = c[s];
                            h +=
                                v === undefined
                                    ? '<td class="muted left">\u2014</td>'
                                    : '<td><input class="input comp-input" data-drop="' +
                                      d.id +
                                      '" data-salt="' +
                                      s +
                                      '" type="number" step="0.01" min="0" value="' +
                                      v +
                                      '" style="width:100%;padding:1px 5px"></td>';
                        });
                        h += "</tr>";
                        var role =
                            S.contributes === "GH"
                                ? "raises hardness (GH)"
                                : S.contributes === "KH"
                                  ? "raises alkalinity (KH)"
                                  : "flavour-neutral";
                        h +=
                            '<tr class="salt-info" data-salt="' +
                            s +
                            '" hidden><td colspan="' +
                            span +
                            '" class="left" style="padding:var(--space-2) var(--space-3);border-left:4px solid var(--info);background:color-mix(in srgb, var(--info) 6%, var(--bg))">' +
                            "<b>" +
                            (S.name || s) +
                            '</b> <span class="data">' +
                            role +
                            (S.flavor ? " \u00b7 " + S.flavor : "") +
                            "</span><br>" +
                            (S.explainer || "") +
                            "</td></tr>";
                    });
                    h +=
                        "<tr" +
                        hid +
                        '><td colspan="' +
                        span +
                        '" class="left" style="border-left:4px solid var(--rule)"><button type="button" class="dq-toggle" style="background:none;border:0;padding:0;cursor:pointer;color:inherit;font:inherit"><span class="data">data quality <span class="dq-arrow">&#9656;</span></span></button></td></tr>';
                    h +=
                        '<tr class="dq-detail" hidden><td colspan="' +
                        span +
                        '" class="left" style="border-left:4px solid var(--rule)"><span class="data">' +
                        drops
                            .map(function (d) {
                                return d.name + ": " + provLabel(d.provenance);
                            })
                            .join(" \u00b7 ") +
                        "</span></td></tr>";
                    el.innerHTML = h + "</tbody></table>";
                    var rb = $("compReset");
                    if (rb) rb.onclick = resetComp;
                }
                function resetComp() {
                    compDropsForSource().forEach(function (d) {
                        delete COMP_OVR[d.id];
                    });
                    buildComp();
                    update();
                }

                // Build SALTS / DROP / KITS from the fetched catalog payload.
                function buildCatalog(c) {
                    SALTS = {};
                    var ghs = [],
                        khs = [],
                        neu = [];
                    (c.salts || []).forEach(function (s) {
                        SALTS[s.key] = {
                            name: s.name,
                            formula: s.formula,
                            mm: s.mm,
                            Ca: s.ca,
                            Mg: s.mg,
                            HCO3: s.hco3,
                            contributes: s.contributes,
                            ion: s.ion,
                            flavor: s.flavor,
                            explainer: s.explainer,
                        };
                        (s.contributes === "GH"
                            ? ghs
                            : s.contributes === "KH"
                              ? khs
                              : neu
                        ).push(s.key);
                    });
                    SALT_ORDER = ghs.concat(khs, neu);
                    DROP = {};
                    MY_DROPS = c.userDrops || [];
                    var all = (c.drops || []).concat(c.userDrops || []);
                    all.forEach(function (d) {
                        DROP[d.id] = d;
                    });
                    // group blendable drops (anything with an editable salt comp) into kits by brand
                    var byBrand = {};
                    (c.brands || []).forEach(function (b) {
                        byBrand[b.id] = {
                            id: b.id,
                            name: b.name,
                            blurb: b.blurb,
                            drops: [],
                        };
                    });
                    byBrand["you"] = {
                        id: "you",
                        name: "My drops",
                        blurb: "Your own custom concentrates",
                        drops: [],
                    }; // always present in the picker (empty kit → "+ Add drop")
                    all.forEach(function (d) {
                        if (d.dose_model === "profile" || !d.comp) return;
                        var b = byBrand[d.brand_id];
                        if (b) b.drops.push(d);
                    });
                    KITS = [];
                    (c.brands || []).forEach(function (b) {
                        if (byBrand[b.id].drops.length)
                            KITS.push(byBrand[b.id]);
                    });
                    KITS.push(byBrand["you"]); // "My drops" always selectable, even with zero custom drops yet
                    if (!kitById(DEFAULT_KIT) && KITS.length)
                        DEFAULT_KIT = KITS[0].id;
                    // brew gear (brand→model; 200+ rows each — selects are grouped by brand)
                    BREWERS = c.brewers || [];
                    FILTERS = c.filters || [];
                    GRINDERS = c.grinders || [];
                    BREWER_BY = {};
                    FILTER_BY = {};
                    GRINDER_BY = {};
                    BREWERS.forEach(function (b) {
                        BREWER_BY[b.id] = b;
                    });
                    FILTERS.forEach(function (f) {
                        FILTER_BY[f.id] = f;
                    });
                    GRINDERS.forEach(function (g) {
                        GRINDER_BY[g.id] = g;
                    });
                    FAVS = { brewer: {}, filter: {}, grinder: {} };
                    (c.favorites || []).forEach(function (x) {
                        if (FAVS[x.kind]) FAVS[x.kind][x.ref_id] = true;
                    });
                    fillGear();
                }
                // Build brand-grouped <optgroup> options; favorited models float to a "★ Favorites" group.
                function gearOptions(list, placeholder, kind) {
                    var fav = FAVS[kind] || {},
                        opt = function (x) {
                            return (
                                '<option value="' +
                                x.id +
                                '">' +
                                escH(x.model) +
                                (x.discontinued ? " (disc.)" : "") +
                                "</option>"
                            );
                        };
                    var favs = list.filter(function (x) {
                        return fav[x.id];
                    });
                    var groups = {},
                        order = [];
                    list.forEach(function (x) {
                        if (fav[x.id]) return;
                        var br = x.brand || "Other";
                        if (!groups[br]) {
                            groups[br] = [];
                            order.push(br);
                        }
                        groups[br].push(x);
                    });
                    var html = '<option value="">' + placeholder + "</option>";
                    if (favs.length)
                        html +=
                            '<optgroup label="★ Favorites">' +
                            favs
                                .map(function (x) {
                                    return (
                                        '<option value="' +
                                        x.id +
                                        '">' +
                                        escH(
                                            (x.brand ? x.brand + " " : "") +
                                                x.model,
                                        ) +
                                        "</option>"
                                    );
                                })
                                .join("") +
                            "</optgroup>";
                    html += order
                        .map(function (br) {
                            return (
                                '<optgroup label="' +
                                escH(br) +
                                '">' +
                                groups[br].map(opt).join("") +
                                "</optgroup>"
                            );
                        })
                        .join("");
                    return html;
                }
                // Reflect whether the selected gear is favorited on its ★ toggle button.
                function syncFavBtn(selId, btnId, kind) {
                    var s = $(selId),
                        b = $(btnId);
                    if (!s || !b) return;
                    var on = !!(s.value && (FAVS[kind] || {})[s.value]);
                    // Bare star like the logbook score stars: Press star icon, filled when favorited.
                    var raw =
                        window.Press && Press.icon ? Press.icon("star") : "";
                    b.innerHTML = raw
                        ? raw.replace(
                              'class="icon"',
                              on ? 'class="icon fill"' : 'class="icon"',
                          )
                        : on
                          ? "★"
                          : "☆";
                    b.classList.toggle("on", on);
                    b.disabled = !s.value;
                    b.setAttribute("aria-pressed", on ? "true" : "false");
                    b.title = !s.value
                        ? "Pick gear first"
                        : on
                          ? "Remove favorite"
                          : "Add to favorites";
                }
                function fillGear() {
                    var bw = $("bmBrewer");
                    if (bw) {
                        var c1 = bw.value;
                        bw.innerHTML = gearOptions(
                            BREWERS,
                            "— pick a brewer —",
                            "brewer",
                        );
                        if (c1) bw.value = c1;
                    }
                    var fl = $("bmFilter");
                    if (fl) {
                        var c2 = fl.value;
                        fl.innerHTML = gearOptions(
                            FILTERS,
                            "— pick a filter —",
                            "filter",
                        );
                        if (c2) fl.value = c2;
                    }
                    var gr = $("bmGrinder");
                    if (gr && gr.tagName === "SELECT") {
                        var c3 = gr.value;
                        gr.innerHTML = gearOptions(
                            GRINDERS,
                            "— pick a grinder —",
                            "grinder",
                        );
                        if (c3) gr.value = c3;
                    }
                    syncFavBtn("bmBrewer", "bmBrewerFav", "brewer");
                    syncFavBtn("bmFilter", "bmFilterFav", "filter");
                    syncFavBtn("bmGrinder", "bmGrinderFav", "grinder");
                    gearNote();
                }
                // Toggle the selected gear's favorite, persist, re-render the picker.
                function toggleFav(kind, selId) {
                    if (!AUTH) {
                        alert("Sign in to save favorites.");
                        return;
                    }
                    var s = $(selId),
                        id = s && s.value;
                    if (!id) return;
                    var was = (FAVS[kind] || {})[id];
                    if (was) delete FAVS[kind][id];
                    else FAVS[kind][id] = true; // optimistic
                    fillGear();
                    mdApi("/api/favorites", {
                        method: "POST",
                        body: JSON.stringify({ kind: kind, ref_id: id }),
                    })
                        .then(function (r) {
                            if (r && typeof r.favorited === "boolean") {
                                if (r.favorited) FAVS[kind][id] = true;
                                else delete FAVS[kind][id];
                                fillGear();
                            }
                        })
                        .catch(function () {
                            if (was) FAVS[kind][id] = true;
                            else delete FAVS[kind][id];
                            fillGear();
                        });
                }
                // Tap-to-show explainer beneath each gear select: icon + brand model + type/spec + signature.
                function gearNote() {
                    var ic = function (n) {
                        return n ? pIcon(n) + " " : "";
                    };
                    var b = BREWER_BY[($("bmBrewer") || {}).value],
                        bn = $("bmBrewerNote");
                    if (bn)
                        bn.innerHTML = b
                            ? ic(b.icon) +
                              "<b>" +
                              escH(b.brand + " " + b.model) +
                              "</b>" +
                              (b.type
                                  ? ' <span class="tag">' +
                                    escH(b.type) +
                                    "</span>"
                                  : "") +
                              (b.filter_format
                                  ? ' <span class="data">· ' +
                                    escH(b.filter_format) +
                                    "</span>"
                                  : "") +
                              (b.signature
                                  ? '<br><span class="data">' +
                                    escH(b.signature) +
                                    "</span>"
                                  : "")
                            : "";
                    var f = FILTER_BY[($("bmFilter") || {}).value],
                        fn = $("bmFilterNote");
                    if (fn)
                        fn.innerHTML = f
                            ? ic(f.icon) +
                              "<b>" +
                              escH(f.brand + " " + f.model) +
                              "</b>" +
                              (f.material
                                  ? ' <span class="tag">' +
                                    escH(f.material) +
                                    "</span>"
                                  : "") +
                              (f.format
                                  ? ' <span class="data">· ' +
                                    escH(f.format) +
                                    "</span>"
                                  : "") +
                              (f.trait
                                  ? '<br><span class="data">' +
                                    escH(f.trait) +
                                    "</span>"
                                  : "")
                            : "";
                    var g = GRINDER_BY[($("bmGrinder") || {}).value],
                        gn = $("bmGrinderNote");
                    if (gn)
                        gn.innerHTML = g
                            ? ic(g.icon) +
                              "<b>" +
                              escH(g.brand + " " + g.model) +
                              "</b>" +
                              (g.burr_type
                                  ? ' <span class="tag">' +
                                    escH(
                                        (g.burr_mm ? g.burr_mm + "mm " : "") +
                                            g.burr_type +
                                            " burr",
                                    ) +
                                    "</span>"
                                  : "") +
                              (g.known_for
                                  ? '<br><span class="data">' +
                                    escH(g.known_for) +
                                    "</span>"
                                  : "")
                            : "";
                }
                // Live brew readout: derived water (dose×ratio). Temperature/agitation/bloom now live per-pour.
                function renderBrew() {
                    var dose = +($("bmDose") || {}).value || 0,
                        ratio = +($("bmRatio") || {}).value || 0,
                        w = $("bmWater");
                    var water =
                        dose > 0 && ratio > 0 ? Math.round(dose * ratio) : 0;
                    if (w) w.textContent = water ? String(water) : "—";
                }
                // ---- My drops (custom concentrate) editor ----
                // This (calculator) IIFE has no $/esc/api/ME from the app IIFE — use local helpers + an
                // auth bridge (window.WaterLab.setAuth, called by the app IIFE when login resolves).
                var DROP_PALETTE = [
                    "var(--cad-turquoise)",
                    "var(--cad-rose)",
                    "var(--cad-sap)",
                    "var(--cad-orange)",
                    "var(--cad-cobalt)",
                ];
                var AUTH = null,
                    MD_CAPPED = false;
                function mdApi(path, opts) {
                    opts = opts || {};
                    opts.credentials = "same-origin";
                    opts.headers = { "Content-Type": "application/json" };
                    return fetch(path, opts).then(function (r) {
                        return r.json().catch(function () {
                            return {};
                        });
                    });
                }
                function dropById(id) {
                    for (var i = 0; i < MY_DROPS.length; i++)
                        if (MY_DROPS[i].id === id) return MY_DROPS[i];
                    return null;
                }
                function ymGH(key) {
                    var S = SALTS[key];
                    if (!S) return 0;
                    return (
                        ((S.Ca * ION.Ca) / S.mm) * 2.497 +
                        ((S.Mg * ION.Mg) / S.mm) * 4.118
                    );
                }
                function ymKH(key) {
                    var S = SALTS[key];
                    if (!S) return 0;
                    return ((S.HCO3 * ION.HCO3) / S.mm) * 0.8197;
                }
                // Back out a salt comp that yields the measured GH/KH per the given dose (g/L).
                function compFromMeasured(gh, kh, dose, hardFrom) {
                    // The pipeline doses by ppm (= g/L × 30), so a drop's per-unit yield is GH ÷ (30·dose).
                    var perGH = gh / (30 * (dose || 1)),
                        perKH = kh / (30 * (dose || 1)),
                        comp = {};
                    var alk = SALTS["nahco3"]
                        ? "nahco3"
                        : SALTS["khco3"]
                          ? "khco3"
                          : null;
                    if (alk && perKH > 0) {
                        var y = ymKH(alk);
                        if (y > 0) comp[alk] = perKH / y;
                    }
                    function addHard(key, share) {
                        var yy = ymGH(key);
                        if (yy > 0 && SALTS[key])
                            comp[key] = (comp[key] || 0) + share / yy;
                    }
                    if (hardFrom === "ca") addHard("cacl2", perGH);
                    else if (hardFrom === "both") {
                        addHard("mgcl2", perGH / 2);
                        addHard("cacl2", perGH / 2);
                    } else addHard("mgcl2", perGH);
                    var sum = 0,
                        k;
                    for (k in comp) sum += comp[k];
                    MD_CAPPED = sum > 1; // target exceeds what a salt mix can deliver at this dose → capped
                    if (sum < 1 && SALTS["nacl"]) comp["nacl"] = 1 - sum;
                    else if (sum > 1) {
                        for (k in comp) comp[k] /= sum;
                    }
                    return comp;
                }
                // The drop editor — its fields are plain rows of the concentrate ledger itself (no nested table),
                // so they sit flush with the drop rows above and carry the drop's own colour down the 4px accent bar.
                // Measured/split rows share the .md-measured / .md-split classes and toggle by `hidden`.
                // d = the drop being edited, or null for a new one.
                // /api/catalog returns comp/dose_json already parsed to objects; older/raw rows may be JSON strings — accept both.
                function asObj(v) {
                    if (v == null) return null;
                    if (typeof v === "object") return v;
                    try {
                        return JSON.parse(v);
                    } catch (e) {
                        return null;
                    }
                }
                function dropFormRow(p, d) {
                    d = d || {};
                    var name = escH(d.name || ""),
                        comp = asObj(d.comp) || {};
                    var m = asObj(d.dose_json);
                    var mode = m ? "measured" : d.comp ? "split" : "measured"; // new drops default to measured GH/KH
                    var col = d.color || "var(--rule)"; // expanded editor carries the drop's own accent
                    var acc = 'style="border-left-color:' + col + '"'; // tbody <th>: 4px bar comes from .ledger, recolour it
                    var accTd = 'style="border-left:4px solid ' + col + '"'; // full-width <td> rows: paint the bar ourselves
                    var meaHid = mode === "split" ? " hidden" : "",
                        splHid = mode === "measured" ? " hidden" : "";
                    var doseHint =
                        "We back out a salt mix that yields this GH/KH at the dose above. A mix maxes near 30 × dose GH — raise the dose for a stronger concentrate.";
                    var saltRows = SALT_ORDER.map(function (k) {
                        var S = SALTS[k] || {},
                            v = comp[k] != null ? comp[k] : "";
                        return (
                            '<tr class="md-row md-split"' +
                            splHid +
                            '><th class="left" style="font-weight:500;border-left-color:' +
                            col +
                            '">' +
                            escH(S.formula || S.name || k) +
                            '</th><td colspan="2"><input class="input numeric md-salt" data-salt="' +
                            k +
                            '" type="number" min="0" step="0.05" value="' +
                            v +
                            '" style="width:7rem" placeholder="0"></td></tr>'
                        );
                    }).join("");
                    var editing = DROP_EDIT && DROP_EDIT !== "__new__";
                    return (
                        '<tr class="md-row"><th ' +
                        acc +
                        '>Name</th><td colspan="2"><input class="input" id="md-name" value="' +
                        name +
                        '" placeholder="My house mix" style="width:100%"></td></tr>' +
                        '<tr class="md-row"><th ' +
                        acc +
                        '>Defined by</th><td colspan="2"><select class="input" id="md-mode" style="width:100%"><option value="measured"' +
                        (mode === "measured" ? " selected" : "") +
                        '>Measured GH / KH</option><option value="split"' +
                        (mode === "split" ? " selected" : "") +
                        ">Salt recipe (advanced)</option></select></td></tr>" +
                        '<tr class="md-row md-measured"' +
                        meaHid +
                        "><th " +
                        acc +
                        '>GH <span class="data">ppm</span></th><td colspan="2"><input class="input numeric" id="md-gh" type="number" min="0" step="1" value="' +
                        (m ? escH(m.gh) : "") +
                        '" style="width:7rem"></td></tr>' +
                        '<tr class="md-row md-measured"' +
                        meaHid +
                        "><th " +
                        acc +
                        '>KH <span class="data">ppm</span></th><td colspan="2"><input class="input numeric" id="md-kh" type="number" min="0" step="1" value="' +
                        (m ? escH(m.kh) : "") +
                        '" style="width:7rem"></td></tr>' +
                        '<tr class="md-row md-measured"' +
                        meaHid +
                        "><th " +
                        acc +
                        '>at dose <span class="data">g/L</span> <button class="hint" type="button" data-hint="' +
                        doseHint +
                        '">?</button></th><td colspan="2"><input class="input numeric" id="md-dose" type="number" min="0.01" step="0.1" value="' +
                        (m && m.dose ? escH(m.dose) : "1") +
                        '" style="width:7rem"></td></tr>' +
                        '<tr class="md-row md-measured"' +
                        meaHid +
                        "><th " +
                        acc +
                        '>Hardness from</th><td colspan="2"><select class="input" id="md-hard" style="width:100%"><option value="mg"' +
                        (!m || m.hard === "mg" ? " selected" : "") +
                        '>Magnesium</option><option value="ca"' +
                        (m && m.hard === "ca" ? " selected" : "") +
                        '>Calcium</option><option value="both"' +
                        (m && m.hard === "both" ? " selected" : "") +
                        ">Both (50/50)</option></select></td></tr>" +
                        '<tr class="md-row md-split"' +
                        splHid +
                        '><th class="left" colspan="3" style="border-left-color:' +
                        col +
                        '">Salt parts <span class="data">relative weights</span></th></tr>' +
                        saltRows +
                        '<tr class="md-row action"><td colspan="3" class="left" ' +
                        accTd +
                        '><span class="cluster gap" style="justify-content:space-between;align-items:center">' +
                        (editing
                            ? '<button class="button secondary sm md-del" data-id="' +
                              DROP_EDIT +
                              '" type="button">Delete</button>'
                            : "<span></span>") +
                        '<span class="cluster gap"><button class="button secondary sm" type="button" id="md-cancel">Cancel</button><button class="button sm" type="button" id="md-save">Save drop</button></span>' +
                        "</span></td></tr>" +
                        '<tr class="md-row"><td colspan="3" id="md-msg" class="data" ' +
                        accTd +
                        "></td></tr>"
                    );
                }
                // Wire the per-panel edit affordances + (for the panel hosting the open form) its controls. (Add lives in the header.)
                function wireConcEditors(p) {
                    var scope = document.querySelector(
                        '.conc-rows[data-prefix="' + p + '"]',
                    );
                    if (!scope) return;
                    Array.prototype.forEach.call(
                        scope.querySelectorAll(".conc-edit"),
                        function (b) {
                            b.onclick = function () {
                                DROP_EDIT = b.getAttribute("data-id");
                                DROP_EDIT_P = p;
                                renderConc();
                            };
                        },
                    );
                    if (DROP_EDIT_P !== p) return; // form controls live only in the hosting panel
                    var mode = $("md-mode");
                    if (mode)
                        mode.onchange = function () {
                            var sp = this.value === "split";
                            Array.prototype.forEach.call(
                                scope.querySelectorAll(".md-measured"),
                                function (r) {
                                    r.hidden = sp;
                                },
                            );
                            Array.prototype.forEach.call(
                                scope.querySelectorAll(".md-split"),
                                function (r) {
                                    r.hidden = !sp;
                                },
                            );
                        };
                    var sv = $("md-save");
                    if (sv) sv.onclick = saveDrop;
                    var cc = $("md-cancel");
                    if (cc)
                        cc.onclick = function () {
                            DROP_EDIT = null;
                            DROP_EDIT_P = null;
                            renderConc();
                        };
                    var del = scope.querySelector(".md-del");
                    if (del)
                        del.onclick = function () {
                            if (!confirm("Delete this drop?")) return;
                            mdApi("/api/drops/" + del.getAttribute("data-id"), {
                                method: "DELETE",
                            }).then(function () {
                                DROP_EDIT = null;
                                DROP_EDIT_P = null;
                                refreshCatalog();
                            });
                        };
                }
                function saveDrop() {
                    var name = (($("md-name") || {}).value || "").trim(),
                        msg = $("md-msg");
                    if (!name) {
                        if (msg) msg.textContent = "Name required.";
                        return;
                    }
                    var mode = ($("md-mode") || {}).value || "split",
                        comp = {},
                        dose_json = null,
                        k;
                    if (mode === "split") {
                        Array.prototype.forEach.call(
                            document.querySelectorAll(".md-salt"),
                            function (i) {
                                var v = parseFloat(i.value);
                                if (v > 0)
                                    comp[i.getAttribute("data-salt")] = v;
                            },
                        );
                        if (!Object.keys(comp).length) {
                            if (msg)
                                msg.textContent = "Add at least one salt part.";
                            return;
                        }
                    } else {
                        var gh = parseFloat(($("md-gh") || {}).value) || 0,
                            kh = parseFloat(($("md-kh") || {}).value) || 0,
                            dose = parseFloat(($("md-dose") || {}).value) || 1,
                            hard = ($("md-hard") || {}).value || "mg";
                        if (gh <= 0 && kh <= 0) {
                            if (msg) msg.textContent = "Enter a GH and/or KH.";
                            return;
                        }
                        comp = compFromMeasured(gh, kh, dose, hard);
                        dose_json = JSON.stringify({
                            gh: gh,
                            kh: kh,
                            dose: dose,
                            hard: hard,
                        });
                        if (
                            MD_CAPPED &&
                            !confirm(
                                "At " +
                                    dose +
                                    " g/L a salt mix can't reach GH " +
                                    gh +
                                    " / KH " +
                                    kh +
                                    " (it maxes near 30×dose). Save anyway, or Cancel and raise the dose to hit the exact numbers?",
                            )
                        ) {
                            if (msg) msg.textContent = "";
                            return;
                        }
                    }
                    var editing = DROP_EDIT && DROP_EDIT !== "__new__";
                    var color = editing
                        ? (dropById(DROP_EDIT) || {}).color ||
                          "var(--cad-turquoise)"
                        : DROP_PALETTE[MY_DROPS.length % DROP_PALETTE.length];
                    var body = {
                        name: name,
                        comp: JSON.stringify(comp),
                        dose_model: "gl",
                        dose_json: dose_json,
                        color: color,
                    };
                    if (msg) msg.textContent = "Saving…";
                    var wasNew = !editing,
                        panel = DROP_EDIT_P;
                    mdApi(editing ? "/api/drops/" + DROP_EDIT : "/api/drops", {
                        method: editing ? "PUT" : "POST",
                        body: JSON.stringify(body),
                    })
                        .then(function (res) {
                            // A freshly created custom drop drops straight into the water it was added from.
                            if (
                                wasNew &&
                                panel &&
                                res &&
                                res.id &&
                                (DSET[panel] || []).indexOf(res.id) < 0
                            )
                                DSET[panel] = (DSET[panel] || []).concat(res.id);
                            DROP_EDIT = null;
                            DROP_EDIT_P = null;
                            refreshCatalog();
                        })
                        .catch(function () {
                            if (msg) msg.textContent = "Save failed.";
                        });
                }
                function refreshCatalog() {
                    return fetch("/api/catalog", { credentials: "same-origin" })
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (c) {
                            buildCatalog(c);
                            renderConc();
                            update();
                        });
                }

                function boot() {
                    var initPreset = { s: "washed", a: "bright", b: "sweet" }; // sensible Apax starters
                    // Inject the water blocks from one template so Single + each Split column are identical.
                    var WCFG = {
                        s: {
                            title: "Water A",
                            sub: "",
                            accent: "var(--text)",
                            vol: 500,
                            temp: 94,
                        },
                        a: {
                            title: "Water B",
                            sub: "",
                            accent: "var(--international-orange)",
                            vol: 300,
                            temp: 96,
                            removable: true,
                        },
                        b: {
                            title: "Water C",
                            sub: "",
                            accent: "var(--cad-cerulean)",
                            vol: 200,
                            temp: 85,
                            removable: true,
                        },
                    };
                    ["s", "a", "b"].forEach(function (p) {
                        var el = $("wp-" + p);
                        if (el) el.innerHTML = waterPanelHtml(p, WCFG[p]);
                    });
                    // Seed each water from a starter preset (sets its drop SET + ratios).
                    ["s", "a", "b"].forEach(function (p) {
                        buildWater(p);
                        var sel = $(p + "_preset");
                        if (sel) sel.value = initPreset[p];
                        applyPreset(p, initPreset[p]);
                    });
                    // preset selectors
                    ["s", "a", "b"].forEach(function (p) {
                        var ps = $(p + "_preset");
                        if (ps)
                            ps.addEventListener("change", function () {
                                if (this.value !== "custom")
                                    applyPreset(p, this.value);
                                update();
                            });
                    });
                    // + Add water / × Remove water (A always; B then C, max 3)
                    var addW = $("addWater");
                    if (addW)
                        addW.onclick = function () {
                            if (WATERS < 3) {
                                WATERS++;
                                syncWaters();
                            }
                        };
                    document.addEventListener("click", function (e) {
                        var rb =
                            e.target &&
                            e.target.closest &&
                            e.target.closest(".water-remove");
                        if (rb) {
                            if (WATERS > 1) WATERS--;
                            syncWaters();
                        }
                    });
                    // +/- drop steppers in the concentrate ledger
                    document.addEventListener("click", function (e) {
                        var b =
                            e.target &&
                            e.target.closest &&
                            e.target.closest(".drop-step");
                        if (!b) return;
                        stepDrop(
                            b.getAttribute("data-prefix"),
                            b.getAttribute("data-id"),
                            +b.getAttribute("data-step") || 0,
                        );
                    });
                    // × remove a drop from a water's concentrate ledger
                    document.addEventListener("click", function (e) {
                        var x =
                            e.target &&
                            e.target.closest &&
                            e.target.closest(".conc-del");
                        if (!x) return;
                        removeDropFromWater(
                            x.getAttribute("data-prefix"),
                            x.getAttribute("data-id"),
                        );
                    });
                    // "+ Add a drop…" picker — add any catalog/custom drop (or open the new-drop form)
                    document.addEventListener("change", function (e) {
                        var t = e.target;
                        if (!t || !t.classList || !t.classList.contains("conc-pick"))
                            return;
                        var v = t.value;
                        if (v) addDropToWater(t.getAttribute("data-prefix"), v);
                    });
                    syncWaters(); // initial: 1 water (Water A)
                    // brew-method gear: brewer/filter explainers + dose/ratio→volume helper
                    var FAVMAP = {
                        bmBrewer: ["bmBrewerFav", "brewer"],
                        bmFilter: ["bmFilterFav", "filter"],
                        bmGrinder: ["bmGrinderFav", "grinder"],
                    };
                    ["bmBrewer", "bmFilter", "bmGrinder"].forEach(
                        function (id) {
                            var s = $(id);
                            if (s)
                                s.addEventListener("change", function () {
                                    gearNote();
                                    update();
                                    var m = FAVMAP[id];
                                    if (m) syncFavBtn(id, m[0], m[1]);
                                });
                        },
                    );
                    // gear favorite ★ toggles
                    [
                        ["bmBrewerFav", "brewer", "bmBrewer"],
                        ["bmFilterFav", "filter", "bmFilter"],
                        ["bmGrinderFav", "grinder", "bmGrinder"],
                    ].forEach(function (t) {
                        var b = $(t[0]);
                        if (b)
                            b.onclick = function () {
                                toggleFav(t[1], t[2]);
                            };
                    });
                    fillGear();
                    // any input -> recompute; ratio edit -> preset custom; comp edit -> COMP_OVR; chemSource -> rebuild comp
                    document.addEventListener("input", function (e) {
                        var t = e.target;
                        if (
                            t.classList &&
                            t.classList.contains("ratio-input")
                        ) {
                            var pp = t.getAttribute("data-prefix"),
                                psel = $(pp + "_preset");
                            if (psel) psel.value = "custom";
                        }
                        if (t.classList && t.classList.contains("comp-input")) {
                            var id = t.getAttribute("data-drop"),
                                s = t.getAttribute("data-salt");
                            COMP_OVR[id] = COMP_OVR[id] || {};
                            COMP_OVR[id][s] = +t.value || 0;
                        }
                        // post-brew g/L edit -> update the in-cup dose (renderChem recomputes below)
                        if (t.classList && t.classList.contains("postbrew-input")) {
                            POST_BREW[t.getAttribute("data-drop")] =
                                +t.value || 0;
                        }
                        if (t.id === "chemSource") {
                            buildComp();
                        }
                        // editing a pour step writes straight to POUR (update()->renderPour no-ops mid-edit, so focus is kept)
                        if (t.classList && t.classList.contains("pour-step")) {
                            var si = +t.getAttribute("data-i");
                            POUR = POUR || [];
                            if (!POUR[si]) POUR[si] = { w: "", t: "" };
                            POUR[si].t = t.value;
                        }
                        if (t.classList && t.classList.contains("pour-g")) {
                            var pgi = +t.getAttribute("data-i");
                            POUR = POUR || [];
                            if (!POUR[pgi]) POUR[pgi] = { w: "", t: "" };
                            POUR[pgi].g = t.value;
                        }
                        if (t.classList && t.classList.contains("pour-sec")) {
                            var psi = +t.getAttribute("data-i");
                            POUR = POUR || [];
                            if (!POUR[psi]) POUR[psi] = { w: "", t: "" };
                            POUR[psi].sec = t.value;
                        }
                        if (t.classList && t.classList.contains("pour-temp")) {
                            var pmi = +t.getAttribute("data-i");
                            POUR = POUR || [];
                            if (!POUR[pmi]) POUR[pmi] = { w: "", t: "" };
                            POUR[pmi].temp = t.value;
                        }
                        if (t.classList && t.classList.contains("pour-agit")) {
                            var pri = +t.getAttribute("data-i");
                            POUR = POUR || [];
                            if (!POUR[pri]) POUR[pri] = { w: "", t: "" };
                            POUR[pri].agit = t.value;
                        }
                        // changing a step's water re-renders (updates the colour + chip)
                        if (t.classList && t.classList.contains("pour-water")) {
                            var wi = +t.getAttribute("data-i");
                            POUR = POUR || [];
                            if (!POUR[wi]) POUR[wi] = { w: "", t: "" };
                            POUR[wi].w = t.value;
                            renderPour(true);
                        }
                        update();
                    });
                    // pour-structure edit controls
                    var pourEditBtn = $("pourEdit");
                    if (pourEditBtn) pourEditBtn.onclick = pourToggleEdit;
                    var pourPanelEl = $("pourPanel");
                    if (pourPanelEl)
                        pourPanelEl.addEventListener("click", function (e) {
                            var del =
                                e.target.closest &&
                                e.target.closest(".pour-del");
                            if (del) {
                                if (POUR) {
                                    POUR.splice(+del.getAttribute("data-i"), 1);
                                    reflowPours();
                                }
                                renderPour(true);
                                return;
                            }
                            if (e.target.id === "pourAdd") {
                                POUR = POUR || [];
                                var w = pourIsSplit() ? "a" : "s",
                                    li = -1;
                                for (var i = POUR.length - 1; i >= 0; i--) {
                                    if ((POUR[i].w || w) === w) {
                                        li = i;
                                        break;
                                    }
                                } // last pour of this water
                                var nw = { w: w, t: "" };
                                if (li >= 0) {
                                    var g = +POUR[li].g || 0;
                                    if (g > 0) {
                                        var half = Math.round(g / 2);
                                        POUR[li].g = g - half;
                                        nw.g = half;
                                    }
                                    POUR.splice(li + 1, 0, nw);
                                } else POUR.push(nw);
                                renderPour(true);
                                var ins =
                                    pourPanelEl.querySelectorAll(".pour-step");
                                if (ins.length)
                                    ins[
                                        Math.min(li + 1, ins.length - 1)
                                    ].focus();
                                return;
                            }
                            if (e.target.id === "pourBalance") {
                                reflowPours();
                                renderPour(true);
                                return;
                            }
                            if (e.target.id === "pourReset") {
                                POUR = null;
                                POUR_EDIT = false;
                                renderPour(true);
                                return;
                            }
                        });
                    // tap a salt term -> toggle its explainer row; tap "data quality" -> toggle the detail row
                    document.addEventListener("click", function (e) {
                        if (!e.target || !e.target.closest) return;
                        // Single/Split tab switch -> refresh the save summary (press toggles .active first)
                        if (e.target.closest(".tab[data-tab]")) {
                            setTimeout(update, 0);
                        }
                        // the calibration header row is its toggle (ignore clicks on its hint)
                        var clh = e.target.closest(".calib-head");
                        if (clh) {
                            if (e.target.closest(".hint")) return;
                            var cw = document.querySelector(".calib-collapse");
                            if (cw) {
                                cw.hidden = !cw.hidden;
                                var car = clh.querySelector(".dq-arrow");
                                if (car)
                                    car.textContent = cw.hidden ? "▸" : "▾";
                            }
                            return;
                        }
                        // the composition-model header row is its toggle (ignore clicks on its Reset button / hint)
                        var ch = e.target.closest(".comp-head");
                        if (ch) {
                            if (
                                e.target.closest("#compReset") ||
                                e.target.closest(".hint")
                            )
                                return;
                            COMP_OPEN = !COMP_OPEN;
                            buildComp();
                            return;
                        }
                        // remove a post-brew drop
                        var pbd = e.target.closest(".postbrew-del");
                        if (pbd) {
                            delete POST_BREW[pbd.getAttribute("data-drop")];
                            renderPostBrew();
                            update();
                            return;
                        }
                        // +/- a post-brew drop
                        var pbs = e.target.closest(".postbrew-step");
                        if (pbs) {
                            stepPostBrewDrop(
                                pbs.getAttribute("data-drop"),
                                +pbs.getAttribute("data-step") || 0,
                            );
                            return;
                        }
                        var st = e.target.closest(".salt-term");
                        if (st) {
                            var s = st.getAttribute("data-salt"),
                                row = document.querySelector(
                                    '.salt-info[data-salt="' + s + '"]',
                                );
                            if (row) row.hidden = !row.hidden;
                            return;
                        }
                        var dq = e.target.closest(".dq-toggle");
                        if (dq) {
                            var det = document.querySelector(".dq-detail");
                            if (det) {
                                det.hidden = !det.hidden;
                                var ar = dq.querySelector(".dq-arrow");
                                if (ar)
                                    ar.innerHTML = det.hidden
                                        ? "&#9656;"
                                        : "&#9662;";
                            }
                        }
                    });
                    // add a post-brew drop from the picker (any brand / custom)
                    document.addEventListener("change", function (e) {
                        if (e.target && e.target.id === "postBrewPick") {
                            var id = e.target.value;
                            if (id && POST_BREW[id] == null) {
                                POST_BREW[id] = 0;
                                renderPostBrew();
                                update();
                            }
                        }
                    });
                    buildComp();
                    update();
                    initSW();
                    // /drops 301s to /water#drops — land on the Drops row (the custom-drop editor now lives in the concentrate panel)
                    if (location.hash === "#drops") {
                        var dr = $("drops");
                        if (dr)
                            setTimeout(function () {
                                dr.scrollIntoView({ block: "center" });
                            }, 50);
                    }
                    // let the logbook (separate IIFE) re-render recipe chips now kits/salts are loaded
                    try {
                        window.dispatchEvent(new Event("waterlab:ready"));
                    } catch (e) {}
                }
                function fetchCatalog(thenBoot) {
                    fetch("/api/catalog", { credentials: "same-origin" })
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (c) {
                            buildCatalog(c);
                            if (thenBoot) boot();
                        })
                        .catch(function (e) {
                            console.error("catalog load failed", e);
                            if (thenBoot) boot();
                        });
                }
                function init() {
                    // Fast path: /water inlines the catalog core (window.__CATALOG__: drops +
                    // salts + the user's custom drops/favorites) so we build the calculator
                    // synchronously on load — no fetch, no empty-then-fill shift. The inline omits
                    // the bulky gear lists (they only fill <select>s → no layout impact), so we
                    // then fetch the full catalog in the background to populate the gear pickers.
                    // buildCatalog is idempotent for the core, so the refetch just adds gear.
                    if (window.__CATALOG__) {
                        try {
                            buildCatalog(window.__CATALOG__);
                            boot();
                            if (!(window.__CATALOG__.brewers || []).length) fetchCatalog(false);
                            return;
                        } catch (e) {
                            console.error("inline catalog failed, fetching", e);
                        }
                    }
                    fetchCatalog(true);
                }

                // per-water concentrate masses (ppm units) keyed by drop id
                function massesFor(p, ppm) {
                    var r = readRatio(p),
                        s = 0,
                        out = {};
                    for (var k in r) s += r[k] || 0;
                    for (var k2 in r) out[k2] = s > 0 ? ppm * (r[k2] / s) : 0;
                    return out;
                }
                // collapse a water's masses to the legacy {T,J,L} calibration slots (Apax classic only)
                function toLetters(p, m) {
                    var o = { T: 0, J: 0, L: 0 };
                    if (KIT_OF[p] !== "apax") return o;
                    for (var id in m) {
                        var L = APAX_LETTER[id];
                        if (L) o[L] = m[id];
                    }
                    return o;
                }

                // Bridge for the logbook/calibration script: read/apply the water setup + calibration.
                window.WaterLab = {
                    setAuth: function (me) {
                        AUTH = me || null;
                        renderConc();
                    },
                    setCalib: function (c) {
                        CALIB = c && c.yields ? c : null;
                        update();
                    },
                    clearCalib: function () {
                        CALIB = null;
                        update();
                    },
                    isCalibrated: function () {
                        return !!CALIB;
                    },
                    // starting water (source water before concentrate) — null for default RO (keeps old recipes lean)
                    readStart: function () {
                        readSW();
                        return SW.type === "ro"
                            ? null
                            : {
                                  type: SW.type,
                                  gh: SW.gh,
                                  kh: SW.kh,
                                  hard: SW.hard,
                              };
                    },
                    applyStart: function (s) {
                        s = s || {}; // legacy recipes may carry s.noDrops — ignored now (an empty drop set IS "starting water only")
                        SW = {
                            type: s.type || "ro",
                            gh: +s.gh || 0,
                            kh: +s.kh || 0,
                            hard: s.hard || "ca",
                        };
                        var ty = $("swType");
                        if (ty) ty.value = SW.type;
                        if ($("swGH")) $("swGH").value = SW.gh || "";
                        if ($("swKH")) $("swKH").value = SW.kh || "";
                        if ($("swHard")) $("swHard").value = SW.hard;
                        if ($("swCustomRow"))
                            $("swCustomRow").style.display =
                                SW.type === "custom" ? "" : "none";
                        update();
                    },
                    // custom pour [{w,t,g,sec,temp,agit}] or null = auto (accepts legacy string[]/{w,t} too)
                    readPour: function () {
                        return POUR && POUR.length
                            ? POUR.map(function (s) {
                                  return {
                                      w: s.w,
                                      t: s.t,
                                      g: s.g,
                                      sec: s.sec,
                                      temp: s.temp,
                                      agit: s.agit,
                                  };
                              })
                            : null;
                    },
                    applyPour: function (p) {
                        if (!p || !p.length) {
                            POUR = null;
                        } else {
                            POUR = p
                                .map(function (s) {
                                    return typeof s === "string"
                                        ? { w: "", t: s }
                                        : {
                                              w: s.w || "",
                                              t: s.t || "",
                                              g: s.g,
                                              sec: s.sec,
                                              temp: s.temp,
                                              agit: s.agit,
                                          };
                                })
                                .filter(function (s) {
                                    return (
                                        (s.t && s.t.trim()) ||
                                        s.g ||
                                        s.sec ||
                                        s.temp ||
                                        s.agit
                                    );
                                });
                            if (!POUR.length) POUR = null;
                        }
                        POUR_EDIT = false;
                        renderPour(true);
                    },
                    // post-brew drops (dropId -> g/L of cup); null when nothing dosed (keeps old recipes lean)
                    readPostBrew: function () {
                        var out = {},
                            any = false;
                        for (var k in POST_BREW) {
                            var v = +POST_BREW[k] || 0;
                            if (v > 0) {
                                out[k] = v;
                                any = true;
                            }
                        }
                        return any ? out : null;
                    },
                    applyPostBrew: function (pb) {
                        POST_BREW = {};
                        if (pb && typeof pb === "object") {
                            for (var k in pb) POST_BREW[k] = +pb[k] || 0;
                        }
                        POSTBREW_SIG = null; // force the rows to rebuild for the loaded set
                        renderPostBrew();
                        update();
                    },
                    // how many waters are active (1-3); A='s', B='a', C='b'
                    getWaters: function () {
                        return WATERS;
                    },
                    setWaters: function (n) {
                        WATERS = Math.max(1, Math.min(3, +n || 1));
                        syncWaters();
                    },
                    // brew gear — saved with the recipe (temp/agitation/bloom are per-pour now). Direct DOM (calc IIFE has no setVal/val).
                    readBrew: function () {
                        var gv = function (id) {
                                return ($(id) || {}).value || "";
                            },
                            gn = function (id) {
                                return +($(id) || {}).value || 0;
                            };
                        var o = {
                            brewer: gv("bmBrewer"),
                            filter: gv("bmFilter"),
                            grinder: gv("bmGrinder"),
                            grind: gv("bmGrind"),
                            dose_g: gn("bmDose"),
                            ratio: gn("bmRatio"),
                        };
                        var any = false,
                            k;
                        for (k in o) {
                            if (o[k]) any = true;
                        }
                        return any ? o : null;
                    },
                    applyBrew: function (b) {
                        b = b || {};
                        var sv = function (id, x) {
                            var e = $(id);
                            if (e) e.value = x != null ? x : "";
                        };
                        sv("bmBrewer", b.brewer);
                        sv("bmFilter", b.filter);
                        sv("bmGrinder", b.grinder);
                        sv("bmGrind", b.grind);
                        sv("bmDose", b.dose_g);
                        sv("bmRatio", b.ratio);
                        gearNote();
                        renderBrew();
                    },
                    // snapshot of each water's drop-keyed ratios (for saving a recipe)
                    readWaters: function () {
                        var o = {
                            preset: {
                                s: presetLabel("s"),
                                a: presetLabel("a"),
                                b: presetLabel("b"),
                            },
                        };
                        ["s", "a", "b"].forEach(function (p) {
                            o[p] = readRatio(p);
                        });
                        return o;
                    },
                    // glanceable chip row for a stored recipe ({mode,target_gl,drops_per_g,ratios}) —
                    // same markup as the live Save summary so saved recipes match.
                    recipeChips: function (rec) {
                        var r;
                        try {
                            r =
                                typeof rec.ratios === "string"
                                    ? JSON.parse(rec.ratios)
                                    : rec.ratios || {};
                        } catch (e) {
                            r = {};
                        }
                        if (!r.vol)
                            r.vol = {
                                s: r.volume || 500,
                                a: Math.round((r.volume || 500) * 0.6),
                                b: Math.round((r.volume || 500) * 0.4),
                            };
                        if (!r.tgt) {
                            var t = rec.target_gl || 3.5;
                            r.tgt = { s: t, a: t, b: t };
                        }
                        if (!r.dpg) {
                            var d = rec.drops_per_g || 20;
                            r.dpg = { s: d, a: d, b: d };
                        }
                        try {
                            return statChipsHtml(
                                setupStats(rec.mode || "single", r),
                            );
                        } catch (e) {
                            return "";
                        }
                    },
                    // restore each water's concentrate from the recipe's drop-keyed ratios: the drop SET
                    // is the keys with a positive dose (any brand + custom), then write each g/L.
                    applyWaters: function (w) {
                        w = w || {};
                        ["s", "a", "b"].forEach(function (p) {
                            if (!w[p]) return; // leave untouched waters as-is
                            var rr = w[p] || {};
                            DSET[p] = Object.keys(rr).filter(function (id) {
                                return DROP[id] && (+rr[id] || 0) > 0;
                            });
                            buildWater(p);
                            var sel = $(p + "_preset");
                            if (sel) sel.value = "custom";
                            DSET[p].forEach(function (id) {
                                var el = $(p + "_" + id);
                                if (el) el.value = rr[id] != null ? rr[id] : 0;
                            });
                        });
                        buildComp();
                        update();
                    },
                    context: function () {
                        var src = $("chemSource")
                            ? $("chemSource").value
                            : "single";
                        var glOf = function (p) {
                            return +$(p + "_target").value || 0;
                        };
                        var masses, gl, ppm, kit;
                        if (src === "cup") {
                            var av = +$("a_vol").value || 0,
                                bv = +$("b_vol").value || 0,
                                tv = av + bv || 1;
                            var pa = Math.round(glOf("a") * 30),
                                pb = Math.round(glOf("b") * 30);
                            var la = toLetters("a", massesFor("a", pa)),
                                lb = toLetters("b", massesFor("b", pb));
                            masses = {
                                T: (av * la.T + bv * lb.T) / tv,
                                J: (av * la.J + bv * lb.J) / tv,
                                L: (av * la.L + bv * lb.L) / tv,
                            };
                            gl = (av * glOf("a") + bv * glOf("b")) / tv;
                            ppm = Math.round((av * pa + bv * pb) / tv);
                            kit =
                                KIT_OF.a === "apax" && KIT_OF.b === "apax"
                                    ? "apax"
                                    : "mixed";
                        } else {
                            var p = src === "a" ? "a" : src === "b" ? "b" : "s";
                            gl = glOf(p);
                            ppm = Math.round(gl * 30);
                            masses = toLetters(p, massesFor(p, ppm));
                            kit = KIT_OF[p];
                        }
                        return {
                            source: src,
                            gl: gl,
                            ppm: ppm,
                            masses: masses,
                            kit: kit,
                            gh: +($("chGH") ? $("chGH").textContent : 0) || 0,
                            kh: +($("chKH") ? $("chKH").textContent : 0) || 0,
                            tds:
                                +($("chTDS") ? $("chTDS").textContent : 0) || 0,
                        };
                    },
                };
                if (document.readyState === "loading")
                    document.addEventListener("DOMContentLoaded", init);
                else init();
            })();
