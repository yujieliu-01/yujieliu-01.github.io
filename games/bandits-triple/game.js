(() => {
  'use strict';
  const E=window.TripleBandits,$=s=>document.querySelector(s),letters=['A','B','C'];
  const symbols=['cherry','orange','melon'],names=['樱桃','橘子','西瓜'];
  const svg=i=>`<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#${symbols[i]}"/></svg>`;
  const reelCells=(fruit)=>[(fruit+2)%3,fruit,(fruit+1)%3].map(f=>`<div class="reel-cell">${svg(f)}</div>`).join('');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),wait=ms=>new Promise(r=>setTimeout(r,ms));
  let state,busy=false,generation=0,sound=false,audio,glowTimer;
  const machine=i=>document.querySelector(`.machine[data-arm="${i}"]`);
  function tone(freq,duration=.1,delay=0,type='sine') {
    if(!sound||!audio)return;
    const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;
    o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+duration);
  }
  function markup(i) {
    return `<article class="machine" data-arm="${i}"><h2 class="machine-heading"><span>MACHINE ${letters[i]}</span><span>1 COIN / PLAY</span></h2><div class="stage"><div class="machine-shadow"></div><div class="cabinet" aria-hidden="true"><div class="marquee"><strong>FRUIT BANDITS</strong><small>★ LUCKY ${letters[i]} ★</small><div class="bulbs">${'<i></i>'.repeat(9)}</div></div><div class="reel-frame">${[0,1,2].map(f=>`<div class="reel-window"><div class="reel-strip">${reelCells(f)}</div></div>`).join('')}</div><div class="payline"></div><div class="payout-label">THREE ALIKE · YOU WIN</div><div class="coin-slot"></div><div class="outlet"><div class="flap"></div></div><span class="screw">+</span><span class="screw">+</span></div><button class="lever" data-play="${i}" aria-label="拉动 ${letters[i]} 机器的扳臂，投入1枚硬币" title="点击或向下拉动扳臂"><span class="lever-socket"></span><span class="lever-stick"><span class="lever-ball"></span></span></button></div><div class="machine-controls"><span class="lamp" aria-hidden="true"></span><button class="play-button" data-play="${i}" aria-label="向 ${letters[i]} 机器投币开转">投 1 枚 <small>${i+1}</small></button><button class="batch-button" data-play="${i}" data-count="5" aria-label="向 ${letters[i]} 机器连续投5枚" title="同一台连续开奖5次，每次1枚"><b>×5</b><span>连投</span></button></div><div class="machine-status">中线三颗一样，即中奖。</div><div class="machine-data"><div class="fraction-stat" aria-label="中奖次数 / 投入枚数"><strong data-stat="wins">0</strong><span class="fraction-slash">/</span><span data-stat="count">0</span><span class="fraction-rate" data-stat="rate" aria-label="历史中奖率" title="历史中奖率：中奖次数 ÷ 投入枚数">—</span></div><div class="fraction-caption">中奖次数 / 投入枚数 · 历史中奖率</div><div class="history-head"><span>最近 10 次</span><span class="history-key"><i></i>中 <i></i>未中</span></div><div class="history-dots" aria-label="最近10次开奖结果，从左到右">${'<i class="pending"></i>'.repeat(10)}</div></div></article>`;
  }
  function lock(on) {
    document.querySelectorAll('[data-play]').forEach(b=>{const cost=Number(b.dataset.count||1);b.disabled=on||100-state.history.length<cost;if(cost===5)b.title=100-state.history.length<5?'剩余不足5枚，请单次投币':'同一台连续开奖5次，每次1枚';});
    $('#restart').disabled=on;
  }
  function start() {
    generation++;busy=false;clearTimeout(glowTimer);$('.dashboard').classList.remove('win-celebrate');state=E.create();$('#machines').innerHTML=letters.map((_,i)=>markup(i)).join('');
    $('#win-count').textContent='0';$('#coins').textContent='100';$('#progress').style.width='100%';$('#result').hidden=true;$('#result').innerHTML='';
    $('#status').textContent='投 1 枚试试手气，或选 ×5 在同一台连续投 5 枚。';lock(false);
    // Pointer dragging and clicking both activate the lever once, with shared spin locking.
    document.querySelectorAll('.lever').forEach(lever=>{
      let origin=null,dragged=false;
      lever.addEventListener('pointerdown',e=>{if(lever.disabled||e.button!==0)return;origin=e.clientY;dragged=false;lever.setPointerCapture(e.pointerId);});
      lever.addEventListener('pointermove',e=>{if(origin===null||dragged)return;if(e.clientY-origin>22){dragged=true;play(Number(lever.dataset.play));}});
      lever.addEventListener('pointerup',()=>{origin=null;});
      lever.addEventListener('pointercancel',()=>{origin=null;});
      lever.addEventListener('click',e=>{if(dragged){e.stopPropagation();dragged=false;}});
    });
  }
  function renderStats(arm) {
    const m=machine(arm),s=state.stats[arm],history=state.history.filter(e=>e.arm===arm);
    for(const key of ['count','wins'])m.querySelector(`[data-stat="${key}"]`).textContent=s[key];
    const rate=m.querySelector('[data-stat="rate"]');
    rate.textContent=s.count?`${Math.round(100*s.wins/s.count)}%`:'—';
    rate.setAttribute('aria-label',`历史中奖率：${rate.textContent}`);
    const recent=history.slice(-10);
    m.querySelector('.history-dots').innerHTML=recent.map(e=>`<i class="${e.win?'win':'loss'}" role="img" aria-label="第 ${e.turn} 次：${e.win?'中奖':'未中'}" title="第 ${e.turn} 次：${e.win?'中奖':'未中'}"></i>`).join('')+'<i class="pending" aria-hidden="true"></i>'.repeat(10-recent.length);
  }
  async function spinReel(strip,outcome,index,fast,token) {
    const steps=18+index*3,duration=reduced.matches?70+index*50:fast?210+index*65:850+index*260;
    // Each symbol is 56% of the taller window. The payline crosses the middle
    // symbol at index 1, with neighboring symbols visible above and below it.
    const cells=Array.from({length:steps+4},(_,n)=>n===1?outcome:n===0?(outcome+2)%3:n===2?(outcome+1)%3:(n+index)%3);
    strip.innerHTML=cells.map(f=>`<div class="reel-cell">${svg(f)}</div>`).join('');
    const animation=reduced.matches?null:strip.animate([{transform:`translateY(-${steps*56+34}%)`},{transform:'translateY(-31%)',offset:.96},{transform:'translateY(-34%)'}],{duration,easing:'cubic-bezier(.2,.25,.15,1)',fill:'forwards'});
    await wait(duration);
    if(token!==generation){animation?.cancel();return;}
    animation?.cancel();strip.innerHTML=reelCells(outcome);
    tone(220+index*60,.05,0,'triangle');
  }
  async function play(arm,count=1) {
    if(busy||$('#restart-dialog').open||![1,5].includes(count)||100-state.history.length<count)return;
    busy=true;lock(true);
    const token=generation,fast=$('#fast').checked,beforeWins=state.wins,m=machine(arm);
    const batchButton=m.querySelector('.batch-button');
    if(count===5)m.classList.add('batch-running');
    try {
      for(let step=1;step<=count;step++) {
        if(token!==generation)return;
        if(count===5)batchButton.innerHTML=`<b>${step}/5</b><span>连投中</span>`;
        await playOnce(arm,token,fast,count===5?`连投 ${step}/5 · `:'');
      }
      if(token!==generation)return;
      if(count===5){
        const message=`${letters[arm]} 连投完成：5 枚，中奖 ${state.wins-beforeWins} 次。`;
        $('#status').textContent=message;m.querySelector('.machine-status').textContent=message;
      }
    } finally {
      if(token===generation){busy=false;m.classList.remove('batch-running');batchButton.innerHTML='<b>×5</b><span>连投</span>';lock(false);}
    }
    if(token===generation&&state.history.length===100)finish();
  }
  async function playOnce(arm,token,fast,batchLabel) {
    const event=E.choose(state,arm),m=machine(arm),stage=m.querySelector('.stage');
    document.querySelectorAll('.machine').forEach(el=>el.classList.remove('won','miss','match-flash'));
    m.querySelectorAll('.spark,.drop-fruit').forEach(el=>el.remove());
    m.style.setProperty('--lever-duration',fast?'300ms':'500ms');m.classList.remove('pulling');void m.offsetWidth;m.classList.add('pulling','playing');
    $('#coins').textContent=100-state.history.length;$('#progress').style.width=`${100-state.history.length}%`;
    $('#status').textContent=`${batchLabel}${letters[arm]} 机器开转，等第三列停下……`;
    m.querySelector('.machine-status').textContent=`${batchLabel}开转……`;tone(570,.06);tone(360,.08,.08,'triangle');
    const strips=[...m.querySelectorAll('.reel-strip')];
    await Promise.all(strips.map((strip,i)=>spinReel(strip,event.reels[i],i,fast,token)));
    if(token!==generation)return;
    // The previous win can remain visible during the next spin, but never over its result.
    m.querySelectorAll('.win-flash').forEach(el=>el.remove());
    m.classList.remove('playing');
    if(event.win) {
      m.classList.add('won','match-flash');m.querySelector('.payout-label').textContent='★ THREE OF A KIND ★';
      m.style.setProperty('--match-duration', `${fast?140:360}ms`);
      tone(523,.15);tone(659,.16,.1);tone(784,.25,.2);
      // All three center symbols celebrate together before the fruit is released.
      await wait(reduced.matches?60:fast?140:360);
      if(token!==generation)return;
      m.classList.remove('match-flash');m.classList.add('eject');
      // Keep the same element: the falling fruit turns into the +1 badge where it lands.
      const fruit=document.createElement('div');fruit.className='drop-fruit';fruit.style.left='49%';fruit.innerHTML=svg(event.reels[0]);
      fruit.style.animationDuration=`${reduced.matches?80:fast?160:500}ms`;stage.append(fruit);
      await wait(reduced.matches?80:fast?160:500);
      if(token!==generation)return;
      m.classList.remove('eject');m.querySelectorAll('.win-flash').forEach(el=>el.remove());fruit.className='win-flash';fruit.removeAttribute('style');
      fruit.innerHTML='<span>中奖 <b>+1</b></span>';setTimeout(()=>fruit.remove(),1250);
      if(!reduced.matches)for(let i=0;i<9;i++){const p=document.createElement('i');p.className='spark';p.style.setProperty('--x',`${Math.cos(i*2.4)*90}px`);p.style.setProperty('--y',`${Math.sin(i*2.4)*70}px`);stage.append(p);setTimeout(()=>p.remove(),850);}
      m.querySelector('.machine-status').textContent=`三连${names[event.reels[0]]}，中奖！`;
      $('#status').textContent=`${letters[arm]} 机器三连${names[event.reels[0]]}，中奖一次！`;
    } else {
      m.classList.add('miss');m.querySelector('.payout-label').textContent='TRY YOUR LUCK AGAIN';
      m.querySelector('.machine-status').textContent='这次未中。下一枚投哪里？';
      $('#status').textContent=`${letters[arm]} 机器没有凑齐三颗相同水果，这次未中。`;tone(170,.12,0,'triangle');
      await wait(reduced.matches?50:fast?45:160);
    }
    if(token!==generation)return;
    $('#win-count').textContent=state.wins;
    if(event.win){
      $('#win-count').classList.remove('pop');$('.dashboard').classList.remove('win-celebrate');
      void $('#win-count').offsetWidth;
      $('#win-count').classList.add('pop');$('.dashboard').classList.add('win-celebrate');
      clearTimeout(glowTimer);glowTimer=setTimeout(()=>$('.dashboard').classList.remove('win-celebrate'),750);
    }
    renderStats(arm);
  }
  function finish() {
    const wins=state.stats.reduce((n,s)=>n+s.wins,0),best=state.probabilities.indexOf(Math.max(...state.probabilities)),max=Math.max(...state.stats.map(s=>s.count));
    const most=state.stats.map((s,i)=>s.count===max?letters[i]:null).filter(Boolean).join('、');
    $('#status').textContent='100 枚硬币用完了，来看看这一局的机器秘密。';
    const benchmark=window.FruitBanditsUCB,average=benchmark.mean.toFixed(1),difference=wins-benchmark.mean;
    const comparison=Math.abs(difference)<.05?'与 UCB 均值持平':`比 UCB 均值${difference>0?'多':'少'} ${Math.abs(difference).toFixed(1)} 次中奖`;
    $('#result').innerHTML=`<p class="eyebrow">ONE HUNDRED LITTLE DECISIONS</p><h2>100 枚投完，你的选择有了答案。</h2><div class="benchmark-comparison"><div class="comparison-player"><span>你的本局</span><div><strong>${wins}</strong><small>/ 100</small></div><span>中奖次数 / 投入枚数</span></div><div class="comparison-ucb"><span>UCB 平均表现</span><div><strong>${average}</strong><small>/ 100</small></div><span>${benchmark.games.toLocaleString('zh-CN')} 局独立模拟均值</span></div></div><p class="comparison-difference">本局${comparison}</p><p class="benchmark-note">相同的 40% / 50% / 60% 概率、随机位置与 100 枚预算。UCB 每投一枚，根据已观察的结果选择下一台。<br>探索系数 c = ${benchmark.c.toFixed(2)}，由另组模拟调参。单局结果有波动，均值仅供比较。 <a href="${benchmark.source}" target="_blank" rel="noopener noreferrer" title="UCB1 原始论文；本游戏另行调整探索系数">算法参考 ↗</a></p><div class="reveals">${state.probabilities.map((p,i)=>`<article class="reveal-card ${i===best?'best':''}"><h3>MACHINE ${letters[i]} ${i===best?'★':''}</h3><strong>${Math.round(p*100)}%</strong> <small>真实中奖率</small><p>你投入 ${state.stats[i].count} 枚 · 中 ${state.stats[i].wins} 次</p><p>历史中奖率 ${state.stats[i].count?(100*state.stats[i].wins/state.stats[i].count).toFixed(0)+'%':'—'}</p><div class="allocation"><i style="width:${state.stats[i].count}%"></i></div></article>`).join('')}</div><p>你选择次数最多的是 ${most}；本局真实中奖率最高的是 ${letters[best]}。</p><div class="record-caption">你的 100 次选择 · 从左到右按时间排列 · 金色表示中奖</div><div class="round-timeline">${state.history.map(e=>`<span class="${e.win?'win':''}" title="第 ${e.turn} 次：${letters[e.arm]}，${e.win?'中奖':'未中'}">${letters[e.arm]}</span>`).join('')}</div><p class="explanation">试试别的机器，是「探索」；继续选择看好的机器，是「利用」。<br>每次开奖彼此独立，连中或连败都不会改变概率。60% 的机器也会输，40% 的机器也能连中；短期中奖率，未必就是真实概率。</p><div class="result-buttons"><button class="primary" id="play-again">打乱机器，再来一局 ↗</button><a href="fruit-bandits.html">回到第一版比较</a></div>`;
    $('#result').hidden=false;$('#result').focus({preventScroll:true});$('#result').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});
    $('#play-again').addEventListener('click',()=>{start();$('.game').scrollIntoView({behavior:reduced.matches?'instant':'smooth'});$('.play-button').focus({preventScroll:true});});
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('#restart-dialog').open&&window.parent!==window){
      e.preventDefault();window.parent.postMessage({type:'homepage:close'},location.origin);
    }
  });
  $('#machines').addEventListener('click',e=>{const b=e.target.closest('[data-play]');if(b)play(Number(b.dataset.play),Number(b.dataset.count||1));});
  document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||$('#restart-dialog').open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(['1','2','3'].includes(e.key)){e.preventDefault();play(Number(e.key)-1);}});
  $('#sound').addEventListener('click',async()=>{sound=!sound;if(sound){try{audio ||=new(window.AudioContext||window.webkitAudioContext)();await audio.resume();}catch{sound=false;$('#status').textContent='当前浏览器无法播放音效，仍可正常游戏。';}}$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').textContent=sound?'♪ 音效开':'♪ 音效关';if(sound)tone(660,.1);});
  $('#restart').addEventListener('click',()=>{if(!state.history.length||state.history.length===100)start();else{$('#restart-dialog').showModal();$('#cancel-restart').focus();}});
  $('#cancel-restart').addEventListener('click',()=>$('#restart-dialog').close());
  $('#confirm-restart').addEventListener('click',()=>{$('#restart-dialog').close();start();$('.play-button').focus();});
  start();
})();
