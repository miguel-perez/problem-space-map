// Solutions on tasks: a round logo badge on a flat drum coloured by the logo's main colour, held in a grid that
// stays inside the task's roof, and arcs joining every task the hovered or pinned solution appears on.
import * as THREE from 'three';

// Logos are at most a 40px touch target on screen, and smaller when the roofs need it.
export const LOGO_PX = 40, BASE_H = 0.25;
// In this isometric view two logos one step apart along x or z sit 0.82 steps apart on screen, so a step of
// 1.45 logos leaves a clear gap between them; the outer bases must still fit inside the roof.
export const GRID_STEP = 1.45, BASE_R = 0.66, SMALL_SCALE = 0.75;
const TAU = Math.PI * 2;

// Best grid for n logos clustered at the middle of a w × d roof.
export function gridFor(n, w, d) {
  let best = { L: 0, cols: 1, rows: n };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const L = Math.min(w / (GRID_STEP * (cols - 1) + 2 * BASE_R), d / (GRID_STEP * (rows - 1) + 2 * BASE_R));
    if (L > best.L) best = { L, cols, rows };
  }
  return best;
}

// The solutions on each task, specialist products first, then general tools.
export function unitsByTask(map) {
  const by = new Map();
  for (const sol of map.solutions) {
    for (const p of sol.placements) {
      if (!by.has(p.section)) by.set(p.section, []);
      by.get(p.section).push({ sol, use: p.use });
    }
  }
  for (const units of by.values()) units.sort((a, b) => (a.sol.kind === 'tool') - (b.sol.kind === 'tool'));
  return by;
}

export const solutionKey = (sol) => 'p:' + sol.name;

// The URL of a solution's logo, or null when public/logos has no file for its domain (the badge then shows the
// solution's initial, and nothing is requested, so no 404 reaches the console). logos: the file names in
// public/logos, listed at build time.
export function logoUrlFor(base, logos, domain) {
  const file = domain + '.png';
  return logos.includes(file) ? `${base}logos/${file}` : null;
}

// Chain each point to its nearest unvisited neighbour so the arcs read as one route, not a tangle.
export function chain(points) {
  const rest = [...points], path = rest.length ? [rest.shift()] : [];
  while (rest.length) {
    const last = path[path.length - 1];
    let bi = 0;
    rest.forEach((q, i) => { if (q.distanceTo(last) < rest[bi].distanceTo(last)) bi = i; });
    path.push(rest.splice(bi, 1)[0]);
  }
  return path;
}

// The logo's main colour: the most common strongly coloured pixel tone, or, for a mostly black or grey logo, its
// most common non-white tone.
function logoColor(img) {
  const n = 32, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, n, n);
  const px = ctx.getImageData(0, 0, n, n).data, vivid = new Map(), plain = new Map(), hsl = {}, c = new THREE.Color();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl);
    if (hsl.l > 0.93) continue;
    const bins = hsl.s > 0.35 && hsl.l > 0.12 && hsl.l < 0.88 ? vivid : plain;
    const k = (px[i] >> 5) << 6 | (px[i + 1] >> 5) << 3 | px[i + 2] >> 5, b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
    bins.set(k, b);
  }
  const top = [...(vivid.size ? vivid : plain).values()].sort((a, b) => b.n - a.n)[0];
  return top ? new THREE.Color().setRGB(top.r / top.n / 255, top.g / top.n / 255, top.b / top.n / 255, THREE.SRGBColorSpace) : null;
}

// tokens() returns the live CSS custom properties; onLogo runs when a logo arrives and its colour is known.
export function createSolutions({ scene, map, sections, logoUrl, tokens, onLogo }) {
  const badges = new Map();
  function paintBadge(e) {
    const ctx = e.ctx, ring = e.tone ? '#' + e.tone.getHexString() : tokens()[e.active ? 'accent' : 'ring'];
    ctx.clearRect(0, 0, 128, 128);
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = e.active ? 16 : 8; ctx.strokeStyle = ring; ctx.stroke();
    if (e.img) { ctx.save(); ctx.beginPath(); ctx.arc(64, 64, 50, 0, TAU); ctx.clip(); ctx.drawImage(e.img, 30, 30, 68, 68); ctx.restore(); }
    else { ctx.fillStyle = '#555'; ctx.font = '700 60px "Public Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.sol.name[0], 64, 68); }
    e.tex.needsUpdate = true;
  }
  function badgeMaterial(sol) {
    const key = solutionKey(sol);
    if (badges.has(key)) return badges.get(key).mat;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const entry = { mat, tex, ctx: canvas.getContext('2d'), img: null, tone: null, sol, key, active: false };
    badges.set(key, entry);
    paintBadge(entry);
    // Without a logo, or if it fails to load, the badge keeps the initial letter on a neutral ring.
    const src = logoUrl(sol.domain);
    if (src) {
      const img = new Image();
      img.onload = () => { entry.img = img; entry.tone = logoColor(img); paintBadge(entry); onLogo(); };
      img.onerror = () => {};
      img.src = src;
    }
    return mat;
  }

  const baseGeo = new THREE.CylinderGeometry(1, 1, 1, 48);
  baseGeo.translate(0, 0.5, 0);
  const group = new THREE.Group();
  scene.add(group);
  const minis = [];
  for (const [taskId, units] of unitsByTask(map)) {
    const g = sections.get(taskId);
    units.forEach(({ sol, use }, k) => {
      const unit = new THREE.Group();
      group.add(unit);
      // Every solution stands on a flat round base under its logo; general tools are drawn a little smaller.
      const plinth = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial());
      plinth.castShadow = plinth.receiveShadow = true;
      const stand = new THREE.Sprite(badgeMaterial(sol));
      unit.add(plinth, stand);
      const info = { kind: 'solution', key: solutionKey(sol), g, sol, use };
      plinth.userData = info; stand.userData = info;
      minis.push({ unit, plinth, stand, info, key: info.key, small: sol.kind === 'tool', g, k, of: units.length });
    });
  }
  const hitTargets = minis.flatMap((m) => [m.plinth, m.stand]);

  // Solutions on a task share one size: the largest at which the task holds them all in a grid on its roof
  // with no two overlapping on screen, capped at the touch-target size. Crowded tasks get smaller markers.
  function place(logoCap) {
    const grids = new Map();
    minis.forEach((m) => { if (!grids.has(m.g)) grids.set(m.g, gridFor(m.of, m.g.rect.w, m.g.rect.d)); });
    minis.forEach((m) => {
      const c = m.g.rect, q = grids.get(m.g), logo = Math.min(logoCap, q.L);
      // A short last row stays on the grid; shifting it half a step would bring logos closer on screen.
      const row = Math.floor(m.k / q.cols), step = GRID_STEP * logo;
      const x = c.x + (m.k % q.cols - (q.cols - 1) / 2) * step, z = c.z + (row - (q.rows - 1) / 2) * step;
      const size = logo * (m.small ? SMALL_SCALE : 1);
      // The base is a coloured drum wider than the badge and a quarter of its size tall, so its colour reads.
      const h = size * BASE_H;
      m.plinth.scale.set(size * BASE_R, h, size * BASE_R);
      m.stand.scale.setScalar(size);
      m.stand.position.y = h + size / 2 + 0.2;
      m.tip = h + size / 2 + 0.2;
      m.unit.position.set(x, c.top, z);
    });
  }

  // Active state: every place the hovered or pinned solution appears gets a thick rim and brighter base in its
  // own colour, matching its arcs. Each base takes its logo's main colour at full strength, with a little
  // self-glow so the shaded side stays vivid instead of greying out.
  function paint(activeKey) {
    const t = tokens();
    minis.forEach((m) => {
      const tone = badges.get(m.key).tone, c = m.plinth.material.color;
      if (tone) c.copy(tone); else c.set(t.mini);
      m.plinth.material.emissive.copy(c).multiplyScalar(m.key === activeKey ? 0.75 : 0.35);
    });
    badges.forEach((e) => {
      const active = activeKey === e.key;
      if (e.active !== active) { e.active = active; paintBadge(e); }
    });
  }
  const repaintBadges = () => badges.forEach(paintBadge);

  // Arcs take the solution's own colour, the same as its bases.
  const links = new THREE.Group();
  scene.add(links);
  let linked;
  function drawLinks(key, force = false) {
    if (key === linked && !force) return;
    linked = key;
    links.children.forEach((l) => { l.geometry.dispose(); l.material.dispose(); });
    links.clear();
    if (!key) return;
    const pts = minis.filter((m) => m.key === key).map((m) => m.unit.position.clone().setY(m.unit.position.y + m.tip));
    if (pts.length < 2) return;
    const path = chain(pts);
    const color = badges.get(key)?.tone || new THREE.Color(tokens().accent);
    // Arcs never write depth, so logos drawn after them stay on top.
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], mid = a.clone().lerp(b, 0.5);
      mid.y = Math.max(a.y, b.y) + 4 + a.distanceTo(b) * 0.25;
      const mat = new THREE.MeshBasicMaterial({ color, depthWrite: false });
      links.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 40, 0.35, 6), mat));
    }
  }

  return { hitTargets, place, paint, repaintBadges, drawLinks, count: minis.length };
}
