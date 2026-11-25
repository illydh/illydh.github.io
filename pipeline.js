// Hero pipeline graph.
//
// A small DAG drawn on a canvas: sources feed transforms, which feed a
// warehouse and its consumers. Records (dots) flow along the edges. Hovering
// or tapping a node lights its upstream and downstream lineage and shows a
// rows/s readout; with no pointer the selection cycles through nodes.
//
// Colours come from CSS custom properties on the canvas, so the graph follows
// the page theme. Motion stops when the graph is off screen, when the tab is
// hidden, when the visitor pauses it, and under prefers-reduced-motion.

const LAYOUTS = {
  // Left to right, for wide screens. Node centres in virtual units; fit()
  // scales them to the canvas.
  wide: {
    dir: "x",
    nodes: {
      api: [40, 60], s3: [40, 200], events: [40, 360],
      parse: [190, 60], dedupe: [190, 360],
      orders: [340, 130], sessions: [340, 360],
      warehouse: [500, 230], features: [500, 430],
      dashboard: [650, 230], model: [650, 430],
    },
  },
  // Top to bottom, for phones; the readout gets its own row underneath.
  tall: {
    dir: "y",
    nodes: {
      api: [50, 14], s3: [171, 14], events: [292, 14],
      parse: [50, 64], dedupe: [292, 64],
      orders: [100, 114], sessions: [250, 114],
      warehouse: [110, 164], features: [262, 164],
      dashboard: [110, 214], model: [262, 214],
    },
  },
};

const KINDS = {
  api: "source", s3: "source", events: "source",
  parse: "transform", dedupe: "transform", orders: "transform",
  sessions: "transform", features: "transform",
  warehouse: "sink", dashboard: "output", model: "output",
};

// [from, to, records per second]
const EDGES = [
  ["api", "parse", 1.6],
  ["parse", "orders", 1.6],
  ["s3", "orders", 0.9],
  ["orders", "warehouse", 2.4],
  ["events", "dedupe", 3.0],
  ["dedupe", "sessions", 2.6],
  ["sessions", "warehouse", 1.8],
  ["sessions", "features", 1.2],
  ["warehouse", "dashboard", 1.5],
  ["features", "model", 1.1],
];

const CYCLE = ["sessions", "orders", "features", "warehouse", "dedupe", "dashboard", "parse", "model"];
const CYCLE_MS = 3200;
const HOVER_RADIUS = 56;
const ROWS_PER_RECORD = 412; // readout scale: records/s on screen -> "rows/s"

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bez(e, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * e.p0[0] + b * e.c1[0] + c * e.c2[0] + d * e.p3[0],
    a * e.p0[1] + b * e.c1[1] + c * e.c2[1] + d * e.p3[1],
  ];
}

// Every node reachable upstream or downstream of `id`, plus `id`.
function lineageOf(id) {
  const lit = new Set([id]);
  const walk = (cur, up) => {
    for (const [a, b] of EDGES) {
      const next = up ? (b === cur ? a : null) : (a === cur ? b : null);
      if (next && !lit.has(next)) {
        lit.add(next);
        walk(next, up);
      }
    }
  };
  walk(id, true);
  walk(id, false);
  return lit;
}
const LINEAGE = Object.fromEntries(Object.keys(KINDS).map((id) => [id, lineageOf(id)]));

export function mountPipeline(canvas, { pauseButton } = {}) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const rand = rng(11);

  let W = 0, H = 0, dpr = 1;
  let L = LAYOUTS.wide, scale = 1, ox = 0, oy = 0, k = 1, readoutY = 0;
  let nodes = new Map();
  let edges = [];
  let colors = readColors();

  let selected = CYCLE[0];
  let cycleIndex = 0;
  let nextCycleAt = 0;
  let pointerOver = false;
  let pinnedUntil = 0;
  let readoutAlpha = 1;

  let visible = true;
  let userPaused = false;
  let raf = 0;
  let last = 0;
  let clock = 0;

  function readColors() {
    const s = getComputedStyle(canvas);
    const v = (name) => s.getPropertyValue(name).trim();
    return {
      edge: v("--edge"), record: v("--record"), node: v("--node"), nodeLine: v("--node-line"),
      glyph: v("--glyph"), ink: v("--ink"), lit: v("--lit"), accent: v("--accent"), accentInk: v("--accent-ink"),
    };
  }

  const font = () => `${Math.round((L.dir === "x" ? 12 : 11) * k * 10) / 10}px "Geist Mono", ui-monospace, monospace`;

  // Label width at k = 1 for a layout's type size.
  function labelWidth(layout, id) {
    ctx.font = `${layout.dir === "x" ? 12 : 11}px "Geist Mono", ui-monospace, monospace`;
    return ctx.measureText(id).width;
  }

  // Scale and offset so every node box, plus room for the readout, fits the
  // canvas. Positions scale with `scale`; boxes and type with `k`, which is
  // clamped, so the fit is solved a few times.
  function fit(layout) {
    const PAD = 4;
    const pts = Object.entries(layout.nodes);
    const xs = pts.map(([, p]) => p[0]), ys = pts.map(([, p]) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padW = layout.dir === "x" ? 40 : 30;
    const halfAt = (x) => Math.max(...pts.filter(([, p]) => p[0] === x).map(([id]) => (labelWidth(layout, id) + padW) / 2));
    const hl1 = halfAt(minX), hr1 = halfAt(maxX);
    const h1 = layout.dir === "x" ? 32 : 26;
    const below1 = 34; // readout under a node (wide) or in its own row (tall)
    const cap = layout.dir === "x" ? 1.15 : 1.35;
    let s = 1, kk = 1;
    for (let i = 0; i < 4; i++) {
      kk = Math.min(1.1, Math.max(0.88, s));
      const sx = (W - 2 * PAD - (hl1 + hr1) * kk) / (maxX - minX);
      const sy = (H - 2 * PAD - (h1 + below1) * kk) / (maxY - minY);
      s = Math.max(0.1, Math.min(sx, sy, cap));
    }
    kk = Math.min(1.1, Math.max(0.88, s));
    const usedW = (maxX - minX) * s + (hl1 + hr1) * kk;
    const usedH = (maxY - minY) * s + (h1 + below1) * kk;
    const left = (W - usedW) / 2, top = (H - usedH) / 2;
    return {
      L: layout, scale: s, k: kk,
      ox: left + hl1 * kk - minX * s,
      oy: top + (h1 / 2) * kk - minY * s,
      readoutY: top + usedH - 24 * kk,
    };
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const wide = fit(LAYOUTS.wide);
    const f = wide.scale >= 0.74 ? wide : fit(LAYOUTS.tall);
    ({ L, scale, k, ox, oy } = f);
    readoutY = f.readoutY;
    canvas.parentElement.dataset.layout = L.dir === "x" ? "wide" : "tall";

    ctx.font = font();
    const prev = nodes;
    nodes = new Map();
    for (const [id, [x, y]] of Object.entries(L.nodes)) {
      const h = (L.dir === "x" ? 32 : 26) * k;
      const w = (labelWidth(L, id) + (L.dir === "x" ? 40 : 30)) * k;
      const old = prev.get(id);
      nodes.set(id, {
        id, kind: KINDS[id], w, h,
        cx: ox + x * scale, cy: oy + y * scale,
        arrivals: old?.arrivals ?? [], rate: old?.rate ?? 0,
        on: old?.on ?? 1, lit: old?.lit ?? 0,
      });
    }

    const prevEdges = edges;
    edges = EDGES.map(([a, b, rate], i) => {
      const from = nodes.get(a), to = nodes.get(b);
      let p0, p3, c1, c2;
      if (L.dir === "x") {
        p0 = [from.cx + from.w / 2, from.cy];
        p3 = [to.cx - to.w / 2, to.cy];
        const d = (p3[0] - p0[0]) * 0.55;
        c1 = [p0[0] + d, p0[1]];
        c2 = [p3[0] - d, p3[1]];
      } else {
        p0 = [from.cx, from.cy + from.h / 2];
        p3 = [to.cx, to.cy - to.h / 2];
        const d = (p3[1] - p0[1]) * 0.55;
        c1 = [p0[0], p0[1] + d];
        c2 = [p3[0], p3[1] - d];
      }
      const e = { from, to, rate, p0, c1, c2, p3, len: 1, records: prevEdges[i]?.records ?? [], on: prevEdges[i]?.on ?? 1, lit: prevEdges[i]?.lit ?? 0 };
      let len = 0, prevPt = p0;
      for (let s = 1; s <= 24; s++) {
        const pt = bez(e, s / 24);
        len += Math.hypot(pt[0] - prevPt[0], pt[1] - prevPt[1]);
        prevPt = pt;
      }
      e.len = len;
      return e;
    });
  }

  // Advance records and throughput by dt seconds.
  function step(dt) {
    clock += dt;
    for (const e of edges) {
      if (rand() < e.rate * dt) e.records.push({ t: 0, v: 70 + rand() * 50 });
      let arrived = 0;
      for (const r of e.records) {
        r.t += (r.v * scale * dt) / e.len;
        if (r.t >= 1) arrived++;
      }
      if (arrived) {
        e.records = e.records.filter((r) => r.t < 1);
        for (let i = 0; i < arrived; i++) e.to.arrivals.push(clock);
      }
    }
    for (const n of nodes.values()) {
      while (n.arrivals.length && clock - n.arrivals[0] > 2) n.arrivals.shift();
      const target = n.kind === "source"
        ? EDGES.filter(([a]) => a === n.id).reduce((s, [, , r]) => s + r, 0)
        : n.arrivals.length / 2;
      n.rate += (target * ROWS_PER_RECORD - n.rate) * Math.min(1, dt * 1.5);
    }
  }

  // Ease highlight values toward the current selection. Returns true while
  // anything is still moving.
  function settle(dt, snap) {
    const lit = selected ? LINEAGE[selected] : null;
    const f = snap ? 1 : Math.min(1, dt * 12);
    let moving = false;
    const ease = (obj, on, l) => {
      const dOn = on - obj.on, dLit = l - obj.lit;
      obj.on += dOn * f;
      obj.lit += dLit * f;
      if (Math.abs(dOn) > 0.01 || Math.abs(dLit) > 0.01) moving = true;
    };
    for (const n of nodes.values()) {
      const inSet = !lit || lit.has(n.id);
      ease(n, inSet ? 1 : 0, lit && inSet ? 1 : 0);
    }
    for (const e of edges) {
      const inSet = !lit || (lit.has(e.from.id) && lit.has(e.to.id));
      ease(e, inSet ? 1 : 0, lit && inSet ? 1 : 0);
    }
    const dR = 1 - readoutAlpha;
    readoutAlpha += dR * (snap ? 1 : Math.min(1, dt * 8));
    if (dR > 0.01) moving = true;
    return moving;
  }

  function draw() {
    const g = ctx, c = colors;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // Edges: base stroke fading out as the lit stroke fades in.
    for (const e of edges) {
      const base = (0.3 + 0.6 * e.on) * (1 - e.lit);
      if (base > 0.01) {
        g.globalAlpha = base;
        g.strokeStyle = c.edge;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(...e.p0);
        g.bezierCurveTo(...e.c1, ...e.c2, ...e.p3);
        g.stroke();
      }
      if (e.lit > 0.01) {
        g.globalAlpha = 0.8 * e.lit;
        g.strokeStyle = c.lit;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(...e.p0);
        g.bezierCurveTo(...e.c1, ...e.c2, ...e.p3);
        g.stroke();
      }
    }

    // Records
    const rr = 2.6 * k;
    for (const e of edges) {
      g.globalAlpha = 0.28 + 0.72 * e.on;
      g.fillStyle = e.lit > 0.5 ? c.lit : c.record;
      for (const r of e.records) {
        const [x, y] = bez(e, r.t);
        g.beginPath();
        g.arc(x, y, rr, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Nodes
    g.font = font();
    g.textBaseline = "middle";
    const pad = (L.dir === "x" ? 14 : 10) * k;
    for (const n of nodes.values()) {
      const sel = n.id === selected;
      g.globalAlpha = 0.42 + 0.58 * n.on;
      const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
      g.fillStyle = c.node;
      g.strokeStyle = sel ? c.lit : c.nodeLine;
      g.lineWidth = sel ? 1.5 : 1;
      g.beginPath();
      g.roundRect(x, y, n.w, n.h, (L.dir === "x" ? 8 : 7) * k);
      g.fill();
      g.stroke();

      const gx = x + pad, gy = n.cy;
      g.fillStyle = n.lit > 0.5 ? c.lit : c.glyph;
      g.beginPath();
      const s = 3 * k;
      if (n.kind === "source") g.rect(gx - s, gy - s, s * 2, s * 2);
      else if (n.kind === "transform") g.arc(gx, gy, s * 1.07, 0, Math.PI * 2);
      else g.roundRect(gx - s, gy - s * 1.33, s * 2, s * 2.66, 1.5);
      g.fill();

      g.fillStyle = c.ink;
      g.fillText(n.id, gx + (L.dir === "x" ? 10 : 8) * k, n.cy + 0.5);
    }

    // Readout for the selected node
    if (selected) {
      const n = nodes.get(selected);
      const below = L.dir === "x";
      const txt = `${below ? "" : n.id + " · "}${Math.round(n.rate).toLocaleString("en-US")} rows/s`;
      const tw = g.measureText(txt).width + 20 * k;
      const th = 24 * k;
      let rx = below ? n.cx - tw / 2 : ox;
      let ry = below ? n.cy + n.h / 2 + 10 * k : readoutY;
      rx = Math.max(2, Math.min(W - tw - 2, rx));
      ry = Math.min(H - th - 2, ry);
      g.globalAlpha = readoutAlpha;
      g.fillStyle = c.accent;
      g.beginPath();
      g.roundRect(rx, ry, tw, th, 6 * k);
      g.fill();
      g.fillStyle = c.accentInk;
      g.fillText(txt, rx + 10 * k, ry + th / 2 + 0.5);
    }
    g.globalAlpha = 1;
  }

  function select(id) {
    if (id === selected) return;
    selected = id;
    readoutAlpha = 0;
    if (!animating()) renderStill();
  }

  function advanceCycle(now) {
    cycleIndex = (cycleIndex + 1) % CYCLE.length;
    select(CYCLE[cycleIndex]);
    nextCycleAt = now + CYCLE_MS;
  }

  const animating = () => visible && !userPaused && !reduce.matches && !document.hidden;

  function frame(now) {
    raf = 0;
    if (!animating()) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!pointerOver && now > pinnedUntil && now > nextCycleAt) advanceCycle(now);
    step(dt);
    settle(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  // Draw without motion; highlight changes still ease in.
  function renderStill() {
    let t0 = 0;
    const tick = (now) => {
      const dt = t0 ? (now - t0) / 1000 : 1 / 60;
      t0 = now;
      const moving = settle(dt, reduce.matches);
      draw();
      if (moving && !animating()) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function start() {
    if (animating()) {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      renderStill();
    }
  }

  function nodeAt(x, y, radius) {
    let best = null, bestD = radius;
    for (const n of nodes.values()) {
      const dx = Math.max(0, Math.abs(x - n.cx) - n.w / 2);
      const dy = Math.max(0, Math.abs(y - n.cy) - n.h / 2);
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const [x, y] = local(e);
    const n = nodeAt(x, y, HOVER_RADIUS);
    pointerOver = true;
    canvas.style.cursor = nodeAt(x, y, 4) ? "pointer" : "";
    if (n) select(n.id);
  });
  canvas.addEventListener("pointerleave", () => {
    pointerOver = false;
    nextCycleAt = performance.now() + 1500;
  });
  canvas.addEventListener("pointerdown", (e) => {
    const [x, y] = local(e);
    const n = nodeAt(x, y, e.pointerType === "mouse" ? 4 : 28);
    if (n) {
      select(n.id);
      pinnedUntil = performance.now() + 6000;
      nextCycleAt = pinnedUntil;
    }
  });

  new ResizeObserver(() => {
    layout();
    draw();
  }).observe(canvas);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(canvas);

  document.addEventListener("visibilitychange", start);
  reduce.addEventListener("change", start);
  document.addEventListener("themechange", () => {
    colors = readColors();
    draw();
  });

  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      userPaused = !userPaused;
      pauseButton.setAttribute("aria-pressed", String(userPaused));
      pauseButton.setAttribute("aria-label", userPaused ? "Play animation" : "Pause animation");
      document.documentElement.toggleAttribute("data-motion-paused", userPaused);
      start();
    });
  }

  // Fill the edges before the first paint so the graph never starts empty.
  layout();
  for (let i = 0; i < 360; i++) step(1 / 60);
  settle(0, true);
  draw();
  nextCycleAt = performance.now() + CYCLE_MS;
  start();

  // Text widths change once the mono face arrives.
  document.fonts?.load(`12px "Geist Mono"`).then(() => {
    layout();
    draw();
  });
}
