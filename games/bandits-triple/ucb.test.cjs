'use strict';
const assert=require('node:assert/strict');
const {select,simulate,evaluate}=require('./calibrate-ucb.cjs');
const data=require('./ucb-benchmark.json');
assert.equal(select([0,0,0],[0,0,0],1,.3),0);
assert.equal(select([1,0,0],[1,0,0],2,.3),1);
assert.equal(select([1,1,0],[1,1,0],3,.3),2);
assert.equal(select([10,10,10],[4,7,5],31,.3),1,'Equal samples prefer the observed better arm');
assert.equal(select([50,1,49],[30,0,28],100,.3),1,'Exploration bonus revisits under-sampled arms');
for(const winningArm of [0,1,2]){
  const streams=Array.from({length:3},(_,i)=>Array(100).fill(Number(i===winningArm)));
  const result=simulate(streams,.3);
  assert.equal(result.counts.reduce((a,b)=>a+b,0),100);
  assert.equal(result.total,98,'A deterministic winner gets every remaining pull');
  assert.equal(result.counts[winningArm],98);
}
assert.equal(simulate(Array.from({length:3},()=>Array(100).fill(1)),.3).total,100);
assert.equal(simulate(Array.from({length:3},()=>Array(100).fill(0)),.3).total,0);
assert.deepEqual(data.probabilities,[.4,.5,.6]);
assert.equal(data.budget,100);
assert(data.training.every(x=>x.seed!==data.selected.seed),'Validation independent of training');
assert.equal(data.selected.c,data.training.reduce((a,b)=>a.mean>b.mean?a:b).c);
assert.deepEqual(evaluate([data.selected.c],data.selected.games,data.selected.seed)[0],data.selected,'Published average reproduces exactly');
console.log('PASS: UCB initializes, explores, exploits, respects 100 coins, and reproduces the independent 50,000-game benchmark.');
