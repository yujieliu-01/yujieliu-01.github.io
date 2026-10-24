// Queueing rules retained from the original 60-second game.
export const GameEngine = (() => {
  'use strict';
  const T = 60, DT = 2.5, LAMBDA = .7;
  const modes = {cat:{cap:[3,0],name:'鱼罐头 ×3'},mix:{cap:[2,2],name:'罐头 ×2 · 骨汤 ×2'},dog:{cap:[0,5],name:'骨头汤 ×5'}};
  function mulberry32(a) { return () => { let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296; }; }
  function arrivals(seed) {
    let id=5; const events=[];
    for(let i=0;i<2;i++) {const r=mulberry32(seed^(i?0xA153B9CD:0x521B9D4F));let t=0;while(true){t+=-Math.log(Math.max(1e-10,1-r()))/LAMBDA;if(t>=T)break;events.push({id:id++,type:i?'dog':'cat',t});}}
    return events.sort((a,b)=>a.t-b.t);
  }
  function create(seed = 94715) {
    return {seed,events:arrivals(seed),q:{cat:[{id:1,type:'cat'},{id:2,type:'cat'}],dog:[{id:3,type:'dog'},{id:4,type:'dog'}]},history:[{t:0,cat:2,dog:2}],round:0,nextArrival:0,served:0,selected:'mix',current:'mix',eligible:{cat:[],dog:[]},time:0,started:false,finished:false};
  }
  function select(s,mode) {if(modes[mode]&&!s.finished)s.selected=mode;}
  function begin(s) {s.current=s.selected;for(const [i,type] of ['cat','dog'].entries())s.eligible[type]=s.q[type].slice(0,modes[s.current].cap[i]).map(o=>o.id);}
  function start(s) {if(s.started)return;s.started=true;begin(s);}
  function record(s,t) {const point={t,cat:s.q.cat.length,dog:s.q.dog.length};const last=s.history.at(-1);if(last.cat!==point.cat||last.dog!==point.dog)s.history.push(point);}
  function advance(s, t, onEvent = () => {}, autoPolicy = null) {
    if(!s.started||s.finished)return;
    t=Math.max(s.time,Math.min(T,t));
    while(true){
      const nextA=s.events[s.nextArrival]?.t??Infinity;
      const nextB=s.round<T/DT?(s.round+1)*DT:Infinity;
      const next=Math.min(nextA,nextB);if(next>t+1e-8||next===Infinity)break;
      if(nextA<=nextB){const o=s.events[s.nextArrival++];s.q[o.type].push(o);record(s,o.t);onEvent({kind:'arrival',pet:o,t:o.t});}
      else {
        const departed={cat:[],dog:[]};
        for(const type of ['cat','dog']){const ids=new Set(s.eligible[type]);departed[type]=s.q[type].filter(o=>ids.has(o.id));s.q[type]=s.q[type].filter(o=>!ids.has(o.id));}
        const served=departed.cat.length+departed.dog.length;s.served+=served;s.round++;record(s,nextB);
        if(s.round===T/DT){s.finished=true;s.time=T;}
        else {if(autoPolicy)s.selected=autoPolicy(s.q.cat.length,s.q.dog.length);begin(s);}
        onEvent({kind:'batch',departed,served,t:nextB});
        if(s.finished)break;
      }
    }
    s.time=t;
  }
  function policy(mode,qc,qd){let best='mix',value=mode==='MW'?-Infinity:Infinity;for(const k of ['mix','cat','dog']){const[a,b]=modes[k].cap;const next=mode==='MW'?qc*a+qd*b:Math.max(0,qc-a)**2+Math.max(0,qd-b)**2;if(mode==='MW'?next>value:next<value){best=k;value=next;}}return best;}
  function simulate(seed,mode){const s=create(seed);s.selected=policy(mode,2,2);start(s);advance(s,T,()=>{},(c,d)=>policy(mode,c,d));return {cat:s.q.cat.length,dog:s.q.dog.length,backlog:s.q.cat.length+s.q.dog.length,served:s.served,history:s.history};}
  return {T,DT,LAMBDA,modes,arrivals,create,select,start,advance,policy,simulate};
})();
