// Lantern Garden: the visual world.
// A low-poly isometric conservatory diorama (three.js) with a flat, keyboard-friendly
// tile-button map that doubles as the WebGL-failure fallback. Presentation only:
// every rule about movement, success and blocking lives in the engine.
import * as THREE from 'three';
import { batchStaticScenery } from './batch-scenery.js';

const HEADINGS = Object.freeze([
  { name: 'north', dx: 0, dz: -1 },
  { name: 'east', dx: 1, dz: 0 },
  { name: 'south', dx: 0, dz: 1 },
  { name: 'west', dx: -1, dz: 0 }
]);

const TILE_TOP = 0.34;     // height of a walkable tile surface
const BANK_TOP = 0.43;     // height of the planted bank around the pond
const WATER_Y = 0.12;
const WALL_H = 2.5;
const MOVE_MS = 350;
const CAM_YAW = (28 * Math.PI) / 180;   // camera sits south-east of centre: north is up and back
const CAM_ELEV = (42 * Math.PI) / 180;
const CAM_TARGET = new THREE.Vector3(0, 0.45, 0);
const PIP_SCALE = 0.88;
const SVGNS = 'http://www.w3.org/2000/svg';

const PAL = {
  wood: 0x2d4b3f, woodDark: 0x223a30, brass: 0xd6a444, moss: 0x86b06a, mossDark: 0x6f9a58,
  poolFloor: 0x56a28c, water: 0xa4dfcd, clay: 0xc68a62, sand: 0xefe1b9, sandPad: 0xf6ebcb,
  copper: 0xe59a61, copperPad: 0xf3c49b, amber: 0xf4ae3b, amberPad: 0xffd780, amberGlow: 0xffd27a,
  forest: 0x2f5f49, ink: 0x24433a, terra: 0xe06a2c, terraDark: 0xb9501f, cream: 0xf5ecd4,
  trailPlate: 0xcfe5b4, trailPad: 0xb9db98, hover: 0xfff4cf
};
const LEAVES = [0x5f9a58, 0x4d8a52, 0x74a95c, 0x3f7a4c, 0x8dbb68, 0x6aa45a];

// Gentle identity per act (level.act 1..5, or lessonNumber 1..20 in fours): the same diorama and the
// same warm legibility; only the hour, the ironwork tint, the lantern count and one low prop change.
// Index 0 is the original look and is used for any level that carries no act information.
const ACT_THEMES = Object.freeze([
  { act: 0, sky: 0xf4fbe6, ground: 0xdcc79c, hemi: 1.55, sun: 0xfff0d2, sunI: 1.9, frame: 0x2f5a49, glow: 0.5, lanterns: 0, prop: null },
  { act: 1, sky: 0xf4fbe6, ground: 0xdcc79c, hemi: 1.55, sun: 0xfff0d2, sunI: 1.9, frame: 0x2f5a49, glow: 0.5, lanterns: 0, prop: null },
  { act: 2, sky: 0xf0fbdc, ground: 0xd6cf9e, hemi: 1.6, sun: 0xfff4d4, sunI: 1.9, frame: 0x2f5a49, glow: 0.5, lanterns: 0, prop: 'trays' },
  { act: 3, sky: 0xf7f3df, ground: 0xe0c9a0, hemi: 1.55, sun: 0xffe8c4, sunI: 1.95, frame: 0x37594a, glow: 0.5, lanterns: 1, prop: 'bench' },
  { act: 4, sky: 0xf8efd6, ground: 0xe2c394, hemi: 1.5, sun: 0xffdfb4, sunI: 2.0, frame: 0x37594a, glow: 0.56, lanterns: 2, prop: 'bench' },
  { act: 5, sky: 0xf3e4c4, ground: 0xcdb58a, hemi: 1.4, sun: 0xffd6a0, sunI: 1.65, frame: 0x2c4f42, glow: 0.7, lanterns: 4, prop: 'strings' }
]);
function themeFor(lv) {
  const raw = Number.isFinite(lv?.act) ? lv.act : Number.isFinite(lv?.lessonNumber) ? Math.ceil(lv.lessonNumber / 4) : 0;
  return ACT_THEMES[clamp(Math.round(raw), 0, ACT_THEMES.length - 1)];
}

// Nursery plants: dry olive and dusty soil become lush green and dark moist soil as doses arrive.
const PLANT_MAX = 8;
const LEAF_DRY = new THREE.Color(0xb3a55c);
const LEAF_LUSH = new THREE.Color(0x5aa254);
const SOIL_DRY = new THREE.Color(0xcdb386);
const SOIL_WET = new THREE.Color(0x4a3a2c);
const DOSE_FILL = 0x6fe3c4;

// ------------------------------------------------------------------ helpers

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.5; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const tileName = t => `${String.fromCharCode(65 + t.x)}${t.z + 1}`;
const keyOf = (x, z) => `${x},${z}`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unwrap a 0..3 heading so rotations always take the short way round.
function unwrapHeading(prev, h) {
  let d = h - (((prev % 4) + 4) % 4);
  if (d > 2) d -= 4;
  if (d < -1) d += 4;
  return prev + d;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgEl(tag, attrs = {}, className) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (className) node.setAttribute('class', className);
  return node;
}

function readFlatParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('flat') && params.get('flat') !== '0' && params.get('flat') !== 'false';
  } catch { return false; }
}

// Shared low-poly geometry and material kit, one per world.
function makeKit() {
  const geos = new Map();
  const mats = new Map();
  const geo = (key, make) => {
    let g = geos.get(key);
    if (!g) { g = make(); g.userData.shared = true; geos.set(key, g); }
    return g;
  };
  const mat = (key, make) => {
    let m = mats.get(key);
    if (!m) { m = make(); m.userData.shared = true; mats.set(key, m); }
    return m;
  };
  const kit = {
    box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
    cyl: n => geo(`cyl${n}`, () => new THREE.CylinderGeometry(1, 1, 1, n)),
    cone: n => geo(`cone${n}`, () => new THREE.CylinderGeometry(0, 1, 1, n)),
    taper: (n, r) => geo(`taper${n}:${r}`, () => new THREE.CylinderGeometry(1, r, 1, n)),
    ico: d => geo(`ico${d}`, () => new THREE.IcosahedronGeometry(1, d)),
    plane: () => geo('plane', () => new THREE.PlaneGeometry(1, 1)),
    custom: (key, make) => geo(key, make),
    jit: i => geos.get(`jit${((i % 4) + 4) % 4}`),
    flat: (color, extra) => mat(`f${color}${extra ? JSON.stringify(extra) : ''}`,
      () => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra })),
    phong: (color, extra) => mat(`p${color}${extra ? JSON.stringify(extra) : ''}`,
      () => new THREE.MeshPhongMaterial({ color, flatShading: true, ...extra })),
    basic: (color, extra) => mat(`b${color}${extra ? JSON.stringify(extra) : ''}`,
      () => new THREE.MeshBasicMaterial({ color, ...extra })),
    dispose() {
      for (const g of geos.values()) g.dispose();
      for (const m of mats.values()) m.dispose();
      geos.clear(); mats.clear();
    }
  };
  // a few jittered icospheres so foliage never looks stamped
  for (let i = 0; i < 4; i++) {
    kit.custom(`jit${i}`, () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + i * 4.1) * 43758.5453;
        const s = 1 + ((h - Math.floor(h)) - 0.5) * 0.36;
        p.setXYZ(k, x * s, y * s, z * s);
      }
      return g;
    });
  }
  return kit;
}

function put(parent, geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// A folded ribbon leaf that arcs along local +z. Used for ferns, palms and sprouts.
function leafGeometry({ segs = 4, length = 1, width = 0.3, a0 = 0.5, bend = 1, fold = 0.18 }) {
  const pos = [];
  const idx = [];
  let y = 0, z = 0;
  const ds = length / segs;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = a0 - bend * t;
    if (i > 0) { y += Math.sin(a) * ds; z += Math.cos(a) * ds; }
    const w = width * 0.5 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.85);
    const py = Math.cos(a), pz = -Math.sin(a);
    pos.push(-w, y, z, 0, y + py * fold * w * 2, z + pz * fold * w * 2, w, y, z);
  }
  for (let i = 0; i < segs; i++) {
    const b = i * 3;
    idx.push(b, b + 1, b + 3, b + 1, b + 4, b + 3, b + 1, b + 2, b + 4, b + 2, b + 5, b + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function heartLeafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.05);
  s.bezierCurveTo(0.3, -0.1, 0.5, 0.3, 0.18, 0.55);
  s.bezierCurveTo(0.1, 0.65, 0.04, 0.68, 0, 0.72);
  s.bezierCurveTo(-0.04, 0.68, -0.1, 0.65, -0.18, 0.55);
  s.bezierCurveTo(-0.5, 0.3, -0.3, -0.1, 0, 0.05);
  return new THREE.ShapeGeometry(s, 5);
}

function radialTexture(stops, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true;
  return t;
}

function labelTexture(name, tag) {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 192, 96);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(92, 58, 34, 0.78)';
  ctx.font = '700 42px ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
  ctx.fillText(name, 96, tag ? 34 : 48);
  if (tag) {
    ctx.font = '700 22px ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
    ctx.fillText(tag, 96, 72);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function disposeTree(root) {
  root.traverse(o => {
    if (o.isSprite) { if (o.material && !o.material.userData.shared) o.material.dispose(); return; }
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const m = o.material;
    if (m) {
      for (const mm of Array.isArray(m) ? m : [m]) {
        if (mm.userData.shared) continue;
        if (mm.map && !mm.map.userData.shared) mm.map.dispose();
        mm.dispose();
      }
    }
    if (o.isInstancedMesh) o.dispose();
  });
}

// ------------------------------------------------------------------ world

export function createWorld(container, { onTileSelect, reducedMotion = false, flatView } = {}) {
  const reduced = Boolean(reducedMotion);
  const forcedFlat = typeof flatView === 'boolean' ? flatView : readFlatParam();
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  let destroyed = false;
  let level = null;
  let lastState = null;
  let prediction = null;
  let flat = forcedFlat;
  let hoverKey = null;

  // ---- DOM: heading readout, tile map, note ------------------------------
  container.classList.add('world');
  const owned = [];
  const own = node => { owned.push(node); return node; };

  const heading = own(el('div', 'world-heading'));
  const dial = svgEl('svg', { viewBox: '0 0 88 88', 'aria-hidden': 'true', focusable: 'false' }, 'heading-dial');
  const dialRing = svgEl('polygon', {}, 'dial-ring');
  const dialLetters = HEADINGS.map((h, i) => {
    const t = svgEl('text', {}, i === 0 ? 'dial-letter is-north' : 'dial-letter');
    t.textContent = h.name[0].toUpperCase();
    return t;
  });
  const dialLine = svgEl('line', { x1: 44, y1: 44, x2: 44, y2: 30 }, 'dial-arrow-line');
  const dialHead = svgEl('polygon', {}, 'dial-arrow-head');
  const dialHub = svgEl('circle', { cx: 44, cy: 44, r: 4 }, 'dial-hub');
  dial.append(dialRing, ...dialLetters, dialLine, dialHead, dialHub);
  const words = el('div', 'heading-words');
  const kickerEl = el('span', 'heading-kicker', 'Pip faces');
  const nameEl = el('strong', 'heading-name', 'EAST');
  const tileEl = el('span', 'heading-tile', '');
  words.append(kickerEl, nameEl, tileEl);
  heading.append(dial, words);

  const tilemap = own(el('div', 'world-tilemap'));
  tilemap.setAttribute('role', 'group');
  const tilemapTitle = el('p', 'tilemap-title', '');
  const tilemapGrid = el('div', 'tilemap-grid');
  tilemap.append(tilemapTitle, tilemapGrid);

  const note = own(el('p', 'world-note'));
  note.hidden = true;
  note.setAttribute('role', 'note');

  container.append(heading, tilemap, note);
  owned.push(heading);

  // ---- tile map (real buttons) -----------------------------------------
  const buttons = new Map();
  let rover = null;
  let headTurn = 0;       // unwrapped heading for CSS rotation
  let flatReason = '';

  const isChoice = t => Array.isArray(level?.predictions) && level.predictions.some(p => p.x === t.x && p.z === t.z);
  const tileSet = new Map();

  function select(tile) {
    if (typeof onTileSelect === 'function') onTileSelect({ x: tile.x, z: tile.z });
  }

  function setRover(btn) {
    if (rover && rover !== btn) rover.tabIndex = -1;
    rover = btn;
    if (rover) rover.tabIndex = 0;
  }

  function buildTilemap() {
    buttons.clear();
    tilemapGrid.replaceChildren();
    rover = null;
    if (!level) return;
    const W = level.width, H = level.height;
    tilemapGrid.style.gridTemplateColumns = `16px repeat(${W}, var(--cell))`;
    tilemapGrid.append(el('span', 'tm-corner'));
    for (let x = 0; x < W; x++) {
      const c = el('span', 'tm-col', String.fromCharCode(65 + x));
      c.setAttribute('aria-hidden', 'true');
      tilemapGrid.append(c);
    }
    for (let z = 0; z < H; z++) {
      const r = el('span', 'tm-row', String(z + 1));
      r.setAttribute('aria-hidden', 'true');
      tilemapGrid.append(r);
      for (let x = 0; x < W; x++) {
        if (!tileSet.has(keyOf(x, z))) {
          const v = el('span', 'tm-void');
          v.setAttribute('aria-hidden', 'true');
          tilemapGrid.append(v);
          continue;
        }
        const b = el('button', 'tm-tile');
        b.type = 'button';
        b.tabIndex = -1;
        b.dataset.x = String(x);
        b.dataset.z = String(z);
        const nm = el('span', 'tm-name', tileName({ x, z }));
        const role = el('span', 'tm-role', '');
        const pipBox = el('span', 'tm-pip');
        pipBox.setAttribute('aria-hidden', 'true');
        const svg = svgEl('svg', { viewBox: '0 0 40 40' });
        svg.append(
          svgEl('polygon', { points: '20,4 33,32 20,26 7,32' }, 'pip-body'),
          svgEl('circle', { cx: 20, cy: 18, r: 3 }, 'pip-eye')
        );
        pipBox.append(svg);
        const plantBox = el('span', 'tm-plant');
        plantBox.setAttribute('aria-hidden', 'true');
        plantBox.hidden = true;
        b.append(nm, role, plantBox, pipBox);
        if (level.start.x === x && level.start.z === z) b.classList.add('is-start');
        if (level.goal.x === x && level.goal.z === z) b.classList.add('is-goal');
        if (isChoice({ x, z })) b.classList.add('is-choice');
        buttons.set(keyOf(x, z), b);
        tilemapGrid.append(b);
      }
    }
    const first = buttons.get(keyOf(level.start.x, level.start.z)) || buttons.values().next().value;
    setRover(first || null);
    refreshTilemap();
  }

  // ---- nursery plants (presentation only: the engine owns doses and readiness) ----
  // Current plants come from the latest engine state; before any state arrives, from the level.
  function plantList() {
    const src = Array.isArray(lastState?.plants) ? lastState.plants : Array.isArray(level?.plants) ? level.plants : [];
    const out = [];
    for (const p of src) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !tileSet.has(keyOf(p.x, p.z))) continue;
      out.push({
        x: p.x, z: p.z,
        need: clamp(Math.round(Number(p.need)) || 1, 1, PLANT_MAX),
        water: Math.max(0, Math.round(Number(p.water)) || 0)
      });
    }
    return out;
  }
  const plantReady = p => p.water >= p.need;
  const plantMood = p => (plantReady(p) ? 'restored and flowering' : p.water === 0 ? 'dry' : 'still thirsty');
  const plantLabel = p => `plant, ${p.water} of ${p.need} water doses, ${plantMood(p)}`;

  function paintPlantMarker(box, p) {
    if (!p) { box.hidden = true; box.dataset.sig = ''; return; }
    box.hidden = false;
    const sig = `${p.water}/${p.need}`;
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    const leaf = svgEl('svg', { viewBox: '0 0 12 12', focusable: 'false' }, 'tm-leaf');
    leaf.append(svgEl('path', { d: 'M6 11 V6 M6 7 C2 7 1 4 1 2 C4 2 6 3 6 6 M6 6 C6 3 8 1 11 1 C11 4 9 6 6 6' }));
    const kids = p.need <= 2 && !plantReady(p) ? [leaf] : [];
    if (p.need <= 2) {
      for (let i = 0; i < p.need; i++) kids.push(el('span', i < p.water ? 'tm-dose is-full' : 'tm-dose'));
    } else {
      kids.push(el('span', 'tm-plant-count', `${p.water}/${p.need}`));
    }
    if (plantReady(p)) kids.push(el('span', 'tm-plant-ok', '✓'));
    box.replaceChildren(...kids);
  }

  function refreshTilemap() {
    if (!level) return;
    const plants = new Map(plantList().map(p => [keyOf(p.x, p.z), p]));
    const state = lastState;
    const here = state ? keyOf(state.x, state.z) : keyOf(level.start.x, level.start.z);
    const h = ((state ? state.heading : level.start.heading) % 4 + 4) % 4;
    const dirName = HEADINGS[h].name;
    const trail = new Set((state?.trail || []).map(t => keyOf(t.x, t.z)));
    const hasChoices = Array.isArray(level.predictions);
    for (const [key, b] of buttons) {
      const x = Number(b.dataset.x), z = Number(b.dataset.z);
      const isHere = key === here;
      const isStart = level.start.x === x && level.start.z === z;
      const isGoal = level.goal.x === x && level.goal.z === z;
      b.classList.toggle('is-here', isHere);
      b.classList.toggle('is-trail', !isHere && trail.has(key) && !isStart && !isGoal);
      const parts = [`Tile ${tileName({ x, z })}`];
      if (isStart) parts.push('start dock');
      if (isGoal) parts.push('amber relay');
      const plant = plants.get(key);
      if (plant) parts.push(plantLabel(plant));
      b.classList.toggle('has-plant', Boolean(plant));
      b.classList.toggle('is-plant-dry', Boolean(plant && plant.water === 0));
      b.classList.toggle('is-plant-ready', Boolean(plant && plantReady(plant)));
      paintPlantMarker(b.querySelector('.tm-plant'), plant);
      if (isHere) parts.push(`Pip is here, facing ${dirName}`);
      else if (trail.has(key) && !isStart) parts.push('Pip has crossed this tile');
      if (isChoice({ x, z })) parts.push('marked tile');
      const predicted = prediction && prediction.x === x && prediction.z === z;
      if (hasChoices && isChoice({ x, z })) b.setAttribute('aria-pressed', String(Boolean(predicted)));
      else if (predicted) b.setAttribute('aria-pressed', 'true');
      else b.removeAttribute('aria-pressed');
      if (predicted) parts.push('your prediction');
      b.setAttribute('aria-label', parts.join(', '));
      b.querySelector('.tm-role').textContent = isHere ? 'Pip' : isGoal ? 'Relay' : isStart ? 'Dock' : '';
      if (isHere) b.style.setProperty('--turn', String(headTurn));
    }
    tilemap.setAttribute('aria-label', `Garden tiles, north at the top. Pip faces ${dirName}.`);
    tilemapTitle.textContent = `Tile map · north is up · Pip faces ${dirName}`;
  }

  function neighbor(x, z, dx, dz) {
    let nx = x + dx, nz = z + dz;
    while (nx >= 0 && nx < level.width && nz >= 0 && nz < level.height) {
      if (tileSet.has(keyOf(nx, nz))) return buttons.get(keyOf(nx, nz));
      nx += dx; nz += dz;
    }
    return null;
  }

  on(tilemapGrid, 'click', e => {
    const b = e.target.closest?.('.tm-tile');
    if (!b || !tilemapGrid.contains(b)) return;
    setRover(b);
    select({ x: Number(b.dataset.x), z: Number(b.dataset.z) });
  });
  on(tilemapGrid, 'keydown', e => {
    const b = e.target.closest?.('.tm-tile');
    if (!b || e.altKey || e.ctrlKey || e.metaKey) return;
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = neighbor(Number(b.dataset.x), Number(b.dataset.z), d[0], d[1]);
    if (next) { setRover(next); next.focus(); }
  });
  on(tilemapGrid, 'focusin', e => {
    const b = e.target.closest?.('.tm-tile');
    if (!b) return;
    setRover(b);
    setHover(keyOf(Number(b.dataset.x), Number(b.dataset.z)));
  });
  on(tilemap, 'focusout', e => {
    if (!tilemap.contains(e.relatedTarget)) setHover(null);
  });

  // ---- heading readout ---------------------------------------------------
  const _v = new THREE.Vector3();
  let cameraReady = false;

  function screenDir(h) {
    const d = HEADINGS[h];
    if (!renderer || flat || !cameraReady) return [d.dx, d.dz];
    _v.set(d.dx, 0, d.dz).transformDirection(camera.matrixWorldInverse);
    return [_v.x, -_v.y];
  }

  function updateReadout() {
    const state = lastState;
    const h = ((state ? state.heading : level ? level.start.heading : 1) % 4 + 4) % 4;
    const at = state || level?.start;
    nameEl.textContent = HEADINGS[h].name.toUpperCase();
    tileEl.textContent = at ? `Tile ${tileName(at)}` : '';
    heading.setAttribute('aria-hidden', flat ? 'false' : 'true');
    // the dial lies flat on the garden floor, so it foreshortens exactly like the world
    const E = screenDir(1), S = screenDir(2);
    const R = 25;
    const pts = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      pts.push(`${(44 + R * (Math.cos(a) * E[0] + Math.sin(a) * S[0])).toFixed(1)},${(44 + R * (Math.cos(a) * E[1] + Math.sin(a) * S[1])).toFixed(1)}`);
    }
    dialRing.setAttribute('points', pts.join(' '));
    dialLetters.forEach((t, i) => {
      const v = screenDir(i);
      t.setAttribute('x', (44 + v[0] * 35).toFixed(1));
      t.setAttribute('y', (44 + v[1] * 35).toFixed(1));
    });
    const v = screenDir(h);
    const len = Math.hypot(v[0], v[1]) || 1;
    const ux = v[0] / len, uy = v[1] / len;
    const tip = [44 + v[0] * R, 44 + v[1] * R];
    const base = [tip[0] - ux * 10, tip[1] - uy * 10];
    dialLine.setAttribute('x2', base[0].toFixed(1));
    dialLine.setAttribute('y2', base[1].toFixed(1));
    dialHead.setAttribute('points', [
      tip.map(n => n.toFixed(1)).join(','),
      `${(base[0] - uy * 6).toFixed(1)},${(base[1] + ux * 6).toFixed(1)}`,
      `${(base[0] + uy * 6).toFixed(1)},${(base[1] - ux * 6).toFixed(1)}`
    ].join(' '));
  }

  // ---- WebGL state -------------------------------------------------------
  let renderer = null, canvas = null, scene = null, camera = null;
  let kit = null;
  let worldGroup = null, levelGroup = null, levelState = null;
  let glowTex = null, shadowTex = null;
  let pointLight = null;
  let hemiLight = null, sunLight = null;
  let theme = ACT_THEMES[0];
  let motes = null;
  let pip = null;
  let predMarker = null;
  let pixelRatio = 1;
  let raf = 0, lastTime = 0, clock = 0, onScreen = true, framesSeen = 0, slowFrames = 0, quality = 2;
  let io = null, ro = null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tiles = new Map();
  let pickables = [];
  let bounds = null;

  function showNote(text) {
    note.textContent = text;
    note.hidden = !text;
  }

  function applyFlatClass() {
    container.classList.toggle('is-flat', flat);
    container.classList.toggle('is-3d', !flat);
  }

  function initGL() {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    } catch { renderer = null; return false; }
    const ctx = renderer.getContext();
    if (!ctx || (ctx.isContextLost && ctx.isContextLost())) {
      renderer.dispose(); renderer = null; return false;
    }
    canvas = renderer.domElement;
    canvas.className = 'world-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    renderer.setClearColor(0x000000, 0);
    container.insertBefore(canvas, container.firstChild);
    kit = makeKit();
    glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    shadowTex = radialTexture([[0, 'rgba(24,52,40,0.55)'], [0.6, 'rgba(24,52,40,0.22)'], [1, 'rgba(24,52,40,0)']]);
    buildScene();
    return true;
  }

  // ---- static scene ------------------------------------------------------
  function buildScene() {
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 1, 140);
    hemiLight = new THREE.HemisphereLight(0xf4fbe6, 0xdcc79c, 1.55);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff0d2, 1.9);
    sunLight.position.set(-3, 6, 4);
    scene.add(sunLight);
    pointLight = new THREE.PointLight(0xffa63a, 0.9, 4.2, 2);

    worldGroup = new THREE.Group();
    scene.add(worldGroup);
    worldGroup.add(pointLight); // Relay coordinates share the centred world transform.

    // drifting fireflies and pollen
    const count = 30;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const m = new THREE.PointsMaterial({
      map: glowTex, color: 0xffb94a, size: 15, sizeAttenuation: false,
      transparent: true, opacity: 0.85, depthWrite: false
    });
    motes = new THREE.Points(g, m);
    motes.frustumCulled = false;
    motes.userData.seeds = Array.from({ length: count }, (_, i) => ({ a: i * 2.399, b: (i * 0.618) % 1, c: 0.4 + ((i * 0.37) % 1) }));
    worldGroup.add(motes);

    buildPip();
    buildPredictionMarker();
  }

  function buildPredictionMarker() {
    predMarker = group(worldGroup, 0, 0, 0);
    predMarker.visible = false;
    put(predMarker, kit.cyl(6), kit.flat(0x3a4a42), 0.34, 0.71, -0.34, 0.016, 0.8, 0.016);
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0); flagShape.lineTo(0.32, -0.09); flagShape.lineTo(0, -0.18);
    const flagGeo = kit.custom('flag', () => new THREE.ShapeGeometry(flagShape));
    const flag = put(predMarker, flagGeo, kit.flat(PAL.forest, { side: THREE.DoubleSide }), 0.35, 1.06, -0.34);
    put(predMarker, kit.ico(0), kit.basic(PAL.amber), 0.34, 1.12, -0.34, 0.035);
    predMarker.userData.flag = flag;
    const frame = new THREE.Mesh(
      kit.custom('frameRing', () => new THREE.RingGeometry(0.43, 0.5, 4, 1)),
      kit.basic(PAL.terra, { side: THREE.DoubleSide })
    );
    frame.rotation.x = -Math.PI / 2;
    frame.rotation.z = Math.PI / 4;
    frame.position.y = 0.318;
    predMarker.add(frame);
    predMarker.userData.frame = frame;
  }

  // ---- Pip, the little repair robot -------------------------------------
  function buildPip() {
    const M = {
      terra: kit.flat(PAL.terra), terraD: kit.flat(PAL.terraDark), cream: kit.flat(PAL.cream),
      ink: kit.flat(PAL.ink), brass: kit.phong(0xe0aa42, { shininess: 70, specular: 0x886622 }),
      glass: kit.phong(0x142c25, { shininess: 90, specular: 0x88aa99 }),
      eye: kit.basic(0xffd883), lamp: kit.basic(0xffb23a),
      leaf: kit.flat(0x6aa95a, { side: THREE.DoubleSide })
    };
    const root = group(worldGroup);
    root.scale.setScalar(PIP_SCALE);

    const shadow = new THREE.Mesh(kit.plane(), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.014;
    shadow.scale.set(0.8, 0.8, 1);
    shadow.renderOrder = 2;
    root.add(shadow);

    const yawG = group(root);

    // heading ring and pointer painted on the tile: this is where "forward" is
    const ringMat = new THREE.MeshBasicMaterial({ color: PAL.terra, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(kit.custom('pipRing', () => new THREE.RingGeometry(0.3, 0.355, 28)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    yawG.add(ring);
    const tri = (s, tipY, baseY, half) => {
      const sh = new THREE.Shape();
      sh.moveTo(0, tipY); sh.lineTo(half, baseY); sh.lineTo(-half, baseY);
      return sh;
    };
    const pointerOutline = new THREE.Mesh(kit.custom('ptrOut', () => new THREE.ShapeGeometry(tri(1, 0.56, 0.3, 0.17))), kit.basic(PAL.ink, { side: THREE.DoubleSide }));
    pointerOutline.rotation.x = -Math.PI / 2; pointerOutline.position.y = 0.022;
    const pointer = new THREE.Mesh(kit.custom('ptr', () => new THREE.ShapeGeometry(tri(1, 0.5, 0.33, 0.12))), kit.basic(PAL.amber, { side: THREE.DoubleSide }));
    pointer.rotation.x = -Math.PI / 2; pointer.position.y = 0.026;
    yawG.add(pointerOutline, pointer);

    // hovering arrow above the head
    const arrowG = group(yawG, 0, 1.2, -0.02);
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.22); arrowShape.lineTo(0.13, 0.04); arrowShape.lineTo(0.05, 0.04); arrowShape.lineTo(0.05, -0.15);
    arrowShape.lineTo(-0.05, -0.15); arrowShape.lineTo(-0.05, 0.04); arrowShape.lineTo(-0.13, 0.04); arrowShape.lineTo(0, 0.22);
    const arrowOutline = new THREE.Mesh(kit.custom('arrowGeo', () => new THREE.ShapeGeometry(arrowShape)), kit.basic(PAL.ink, { side: THREE.DoubleSide }));
    arrowOutline.rotation.x = -Math.PI / 2; arrowOutline.scale.set(1.3, 1.26, 1); arrowOutline.position.y = -0.004;
    const arrowFill = new THREE.Mesh(kit.custom('arrowGeo', () => new THREE.ShapeGeometry(arrowShape)), kit.basic(PAL.terra, { side: THREE.DoubleSide }));
    arrowFill.rotation.x = -Math.PI / 2;
    arrowG.add(arrowOutline, arrowFill);

    const rig = group(yawG);

    // legs: pivot at the hip, swing while walking
    const legs = [-1, 1].map(s => {
      const pv = group(rig, s * 0.095, 0.2, 0);
      put(pv, kit.cyl(6), M.cream, 0, -0.08, 0, 0.04, 0.16, 0.04);
      put(pv, kit.box(), M.ink, 0, -0.175, -0.03, 0.13, 0.055, 0.2);
      return pv;
    });
    put(rig, kit.cyl(8), M.ink, 0, 0.215, 0, 0.16, 0.05, 0.14).rotation.y = Math.PI / 8;

    // torso: terracotta octagon, cream belt, chest panel with a charge lamp
    put(rig, kit.taper(8, 0.84), M.terra, 0, 0.37, 0, 0.19, 0.3, 0.17).rotation.y = Math.PI / 8;
    put(rig, kit.cyl(8), M.cream, 0, 0.345, 0, 0.2, 0.04, 0.178).rotation.y = Math.PI / 8;
    put(rig, kit.box(), M.cream, 0, 0.42, -0.158, 0.14, 0.1, 0.02);
    const lamp = put(rig, kit.cyl(8), M.lamp, 0, 0.42, -0.171, 0.028, 0.012, 0.028);
    lamp.rotation.x = Math.PI / 2;

    // backpack with a turning gear and a little wrench
    put(rig, kit.box(), M.terraD, 0, 0.38, 0.19, 0.2, 0.2, 0.08);
    const gear = group(rig, 0.115, 0.4, 0.19);
    put(gear, kit.cyl(8), M.brass, 0, 0, 0, 0.065, 0.026, 0.065).rotation.z = Math.PI / 2;
    put(gear, kit.box(), M.brass, 0, 0, 0, 0.026, 0.03, 0.12);
    const wrench = group(rig, -0.07, 0.4, 0.24);
    wrench.rotation.z = 0.35;
    put(wrench, kit.box(), M.cream, 0, 0.14, 0, 0.022, 0.26, 0.016);
    const ringGeo = kit.custom('wrenchRing', () => new THREE.TorusGeometry(0.04, 0.013, 5, 8));
    put(wrench, ringGeo, M.brass, 0, 0.29, 0, 1);

    // arms
    const arms = [-1, 1].map(s => {
      put(rig, kit.ico(0), M.ink, s * 0.2, 0.47, 0, 0.062);
      const pv = group(rig, s * 0.235, 0.47, 0);
      put(pv, kit.cyl(6), M.cream, 0, -0.085, 0, 0.032, 0.17, 0.032);
      put(pv, kit.ico(1), M.ink, 0, -0.19, 0, 0.056);
      return pv;
    });

    put(rig, kit.cyl(6), M.ink, 0, 0.545, 0, 0.055, 0.06, 0.055);

    // head: octagon, glass visor, lamp eyes, brass cheek bolts, seedling, antenna
    const head = group(rig, 0, 0.69, 0);
    put(head, kit.cyl(8), M.terra, 0, 0, 0, 0.21, 0.2, 0.18).rotation.y = Math.PI / 8;
    put(head, kit.box(), M.glass, 0, 0.012, -0.168, 0.28, 0.12, 0.03);
    const eyes = [-1, 1].map(s => {
      const g = group(head, s * 0.066, 0.016, -0.186);
      put(g, kit.cyl(8), M.eye, 0, 0, 0, 0.034, 0.012, 0.034).rotation.x = Math.PI / 2;
      return g;
    });
    put(head, kit.box(), M.cream, 0, -0.068, -0.166, 0.07, 0.014, 0.012);
    for (const s of [-1, 1]) put(head, kit.cyl(8), M.brass, s * 0.215, 0, 0, 0.058, 0.04, 0.058).rotation.z = Math.PI / 2;
    put(head, kit.cyl(8), M.ink, 0, 0.1, 0, 0.085, 0.022, 0.075);
    const sprout = group(head, -0.05, 0.11, 0.02);
    put(sprout, kit.cyl(4), M.leaf, 0, 0.05, 0, 0.009, 0.1, 0.009);
    const sproutLeaf = kit.custom('sproutLeaf', () => leafGeometry({ segs: 3, length: 0.13, width: 0.08, a0: 0.55, bend: 0.9, fold: 0.1 }));
    for (const r of [0.8, -1.4]) {
      const lp = group(sprout, 0, 0.1, 0);
      lp.rotation.y = r;
      put(lp, sproutLeaf, M.leaf, 0, 0, 0);
    }
    const antenna = group(head, 0.09, 0.1, 0.05);
    put(antenna, kit.cyl(4), M.cream, 0, 0.07, 0, 0.01, 0.14, 0.01);
    const bulb = put(antenna, kit.ico(1), M.lamp, 0, 0.16, 0, 0.042);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc062, transparent: true, opacity: 0.55, depthWrite: false }));
    halo.scale.setScalar(0.3);
    halo.position.set(0, 0.16, 0);
    antenna.add(halo);

    pip = {
      root, yawG, rig, head, legs, arms, antenna, eyes, gear, lamp, bulb, halo, shadow, ring, ringMat, arrowG, wrench,
      pickMeshes: [], x: 0, z: 0, yaw: 0, tx: 0, tz: 0, tyaw: 0, turn: 0,
      anim: null, hasTarget: false, sig: '', status: 'idle',
      mood: { armsUp: 0, shrug: 0, glow: 0 }, moodT: { armsUp: 0, shrug: 0, glow: 0 },
      gearSpin: 0
    };
    root.traverse(o => { if (o.isMesh && o.geometry && o !== shadow && o !== ring) { o.userData.pip = true; pip.pickMeshes.push(o); } });
  }

  // ---- level scenery -----------------------------------------------------
  function buildLevel(lv) {
    if (levelGroup) {
      worldGroup.remove(levelGroup);
      disposeTree(levelGroup);
    }
    tiles.clear();
    pickables = [];
    const L = group(null);
    levelGroup = L;
    worldGroup.add(L);
    const state = {
      group: L, sways: [], lilies: [], ripples: [], lanterns: [], flowers: [], glows: [],
      goal: null, decor: group(L), dockPost: null, plants: new Map()
    };
    levelState = state;

    const W = lv.width, H = lv.height;
    const rng = mulberry32((Math.imul((lv.scenerySeed | 0) + 17, 2654435761) ^ 0x9e3779b9) >>> 0);
    const B = kit.box();
    const M0 = 0.62, M1 = 1.5;
    const minX = -0.5, maxX = W - 0.5, minZ = -0.5, maxZ = H - 0.5;
    const ox0 = minX - M1, ox1 = maxX + M1, oz0 = minZ - M1, oz1 = maxZ + M1;
    const ix0 = minX - M0, ix1 = maxX + M0, iz0 = minZ - M0, iz1 = maxZ + M0;
    const cx = (W - 1) / 2, cz = (H - 1) / 2;
    worldGroup.position.set(-cx, 0, -cz);

    bounds = {
      hx: (ox1 - ox0) / 2, hz: (oz1 - oz0) / 2,
      points: []
    };
    const hx = bounds.hx, hz = bounds.hz, top = BANK_TOP + WALL_H + 0.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      bounds.points.push(new THREE.Vector3(sx * hx, -0.85, sz * hz), new THREE.Vector3(sx * hx, 0.5, sz * hz));
    }
    bounds.points.push(new THREE.Vector3(-hx, top, -hz), new THREE.Vector3(-hx, top, hz), new THREE.Vector3(hx, top, -hz));

    // ground blob under the whole diorama
    const baseShadow = new THREE.Mesh(kit.plane(), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    baseShadow.rotation.x = -Math.PI / 2;
    baseShadow.position.set(cx, -0.92, cz);
    baseShadow.scale.set((ox1 - ox0) * 1.28, (oz1 - oz0) * 1.28, 1);
    L.add(baseShadow);

    // tray: planter box that holds the pond and the bank
    const wood = kit.flat(PAL.wood), woodDark = kit.flat(PAL.woodDark), brass = kit.phong(PAL.brass, { shininess: 60, specular: 0x665522 });
    const mossMat = kit.flat(PAL.moss);
    put(L, B, woodDark, (ox0 + ox1) / 2, -0.525, (oz0 + oz1) / 2, ox1 - ox0, 0.35, oz1 - oz0);
    for (const fx of [ox0 + 0.35, ox1 - 0.35]) for (const fz of [oz0 + 0.35, oz1 - 0.35]) put(L, B, brass, fx, -0.78, fz, 0.34, 0.14, 0.34);
    const floor = put(L, kit.plane(), kit.flat(PAL.poolFloor), (ix0 + ix1) / 2, -0.349, (iz0 + iz1) / 2, ix1 - ix0, iz1 - iz0, 1);
    floor.rotation.x = -Math.PI / 2;
    const water = put(L, kit.plane(), kit.phong(PAL.water, { transparent: true, opacity: 0.72, shininess: 90, specular: 0xffffff, depthWrite: false }),
      (ix0 + ix1) / 2, WATER_Y, (iz0 + iz1) / 2, ix1 - ix0, iz1 - iz0, 1);
    water.rotation.x = -Math.PI / 2;
    water.renderOrder = 1;

    const strip = (x0, x1, z0, z1, extendZ) => {
      const w = x1 - x0, d = z1 - z0, sx = (x0 + x1) / 2, sz = (z0 + z1) / 2;
      put(L, B, wood, sx, -0.025, sz, w, 0.65, d);
      put(L, B, brass, sx, 0.325 + (extendZ ? 0.0005 : 0), sz, w + 0.06, 0.05, d + 0.06);
      const e = extendZ ? 0.06 : 0;
      put(L, B, mossMat, sx, 0.39, sz, w - 0.12, 0.08, d - 0.12 + e * 2);
    };
    strip(ox0, ox1, oz0, iz0, false);       // north bank
    strip(ox0, ox1, iz1, oz1, false);       // south bank
    strip(ox0, ix0, iz0, iz1, true);        // west bank
    strip(ix1, ox1, iz0, iz1, true);        // east bank

    // tiles
    const tileList = lv.tiles;
    tileSet.clear();
    for (const t of tileList) tileSet.set(keyOf(t.x, t.z), t);
    const baseMat = kit.flat(PAL.clay);
    const rimMat = kit.flat(0xa87049);
    const studs = new THREE.InstancedMesh(kit.cyl(6), brass, tileList.length * 4);
    const dummy = new THREE.Object3D();
    let si = 0;
    const trailPlate = new THREE.Color(PAL.trailPlate), trailPad = new THREE.Color(PAL.trailPad);
    state.trailPlate = trailPlate; state.trailPad = trailPad;
    const labelPlane = kit.plane();
    for (const t of tileList) {
      const isStart = t.x === lv.start.x && t.z === lv.start.z;
      const isGoal = t.x === lv.goal.x && t.z === lv.goal.z;
      const g = group(L, t.x, 0, t.z);
      const j = (rng() - 0.5) * 0.035;
      const plateColor = new THREE.Color(isGoal ? PAL.amber : isStart ? PAL.copper : PAL.sand).offsetHSL(0, 0, j);
      const checker = (t.x + t.z) % 2 === 0;
      const padColor = new THREE.Color(isGoal ? PAL.amberPad : isStart ? PAL.copperPad : checker ? PAL.sandPad : 0xeedfb4).offsetHSL(0, 0, j);
      const base = put(g, B, baseMat, 0, -0.04, 0, 0.98, 0.56, 0.98);
      put(g, B, rimMat, 0, 0.2, 0, 0.99, 0.05, 0.99);
      const plateMat = new THREE.MeshLambertMaterial({ color: plateColor, flatShading: true });
      const padMat = new THREE.MeshLambertMaterial({ color: padColor, flatShading: true });
      if (isGoal) { plateMat.emissive = new THREE.Color(0x4a2c00); padMat.emissive = new THREE.Color(0x6a4300); }
      const plate = put(g, B, plateMat, 0, 0.275, 0, 0.86, 0.07, 0.86);
      const pad = put(g, B, padMat, 0, 0.325, 0, 0.5, 0.03, 0.5);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        dummy.position.set(t.x + sx * 0.455, 0.255, t.z + sz * 0.455);
        dummy.scale.set(0.034, 0.05, 0.034);
        dummy.updateMatrix();
        studs.setMatrixAt(si++, dummy.matrix);
      }
      const label = new THREE.Mesh(labelPlane, new THREE.MeshBasicMaterial({
        map: labelTexture(tileName(t), isStart ? 'DOCK' : isGoal ? 'RELAY' : ''),
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
      label.rotation.x = -Math.PI / 2;
      label.position.set(0, 0.314, 0.335);
      label.scale.set(0.34, 0.17, 1);
      label.renderOrder = 2;
      g.add(label);

      // tactile painted frame that marks the tiles a learner may choose
      let frame = null;
      if (Array.isArray(lv.predictions) && lv.predictions.some(p => p.x === t.x && p.z === t.z)) {
        frame = new THREE.Mesh(kit.custom('frameRing', () => new THREE.RingGeometry(0.43, 0.5, 4, 1)), kit.basic(PAL.forest, { side: THREE.DoubleSide }));
        frame.rotation.x = -Math.PI / 2;
        frame.rotation.z = Math.PI / 4;
        frame.position.y = 0.316;
        frame.scale.setScalar(0.83);
        g.add(frame);
      }

      base.userData.tile = plate.userData.tile = pad.userData.tile = { x: t.x, z: t.z };
      pickables.push(base, plate, pad);
      const rec = {
        x: t.x, z: t.z, group: g, plateMat, padMat, plateBase: plateColor.clone(), padBase: padColor.clone(),
        trail: 0, trailT: 0, hover: 0, hoverT: 0, press: 0, special: isStart || isGoal, frame
      };
      tiles.set(keyOf(t.x, t.z), rec);

      if (isStart) buildDock(g, lv, state);
      if (isGoal) buildRelay(g, lv, state, rec);
    }
    studs.instanceMatrix.needsUpdate = true;
    L.add(studs);

    // pond life on the void cells only: lily pads and slow ripples
    const voids = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (!tileSet.has(keyOf(x, z))) voids.push({ x, z });
    const shuffled = voids.slice().sort(() => rng() - 0.5);
    const lilyMat = kit.flat(0x5f9d56, { side: THREE.DoubleSide });
    shuffled.slice(0, 6).forEach((v, i) => {
      const lx = v.x + (rng() - 0.5) * 0.4, lz = v.z + (rng() - 0.5) * 0.4;
      const pad = put(state.decor, kit.cyl(8), lilyMat, lx, WATER_Y + 0.012, lz, 0.17 + rng() * 0.06, 0.018, 0.17 + rng() * 0.06);
      pad.rotation.y = rng() * 3;
      state.lilies.push({ obj: pad, y: WATER_Y + 0.012, phase: rng() * 6 });
      if (i % 2 === 0) put(state.decor, kit.ico(0), kit.flat(0xfaf0d8), lx + 0.04, WATER_Y + 0.05, lz, 0.045, 0.035, 0.045);
    });
    shuffled.slice(0, 5).forEach(v => {
      const rm = new THREE.Mesh(kit.custom('ripple', () => new THREE.RingGeometry(0.2, 0.225, 20)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      rm.rotation.x = -Math.PI / 2;
      rm.position.set(v.x + (rng() - 0.5) * 0.3, WATER_Y + 0.02, v.z + (rng() - 0.5) * 0.3);
      rm.renderOrder = 1;
      L.add(rm);
      state.ripples.push({ obj: rm, phase: rng() });
    });

    buildConservatory(L, state, rng, { ox0, ox1, oz0, oz1 });
    scatterFlora(L, state, rng, lv, { minX, maxX, minZ, maxZ, M0, M1 });
    // Act props use their own generator, so the main scenery sequence is identical for every act.
    if (theme.prop) buildThemeProps(L, lv, mulberry32((Math.imul((lv.scenerySeed | 0) + 91, 2246822519) ^ 0x85ebca6b) >>> 0), { minX, maxX, minZ, maxZ });
    // Preserve every animated/pickable/visibility boundary while reducing static draw calls.
    const boundaries = new Set([state.decor, ...state.sways.map(s=>s.obj), ...state.lilies.map(s=>s.obj), ...state.ripples.map(s=>s.obj), ...[...tiles.values()].map(t=>t.group)]);
    for(const root of new Set([L, state.decor, ...state.sways.map(s=>s.obj)])) batchStaticScenery(root,boundaries);
    // Plants change with every dose, so they are added after batching and live under their tile group,
    // which is a batching boundary: they can never be merged into static scenery.
    syncPlants();
  }

  function buildDock(g, lv, state) {
    const B = kit.box();
    const ringGeo = kit.custom('dockRing', () => new THREE.RingGeometry(0.19, 0.225, 20));
    const ring = new THREE.Mesh(ringGeo, kit.basic(PAL.terraDark, { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = TILE_TOP + 0.004;
    g.add(ring);
    // charging post at the back-left corner, relative to Pip's starting heading
    const h = HEADINGS[((lv.start.heading % 4) + 4) % 4];
    const fx = h.dx, fz = h.dz, rx = -h.dz, rz = h.dx;
    const px = -fx * 0.34 - rx * 0.34, pz = -fz * 0.34 - rz * 0.34;
    const post = group(g, px, TILE_TOP, pz);
    put(post, B, kit.flat(0x2d4b3f), 0, 0.09, 0, 0.1, 0.18, 0.1);
    put(post, B, kit.phong(PAL.brass, { shininess: 60 }), 0, 0.2, 0, 0.13, 0.04, 0.13);
    const led = put(post, kit.ico(0), kit.basic(0xffb23a), 0, 0.27, 0, 0.04);
    state.dockPost = { led };
  }

  function buildRelay(g, lv, state, rec) {
    const R = group(g, -0.3, TILE_TOP, -0.3);
    const brass = kit.phong(PAL.brass, { shininess: 60 });
    put(R, kit.cyl(8), brass, 0, 0.05, 0, 0.11, 0.1, 0.11);
    const stemMat = kit.flat(0x6f9a50);
    put(R, kit.cyl(5), stemMat, 0, 0.45, 0, 0.022, 0.7, 0.022);
    const leafGeo = kit.custom('relayLeaf', () => leafGeometry({ segs: 3, length: 0.26, width: 0.13, a0: 0.5, bend: 1.2, fold: 0.1 }));
    for (const [y, r] of [[0.2, 0.7], [0.32, -2.2]]) {
      const lp = group(R, 0, y, 0);
      lp.rotation.y = r;
      put(lp, leafGeo, kit.flat(0x6aa95a, { side: THREE.DoubleSide }), 0, 0, 0);
    }
    const bloom = group(R, 0, 0.82, 0);
    const petalMat = kit.flat(PAL.amber, { emissive: 0x6b3b00 });
    const petals = [];
    for (let i = 0; i < 6; i++) {
      const pv = group(bloom, 0, 0, 0);
      pv.rotation.y = (i / 6) * Math.PI * 2;
      const petal = put(pv, kit.cone(4), i % 2 ? petalMat : kit.flat(0xf08a2c, { emissive: 0x5a2800 }), 0, 0.075, -0.075, 0.07, 0.2, 0.03);
      petal.rotation.x = -0.75;
      petal.scale.set(0.07, 0.2, 0.03);
      petals.push(pv);
    }
    const bulb = put(bloom, kit.ico(1), kit.basic(0xffe6a8), 0, 0.02, 0, 0.1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb040, transparent: true, opacity: 0.7, depthWrite: false }));
    halo.scale.setScalar(1.3);
    halo.position.set(0, 0.82, 0);
    halo.renderOrder = 4;
    R.add(halo);
    // soft pool of light on the tile, and a faint beam rising from the bulb
    const pool = new THREE.Mesh(kit.custom('relayPool', () => new THREE.CircleGeometry(0.36, 24)),
      new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.38, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.3, 0.012, 0.3);
    R.add(pool);
    const ringA = new THREE.Mesh(kit.custom('relayRing', () => new THREE.RingGeometry(0.31, 0.37, 28)), kit.basic(PAL.terra, { side: THREE.DoubleSide }));
    ringA.rotation.x = -Math.PI / 2;
    ringA.position.set(0.3, 0.014, 0.3);
    R.add(ringA);
    const beam = new THREE.Mesh(kit.custom('relayBeam', () => new THREE.CylinderGeometry(0.05, 0.2, 2.2, 10, 1, true)),
      new THREE.MeshBasicMaterial({ color: 0xffc766, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(0, 1.9, 0);
    beam.renderOrder = 3;
    R.add(beam);
    const pulse = new THREE.Mesh(kit.custom('relayRing', () => new THREE.RingGeometry(0.31, 0.37, 28)),
      new THREE.MeshBasicMaterial({ color: 0xffb23a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(0.3, 0.02, 0.3);
    R.add(pulse);
    // only solid parts are pickable: the translucent beam and glow must never steal a tap
    R.traverse(o => {
      if (o.isMesh && !o.material.transparent) { o.userData.tile = { x: lv.goal.x, z: lv.goal.z }; pickables.push(o); }
    });
    state.goal = { R, bloom, petals, halo, bulb, beam, pulse, pool, pulseT: -1, bloomV: 0, rec };
    pointLight.position.set(lv.goal.x - 0.3, TILE_TOP + 0.95, lv.goal.z - 0.3);
  }

  function sway(state, obj, ax, az, speed, phase) {
    obj.userData.base = { x: obj.rotation.x, z: obj.rotation.z };
    state.sways.push({ obj, ax, az, speed, phase });
  }

  function buildConservatory(L, state, rng, o) {
    const B = kit.box();
    const frameMat = kit.flat(theme.frame);
    const plinthMat = kit.flat(PAL.woodDark);
    const glass = kit.phong(0xe7f6ea, { transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, shininess: 80, specular: 0xffffff });
    const baseY = BANK_TOP;
    // wall along an axis. t runs along the wall, "fixed" is its other coordinate.
    const wall = (axis, fixed, t0, t1) => {
      const len = t1 - t0, mid = (t0 + t1) / 2;
      const at = (t, y, along, h, thick) => {
        const x = axis === 'x' ? t : fixed, z = axis === 'x' ? fixed : t;
        return axis === 'x' ? put(L, B, frameMat, x, y, z, along, h, thick) : put(L, B, frameMat, x, y, z, thick, h, along);
      };
      const plinth = at(mid, baseY + 0.2, len, 0.4, 0.16);
      plinth.material = plinthMat;
      const gl = new THREE.Mesh(kit.plane(), glass);
      gl.scale.set(len, WALL_H - 0.4, 1);
      gl.position.set(axis === 'x' ? mid : fixed, baseY + 0.4 + (WALL_H - 0.4) / 2, axis === 'x' ? fixed : mid);
      if (axis === 'z') gl.rotation.y = Math.PI / 2;
      gl.renderOrder = 3;
      L.add(gl);
      const posts = Math.ceil(len / 1.5) + 1;
      for (let i = 0; i < posts; i++) at(t0 + (len * i) / (posts - 1), baseY + WALL_H / 2, 0.09, WALL_H, 0.09);
      const mull = Math.round(len / 0.75);
      for (let i = 1; i < mull; i++) at(t0 + (len * i) / mull, baseY + 0.4 + (WALL_H - 0.4) / 2, 0.03, WALL_H - 0.4, 0.03);
      at(mid, baseY + WALL_H, len, 0.1, 0.13);
      at(mid, baseY + 1.45, len, 0.045, 0.06);
      return { len, mid };
    };
    const wx = o.ox0 + 0.1, wz = o.oz0 + 0.1;
    wall('x', wz, o.ox0, o.ox1);   // north wall
    wall('z', wx, o.oz0, o.oz1);   // west wall

    // hanging paper lanterns: the garden's quiet lights
    const capMat = kit.flat(PAL.ink);
    const cordMat = kit.flat(0x3b4f46);
    const lanternMat = kit.basic(0xffc968);
    const hang = (x, z, y, ph) => {
      const lg = group(L, x, baseY + WALL_H, z);
      const drop = baseY + WALL_H - y;
      put(lg, kit.cyl(4), cordMat, 0, -drop / 2, 0, 0.008, drop, 0.008);
      const body = group(lg, 0, -drop, 0);
      put(body, kit.cone(6), capMat, 0, 0.1, 0, 0.09, 0.07, 0.09);
      put(body, kit.cyl(6), lanternMat, 0, 0, 0, 0.085, 0.14, 0.085);
      put(body, kit.cyl(6), capMat, 0, -0.085, 0, 0.05, 0.03, 0.05);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb94d, transparent: true, opacity: theme.glow, depthWrite: false }));
      sp.scale.setScalar(0.62);
      sp.renderOrder = 4;
      body.add(sp);
      sway(state, lg, 0.05, 0.07, 0.9, ph);
      state.glows.push({ sp, base: theme.glow, phase: ph });
    };
    const nL = 5, wLen = o.ox1 - o.ox0;
    for (let i = 0; i < nL; i++) hang(o.ox0 + ((i + 0.7) * wLen) / (nL + 0.2), wz + 0.22, 1.7 + ((i * 0.37 + rng() * 0.3) % 0.7), rng() * 6);
    // later acts hang a few more lanterns between the first five (fixed spots: no extra random draws)
    for (let i = 0; i < theme.lanterns; i++) hang(o.ox0 + wLen * [0.23, 0.62, 0.43, 0.81][i % 4], wz + 0.22, 1.55 + (i % 3) * 0.17, i * 1.9 + 0.7);
    const nW = 4, zLen = o.oz1 - o.oz0;
    for (let i = 0; i < nW; i++) hang(wx + 0.22, o.oz0 + ((i + 1.2) * zLen) / (nW + 0.6), 1.8 + ((i * 0.41 + rng() * 0.3) % 0.6), rng() * 6);

    // two hanging baskets with trailing vines
    const potMat = kit.flat(PAL.terra);
    const vineMat = kit.flat(0x5e9b55);
    [0.3, 0.68].forEach((f, bi) => {
      const x = o.ox0 + wLen * f, y = baseY + WALL_H - 0.95 - bi * 0.25;
      const bg = group(L, x, baseY + WALL_H, wz + 0.3);
      for (const s of [-1, 1]) {
        const cord = put(bg, kit.cyl(4), cordMat, s * 0.07, -(baseY + WALL_H - y) / 2 + 0.05, 0, 0.006, baseY + WALL_H - y - 0.1, 0.006);
        cord.rotation.z = s * -0.18;
      }
      const basket = group(bg, 0, y - baseY - WALL_H, 0);
      put(basket, kit.taper(8, 0.7), potMat, 0, 0, 0, 0.17, 0.15, 0.17);
      put(basket, kit.jit(0), kit.flat(LEAVES[0]), 0, 0.1, 0, 0.17, 0.1, 0.17);
      for (let v = 0; v < 3; v++) {
        const vg = group(basket, (v - 1) * 0.1, -0.04, (rng() - 0.5) * 0.1);
        const n = 4 + ((v + bi) % 2);
        for (let k = 0; k < n; k++) put(vg, kit.jit(k + v), vineMat, Math.sin(k * 1.3 + v) * 0.03, -0.07 - k * 0.1, 0, 0.045 - k * 0.003, 0.055, 0.045 - k * 0.003);
        sway(state, vg, 0.05, 0.08, 1.1, rng() * 6);
      }
    });
  }

  function scatterFlora(L, state, rng, lv, o) {
    const { minX, maxX, minZ, maxZ, M0, M1 } = o;
    const jit = i => kit.jit(i);
    const leafMats = LEAVES.map(c => kit.flat(c));
    const leafMatsDS = LEAVES.map(c => kit.flat(c, { side: THREE.DoubleSide }));
    const fernGeos = [
      kit.custom('fern0', () => leafGeometry({ segs: 4, length: 1, width: 0.2, a0: 1.2, bend: 1.5 })),
      kit.custom('fern1', () => leafGeometry({ segs: 4, length: 1, width: 0.26, a0: 0.95, bend: 1.7 }))
    ];
    const palmGeo = kit.custom('palm', () => leafGeometry({ segs: 5, length: 1.2, width: 0.36, a0: 0.55, bend: 2, fold: 0.22 }));
    const heartGeo = kit.custom('heart', heartLeafGeometry);
    const rnd = (a, b) => a + rng() * (b - a);
    const pick = arr => arr[(rng() * arr.length) | 0];
    const bankTop = BANK_TOP + 0.03;

    const bush = (parent, s) => {
      const bg = group(parent);
      const n = 2 + ((rng() * 2) | 0);
      for (let i = 0; i < n; i++) {
        put(bg, jit((rng() * 4) | 0), pick(leafMats), rnd(-0.5, 0.5) * s, s * (0.5 + i * 0.1), rnd(-0.5, 0.5) * s, s * rnd(0.6, 0.9), s * rnd(0.5, 0.75), s * rnd(0.6, 0.9));
      }
      return bg;
    };
    const fern = (parent, h) => {
      const fg = group(parent);
      const n = 6 + ((rng() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const pv = group(fg);
        pv.rotation.y = (i / n) * Math.PI * 2 + rng() * 0.5;
        const f = put(pv, pick(fernGeos), pick(leafMatsDS), 0, 0.02, 0, h * rnd(0.75, 1.1));
        f.rotation.x = rnd(-0.1, 0.1);
      }
      sway(state, fg, 0.03, 0.04, 0.8, rng() * 6);
      return fg;
    };
    const pot = (parent, s) => {
      const pg = group(parent);
      put(pg, kit.taper(8, 0.74), kit.flat(PAL.terra), 0, 0.11 * s, 0, 0.15 * s, 0.22 * s, 0.15 * s);
      put(pg, kit.cyl(8), kit.flat(PAL.terraDark), 0, 0.23 * s, 0, 0.165 * s, 0.04 * s, 0.165 * s);
      put(pg, kit.cyl(8), kit.flat(0x4a3a2c), 0, 0.245 * s, 0, 0.13 * s, 0.02 * s, 0.13 * s);
      const top = group(pg, 0, 0.25 * s, 0);
      return top;
    };
    const monstera = (parent, h) => {
      const mg = group(parent);
      const n = 3 + ((rng() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const stemH = h * rnd(0.55, 1);
        const pv = group(mg);
        pv.rotation.y = (i / n) * Math.PI * 2 + rng();
        const tilt = rnd(0.15, 0.5);
        const lean = group(pv);
        lean.rotation.z = tilt;
        put(lean, kit.cyl(4), kit.flat(0x4a7a45), 0, stemH / 2, 0, 0.012, stemH, 0.012);
        const lp = group(lean, 0, stemH, 0);
        const leaf = put(lp, heartGeo, kit.flat(LEAVES[3 + (i % 2)], { side: THREE.DoubleSide }), 0, 0, 0, h * 0.62);
        leaf.rotation.x = -Math.PI / 2 - rnd(0.2, 0.6);
        leaf.rotation.z = rnd(-0.4, 0.4);
      }
      sway(state, mg, 0.02, 0.05, 0.7, rng() * 6);
      return mg;
    };
    const palm = (parent, h) => {
      const pg = group(parent);
      const segs = 3;
      let px = 0, py = 0;
      for (let i = 0; i < segs; i++) {
        const sh = h / segs;
        const r = 0.075 - i * 0.012;
        put(pg, kit.taper(6, 1.18), kit.flat(0x8a6a49), px, py + sh / 2, 0, r, sh * 1.04, r);
        px += 0.045; py += sh * 0.97;
      }
      const crown = group(pg, px, py, 0);
      for (let i = 0; i < 8; i++) {
        const pv = group(crown);
        pv.rotation.y = (i / 8) * Math.PI * 2 + rng() * 0.4;
        put(pv, palmGeo, pick(leafMatsDS), 0, 0, 0, rnd(0.8, 1.05));
      }
      put(crown, kit.ico(0), kit.flat(0x7a5a3a), 0.05, -0.05, 0.03, 0.06);
      put(crown, kit.ico(0), kit.flat(0x7a5a3a), -0.04, -0.06, -0.04, 0.055);
      sway(state, crown, 0.03, 0.04, 0.6, rng() * 6);
      return pg;
    };
    const flowers = (parent, n, spread) => {
      const fg = group(parent);
      const cols = [PAL.terra, 0xf6e9c8, 0xf4ae3b, 0xe8845a];
      for (let i = 0; i < n; i++) {
        const h = rnd(0.16, 0.3);
        const f = group(fg, rnd(-spread, spread), 0, rnd(-spread, spread));
        put(f, kit.cyl(4), kit.flat(0x578e4c), 0, h / 2, 0, 0.008, h, 0.008);
        put(f, kit.ico(1), kit.flat(pick(cols)), 0, h + 0.015, 0, 0.04, 0.055, 0.04);
        const lf = put(f, fernGeos[0], leafMatsDS[1], 0, 0.02, 0, 0.14);
        lf.rotation.y = rng() * 6;
        sway(state, f, 0.08, 0.1, 1.2, rng() * 6);
      }
      return fg;
    };
    const mushrooms = (parent) => {
      const mg = group(parent);
      const capGeo = kit.custom('cap', () => new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2));
      for (let i = 0; i < 3; i++) {
        const s = rnd(0.7, 1.2), x = rnd(-0.1, 0.1), z = rnd(-0.1, 0.1);
        put(mg, kit.cyl(6), kit.flat(PAL.cream), x, 0.04 * s, z, 0.022 * s, 0.08 * s, 0.022 * s);
        put(mg, capGeo, kit.flat(i === 1 ? 0xe8845a : PAL.terra), x, 0.075 * s, z, 0.07 * s, 0.055 * s, 0.07 * s);
      }
      return mg;
    };
    const rocks = (parent) => {
      const rg = group(parent);
      for (let i = 0; i < 3; i++) put(rg, kit.ico(0), kit.flat(pick([0x9fb09a, 0xb7b6a3, 0x8ea28f])), rnd(-0.14, 0.14), 0.03, rnd(-0.14, 0.14), rnd(0.06, 0.12), rnd(0.04, 0.07), rnd(0.06, 0.11)).rotation.y = rng() * 3;
      return rg;
    };
    const wateringCan = (parent) => {
      const cg = group(parent);
      const metal = kit.phong(0x3f7c5c, { shininess: 50 });
      put(cg, kit.cyl(8), metal, 0, 0.075, 0, 0.09, 0.15, 0.09);
      const spout = put(cg, kit.cyl(5), metal, 0.13, 0.12, 0, 0.018, 0.2, 0.018);
      spout.rotation.z = -0.9;
      put(cg, kit.cyl(8), kit.phong(PAL.brass, { shininess: 60 }), 0.2, 0.2, 0, 0.04, 0.025, 0.04).rotation.z = -0.9;
      const hd = put(cg, kit.custom('canHandle', () => new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI)), metal, -0.07, 0.11, 0, 1);
      hd.rotation.z = Math.PI / 2 + 0.2;
      cg.rotation.y = rng() * 2;
      return cg;
    };
    const lampPost = (parent) => {
      const lg = group(parent);
      put(lg, kit.cyl(5), kit.flat(PAL.ink), 0, 0.5, 0, 0.022, 1.0, 0.022);
      put(lg, kit.box(), kit.basic(0xffc968), 0, 1.07, 0, 0.12, 0.15, 0.12);
      put(lg, kit.cone(4), kit.flat(PAL.ink), 0, 1.2, 0, 0.11, 0.1, 0.11).rotation.y = Math.PI / 4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb94d, transparent: true, opacity: 0.5, depthWrite: false }));
      sp.scale.setScalar(0.75);
      sp.position.y = 1.07;
      sp.renderOrder = 4;
      lg.add(sp);
      state.glows.push({ sp, base: 0.5, phase: rng() * 6 });
      return lg;
    };

    // plants along the bank. Tall in the back (north, west). Low in the front so tiles stay readable.
    const decor = state.decor;
    const midN = minZ - (M0 + M1) / 2, midS = maxZ + (M0 + M1) / 2;
    const midW = minX - (M0 + M1) / 2, midE = maxX + (M0 + M1) / 2;
    const spots = [];
    const spread = M1 - M0 - 0.3;
    for (let x = minX - M1 + 0.4; x <= maxX + M1 - 0.4; x += 0.62) {
      spots.push({ x: x + rnd(-0.1, 0.1), z: midN + rnd(-spread / 2, spread / 2), zone: 'back' });
      spots.push({ x: x + rnd(-0.1, 0.1), z: midS + rnd(-spread / 2, spread / 2), zone: 'front' });
    }
    for (let z = minZ - M0 + 0.35; z <= maxZ + M0 - 0.35; z += 0.62) {
      spots.push({ x: midW + rnd(-spread / 2, spread / 2), z: z + rnd(-0.1, 0.1), zone: 'back' });
      spots.push({ x: midE + rnd(-spread / 2, spread / 2), z: z + rnd(-0.1, 0.1), zone: 'front' });
    }
    let palms = 0;
    const cornerNE = { x: maxX + M1 - 0.55, z: minZ - M1 + 0.55 };
    const cornerNW = { x: minX - M1 + 0.5, z: minZ - M1 + 0.5 };
    // a few tall anchors in the back corners for composition
    {
      const a = group(L, cornerNW.x + 0.1, bankTop, cornerNW.z + 0.1); palm(a, 2.0); palms++;
      const b = group(L, cornerNE.x, bankTop, cornerNE.z);
      monstera(pot(b, 1.4), 1.0);
      const c = group(L, minX - M1 + 0.55, bankTop, maxZ + M1 - 0.55); // front-left: a lamp post
      lampPost(c);
      const d = group(L, cornerNE.x - 1.0, bankTop, cornerNE.z + 0.05); palm(d, 1.55); palms++;
    }
    // watering can near the start dock
    {
      const s = lv.start;
      const edges = [
        [s.x - minX, minX - (M0 + M1) / 2, s.z, 'x'],
        [maxX - s.x, maxX + (M0 + M1) / 2, s.z, 'x'],
        [s.z - minZ, minZ - (M0 + M1) / 2, s.x, 'z'],
        [maxZ - s.z, maxZ + (M0 + M1) / 2, s.x, 'z']
      ];
      edges.sort((a, b) => a[0] - b[0]);
      const e = edges[0];
      const wx = e[3] === 'x' ? e[1] : e[2] + 0.5, wz = e[3] === 'x' ? e[2] + 0.5 : e[1];
      wateringCan(group(L, wx, bankTop, wz));
    }
    for (const sp of spots) {
      const nearCorner = (Math.abs(sp.x - cornerNW.x) < 0.9 && Math.abs(sp.z - cornerNW.z) < 0.9) ||
        (Math.abs(sp.x - cornerNE.x) < 1.1 && Math.abs(sp.z - cornerNE.z) < 0.9) ||
        (Math.abs(sp.x - (minX - M1 + 0.55)) < 0.5 && Math.abs(sp.z - (maxZ + M1 - 0.55)) < 0.5);
      if (nearCorner || rng() < 0.2) continue;
      const parent = rng() < 0.35 ? decor : L;
      const g = group(parent, sp.x, bankTop, sp.z);
      g.rotation.y = rng() * 6;
      const r = rng();
      if (sp.zone === 'back') {
        if (r < 0.2) bush(g, rnd(0.45, 0.7));
        else if (r < 0.42) fern(g, rnd(0.7, 1.0));
        else if (r < 0.58) monstera(pot(g, 1.2), rnd(0.55, 0.8));
        else if (r < 0.66 && palms < 3) { palm(g, rnd(1.3, 1.8)); palms++; }
        else if (r < 0.8) flowers(g, 5, 0.18);
        else if (r < 0.9) bush(g, rnd(0.35, 0.5));
        else rocks(g);
      } else {
        if (r < 0.28) fern(g, rnd(0.34, 0.5));
        else if (r < 0.48) flowers(g, 4, 0.16);
        else if (r < 0.62) bush(g, rnd(0.22, 0.32));
        else if (r < 0.74) mushrooms(g);
        else if (r < 0.86) { const t = pot(g, 0.8); flowers(t, 3, 0.05); }
        else rocks(g);
      }
    }
  }

  // ---- act props: one low, quiet group on the front-right bank -------------
  // Everything stays under about 0.5 above the bank, so no tile is ever hidden. Static, so it batches.
  function buildThemeProps(L, lv, trng, o) {
    const { minX, maxX, minZ, maxZ } = o;
    const rnd = (a, b) => a + trng() * (b - a);
    const bankTop = BANK_TOP + 0.03;
    const woodLight = kit.flat(0x8a6a49), woodMid = kit.flat(PAL.wood), soil = kit.flat(0x4a3a2c);
    const brass = kit.phong(PAL.brass, { shininess: 60, specular: 0x665522 });
    if (theme.prop === 'strings') {
      // a swag of small warm bulbs along the north wall: lantern night, still lit and legible
      const n = 14, x0 = minX - 1.3, x1 = maxX + 1.3, z = minZ - 1.05;
      const top = BANK_TOP + WALL_H - 0.26;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const sag = 0.11 * (1 - Math.cos(t * Math.PI * 4)) / 2;   // two gentle swags
        pts.push({ x: lerp(x0, x1, t), y: top - sag, z });
      }
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const cord = put(L, kit.box(), kit.flat(0x3b4f46), (a.x + b.x) / 2, (a.y + b.y) / 2, z, Math.hypot(b.x - a.x, b.y - a.y), 0.012, 0.012);
        cord.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      }
      pts.forEach((p, i) => {
        put(L, kit.ico(0), kit.basic(0xffd27a), p.x, p.y - 0.05, p.z, 0.04);
        if (i % 3 === 1) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb94d, transparent: true, opacity: 0.4, depthWrite: false }));
          sp.scale.setScalar(0.34);
          sp.position.set(p.x, p.y - 0.05, p.z);
          sp.renderOrder = 4;
          L.add(sp);
          levelState.glows.push({ sp, base: 0.4, phase: i * 1.3 });
        }
      });
      return;
    }
    const spot = group(L, maxX + 1.0, bankTop, maxZ + 0.95);
    spot.rotation.y = -0.25;
    if (theme.prop === 'trays') {
      // seed trays: wooden boxes of young sprouts
      for (const [dx, dz] of [[-0.27, 0.02], [0.3, -0.16]]) {
        const tray = group(spot, dx, 0, dz);
        put(tray, kit.box(), woodLight, 0, 0.04, 0, 0.5, 0.08, 0.3);
        put(tray, kit.box(), soil, 0, 0.085, 0, 0.44, 0.02, 0.24);
        for (let i = 0; i < 6; i++) {
          const sx = -0.17 + (i % 3) * 0.17, sz = i < 3 ? -0.06 : 0.07;
          put(tray, kit.cyl(4), kit.flat(0x578e4c), sx, 0.13, sz, 0.006, 0.08, 0.006);
          put(tray, kit.ico(0), kit.flat(LEAVES[(i + 2) % 6]), sx, 0.18, sz, 0.045, 0.025, 0.045).rotation.y = rnd(0, 3);
        }
      }
    } else if (theme.prop === 'bench') {
      // a little potting bench: brass gear, a crate and a wrench
      put(spot, kit.box(), woodLight, 0, 0.3, 0, 0.7, 0.05, 0.34);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(spot, kit.box(), woodMid, sx * 0.3, 0.14, sz * 0.13, 0.05, 0.28, 0.05);
      put(spot, kit.box(), woodMid, 0, 0.1, 0, 0.6, 0.03, 0.04);
      const gear = group(spot, -0.19, 0.325, 0);
      put(gear, kit.cyl(10), brass, 0, 0.015, 0, 0.09, 0.03, 0.09);
      for (let i = 0; i < 4; i++) put(gear, kit.box(), brass, 0, 0.015, 0, 0.22, 0.03, 0.04).rotation.y = (i * Math.PI) / 4;
      put(gear, kit.cyl(6), kit.flat(PAL.woodDark), 0, 0.034, 0, 0.03, 0.02, 0.03);
      put(spot, kit.box(), kit.flat(PAL.clay), 0.2, 0.385, -0.02, 0.2, 0.12, 0.2);
      put(spot, kit.box(), kit.flat(PAL.ink), 0.2, 0.39, -0.02, 0.206, 0.03, 0.206);
      put(spot, kit.box(), kit.flat(PAL.cream), -0.02, 0.335, 0.12, 0.2, 0.02, 0.035).rotation.y = 0.5;
    }
  }

  // ---- nursery plants in 3D ------------------------------------------------
  // A forest-green pot in the tile's back-right corner and a small dose gauge beside it, both clear of
  // Pip's centre, the front-edge tile label and the relay in the back-left corner. Fixed dose pips on a rod:
  // a ring is a dose still needed, a bead in the ring is a dose given. The plant revives with the doses
  // and blossoms (cream, with a mint ring; never amber like the relay) when it has had enough.
  // All of it is driven by the engine's numbers and never decides anything itself.
  const plantTarget = rec => clamp(rec.water / rec.need, 0, 1);

  function removePlant(key, rec) {
    rec.root.removeFromParent();
    disposeTree(rec.root);
    pickables = pickables.filter(o => !rec.picks.has(o));
    levelState.plants.delete(key);
  }

  function snapPlant(rec) {
    rec.shown = plantTarget(rec);
    rec.bloom = rec.water >= rec.need ? 1 : 0;
    const filled = Math.min(rec.water, rec.need);
    rec.pips.forEach((pp, i) => { pp.v = i < filled ? 1 : 0; });
    paintPlant(rec, 0);
  }

  function buildPlant(tile, p) {
    const root = group(tile.group, 0, TILE_TOP, 0);
    const picks = new Set();
    // a tap on any solid part of the plant selects its tile, like any other part of the tile
    const solid = m => { m.userData.tile = { x: p.x, z: p.z }; pickables.push(m); picks.add(m); return m; };
    const brass = kit.phong(PAL.brass, { shininess: 60, specular: 0x665522 });

    const pot = group(root, 0.2, 0, -0.34);
    solid(put(pot, kit.taper(8, 0.74), kit.flat(PAL.forest), 0, 0.11, 0, 0.1, 0.22, 0.1));
    solid(put(pot, kit.cyl(8), brass, 0, 0.225, 0, 0.113, 0.035, 0.113));
    const soilMat = new THREE.MeshLambertMaterial({ color: SOIL_DRY, flatShading: true });
    put(pot, kit.cyl(8), soilMat, 0, 0.238, 0, 0.092, 0.018, 0.092);

    const leafMat = new THREE.MeshLambertMaterial({ color: LEAF_DRY, flatShading: true, side: THREE.DoubleSide });
    const leafGeo = kit.custom('plantLeaf', () => leafGeometry({ segs: 3, length: 0.2, width: 0.1, a0: 0.75, bend: 1.15, fold: 0.12 }));
    const crown = group(pot, 0, 0.245, 0);
    put(crown, kit.ico(0), leafMat, 0, 0.03, 0, 0.035);
    const leaves = [];
    const nLeaves = 7;
    for (let i = 0; i < nLeaves; i++) {
      const pv = group(crown);
      pv.rotation.y = (i / nLeaves) * Math.PI * 2 + (i % 2) * 0.25;
      const tilt = group(pv);
      const base = i % 2 ? 0.82 : 1;
      leaves.push({ tilt, mesh: put(tilt, leafGeo, leafMat, 0, 0, 0, base), base, phase: i * 0.9 });
    }

    const petalMat = kit.flat(0xfff1d6), coreMat = kit.flat(0xf2b3a0), stemMat = kit.flat(0x578e4c);
    const blossoms = [];
    for (const [x, y, z, s] of [[-0.05, 0.2, 0.03, 0.95], [0.06, 0.26, -0.03, 1], [0.01, 0.15, 0.08, 0.8]]) {
      const bg = group(crown, x, 0, z);
      put(bg, kit.cyl(4), stemMat, 0, y / 2, 0, 0.007, y, 0.007);
      const head = group(bg, 0, y, 0);
      put(head, kit.ico(0), coreMat, 0, 0.01, 0, 0.03);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        put(head, kit.ico(0), petalMat, Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045, 0.04, 0.018, 0.04);
      }
      bg.visible = false;
      blossoms.push({ bg, s, phase: x * 40 });
    }

    // restored: a soft mint ring on the tile and a faint halo
    const ring = new THREE.Mesh(kit.custom('plantRing', () => new THREE.RingGeometry(0.15, 0.185, 24)),
      new THREE.MeshBasicMaterial({ color: PAL.water, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.visible = false;
    pot.add(ring);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xc9f5e4, transparent: true, opacity: 0, depthWrite: false }));
    halo.scale.setScalar(0.6);
    halo.position.y = 0.3;
    halo.renderOrder = 4;
    halo.visible = false;
    pot.add(halo);

    // dose gauge: a slim rod with one fixed slot per dose, facing the camera
    const gauge = group(root, 0.375, 0, -0.24);
    const step = Math.min(0.105, 0.5 / p.need);
    const r = Math.min(0.043, step * 0.42);
    const rodH = 0.1 + step * p.need;
    solid(put(gauge, kit.cyl(6), brass, 0, 0.025, 0, 0.055, 0.05, 0.055));
    solid(put(gauge, kit.cyl(5), kit.flat(PAL.wood), 0, rodH / 2 + 0.03, 0, 0.016, rodH, 0.016));
    put(gauge, kit.ico(0), brass, 0, rodH + 0.05, 0, 0.03);
    const doseRing = kit.custom('doseRing', () => new THREE.TorusGeometry(1, 0.2, 5, 14));
    const pips = [];
    for (let i = 0; i < p.need; i++) {
      const slot = group(gauge, 0, 0.1 + i * step, 0);
      slot.rotation.set(-CAM_ELEV, CAM_YAW, 0, 'YXZ');
      put(slot, doseRing, kit.basic(PAL.ink), 0, 0, 0, r * 1.2);
      const bead = put(slot, kit.ico(1), kit.basic(DOSE_FILL), 0, 0, 0.004, r * 0.8);
      put(bead, kit.ico(1), kit.basic(PAL.ink, { side: THREE.BackSide }), 0, 0, 0, 1.25);
      bead.visible = false;
      pips.push({ bead, size: r * 0.8, v: 0 });
    }

    const rec = {
      x: p.x, z: p.z, need: p.need, water: p.water, root, picks, soilMat, leafMat,
      leaves, blossoms, ring, halo, pips, shown: 0, bloom: 0
    };
    snapPlant(rec);
    return rec;
  }

  // pose and colour from the smoothed values; t is the ambient clock (0 when motion is reduced)
  function paintPlant(rec, t) {
    const s = rec.shown, b = rec.bloom;
    const droop = lerp(0.95, -0.1, s);
    const scale = lerp(0.62, 1.08, s);
    for (const lf of rec.leaves) {
      lf.tilt.rotation.x = droop + (reduced ? 0 : Math.sin(t * 1.5 + lf.phase) * 0.04 * (0.4 + s));
      lf.mesh.scale.setScalar(lf.base * scale);
    }
    rec.leafMat.color.copy(LEAF_DRY).lerp(LEAF_LUSH, s);
    rec.soilMat.color.copy(SOIL_DRY).lerp(SOIL_WET, Math.min(1, s * 1.4));
    const open = b > 0.03;
    for (const bl of rec.blossoms) {
      bl.bg.visible = open;
      if (open) {
        bl.bg.scale.setScalar(Math.max(0.001, b * bl.s));
        bl.bg.rotation.z = reduced ? 0 : Math.sin(t * 1.3 + bl.phase) * 0.06;
      }
    }
    rec.ring.visible = open;
    rec.ring.material.opacity = b * (reduced ? 0.7 : 0.6 + Math.sin(t * 2) * 0.1);
    rec.halo.visible = open;
    rec.halo.material.opacity = b * 0.5;
    for (const pp of rec.pips) {
      pp.bead.visible = pp.v > 0.01;
      if (pp.bead.visible) pp.bead.scale.setScalar(pp.size * easeOutBack(clamp(pp.v, 0, 1)));
    }
  }

  function syncPlants() {
    const S = levelState;
    if (!S || !kit) return;
    const wanted = new Map(plantList().map(p => [keyOf(p.x, p.z), p]));
    for (const [key, rec] of [...S.plants]) {
      const w = wanted.get(key);
      if (!w || w.need !== rec.need) removePlant(key, rec);
    }
    for (const [key, p] of wanted) {
      const existing = S.plants.get(key);
      if (existing) { existing.water = p.water; continue; }
      const tile = tiles.get(key);
      if (tile) S.plants.set(key, buildPlant(tile, p));
    }
    if (reduced) for (const rec of S.plants.values()) snapPlant(rec);
  }

  function updatePlants(dt, t) {
    const S = levelState;
    if (!S || !S.plants.size) return;
    const kShown = 1 - Math.exp(-dt * 4), kBloom = 1 - Math.exp(-dt * 3);
    for (const rec of S.plants.values()) {
      const target = plantTarget(rec);
      const ready = rec.water >= rec.need ? 1 : 0;
      if (reduced) { rec.shown = target; rec.bloom = ready; } else {
        rec.shown += (target - rec.shown) * kShown;
        rec.bloom += (ready - rec.bloom) * kBloom;
        if (Math.abs(target - rec.shown) < 0.003) rec.shown = target;
        if (Math.abs(ready - rec.bloom) < 0.003) rec.bloom = ready;
      }
      const filled = Math.min(rec.water, rec.need);
      rec.pips.forEach((pp, i) => {
        const tv = i < filled ? 1 : 0;
        pp.v = reduced ? tv : pp.v + clamp(tv - pp.v, -dt / 0.22, dt / 0.28);
      });
      paintPlant(rec, t);
    }
  }

  // ---- state -> Pip ------------------------------------------------------
  function pressTile(x, z) {
    const rec = tiles.get(keyOf(x, z));
    if (rec && !reduced) rec.press = 1;
  }
  function setHover(key) {
    if (hoverKey === key) return;
    const prev = tiles.get(hoverKey);
    if (prev) prev.hoverT = 0;
    hoverKey = key;
    const next = tiles.get(key);
    if (next) next.hoverT = 1;
    if (canvas) canvas.classList.toggle('is-pointing', Boolean(next));
    if (reduced) { if (prev) prev.hover = 0; if (next) next.hover = 1; }
    requestRender();
  }

  function placePip(x, z, turn, snapMoods) {
    pip.x = pip.tx = x; pip.z = pip.tz = z;
    pip.turn = turn;
    pip.yaw = pip.tyaw = -turn * Math.PI / 2;
    pip.anim = null;
    if (snapMoods) Object.assign(pip.mood, pip.moodT);
  }

  function moodFor(status) {
    return {
      armsUp: status === 'success' ? 1 : 0,
      shrug: status === 'complete' ? 1 : 0,
      glow: status === 'success' ? 1 : 0
    };
  }

  function applyPipState(state, snap = false) {
    if (!pip) return;
    const h = ((state.heading % 4) + 4) % 4;
    const turn = unwrapHeading(pip.turn, h);
    const sig = `${state.x},${state.z},${h},${state.status}`;
    if (pip.hasTarget && sig === pip.sig) return;
    const first = !pip.hasTarget;
    // The engine may deliver another Step before the prior visual tween ends.
    // Finish its discrete target first; never animate a new command from stale dock coordinates.
    if (pip.anim) { pip.x = pip.tx; pip.z = pip.tz; pip.yaw = pip.tyaw; pip.anim = null; }
    const moved = first || state.x !== pip.tx || state.z !== pip.tz;
    const turned = turn !== pip.turn;
    const status = state.status;
    const fx = pip.x, fz = pip.z, fyaw = pip.yaw;
    pip.sig = sig; pip.hasTarget = true; pip.status = status;
    pip.tx = state.x; pip.tz = state.z; pip.turn = turn; pip.tyaw = -turn * Math.PI / 2;
    const finalMood = moodFor(status);
    const after = status === 'success' ? 'celebrate' : status === 'blocked' ? 'bump' : status === 'complete' ? 'shrug' : null;

    if (first || reduced || snap) {
      placePip(state.x, state.z, turn, false);
      pip.moodT = finalMood;
      Object.assign(pip.mood, finalMood);
      if (levelState?.goal) levelState.goal.bloomV = finalMood.glow;
      return;
    }
    pip.moodT = { armsUp: 0, shrug: 0, glow: pip.status === 'success' ? 1 : 0 };
    if (moved) {
      const dist = Math.hypot(state.x - fx, state.z - fz);
      const kind = dist > 1.6 ? 'warp' : 'walk';
      pip.anim = { kind, t: 0, dur: kind === 'warp' ? 460 : MOVE_MS, fx, fz, fyaw, after, pressed: false };
      if (kind === 'warp') { pip.moodT = finalMood; }
    } else if (turned) {
      pip.anim = { kind: 'turn', t: 0, dur: MOVE_MS, fx, fz, fyaw, after };
    } else if (after) {
      pip.anim = { kind: after, t: 0, dur: after === 'celebrate' ? 1000 : after === 'bump' ? 560 : 650, fx, fz, fyaw, after: null };
      pip.moodT = finalMood;
    } else {
      pip.moodT = finalMood;
      pip.anim = null;
    }
    if (!after && levelState?.goal) levelState.goal.bloomV = 0;
  }

  function finishAnim(a) {
    pip.x = pip.tx; pip.z = pip.tz; pip.yaw = pip.tyaw;
    if (a.after) {
      const kind = a.after;
      pip.anim = { kind, t: 0, dur: kind === 'celebrate' ? 1000 : kind === 'bump' ? 560 : 650, fx: pip.x, fz: pip.z, fyaw: pip.yaw, after: null };
      pip.moodT = moodFor(pip.status);
    } else {
      pip.anim = null;
      pip.moodT = moodFor(pip.status);
    }
    if (a.kind === 'walk' || a.kind === 'warp') pressTile(pip.tx, pip.tz);
  }

  function updatePip(dt, t) {
    const a = pip.anim;
    let hop = 0, swing = 0, lean = 0, headYaw = 0, headTilt = 0, scale = 1, bump = 0, antKick = 0;
    let px = pip.x, pz = pip.z, yaw = pip.yaw, rigYaw = 0;
    if (a) {
      a.t += dt * 1000;
      const p = clamp(a.t / a.dur, 0, 1);
      switch (a.kind) {
        case 'walk': {
          const e = easeInOut(p);
          px = lerp(a.fx, pip.tx, e); pz = lerp(a.fz, pip.tz, e);
          yaw = lerp(a.fyaw, pip.tyaw, e);
          hop = Math.sin(p * Math.PI) * 0.1;
          swing = Math.sin(p * Math.PI * 2) * 0.8;
          lean = -Math.sin(p * Math.PI) * 0.12;
          antKick = Math.sin(p * Math.PI * 2) * 0.3;
          if (!a.pressed && p > 0.6) { a.pressed = true; pressTile(pip.tx, pip.tz); }
          break;
        }
        case 'turn': {
          const e = easeOutBack(p);
          yaw = lerp(a.fyaw, pip.tyaw, e);
          headYaw = (pip.tyaw - yaw) * 0.6;
          hop = Math.sin(p * Math.PI) * 0.035;
          lean = -Math.sin(p * Math.PI) * 0.04;
          antKick = Math.sin(p * Math.PI) * 0.35 * Math.sign(pip.tyaw - a.fyaw || 1);
          break;
        }
        case 'warp': {
          yaw = pip.tyaw;
          if (p < 0.5) { px = a.fx; pz = a.fz; scale = Math.max(0.001, 1 - easeInOut(p * 2)); }
          else { px = pip.tx; pz = pip.tz; scale = Math.max(0.001, easeOutBack((p - 0.5) * 2)); }
          rigYaw = p * Math.PI * 4;
          break;
        }
        case 'bump': {
          const f = p < 0.3 ? easeOut(p / 0.3) : 1 - easeOut((p - 0.3) / 0.7);
          bump = f * 0.13;
          lean = -f * 0.18;
          if (p > 0.3) headYaw = Math.sin((p - 0.3) * Math.PI * 5) * 0.4 * (1 - p);
          antKick = Math.sin(p * Math.PI * 6) * 0.5 * (1 - p);
          break;
        }
        case 'celebrate': {
          hop = Math.abs(Math.sin(p * Math.PI * 2)) * 0.16;
          antKick = Math.sin(p * Math.PI * 8) * 0.4;
          rigYaw = Math.sin(p * Math.PI) * 0.4;
          break;
        }
        case 'shrug': {
          headTilt = Math.sin(p * Math.PI) * 0.18;
          lean = Math.sin(p * Math.PI) * 0.03;
          break;
        }
        default: break;
      }
      if (p >= 1) finishAnim(a);
    }

    // mood: arms up in joy, a gentle shrug when the route simply ran out
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    for (const key of Object.keys(pip.mood)) pip.mood[key] += (pip.moodT[key] - pip.mood[key]) * k;
    const m = pip.mood;

    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const tile = tiles.get(keyOf(a && a.kind === 'walk' && a.t / a.dur < 0.5 ? Math.round(a.fx) : pip.tx, a && a.kind === 'walk' && a.t / a.dur < 0.5 ? Math.round(a.fz) : pip.tz));
    const tileY = tile ? tile.group.position.y : 0;
    pip.root.position.set(px + fwdX * bump, TILE_TOP + tileY + hop, pz + fwdZ * bump);
    pip.root.scale.setScalar(PIP_SCALE * scale);
    pip.yawG.rotation.y = yaw;
    pip.rig.rotation.y = rigYaw;

    const breathe = reduced ? 0 : Math.sin(t * 2.2) * 0.012;
    pip.rig.rotation.x = lean;
    pip.rig.scale.set(1, 1 + breathe, 1);
    pip.legs[0].rotation.x = swing;
    pip.legs[1].rotation.x = -swing;
    pip.arms[0].rotation.x = -swing * 0.8 + (reduced ? 0 : Math.sin(t * 1.6) * 0.03);
    pip.arms[1].rotation.x = swing * 0.8 - (reduced ? 0 : Math.sin(t * 1.6) * 0.03);
    pip.arms[0].rotation.z = -(m.armsUp * 2.55 + m.shrug * 0.95) - (m.armsUp > 0.5 && !reduced ? Math.sin(t * 7) * 0.12 : 0);
    pip.arms[1].rotation.z = (m.armsUp * 2.55 + m.shrug * 0.95) + (m.armsUp > 0.5 && !reduced ? Math.sin(t * 7 + 1) * 0.12 : 0);
    pip.head.rotation.y = headYaw + (reduced ? 0 : Math.sin(t * 0.7) * 0.05);
    pip.head.rotation.z = headTilt + m.shrug * 0.2 + (reduced ? 0 : Math.sin(t * 0.9) * 0.025);
    pip.head.rotation.x = m.shrug * 0.08 - m.armsUp * 0.12;
    pip.antenna.rotation.z = (reduced ? 0 : Math.sin(t * 2.4) * 0.12) + antKick - m.shrug * 0.5;
    pip.antenna.rotation.x = reduced ? 0 : Math.sin(t * 1.9 + 1) * 0.08;
    const blink = !reduced && (t % 4.3) > 4.18 ? 0.12 : 1;
    pip.eyes[0].scale.y = pip.eyes[1].scale.y = blink * (1 - m.shrug * 0.25);
    pip.gearSpin += dt * (a && a.kind === 'walk' ? 9 : reduced ? 0 : 0.7);
    pip.gear.rotation.x = pip.gearSpin;
    const glowAmt = 0.55 + m.glow * 0.45 + (reduced ? 0 : Math.sin(t * 3) * 0.08);
    pip.halo.material.opacity = glowAmt;
    pip.halo.scale.setScalar(0.3 + m.glow * 0.25);
    pip.arrowG.position.y = 1.2 + (reduced ? 0 : Math.sin(t * 2.6) * 0.035);
    const pulse = reduced ? 1 : 1 + Math.sin(t * 3) * 0.025;
    pip.ring.scale.set(pulse, pulse, 1);
    pip.shadow.scale.set(0.8 * (1 - hop * 1.2) * scale, 0.8 * (1 - hop * 1.2) * scale, 1);
    pip.shadow.material.opacity = clamp(1 - hop * 2, 0.4, 1);
  }

  // ---- per-frame tile and ambient life --------------------------------
  function updateTiles(dt) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 7);
    const kh = reduced ? 1 : 1 - Math.exp(-dt * 12);
    const tp = levelState.trailPlate, td = levelState.trailPad;
    for (const rec of tiles.values()) {
      rec.trail += (rec.trailT - rec.trail) * k;
      rec.hover += (rec.hoverT - rec.hover) * kh;
      rec.press = reduced ? 0 : rec.press * Math.exp(-dt * 6.5);
      rec.group.position.y = rec.hover * 0.035 - Math.sin(Math.min(1, rec.press) * Math.PI * 0.5) * 0.06;
      rec.plateMat.color.copy(rec.plateBase);
      rec.padMat.color.copy(rec.padBase);
      if (!rec.special && rec.trail > 0.002) {
        rec.plateMat.color.lerp(tp, rec.trail * 0.85);
        rec.padMat.color.lerp(td, rec.trail * 0.85);
      }
      if (rec.hover > 0.002) {
        rec.plateMat.color.lerp(hoverCol, rec.hover * 0.4);
        rec.padMat.color.lerp(hoverCol, rec.hover * 0.4);
      }
    }
  }
  const hoverCol = new THREE.Color(PAL.hover);

  function updateAmbient(t, dt) {
    const s = levelState;
    for (const w of s.sways) {
      const b = w.obj.userData.base;
      w.obj.rotation.x = b.x + w.ax * Math.sin(t * w.speed + w.phase);
      w.obj.rotation.z = b.z + w.az * Math.sin(t * w.speed * 0.83 + w.phase * 1.7);
    }
    for (const l of s.lilies) l.obj.position.y = l.y + Math.sin(t * 1.3 + l.phase) * 0.008;
    for (const r of s.ripples) {
      const p = (t * 0.22 + r.phase) % 1;
      r.obj.scale.setScalar(0.8 + p * 1.5);
      r.obj.material.opacity = (1 - p) * (1 - p) * 0.55 * (quality > 0 ? 1 : 0);
    }
    for (const g of s.glows) g.sp.material.opacity = g.base + Math.sin(t * 1.7 + g.phase) * 0.08;
    if (s.dockPost) s.dockPost.led.scale.setScalar(0.04 * (1 + (reduced ? 0 : Math.sin(t * 3) * 0.2)));

    const goal = s.goal;
    if (goal) {
      const kb = reduced ? 1 : 1 - Math.exp(-dt * 4);
      goal.bloomV += ((pip.moodT.glow > 0.5 ? 1 : 0) - goal.bloomV) * kb;
      const bl = goal.bloomV;
      const flick = reduced ? 0 : Math.sin(t * 2.3) * 0.5 + Math.sin(t * 5.1) * 0.25;
      goal.halo.scale.setScalar(1.25 + bl * 0.9 + flick * 0.06);
      goal.halo.material.opacity = 0.6 + bl * 0.3 + flick * 0.05;
      goal.bloom.scale.setScalar(1 + bl * 0.35);
      goal.bloom.rotation.y = reduced ? 0 : t * 0.25 + bl * Math.sin(t * 2) * 0.1;
      goal.beam.material.opacity = 0.08 + bl * 0.1 + flick * 0.01;
      goal.pool.material.opacity = 0.34 + bl * 0.25;
      pointLight.intensity = 0.9 + bl * 0.9 + flick * 0.05;
      if (pip.anim && pip.anim.kind === 'celebrate' && goal.pulseT < 0) goal.pulseT = 0;
      if (goal.pulseT >= 0) {
        goal.pulseT += reduced ? 1 : dt / 1.2;
        const p = Math.min(1, goal.pulseT);
        goal.pulse.scale.setScalar(1 + p * 3.2);
        goal.pulse.material.opacity = reduced ? 0 : (1 - p) * 0.7;
        if (p >= 1) goal.pulseT = pip.status === 'success' ? 2 : -1;
        if (goal.pulseT === 2 && pip.status !== 'success') goal.pulseT = -1;
      }
    }

    // fireflies
    if (motes.visible && bounds) {
      const arr = motes.geometry.attributes.position;
      const seeds = motes.userData.seeds;
      for (let i = 0; i < seeds.length; i++) {
        const sd = seeds[i];
        const tt = reduced ? 0 : t;
        const x = Math.sin(sd.a + tt * 0.12 * sd.c) * (bounds.hx * 0.85) + Math.sin(tt * 0.5 + sd.a) * 0.15;
        const z = Math.cos(sd.a * 1.7 + tt * 0.1 * sd.c) * (bounds.hz * 0.85) + Math.cos(tt * 0.45 + sd.a) * 0.15;
        const y = 0.7 + sd.b * 1.9 + Math.sin(tt * 0.6 * sd.c + sd.a) * 0.18;
        arr.setXYZ(i, x + (level.width - 1) / 2, y, z + (level.height - 1) / 2);
      }
      arr.needsUpdate = true;
    }
    if (predMarker.visible) {
      predMarker.userData.flag.rotation.y = reduced ? 0 : Math.sin(t * 2.4) * 0.18;
      predMarker.position.y = reduced ? 0 : Math.sin(t * 2) * 0.012;
    }
  }

  // ---- loop --------------------------------------------------------------
  function shouldLoop() {
    return !reduced && onScreen && !document.hidden && !flat && !destroyed;
  }
  // a single pending frame at most: degrade() and resize can both ask for one mid-loop
  function schedule() {
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function requestRender() {
    if (destroyed || !renderer || flat || !level) return;
    schedule();
  }
  function loop(now) {
    raf = 0;
    if (destroyed || !renderer || flat || !level) return;
    const minInterval = 30; // Cap atmosphere at roughly30fps to respect modest Chromebook CPU/battery budgets.
    if (shouldLoop() && lastTime && now - lastTime < minInterval) { schedule(); return; }
    const dtMs = lastTime ? Math.min(100, now - lastTime) : 16;
    lastTime = now;
    const dt = dtMs / 1000;
    if (!reduced) clock += dt;
    const t = reduced ? 0 : clock;
    updatePip(dt, t);
    updateTiles(dt);
    updatePlants(dt, t);
    updateAmbient(t, dt);
    renderer.render(scene, camera);

    if (shouldLoop()) {
      framesSeen++;
      if (framesSeen > 40) {
        if (dtMs > 42) slowFrames++;
        if (framesSeen % 120 === 0) {
          if (slowFrames > 36 && quality > 0) degrade();
          slowFrames = 0;
        }
      }
      schedule();
    } else if (!reduced && (pip.anim || levelState.goal?.pulseT >= 0) && !document.hidden && onScreen) {
      schedule();
    } else {
      lastTime = 0;
    }
  }
  function degrade() {
    quality--;
    if (quality === 1) { pixelRatio = 1; fitCamera(); }
    if (quality === 0) {
      motes.visible = false;
      if (levelState) levelState.decor.visible = false;
    }
  }

  // ---- camera fit --------------------------------------------------------
  function fitCamera() {
    if (!renderer || !level || !bounds) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (w < 2 || h < 2) return;
    const budget = Math.sqrt(2.4e6 / (w * h));
    const pr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5, budget));
    renderer.setPixelRatio(quality >= 2 ? Math.min(pr, pixelRatio || pr) : 1);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const dir = new THREE.Vector3(Math.sin(CAM_YAW) * Math.cos(CAM_ELEV), Math.sin(CAM_ELEV), Math.cos(CAM_YAW) * Math.cos(CAM_ELEV));
    camera.position.copy(dir).multiplyScalar(60).add(CAM_TARGET);
    camera.up.set(0, 1, 0);
    camera.lookAt(CAM_TARGET);
    camera.updateMatrixWorld(true);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of bounds.points) {
      _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, _v.x); maxX = Math.max(maxX, _v.x);
      minY = Math.min(minY, _v.y); maxY = Math.max(maxY, _v.y);
    }
    const extW = maxX - minX, extH = maxY - minY;
    const vw = Math.max(extW / 0.92, (extH / 0.76) * aspect);
    const vh = vw / aspect;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 + vh * 0.015;
    camera.left = cx - vw / 2; camera.right = cx + vw / 2;
    camera.top = cy + vh / 2; camera.bottom = cy - vh / 2;
    camera.updateProjectionMatrix();
    cameraReady = true;
    updateReadout();
    requestRender();
  }

  // ---- picking -----------------------------------------------------------
  function tileFromPoint(clientX, clientY) {
    if (!renderer || !level || flat || !cameraReady) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    worldGroup.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables.concat(pip.pickMeshes), false);
    for (const hit of hits) {
      if (hit.object.userData.pip) {
        return tileSet.has(keyOf(pip.tx, pip.tz)) ? { x: pip.tx, z: pip.tz } : null;
      }
      if (hit.object.userData.tile) return hit.object.userData.tile;
    }
    return null;
  }

  let down = null;
  function bindPointer() {
    on(canvas, 'pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    on(canvas, 'pointerup', e => {
      const d = down;
      down = null;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 900) return;
      const tile = tileFromPoint(e.clientX, e.clientY);
      if (!tile) return;
      pressTile(tile.x, tile.z);
      const b = buttons.get(keyOf(tile.x, tile.z));
      if (b) setRover(b);
      requestRender();
      select(tile);
    });
    on(canvas, 'pointercancel', () => { down = null; });
    on(canvas, 'pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const tile = tileFromPoint(e.clientX, e.clientY);
      setHover(tile ? keyOf(tile.x, tile.z) : null);
    });
    on(canvas, 'pointerleave', () => setHover(null));
    on(canvas, 'webglcontextlost', e => {
      e.preventDefault();
      enterFlat('3D drawing was interrupted, so the flat map is showing. It will return when the graphics driver does.');
      contextLost = true;
    });
    on(canvas, 'webglcontextrestored', () => {
      contextLost = false;
      if (!forcedFlat) leaveFlat();
    });
  }
  let contextLost = false;

  function enterFlat(reason) {
    flat = true;
    flatReason = reason || '';
    cancelAnimationFrame(raf); raf = 0;
    applyFlatClass();
    showNote(flatReason);
    updateReadout();
  }
  function leaveFlat() {
    flat = false;
    flatReason = '';
    applyFlatClass();
    showNote('');
    fitCamera();
    updateReadout();
    requestRender();
  }

  // ---- public API --------------------------------------------------------
  // Gentle act identity: light colour, ironwork tint and a data-act hook for the stage backdrop in CSS.
  function applyTheme(lv) {
    theme = themeFor(lv);
    if (theme.act > 0) container.dataset.act = String(theme.act);
    else delete container.dataset.act;
    if (hemiLight && sunLight) {
      hemiLight.color.setHex(theme.sky);
      hemiLight.groundColor.setHex(theme.ground);
      hemiLight.intensity = theme.hemi;
      sunLight.color.setHex(theme.sun);
      sunLight.intensity = theme.sunI;
    }
  }

  function setLevel(next) {
    if (destroyed || !next) return;
    level = next;
    applyTheme(next);
    tileSet.clear();
    for (const t of next.tiles) tileSet.set(keyOf(t.x, t.z), t);
    lastState = null;
    headTurn = unwrapHeading(0, ((next.start.heading % 4) + 4) % 4);
    hoverKey = null;
    if (renderer) {
      buildLevel(next);
      pip.hasTarget = false; pip.sig = ''; pip.anim = null; pip.turn = 0;
      pip.moodT = { armsUp: 0, shrug: 0, glow: 0 };
      Object.assign(pip.mood, pip.moodT);
      applyPipState({ x: next.start.x, z: next.start.z, heading: next.start.heading, status: 'idle' });
      setPredictionMarker();
    }
    buildTilemap();
    updateReadout();
    if (renderer) {
      for (const rec of tiles.values()) rec.trailT = rec.trail = 0;
      const startRec = tiles.get(keyOf(next.start.x, next.start.z));
      if (startRec) startRec.trailT = startRec.trail = 1;
      fitCamera();
    }
    if (pendingState) { const s = pendingState; pendingState = null; renderState(s); }
    requestRender();
  }
  let pendingState = null;

  function renderState(state, { snap = false } = {}) {
    if (destroyed || !state) return;
    if (!level) { pendingState = state; return; }
    lastState = state;
    const h = ((state.heading % 4) + 4) % 4;
    headTurn = unwrapHeading(headTurn, h);
    if (renderer) {
      applyPipState(state, snap);
      syncPlants();
      if (snap) for (const rec of levelState.plants.values()) snapPlant(rec);
      const trail = new Set((state.trail || []).map(t => keyOf(t.x, t.z)));
      for (const [key, rec] of tiles) {
        rec.trailT = trail.has(key) ? 1 : 0;
        if (reduced) rec.trail = rec.trailT;
      }
    }
    refreshTilemap();
    updateReadout();
    requestRender();
  }

  function setPredictionMarker() {
    if (!predMarker) return;
    for (const rec of tiles.values()) {
      if (rec.frame) rec.frame.material = kit.basic(PAL.forest, { side: THREE.DoubleSide });
    }
    if (!prediction || !tileSet.has(keyOf(prediction.x, prediction.z))) {
      predMarker.visible = false;
      return;
    }
    predMarker.position.set(prediction.x, 0, prediction.z);
    predMarker.visible = true;
    const rec = tiles.get(keyOf(prediction.x, prediction.z));
    if (rec?.frame) rec.frame.material = kit.basic(PAL.terra, { side: THREE.DoubleSide });
    predMarker.userData.frame.visible = !rec?.frame;
  }

  function setPrediction(tile) {
    if (destroyed) return;
    prediction = tile && Number.isFinite(tile.x) && Number.isFinite(tile.z) ? { x: tile.x, z: tile.z } : null;
    if (renderer && level) setPredictionMarker();
    refreshTilemap();
    if (prediction && !reduced) pressTile(prediction.x, prediction.z);
    requestRender();
  }

  function resize() {
    if (destroyed) return;
    if (renderer && !flat) fitCamera();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf); raf = 0;
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* already detached */ } }
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    if (scene) disposeTree(scene);
    if (kit) kit.dispose();
    glowTex?.dispose(); shadowTex?.dispose();
    if (renderer) {
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* context already gone */ }
      canvas.remove();
    }
    for (const node of owned) node.remove();
    container.classList.remove('is-flat', 'is-3d');
    delete container.dataset.act;
    scene = camera = renderer = canvas = levelGroup = worldGroup = pip = null;
    tiles.clear(); buttons.clear(); pickables = [];
  }

  // ---- boot --------------------------------------------------------------
  const gl = forcedFlat ? false : initGL();
  if (!gl) {
    flat = true;
    if (!forcedFlat) flatReason = 'This device could not start 3D graphics, so the garden is shown as a flat map. Every tile still works as a button.';
  }
  applyFlatClass();
  if (flatReason) showNote(flatReason);
  if (renderer) {
    bindPointer();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (typeof ResizeObserver === 'function') {
      let pending = false;
      ro = new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; if (!destroyed) resize(); });
      });
      ro.observe(container);
    } else {
      on(window, 'resize', resize);
    }
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(entries => {
        onScreen = entries.some(e => e.isIntersecting);
        if (onScreen) requestRender();
      });
      io.observe(container);
    }
    on(document, 'visibilitychange', () => { if (!document.hidden) { lastTime = 0; requestRender(); } });
  }
  updateReadout();

  return { setLevel, renderState, setPrediction, resize, destroy, isFlat: () => flat };
}
