(function () {
  "use strict";
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── DATA SOURCE SEAM ────────────────────────────────────────────────────────
  var USE_API = true;
  var EXPAND_K = 6;   // children shown per expand
  var POOL = 25;      // similars fetched, then diversity-sampled down to EXPAND_K
  var CYAN = "#47e0d2";
  var CYAN_BRIGHT = "#8ff8ec";

  async function fetchSimilar(name) {
    if (!USE_API) {
      var d = DATA[name];
      return d ? d.sim.map(function (s) { return { name: s[0], match: s[1] }; }) : [];
    }
    var res = await fetch("/api/similar?artist=" + encodeURIComponent(name) + "&limit=" + POOL);
    if (res.status === 429) throw new Error("Rate limited — try again in a moment");
    if (!res.ok) {
      var b = await res.json().catch(function () { return {}; });
      throw new Error(b.error || ("Error " + res.status));
    }
    var data = await res.json();
    return data.similar || [];
  }

  async function fetchSearch(q) {
    if (!USE_API) {
      var lc = q.toLowerCase();
      return Object.keys(DATA)
        .filter(function (k) { return k.toLowerCase() === lc || k.toLowerCase().indexOf(lc) === 0; })
        .map(function (n) { return { name: n }; });
    }
    var res = await fetch("/api/search?q=" + encodeURIComponent(q));
    if (!res.ok) return [];
    var data = await res.json();
    return data.results || [];
  }

  // Diversity sampling — mega-artists (e.g. The Beatles) return their own members
  // at the very top by match, so a strict top-K is a family reunion. Keep the top
  // few, then sample evenly across the tail to pull in the wider scene.
  function selectDiverse(list, k) {
    if (!list || list.length <= k) return (list || []).slice();
    var topN = Math.min(3, k);
    var picked = list.slice(0, topN);
    var rest = list.slice(topN);
    var need = k - topN;
    var step = rest.length / need;
    for (var i = 0; i < need; i++) picked.push(rest[Math.floor(i * step + step / 2)]);
    return picked;
  }

  // ── mock data (Last.fm getSimilar shape: name + match 0..1) ─────────────────
  var DATA = {
    "The Velvet Underground": { tag: "art rock", sim: [["Nico",.95],["John Cale",.92],["Lou Reed",.92],["The Modern Lovers",.9],["The Stooges",.86],["Television",.82],["Jonathan Richman",.8],["MC5",.72]] },
    "The Modern Lovers": { tag: "proto-punk", sim: [["Jonathan Richman",.95],["The Velvet Underground",.9],["Talking Heads",.8],["Ramones",.78],["Television",.72]] },
    "The Stooges": { tag: "proto-punk", sim: [["Iggy Pop",.95],["MC5",.9],["The Velvet Underground",.84],["New York Dolls",.82],["Ramones",.8]] },
    "Television": { tag: "art punk", sim: [["Wire",.8],["Talking Heads",.82],["The Velvet Underground",.8],["The Modern Lovers",.72],["Pere Ubu",.72]] },
    "Ramones": { tag: "punk", sim: [["Sex Pistols",.9],["The Clash",.86],["Buzzcocks",.84],["New York Dolls",.8],["The Stooges",.8],["The Modern Lovers",.74]] },
    "Joy Division": { tag: "post-punk", sim: [["New Order",.95],["The Cure",.82],["Wire",.8],["Bauhaus",.82],["Siouxsie and the Banshees",.8],["Magazine",.82]] },
    "Wire": { tag: "post-punk", sim: [["Gang of Four",.86],["Mission of Burma",.84],["Joy Division",.8],["Pere Ubu",.82],["Magazine",.8],["Television",.76],["The Fall",.78]] },
    "New Order": { tag: "post-punk", sim: [["Joy Division",.95],["The Cure",.78],["Magazine",.62],["Bauhaus",.6]] },
    "Talking Heads": { tag: "new wave", sim: [["Television",.8],["Devo",.78],["Brian Eno",.8],["The Modern Lovers",.76],["Pere Ubu",.68]] },
    "Gang of Four": { tag: "post-punk", sim: [["Wire",.86],["The Fall",.82],["Mission of Burma",.8],["Public Image Ltd",.82]] },
    "The Fall": { tag: "post-punk", sim: [["Wire",.78],["Gang of Four",.82],["Public Image Ltd",.8],["Pere Ubu",.76]] },
    "Public Image Ltd": { tag: "post-punk", sim: [["The Fall",.8],["Gang of Four",.82],["Wire",.76],["Magazine",.78]] },
    "Siouxsie and the Banshees": { tag: "goth", sim: [["The Cure",.82],["Joy Division",.8],["Bauhaus",.84],["Magazine",.76]] },
    "Bauhaus": { tag: "goth", sim: [["Siouxsie and the Banshees",.84],["Joy Division",.82],["The Cure",.8]] },
    "The Cure": { tag: "post-punk", sim: [["Siouxsie and the Banshees",.82],["Joy Division",.82],["New Order",.78],["Bauhaus",.8]] },
    "Magazine": { tag: "post-punk", sim: [["Wire",.8],["Public Image Ltd",.78],["Joy Division",.82],["Buzzcocks",.76],["Gang of Four",.74]] },
    "Buzzcocks": { tag: "punk", sim: [["Ramones",.84],["Magazine",.76],["Wire",.74],["Sex Pistols",.78]] },
    "Sex Pistols": { tag: "punk", sim: [["The Clash",.88],["Ramones",.9],["Buzzcocks",.78],["New York Dolls",.78]] },
    "The Clash": { tag: "punk", sim: [["Sex Pistols",.88],["Ramones",.86],["Buzzcocks",.76]] },
    "New York Dolls": { tag: "glam punk", sim: [["The Stooges",.82],["Ramones",.8],["Sex Pistols",.78],["MC5",.76]] },
    "MC5": { tag: "proto-punk", sim: [["The Stooges",.9],["New York Dolls",.76],["The Velvet Underground",.72],["Ramones",.74]] },
    "Iggy Pop": { tag: "proto-punk", sim: [["The Stooges",.95],["Lou Reed",.78],["New York Dolls",.76]] },
    "Lou Reed": { tag: "art rock", sim: [["The Velvet Underground",.92],["John Cale",.86],["Nico",.8],["Iggy Pop",.78]] },
    "John Cale": { tag: "avant", sim: [["The Velvet Underground",.92],["Lou Reed",.86],["Nico",.84],["Brian Eno",.78]] },
    "Nico": { tag: "chanson", sim: [["The Velvet Underground",.95],["John Cale",.84],["Lou Reed",.8]] },
    "Brian Eno": { tag: "ambient", sim: [["John Cale",.76],["Talking Heads",.8],["Devo",.6]] },
    "Pere Ubu": { tag: "avant-punk", sim: [["Wire",.82],["The Fall",.76],["Devo",.78],["Mission of Burma",.8]] },
    "Devo": { tag: "new wave", sim: [["Talking Heads",.78],["Pere Ubu",.78],["Wire",.7],["Brian Eno",.6]] },
    "Mission of Burma": { tag: "post-punk", sim: [["Wire",.84],["Gang of Four",.8],["Pere Ubu",.8]] },
    "Jonathan Richman": { tag: "proto-punk", sim: [["The Modern Lovers",.95],["The Velvet Underground",.8]] }
  };

  // ── canvas ────────────────────────────────────────────────────────────────
  var canvas = document.getElementById("c"), ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, ringR = 120, SZ = 1;
  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2; ringR = Math.max(60, Math.min(W, H) * 0.15);
    SZ = W < 640 ? 0.7 : 1; // smaller nodes + spacing on mobile
  }
  addEventListener("resize", resize); resize();

  // ── graph ───────────────────────────────────────────────────────────────
  var nodes = new Map();
  var edges = [];
  var edgeSet = new Set();
  var focusName = null;

  function norm(s) { return String(s).trim().toLowerCase().replace(/^the\s+/, ""); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }

  var SANS = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  var MONO = "ui-monospace,Menlo,Consolas,monospace";
  function measure(node) { // base size; SZ is applied at draw/physics time
    ctx.font = "700 14px " + SANS;
    var wName = ctx.measureText(node.name).width;
    ctx.font = "10px " + MONO;
    var wTag = ctx.measureText(node.tag).width;
    node.w = Math.max(wName, wTag) + 26;
    node.h = 40;
  }

  function getNode(name, spawn) {
    var key = norm(name);
    var n = nodes.get(key);
    if (n) return n;
    var d = DATA[name];
    n = {
      name: name, tag: d ? d.tag : "",
      x: spawn ? spawn.x + (Math.random() - 0.5) * 14 : cx,
      y: spawn ? spawn.y + (Math.random() - 0.5) * 14 : cy,
      vx: 0, vy: 0, alpha: 0, aT: 1, dist: Infinity,
      grow: spawn ? 0 : 1, growDelay: 0,
      expanded: false, loading: false,
      hasData: USE_API || !!d, matchToParent: null, w: 60, h: 40
    };
    measure(n);
    nodes.set(key, n);
    return n;
  }
  function addEdge(aName, bName, match) {
    var ak = norm(aName), bk = norm(bName);
    var key = ak < bk ? ak + "|" + bk : bk + "|" + ak;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ a: nodes.get(ak), b: nodes.get(bk), match: match, alpha: 0, aT: 1 });
  }

  async function expand(node) {
    if (node.expanded || node.loading) return;
    node.loading = true;
    try {
      var sims = await fetchSimilar(node.name);
      node.expanded = true;
      if (!sims.length) { toast("No similars found for " + node.name); return; }
      selectDiverse(sims, EXPAND_K).forEach(function (s, i) {
        var childName = s.name, match = s.match;
        var existed = nodes.has(norm(childName));
        var child = getNode(childName, node);
        if (child.matchToParent == null) { child.matchToParent = match; child.parent = node.name; }
        addEdge(node.name, childName, match);
        if (!existed) {
          if (reduced) { child.grow = 1; child.alpha = child.aT; }
          else { child.growDelay = i * 5; } // petals open in sequence
        }
      });
      recomputeDepths();
    } catch (e) {
      toast((e && e.message) || "Couldn't load similars");
    } finally {
      node.loading = false;
    }
  }

  function focus(node) {
    focusName = node.name;
    var qi = document.getElementById("q");
    if (qi && document.activeElement !== qi) qi.value = node.name; // search box mirrors the centre
    recomputeDepths();
  }

  // "Gradual replacement of the centre": opacity = f(hop-distance from focus).
  // Beyond 2 hops a node fully disappears (and drops out of physics/hit-testing),
  // reappearing the instant a new edge brings it back within range.
  function nodeAlpha(d) {
    if (!isFinite(d)) return 0;
    if (d <= 0) return 1;   // the centre
    if (d === 1) return 0.7; // its neighbours
    return 0;               // 2+ hops disappear — keep the screen to centre + one ring
  }

  function recomputeDepths() {
    var adj = new Map();
    nodes.forEach(function (nd) { adj.set(norm(nd.name), []); });
    edges.forEach(function (e) {
      var a = norm(e.a.name), b = norm(e.b.name);
      if (adj.has(a)) adj.get(a).push(b);
      if (adj.has(b)) adj.get(b).push(a);
    });
    nodes.forEach(function (nd) { nd.dist = Infinity; });

    var fk = focusName ? norm(focusName) : null;
    var start = fk ? nodes.get(fk) : null;
    if (start) {
      start.dist = 0;
      var queue = [fk], seen = Object.create(null); seen[fk] = 1;
      while (queue.length) {
        var k = queue.shift(), kn = nodes.get(k), neigh = adj.get(k) || [];
        for (var i = 0; i < neigh.length; i++) {
          var nk = neigh[i];
          if (!seen[nk]) { seen[nk] = 1; var nn = nodes.get(nk); if (nn) { nn.dist = kn.dist + 1; queue.push(nk); } }
        }
      }
    }
    nodes.forEach(function (nd) { nd.aT = nodeAlpha(nd.dist); });
    edges.forEach(function (e) { e.aT = nodeAlpha(Math.max(e.a.dist, e.b.dist)); });
    updatePlugins();
  }

  // ── plugin slots (placeholders now; Spotify embeds later) ───────────────────
  function matchToFocus(nd) {
    if (!focusName) return 0;
    var fk = norm(focusName), nk = norm(nd.name);
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i], a = norm(e.a.name), b = norm(e.b.name);
      if ((a === fk && b === nk) || (a === nk && b === fk)) return e.match;
    }
    return 0;
  }
  function slotHTML(nd, isFocus) {
    var label = isFocus ? "centre" : (Math.round(matchToFocus(nd) * 100) + "% match");
    return '<div class="plugin' + (isFocus ? " is-focus" : "") + '">' +
      '<div class="p-name">' + esc(nd.name) + '</div>' +
      '<div class="p-embed">Spotify · ' + label + '</div></div>';
  }
  function updatePlugins() {
    var left = document.getElementById("pluginsLeft");
    var right = document.getElementById("pluginsRight");
    var bottom = document.getElementById("pluginBottom");
    if (!left || !right || !bottom) return;
    var fn = focusName ? nodes.get(norm(focusName)) : null;
    var neigh = [];
    nodes.forEach(function (nd) { if (nd.dist === 1) neigh.push(nd); });
    neigh.sort(function (a, b) { return matchToFocus(b) - matchToFocus(a); });
    var list = (fn ? [fn].concat(neigh) : neigh).slice(0, 7); // node + 6
    left.innerHTML = list.slice(0, 4).map(function (nd) { return slotHTML(nd, nd === fn); }).join("");
    right.innerHTML = list.slice(4, 7).map(function (nd) { return slotHTML(nd, nd === fn); }).join("");
    bottom.innerHTML = fn ? slotHTML(fn, true) : "";

    var statEl = document.getElementById("stat");
    if (statEl) statEl.textContent = nodes.size + " artists · " + edges.length + " links · seed: " + (seedName || "—") + " · " + (USE_API ? "live" : "demo data");
  }

  function seed(name) {
    nodes.clear(); edges.length = 0; edgeSet.clear();
    var n = getNode(name, null);
    n.x = cx; n.y = cy; n.alpha = 1;
    focus(n);
    setTimeout(function () { expand(n); }, reduced ? 0 : 220);
  }

  // ── physics ─────────────────────────────────────────────────────────────────
  var REP = 13000, LINK_GAP = 64, LSPAN = 150, LK = 0.018, DAMP = 0.88, GRAV = 0.001, FOCUS_PULL = 0.02;
  var PADX = 34, PADY = 26;
  var drag = null;

  function physics() {
    var arr = Array.from(nodes.values()), n = arr.length;

    for (var i = 0; i < n; i++) {
      var a = arr[i];
      if (a.aT <= 0.001) continue; // disappeared node — inert
      for (var j = i + 1; j < n; j++) {
        var b = arr[j];
        if (b.aT <= 0.001) continue;
        var dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 360000) continue;
        if (d2 < 16) d2 = 16;
        var f = REP / d2, d = Math.sqrt(d2), gg = a.grow * b.grow;
        var ux = dx / d, uy = dy / d;
        a.vx += ux * f * 0.016 * gg * SZ; a.vy += uy * f * 0.016 * gg * SZ;
        b.vx -= ux * f * 0.016 * gg * SZ; b.vy -= uy * f * 0.016 * gg * SZ;
      }
    }
    edges.forEach(function (e) {
      if (e.a.aT <= 0.001 || e.b.aT <= 0.001) return;
      var dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 0.01;
      var target = ((e.a.w + e.b.w) / 2 + LINK_GAP + (1 - e.match) * LSPAN) * SZ;
      var diff = (d - target) / d * LK;
      var mx = dx * diff, my = dy * diff;
      e.a.vx += mx; e.a.vy += my; e.b.vx -= mx; e.b.vy -= my;
    });
    arr.forEach(function (nd) {
      nd.vx += (cx - nd.x) * GRAV; nd.vy += (cy - nd.y) * GRAV;
      if (nd.name === focusName) { nd.vx += (cx - nd.x) * FOCUS_PULL; nd.vy += (cy - nd.y) * FOCUS_PULL; }
      if (drag && drag.node === nd) { nd.x = drag.x; nd.y = drag.y; nd.vx = nd.vy = 0; }
      else { nd.vx *= DAMP; nd.vy *= DAMP; nd.x += nd.vx; nd.y += nd.vy; }
      if (nd.growDelay > 0) nd.growDelay--;
      else if (nd.grow < 1) nd.grow += (1 - nd.grow) * 0.14;
      nd.alpha += (nd.aT - nd.alpha) * 0.1;
    });
    for (var it = 0; it < 3; it++) collide(arr, n);
    edges.forEach(function (e) { e.alpha += (e.aT - e.alpha) * 0.1; });
  }

  function collide(arr, n) {
    for (var i = 0; i < n; i++) {
      var a = arr[i];
      if (a.aT <= 0.001) continue;
      for (var j = i + 1; j < n; j++) {
        var b = arr[j];
        if (b.aT <= 0.001) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var ag = a.grow, bg = b.grow, mg = Math.min(ag, bg);
        var ox = ((a.w * ag + b.w * bg) / 2 + PADX * mg) * SZ - Math.abs(dx);
        var oy = ((a.h * ag + b.h * bg) / 2 + PADY * mg) * SZ - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        var aFix = drag && drag.node === a, bFix = drag && drag.node === b;
        if (ox < oy) {
          var sx = dx >= 0 ? 1 : -1;
          if (aFix && !bFix) b.x += sx * ox;
          else if (bFix && !aFix) a.x -= sx * ox;
          else { a.x -= sx * ox / 2; b.x += sx * ox / 2; }
        } else {
          var sy = dy >= 0 ? 1 : -1;
          if (aFix && !bFix) b.y += sy * oy;
          else if (bFix && !aFix) a.y -= sy * oy;
          else { a.y -= sy * oy / 2; b.y += sy * oy / 2; }
        }
      }
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  var hoverName = null, ringHot = false;
  function render() {
    ctx.clearRect(0, 0, W, H);

    ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = ringHot ? "rgba(143,248,236,.9)" : "rgba(143,248,236,.4)";
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]);

    edges.forEach(function (e) {
      if (e.alpha < 0.02) return;
      var focused = (e.a.name === focusName || e.b.name === focusName);
      ctx.globalAlpha = e.alpha * (0.18 + e.match * 0.55);
      ctx.strokeStyle = focused ? "rgba(143,248,236,1)" : "rgba(143,248,236,.7)";
      ctx.lineWidth = 1 + e.match * 2.4;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      if (hoverName && !focused && (e.a.name === hoverName || e.b.name === hoverName)) {
        ctx.globalAlpha = e.alpha * 0.85;
        ctx.fillStyle = "#bfeee9"; ctx.font = "10px " + MONO; ctx.textAlign = "center";
        ctx.fillText(Math.round(e.match * 100) + "%", (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2 - 3);
      }
    });
    ctx.globalAlpha = 1;

    nodes.forEach(function (nd) {
      if (nd.alpha < 0.02) return;
      var isFocus = nd.name === focusName, isHover = nd.name === hoverName;
      var s = (isHover ? 1.06 : 1) * nd.grow * SZ;
      if (s < 0.02) return;
      ctx.globalAlpha = isHover ? Math.max(nd.alpha, 0.9) : nd.alpha;
      ctx.save();
      ctx.translate(nd.x, nd.y);
      ctx.scale(s, s);
      var w = nd.w, h = nd.h;
      roundRect(-w / 2, -h / 2, w, h, 7);
      ctx.fillStyle = isFocus ? "#f4f1e9" : "#e7e3da";
      ctx.fill();
      if (isFocus || isHover) {
        ctx.lineWidth = (isFocus ? 2 : 1.2) / s;
        ctx.strokeStyle = isFocus ? CYAN_BRIGHT : "rgba(143,248,236,.6)";
        ctx.stroke();
      }
      ctx.fillStyle = "#141418"; ctx.textAlign = "center";
      ctx.font = "700 14px " + SANS;
      ctx.fillText(nd.name, 0, -2);
      ctx.fillStyle = "#6a6a74"; ctx.font = "10px " + MONO;
      var sub = nd.loading ? "loading…" : (nd.tag + (nd.hasData && !nd.expanded ? "  +" : ""));
      ctx.fillText(sub, 0, 12);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function loop() { physics(); render(); requestAnimationFrame(loop); }

  // ── interaction ─────────────────────────────────────────────────────────────
  function pick(mx, my) {
    var hit = null;
    nodes.forEach(function (nd) {
      if (nd.aT <= 0.001) return; // can't click a disappeared node
      var hw = nd.w * SZ / 2, hh = nd.h * SZ / 2;
      if (mx >= nd.x - hw && mx <= nd.x + hw && my >= nd.y - hh && my <= nd.y + hh) hit = nd;
    });
    return hit;
  }
  canvas.addEventListener("pointerdown", function (e) {
    var nd = pick(e.clientX, e.clientY);
    if (!nd) return;
    drag = { node: nd, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, branched: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    hoverName = drag ? drag.node.name : (function () { var n = pick(e.clientX, e.clientY); return n ? n.name : null; })();
    canvas.style.cursor = hoverName ? "pointer" : "default";
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 5) drag.moved = true;
    var inRing = Math.hypot(e.clientX - cx, e.clientY - cy) < ringR;
    ringHot = inRing;
    if (inRing && !drag.branched) { drag.branched = true; expand(drag.node); focus(drag.node); pulseRing(); }
  });
  function endDrag() {
    if (!drag) return;
    var d = drag; drag = null; ringHot = false;
    if (!d.moved) { expand(d.node); focus(d.node); }
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  function pulseRing() { ringHot = true; setTimeout(function () { if (!drag) ringHot = false; }, 260); }

  // ── chrome ────────────────────────────────────────────────────────────────
  var toastEl = document.getElementById("toast"), toastT = null;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 1800); }
  var seedName = null;
  function doSeed(name) { seedName = name; seed(name); }

  var q = document.getElementById("q");
  q.addEventListener("keydown", async function (e) {
    if (e.key !== "Enter") return;
    var v = q.value.trim(); if (!v) return;
    var results = await fetchSearch(v);
    if (results.length) { doSeed(results[0].name); q.blur(); }
    else toast(USE_API ? "No artist found for “" + v + "”" : "Not in this demo set — try Wire, Nico, Ramones…");
  });
  document.getElementById("reset").addEventListener("click", function () { doSeed("The Velvet Underground"); });

  // ── boot ────────────────────────────────────────────────────────────────────
  var subEl = document.getElementById("sub");
  if (subEl) subEl.textContent = "crowd similarity · " + (USE_API ? "last.fm live" : "demo data");
  doSeed("The Velvet Underground");
  requestAnimationFrame(loop);
})();
