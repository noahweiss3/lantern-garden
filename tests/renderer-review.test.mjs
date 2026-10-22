import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ActualThree from 'three';
import { LEVELS } from '../src/levels.js';
import { initialState, advance, parseProgram } from '../src/engine.js';
import { batchStaticScenery } from '../src/batch-scenery.js';

// Actual Three geometry/math, but no real GPU or browser. This verifies renderer
// state construction; it deliberately does not claim visual/performance proof.
const source = readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');
import { rendererHarness, robotPose } from './helpers/renderer-harness.mjs';

test('renderer review: forced flat map preserves accessible coordinates, heading and keyboard navigation', () => {
  const h = rendererHarness({ flat: true });
  h.world.setLevel(LEVELS[0]); h.world.renderState(initialState(LEVELS[0]));
  assert.equal(h.container.classList.contains('is-flat'), true);
  const grid = h.container.querySelector('.tilemap-grid');
  const tiles = grid.children.filter(element => element.tagName === 'button');
  assert.equal(tiles.length, LEVELS[0].tiles.length);
  const start = tiles.find(tile => tile.dataset.x === '1' && tile.dataset.z === '3');
  assert.match(start.attributes['aria-label'], /Tile B4, start dock, Pip is here, facing east/);
  assert.equal(start.tabIndex, 0);
  let prevented = false;
  grid.listeners.keydown({ target: start, key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.document.activeElement.dataset.x, '2');
  grid.listeners.click({ target: start });
  assert.equal(h.selections[0].x, 1); assert.equal(h.selections[0].z, 3);
  h.world.setPrediction({ x: 1, z: 3 });
  assert.equal(start.attributes['aria-pressed'], 'true');
  h.world.destroy(); assert.equal(h.container.children.length, 0);
});

test('renderer review: failed WebGL construction falls back to the complete real-button map', () => {
  const h = rendererHarness({ failGL: true }); h.world.setLevel(LEVELS[1]);
  assert.equal(h.container.classList.contains('is-flat'), true);
  assert.match(h.container.querySelector('.world-note').textContent, /could not start 3D graphics/);
  assert.equal(h.container.querySelector('.tilemap-grid').children.filter(element => element.tagName === 'button').length, LEVELS[1].tiles.length);
  h.world.destroy();
});

test('renderer review: reduced-motion pose exactly matches all four headings without an animation loop', () => {
  const h = rendererHarness(); h.world.setLevel(LEVELS[0]);
  for (let heading = 0; heading < 4; heading++) {
    h.world.renderState({ ...initialState(LEVELS[0]), heading }); h.frame();
    const { yawGroup, root } = robotPose(h.scene);
    const forward = new ActualThree.Vector3(0, 0, -1).applyEuler(yawGroup.rotation);
    const expected = [[0, -1], [1, 0], [0, 1], [-1, 0]][heading];
    assert.ok(Math.abs(forward.x - expected[0]) < 1e-10 && Math.abs(forward.z - expected[1]) < 1e-10);
    assert.equal(root.position.x, LEVELS[0].start.x); assert.equal(root.position.z, LEVELS[0].start.z);
    assert.equal(h.frames.size, 0, 'reduced motion must not maintain a rendering loop');
  }
  h.world.destroy(); assert.equal(h.renderer.disposed, true); assert.equal(h.renderer.contextReleased, true);
});

test('renderer review: rapid Step-Step-Turn starts the turn at D4 instead of the stale dock', () => {
  const h = rendererHarness({ reducedMotion: false }); h.world.setLevel(LEVELS[0]);
  let state = initialState(LEVELS[0]); const commands = parseProgram(LEVELS[0].program);
  h.world.renderState(state); h.frame(16);
  for (let i = 0; i < 3; i++) { state = advance(LEVELS[0], state, commands); h.world.renderState(state); }
  h.frame(50);
  const { root } = robotPose(h.scene);
  assert.equal(root.position.x, 3); assert.equal(root.position.z, 3);
  h.world.destroy(); assert.equal(h.frames.size, 0);
});

test('renderer review: every map builds bounded local geometry and no unsafe host-code/network calls', () => {
  assert.doesNotMatch(source, /\b(?:eval|fetch|XMLHttpRequest|WebSocket)\s*\(|new\s+Function\s*\(/);
  for (const level of LEVELS) {
    const h = rendererHarness(); h.world.setLevel(level); h.world.renderState(initialState(level)); h.frame();
    let objects = 0, drawCandidates = 0, triangles = 0;
    h.scene.traverse(object => {
      objects++; let visible = object.visible, ancestor = object.parent;
      while (ancestor) { visible &&= ancestor.visible; ancestor = ancestor.parent; }
      if (visible && (object.isMesh || object.isPoints || object.isSprite)) {
        drawCandidates++;
        if (object.geometry) triangles += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3 * (object.isInstancedMesh ? object.count : 1);
      }
    });
    assert.ok(objects < 2000 && drawCandidates < 800 && triangles < 50000, `${level.id}: ${objects} objects, ${drawCandidates} candidates, ${triangles} triangles`);
    h.world.destroy();
  }
});

function sceneStats(scene) {
  scene.updateMatrixWorld(true);
  let triangles = 0, drawCandidates = 0, pickableMeshes = 0;
  scene.traverse(object => {
    if (object.userData.tile || object.userData.pip) pickableMeshes++;
    let visible = object.visible, ancestor = object.parent;
    while (ancestor) { visible &&= ancestor.visible; ancestor = ancestor.parent; }
    if (visible && (object.isMesh || object.isPoints || object.isSprite)) {
      drawCandidates++;
      if (object.geometry) triangles += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3 * (object.isInstancedMesh ? object.count : 1);
    }
  });
  return { triangles, drawCandidates, pickableMeshes, bounds: new ActualThree.Box3().setFromObject(scene, true) };
}

test('renderer review: batching preserves complete-map triangle counts, exact bounds and pickable nodes', () => {
  for (const level of LEVELS) {
    const original = rendererHarness({ batching: false }), batched = rendererHarness();
    for (const h of [original, batched]) { h.world.setLevel(level); h.world.renderState(initialState(level)); h.frame(); }
    const before = sceneStats(original.scene), after = sceneStats(batched.scene);
    assert.equal(after.triangles, before.triangles);
    assert.equal(after.pickableMeshes, before.pickableMeshes);
    for (const edge of ['min', 'max']) assert.ok(before.bounds[edge].distanceTo(after.bounds[edge]) < 1e-5, `${level.id} ${edge} bounds must not shift`);
    assert.ok(after.drawCandidates <= before.drawCandidates * 0.75, `${level.id}: ${before.drawCandidates} -> ${after.drawCandidates}`);
    original.world.destroy(); batched.world.destroy();
  }
});

function vertexCloud(root) {
  root.updateWorldMatrix(true, true);
  const points = [], point = new ActualThree.Vector3();
  root.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh) return;
    const geometry = object.geometry, positions = geometry.attributes.position;
    const size = geometry.index?.count || positions.count;
    for (let i = 0; i < size; i++) {
      point.fromBufferAttribute(positions, geometry.index ? geometry.index.getX(i) : i).applyMatrix4(object.matrixWorld);
      points.push([point.x, point.y, point.z].map(value => Math.round(value * 1e6)).join(','));
    }
  });
  return points.sort();
}

test('renderer review: batching preserves transformed triangle vertices and shared source ownership', () => {
  const root = new ActualThree.Group(); root.position.set(3, 5, 7); root.rotation.y = Math.PI / 2; root.scale.setScalar(2);
  const branch = new ActualThree.Group(); branch.position.set(1, 0, 2); branch.rotation.x = Math.PI / 2; root.add(branch);
  const material = new ActualThree.MeshLambertMaterial({ color: 0x467d44 });
  const geometry = new ActualThree.BoxGeometry(1, 2, 3); geometry.userData.shared = true;
  let originalDisposals = 0; geometry.addEventListener('dispose', () => originalDisposals++);
  for (const x of [-2, 2]) { const mesh = new ActualThree.Mesh(geometry, material); mesh.position.set(x, 1, 0); branch.add(mesh); }
  const before = vertexCloud(root), result = batchStaticScenery(root);
  assert.equal(result.removedDrawCandidates, 1); assert.equal(result.batches, 1);
  assert.deepEqual(vertexCloud(root), before);
  assert.equal(originalDisposals, 0, 'the kit, not the batcher, owns shared source geometry');
  const batch = root.children.find(child => child.name === 'Batched static scenery');
  assert.ok(batch); assert.notEqual(batch.geometry.userData.shared, true); assert.equal(batch.material, material);
  batch.geometry.dispose(); geometry.dispose(); material.dispose();
});

test('renderer review: batching leaves nested animated, clickable, translucent and instanced nodes intact', () => {
  const root = new ActualThree.Group(), animated = new ActualThree.Group(), decor = new ActualThree.Group();
  root.add(animated, decor);
  const geometry = new ActualThree.BoxGeometry(), material = new ActualThree.MeshLambertMaterial({ color: 0x467d44 });
  const stationary = [new ActualThree.Mesh(geometry, material), new ActualThree.Mesh(geometry, material)]; root.add(...stationary);
  const animatedMesh = new ActualThree.Mesh(geometry, material); animated.add(animatedMesh);
  const decorMesh = new ActualThree.Mesh(geometry, material); decor.add(decorMesh);
  const clickable = new ActualThree.Mesh(geometry, material); clickable.userData.tile = { x: 1, z: 1 }; root.add(clickable);
  const translucent = new ActualThree.Mesh(geometry, new ActualThree.MeshBasicMaterial({ transparent: true, opacity: 0.2 })); root.add(translucent);
  const instanced = new ActualThree.InstancedMesh(geometry, material, 2); root.add(instanced);
  batchStaticScenery(root, new Set([animated, decor]));
  assert.equal(animatedMesh.parent, animated); assert.equal(decorMesh.parent, decor);
  for (const mesh of [clickable, translucent, instanced]) assert.equal(mesh.parent, root);
  assert.ok(stationary.every(mesh => mesh.parent === null));
  animated.rotation.y = 0.7; decor.visible = false;
  assert.equal(animatedMesh.parent.rotation.y, 0.7); assert.equal(decorMesh.parent.visible, false);
  root.traverse(object => { if (object.geometry && object.geometry !== geometry) object.geometry.dispose(); });
  geometry.dispose(); material.dispose(); translucent.material.dispose(); instanced.dispose();
});

test('renderer review: batching never reveals invisible descendants or removes a child sprite', () => {
  const root = new ActualThree.Group(), hidden = new ActualThree.Group(); hidden.visible = false; root.add(hidden);
  const geometry = new ActualThree.BoxGeometry(), material = new ActualThree.MeshLambertMaterial({ color: 0x467d44 });
  const hiddenMesh = new ActualThree.Mesh(geometry, material); hidden.add(hiddenMesh);
  const parentMesh = new ActualThree.Mesh(geometry, material), sprite = new ActualThree.Sprite(new ActualThree.SpriteMaterial());
  parentMesh.add(sprite); root.add(parentMesh);
  const mirrored = new ActualThree.Mesh(geometry, material); mirrored.scale.x = -1; root.add(mirrored);
  root.add(new ActualThree.Mesh(geometry, material), new ActualThree.Mesh(geometry, material));
  batchStaticScenery(root);
  assert.equal(hiddenMesh.parent, hidden); assert.equal(hidden.visible, false);
  assert.equal(parentMesh.parent, root); assert.equal(sprite.parent, parentMesh);
  assert.equal(mirrored.parent, root);
  root.traverse(object => { if (object.geometry && object.geometry !== geometry) object.geometry.dispose(); });
  geometry.dispose(); material.dispose(); sprite.material.dispose();
});

test('renderer review: relay point light shares the centered garden coordinate system', () => {
  for (const level of LEVELS) {
    const h = rendererHarness(); h.world.setLevel(level); h.world.renderState(initialState(level)); h.frame();
    let light; h.scene.traverse(object => { if (object.isPointLight) light = object; });
    const actual = light.getWorldPosition(new ActualThree.Vector3());
    const expected = new ActualThree.Vector3(level.goal.x - 0.3 - (level.width - 1) / 2, 0.34 + 0.95, level.goal.z - 0.3 - (level.height - 1) / 2);
    assert.ok(actual.distanceTo(expected) < 1e-10, `${level.id} amber light must remain at the relay`);
    h.world.destroy();
  }
});
