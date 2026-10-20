// Boot: load the chosen map.json, validate it, build the scene and wire hover, click, navigation and the loop.
import './style.css';
import * as THREE from 'three';
import { parseMap } from './schema.js';
import rawMap from 'virtual:map';
import { computeHeights, layout, indexSections } from './model.js';
import { createScene, createBlocks } from './scene.js';
import { createSolutions, logoUrlFor, LOGO_PX } from './solutions.js';
import { createNav } from './nav.js';
import { createTooltip } from './tooltip.js';

const stage = document.querySelector('.stage');
const view = document.getElementById('view');
const fail = (msg) => {
  const e = document.createElement('div');
  e.className = 'err';
  e.textContent = msg;
  view.replaceChildren(e);
};

let map;
try {
  // The build reads and validates the MAP file (vite/seo-plugin.js); only that map is bundled.
  map = parseMap(rawMap);
} catch (e) {
  fail(e.message);
  throw e;
}
start(map);

function start(map) {
  document.title = map.title;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const logoUrl = (domain) => logoUrlFor(import.meta.env.BASE_URL, __LOGOS__, domain);
  const levelName = (level) => map.levels[3 - level];
  const cs = getComputedStyle(document.documentElement);
  const tok = (n) => cs.getPropertyValue(n).trim();
  const tokens = () => ({
    land: tok('--land'), landDeep: tok('--land-deep'), floor: tok('--floor'), floorLine: tok('--floor-line'),
    glow: tok('--glow'), glowEdge: tok('--glow-edge'), accent: tok('--accent'), ring: tok('--ring'), mini: tok('--mini'),
  });

  // Sections with children, each carrying its footprint and roof.
  const sections = indexSections(map);
  const rects = layout(map, computeHeights(map));
  for (const g of sections.values()) g.rect = rects.get(g.id);

  let s;
  try {
    s = createScene(view, tokens);
  } catch (e) {
    fail('This map needs WebGL, which this browser has turned off.');
    throw e;
  }
  const { renderer, scene, camera, controls } = s;
  const blocks = createBlocks(scene, sections, tokens);
  const state = { selected: null, pinned: null };
  let hovered = null, hoverInfo = null, pointer = null, downAt = null, fly = null;

  const activeKey = () => (hoverInfo && hoverInfo.kind === 'solution' ? hoverInfo.key : null) || state.pinned;
  const sols = createSolutions({ scene, map, sections, logoUrl, tokens, onLogo: () => { paintSolutions(); sols.drawLinks(activeKey(), true); } });
  const paintSolutions = () => sols.paint(activeKey());
  const paintPrisms = () => blocks.paint(hovered, state.selected && sections.get(state.selected));

  // Logos are at most a 40px touch target on screen, and smaller when the roofs need it.
  let logoCap = 4;
  function sizeLogos() {
    logoCap = LOGO_PX * (camera.top - camera.bottom) / (view.clientHeight * camera.zoom || 1);
    sols.place(logoCap);
    sols.drawLinks(activeKey(), true);
  }
  let lastZoom = 0;
  controls.addEventListener('change', () => {
    if (camera.zoom !== lastZoom) { lastZoom = camera.zoom; sizeLogos(); }
  });

  const tip = createTooltip(stage, { sections, levelName, logoUrl });
  const nav = createNav(document.getElementById('crumbs'), {
    map, sections, family: blocks.family, levelName, logoUrl, state,
    select: (id) => select(id), pin: (key) => pin(key),
  });
  // Mirror the UI state on <main> for tests and crawlers.
  function renderNav() {
    nav.render();
    stage.dataset.selected = state.selected || '';
    stage.dataset.pinned = state.pinned || '';
  }

  // The view never turns, so flying is a pan to the section, or back to the middle of the map.
  function flyTo(g) {
    const to = g ? new THREE.Vector3(g.rect.x, g.rect.top * 0.6, g.rect.z) : new THREE.Vector3(0, 4, 0);
    const offset = camera.position.clone().sub(controls.target);
    fly = { t0: performance.now(), fromT: controls.target.clone(), toT: to, fromP: camera.position.clone(), toP: to.clone().add(offset) };
  }
  function stepFly(now) {
    if (!fly) return;
    const t = reduceMotion ? 1 : Math.min(Math.max((now - fly.t0) / 800, 0), 1), e = 1 - Math.pow(1 - t, 3);
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    camera.position.lerpVectors(fly.fromP, fly.toP, e);
    if (t >= 1) fly = null;
  }

  function select(id, flyThere = true) {
    state.selected = id;
    paintPrisms();
    if (flyThere) flyTo(id ? sections.get(id) : null);
    renderNav();
  }
  function pin(key) {
    state.pinned = key;
    paintSolutions();
    sols.drawLinks(activeKey(), true);
    renderNav();
  }

  // ── Picking ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), cvs = renderer.domElement;
  const targets = [...sols.hitTargets, ...blocks.meshes];
  function pick(clientX, clientY) {
    const r = cvs.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData : null;
  }
  function hoverOn(info) {
    const g = info ? info.g : null;
    if (hovered !== g) { hovered = g; paintPrisms(); cvs.style.cursor = g ? 'pointer' : ''; }
    if (hoverInfo !== info) { hoverInfo = info; sols.drawLinks(activeKey()); paintSolutions(); }
    tip.show(pointer && info, nav.isOpen());
  }
  cvs.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; tip.move(pointer); });
  cvs.addEventListener('pointerleave', () => { pointer = null; tip.move(null); hoverOn(null); });
  cvs.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  cvs.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const info = pick(e.clientX, e.clientY);
    // A solution pins (or unpins) its links; a section is selected; empty background clears both, leaving the view where it is.
    if (info && info.kind === 'solution') pin(state.pinned === info.key ? null : info.key);
    else if (info) select(info.g.id);
    else { state.pinned = null; paintSolutions(); sols.drawLinks(activeKey(), true); select(null, false); }
  });

  // F goes full screen.
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'f' && e.key !== 'F') return;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });

  new ResizeObserver(() => { if (s.resize()) sizeLogos(); }).observe(view);
  s.resize();
  sizeLogos();
  paintPrisms();
  paintSolutions();
  renderNav();

  let frame = 0;
  renderer.setAnimationLoop((now) => {
    frame++;
    stepFly(now);
    controls.update();
    if (pointer && frame % 3 === 0) hoverOn(pick(pointer.x, pointer.y));
    renderer.render(scene, camera);
  });
}
