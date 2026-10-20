// Renderer, the fixed isometric camera, lights, the tiled floor and the section blocks with their highlight.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TILE = 10;
// Tasks on top take the land colour; each layer below is darker.
const DEPTH = { 1: 0, 2: 0.22, 3: 0.45 };
// Hovered and selected sections, with everything inside them, catch a light-blue light, the selection more strongly.
const GLOW = { hover: 0.16, selected: 0.28 };

export function createScene(view, tokens) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // One fixed isometric view: orthographic, looking down the (1, 1, 1) diagonal from the near corner.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 3000);
  camera.position.copy(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(600));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, 0);
  camera.position.add(controls.target);
  controls.enableDamping = true;
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 8;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };

  // Cool-neutral light, so only the logos carry colour: a white sun from the right lights the faces it reaches
  // and casts soft shadows from taller blocks onto lower ones; a grey sky fills the shade. The ground half of
  // the sky light is dark, so tops (lit by the full sky) stand clearly above the sides.
  scene.add(new THREE.HemisphereLight(0xeef2f7, 0x545961, 1.6));
  const sun = new THREE.DirectionalLight(0xfbfcff, 2.8);
  // About 50 degrees up: tops catch clearly more sun than sides, still low enough for readable shadows.
  sun.position.set(170, 270, -150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 700 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);

  // Ground floor: a lit plane tiled like a tileset. Square tiles read as the isometric diamonds of this view,
  // and the floor catches the blocks' shadows like everything else.
  const t = tokens();
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = floorCanvas.height = 256;
  const ctx = floorCanvas.getContext('2d'), n = floorCanvas.width;
  ctx.fillStyle = t.floor;
  ctx.fillRect(0, 0, n, n);
  // One line on the left and top edge of each tile, so neighbouring tiles share a single seam.
  ctx.fillStyle = t.floorLine;
  ctx.fillRect(0, 0, n, 4);
  ctx.fillRect(0, 0, 4, n);
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4000 / TILE, 4000 / TILE);
  floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  // Fit the whole map: about 300 units across or 210 tall, whichever the window needs.
  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    const aspect = w / h, tall = Math.max(210, 300 / aspect);
    camera.left = -tall * aspect / 2; camera.right = tall * aspect / 2; camera.top = tall / 2; camera.bottom = -tall / 2;
    camera.updateProjectionMatrix();
    return true;
  }

  return { renderer, scene, camera, controls, resize };
}

// One box per section, standing on the ground up to its roof. sections: Map<id, section with children and rect>.
export function createBlocks(scene, sections, tokens) {
  const t = tokens();
  const land = new THREE.Color(t.land), deep = new THREE.Color(t.landDeep), glow = new THREE.Color(t.glow);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(t.glowEdge) });
  const meshes = [];
  for (const g of sections.values()) {
    g.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial());
    g.mesh.castShadow = g.mesh.receiveShadow = true;
    // A thin outline, shown only while the block is highlighted. Nudged out a hair so it sits on the faces' edges.
    g.edge = new THREE.LineSegments(edgeGeo, edgeMat);
    g.edge.scale.setScalar(1.002);
    g.edge.visible = false;
    g.mesh.add(g.edge);
    g.mesh.userData = { kind: 'section', g };
    const r = g.rect;
    g.mesh.position.set(r.x, 0, r.z);
    g.mesh.scale.set(Math.max(r.w, 1e-3), Math.max(r.top, 1e-3), Math.max(r.d, 1e-3));
    scene.add(g.mesh);
    meshes.push(g.mesh);
  }

  const family = (g) => {
    const set = new Set();
    const walk = (x) => { set.add(x); x.children.forEach(walk); };
    if (g) walk(g);
    return set;
  };
  function paint(hovered, selected) {
    const hov = family(hovered), sel = family(selected);
    for (const g of sections.values()) {
      const m = g.mesh.material;
      m.color.copy(land).lerp(deep, DEPTH[g.level]);
      const k = Math.max(sel.has(g) ? GLOW.selected : 0, hov.has(g) ? GLOW.hover : 0);
      // A clear blue tint with a touch of added light, so it reads as lit without washing out.
      m.color.lerp(glow, k * 2);
      m.emissive.copy(glow).multiplyScalar(k * 0.35);
      g.edge.visible = k > 0;
    }
  }
  return { meshes, paint, family };
}
