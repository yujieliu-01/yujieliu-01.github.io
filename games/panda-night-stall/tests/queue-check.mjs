import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Import as an ES module without requiring a package.json mutation in the Site.
const code = await readFile(new URL('../queue-model.js', import.meta.url), 'utf8');
const { QueueScene, layoutQueue, ZONES } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const EPS = 1e-6;
const advance = (scene, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) scene.update(1 / 60);
};
function bounded(rect, a, size = a.size, width = a.width) {
  assert(a.x - width / 2 >= rect.x - EPS, 'left body edge outside zone');
  assert(a.x + width / 2 <= rect.x + rect.w + EPS, 'right body edge outside zone');
  assert(a.y - size >= rect.y - EPS, 'top of body outside zone');
  assert(a.y <= rect.y + rect.h + EPS, 'foot outside zone');
}
function distinctAndSeparated(slots) {
  assert.equal(new Set(slots.map(s => `${s.x.toFixed(6)},${s.y.toFixed(6)}`)).size, slots.length);
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2 - EPS;
      const overlapY = Math.min(a.y, b.y) > Math.max(a.y - a.size, b.y - b.size) + EPS;
      assert(!(overlapX && overlapY), `overlapping targets ${i}, ${j}`);
    }
  }
}
function finiteActors(scene) {
  const actors = scene.getActors();
  assert.equal(new Set(actors.map(a => a.id)).size, actors.length, 'duplicate actor IDs');
  assert(actors.length <= 320, 'actor collection grew without bound');
  for (const a of actors) {
    for (const k of ['x', 'y', 'size', 'width', 'targetX', 'targetY', 'targetSize', 'walkPhase', 'alpha']) assert(Number.isFinite(a[k]), `${a.id}.${k} is not finite`);
    assert(a.size > 0 && a.width > 0);
    assert(a.face === 1 || a.face === -1);
    if (a.queueIndex >= 0) bounded(ZONES[a.species], a);
    else bounded({ x: 0, y: 0, w: 1800, h: 1000 }, a);
  }
}

// Every supported count, plus unusually wide/narrow sprite envelopes.
const deliveredAspects = { cat: 459 / 512, corgi: 539 / 512 };
for (const species of ['cat', 'corgi']) {
  for (const aspect of [0.8, species === 'cat' ? 1.10 : 1.34, deliveredAspects[species], 1.6]) {
    for (let n = 0; n <= 80; n++) {
      const layout = layoutQueue(n, ZONES[species], { aspect });
      assert.equal(layout.slots.length, n);
      layout.slots.forEach(s => bounded(ZONES[species], s));
      distinctAndSeparated(layout.slots);
      if (n) {
        assert.equal(layout.slots[0].face, 1);
        assert.equal(layout.slots[0].x, Math.max(...layout.slots.map(s => s.x)));
        if (n <= 7) assert.equal(layout.rows, 1, 'small queues should remain a natural single row');
        if (aspect === deliveredAspects[species] && n >= 8) {
          assert(layout.slots[0].size >= 120, 'dense queue lost its large foreground customers');
          assert(layout.tail.size < layout.head.size * 0.6, 'rear customers should visibly recede');
          for (let k = 1; k < layout.slots.length; k++) assert(layout.slots[k].size <= layout.slots[k - 1].size + EPS);
        }
      }
    }
  }
}

const max = new QueueScene({ catCount: 80, dogCount: 80, auto: false, aspects: deliveredAspects });
assert.equal(max.getActors().length, 160);
finiteActors(max);
max.setCounts(6, 5); advance(max, 10); finiteActors(max);
max.setCounts(80, 80);
for (let i = 0; i < 900; i++) { max.update(1 / 60); finiteActors(max); }
assert.equal(max.getState().catCount, 80); assert.equal(max.getState().dogCount, 80);
assert.equal(max.getActors().length, 160);
for (const species of ['cat', 'corgi']) {
  const actors = max.getActors().filter(a => a.species === species && a.queueIndex >= 0);
  distinctAndSeparated(actors);
  actors.forEach(a => {
    assert(Math.abs(a.x - a.targetX) < EPS && Math.abs(a.y - a.targetY) < EPS);
  });
}

const service = new QueueScene({ auto: false });
const batch = service.serve(3, 5);
assert.equal(batch.total, 8);
assert.deepEqual(service.getState().counts, { cat: 3, corgi: 0 });
advance(service, 30); finiteActors(service);
assert.equal(service.getState().servedCount, 8);
assert.equal(service.getState().outgoingCount, 0);
const events = service.drainEvents();
assert.equal(events.filter(e => e.type === 'serve').length, 8);
assert.equal(events.filter(e => e.type === 'depart' && e.served).length, 8);
assert.equal(service.drainEvents().length, 0);
assert.equal(service.add('dog', 100), 80);
assert.equal(service.add('cats', 100), 77);
advance(service, 15); finiteActors(service);
assert.equal(service.getActors().length, 160);
// Every distant customer now becomes full-sized at pickup. The artificial
// 80+80 bulk convoy therefore needs more clearance time than miniature actors.
service.serve(Infinity, Infinity); advance(service, 200);
assert.equal(service.getState().servedCount, 168);
assert.equal(service.getActors().length, 0);

// A rear-row actor grows with the spatial turn into the front row, never
// expanding at its old far-row position before it starts walking forward.
const approaching = new QueueScene({ catCount: 45, dogCount: 0, auto: false, aspects: deliveredAspects });
const beforeLayout = approaching.getLayout().cat;
const frontCount = beforeLayout.rowPlans[0].count;
const promoted = approaching.queues.cat[frontCount];
const farY = promoted.y, farSize = promoted.size;
const nearY = beforeLayout.head.y, nearSize = beforeLayout.head.size;
approaching.serve(frontCount, 0);
let turnSamples = 0;
for (let i = 0; i < 60 * 40; i++) {
  approaching.update(1 / 60);
  const progress = (promoted.y - farY) / (nearY - farY);
  if (progress > 0.1 && progress < 0.9 && promoted.state === 'advancing') {
    assert(Math.abs(promoted.size - (farSize + (nearSize - farSize) * progress)) < 0.1, 'size got ahead of spatial depth');
    turnSamples++;
  }
}
assert(turnSamples > 0, 'did not observe the rear-to-front turn');
assert(promoted.size >= 120 && promoted.queueIndex === 0);
finiteActors(approaching);
distinctAndSeparated(approaching.getActors().filter(a => a.queueIndex >= 0));

// Serving across a row boundary must not send a permanently miniature actor
// to the counter. Keep the existing left-side cat departure route intact.
const departing = new QueueScene({ catCount: 45, dogCount: 0, auto: false, aspects: deliveredAspects });
const smallActor = departing.queues.cat[frontCount];
assert(smallActor.size < 80);
departing.serve(frontCount + 1, 0);
let sawLargePickup = false;
for (let i = 0; i < 60 * 40; i++) {
  departing.update(1 / 60);
  for (const event of departing.drainEvents()) if (event.type === 'serve' && event.id === smallActor.id) {
    assert(smallActor.size >= 120, 'served animal retained its distant miniature size');
    sawLargePickup = true;
  }
  if (smallActor.queueIndex < 0 && smallActor.y < 950 - EPS) assert(smallActor.x <= 1160 + EPS);
}
assert(sawLargePickup);

const automatic = new QueueScene();
for (let i = 0; i < 60 * 100; i++) {
  automatic.update(1 / 60);
  const s = automatic.getState();
  assert(s.catCount <= 6 && s.dogCount <= 5, 'balanced arrivals exceeded the selected preset');
  finiteActors(automatic);
}
assert(automatic.getState().servedCount > 20);
automatic.setPaused(true);
const pausedTime = automatic.time;
automatic.update(12);
assert.equal(automatic.time, pausedTime);
automatic.setPaused(false); automatic.setAuto(false);
const before = automatic.getState().counts;
advance(automatic, 15);
assert.deepEqual(automatic.getState().counts, before);
for (const dt of [NaN, Infinity, -1, 0, 99999]) automatic.update(dt);
finiteActors(automatic);
automatic.setCounts(NaN, -20);
assert.deepEqual(automatic.getState().counts, { cat: 0, corgi: 0 });

console.log('PASS: perspective 0–80 layouts, large foreground, full-body separation/bounds, spatially coupled growth, full-size pickup, services/events, balanced autoplay and pause.');
