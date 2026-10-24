const assert = require('node:assert/strict');
const E = require('./engine.js');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
const first = E.create(0, rng(1));
assert.deepEqual(first.profiles.map(E.mean).sort(), [2.65, 3.7, 4.8]);
const snapshot = JSON.stringify(first);
for (const bad of [-1, 3, .5, NaN]) assert.equal(E.choose(first, bad), null);
assert.equal(JSON.stringify(first), snapshot);
// Every reward boundary, especially monkey zero, must map to the advertised outcome.
for (let arm = 0; arm < 3; arm++) {
  let low = 0;
  for (let outcome = 0; outcome < 4; outcome++) {
    const state = E.create(0, rng(1)), draw = low + state.profiles[arm][outcome] / 2;
    assert.equal(E.choose(state, arm, () => draw).outcome, outcome);
    low += state.profiles[arm][outcome];
  }
}
for (let seed = 1; seed <= 1000; seed++) {
  const random = rng(seed), state = E.create(seed % 6, random), original = JSON.stringify(state.profiles);
  state.profiles.forEach(p => { assert(Math.abs(p.reduce((a,b) => a+b, 0) - 1) < 1e-12); assert(p.every(v => v > 0)); });
  for (let n = 0; n < 100; n++) {
    const event = E.choose(state, Math.floor(random() * 3), random);
    assert.equal(event.points, E.rewards[event.outcome]);
    assert.equal(state.total, state.history.reduce((sum, e) => sum + e.points, 0));
    assert.equal(state.stats.reduce((sum, s) => sum + s.count, 0), n + 1);
  }
  assert.equal(JSON.stringify(state.profiles), original, 'No adaptive probabilities');
  assert.equal(E.choose(state, 0), null, 'Fixed 100-coin budget');
  state.stats.forEach(s => {
    assert.equal(s.count, s.outcomes.reduce((a,b) => a+b, 0));
    assert.equal(s.total, s.outcomes.reduce((sum, count, i) => sum + count * E.rewards[i], 0));
  });
  const summary = E.summary(state);
  assert(summary.regret >= -1e-10);
  assert(Math.abs(summary.regret + summary.expected - 100 * Math.max(...summary.means)) < 1e-9);
}
assert.notDeepEqual(E.create(1, rng(123)).profiles, E.create(2, rng(456)).profiles);
const optimal = E.create(0, rng(9)), best = E.summary(optimal).best;
for (let n = 0; n < 100; n++) E.choose(optimal, best, () => 0);
assert.equal(optimal.total, 0);
assert.equal(E.summary(optimal).regret, 0, 'Pseudo-regret excludes realized reward noise');
console.log('PASS: 1,000 complete games; reward boundaries; budget; fixed probabilities; records; replay variation; pseudo-regret.');
