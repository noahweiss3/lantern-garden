import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { LEVELS } from '../src/levels.js';
import { blankProgress, exportProgress } from '../src/progress.js';
import { initialState, parseProgram, advance } from '../src/engine.js';
import { bootController } from './helpers/controller-harness.mjs';
import { rendererHarness, robotPose } from './helpers/renderer-harness.mjs';

const controllerSnapshot = h => JSON.parse(h.evaluate('JSON.stringify({progress,state,commands,running,runToken,hintIndex})'));
const settleAsync = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function timers() {
  let serial = 0;
  const pending = new Map();
  return { pending, setTimeout: callback => { const id = ++serial; pending.set(id, callback); return id; }, clearTimeout: id => pending.delete(id),
    fire() { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback()); } };
}
function completeSave() {
  const progress = blankProgress(); progress.stage = 2; progress.completed = LEVELS.map(level => level.id);
  progress.programs['your-route'] = 'step()\nright()\nstep()\nstep()'; return progress;
}
function assertWorldRestored(h) {
  const snapshot = controllerSnapshot(h), world = h.worlds.at(-1);
  assert.deepEqual(world.state, snapshot.state);
  assert.equal(world.level.id, LEVELS[snapshot.progress.stage].id);
  assert.deepEqual(world.prediction, snapshot.progress.stage === 0 ? snapshot.progress.prediction : null);
  assert.equal(world.renderOptions.snap, true, 'recreated renderer must render the current discrete pose, not animate from dock');
}

test('fix review: six view changes preserve exact controller state, history, code, hints, prediction and local progress without navigating', () => {
  const h = bootController(), e = h.element;
  e('prediction-options').children[3].click();
  for (let i = 0; i < 3; i++) e('step-button').click();
  e('hint-button').click();
  const before = controllerSnapshot(h), stored = h.readStored(), href = h.evaluate('location.href'), code = e('program').value, feedback = e('feedback').textContent;
  assert.equal(before.state.heading, 0); assert.equal(before.state.x, 3); assert.equal(before.state.z, 3);
  for (let i = 0; i < 6; i++) {
    e('flat-toggle').click();
    assert.equal(h.worlds.at(-1).isFlat(), i % 2 === 0);
    assert.deepEqual(controllerSnapshot(h), before, `controller snapshot after switch ${i + 1}`);
    assertWorldRestored(h);
    assert.equal(h.readStored(), stored, 'view-only action must not rewrite progress');
    assert.equal(e('program').value, code); assert.equal(h.evaluate('location.href'), href); assert.equal(e('feedback').textContent, feedback, 'view announcements do not erase teaching, clue or error feedback');
    assert.match(e('view-status').textContent, /view.*unchanged/);
    assert.equal(e('code-lines').children.find(node => node.className === 'is-active').dataset.line, '3');
  }
  for (const world of h.worlds.slice(0, -1)) { assert.equal(world.destroyed, true); assert.equal(world.destroyCount, 1); }
  assert.equal(h.worlds.at(-1).destroyed, false);
  e('undo-button').click(); assert.match(e('model-label').textContent, /D4.*east/);
  e('step-button').click(); e('step-button').click();
  assert.equal(e('continue-button').hidden, false); assert.match(e('model-label').textContent, /D3.*north/);
});

test('fix review: toggles preserve an active async Run, its token, pending delay, and final undo history', async () => {
  const clock = timers(), h = bootController({ timers: clock }), e = h.element;
  e('prediction-options').children[2].click();
  const run = e('run-button').click();
  const before = controllerSnapshot(h);
  assert.equal(before.running, true); assert.equal(before.state.pc, 1); assert.equal(clock.pending.size, 1);
  for (let i = 0; i < 3; i++) { e('flat-toggle').click(); assert.deepEqual(controllerSnapshot(h), before); assertWorldRestored(h); }
  assert.equal(clock.pending.size, 1, 'view switching must not introduce a second run timer');
  for (let i = 0; i < 3; i++) { clock.fire(); await settleAsync(); }
  await run;
  const after = controllerSnapshot(h);
  assert.equal(after.running, false); assert.equal(after.state.pc, 4); assert.equal(after.state.status, 'success');
  assert.equal(after.state.history.length, 4); assert.equal(clock.pending.size, 0);
  e('undo-button').click(); assert.match(e('model-label').textContent, /D4.*north/);
});

test('fix review: a flat URL, reduced-motion changes, parser errors and imported/erased progress do not lock or desynchronize view switching', async () => {
  const h = bootController({ saved: JSON.stringify(completeSave()), flat: true }), e = h.element;
  assert.equal(h.worlds.at(-1).isFlat(), true);
  e('program').value = 'step()\n# draft\nright()'; e('program').listeners.input(); e('step-button').click();
  const before = controllerSnapshot(h);
  e('flat-toggle').click(); assert.equal(h.worlds.at(-1).isFlat(), false); assert.deepEqual(controllerSnapshot(h), before);
  e('reduce-motion-toggle').listeners.change({ target: { checked: true } });
  assert.equal(h.worlds.at(-1).options.reducedMotion, true); assert.equal(h.worlds.at(-1).isFlat(), false);
  assert.deepEqual(controllerSnapshot(h).state, before.state); assertWorldRestored(h);
  e('program').value = 'while(true) {}'; e('program').listeners.input(); e('run-button').click();
  const parseState = controllerSnapshot(h);
  assert.match(e('feedback').textContent, /Line 1/);
  e('flat-toggle').click(); assert.equal(h.worlds.at(-1).isFlat(), true); assert.deepEqual(controllerSnapshot(h), parseState);
  assert.match(e('feedback').textContent, /Line 1/, 'parser error remains visible after view switch');
  const imported = blankProgress(); imported.stage = 1; imported.programs['wrong-turn'] = 'step()\nstep()\nright()\nstep()';
  await e('import-file').listeners.change({ target: { files: [{ size: 300, text: async () => exportProgress(imported) }], value: 'backup.json' } });
  assert.equal(h.worlds.at(-1).isFlat(), true); assert.equal(h.worlds.at(-1).options.reducedMotion, false);
  assert.equal(e('program').value, imported.programs['wrong-turn']); assertWorldRestored(h);
  e('erase-button').click(); assert.equal(h.worlds.at(-1).isFlat(), true); assert.equal(controllerSnapshot(h).progress.stage, 0);
  e('flat-toggle').click(); assert.equal(h.worlds.at(-1).isFlat(), false);
});

test('fix review: fallback reports actual flat mode and repeated unavailable-3D attempts preserve play', () => {
  const h = bootController({ failGL: true }), e = h.element;
  e('prediction-options').children[2].click(); e('step-button').click();
  const before = controllerSnapshot(h);
  for (let i = 0; i < 4; i++) {
    e('flat-toggle').click();
    assert.equal(h.worlds.at(-1).options.flatView, false, 'a toggle from actual fallback should retry 3D, not toggle a stale preference');
    assert.equal(h.worlds.at(-1).isFlat(), true); assert.deepEqual(controllerSnapshot(h), before); assertWorldRestored(h);
    assert.match(e('view-status').textContent, /3D graphics could not start.*route is unchanged/);
    assert.match(e('feedback').textContent, /Line 1: step/);
  }
  for (let i = 0; i < 3; i++) e('step-button').click();
  assert.equal(e('continue-button').hidden, false);
});

test('fix review: recap question owns answer buttons and atomic inline feedback while journal actions remain separate', () => {
  const h = bootController({ saved: JSON.stringify(completeSave()) }), e = h.element;
  e('continue-button').click();
  const summary = e('journal-summary'), question = e('recap-question'), feedback = e('recap-feedback');
  assert.equal(question.tagName, 'fieldset'); assert.equal(question.children[0].tagName, 'legend');
  assert.match(question.children[0].textContent, /when right\(\) runs, what changes/);
  assert.deepEqual(summary.children.map(node => node.tagName), ['p', 'fieldset', 'div']);
  assert.deepEqual(question.children.map(node => node.tagName), ['legend', 'div', 'p']);
  assert.equal(question.children[1].className, 'recap-choices'); assert.equal(question.children[2], feedback);
  assert.equal(summary.children[2].className, 'journal-actions'); assert.equal(summary.children[2].children[0].textContent, 'Save field journal');
  assert.deepEqual(feedback.attributes, { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const answers = question.querySelectorAll('button');
  assert.deepEqual(answers.map(node => node.textContent), ['Pip’s direction', 'Pip’s tile']);
  for (const answer of answers) { assert.equal(answer.attributes['aria-describedby'], 'recap-feedback'); assert.equal(answer.attributes['aria-pressed'], 'false'); }
  answers[1].click(); assert.match(feedback.textContent, /turning on the spot/); assert.equal(answers[1].attributes['aria-pressed'], 'true');
  answers[0].click(); assert.match(feedback.textContent, /Exactly.*Only step\(\) moves/);
  assert.equal(answers[0].attributes['aria-pressed'], 'true'); assert.equal(answers[1].attributes['aria-pressed'], 'false');
  assert.equal(question.children[2], feedback, 'feedback is updated in place, not moved into the action flow');
  e('ending').listeners.keydown({ key: 'Escape', preventDefault() {} });
  e('continue-button').click();
  assert.equal(e('journal-summary').querySelectorAll('button').length, 3, 'reopening journal does not duplicate answers or save');
  assert.equal(e('recap-feedback').textContent, 'Choose an answer to check your thinking.');
  assert.equal(h.document.activeElement, e('ending-title'));
});

test('fix review: explicit renderer flatView overrides URL mode in both directions and isFlat reports fallback truthfully', () => {
  for (const options of [{ flat: true, flatView: false }, { flat: false, flatView: true }, { failGL: true, flatView: false }]) {
    const h = rendererHarness(options); h.world.setLevel(LEVELS[0]); h.world.renderState(initialState(LEVELS[0]), { snap: true });
    const expected = options.failGL || options.flatView;
    assert.equal(h.world.isFlat(), expected); assert.equal(h.container.classList.contains('is-flat'), expected);
    assert.equal(h.container.querySelector('.tilemap-grid').children.filter(node => node.tagName === 'button').length, LEVELS[0].tiles.length);
    h.world.destroy(); assert.equal(h.container.children.length, 0); assert.equal(h.frames.size, 0);
  }
});

test('fix review: renderer restore snaps exact current pose for all headings without reduced motion, then cleans up every frame and canvas handler', () => {
  for (let heading = 0; heading < 4; heading++) {
    const h = rendererHarness({ reducedMotion: false });
    h.world.setLevel(LEVELS[0]);
    h.world.renderState({ ...initialState(LEVELS[0]), x: 3, z: 3, heading, status: 'running', trail: [{ x: 1, z: 3 }, { x: 2, z: 3 }, { x: 3, z: 3 }] }, { snap: true });
    h.frame(16);
    const { root, yawGroup } = robotPose(h.scene);
    assert.equal(root.position.x, 3); assert.equal(root.position.z, 3);
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(yawGroup.rotation), expected = [[0, -1], [1, 0], [0, 1], [-1, 0]][heading];
    assert.ok(Math.abs(forward.x - expected[0]) < 1e-10 && Math.abs(forward.z - expected[1]) < 1e-10);
    assert.match(h.container.querySelector('.tilemap-grid').children.find(node => node.dataset.x === '3' && node.dataset.z === '3').attributes['aria-label'], /Pip is here/);
    const renderer = h.renderer, canvas = renderer.domElement;
    assert.equal(h.frames.size, 1, 'normal-motion renderer may keep one bounded animation request');
    h.world.destroy(); h.world.destroy();
    assert.equal(h.frames.size, 0); assert.equal(h.container.children.length, 0); assert.deepEqual(canvas.listeners, {});
    assert.equal(renderer.disposed, true); assert.equal(renderer.contextReleased, true);
  }
});

test('fix review: repeated real renderer recreation preserves tile/trail/prediction data and reduced-motion renderers stay idle', () => {
  const h = rendererHarness({ reducedMotion: true });
  let world = h.world, state = initialState(LEVELS[0]);
  const commands = parseProgram(LEVELS[0].program);
  for (let i = 0; i < 3; i++) state = advance(LEVELS[0], state, commands);
  for (let i = 0; i < 8; i++) {
    if (i) world = h.create({ flatView: i % 2 === 1 });
    world.setLevel(LEVELS[0]); world.renderState(state, { snap: true }); world.setPrediction({ x: 3, z: 2 }); h.frame(16);
    assert.equal(world.isFlat(), i % 2 === 1);
    const buttons = h.container.querySelector('.tilemap-grid').children.filter(node => node.tagName === 'button');
    assert.equal(buttons.length, LEVELS[0].tiles.length);
    assert.equal(buttons.find(node => node.dataset.x === '3' && node.dataset.z === '2').attributes['aria-pressed'], 'true');
    assert.match(buttons.find(node => node.dataset.x === '3' && node.dataset.z === '3').attributes['aria-label'], /Pip is here, facing north/);
    assert.match(buttons.find(node => node.dataset.x === '2' && node.dataset.z === '3').attributes['aria-label'], /crossed/);
    assert.equal(h.frames.size, 0);
    world.destroy(); assert.equal(h.container.children.length, 0); assert.equal(h.frames.size, 0);
  }
});

test('fix review: view help and authored recap layout encode no reload or feedback/action flex interleaving', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html.match(/id="flat-help"[^>]*>([^<]*)</)?.[1] || '', /page reloads/i);
  assert.match(html, /without reloading or changing your route/);
  assert.doesNotMatch(main, /location\.(?:href\s*=|reload\s*\()/);
  assert.doesNotMatch(css.match(/#journal-summary\s*\{([^}]*)\}/)?.[1] || '', /display:\s*(?:flex|grid)/);
  assert.match(css, /\.recap-choices\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.recap-feedback\s*\{[^}]*margin-top:/);
  assert.match(css, /\.journal-actions\s*\{[^}]*margin-top:/);
});

test('fix review: normal steps still animate and context loss exposes actual flat fallback before safe teardown', () => {
  const h = rendererHarness({ reducedMotion: false });
  h.world.setLevel(LEVELS[0]);
  let state = initialState(LEVELS[0]); h.world.renderState(state); h.frame(16);
  state = advance(LEVELS[0], state, parseProgram(LEVELS[0].program));
  h.world.renderState(state); h.frame(50);
  const { root } = robotPose(h.scene);
  assert.ok(root.position.x > 1 && root.position.x < 2, `ordinary step still interpolates between tiles, got ${root.position.x}`);
  let prevented = false;
  h.renderer.domElement.listeners.webglcontextlost({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(h.world.isFlat(), true); assert.equal(h.frames.size, 0);
  assert.equal(h.container.classList.contains('is-flat'), true);
  assert.match(h.container.querySelector('.world-note').textContent, /3D drawing was interrupted/);
  h.world.renderState(state, { snap: true });
  const tiles = h.container.querySelector('.tilemap-grid').children;
  assert.match(tiles.find(node => node.dataset.x === '2' && node.dataset.z === '3').attributes['aria-label'], /Pip is here, facing east/);
  h.world.destroy(); assert.equal(h.frames.size, 0); assert.equal(h.container.children.length, 0);
});
