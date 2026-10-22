import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { blankProgress, STORAGE_KEY } from '../src/progress.js';
import { LEVELS } from '../src/levels.js';

// Independent real-browser regressions for the embedded-document Flat View and
// completion recap fixes. Optional integration fixture: node --test tests/fix-playthrough.mjs.
// Requires browser process/loopback support. Cloud Chromium/software WebGL is not device certification.
let server, browser, base;
const browserErrors = [], externalRequests = [];
const launch = { executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(launch);
});
after(async () => {
  await browser?.close();
  await server?.close();
  assert.deepEqual(browserErrors, [], 'no uncaught browser errors during regressions');
  assert.deepEqual(externalRequests, [], 'all application resources must remain local');
});

async function openGarden({ saved, viewport = { width: 1440, height: 1000 }, reducedMotion = 'reduce', disableGL = false, flat = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  await context.addInitScript(({ saved, key, disableGL }) => {
    if (saved) localStorage.setItem(key, saved);
    const original = HTMLCanvasElement.prototype.getContext;
    window.__createdGL = 0;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/webgl/.test(type)) { if (disableGL) return null; window.__createdGL++; }
      return original.call(this, type, ...args);
    };
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    const pending = new Set();
    window.__reviewFrames = pending;
    window.requestAnimationFrame = callback => { let id; id = request.call(window, now => { pending.delete(id); callback(now); }); pending.add(id); return id; };
    window.cancelAnimationFrame = id => { pending.delete(id); return cancel.call(window, id); };
  }, { saved: saved ? JSON.stringify(saved) : null, key: STORAGE_KEY, disableGL });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(String(error)));
  page.on('request', req => { if (!req.url().startsWith(base) && !/^(data:|blob:|file:)/.test(req.url())) externalRequests.push(req.url()); });
  await page.goto(base + (flat ? '/?flat=1' : '/'));
  await page.locator('#lesson-title').waitFor();
  await page.locator('.tilemap-grid .tm-tile').first().waitFor({ state: 'attached' });
  return { page, context };
}
async function snapshot(page) {
  return page.evaluate(key => ({
    model: document.querySelector('#model-label').textContent,
    program: document.querySelector('#program').value,
    activeLine: document.querySelector('#code-lines .is-active')?.dataset.line || null,
    feedback: document.querySelector('#feedback').textContent,
    hint: document.querySelector('#hint-copy').textContent,
    saved: localStorage.getItem(key),
    url: location.href,
  }), STORAGE_KEY);
}
function completedSave() {
  const progress = blankProgress();
  progress.stage = 2; progress.completed = LEVELS.map(level => level.id);
  progress.programs['your-route'] = 'step()\nright()\nstep()\nstep()';
  return progress;
}
async function assertFlat(page, expected) {
  assert.equal(await page.locator('#world').evaluate((node, expected) => node.classList.contains(expected ? 'is-flat' : 'is-3d'), expected), true);
}
async function step(page, count) { for (let i = 0; i < count; i++) await page.locator('#step-button').click(); }

// This deliberately blocks any later document request: hosted attachment viewers
// may prohibit reload/query navigation even when the current document runs fine.
test('fix regression: Flat View switches repeatedly without any document navigation or state loss', async () => {
  const { page, context } = await openGarden();
  try {
    await page.getByRole('button', { name: 'D2', exact: true }).click();
    await step(page, 3);
    await page.locator('#hint-button').click();
    const before = await snapshot(page), navigations = [];
    await page.route('**/*', async route => {
      if (route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) { navigations.push(route.request().url()); await route.abort('blockedbyclient'); }
      else await route.continue();
    });
    for (let i = 0; i < 6; i++) {
      await page.locator('#flat-toggle').click();
      await assertFlat(page, i % 2 === 0);
      assert.deepEqual(await snapshot(page), before, `toggle ${i + 1} preserves program, active line, Pip, feedback, clues, progress and URL`);
      assert.equal(await page.locator('.world-heading').count(), 1, 'no accumulated renderer DOM');
      assert.equal(await page.locator('.tilemap-grid').count(), 1, 'no duplicated map');
      assert.equal(await page.locator('.world-canvas').count(), i % 2 === 0 ? 0 : 1, 'only the active renderer owns a canvas');
    }
    assert.deepEqual(navigations, [], 'Flat View must never request a new embedded document');
    await page.locator('#undo-button').click();
    assert.match(await page.locator('#model-label').textContent(), /D4.*east/, 'exact undo history survives switching');
    await step(page, 2);
    assert.match(await page.locator('#model-label').textContent(), /D3.*north/);
    assert.equal(await page.locator('#continue-button').isVisible(), true);
  } finally { await context.close(); }
});

test('fix regression: flat-map heading, prediction, keyboard buttons and reduced-motion rebuild remain coherent', async () => {
  const { page, context } = await openGarden({ reducedMotion: 'no-preference' });
  try {
    await page.locator('#flat-toggle').click(); await assertFlat(page, true);
    await page.locator('.tm-tile[data-x="3"][data-z="1"]').click();
    assert.equal(await page.locator('.tm-tile[data-x="3"][data-z="1"]').getAttribute('aria-pressed'), 'true');
    await step(page, 3);
    assert.match(await page.locator('.tm-tile.is-here').getAttribute('aria-label'), /Tile D4.*facing north/);
    const before = await snapshot(page);
    await page.locator('#reduce-motion-toggle').check();
    await assertFlat(page, true);
    const after = await snapshot(page);
    assert.equal(after.model, before.model); assert.equal(after.program, before.program); assert.equal(after.activeLine, before.activeLine);
    assert.equal(await page.locator('.world-canvas').count(), 0);
    await page.locator('.tm-tile[data-x="1"][data-z="3"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(':focus').getAttribute('data-x'), '2', 'flat-map arrow-key navigation survives rebuild');
    await page.locator('#flat-toggle').click(); await assertFlat(page, false);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.__reviewFrames.size), 0, 'reduced motion has no idle animation loop');
    await page.locator('#flat-toggle').click(); await assertFlat(page, true);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.__reviewFrames.size), 0, 'destroyed 3D renderer leaves no animation loop');
  } finally { await context.close(); }
});

test('fix regression: switching views during Run preserves the live run and final undo', async () => {
  const { page, context } = await openGarden();
  try {
    await page.getByRole('button', { name: 'D3', exact: true }).click();
    await page.locator('#run-button').click();
    assert.equal(await page.locator('#run-button').isDisabled(), true);
    const before = await snapshot(page);
    await page.locator('#flat-toggle').click(); await assertFlat(page, true);
    assert.equal((await snapshot(page)).model, before.model, 'switch does not reset Pip to dock');
    assert.equal(await page.locator('#run-button').isDisabled(), true, 'switch does not cancel or duplicate the active run');
    await page.locator('#continue-button').waitFor({ state: 'visible' });
    assert.match(await page.locator('#model-label').textContent(), /D3.*north/);
    assert.equal(await page.locator('#run-button').isEnabled(), true);
    await page.locator('#flat-toggle').click(); await assertFlat(page, false);
    await page.locator('#undo-button').click();
    assert.match(await page.locator('#model-label').textContent(), /D4.*north/);
  } finally { await context.close(); }
});

test('fix regression: unavailable WebGL retains a usable honest flat fallback through repeated toggles', async () => {
  const { page, context } = await openGarden({ disableGL: true });
  try {
    await assertFlat(page, true);
    for (let i = 0; i < 3; i++) {
      await page.locator('#flat-toggle').click();
      await assertFlat(page, true);
      assert.match(await page.locator('.world-note').textContent(), /could not start 3D graphics|not available|unavailable/i);
      assert.equal(await page.locator('.tm-tile').count(), LEVELS[0].tiles.length);
      assert.equal(await page.locator('.world-heading').count(), 1);
    }
    await page.locator('.tm-tile[data-x="3"][data-z="2"]').click();
    await step(page, 4);
    assert.equal(await page.locator('#continue-button').isVisible(), true, 'fallback still plays the whole route');
  } finally { await context.close(); }
});

test('fix regression: explicit flat URL can return to 3D without rewriting its URL or losing a draft', async () => {
  const { page, context } = await openGarden({ saved: completedSave(), flat: true });
  try {
    await assertFlat(page, true);
    await page.locator('#program').fill('step()\n# Keep this draft\nright()');
    await step(page, 2);
    const before = await snapshot(page);
    await page.locator('#flat-toggle').click(); await assertFlat(page, false);
    assert.deepEqual(await snapshot(page), before);
    await page.locator('#reduce-motion-toggle').check(); await assertFlat(page, false);
    assert.equal((await snapshot(page)).model, before.model);
    await page.locator('#flat-toggle').click(); await assertFlat(page, true);
  } finally { await context.close(); }
});

test('fix regression: recap groups question, answers and inline feedback before journal actions at desktop and phone widths', async () => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const { page, context } = await openGarden({ saved: completedSave(), viewport });
    try {
      await page.locator('#continue-button').click();
      await page.getByRole('button', { name: 'Pip’s tile', exact: true }).click();
      const wrongFeedback = page.locator('#journal-summary [aria-live="polite"]');
      assert.match(await wrongFeedback.textContent(), /turning on the spot/);
      const geometry = await page.evaluate(() => {
        const summary = document.querySelector('#journal-summary'), feedback = summary.querySelector('[aria-live="polite"]');
        const buttons = [...summary.querySelectorAll('button')];
        const answers = buttons.filter(node => /Pip’s/.test(node.textContent));
        const question = [...summary.querySelectorAll('p,legend,h3')].find(node => /One last thought/.test(node.textContent));
        const save = buttons.find(node => /Save field journal/.test(node.textContent));
        const rect = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        const answerGroup = answers[0].parentElement;
        return { question: rect(question), answers: answers.map(rect), feedback: rect(feedback), save: rect(save),
          feedbackParent: feedback.parentElement.className, nativeGroup: answerGroup.closest('fieldset')?.tagName, nativeLegend: answerGroup.closest('fieldset')?.querySelector('legend')?.textContent,
          live: feedback.getAttribute('aria-live'), atomic: feedback.getAttribute('aria-atomic'),
          connectedDescription: answers.every(answer => (answer.getAttribute('aria-describedby') || '').split(/\s+/).includes(feedback.id)),
          questionAndFeedbackGrouped: feedback.parentElement.contains(question) && feedback.parentElement.contains(answers[0]) && !feedback.parentElement.contains(save),
          overflow: document.documentElement.scrollWidth > innerWidth + 2 };
      });
      assert.ok(geometry.question.bottom <= Math.min(...geometry.answers.map(rect => rect.top)) + 1, 'question is above both answers');
      assert.ok(Math.max(...geometry.answers.map(rect => rect.bottom)) <= geometry.feedback.top + 1, 'feedback is directly below the answer group, not beside a button');
      assert.ok(geometry.feedback.bottom <= geometry.save.top + 1, 'feedback is before separate journal actions');
      assert.equal(geometry.questionAndFeedbackGrouped, true, 'question, answers and feedback share their own block, excluding save action');
      assert.equal(geometry.nativeGroup, 'FIELDSET'); assert.match(geometry.nativeLegend, /what changes/, 'answers are natively grouped and named by the legend');
      assert.equal(geometry.live, 'polite'); assert.equal(geometry.atomic, 'true'); assert.equal(geometry.connectedDescription, true);
      assert.equal(geometry.overflow, false);
      await page.getByRole('button', { name: 'Pip’s direction', exact: true }).click();
      assert.match(await wrongFeedback.textContent(), /Exactly/);
      assert.equal(await wrongFeedback.count(), 1, 'feedback updates in place');
      assert.equal(await page.getByRole('button', { name: 'Pip’s direction', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByRole('button', { name: 'Pip’s tile', exact: true }).getAttribute('aria-pressed'), 'false');
      await page.locator('#ending-title').focus(); await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'return-garden', 'focus stays within dialog');
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').textContent(), 'Pip’s direction');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ending').isHidden(), true);
      assert.equal(await page.locator('#program').inputValue(), completedSave().programs['your-route']);
    } finally { await context.close(); }
  }
});

test('fix regression: Flat View help no longer promises a page reload', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html.match(/id="flat-help"[^>]*>([^<]*)</)?.[1] || '', /page reloads/i);
});
