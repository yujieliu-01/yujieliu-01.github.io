(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TripleBandits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const losses = [];
  for (let a=0;a<3;a++) for (let b=0;b<3;b++) for (let c=0;c<3;c++) {
    if (!(a===b && b===c)) losses.push([a,b,c]);
  }
  function create(random = Math.random) {
    const probabilities = [.4,.5,.6];
    for (let i=2;i>0;i--) {
      const j = Math.floor(random()*(i+1));
      [probabilities[i],probabilities[j]] = [probabilities[j],probabilities[i]];
    }
    return {probabilities, history:[], wins:0,
      stats:Array.from({length:3},()=>({count:0,wins:0}))};
  }
  function choose(state, arm, random = Math.random) {
    if (!Number.isInteger(arm) || arm<0 || arm>2 || state.history.length>=100) return null;
    // Draw the win first; the reels only represent that outcome.
    const win = random() < state.probabilities[arm];
    let reels;
    if (win) {const fruit=Math.floor(random()*3); reels=[fruit,fruit,fruit];}
    else reels=losses[Math.floor(random()*losses.length)].slice();
    const event={turn:state.history.length+1,arm,reels,win};
    const stat=state.stats[arm]; stat.count++;
    if(win){stat.wins++;state.wins++;}
    state.history.push(event);
    return event;
  }
  return {create,choose};
});
