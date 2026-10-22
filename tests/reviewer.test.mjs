import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTIONS, parseProgram, advance, initialState, undo, runProgram, tileLabel } from '../src/engine.js';
import { LEVELS } from '../src/levels.js';
import { STORAGE_KEY, blankProgress, validateProgress, exportProgress, importProgress, loadProgress, saveProgress } from '../src/progress.js';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Independent, deterministic reference interpreter, intentionally not using
// DIRECTIONS or any transition helpers from the implementation under review.
function reference(level, names) {
  let { x, z, heading } = level.start;
  const trail = [{ x, z }];
  const delta = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const occupied = new Set(level.tiles.map(t => `${t.x},${t.z}`));
  for (let index = 0; index < names.length; index++) {
    if (names[index] === 'left') heading = (heading + 3) % 4;
    if (names[index] === 'right') heading = (heading + 1) % 4;
    if (names[index] === 'step') {
      const nx = x + delta[heading][0], nz = z + delta[heading][1];
      if (!occupied.has(`${nx},${nz}`)) return { x, z, heading, trail, pc: index + 1, status: 'blocked' };
      x = nx; z = nz; trail.push({ x, z });
    }
  }
  return { x, z, heading, trail, pc: names.length, status: x === level.goal.x && z === level.goal.z ? 'success' : 'complete' };
}

test('review: 1,200 seeded programs agree with an independent movement model', () => {
  let seed = 0x137bba90;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const vocabulary = ['step', 'left', 'right'];
  for (let count = 0; count < 1200; count++) {
    const level = LEVELS[count % LEVELS.length];
    const names = Array.from({ length: 1 + random(level.maxCommands) }, () => vocabulary[random(3)]);
    const actual = runProgram(level, names.map(name => `${name}()`).join('\n'));
    const expected = reference(level, names);
    for (const field of ['x', 'z', 'heading', 'pc', 'status', 'trail']) {
      assert.deepEqual(actual[field], expected[field], `${level.id}, ${names.join(',')}, ${field}`);
    }
  }
});

test('review: each transition preserves prior states and undo restores every snapshot', () => {
  for (const level of LEVELS) {
    const source = level.id === 'your-route' ? 'step()\nright()\nstep()\nstep()' : level.program;
    const commands = parseProgram(source, level.maxCommands);
    let state = initialState(level);
    const snapshots = [];
    for (let i = 0; i < commands.length; i++) {
      const prior = structuredClone(state);
      const next = advance(level, state, commands);
      assert.deepEqual(state, prior, 'advance must not mutate an input or earlier trail');
      snapshots.push(prior);
      state = next;
      if (state.status === 'blocked') break;
    }
    while (snapshots.length) {
      const prior = structuredClone(state);
      const restored = undo(state);
      assert.deepEqual(state, prior, 'undo must not mutate its input');
      assert.deepEqual(restored, snapshots.pop());
      state = restored;
    }
  }
});

test('review: every level has a legal route within its actual command budget', () => {
  for (const level of LEVELS) {
    const start = { ...level.start, route: [] }, queue = [start], seen = new Set();
    let found = null;
    while (queue.length) {
      const current = queue.shift(), key = `${current.x},${current.z},${current.heading}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (current.x === level.goal.x && current.z === level.goal.z) { found = current.route; break; }
      if (current.route.length >= level.maxCommands) continue;
      for (const command of ['step', 'left', 'right']) {
        const candidate = reference({ ...level, start: current }, [command]);
        if (candidate.status !== 'blocked') queue.push({ ...candidate, route: [...current.route, command] });
      }
    }
    assert.ok(found, `${level.id} must remain solvable`);
    assert.equal(runProgram(level, found.map(command => `${command}()`).join('\n')).status, 'success');
  }
});

test('review: parser reports the physical line after CRLF, comments and blanks', () => {
  assert.throws(() => parseProgram('# note\r\n\r\nstep()\r\nright(1)'), error => error.line === 4 && error.message.startsWith('Line 4:'));
  const source = 'step()\n# this is never executed: globalThis.compromised = true\nleft()';
  assert.deepEqual(parseProgram(source).map(item => item.line), [1, 3]);
});

test('review: hostile extra save keys cannot flow into the saved application shape', () => {
  const raw = JSON.parse('{"version":2,"stage":1,"completed":["first-look","first-look","fake"],"programs":{"wrong-turn":"step()","__proto__":{"polluted":true}},"hintCounts":{"wrong-turn":999},"prediction":{"x":3,"z":2,"secret":"not retained"},"__proto__":{"polluted":true},"accessToken":"not retained"}');
  const result = validateProgress(raw);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(blankProgress()).sort());
  assert.deepEqual(result.completed, ['first-look']);
  assert.deepEqual(result.programs, { 'wrong-turn': 'step()' });
  assert.deepEqual(result.prediction, { x: 3, z: 2 });
  assert.equal(result.hintCounts['wrong-turn'], 3);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(importProgress(exportProgress(result)), result);
});

test('review: unavailable storage does not break the persistence helpers', () => {
  assert.ok(loadProgress(null).error);
  const result = saveProgress(null, blankProgress());
  assert.ok(result.error);
  assert.equal(result.progress.version, blankProgress().version);
});

test('review: standalone packager preserves literal replacement tokens in bundled code', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lantern-packager-review-'));
  try {
    mkdirSync(join(temporary, 'dist', 'assets'), { recursive: true });
    writeFileSync(join(temporary, 'dist', 'index.html'), '<html><head><link rel="stylesheet" href="./assets/main.css"><link rel="icon" href="./icon.svg"></head><body><script type="module" src="./assets/main.js"></script></body></html>');
    const js = 'const replacement = "$& $` $\' $$"; console.log(replacement);';
    writeFileSync(join(temporary, 'dist', 'assets', 'main.js'), js);
    writeFileSync(join(temporary, 'dist', 'assets', 'main.css'), 'body{color:green}');
    writeFileSync(join(temporary, 'dist', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const script = fileURLToPath(new URL('../scripts/package-review.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const output = readFileSync(join(temporary, 'artifacts', 'Lantern-Garden-Review.html'), 'utf8');
    assert.ok(output.includes(js), 'String.replace must not interpolate $&/$`/$\'/$$ from embedded JavaScript');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

// A deliberately minimal DOM renderer harness. These controller tests supplement,
// not replace, the real browser/layout/offline acceptance run.
import { bootController } from './helpers/controller-harness.mjs';

test('review: controller can complete all three activities and recap without the visual renderer', () => {
  const { element: e, readStored } = bootController();
  assert.equal(e('run-button').disabled, true, 'a first prediction is required');
  e('prediction-options').children[0].click(); // Intentionally predict B4, not the answer.
  for (let i = 0; i < 4; i++) e('step-button').click();
  assert.match(e('feedback').textContent, /You predicted B4; Pip reached D3/);
  assert.equal(e('continue-button').hidden, false);
  e('continue-button').click();
  assert.equal(e('program').readOnly, false);
  for (let i = 0; i < 4; i++) e('step-button').click();
  assert.match(e('feedback').textContent, /Pip stopped at D1/);
  assert.equal(e('continue-button').hidden, true);
  e('undo-button').click();
  assert.match(e('model-label').textContent, /D2 · facing north/);
  e('program').value = 'step()\nstep()\nright()\nstep()';
  e('program').listeners.input();
  for (let i = 0; i < 4; i++) e('step-button').click();
  e('continue-button').click();
  e('program').value = 'step()\nright()\nstep()\nstep()';
  e('program').listeners.input();
  for (let i = 0; i < 4; i++) e('step-button').click();
  assert.equal(JSON.parse(readStored()).completed.length, 3);
  e('continue-button').click();
  assert.equal(e('ending').hidden, false);
  const summary = e('journal-summary');
  summary.querySelectorAll('button').find(child => child.textContent === 'Pip’s direction').click();
  assert.ok(summary.querySelectorAll('p').some(child => /Only step\(\) moves Pip/.test(child.textContent)));
});

test('review: controller survives a denied localStorage getter and retains unsaved play', () => {
  const { element: e } = bootController({ denied: true });
  assert.match(e('save-status').textContent, /could not be opened/);
  e('prediction-options').children[2].click();
  for (let i = 0; i < 4; i++) e('step-button').click();
  assert.equal(e('continue-button').hidden, false);
  assert.match(e('save-status').textContent, /Saving is unavailable/);
});

test('review: imported scaffold cannot lock the first activity with an empty readonly draft', () => {
  const progress = blankProgress();
  progress.programs['first-look'] = '';
  const { element: e } = bootController({ saved: JSON.stringify(progress) });
  assert.equal(e('program').value, LEVELS[0].program);
  assert.equal(e('program').maxLength, 4000);
});

test('review: unreadable local data remains untouched until a deliberate change', () => {
  const saved = '{not-json';
  const { element: e, readStored } = bootController({ saved });
  assert.equal(readStored(), saved);
  e('prediction-options').children[0].click();
  assert.equal(JSON.parse(readStored()).prediction.x, 1);
});

test('review: erase preserves an honest warning when removing and writing are both denied', () => {
  const storage = { getItem: () => JSON.stringify(blankProgress()), setItem() { throw Error('No writes'); }, removeItem() { throw Error('No removals'); } };
  const { element: e } = bootController({ storageOverride: storage });
  e('erase-button').click();
  assert.match(e('feedback').textContent, /stored progress could not be erased/);
  assert.match(e('feedback').textContent, /old save may return on reload/);
});

test('review: imported and erased reduced-motion settings stay synchronized with the checkbox', async () => {
  const { element: e } = bootController();
  const imported = blankProgress(); imported.reducedMotion = true;
  await e('import-file').listeners.change({ target: { files: [{ size: 200, text: async () => exportProgress(imported) }], value: 'backup.json' } });
  assert.equal(e('reduce-motion-toggle').checked, true);
  e('erase-button').click();
  assert.equal(e('reduce-motion-toggle').checked, false);
});

test('review: field journal contains keyboard focus and restores the same saved work on Escape', () => {
  const progress = blankProgress();
  progress.stage = 2; progress.completed = LEVELS.map(level => level.id);
  progress.programs['your-route'] = 'step()\nright()\nstep()\nstep()';
  const { element: e, document } = bootController({ saved: JSON.stringify(progress) });
  e('continue-button').click();
  assert.equal(e('ending').attributes.role, 'dialog');
  assert.equal(e('ending').attributes['aria-modal'], 'true');
  assert.equal(document.querySelector('.stage').inert, true);
  assert.equal(document.querySelector('.notebook').inert, true);
  assert.equal(document.activeElement, e('ending-title'));
  const buttons = e('ending').querySelectorAll('button:not([disabled])');
  assert.ok(buttons.length >= 5, 'recap, download, replay, and return controls are present');
  let prevented = false;
  e('ending').listeners.keydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, buttons.at(-1));
  e('ending').listeners.keydown({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(document.activeElement, buttons[0]);
  e('ending').listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(e('ending').hidden, true);
  assert.equal(document.querySelector('.stage').inert, false);
  assert.equal(document.querySelector('.notebook').inert, false);
  assert.equal(e('program').value, progress.programs['your-route']);
  assert.equal(document.activeElement, e('lesson-title'));
});

test('review: clues are delivered to the live feedback region even when their panel is offscreen', () => {
  const { element: e } = bootController();
  e('hint-button').click();
  assert.equal(e('hint-panel').hidden, false);
  assert.equal(e('feedback').textContent, `Clue 1: ${LEVELS[0].hints[0]}`);
});

const settleAsync = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function controlledTimers() {
  let serial = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout: callback => { const id = ++serial; pending.set(id, callback); return id; },
    clearTimeout: id => pending.delete(id),
    fire: () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback()); },
  };
}
function mockWorker(state) {
  const listeners = [];
  return { state, addEventListener: (_, callback) => listeners.push(callback), transition(next) { this.state = next; listeners.forEach(callback => callback()); } };
}

test('review: production controller reports first-install rejection instead of waiting on ready forever', async () => {
  const timers = controlledTimers(), worker = mockWorker('redundant');
  const serviceWorker = { register: async () => ({ installing: worker, waiting: null, active: null }), ready: new Promise(() => {}), addEventListener() {} };
  const { element: e } = bootController({ protocol: 'https:', dev: false, navigatorOverride: { serviceWorker, onLine: true }, timers });
  await settleAsync();
  assert.match(e('offline-status').textContent, /Offline setup failed/);
  assert.equal(timers.pending.size, 0);
});

test('review: production controller does not mistake an old active worker for a failed update being ready', async () => {
  const timers = controlledTimers(), worker = mockWorker('installing');
  const registration = { installing: worker, waiting: null, active: {} };
  const serviceWorker = { register: async () => registration, ready: Promise.resolve(registration), addEventListener() {} };
  const { element: e } = bootController({ protocol: 'https:', dev: false, navigatorOverride: { serviceWorker, onLine: true }, timers });
  await settleAsync();
  assert.match(e('offline-status').textContent, /Preparing/);
  worker.transition('redundant'); await settleAsync();
  assert.match(e('offline-status').textContent, /Offline setup failed/);
  assert.equal(timers.pending.size, 0);
});

test('review: production controller announces readiness only after the new worker activates', async () => {
  const timers = controlledTimers(), worker = mockWorker('installing');
  const registration = { installing: worker, waiting: null, active: null };
  const serviceWorker = { register: async () => registration, ready: Promise.resolve(registration), addEventListener() {} };
  const { element: e } = bootController({ protocol: 'https:', dev: false, navigatorOverride: { serviceWorker, onLine: true }, timers });
  await settleAsync();
  assert.match(e('offline-status').textContent, /Preparing/);
  registration.active = worker; worker.transition('activated'); await settleAsync();
  assert.equal(e('offline-status').textContent, 'Ready for offline play');
  assert.equal(timers.pending.size, 0);
});

test('review: production readiness times out even if no installing worker can be observed', async () => {
  const timers = controlledTimers();
  const registration = { installing: null, waiting: null, active: null };
  const serviceWorker = { register: async () => registration, ready: new Promise(() => {}), addEventListener() {} };
  const { element: e } = bootController({ protocol: 'https:', dev: false, navigatorOverride: { serviceWorker, onLine: true }, timers });
  await settleAsync();
  timers.fire(); await settleAsync();
  assert.match(e('offline-status').textContent, /Offline setup failed/);
});

test('review: production readiness also times out when worker registration itself stalls', async () => {
  const timers = controlledTimers();
  const serviceWorker = { register: () => new Promise(() => {}), ready: new Promise(() => {}), addEventListener() {} };
  const { element: e } = bootController({ protocol: 'https:', dev: false, navigatorOverride: { serviceWorker, onLine: true }, timers });
  await settleAsync();
  timers.fire(); await settleAsync();
  assert.match(e('offline-status').textContent, /Offline setup failed/);
  assert.equal(timers.pending.size, 0);
});
