(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FruitBandits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const rewards = [0, 2, 5, 10];
  const baseline = [[.10, .70, .15, .05], [.15, .15, .50, .20], [.50, .10, .10, .30]];
  function shuffle(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function create(round = 0, random = Math.random) {
    // First round follows the design's sample. Replays change the distributions too.
    const profiles = baseline.map(p => {
      if (!round) return p.slice();
      const weights = p.map(v => Math.max(2, Math.round(v * 100 + (random() - .5) * 24)));
      const sum = weights.reduce((a, b) => a + b, 0);
      return weights.map(v => v / sum);
    });
    return { profiles: shuffle(profiles, random), history: [], total: 0,
      stats: Array.from({length: 3}, () => ({count: 0, total: 0, outcomes: [0, 0, 0, 0]})) };
  }
  function choose(state, arm, random = Math.random) {
    if (!Number.isInteger(arm) || arm < 0 || arm > 2 || state.history.length >= 100) return null;
    const draw = random();
    let cumulative = 0, outcome = 3;
    for (let i = 0; i < 4; i++) {
      cumulative += state.profiles[arm][i];
      if (draw < cumulative) { outcome = i; break; }
    }
    const event = {arm, outcome, points: rewards[outcome]};
    const stat = state.stats[arm];
    stat.count++; stat.total += event.points; stat.outcomes[outcome]++;
    state.total += event.points; state.history.push(event);
    return event;
  }
  const mean = profile => profile.reduce((sum, p, i) => sum + p * rewards[i], 0);
  function summary(state) {
    const means = state.profiles.map(mean), bestMean = Math.max(...means);
    return {means, best: means.indexOf(bestMean),
      regret: state.stats.reduce((sum, s, i) => sum + s.count * (bestMean - means[i]), 0),
      expected: state.stats.reduce((sum, s, i) => sum + s.count * means[i], 0)};
  }
  return {rewards, create, choose, mean, summary};
});
