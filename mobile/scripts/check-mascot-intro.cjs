// Run: node scripts/check-mascot-intro.cjs
// Exercises the actual component's effects; native rendering still needs device QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../components/MascotIntro.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

function mount(options = {}) {
  const hooks = [], effects = [], timers = new Map(), animations = [], writes = [], listeners = new Set();
  let cursor = 0, dirty = true, tree, completed = 0, nextTimer = 0, unmounted = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const props = { ready: options.ready ?? true, onComplete: () => completed++ };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: value => hooks[cursor++] ??= { current: value },
    useState(value) {
      const i = cursor++;
      hooks[i] ??= { value };
      return [hooks[i].value, next => {
        const value = typeof next === 'function' ? next(hooks[i].value) : next;
        if (!Object.is(value, hooks[i].value)) { hooks[i].value = value; dirty = true; }
      }];
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = { deps, callback };
      return hooks[i].callback;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!hooks[i] || !same(hooks[i].deps, deps)) {
        const previous = hooks[i];
        hooks[i] = { deps };
        effects.push(() => { previous?.cleanup?.(); hooks[i].cleanup = effect(); });
      }
    },
  };
  const controller = (kind, config) => ({
    kind, config, stopped: false,
    start(callback) { this.callback = callback; animations.push(this); },
    stop() { this.stopped = true; },
    finish() { this.callback?.({ finished: true }); },
  });
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate(config) { return config; }
  }
  const storage = {
    getItem: async () => {
      if (options.readError) throw Error('read failed');
      if (options.readHangs) return new Promise(() => {});
      return options.seen ?? null;
    },
    setItem: async (key, value) => {
      writes.push([key, value]);
      if (options.writeError) throw Error('write failed');
    },
  };
  const native = {
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => {
        if (options.preferenceError) throw Error('preference failed');
        if (options.preferenceHangs) return new Promise(() => {});
        return options.reduceMotion ?? false;
      },
      addEventListener: (_, listener) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
    Animated: {
      Value, View: 'Animated.View',
      timing: (value, config) => controller('timing', { value, ...config }),
      delay: duration => controller('delay', { duration }),
      sequence: steps => controller('sequence', steps),
    },
    Easing: { quad: 'quad', cubic: 'cubic', out: v => v, inOut: v => v },
    Image: 'Image', Modal: 'Modal', Platform: { OS: 'android' },
    StyleSheet: { create: styles => styles },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { warn() {} },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    require(id) {
      if (id === 'react') return React;
      if (id === 'react-native') return native;
      if (id === '@react-native-async-storage/async-storage') return storage;
      if (id === '../context/ThemeContext') return { useTheme: () => ({ colors: { bg: '#FAF6EE' } }) };
      if (id.endsWith('.png')) return 'bundled-mascot';
      throw Error(`Unexpected import: ${id}`);
    },
  });
  function render() {
    if (unmounted) return;
    cursor = 0; dirty = false;
    tree = exports.default(props);
    while (effects.length) effects.shift()();
  }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of node.props?.children ?? []) {
      const found = find(child, predicate);
      if (found) return found;
    }
  }
  render();
  return {
    animations, writes, timers, listeners,
    get completed() { return completed; },
    image: () => find(tree, node => node.type === 'Image'),
    close: () => tree.props.onRequestClose(),
    setReady(value) { props.ready = value; dirty = true; },
    emitReduceMotion(value) { for (const listener of listeners) listener(value); },
    async settle() {
      for (let i = 0; i < 8; i++) { await Promise.resolve(); if (dirty) render(); }
    },
    unmount() {
      unmounted = true;
      for (const hook of hooks) hook?.cleanup?.();
    },
  };
}

(async () => {
  const seen = mount({ seen: 'true', preferenceHangs: true });
  await seen.settle();
  assert.equal(seen.completed, 1);
  assert.equal(seen.image(), undefined);
  assert.equal(seen.writes.length, 0);
  seen.unmount();

  const first = mount({ ready: false });
  await first.settle();
  first.image().props.onLoad();
  await first.settle();
  assert.equal(first.animations.length, 0, 'wait for app readiness');
  first.setReady(true);
  await first.settle();
  const greeting = first.animations.at(-1);
  assert.equal(greeting.kind, 'sequence');
  assert.equal(greeting.config.reduce((total, step) => total + step.config.duration, 0), 1400);
  greeting.finish();
  first.close();
  assert.equal(first.completed, 1, 'completion is idempotent');
  assert.deepEqual(first.writes, [['nokma_intro_seen', 'true']]);
  first.unmount();

  const reduced = mount({ reduceMotion: true });
  await reduced.settle();
  reduced.image().props.onLoad();
  await reduced.settle();
  assert.equal(reduced.animations.at(-1).kind, 'timing', 'no spatial sequence');
  assert.equal(reduced.animations.at(-1).config.duration, 150);
  reduced.animations.at(-1).finish();
  assert.equal(reduced.completed, 1);
  reduced.unmount();

  const preferenceFailure = mount({ preferenceError: true });
  await preferenceFailure.settle();
  preferenceFailure.image().props.onLoad();
  await preferenceFailure.settle();
  assert.equal(preferenceFailure.animations.at(-1).kind, 'timing', 'unknown preference uses gentle fallback');
  assert.equal(preferenceFailure.animations.at(-1).config.duration, 150);
  preferenceFailure.unmount();

  const changed = mount();
  await changed.settle();
  changed.image().props.onLoad();
  await changed.settle();
  const original = changed.animations.at(-1);
  changed.emitReduceMotion(true);
  await changed.settle();
  assert.equal(original.stopped, true);
  assert.equal(changed.animations.at(-1).config.duration, 150);
  changed.unmount();

  for (const options of [{ readError: true }, { readHangs: true }]) {
    const failed = mount(options);
    await failed.settle();
    if (options.readHangs) [...failed.timers.values()][0].callback();
    assert.equal(failed.completed, 1, 'storage failure must fail open');
    failed.unmount();
  }

  const missing = mount();
  await missing.settle();
  missing.image().props.onError();
  assert.equal(missing.completed, 1, 'missing image must fail open');
  missing.unmount();

  const writeFailure = mount({ writeError: true });
  await writeFailure.settle();
  writeFailure.close();
  await writeFailure.settle();
  assert.equal(writeFailure.completed, 1, 'do not await persistence to dismiss');
  writeFailure.unmount();

  const interrupted = mount();
  interrupted.unmount();
  await interrupted.settle();
  assert.equal(interrupted.completed, 0, 'unmounted async work must not complete');
  assert.equal(interrupted.timers.size, 0);
  assert.equal(interrupted.listeners.size, 0);

  console.log('Mascot intro checks passed: first/seen launch, readiness, motion, failures, and cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
