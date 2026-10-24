const assert=require('node:assert/strict');
const E=require('./engine.js');
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
const permutations=new Set();
for(let seed=1;seed<=1000;seed++){
  const random=rng(seed),s=E.create(random),original=JSON.stringify(s.probabilities);
  assert.deepEqual(s.probabilities.slice().sort(),[.4,.5,.6]);
  for(let n=0;n<100;n++){
    const e=E.choose(s,n%3,random),same=e.reels.every(v=>v===e.reels[0]);
    assert.equal(same,e.win);assert(!('points' in e));
    assert.equal(e.turn,n+1);assert.equal(e.arm,n%3);
    assert(e.reels.every(v=>Number.isInteger(v)&&v>=0&&v<3));
  }
  assert.equal(E.choose(s,0),null);assert.equal(JSON.stringify(s.probabilities),original);
  assert.equal(s.wins,s.history.filter(e=>e.win).length);
  assert.equal(s.wins,s.stats.reduce((n,t)=>n+t.wins,0));
  assert.equal(s.stats.reduce((n,t)=>n+t.count,0),100);
  for(let arm=0;arm<3;arm++){
    const a=s.stats[arm],h=s.history.filter(e=>e.arm===arm);
    assert.equal(a.count,h.length);assert.equal(a.wins,h.filter(e=>e.win).length);
    assert(a.wins>=0 && a.wins<=a.count);
  }
}
for(let a=0;a<3;a++)for(let b=0;b<2;b++){
  const draws=[(a+.5)/3,(b+.5)/2];
  permutations.add(JSON.stringify(E.create(()=>draws.shift()).probabilities));
}
assert.equal(permutations.size,6,'Every shuffled placement is possible');
for(let arm=0;arm<3;arm++){
  const s=E.create(rng(10)),p=s.probabilities[arm];
  const rolls=[p-Number.EPSILON,.5,p,.5];
  assert.equal(E.choose(s,arm,()=>rolls.shift()).win,true);
  assert.equal(E.choose(s,arm,()=>rolls.shift()).win,false);
}
const lossCombos=new Set();
for(let n=0;n<24;n++){
  const s=E.create(rng(5)),rolls=[.99,(n+.5)/24];
  const e=E.choose(s,0,()=>rolls.shift());assert.equal(e.win,false);lossCombos.add(e.reels.join(''));
}
assert.equal(lossCombos.size,24,'All nonmatching triples are available, no accidental jackpots');
for(const bad of [-1,3,1.5,NaN])assert.equal(E.choose(E.create(),bad),null);
console.log('PASS: 1,000 full games; exact 40/50/60% thresholds; all 6 shuffles; 24 losing triples; fixed 100 coin limit; win counts and history agree; no points.');
