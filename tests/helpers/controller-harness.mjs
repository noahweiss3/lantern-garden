import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { LESSONS, STAGES as LEVELS } from '../../src/curriculum.js';
import { DIRECTIONS, parseProgram, initialState, advance, undo, tileLabel, runProgram } from '../../src/engine.js';
import { STORAGE_KEY, blankProgress, loadProgress, saveProgress, exportProgress, importProgress, completedLessonNumbers, MAX_BACKUP_BYTES } from '../../src/progress.js';

// A deliberately minimal DOM controller harness, not real browser/layout proof.
export function bootController({ saved = null, denied = false, storageOverride, protocol = 'file:', dev = true, navigatorOverride, timers, flat = false, failGL = false } = {}) {
  const elements = new Map();
  let document;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.value = ''; this.hidden = false; this.disabled = false; this.textContent = ''; }
    set id(value) { this.identifier = value; elements.set(value, this); }
    get id() { return this.identifier; }
    set textContent(value) { this.ownText = String(value); this.children = []; }
    get textContent() { return (this.ownText || '') + this.children.map(child => child.textContent || '').join(''); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren(...children) { this.ownText = ''; this.children = []; this.append(...children); }
    append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
    after(...nodes) { if (this.parent) { const index = this.parent.children.indexOf(this); nodes.forEach(node => { node.parent = this.parent; }); this.parent.children.splice(index + 1, 0, ...nodes); } }
    focus() { this.focused = true; document.activeElement = this; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      if (selector === '*') return all;
      if (selector === 'button:not([disabled])') return all.filter(child => child.tagName === 'button' && !child.disabled);
      return all.filter(child => child.tagName === selector);
    }
    click() { if (!this.disabled) return this.listeners.click?.({ target: this }); }
  }
  const element = id => { if (!elements.has(id)) { const created = new Element(); created.id = id; } return elements.get(id); };
  document = {
    activeElement: null,
    getElementById: id => ['journal-summary', 'return-garden', 'ending-next'].includes(id) ? (elements.get(id) || null) : element(id),
    querySelector: selector => element(selector),
    createElement: tag => new Element(tag),
  };
  const sheet = new Element();
  element('ending').append(sheet);
  sheet.append(element('ending-title'), element('ending-copy'), element('replay-button'));
  element('replay-button').tagName = 'button';
  element('lesson-map-close').tagName = 'button';
  element('lesson-map').append(element('lesson-map-close'), element('lesson-list'));
  let data = saved;
  const storage = storageOverride || { getItem: () => data, setItem: (_, value) => { data = value; }, removeItem: () => { data = null; } };
  const window = { addEventListener() {} };
  Object.defineProperty(window, 'localStorage', { get() { if (denied) throw Error('Browser denied the getter'); return storage; } });
  const renderLog = [], worlds = [];
  const source = readFileSync(fileURLToPath(new URL('../../src/main.js', import.meta.url)), 'utf8')
    .replace(/^import[^\n]+\n/gm, '')
    .replaceAll('import.meta.env.DEV', String(dev))
    .replaceAll('import.meta.env.BASE_URL', JSON.stringify('./'));
  const sandbox = createContext({
    document, window,
    location: { protocol, href: (protocol === 'file:' ? 'file:///review.html' : 'https://garden.example/') + (flat ? '?flat=1' : '') }, navigator: navigatorOverride || {},
    matchMedia: () => ({ matches: false }), confirm: () => true,
    setTimeout: timers?.setTimeout || setTimeout, clearTimeout: timers?.clearTimeout || clearTimeout,
    URL, Blob, console, LESSONS, LEVELS, DIRECTIONS, parseProgram, initialState, advance, undo, tileLabel, runProgram,
    STORAGE_KEY, MAX_BACKUP_BYTES, blankProgress, loadProgress, saveProgress, exportProgress, importProgress, completedLessonNumbers,
    createWorld: (container, options) => {
      const instance = { container, options, level: null, state: null, renderOptions: null, prediction: null, destroyed: false,
        setLevel(value) { this.level = value; },
        renderState(value, renderOptions) { this.state = structuredClone(value); this.renderOptions = renderOptions; renderLog.push(structuredClone(value)); },
        setPrediction(value) { this.prediction = value && structuredClone(value); },
        isFlat() { return failGL || (typeof options.flatView === 'boolean' ? options.flatView : flat); },
        destroy() { this.destroyed = true; this.destroyCount = (this.destroyCount || 0) + 1; },
      };
      worlds.push(instance); return instance;
    },
  });
  runInContext(source, sandbox, { filename: 'controller-under-review.js' });
  return { element, document, readStored: () => data, renderLog, worlds, evaluate: expression => runInContext(expression, sandbox) };
}

