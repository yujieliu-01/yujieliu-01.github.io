'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const pose = require('./art/pose-v3.js');
const effects = require('./art/effects-v3.js');
const frames = require('./cat-renderer.js');

// The old icon loop selected a scripted result. Every game result must now
// reach the drawing layer, including the exact start-of-win boundary.
for (const win of [false, true]) {
  const previous = [1, 0, 2], reels = win ? [2, 2, 2] : [0, 2, 1];
  const event = {previous, reels, win, fast: true, reducedMotion: false};
  const first = frames.frameFor(event, 0);
  const firstPose = Object.assign(pose.sample(first.seconds), first.pose);
  const firstState = effects.state(firstPose);
  assert.equal(firstState.roundIndex, win ? 1 : 0);
  assert.equal(firstState.roundTime, 0, 'new result must not flash before a spin');
  assert.deepEqual(firstState.previous, previous);
  assert.deepEqual(firstState.result, reels);
  assert.equal(effects.prizeState(firstPose).visible, false);
  for (let ms = 0; ms <= frames.timing(win, true, false).duration; ms += 40) {
    const f = frames.frameFor(event, ms);
    const sampled = Object.assign(pose.sample(f.seconds), f.pose);
    if (!win) assert.equal(effects.prizeState(sampled).visible, false, 'a miss cannot award a fish');
  }
}

let now = 0, id = 0, preparations = 0;
const callbacks = new Map(), listeners = new Map();
const media = {matches: false, addEventListener() {}, removeEventListener() {}};
function canvas() {
  return {width: 0, height: 0, dataset: {}, frames: [], getContext() {},
    getBoundingClientRect() { return {width: 320, height: 320 / 1.12}; }};
}
const context = {
  URL, Promise, console, performance: {now: () => now},
  requestAnimationFrame(callback) { callbacks.set(++id, callback); return id; },
  cancelAnimationFrame(key) { callbacks.delete(key); },
  matchMedia() { return media; },
  document: {
    hidden: false, currentScript: {src: 'https://example.test/games/bandits-triple/cat-renderer.js'},
    createElement(type) { return type === 'canvas' ? canvas() : {}; },
    head: {append(script) { queueMicrotask(() => script.onload()); }},
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); }
  },
  SlotCatAnimation: {async create() { preparations++; return {
    render(target, seconds, options) {
      target.frames.push(JSON.parse(JSON.stringify({seconds, options})));
    }
  }; }},
  addEventListener() {}, removeEventListener() {}, devicePixelRatio: 3
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'cat-renderer.js'), 'utf8'), context);
function advance(ms) {
  now = ms;
  const pending = [...callbacks.values()];
  callbacks.clear();
  for (const callback of pending) callback(now);
}

(async () => {
  const shared = await context.CatSlotRenderer.create();
  assert.equal(await context.CatSlotRenderer.create(), shared);
  assert.equal(preparations, 1, 'three machines must share the expensive art preparation');
  const a = canvas(), b = canvas();
  const first = shared.mount(a, {index: 0}), second = shared.mount(b, {index: 1});
  assert.equal(a.width, 640, 'high-density backing is capped at two pixels per CSS pixel');
  let stops = 0;
  const spin = first.play({reels: [2, 2, 2], win: true, fast: true,
    onReelsStopped() { stops++; }});
  advance(0);
  assert.deepEqual(a.frames.at(-1).options.pose.previousReels, [0, 1, 2]);
  advance(500);
  assert.equal(stops, 0);
  advance(1100);
  assert.equal(stops, 1);
  advance(1500);
  assert.equal(stops, 1, 'result callback must run once');
  advance(1700);
  assert.equal((await spin).cancelled, false);
  assert.equal(a.dataset.reels, '2,2,2');
  assert.equal(b.dataset.reels, '0,1,2', 'another machine must keep its own outcome');

  const cancelled = first.play({reels: [0, 0, 0], win: true, fast: true});
  first.idle([1, 2, 0]);
  assert.equal((await cancelled).cancelled, true);
  advance(5000);
  assert.equal(a.dataset.reels, '1,2,0', 'a restarted scene cannot receive a stale outcome');

  const reduced = first.play({reels: [1, 1, 1], win: true, reducedMotion: true});
  advance(5050);
  assert.equal(a.frames.at(-1).options.pose.staticReels, true);
  advance(5200);
  assert.equal((await reduced).cancelled, false);
  assert.equal(a.dataset.reels, '1,1,1');
  await assert.rejects(first.play({reels: [0, 1, 2], win: true}), /agree/);

  const pending = second.play({reels: [2, 1, 0], win: false, fast: true});
  second.destroy();
  assert.equal((await pending).cancelled, true);
  first.destroy();
  assert.equal(callbacks.size, 0, 'destroying scenes removes their frame callbacks');
  console.log('Cat renderer outcome, cancellation, reduced-motion and isolation checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
