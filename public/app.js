(function () {
  "use strict";
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── DATA SOURCE SEAM ────────────────────────────────────────────────────────
  var USE_API = true;
  var EXPAND_K = 8;   // children shown per expand
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
  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, ringR = 120, SZ = 1, PSCALE = 0.6, ZOOM = 1;
  function sc() { return SZ * ZOOM; }              // combined platform + pinch scale
  function playerRadius() { return Math.hypot(300 * PSCALE, 352 * PSCALE) / 2 + 30; }
  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
    PSCALE = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pscale")) || 0.6;
    SZ = W < 640 ? 0.6 : 1; // smaller group on mobile
    ringR = isMobile() ? Math.max(50, Math.min(W, H) * 0.14) : Math.max(80, playerRadius());
    if (nodes) {
      nodes.forEach(measure);                              // node size differs desktop/mobile
      if (isMobile() !== lastMobile) updatePlugins();      // rebuild when crossing the breakpoint
    }
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
  var IMGD = 81, IMGM = 54; // avatar size: desktop (branch nodes +50%) vs mobile
  function nodeSize() { return isMobile() ? IMGM : IMGD; }
  function measure(node) {
    var D = nodeSize();
    ctx.font = "700 13px " + SANS;
    var label = node.name, maxW = 150;
    if (ctx.measureText(label).width > maxW) {
      while (label.length > 1 && ctx.measureText(label + "…").width > maxW) label = label.slice(0, -1);
      label = label.replace(/\s+…$/, "") + "…";
    }
    node._label = label;
    node.w = Math.max(D, ctx.measureText(label).width) + 16;
    node.h = D + 22; // avatar + name line
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
  // Spotify: resolve name -> { spotify:{id,image,genres,...}, bio } via /api/artist,
  // memoized so navigating back doesn't refetch. Player is Spotify's embed iframe.
  var artistCache = {};
  var lastMobile = false;
  function isMobile() { return matchMedia("(max-width:640px)").matches; }

  function embedSrc(id) { return "https://open.spotify.com/embed/artist/" + id + "?utm_source=generator&theme=0"; }
  function playerFrame(id, h) {
    return '<iframe src="' + embedSrc(id) + '" width="100%" height="' + h +
      '" loading="lazy" allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"></iframe>';
  }
  function fetchArtist(name) {
    var k = norm(name);
    if (artistCache[k]) return artistCache[k];
    artistCache[k] = fetch("/api/artist?name=" + encodeURIComponent(name))
      .then(function (r) { return r.ok ? r.json() : { name: name, spotify: null, bio: null }; })
      .catch(function () { return { name: name, spotify: null, bio: null }; });
    return artistCache[k];
  }

  // Node avatars: the Spotify artist image, cached + drawn on the canvas node.
  var imgCache = {};
  function getNodeImage(name) {
    var k = norm(name);
    var e = imgCache[k];
    if (e) return e.status === "ok" ? e.img : null;
    imgCache[k] = { status: "loading", img: null };
    fetchArtist(name).then(function (info) {
      var url = info.spotify && info.spotify.image;
      if (!url) { imgCache[k].status = "none"; return; }
      var img = new Image();
      img.onload = function () { imgCache[k] = { status: "ok", img: img }; };
      img.onerror = function () { imgCache[k].status = "err"; };
      img.src = url; // drawn only; canvas may taint but we never read it back
    });
    return null;
  }
  function colorFor(nd) {
    var h = 0, s = norm(nd.name);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return "hsl(" + h + ",42%,40%)";
  }

  // ── Spotify IFrame API: real players with play/pause + events ──────────────
  var SpApi = null, apiQueue = [];
  window.onSpotifyIframeApiReady = function (api) { SpApi = api; apiQueue.forEach(function (fn) { fn(api); }); apiQueue = []; };
  function whenApi(cb) { if (SpApi) cb(SpApi); else apiQueue.push(cb); }

  var controllers = []; // live slot controllers
  var pluginGen = 0;    // bumped on every rebuild so stale async callbacks bail
  function destroyControllers() {
    controllers.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    controllers = [];
  }
  // Create a controller on `host` (replaced by the iframe). `autoplay` starts the
  // centre; starting any player pauses the others (only one sounds at a time).
  function mountPlayer(host, id, gen, autoplay, scaled) {
    whenApi(function (api) {
      if (gen !== pluginGen || !host.isConnected) return;
      // scaled: natural 300x352 card (CSS shrinks it); otherwise a full-width compact bar
      var opts = scaled
        ? { uri: "spotify:artist:" + id, width: 300, height: 352 }
        : { uri: "spotify:artist:" + id, width: "100%", height: 152 };
      api.createController(host, opts, function (controller) {
        if (gen !== pluginGen) { try { controller.destroy(); } catch (e) {} return; }
        controllers.push(controller);
        controller.addListener("playback_update", function (e) {
          if (e && e.data && e.data.isPaused === false) {
            controllers.forEach(function (c) { if (c !== controller) { try { c.pause(); } catch (_) {} } });
          }
        });
        // autoplay must wait for the player to be ready (else play() no-ops); still browser-gated for sound
        if (autoplay) controller.addListener("ready", function () { try { controller.play(); } catch (e) {} });
      });
    });
  }

  function slotHTML(nd, isFocus, scaled) {
    var right = isFocus ? '' : '<span class="p-match">' + Math.round(matchToFocus(nd) * 100) + '%</span>';
    return '<div class="plugin' + (isFocus ? " is-focus" : "") + '" data-artist="' + esc(nd.name) + '">' +
      '<div class="p-name"><span>' + esc(nd.name) + '</span>' + right + '</div>' +
      '<div class="p-player' + (scaled ? " scaled" : "") + '"><div class="p-embed-host"><div class="pl-empty">loading…</div></div></div></div>';
  }
  // Render a column of slots, then mount a Spotify IFrame-API player in each.
  function buildColumn(el, items, focusNode, gen, scaled) {
    el.innerHTML = items.map(function (nd) { return slotHTML(nd, nd === focusNode, scaled); }).join("");
    var hosts = el.querySelectorAll(".p-embed-host");
    items.forEach(function (nd, i) {
      var host = hosts[i]; if (!host) return;
      var isFocus = nd === focusNode;
      fetchArtist(nd.name).then(function (info) {
        if (gen !== pluginGen || !host.isConnected) return; // rebuilt while fetching
        if (info.spotify && info.spotify.id) mountPlayer(host, info.spotify.id, gen, isFocus, scaled);
        else host.innerHTML = '<div class="pl-empty">' + (info.configured === false ? "Add Spotify keys" : "Not on Spotify") + "</div>";
      });
    });
  }

  function updatePlugins() {
    var bottom = document.getElementById("pluginBottom");
    if (!bottom) return;
    var fn = focusName ? nodes.get(norm(focusName)) : null;

    pluginGen++;            // invalidate any in-flight player mounts
    destroyControllers();   // tear down old player before rebuilding
    // Only the centre is a player now; neighbours are image nodes on the graph.
    if (!fn) bottom.innerHTML = "";
    else buildColumn(bottom, [fn], fn, pluginGen, !isMobile()); // desktop card on node, mobile compact bar
    lastMobile = isMobile();

    var statEl = document.getElementById("stat");
    if (statEl) statEl.textContent = nodes.size + " artists · " + edges.length + " links · seed: " + (seedName || "—") + " · " + (USE_API ? "live" : "demo data");
  }

  // Opening the modal pauses every slot player so the modal is the only sound.
  function pauseAllSlots() { controllers.forEach(function (c) { try { c.pause(); } catch (e) {} }); }

  async function openModal(name) {
    var modal = document.getElementById("modal");
    if (!modal) return;
    pauseAllSlots(); // silence the slot players while the modal plays
    document.getElementById("modalName").textContent = name;
    document.getElementById("modalGenres").textContent = "";
    document.getElementById("modalImg").style.display = "none";
    document.getElementById("modalBio").textContent = "Loading…";
    document.getElementById("modalPlayer").innerHTML = "";
    modal.hidden = false;

    var info = await fetchArtist(name);
    if (modal.hidden) return; // closed while loading
    var sp = info.spotify;
    var img = document.getElementById("modalImg");
    if (sp && sp.image) { img.src = sp.image; img.style.display = "block"; } else { img.style.display = "none"; }
    document.getElementById("modalName").textContent = (sp && sp.name) || info.name || name;
    document.getElementById("modalGenres").textContent = sp && sp.genres ? sp.genres.slice(0, 3).join(" · ") : "";
    document.getElementById("modalBio").textContent = info.bio || "No bio available.";
    document.getElementById("modalPlayer").innerHTML = (sp && sp.id)
      ? playerFrame(sp.id, 352)
      : '<div class="pl-empty">' + (info.configured === false ? "Add SPOTIFY_CLIENT_ID / SECRET in Netlify to enable playback." : "Not available on Spotify.") + "</div>";
  }
  function closeModal() {
    var modal = document.getElementById("modal");
    if (!modal) return;
    document.getElementById("modalPlayer").innerHTML = ""; // stop the modal player
    modal.hidden = true;
  }

  function seed(name) {
    nodes.clear(); edges.length = 0; edgeSet.clear();
    var n = getNode(name, null);
    if (isMobile()) { n.x = W * 0.42; n.y = H * 0.30; } else { n.x = cx; n.y = cy; }
    n.alpha = 1;
    focus(n);
    setTimeout(function () { expand(n); }, reduced ? 0 : 220);
  }

  // ── physics ─────────────────────────────────────────────────────────────────
  var REP = 13000, LINK_GAP = 64, LSPAN = 150, LK = 0.018, DAMP = 0.88, GRAV = 0, FOCUS_PULL = 0;
  var FOCUS_REP = 55000; // extra outward push from the centre node onto its branches
  var PADX = 34, PADY = 26;
  var drag = null, pan = null, pointers = {}, pinch = null; // pan/drag + multi-touch pinch

  function physics() {
    var arr = Array.from(nodes.values()), n = arr.length;
    var focusNode = focusName ? nodes.get(norm(focusName)) : null;
    var SCALE = sc(), LINKF = isMobile() ? 0.72 : 1; // shorter edges on mobile

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
        a.vx += ux * f * 0.016 * gg * SCALE; a.vy += uy * f * 0.016 * gg * SCALE;
        b.vx -= ux * f * 0.016 * gg * SCALE; b.vy -= uy * f * 0.016 * gg * SCALE;
      }
    }
    // the centre node pushes its neighbours/branches outward for breathing room
    if (focusNode && focusNode.aT > 0.001) {
      for (var fi = 0; fi < n; fi++) {
        var fnode = arr[fi];
        if (fnode === focusNode || fnode.aT <= 0.001) continue;
        var fdx = fnode.x - focusNode.x, fdy = fnode.y - focusNode.y, fd2 = fdx * fdx + fdy * fdy;
        if (fd2 < 900) fd2 = 900;
        var ff = FOCUS_REP / fd2, fd = Math.sqrt(fd2);
        fnode.vx += (fdx / fd) * ff * fnode.grow; fnode.vy += (fdy / fd) * ff * fnode.grow;
      }
    }
    edges.forEach(function (e) {
      if (e.a.aT <= 0.001 || e.b.aT <= 0.001) return;
      var dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) || 0.01;
      var target = ((e.a.w + e.b.w) / 2 + LINK_GAP + (1 - e.match) * LSPAN) * SCALE * LINKF;
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
    // hard keep-out: neighbours never sit under the centre player's footprint (desktop only)
    if (!isMobile() && focusNode && focusNode.aT > 0.001) {
      var rmin = playerRadius();
      for (var ki = 0; ki < n; ki++) {
        var kn = arr[ki];
        if (kn === focusNode || kn.aT <= 0.001) continue;
        var kdx = kn.x - focusNode.x, kdy = kn.y - focusNode.y, kd = Math.hypot(kdx, kdy) || 0.01;
        if (kd < rmin) { var pk = rmin - kd; kn.x += (kdx / kd) * pk; kn.y += (kdy / kd) * pk; }
      }
    }
    edges.forEach(function (e) { e.alpha += (e.aT - e.alpha) * 0.1; });
  }

  function collide(arr, n) {
    var SC = sc();
    for (var i = 0; i < n; i++) {
      var a = arr[i];
      if (a.aT <= 0.001) continue;
      for (var j = i + 1; j < n; j++) {
        var b = arr[j];
        if (b.aT <= 0.001) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var ag = a.grow, bg = b.grow, mg = Math.min(ag, bg);
        var ox = ((a.w * ag + b.w * bg) / 2 + PADX * mg) * SC - Math.abs(dx);
        var oy = ((a.h * ag + b.h * bg) / 2 + PADY * mg) * SC - Math.abs(dy);
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
      if (nd.name === focusName && !isMobile()) return; // desktop: centre is the DOM player
      var isFocus = nd.name === focusName, isHover = nd.name === hoverName;
      var s = (isHover ? 1.06 : 1) * nd.grow * sc();
      if (s < 0.02) return;
      var D = nodeSize();
      ctx.globalAlpha = isHover ? Math.max(nd.alpha, 0.9) : nd.alpha;
      ctx.save();
      ctx.translate(nd.x, nd.y);
      ctx.scale(s, s);
      var top = -nd.h / 2;
      // avatar (Spotify image, or a colored placeholder while it loads)
      ctx.save();
      roundRect(-D / 2, top, D, D, 12);
      ctx.clip();
      var img = getNodeImage(nd.name);
      if (img) ctx.drawImage(img, -D / 2, top, D, D);
      else { ctx.fillStyle = colorFor(nd); ctx.fillRect(-D / 2, top, D, D); }
      ctx.restore();
      // ring (focus / hover highlight)
      ctx.lineWidth = (isFocus ? 3 : isHover ? 2 : 1) / s;
      ctx.strokeStyle = isFocus ? CYAN_BRIGHT : isHover ? "rgba(143,248,236,.6)" : "rgba(255,255,255,.14)";
      roundRect(-D / 2, top, D, D, 12); ctx.stroke();
      // name
      ctx.fillStyle = "#e7e3da"; ctx.textAlign = "center"; ctx.font = "700 13px " + SANS;
      ctx.fillText(nd._label || nd.name, 0, top + D + 15);
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
  // The centre player floats just below the focus node (desktop); on mobile it's
  // a fixed bottom bar (CSS), so we clear the inline positioning there.
  function positionCenterPlayer() {
    var el = document.getElementById("pluginBottom");
    if (!el) return;
    if (isMobile()) { // mobile: fixed bottom bar (CSS positions it)
      el.style.display = "block"; el.style.left = ""; el.style.top = ""; el.style.transform = "";
      return;
    }
    var fn = focusName ? nodes.get(norm(focusName)) : null;
    if (!fn) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.style.left = fn.x + "px";
    el.style.top = fn.y + "px";
    el.style.transform = "translate(-50%, -50%)"; // desktop: the player IS the centre node
  }
  function loop() { physics(); render(); positionCenterPlayer(); requestAnimationFrame(loop); }

  // ── interaction ─────────────────────────────────────────────────────────────
  function pick(mx, my) {
    var hit = null, scale = sc(), pad = 10; // pad makes touch taps land reliably
    nodes.forEach(function (nd) {
      if (nd.aT <= 0.001) return; // can't click a disappeared node
      var hw = nd.w * scale / 2 + pad, hh = nd.h * scale / 2 + pad;
      if (mx >= nd.x - hw && mx <= nd.x + hw && my >= nd.y - hh && my <= nd.y + hh) hit = nd;
    });
    return hit;
  }
  function pointerDist() {
    var ids = Object.keys(pointers);
    if (ids.length < 2) return 0;
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  canvas.addEventListener("pointerdown", function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pointers).length === 2) { drag = null; pan = null; pinch = { dist: pointerDist() }; return; }
    var nd = pick(e.clientX, e.clientY);
    if (nd) drag = { node: nd, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, branched: false, thresh: e.pointerType === "touch" ? 12 : 5 };
    else pan = { x: e.clientX, y: e.clientY }; // grab empty space to move the whole group
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener("pointermove", function (e) {
    if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }
    if (pinch) { // two fingers → zoom the whole layout
      var d = pointerDist();
      if (d > 0 && pinch.dist > 0) { ZOOM = Math.max(0.45, Math.min(1.8, ZOOM * (d / pinch.dist))); pinch.dist = d; }
      return;
    }
    if (pan) {
      var pdx = e.clientX - pan.x, pdy = e.clientY - pan.y; pan.x = e.clientX; pan.y = e.clientY;
      nodes.forEach(function (nn) { nn.x += pdx; nn.y += pdy; });
      return;
    }
    hoverName = drag ? drag.node.name : (function () { var n = pick(e.clientX, e.clientY); return n ? n.name : null; })();
    canvas.style.cursor = hoverName ? "pointer" : "default";
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY; // physics moves the node to here
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > drag.thresh) drag.moved = true;
    var inRing = Math.hypot(e.clientX - cx, e.clientY - cy) < ringR;
    ringHot = inRing;
    if (inRing && !drag.branched) { drag.branched = true; expand(drag.node); focus(drag.node); pulseRing(); }
  });
  function onPointerUp(e) {
    delete pointers[e.pointerId];
    if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; return; }
    if (pan) { pan = null; return; }
    if (!drag) return;
    var d = drag; drag = null; ringHot = false;
    if (!d.moved) { expand(d.node); focus(d.node); } // a tap = branch + focus
  }
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
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
  // plugin clicks open the modal player; clicks on the embed iframe don't bubble,
  // so tapping a card's text opens the modal while the inline player stays usable.
  ["pluginsLeft", "pluginsRight", "pluginBottom"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function (e) {
      var p = e.target.closest(".plugin");
      if (p && p.dataset.artist) openModal(p.dataset.artist);
    });
  });
  var modalClose = document.getElementById("modalClose");
  var modalBackdrop = document.getElementById("modalBackdrop");
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
  addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  var subEl = document.getElementById("sub");
  if (subEl) subEl.textContent = "crowd similarity · " + (USE_API ? "last.fm live" : "demo data");
  doSeed("The Velvet Underground");
  requestAnimationFrame(loop);
})();
