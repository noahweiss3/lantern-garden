import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as ActualThree from 'three';
import { batchStaticScenery } from '../../src/batch-scenery.js';
const source = readFileSync(new URL('../../src/world.js', import.meta.url), 'utf8');

// Actual Three geometry/math with a deterministic fake GPU/DOM.
export function rendererHarness({ flat = false, flatView, reducedMotion = true, failGL = false, batching = true } = {}) {
  let document;
  const elements = [], renderers = [];
  class Element {
    constructor(tag = 'div') {
      elements.push(this);
      this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {};
      this.style = { properties: {}, setProperty(key, value) { this.properties[key] = value; } };
      this.clientWidth = 1024; this.clientHeight = 700;
      const classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, enabled) { if (enabled === undefined) enabled = !classes.has(name); enabled ? classes.add(name) : classes.delete(name); },
      };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    insertBefore(child) { child.parent = this; this.children.unshift(child); }
    get firstChild() { return this.children[0]; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    querySelector(selector) { return this.descendants().find(child => child.className?.split(' ').includes(selector.slice(1))); }
    closest(selector) { return this.className?.split(' ').includes(selector.slice(1)) ? this : this.parent?.closest(selector); }
    contains(child) { return this === child || this.descendants().includes(child); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    removeEventListener(name) { delete this.listeners[name]; }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
    getContext() { return { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, clearRect() {}, fillText() {} }; }
  }
  let scene, camera, renderer;
  class FakeGL {
    constructor() { if (failGL) throw Error('No WebGL'); this.domElement = new Element('canvas'); renderer = this; renderers.push(this); }
    getContext() { return { isContextLost: () => false }; }
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render(nextScene, nextCamera) { scene = nextScene; camera = nextCamera; }
    dispose() { this.disposed = true; }
    forceContextLoss() { this.contextReleased = true; }
  }
  let serial = 0;
  const frames = new Map();
  const eventTarget = () => ({ listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; }, removeEventListener(name) { delete this.listeners[name]; } });
  document = { ...eventTarget(), hidden: false, activeElement: null, createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
  const window = { ...eventTarget(), location: { search: flat ? '?flat=1' : '' }, devicePixelRatio: 1 };
  const context = vm.createContext({
    THREE: { ...ActualThree, WebGLRenderer: FakeGL }, batchStaticScenery: batching ? batchStaticScenery : () => {}, document,
    window,
    URLSearchParams, performance, console,
    requestAnimationFrame: callback => { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  vm.runInContext(source.replace(/^import[^\n]+\n/gm, '').replace('export function createWorld', 'function createWorld') + '\nglobalThis.reviewCreateWorld = createWorld;', context);
  const container = new Element(), selections = [];
  const create = options => context.reviewCreateWorld(container, { reducedMotion, onTileSelect: tile => selections.push(tile), flatView, ...options });
  const world = create();
  return {
    world, create, container, document, window, selections, frames, elements, renderers,
    activeListenerCount() { return [document, window, ...elements].reduce((count, target) => count + Object.keys(target.listeners).length, 0); },
    get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; },
    frame(now = 16) { const callback = frames.values().next().value; frames.clear(); if (callback) callback(now); },
  };
}

export function robotPose(scene) {
  let pointer;
  scene.traverse(object => { if (!pointer && object.userData.pip) pointer = object; });
  return { yawGroup: pointer.parent, root: pointer.parent.parent };
}

