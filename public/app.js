// App shell JS — auth, shared helpers, htmx glue, and the logbook/account/water
// page logic. Extracted verbatim from index.html (de-SPA stage 1: externalize).
            (function () {
                var $ = function (id) {
                    return document.getElementById(id);
                };
                var ME = null,
                    RECIPES = {},
                    BEANS = {};
                // Recipe chips are now computed server-side (the partial renders
                // kit/GH/KH from the DB catalog), so the lists no longer need to wait
                // for the calculator's waterlab:ready to re-render.
                function api(path, opts) {
                    opts = opts || {};
                    opts.credentials = "same-origin";
                    opts.headers = Object.assign(
                        { "Content-Type": "application/json" },
                        opts.headers || {},
                    );
                    return fetch(path, opts).then(function (r) {
                        return r.json().catch(function () {
                            return {};
                        });
                    });
                }
                function val(id) {
                    var e = $(id);
                    return e ? e.value : "";
                }
                function num(id) {
                    return +val(id) || 0;
                }
                function setVal(id, v) {
                    var e = $(id);
                    if (e && v != null) e.value = v;
                }
                function txt(id) {
                    var e = $(id);
                    return e ? e.textContent : "";
                }
                function esc(s) {
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

                // ---------- photos (Phase 5) ----------
                var PENDING = {};
                function photoURL(key) {
                    return "/api/photo/" + key;
                }
                function thumb(key, sz) {
                    return key
                        ? '<img src="' +
                              photoURL(key) +
                              '" style="height:' +
                              (sz || 34) +
                              "px;width:" +
                              (sz || 34) +
                              'px;object-fit:cover;border:var(--border) solid var(--rule);border-radius:2px;margin-right:6px;vertical-align:middle">'
                        : "";
                }
                // Decode respecting EXIF orientation (iPhone photos are often rotated) so the label
                // isn't fed sideways to the scanner.
                function loadImg(file) {
                    return new Promise(function (res, rej) {
                        var img = new Image(),
                            u = URL.createObjectURL(file);
                        img.onload = function () {
                            res({
                                src: img,
                                w: img.width,
                                h: img.height,
                                url: u,
                            });
                        };
                        img.onerror = function () {
                            URL.revokeObjectURL(u);
                            rej(new Error("bad image"));
                        };
                        img.src = u;
                    });
                }
                function loadDrawable(file) {
                    if (window.createImageBitmap) {
                        try {
                            return createImageBitmap(file, {
                                imageOrientation: "from-image",
                            })
                                .then(function (b) {
                                    return { src: b, w: b.width, h: b.height };
                                })
                                .catch(function () {
                                    return loadImg(file);
                                });
                        } catch (e) {}
                    }
                    return loadImg(file);
                }
                function scaleCanvas(d, maxDim) {
                    var s = Math.min(1, maxDim / Math.max(d.w, d.h));
                    var cw = Math.max(1, Math.round(d.w * s)),
                        ch = Math.max(1, Math.round(d.h * s));
                    var cv = document.createElement("canvas");
                    cv.width = cw;
                    cv.height = ch;
                    cv.getContext("2d").drawImage(d.src, 0, 0, cw, ch);
                    if (d.url) URL.revokeObjectURL(d.url);
                    return cv;
                }
                function downscale(file, maxDim) {
                    return loadDrawable(file).then(function (d) {
                        var cv = scaleCanvas(d, maxDim);
                        return new Promise(function (res) {
                            cv.toBlob(
                                function (blob) {
                                    var fr = new FileReader();
                                    fr.onload = function () {
                                        res({ blob: blob, dataURL: fr.result });
                                    };
                                    fr.readAsDataURL(blob);
                                },
                                "image/jpeg",
                                0.85,
                            );
                        });
                    });
                }
                function uploadBlob(blob) {
                    return fetch("/api/upload", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "image/jpeg" },
                        body: blob,
                    }).then(function (r) {
                        return r.json();
                    });
                }
                function swatch(color, sz) {
                    sz = sz || 34;
                    return color
                        ? '<i style="display:inline-block;width:' +
                              sz +
                              "px;height:" +
                              sz +
                              "px;border-radius:2px;background:" +
                              color +
                              ';border:var(--border) solid var(--rule);margin-right:6px;vertical-align:middle"></i>'
                        : "";
                }
                // Pull a representative accent color from an image (biased toward saturated/brand pixels).
                function pickColor(src) {
                    var w = 24,
                        h = 24,
                        c = document.createElement("canvas");
                    c.width = w;
                    c.height = h;
                    var x = c.getContext("2d");
                    x.drawImage(src, 0, 0, w, h);
                    var d;
                    try {
                        d = x.getImageData(0, 0, w, h).data;
                    } catch (e) {
                        return null;
                    }
                    var sr = 0,
                        sg = 0,
                        sb = 0,
                        sw = 0,
                        ar = 0,
                        ag = 0,
                        ab = 0,
                        n = 0;
                    for (var i = 0; i < d.length; i += 4) {
                        var r = d[i],
                            g = d[i + 1],
                            b = d[i + 2],
                            a = d[i + 3];
                        if (a < 128) continue;
                        var mx = Math.max(r, g, b),
                            mn = Math.min(r, g, b),
                            sat = mx ? (mx - mn) / mx : 0;
                        ar += r;
                        ag += g;
                        ab += b;
                        n++;
                        var wt = sat * sat * (mx / 255);
                        sr += r * wt;
                        sg += g * wt;
                        sb += b * wt;
                        sw += wt;
                    }
                    if (!n) return null;
                    var R, G, B;
                    if (sw > 0.4) {
                        R = sr / sw;
                        G = sg / sw;
                        B = sb / sw;
                    } else {
                        R = ar / n;
                        G = ag / n;
                        B = ab / n;
                    }
                    return (
                        "#" +
                        [R, G, B]
                            .map(function (v) {
                                var s = Math.round(v).toString(16);
                                return s.length < 2 ? "0" + s : s;
                            })
                            .join("")
                    );
                }
                // Load image once -> { dataURL (for vision), color (no upload/storage) }.
                function analyzeImage(file) {
                    return loadDrawable(file).then(function (d) {
                        var cv = scaleCanvas(d, 1280);
                        return {
                            dataURL: cv.toDataURL("image/jpeg", 0.85),
                            color: pickColor(cv),
                        };
                    });
                }

                // ---------- auth ----------
                function renderAuth() {
                    var el = $("authArea");
                    if (!el) return;
                    if (ME) {
                        el.innerHTML =
                            '<a class="button sm secondary" id="btnAccount" href="/account" data-section="account" title="' +
                            esc(ME.email) +
                            '" style="max-width:15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                            esc(ME.display_name || ME.email) +
                            "</a>";
                    } else {
                        el.innerHTML =
                            '<button class="button sm" id="btnLogin" type="button">Sign in</button>';
                        $("btnLogin").onclick = function () {
                            showSignin();
                        };
                    }
                    if ($("feedIntro"))
                        $("feedIntro").style.display = ME ? "none" : "";
                    if ($("logGate"))
                        $("logGate").style.display = ME ? "none" : "";
                    if ($("logBody"))
                        $("logBody").style.display = ME ? "" : "none";
                    if ($("calibSignedOut"))
                        $("calibSignedOut").style.display = ME ? "none" : "";
                    if ($("calibBody"))
                        $("calibBody").style.display = ME ? "" : "none";
                    if ($("calibBody2"))
                        $("calibBody2").style.display = ME ? "" : "none";
                    if ($("coachSignedOut"))
                        $("coachSignedOut").style.display = ME ? "none" : "";
                    if ($("coachBody"))
                        $("coachBody").style.display = ME ? "" : "none";
                }
                function showSignin(msg) {
                    var m = document.querySelector("main");
                    if (m) m.style.display = "none";
                    var v = $("signinView");
                    if (v) v.style.display = "";
                    if ($("signinMsg")) $("signinMsg").innerHTML = msg || "";
                    var e = $("signinEmail");
                    if (e) e.focus();
                    window.scrollTo(0, 0);
                }
                function hideSignin() {
                    var v = $("signinView");
                    if (v) v.style.display = "none";
                    var m = document.querySelector("main");
                    if (m) m.style.display = "";
                }
                function bindSignin() {
                    var f = $("signinForm");
                    if (!f) return;
                    f.addEventListener("submit", function (e) {
                        e.preventDefault();
                        var email = val("signinEmail").trim();
                        if (!email) return;
                        var btn = $("signinSend"),
                            label = btn.textContent;
                        btn.disabled = true;
                        btn.textContent = "Sending…";
                        if ($("signinMsg")) $("signinMsg").innerHTML = "";
                        api("/auth/login", {
                            method: "POST",
                            body: JSON.stringify({ email: email }),
                        }).then(function (d) {
                            btn.disabled = false;
                            btn.textContent = label;
                            if (d.error) {
                                $("signinMsg").innerHTML =
                                    '<div class="signal" style="border-color:var(--negative);color:var(--negative)">' +
                                    esc(d.error) +
                                    "</div>";
                                return;
                            }
                            if (d.dev && d.link) {
                                $("signinMsg").innerHTML =
                                    '<div class="signal info">Dev mode — <a href="' +
                                    d.link +
                                    '">open your sign-in link</a>.</div>';
                                return;
                            }
                            $("signinMsg").innerHTML =
                                '<div class="signal positive">Check your email — a sign-in link is on its way to <b>' +
                                esc(email) +
                                '</b>. It expires in 15 minutes. <span class="data">Don\'t see it? Check your spam/junk folder (we\'re a new domain) and mark it "not spam".</span></div>';
                        });
                    });
                    if ($("signinBack")) $("signinBack").onclick = hideSignin;
                }

                // ---------- first-run display-name gate (hard: no skip) ----------
                function showWelcome() {
                    var v = $("welcomeView");
                    if (!v) return;
                    var m = document.querySelector("main");
                    if (m) m.style.display = "none";
                    hideSignin();
                    var inp = $("welcomeName");
                    if (inp && !inp.value && ME && ME.email) {
                        inp.value = String(ME.email).split("@")[0];
                    } // sensible default
                    v.style.display = "";
                    window.scrollTo(0, 0);
                    if (inp) {
                        inp.focus();
                        inp.select();
                    }
                }
                function hideWelcome() {
                    var v = $("welcomeView");
                    if (v) v.style.display = "none";
                    var m = document.querySelector("main");
                    if (m) m.style.display = "";
                }
                function bindWelcome() {
                    var f = $("welcomeForm");
                    if (!f) return;
                    f.addEventListener("submit", function (e) {
                        e.preventDefault();
                        var name = val("welcomeName").trim(),
                            msg = $("welcomeMsg");
                        if (!name) {
                            if (msg)
                                msg.innerHTML =
                                    '<div class="signal" style="border-color:var(--warn);color:var(--warn)">Please enter a display name to continue.</div>';
                            var i = $("welcomeName");
                            if (i) i.focus();
                            return;
                        }
                        var btn = $("welcomeSave"),
                            label = btn.textContent;
                        btn.disabled = true;
                        btn.textContent = "Saving…";
                        if (msg) msg.innerHTML = "";
                        api("/api/account", {
                            method: "PUT",
                            body: JSON.stringify({ display_name: name }),
                        })
                            .then(function (d) {
                                btn.disabled = false;
                                btn.textContent = label;
                                if (!d || d.error) {
                                    if (msg)
                                        msg.innerHTML =
                                            '<div class="signal" style="border-color:var(--negative);color:var(--negative)">' +
                                            esc(
                                                (d && d.error) ||
                                                    "Could not save — try again.",
                                            ) +
                                            "</div>";
                                    return;
                                }
                                if (ME) {
                                    ME.display_name = d.display_name || name;
                                }
                                renderAuth();
                                hideWelcome();
                            })
                            .catch(function () {
                                btn.disabled = false;
                                btn.textContent = label;
                                if (msg)
                                    msg.innerHTML =
                                        '<div class="signal" style="border-color:var(--negative);color:var(--negative)">Network error — try again.</div>';
                            });
                    });
                }

                // (account profile is filled by loadAccount() on the /account page boot)
                function bindAccount() {
                    if ($("acctBack"))
                        $("acctBack").onclick = function () {
                            if (history.length > 1) history.back();
                            else location.href = "/";
                        };
                    if ($("acctLogout"))
                        $("acctLogout").onclick = function () {
                            api("/auth/logout", { method: "POST" }).then(
                                function () {
                                    location.href = "/";
                                },
                            );
                        };
                    // Account rename is now an hx-put on #acctSave; on success, sync the
                    // nav display name (ME) from the response + flash "Saved ✓".
                    if ($("acctSave"))
                        $("acctSave").addEventListener("htmx:afterRequest", function (e) {
                            if (!e.detail || !e.detail.successful) return;
                            var d = {};
                            try {
                                d = JSON.parse(e.detail.xhr.responseText);
                            } catch (err) {}
                            if (ME && d && !d.error) {
                                ME.display_name = d.display_name;
                                renderAuth();
                            }
                            var b = $("acctSave");
                            b.textContent = "Saved ✓";
                            setTimeout(function () {
                                b.textContent = "Save";
                            }, 1200);
                        });
                    if ($("acctDelete"))
                        $("acctDelete").onclick = function () {
                            if (
                                !confirm(
                                    "Delete your account and ALL your data? This cannot be undone.",
                                )
                            )
                                return;
                            if (
                                !confirm(
                                    "Really delete everything? Last chance.",
                                )
                            )
                                return;
                            api("/api/account", { method: "DELETE" }).then(
                                function () {
                                    alert("Your account has been deleted.");
                                    location.href = "/";
                                },
                            );
                        };
                }

                // ---------- calculator <-> recipe bridge ----------
                function activeMode() {
                    return window.WaterLab &&
                        window.WaterLab.getWaters &&
                        window.WaterLab.getWaters() > 1
                        ? "split"
                        : "single";
                }
                function readSetup() {
                    var w =
                        window.WaterLab && window.WaterLab.readWaters
                            ? window.WaterLab.readWaters()
                            : { kits: {}, s: {}, a: {}, b: {} };
                    return {
                        mode: activeMode(),
                        target_gl: num("s_target"),
                        drops_per_g: num("s_dpg"),
                        ratios: JSON.stringify({
                            vol: {
                                s: num("s_vol"),
                                a: num("a_vol"),
                                b: num("b_vol"),
                            },
                            tgt: {
                                s: num("s_target"),
                                a: num("a_target"),
                                b: num("b_target"),
                            },
                            dpg: {
                                s: num("s_dpg"),
                                a: num("a_dpg"),
                                b: num("b_dpg"),
                            },
                            kits: w.kits,
                            preset: w.preset,
                            s: w.s,
                            a: w.a,
                            b: w.b,
                            pour:
                                window.WaterLab && window.WaterLab.readPour
                                    ? window.WaterLab.readPour()
                                    : null,
                            postBrew:
                                window.WaterLab && window.WaterLab.readPostBrew
                                    ? window.WaterLab.readPostBrew()
                                    : null,
                            brew:
                                window.WaterLab && window.WaterLab.readBrew
                                    ? window.WaterLab.readBrew()
                                    : null,
                            start:
                                window.WaterLab && window.WaterLab.readStart
                                    ? window.WaterLab.readStart()
                                    : null,
                            tempS: num("s_temp"),
                            tempA: num("a_temp"),
                            tempB: num("b_temp"),
                            waters:
                                window.WaterLab && window.WaterLab.getWaters
                                    ? window.WaterLab.getWaters()
                                    : 1,
                        }),
                    };
                }
                function applySetup(rec) {
                    var r;
                    try {
                        r = JSON.parse(rec.ratios);
                    } catch (e) {
                        return;
                    }
                    // back-compat: old two-water recipes stored data in a,b (no waters field). The new
                    // model has Water A='s', so shift the slots up (a->s, b->a) for those recipes.
                    if (rec.mode === "split" && r.waters == null) {
                        ["vol", "tgt", "dpg", "kits", "preset"].forEach(
                            function (o) {
                                if (r[o]) {
                                    r[o].s = r[o].a;
                                    r[o].a = r[o].b;
                                    delete r[o].b;
                                }
                            },
                        );
                        r.s = r.a;
                        r.a = r.b;
                        delete r.b;
                        r.tempS = r.tempA;
                        r.tempA = r.tempB;
                        delete r.tempB;
                        r.waters = 2;
                    }
                    var dd = rec.drops_per_g || 20,
                        dp = r.dpg || {};
                    setVal("s_dpg", dp.s != null ? dp.s : dd);
                    setVal("a_dpg", dp.a != null ? dp.a : dd);
                    setVal("b_dpg", dp.b != null ? dp.b : dd);
                    if (r.vol) {
                        setVal("s_vol", r.vol.s);
                        setVal("a_vol", r.vol.a);
                        setVal("b_vol", r.vol.b);
                    } else {
                        var v = r.volume || 500,
                            pA = r.pctA != null ? r.pctA : 60; // back-compat: old single volume split by old pctA
                        setVal("s_vol", v);
                        setVal("a_vol", Math.round((v * pA) / 100));
                        setVal("b_vol", Math.round((v * (100 - pA)) / 100));
                    }
                    if (r.tgt) {
                        setVal("s_target", r.tgt.s);
                        setVal("a_target", r.tgt.a);
                        setVal("b_target", r.tgt.b);
                    } else {
                        var t = rec.target_gl || 3.5;
                        setVal("s_target", t);
                        setVal("a_target", t);
                        setVal("b_target", t);
                    }
                    if (r.tempS != null) setVal("s_temp", r.tempS);
                    if (r.tempA != null) setVal("a_temp", r.tempA);
                    if (r.tempB != null) setVal("b_temp", r.tempB);
                    if (window.WaterLab && window.WaterLab.applyPour) {
                        window.WaterLab.applyPour(r.pour);
                    }
                    if (window.WaterLab && window.WaterLab.applyBrew) {
                        window.WaterLab.applyBrew(r.brew);
                    }
                    if (window.WaterLab && window.WaterLab.applyStart) {
                        window.WaterLab.applyStart(r.start);
                    }
                    if (window.WaterLab && window.WaterLab.applyPostBrew) {
                        window.WaterLab.applyPostBrew(r.postBrew);
                    }
                    // kit + drop-keyed ratios (back-compat: old {T,J,L} recipes map onto the Apax kit)
                    if (window.WaterLab && window.WaterLab.applyWaters) {
                        window.WaterLab.applyWaters({
                            kits: r.kits,
                            s: r.s,
                            a: r.a,
                            b: r.b,
                        });
                    }
                    // restore how many waters are active (new recipes carry r.waters; old derive from mode)
                    if (window.WaterLab && window.WaterLab.setWaters)
                        window.WaterLab.setWaters(
                            r.waters || (rec.mode === "split" ? 2 : 1),
                        );
                    var ev = new Event("input", { bubbles: true });
                    ($("s_target") || $("s_dpg")).dispatchEvent(ev);
                }

                // ---------- recipes ----------
                // The three recipe lists are server-rendered via htmx (#favList /
                // #recList / #poolList → /partials/recipes*). The render*/recRow/
                // cappedBody/SHOW_ALL_* code is gone (chips are computed server-side,
                // so the old waterlab:ready re-render is no longer needed either).
                // loadRecipes still fetches once to feed the RECIPES cache (Load/Open
                // read it) + the brew-form recipe <select>.
                function refreshRecipeLists() {
                    loadRecipes();
                    loadFav();
                    loadPool();
                }
                function hxRefresh(id) {
                    var el = $(id);
                    if (el && window.htmx) window.htmx.trigger(el, "refresh");
                }
                function loadRecipes() {
                    hxRefresh("recList");
                    api("/api/recipes").then(function (rows) {
                        RECIPES = {};
                        (rows || []).forEach(function (x) {
                            RECIPES[x.id] = x;
                        });
                        fillRecipeSelect(rows || []);
                    });
                }
                function loadFav() {
                    hxRefresh("favList");
                }
                function loadPool() {
                    hxRefresh("poolList");
                }
                function fillRecipeSelect(rows) {
                    var sel = $("brRecipe");
                    if (!sel) return;
                    sel.innerHTML =
                        '<option value="">— current setup —</option>' +
                        rows
                            .map(function (x) {
                                return (
                                    '<option value="' +
                                    x.id +
                                    '">' +
                                    esc(x.name) +
                                    "</option>"
                                );
                            })
                            .join("");
                }

                // ---------- beans ----------
                // The bean list is server-rendered via htmx (#bnListBody
                // hx-get="/partials/beans"). loadBeans() fires that refresh and still
                // fetches once to feed the BEANS cache + the brew-form bean <select>.
                function loadBeans() {
                    var el = $("bnListBody");
                    if (el && window.htmx) window.htmx.trigger(el, "refresh");
                    api("/api/beans").then(function (rows) {
                        BEANS = {};
                        (rows || []).forEach(function (x) {
                            BEANS[x.id] = x;
                        });
                        fillBeanSelect(rows || []);
                    });
                }
                function fillBeanSelect(rows) {
                    var sel = $("brBean");
                    if (!sel) return;
                    sel.innerHTML =
                        '<option value="">— no bean —</option>' +
                        rows
                            .map(function (x) {
                                return (
                                    '<option value="' +
                                    x.id +
                                    '">' +
                                    esc(x.name) +
                                    "</option>"
                                );
                            })
                            .join("");
                }

                // ---------- bean → water + brew suggestion ----------
                var CUR_SUGGEST = null;
                function suggestFor(bean) {
                    // generated once, at save: reuse the stored suggestion instead of re-calling the AI
                    if (bean.suggestion) {
                        try {
                            renderSuggestion(bean, JSON.parse(bean.suggestion));
                            return;
                        } catch (e) {}
                    }
                    var el = $("beanSuggest");
                    if (el)
                        el.innerHTML =
                            '<div class="signal info">Thinking up a water for ' +
                            esc(bean.name || "this bean") +
                            "…</div>";
                    api("/api/suggest", {
                        method: "POST",
                        body: JSON.stringify(bean),
                    })
                        .then(function (d) {
                            renderSuggestion(bean, d);
                            api("/api/beans/" + bean.id, {
                                method: "PUT",
                                body: JSON.stringify({
                                    suggestion: JSON.stringify(d),
                                }),
                            }).then(function (u) {
                                if (u && u.id) BEANS[u.id] = u;
                            }); // persist so it's generated only once
                        })
                        .catch(function () {
                            if (el) el.innerHTML = "";
                        });
                }
                function renderSuggestion(bean, d) {
                    var el = $("beanSuggest");
                    if (!el) return;
                    if (!d || !d.suggestion) {
                        el.innerHTML = "";
                        return;
                    }
                    var daysOff = null; // recompute fresh (the stored suggestion's day count would be stale)
                    if (bean.roast_date) {
                        var t = Date.parse(bean.roast_date + "T00:00:00Z");
                        if (!isNaN(t))
                            daysOff = Math.floor((Date.now() - t) / 86400000);
                    }
                    var s = d.suggestion,
                        r = s.ratio || {},
                        br = s.brew || {};
                    CUR_SUGGEST = {
                        ratio: r,
                        target_gl: s.target_gl,
                        brew: br,
                        bean: bean,
                    };
                    var dots = [
                        ["TONIK", "--cad-yellow", r.T],
                        ["JAMM", "--cad-red", r.J],
                        ["LYLAC", "--cad-violet", r.L],
                    ]
                        .map(function (p) {
                            return (
                                '<span style="margin-right:14px"><i class="cdot" style="--c:var(' +
                                p[1] +
                                ')"></i>' +
                                p[0] +
                                ' <b class="numeric">' +
                                (+p[2] || 0) +
                                "</b></span>"
                            );
                        })
                        .join("");
                    var brewBits = [
                        br.ratio,
                        br.grind,
                        br.temp_c ? br.temp_c + "°C" : "",
                        br.time,
                    ]
                        .filter(Boolean)
                        .map(function (x) {
                            return (
                                '<span class="numeric">' + esc(x) + "</span>"
                            );
                        })
                        .join(" · ");
                    el.innerHTML =
                        '<div class="panel" style="background:var(--bg-soft)">' +
                        '<div class="cluster" style="justify-content:space-between;align-items:baseline"><b>Suggested water</b>' +
                        '<span class="data">' +
                        esc(bean.name || "bean") +
                        (daysOff != null
                            ? " · " + daysOff + "d off roast"
                            : "") +
                        (d.source === "ai" ? "" : " · default") +
                        "</span></div>" +
                        '<div style="margin-top:var(--space-2)"><span class="data">' +
                        s.target_gl +
                        ' g/L target</span><div style="margin-top:4px">' +
                        dots +
                        "</div></div>" +
                        '<div class="cluster gap" style="margin-top:var(--space-2);flex-wrap:wrap"><span class="data">brew</span>' +
                        brewBits +
                        "</div>" +
                        (s.rationale
                            ? '<p class="help" style="margin-top:var(--space-2)">' +
                              esc(s.rationale) +
                              "</p>"
                            : "") +
                        '<div class="cluster gap" style="margin-top:var(--space-3)"><button class="button sm" id="suggestApply" type="button">Apply water → calculator</button>' +
                        '<button class="button sm secondary" id="suggestClose" type="button">Dismiss</button></div></div>';
                    $("suggestApply").onclick = applySuggestion;
                    $("suggestClose").onclick = function () {
                        el.innerHTML = "";
                        CUR_SUGGEST = null;
                    };
                }
                // The suggestion panel is on /logbook; the calculator is on /water. Stash the
                // suggested setup and navigate — /water's applyWaterFromUrl() applies it on boot.
                function applySuggestion() {
                    if (!CUR_SUGGEST) return;
                    var r = CUR_SUGGEST.ratio || {};
                    var brew = CUR_SUGGEST.brew || {};
                    var pending = {
                        ratios: JSON.stringify({
                            s: { T: +r.T || 0, J: +r.J || 0, L: +r.L || 0 },
                        }),
                        target_gl: CUR_SUGGEST.target_gl || 3.5,
                        drops_per_g: num("s_dpg") || 20,
                        _brew: {
                            bean_id:
                                (CUR_SUGGEST.bean && CUR_SUGGEST.bean.id) || "",
                            grind: brew.grind || "",
                            time: brew.time || "",
                        },
                    };
                    try {
                        localStorage.setItem(
                            "wl_pending_suggest",
                            JSON.stringify(pending),
                        );
                    } catch (e) {}
                    location.href = "/water";
                }

                // ---------- brews ----------
                // The brew list is server-rendered via htmx (#brList hx-get="/partials/brews").
                // loadBrews() triggers that refresh and still fetches once for the insights
                // panel (not yet migrated). Called from refreshAll() + after log/delete.
                function loadBrews() {
                    var el = $("brList");
                    if (el && window.htmx) window.htmx.trigger(el, "refresh");
                    api("/api/brews").then(function (rows) {
                        renderInsights(rows || []);
                    });
                }

                function row(title, sub, actions) {
                    return (
                        "<tr><th>" +
                        title +
                        '</th><td class="data">' +
                        sub +
                        "</td>" +
                        '<td><span class="cluster" style="justify-content:flex-end;gap:var(--space-2)">' +
                        (actions || "") +
                        "</span></td></tr>"
                    );
                }
                function ledger(rowsHtml, title, cols) {
                    return (
                        '<table class="ledger">' +
                        (title
                            ? '<thead><tr><th colspan="' +
                              (cols || 3) +
                              '" class="left">' +
                              title +
                              "</th></tr></thead>"
                            : "") +
                        "<tbody>" +
                        rowsHtml +
                        "</tbody></table>"
                    );
                }

                // Save the current setup as a NEW recipe; it then becomes the loaded recipe (clean).
                function recipeSaveNew() {
                    var name = val("recName").trim();
                    if (!name) {
                        alert("Name the recipe first.");
                        return;
                    }
                    var body = readSetup();
                    body.name = name;
                    api("/api/recipes", {
                        method: "POST",
                        body: JSON.stringify(body),
                    }).then(function (r) {
                        if (r && r.id) {
                            RECIPES[r.id] = r;
                            setWaterUrl({ recipe: r.id }, "replace");
                            LOADED = {
                                id: r.id,
                                name: name,
                                owned: true,
                                sig: setupSig(),
                            };
                            renderSetupHeader();
                        }
                        loadRecipes();
                    });
                }
                // Save edits back onto the loaded (owned) recipe.
                function recipeUpdate() {
                    if (!LOADED || !LOADED.owned) return;
                    var name = val("recName").trim() || LOADED.name;
                    var body = readSetup();
                    body.name = name;
                    api("/api/recipes/" + LOADED.id, {
                        method: "PUT",
                        body: JSON.stringify(body),
                    }).then(function (r) {
                        if (r && r.id) RECIPES[r.id] = r;
                        LOADED.name = name;
                        LOADED.sig = setupSig();
                        renderSetupHeader();
                        loadRecipes();
                    });
                }

                // ---------- delegated actions ----------
                function bind() {
                    // poolRefresh is rendered inside the pool ledger title (loadPool rebinds it).
                    function showManual() {
                        var rs = document.querySelectorAll(
                            "#bnAddBody .bn-manual",
                        );
                        for (var i = 0; i < rs.length; i++)
                            rs[i].hidden = false;
                    }
                    if ($("bnManual"))
                        $("bnManual").onclick = function (e) {
                            e.preventDefault();
                            showManual();
                            var n = $("bnName");
                            if (n) n.focus();
                        };
                    // Add bean is now an hx-post on #bnAdd (flat fields via hx-vals;
                    // the server replies HX-Redirect → /bean/:id). This guard enforces
                    // the name (reveal the manual fields + focus) before the request.
                    if ($("bnAdd"))
                        $("bnAdd").addEventListener("htmx:beforeRequest", function (e) {
                            if (!val("bnName").trim()) {
                                e.preventDefault();
                                showManual();
                                alert("Add a bag photo to autofill, or type a name.");
                                var n = $("bnName");
                                if (n) n.focus();
                            }
                        });
                    if ($("bnPhoto"))
                        $("bnPhoto").addEventListener("change", function () {
                            var f = this.files && this.files[0];
                            if (!f) return;
                            var st = $("bnPhotoStatus");
                            if (st) st.textContent = "reading photo…";
                            analyzeImage(f)
                                .then(function (o) {
                                    // photo is NOT uploaded/stored — we extract a color + scan text
                                    PENDING.beanColor = o.color || null;
                                    if ($("bnColor"))
                                        $("bnColor").value = o.color || "";
                                    var sw = swatch(o.color, 18);
                                    if (st)
                                        st.innerHTML = sw + " scanning label…";
                                    api("/api/vision", {
                                        method: "POST",
                                        body: JSON.stringify({
                                            image: o.dataURL,
                                        }),
                                    })
                                        .then(function (d) {
                                            var fl = (d && d.fields) || {},
                                                got = false;
                                            showManual(); // reveal so the user can check/correct the scanned values
                                            if (
                                                fl.name &&
                                                !val("bnName").trim()
                                            ) {
                                                setVal("bnName", fl.name);
                                                got = true;
                                            }
                                            if (
                                                fl.roaster &&
                                                !val("bnRoaster").trim()
                                            ) {
                                                setVal("bnRoaster", fl.roaster);
                                                got = true;
                                            }
                                            if (
                                                fl.origin &&
                                                !val("bnOrigin").trim()
                                            ) {
                                                setVal("bnOrigin", fl.origin);
                                                got = true;
                                            }
                                            if (
                                                fl.process &&
                                                !val("bnProcess").trim()
                                            ) {
                                                setVal("bnProcess", fl.process);
                                                got = true;
                                            }
                                            if (
                                                fl.varietal &&
                                                !val("bnVarietal").trim()
                                            ) {
                                                setVal(
                                                    "bnVarietal",
                                                    fl.varietal,
                                                );
                                                got = true;
                                            }
                                            if (
                                                fl.roast_date &&
                                                !val("bnRoast")
                                            ) {
                                                setVal(
                                                    "bnRoast",
                                                    fl.roast_date,
                                                );
                                                got = true;
                                            }
                                            if (st)
                                                st.innerHTML =
                                                    sw +
                                                    (got
                                                        ? " label scanned — check the fields"
                                                        : " couldn’t read the label — enter details manually");
                                        })
                                        .catch(function () {
                                            showManual();
                                            if (st)
                                                st.innerHTML =
                                                    sw +
                                                    " color captured (scan unavailable)";
                                        });
                                })
                                .catch(function () {
                                    if (st)
                                        st.textContent =
                                            "could not read that image";
                                });
                        });
                    // Score is 1–5 stars (press star icon, filled up to the score). Hidden #brScore
                    // holds the value so num("brScore") + recipe save keep working unchanged.
                    function renderScoreStars() {
                        var host = $("brScoreStars");
                        if (!host) return;
                        var n = +($("brScore") || {}).value || 0;
                        var s = "";
                        for (var i = 1; i <= 5; i++) {
                            var on = i <= n,
                                raw =
                                    window.Press && Press.icon
                                        ? Press.icon("star")
                                        : "";
                            var ic = raw
                                ? raw.replace(
                                      'class="icon"',
                                      on ? 'class="icon fill"' : 'class="icon"',
                                  )
                                : on
                                  ? "★"
                                  : "☆";
                            s +=
                                '<button type="button" class="score-star" data-v="' +
                                i +
                                '" aria-label="Score ' +
                                i +
                                ' of 5" style="background:none;border:0;padding:2px;cursor:pointer;line-height:0;font-size:1.5rem;color:' +
                                (on ? "var(--accent)" : "var(--rule)") +
                                '">' +
                                ic +
                                "</button>";
                        }
                        host.innerHTML = s;
                        var tg = $("brScoreTag");
                        if (tg) tg.textContent = n + " / 5";
                    }
                    renderScoreStars();
                    // click a star -> set the hidden score + repaint (handler lives in this IIFE
                    // so it can reach renderScoreStars; the calc IIFE's click handler cannot)
                    document.addEventListener("click", function (e) {
                        var star =
                            e.target &&
                            e.target.closest &&
                            e.target.closest(".score-star");
                        if (!star) return;
                        var sc = $("brScore");
                        if (sc) sc.value = star.getAttribute("data-v");
                        renderScoreStars();
                    });
                    // Log brew is now an hx-post on #brSave (body via hx-vals:js,
                    // reading the live calc + form + photo-key). After a successful
                    // submit, clear the form (HX-Trigger brews:changed already
                    // refreshes the list + insights).
                    document.body.addEventListener("htmx:afterRequest", function (e) {
                        if (
                            !e.target ||
                            e.target.id !== "brSave" ||
                            !e.detail ||
                            !e.detail.successful
                        )
                            return;
                        ["brNote", "brGrind", "brTime"].forEach(function (i) {
                            setVal(i, "");
                        });
                        PENDING.brew = null;
                        if ($("brPhotoKey")) $("brPhotoKey").value = "";
                        if ($("brPhoto")) $("brPhoto").value = "";
                        if ($("brPhotoStatus")) $("brPhotoStatus").textContent = "";
                        if ($("brShare")) $("brShare").checked = false;
                    });
                    if ($("brPhoto"))
                        $("brPhoto").addEventListener("change", function () {
                            var f = this.files && this.files[0];
                            if (!f) return;
                            var st = $("brPhotoStatus");
                            if (st) st.textContent = "uploading…";
                            downscale(f, 1024)
                                .then(function (o) {
                                    uploadBlob(o.blob).then(function (u) {
                                        if (u.key) {
                                            PENDING.brew = u.key;
                                            // mirror into the hidden field the htmx
                                            // brew submit reads via hx-vals
                                            if ($("brPhotoKey"))
                                                $("brPhotoKey").value = u.key;
                                            if (st)
                                                st.innerHTML =
                                                    thumb(u.key, 40) +
                                                    " photo attached";
                                        } else if (st)
                                            st.textContent = "upload failed";
                                    });
                                })
                                .catch(function () {
                                    if (st)
                                        st.textContent =
                                            "could not read that image";
                                });
                        });
                    if ($("panel-log"))
                        $("panel-log").addEventListener("click", function (e) {
                        var beanRow = e.target.closest("[data-bean]"); // whole bean row → detail page
                        if (beanRow) {
                            location.href =
                                "/bean/" + beanRow.getAttribute("data-bean");
                            return;
                        }
                        var b = e.target.closest("[data-act]");
                        if (!b) return;
                        var id = b.getAttribute("data-id"),
                            act = b.getAttribute("data-act");
                        if (act === "rload") {
                            openRecipeInWater(id);
                        } else if (act === "ropen") {
                            window.open("/recipe/" + id, "_blank");
                        }
                        // Load/Open drive the calc island, so they stay JS. The
                        // mutations (rfav/rshare/rdel/padopt for recipes, brdel for
                        // brews) are now hx-* on the server-rendered buttons; their
                        // HX-Trigger (recipes:changed/brews:changed) re-fetches the lists.
                    });
                }

                // ---------- calibration (Phase 3) ----------
                var CAL_ACTIVE = null;
                function calibOn() {
                    return localStorage.getItem("wl_calib_on") !== "off";
                }
                function setCalibOn(v) {
                    localStorage.setItem("wl_calib_on", v ? "on" : "off");
                }
                function ctxLine() {
                    if (!$("readCtx") || !window.WaterLab) return;
                    var c = window.WaterLab.context();
                    $("readCtx").textContent =
                        c.source +
                        " · " +
                        c.ppm +
                        " ppm · modeled GH " +
                        Math.round(c.gh) +
                        " / KH " +
                        Math.round(c.kh);
                }

                // The readings list is server-rendered via htmx (#readListBody
                // hx-get="/partials/readings"). loadReadings() fires that refresh and
                // updates the #readCtx side-line (live calc context, not server data).
                function loadReadings() {
                    var el = $("readListBody");
                    if (el && window.htmx) window.htmx.trigger(el, "refresh");
                    // ctxLine reads the live calc (WaterLab.context); on a /water deep-link
                    // reload the calc inputs may not exist yet, so never let it throw — it
                    // re-runs on every input event anyway (see the document "input" listener).
                    try {
                        ctxLine();
                    } catch (e) {}
                }
                function loadCalibrations() {
                    api("/api/calibrations").then(function (rows) {
                        rows = rows || [];
                        var want = localStorage.getItem("wl_calib_id"),
                            active = null;
                        if (want)
                            active = rows.filter(function (r) {
                                return r.id === want;
                            })[0];
                        if (!active)
                            active = rows.filter(function (r) {
                                return r.name === "My calibration";
                            })[0];
                        CAL_ACTIVE = active || null;
                        applyActive();
                        renderCalibDetail();
                    });
                }
                function applyActive() {
                    if (!window.WaterLab) return;
                    if (CAL_ACTIVE && calibOn()) {
                        try {
                            window.WaterLab.setCalib(
                                JSON.parse(CAL_ACTIVE.comp),
                            );
                        } catch (e) {
                            window.WaterLab.clearCalib();
                        }
                    } else window.WaterLab.clearCalib();
                    renderCalibStatus();
                }
                function renderCalibStatus() {
                    var els = document.querySelectorAll(".calib-status"),
                        tg = $("calibToggle");
                    var on = window.WaterLab && window.WaterLab.isCalibrated();
                    var txt, cls;
                    if (on) {
                        var n = CAL_ACTIVE ? CAL_ACTIVE.reading_count : 0;
                        txt =
                            "calibrated · " +
                            n +
                            " reading" +
                            (n === 1 ? "" : "s");
                        cls = "tag positive calib-status";
                        if (tg) tg.textContent = "Use default model";
                    } else {
                        txt = "modeled (default)";
                        cls = "tag calib-status";
                        if (tg)
                            tg.textContent = CAL_ACTIVE
                                ? "Use calibration"
                                : "Use default model";
                    }
                    for (var i = 0; i < els.length; i++) {
                        els[i].textContent = txt;
                        els[i].className = cls;
                    }
                }
                function renderCalibDetail() {
                    var el = $("calibDetail");
                    if (!el) return;
                    if (!CAL_ACTIVE) {
                        el.innerHTML = "";
                        return;
                    }
                    var c;
                    try {
                        c = JSON.parse(CAL_ACTIVE.comp);
                    } catch (e) {
                        el.innerHTML = "";
                        return;
                    }
                    var NAME = { T: "TONIK", J: "JAMM", L: "LYLAC" };
                    function arrow(v) {
                        var p = Math.round((v - 1) * 100);
                        return (p > 0 ? "+" : "") + p + "%";
                    }
                    el.innerHTML =
                        '<div class="signal positive">Solved from ' +
                        c.n +
                        " reading" +
                        (c.n === 1 ? "" : "s") +
                        " (" +
                        (c.ghReadings || 0) +
                        " GH, " +
                        (c.khReadings || 0) +
                        " KH). Per-concentrate correction vs the default estimate:</div>" +
                        '<table class="ledger" style="margin-top:var(--space-2)"><thead><tr><th>concentrate <button class="hint" type="button" data-hint="Multipliers on the model: 1.00 = exactly as estimated, 1.20 = this bottle delivers 20% more than assumed, 0.80 = 20% less. Hardness × scales the concentrate&apos;s GH (its Ca+Mg); alkalinity × scales its KH (bicarbonate). Applied automatically while the badge reads calibrated.">?</button></th><th>hardness ×</th><th>alkalinity ×</th></tr></thead><tbody>' +
                        ["T", "J", "L"]
                            .map(function (C) {
                                return (
                                    "<tr><th>" +
                                    NAME[C] +
                                    "</th>" +
                                    '<td class="numeric">' +
                                    c.alpha[C].toFixed(2) +
                                    ' <span class="data">(' +
                                    arrow(c.alpha[C]) +
                                    ")</span></td>" +
                                    '<td class="numeric">' +
                                    c.beta[C].toFixed(2) +
                                    ' <span class="data">(' +
                                    arrow(c.beta[C]) +
                                    ")</span></td></tr>"
                                );
                            })
                            .join("") +
                        "</tbody></table>";
                }
                function loadCalibPool() {
                    api("/api/calibrations?shared=1").then(function (rows) {
                        var el = $("calibPool");
                        if (!el) return;
                        rows = rows || [];
                        var body = rows.length
                            ? rows
                                  .map(function (x) {
                                      var n = x.reading_count || 0;
                                      return row(
                                          esc(x.name),
                                          "calibrated · " +
                                              n +
                                              " reading" +
                                              (n === 1 ? "" : "s"),
                                          '<button class="button sm secondary" data-cal="adopt" data-id="' +
                                              x.id +
                                              '">Adopt &amp; use</button>',
                                      );
                                  })
                                  .join("")
                            : '<tr><th colspan="3" class="left"><span class="help">No shared calibrations yet.</span></th></tr>';
                        var title =
                            '<span class="cluster" style="justify-content:space-between;align-items:center"><span>Community calibrations</span><button class="button sm secondary" data-cal="poolrefresh" type="button">Refresh</button></span>';
                        el.innerHTML = ledger(body, title);
                    });
                }
                function bindCalib() {
                    if (!$("readAdd")) return;
                    $("readAdd").onclick = function () {
                        var gh = val("mGH") !== "" ? +val("mGH") : null,
                            kh = val("mKH") !== "" ? +val("mKH") : null,
                            tds = val("mTDS") !== "" ? +val("mTDS") : null;
                        if (gh == null && kh == null) {
                            alert("Enter a measured GH and/or KH.");
                            return;
                        }
                        var c = window.WaterLab.context();
                        if (c.kit !== "apax") {
                            alert(
                                "Calibration currently solves the Apax classic kit (TONIK/JAMM/LYLAC). Set the analyzed water to the Apax kit to record a reading.",
                            );
                            return;
                        }
                        api("/api/readings", {
                            method: "POST",
                            body: JSON.stringify({
                                ratios: JSON.stringify(c.masses),
                                ppm: c.ppm,
                                measured_gh: gh,
                                measured_kh: kh,
                                measured_tds: tds,
                            }),
                        }).then(function () {
                            ["mGH", "mKH", "mTDS"].forEach(function (i) {
                                setVal(i, "");
                            });
                            loadReadings();
                        });
                    };
                    $("calibSolve").onclick = function () {
                        api("/api/calibrate", { method: "POST" }).then(
                            function (d) {
                                if (d.error) {
                                    alert(d.error);
                                    return;
                                }
                                CAL_ACTIVE = d;
                                localStorage.setItem("wl_calib_id", d.id);
                                setCalibOn(true);
                                applyActive();
                                renderCalibDetail();
                            },
                        );
                    };
                    $("calibToggle").onclick = function () {
                        if (!CAL_ACTIVE) {
                            alert("Solve or adopt a calibration first.");
                            return;
                        }
                        setCalibOn(!calibOn());
                        applyActive();
                    };
                    $("calibShare").onclick = function () {
                        if (!CAL_ACTIVE) {
                            alert(
                                "Nothing to share yet — solve a calibration first.",
                            );
                            return;
                        }
                        api("/api/calibrations/" + CAL_ACTIVE.id, {
                            method: "PUT",
                            body: JSON.stringify({ shared: 1 }),
                        }).then(function () {
                            alert("Shared to the community pool.");
                            loadCalibPool();
                        });
                    };
                    $("panel-model").addEventListener("click", function (e) {
                        var b = e.target.closest("[data-cal]");
                        if (!b) return;
                        var id = b.getAttribute("data-id"),
                            act = b.getAttribute("data-cal");
                        // reading "rdel" is now hx-delete (HX-Trigger readings:changed).
                        if (act === "poolrefresh") {
                            loadCalibPool();
                        } else if (act === "adopt") {
                            api("/api/calibrations/" + id + "/adopt", {
                                method: "POST",
                            }).then(function (d) {
                                if (d.error) {
                                    alert(d.error);
                                    return;
                                }
                                CAL_ACTIVE = d;
                                localStorage.setItem("wl_calib_id", d.id);
                                setCalibOn(true);
                                applyActive();
                                renderCalibDetail();
                                alert("Adopted & applied.");
                            });
                        }
                    });
                    document.addEventListener("input", ctxLine);
                }

                // ---------- insights: score correlation (Phase 4a) ----------
                function pearson(xs, ys) {
                    var n = xs.length;
                    if (n < 2) return 0;
                    var sx = 0,
                        sy = 0,
                        i;
                    for (i = 0; i < n; i++) {
                        sx += xs[i];
                        sy += ys[i];
                    }
                    var mx = sx / n,
                        my = sy / n,
                        num = 0,
                        dx = 0,
                        dy = 0;
                    for (i = 0; i < n; i++) {
                        var a = xs[i] - mx,
                            b = ys[i] - my;
                        num += a * b;
                        dx += a * a;
                        dy += b * b;
                    }
                    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
                }
                function scoreColor(s) {
                    return s >= 4.5
                        ? "var(--positive)"
                        : s >= 3.5
                          ? "#3d9970"
                          : s >= 2.5
                            ? "var(--warn)"
                            : s >= 1.5
                              ? "#e2700e"
                              : "var(--negative)";
                }
                function renderInsights(brews) {
                    var chart = $("insightsChart"),
                        stats = $("insightsStats");
                    if (!chart || !stats) return;
                    var pts = (brews || []).filter(function (b) {
                        return (
                            b.gh != null &&
                            b.kh != null &&
                            b.score != null &&
                            (b.gh || b.kh)
                        );
                    });
                    if (pts.length < 3) {
                        chart.innerHTML =
                            '<p class="help">Log at least 3 scored brews to see what water makes your best cups (' +
                            pts.length +
                            " so far).</p>";
                        stats.innerHTML = "";
                        return;
                    }
                    var Lm = 46,
                        Rm = 14,
                        Tm = 12,
                        Bm = 34,
                        W = 340,
                        H = 230,
                        pw = W - Lm - Rm,
                        ph = H - Tm - Bm;
                    // Auto-scale axes to the data (incl. the SCA target zone 17–85 / 25–75) + padding,
                    // so the points spread across the panel instead of clumping in the corner.
                    var allG = pts
                            .map(function (p) {
                                return p.gh;
                            })
                            .concat([17, 85]),
                        allK = pts
                            .map(function (p) {
                                return p.kh;
                            })
                            .concat([25, 75]);
                    function niceMin(v) {
                        return v <= 0
                            ? 0
                            : Math.max(0, Math.floor(v / 10) * 10 - 10);
                    }
                    function niceMax(v) {
                        var steps = [
                            10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250,
                            300, 400, 500,
                        ];
                        for (var i = 0; i < steps.length; i++) {
                            if (v <= steps[i]) return steps[i];
                        }
                        return Math.ceil(v / 100) * 100;
                    }
                    var gLo = niceMin(Math.min.apply(null, allG)),
                        gHi = niceMax(Math.max.apply(null, allG) * 1.08);
                    var kLo = niceMin(Math.min.apply(null, allK)),
                        kHi = niceMax(Math.max.apply(null, allK) * 1.08);
                    function X(v) {
                        return (
                            Lm +
                            ((Math.max(gLo, Math.min(gHi, v)) - gLo) /
                                (gHi - gLo)) *
                                pw
                        );
                    }
                    function Y(v) {
                        return (
                            Tm +
                            ph -
                            ((Math.max(kLo, Math.min(kHi, v)) - kLo) /
                                (kHi - kLo)) *
                                ph
                        );
                    }
                    function ticks(lo, hi) {
                        var raw = (hi - lo) / 5,
                            mag = Math.pow(
                                10,
                                Math.floor(Math.log(raw) / Math.LN10),
                            ),
                            n = raw / mag,
                            step =
                                (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) *
                                mag,
                            out = [],
                            t = Math.ceil(lo / step) * step;
                        for (; t <= hi + 0.5; t += step)
                            out.push(Math.round(t));
                        return out;
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
                    ticks(gLo, gHi).forEach(function (v) {
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
                            '"/><text class="label" x="' +
                            x +
                            '" y="' +
                            (Tm + ph + 13) +
                            '" text-anchor="middle">' +
                            v +
                            "</text>";
                    });
                    ticks(kLo, kHi).forEach(function (v) {
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
                            '"/><text class="label" x="' +
                            (Lm - 6) +
                            '" y="' +
                            (y + 3) +
                            '" text-anchor="end">' +
                            v +
                            "</text>";
                    });
                    g +=
                        '<rect class="zone" x="' +
                        X(17) +
                        '" y="' +
                        Y(75) +
                        '" width="' +
                        (X(85) - X(17)) +
                        '" height="' +
                        (Y(25) - Y(75)) +
                        '"/>';
                    var top = pts.filter(function (p) {
                        return p.score >= 4;
                    });
                    var cluster =
                        top.length >= 2
                            ? top
                            : pts
                                  .slice()
                                  .sort(function (a, b) {
                                      return b.score - a.score;
                                  })
                                  .slice(
                                      0,
                                      Math.max(2, Math.ceil(pts.length / 3)),
                                  );
                    var ghs = cluster.map(function (p) {
                            return p.gh;
                        }),
                        khs = cluster.map(function (p) {
                            return p.kh;
                        });
                    var gmin = Math.min.apply(null, ghs),
                        gmax = Math.max.apply(null, ghs),
                        kmin = Math.min.apply(null, khs),
                        kmax = Math.max.apply(null, khs);
                    g +=
                        '<rect class="region" x="' +
                        X(gmin) +
                        '" y="' +
                        Y(kmax) +
                        '" width="' +
                        (X(gmax) - X(gmin) || 2) +
                        '" height="' +
                        (Y(kmin) - Y(kmax) || 2) +
                        '"/>';
                    g +=
                        '<line class="axis" x1="' +
                        Lm +
                        '" y1="' +
                        Tm +
                        '" x2="' +
                        Lm +
                        '" y2="' +
                        (Tm + ph) +
                        '"/><line class="axis" x1="' +
                        Lm +
                        '" y1="' +
                        (Tm + ph) +
                        '" x2="' +
                        (Lm + pw) +
                        '" y2="' +
                        (Tm + ph) +
                        '"/>';
                    g +=
                        '<text class="title" x="' +
                        (Lm + pw / 2) +
                        '" y="' +
                        (H - 2) +
                        '" text-anchor="middle">Hardness · GH (ppm)</text>';
                    g +=
                        '<text class="title" transform="translate(11,' +
                        (Tm + ph / 2) +
                        ') rotate(-90)" text-anchor="middle">Alkalinity · KH (ppm)</text>';
                    pts.forEach(function (p) {
                        g +=
                            '<circle class="point" cx="' +
                            X(p.gh) +
                            '" cy="' +
                            Y(p.kh) +
                            '" r="' +
                            (3 + (p.score || 0) * 0.7) +
                            '" fill="' +
                            scoreColor(p.score) +
                            '" opacity="0.85"/>';
                    });
                    chart.innerHTML =
                        '<svg viewBox="0 0 ' +
                        W +
                        " " +
                        H +
                        '">' +
                        g +
                        "</svg>";
                    var scores = pts.map(function (p) {
                        return p.score;
                    });
                    var rGH = pearson(
                            pts.map(function (p) {
                                return p.gh;
                            }),
                            scores,
                        ),
                        rKH = pearson(
                            pts.map(function (p) {
                                return p.kh;
                            }),
                            scores,
                        );
                    var avgG = Math.round(
                            cluster.reduce(function (s, p) {
                                return s + p.gh;
                            }, 0) / cluster.length,
                        ),
                        avgK = Math.round(
                            cluster.reduce(function (s, p) {
                                return s + p.kh;
                            }, 0) / cluster.length,
                        );
                    var out = [
                        "<p><b>" +
                            pts.length +
                            " scored brews.</b> Best cups center on <b>GH ~" +
                            avgG +
                            "</b> · <b>KH ~" +
                            avgK +
                            "</b> ppm.</p>",
                    ];
                    if (rGH >= 0.35)
                        out.push(
                            '<p class="data">↗ higher GH tracks with higher scores (r=' +
                                rGH.toFixed(2) +
                                ").</p>",
                        );
                    else if (rGH <= -0.35)
                        out.push(
                            '<p class="data">↘ lower GH tracks with higher scores (r=' +
                                rGH.toFixed(2) +
                                ").</p>",
                        );
                    if (rKH >= 0.35)
                        out.push(
                            '<p class="data">↗ higher KH tracks with higher scores (r=' +
                                rKH.toFixed(2) +
                                ").</p>",
                        );
                    else if (rKH <= -0.35)
                        out.push(
                            '<p class="data">↘ lower KH tracks with higher scores (r=' +
                                rKH.toFixed(2) +
                                ").</p>",
                        );
                    if (Math.abs(rGH) < 0.35 && Math.abs(rKH) < 0.35)
                        out.push(
                            '<p class="data">No strong GH/KH→score trend yet — keep logging.</p>',
                        );
                    out.push(
                        '<div class="cluster gap" style="flex-wrap:wrap;margin-top:var(--space-2)"><span class="tag positive">4–5★</span><span class="tag" style="color:var(--warn);border-color:var(--warn)">3★</span><span class="tag" style="color:var(--negative);border-color:var(--negative)">1–2★</span><span class="tag" style="color:var(--accent);border-color:var(--accent)">best cluster</span></div>',
                    );
                    stats.innerHTML = out.join("");
                }

                // ---------- AI tasting coach (Phase 4b) ----------
                // Coach is now an hx-post on #coachAsk (body via hx-vals:js reading the
                // live calc; the server returns an HTML fragment swapped into #coachOut).
                // This guard validates the note + shows the pending state before the request.
                function bindCoach() {
                    var btn = $("coachAsk");
                    if (!btn) return;
                    btn.addEventListener("htmx:beforeRequest", function (e) {
                        if (!val("coachNote").trim()) {
                            alert("Describe how it tasted first.");
                            e.preventDefault();
                            return;
                        }
                        var out = $("coachOut");
                        if (out) out.innerHTML = '<p class="help">Thinking…</p>';
                    });
                }

                // ---------- community feed ----------
                // The community feed is server-rendered + polled by htmx (#feedList hx-get="/partials/feed",
                // every 60s) — no client fetch/render. Clicks are delegated in start(); links are public.

                // Load only what the current page actually shows (each loader touches
                // DOM that only exists on its page; calling them all everywhere would
                // throw on the absent elements).
                function refreshAll() {
                    if (!ME) return;
                    var page = document.body.dataset.page;
                    if (page === "logbook") {
                        loadRecipes(); // also fills the brew-form recipe <select>
                        loadFav();
                        loadPool();
                        loadBeans(); // also fills the brew-form bean <select>
                        loadBrews();
                    } else if (page === "water") {
                        loadReadings();
                        loadCalibrations();
                        loadCalibPool();
                    } else if (page === "account") {
                        loadAccount();
                    }
                }

                // /account is its own server-rendered page now; fetch + fill the profile
                // fields and stats on boot (the SPA did this inside showAccount()).
                function loadAccount() {
                    api("/api/account").then(function (d) {
                        if (!d || d.error) return;
                        setVal("acctEmail", d.email);
                        setVal("acctName", d.display_name || "");
                        if ($("acctJoined"))
                            $("acctJoined").textContent = String(
                                d.created_at || "",
                            ).slice(0, 10);
                        var c = d.counts || {};
                        if ($("acctStats"))
                            $("acctStats").innerHTML = [
                                ["Recipes", c.recipes],
                                ["Beans", c.beans],
                                ["Brews", c.brews],
                                ["Calibrations", c.calibrations],
                            ]
                                .map(function (p) {
                                    return (
                                        "<tr><th>" +
                                        p[0] +
                                        '</th><td class="numeric">' +
                                        (p[1] || 0) +
                                        "</td></tr>"
                                    );
                                })
                                .join("");
                    });
                }

                // ---- Water-page sub-state in the URL (which tab + which loaded recipe) ----
                // /water?mode=split selects the split tab; /water?recipe=<id> loads + shows a recipe
                // (deep-linkable, refresh- and back-button-safe). recipe wins over mode (it implies one).
                var PROG_TAB = false; // true while we switch tabs in code, so the manual-switch sync ignores it
                function waterUrl(params) {
                    var q = "";
                    if (params && params.recipe)
                        q = "?recipe=" + encodeURIComponent(params.recipe);
                    else if (params && params.mode === "split")
                        q = "?mode=split";
                    return "/water" + q;
                }
                function setWaterUrl(params, hist) {
                    var u = waterUrl(params);
                    if (hist === "replace")
                        history.replaceState({ sec: "build" }, "", u);
                    else history.pushState({ sec: "build" }, "", u);
                }
                function setWaterTab(mode) {
                    // deep-link ?mode=split -> 2 waters; default 1 (recipe load sets the real count)
                    if (window.WaterLab && window.WaterLab.setWaters)
                        window.WaterLab.setWaters(mode === "split" ? 2 : 1);
                }
                // ---- the recipe ledger (top of /water) doubles as the loaded-recipe indicator ----
                // LOADED = the recipe currently filling the ledger; null = building from scratch.
                var LOADED = null; // { id, name, owned, sig }
                function setupSig() {
                    try {
                        var s = readSetup();
                        return (
                            s.mode +
                            "|" +
                            s.target_gl +
                            "|" +
                            s.drops_per_g +
                            "|" +
                            s.ratios
                        );
                    } catch (e) {
                        return "";
                    }
                }
                function isDirty() {
                    return !!LOADED && setupSig() !== LOADED.sig;
                }
                function renderSaveActions(dirty) {
                    var el = $("saveActions");
                    if (!el) return;
                    var b = "";
                    if (LOADED && LOADED.owned && dirty)
                        b +=
                            '<button class="button sm" type="button" data-save="update">Update “' +
                            esc(LOADED.name || "recipe") +
                            "”</button>";
                    b +=
                        '<button class="button sm' +
                        (LOADED ? " secondary" : "") +
                        '" type="button" data-save="new">' +
                        (LOADED ? "Save as new" : "Save") +
                        "</button>";
                    el.innerHTML = b;
                }
                function renderSetupHeader() {
                    var t = $("setupTitle"),
                        st = $("setupStatus");
                    if (!t) return;
                    if (!LOADED) {
                        t.textContent = "Save current water setup";
                        if (st) st.innerHTML = "";
                        renderSaveActions(false);
                        return;
                    }
                    var dirty = isDirty();
                    t.textContent = "Loaded recipe";
                    if (st)
                        st.innerHTML = dirty
                            ? '<span class="tag" style="border-color:var(--warn);color:var(--warn)">● unsaved edits</span>'
                            : '<span class="tag positive">loaded</span>';
                    renderSaveActions(dirty);
                }
                // Mark the ledger as showing recipe `rec` (clean baseline = current inputs).
                function setLoaded(rec) {
                    LOADED = rec
                        ? {
                              id: rec.id,
                              name: rec.name || "",
                              owned: !!RECIPES[rec.id],
                              sig: setupSig(),
                          }
                        : null;
                    if (rec) setVal("recName", rec.name || "");
                    renderSetupHeader();
                }
                function clearLoaded() {
                    var was = LOADED;
                    LOADED = null;
                    if (was) setVal("recName", "");
                    renderSetupHeader();
                }
                // The calculator (separate IIFE) injects the water inputs at boot and fires waterlab:ready.
                // On a deep link / refresh the logbook can run first, so defer applying until they exist.
                function whenWaterReady(fn) {
                    if ($("s_target")) return fn();
                    window.addEventListener("waterlab:ready", function h() {
                        window.removeEventListener("waterlab:ready", h);
                        fn();
                    });
                }
                // Resolve a recipe by id (own first, then the shared pool) and load it into the calculator.
                function applyRecipeRow(rec) {
                    if (!rec || rec.error) return;
                    whenWaterReady(function () {
                        applySetup(rec); // restores the water count itself (r.waters / mode)
                        setLoaded(rec);
                    });
                }
                function applyWaterFromUrl() {
                    // A water suggested on the logbook/bean page, stashed for cross-page apply.
                    try {
                        var pend = localStorage.getItem("wl_pending_suggest");
                        if (pend) {
                            localStorage.removeItem("wl_pending_suggest");
                            applySetup(JSON.parse(pend));
                            if (window.WaterLab && window.WaterLab.setWaters)
                                window.WaterLab.setWaters(1);
                            clearLoaded();
                            return;
                        }
                    } catch (e) {}
                    var sp;
                    try {
                        sp = new URLSearchParams(location.search);
                    } catch (e) {
                        sp = null;
                    }
                    var rid = sp && sp.get("recipe");
                    if (rid) {
                        if (RECIPES[rid]) {
                            applyRecipeRow(RECIPES[rid]);
                            return;
                        }
                        api("/api/recipes/" + rid).then(function (r) {
                            if (r && !r.error) {
                                applyRecipeRow(r);
                                return;
                            }
                            api("/api/recipes?shared=1").then(function (rows) {
                                var hit = null;
                                (rows || []).forEach(function (x) {
                                    if (x.id === rid) hit = x;
                                });
                                if (hit) applyRecipeRow(hit);
                            });
                        });
                        return;
                    }
                    setWaterTab(
                        sp && sp.get("mode") === "split" ? "split" : "single",
                    );
                    clearLoaded();
                }
                // "Load" lives on /logbook now; the calc is on /water. Navigate there with
                // ?recipe — /water's applyWaterFromUrl() loads it into the calc on boot.
                function openRecipeInWater(id) {
                    location.href = "/water?recipe=" + encodeURIComponent(id);
                }

                // /water-only bindings for the recipe ledger: tab<->URL sync, dirty
                // tracking, and the Save/Update buttons. All lookups are guarded, so
                // this is a no-op on pages that don't render #section-build.
                function bindWater() {
                    // Manual Single/Split switch -> reflect the tab in the URL (and drop any ?recipe).
                    var tabsEl = document.querySelector("#section-build .tabs");
                    if (tabsEl)
                        tabsEl.addEventListener("click", function (e) {
                            if (PROG_TAB) return; // ignore programmatic switches (recipe load)
                            var tab = e.target.closest(".tab[data-tab]");
                            if (!tab || location.pathname !== "/water") return;
                            // A loaded recipe carries its mode, so switching tabs is an edit -> let the ledger
                            // go dirty (keep the ?recipe URL). With nothing loaded, the tab is the URL state.
                            if (LOADED) renderSetupHeader();
                            else
                                setWaterUrl(
                                    {
                                        mode:
                                            tab.getAttribute("data-tab") ===
                                            "panel-split"
                                                ? "split"
                                                : "single",
                                    },
                                    "replace",
                                );
                        });
                    // As the user edits the water OR the brew method, recompute the loaded recipe's dirty state.
                    ["section-build", "panel-brew"].forEach(function (id) {
                        var el = $(id);
                        if (el)
                            el.addEventListener("input", function () {
                                if (LOADED) renderSetupHeader();
                            });
                    });
                    // Save / Update buttons in the recipe ledger.
                    var sa = $("saveActions");
                    if (sa)
                        sa.addEventListener("click", function (e) {
                            var b = e.target.closest("[data-save]");
                            if (!b) return;
                            if (b.getAttribute("data-save") === "update")
                                recipeUpdate();
                            else recipeSaveNew();
                        });
                }

                function start() {
                    // De-SPA: each page only renders its own elements, so a binder for a
                    // section absent on this page must not abort the whole boot. The
                    // binders self-guard their lookups, but wrap defensively as a backstop.
                    [bind, bindWater, bindCalib, bindCoach, bindSignin, bindAccount, bindWelcome].forEach(
                        function (fn) {
                            try {
                                fn();
                            } catch (err) {
                                console.warn("binder failed:", err);
                            }
                        },
                    );
                    renderAuth();
                    markCurrentNav();
                    // Press icons are client-only (Press.icon → inline SVG) and Press does NOT
                    // auto-hydrate dynamic DOM, so server-rendered htmx fragments emit
                    // <i data-icon="name"> placeholders; inline the SVG into any that arrive.
                    document.body.addEventListener("htmx:afterSwap", function (e) {
                        if (!window.Press || !Press.icon) return;
                        var t = e.target || document.body;
                        t.querySelectorAll("i[data-icon]").forEach(function (i) {
                            if (i.firstChild) return; // already hydrated
                            var svg = Press.icon(i.getAttribute("data-icon"));
                            if (svg) i.innerHTML = svg;
                        });
                    });
                    // Phase 2: the hx-* mutations refresh their lists via HX-Trigger,
                    // but the non-list side-channels (insights panel; RECIPES cache +
                    // brew-form recipe <select>) still need a nudge on change.
                    document.body.addEventListener("brews:changed", function () {
                        api("/api/brews").then(function (rows) {
                            renderInsights(rows || []);
                        });
                    });
                    document.body.addEventListener("recipes:changed", function () {
                        api("/api/recipes").then(function (rows) {
                            RECIPES = {};
                            (rows || []).forEach(function (x) {
                                RECIPES[x.id] = x;
                            });
                            fillRecipeSelect(rows || []);
                        });
                    });
                    // Feed rows are server-rendered (htmx) with a data-href; delegate clicks here once — the
                    // listener survives htmx innerHTML swaps since #feedList itself isn't replaced. Public
                    // destinations (/recipe/:id, /bean/:id) so this works signed-out too.
                    var fl = $("feedList");
                    if (fl)
                        fl.addEventListener("click", function (e) {
                            var tr =
                                e.target.closest &&
                                e.target.closest("[data-href]");
                            if (tr)
                                location.href = tr.getAttribute("data-href");
                        });
                    var pa = new URLSearchParams(location.search).get("auth");
                    var PAGE = document.body.dataset.page || "home";
                    var AUTH_REQ = document.body.dataset.auth === "required";
                    function reveal() {
                        document.body.classList.remove("booting");
                    }
                    setTimeout(reveal, 3000); // safety: never stay hidden if /auth/me hangs
                    // Blank-screen failsafe. The welcome/signin overlays are position:fixed
                    // covers; if one is displayed but failed to render its <form> (broken
                    // markup, an old-WebKit HTML-parse quirk — the bug that blanked a new
                    // user's first sign-in), it covers the page with nothing usable. Detect
                    // that exact state and recover: hide the empty overlay, restore <main>.
                    setTimeout(function () {
                        try {
                            reveal();
                            ["welcomeView", "signinView"].forEach(function (id) {
                                var o = document.getElementById(id);
                                if (
                                    o &&
                                    getComputedStyle(o).display !== "none" &&
                                    !o.querySelector("form")
                                ) {
                                    o.style.display = "none";
                                    var m = document.querySelector("main");
                                    if (m) m.style.display = "";
                                }
                            });
                        } catch (e) {}
                    }, 4500);
                    // No client router — each page is server-rendered. Resolve auth, then
                    // do per-page init (gating, data load, /water URL restore).
                    api("/auth/me")
                        .then(function (u) {
                            ME = u || null;
                            renderAuth();
                            try {
                                window.WaterLab &&
                                    window.WaterLab.setAuth &&
                                    window.WaterLab.setAuth(ME);
                            } catch (e) {}
                            if (ME) {
                                try {
                                    refreshAll();
                                } catch (e) {}
                                // Hard-gate the display-name picker for any authed user without a name.
                                if (!String(ME.display_name || "").trim())
                                    showWelcome();
                                // /water: restore ?recipe / ?mode from the URL once the calc is ready.
                                if (PAGE === "water")
                                    whenWaterReady(applyWaterFromUrl);
                            } else if (AUTH_REQ) {
                                // Auth-required page, signed out → overlay the sign-in form.
                                showSignin(
                                    '<div class="signal info">Sign in to use the ' +
                                        (PAGE === "logbook"
                                            ? "logbook"
                                            : PAGE === "account"
                                              ? "account"
                                              : "water tools") +
                                        ".</div>",
                                );
                            }
                            if (pa === "expired")
                                showSignin(
                                    '<div class="signal" style="border-color:var(--warn);color:var(--warn)">That sign-in link expired — request a new one.</div>',
                                );
                            else if (pa === "error")
                                showSignin(
                                    '<div class="signal" style="border-color:var(--negative);color:var(--negative)">That sign-in link was invalid — request a new one.</div>',
                                );
                            // On /water, hold the reveal until the calc island has painted its
                            // populated state (concentrate ledgers, pour rows, readouts). Otherwise
                            // main shows the empty skeleton first and the rows pop in after the
                            // /api/catalog fetch resolves → layout shift. whenWaterReady fires
                            // immediately if the calc is already built, and the 3s/4.5s failsafes
                            // above still reveal if waterlab:ready never arrives.
                            if (PAGE === "water") whenWaterReady(reveal);
                            else reveal();
                        })
                        .catch(reveal);
                }
                // The live chemistry the calculator (/water) persisted, for the brew-log
                // form on /logbook to read cross-page. Exposed on window for hx-vals:js.
                window.wlChem = function () {
                    try {
                        return JSON.parse(localStorage.getItem("wl_chem") || "{}");
                    } catch (e) {
                        return {};
                    }
                };
                // Mark the current page's nav link (replaces the router's aria management).
                function markCurrentNav() {
                    var want = {
                        home: "feed",
                        water: "build",
                        logbook: "log",
                    }[document.body.dataset.page];
                    var as = document.querySelectorAll(".bridge [data-section]");
                    for (var i = 0; i < as.length; i++)
                        as[i].setAttribute(
                            "aria-current",
                            as[i].getAttribute("data-section") === want
                                ? "page"
                                : "false",
                        );
                }
                if (document.readyState === "loading")
                    document.addEventListener("DOMContentLoaded", start);
                else start();
            })();
