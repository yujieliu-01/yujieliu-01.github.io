(() => {
  'use strict';
  const E = window.FruitBandits, $ = selector => document.querySelector(selector);
  const symbols = ['monkey', 'cherry', 'orange', 'melon'], names = ['猴子', '樱桃', '橘子', '西瓜'];
  const letters = ['A', 'B', 'C'], reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const svg = index => `<svg aria-hidden="true" viewBox="0 0 100 100"><use href="#${symbols[index]}"/></svg>`;
  let round = 0, state, busy = false, sound = false, audio, generation = 0;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function tone(frequency, duration, delay = 0, type = 'sine') {
    if (!sound || !audio) return;
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + delay;
    o.type = type; o.frequency.value = frequency; g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.06, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + duration);
  }
  function machineMarkup(i) {
    return `<article class="machine" data-arm="${i}"><h2 class="machine-label">MACHINE ${letters[i]}</h2><div class="stage" aria-hidden="true"><div class="cabinet"><div class="machine-title">FRUIT • ${letters[i]}</div><div class="awning"></div><div class="window"><div class="reel"><div class="reel-cell">${svg(i + 1)}</div></div></div><div class="slot"><div class="flap"></div></div><span class="screw left">＋</span><span class="screw right">＋</span></div><div class="tube"><div class="coins"></div><span class="tube-number">0</span></div><div class="basket-wrap"><div class="basket-fruits"></div><div class="basket"></div><span class="empty-basket">等一颗水果</span></div></div><button class="play-button" data-arm="${i}" aria-label="向 ${letters[i]} 机器投入一枚硬币">投一枚 <small>${i + 1} ↵</small></button></article>`;
  }
  function records() {
    $('#records-body').innerHTML = state.stats.map((s, i) => `<tr><td>机器 ${letters[i]}</td><td>${s.count}</td><td>${s.outcomes[1]}</td><td>${s.outcomes[2]}</td><td>${s.outcomes[3]}</td><td>${s.outcomes[0]}</td><td>${s.total}</td><td>${s.count ? (s.total / s.count).toFixed(2) : '—'}</td></tr>`).join('');
  }
  function lock(locked) {
    document.querySelectorAll('.play-button').forEach(b => {b.disabled = locked || state.history.length === 100;});
    $('#restart').disabled = locked;
  }
  function start() {
    generation++; busy = false; state = E.create(round++);
    $('#machines').innerHTML = letters.map((_, i) => machineMarkup(i)).join('');
    $('#score').textContent = '0'; $('#coins').textContent = '100'; $('#progress').style.width = '100%';
    $('#result').hidden = true; $('#result').innerHTML = '';
    $('#status').textContent = '每次 1 枚硬币。点击「投一枚」，看看会掉下什么。';
    $('#records').hidden = true; $('#records-toggle').setAttribute('aria-expanded', 'false');
    $('#records-toggle').innerHTML = '查看记录 <span>＋</span>';
    records(); lock(false);
  }
  function fillBasket(arm, machine) {
    const fruits = state.history.filter(e => e.arm === arm && e.outcome > 0).slice(-12);
    machine.querySelector('.basket-fruits').innerHTML = fruits.map((e, i) => `<svg viewBox="0 0 100 100" style="left:${8 + (i % 4) * 19 + (Math.floor(i / 4) % 2) * 3}%;bottom:${13 + Math.floor(i / 4) * 19}%;transform:rotate(${(i * 17) % 39 - 19}deg)"><use href="#${symbols[e.outcome]}"/></svg>`).join('');
    machine.querySelector('.empty-basket').hidden = !!fruits.length;
  }
  async function play(arm) {
    if (busy || $('#restart-dialog').open || state.history.length >= 100) return;
    busy = true; lock(true);
    const event = E.choose(state, arm), ownGeneration = generation;
    if (!event) { busy = false; lock(false); return; }
    const machine = document.querySelector(`.machine[data-arm="${arm}"]`), stage = machine.querySelector('.stage');
    machine.querySelectorAll('.drop,.speech,.float-score').forEach(el => el.remove());
    const fast = $('#fast').checked, spinTime = reduced.matches ? 70 : fast ? 240 : 620, dropTime = reduced.matches ? 70 : fast ? 180 : 380;
    $('#coins').textContent = 100 - state.history.length;
    $('#progress').style.width = `${100 - state.history.length}%`;
    machine.querySelector('.tube-number').textContent = state.stats[arm].count;
    const coin = document.createElement('span'); coin.className = 'stack-coin';
    coin.style.bottom = `${(state.stats[arm].count - 1) * .94}%`; machine.querySelector('.coins').append(coin);
    $('#status').textContent = `${letters[arm]} 机器正在开奖……`;
    tone(500, .07); tone(320, .05, .08, 'triangle');
    const reel = machine.querySelector('.reel'), turns = 12;
    // Cosmetic reels are independent of the already sampled reward.
    reel.innerHTML = Array.from({length: turns + 1}, (_, i) => `<div class="reel-cell">${svg(i === turns ? event.outcome : (i + arm) % 4)}</div>`).join('');
    const animation = reduced.matches ? null : reel.animate([
      {transform: 'translateY(0)'}, {transform: `translateY(-${turns * 100 + 3}%)`, offset: .94}, {transform: `translateY(-${turns * 100}%)`}
    ], {duration: spinTime, easing: 'cubic-bezier(.12,.65,.2,1)', fill: 'forwards'});
    await wait(spinTime);
    if (generation !== ownGeneration) return;
    animation?.cancel(); reel.innerHTML = `<div class="reel-cell">${svg(event.outcome)}</div>`;
    machine.classList.add('eject'); tone(190, .06, 0, 'triangle');
    const drop = document.createElement('div'); drop.className = `drop ${event.outcome === 0 ? 'monkey' : ''}`; drop.innerHTML = svg(event.outcome);
    drop.style.animationDuration = `${dropTime}ms`; stage.append(drop);
    await wait(dropTime);
    if (generation !== ownGeneration) return;
    machine.classList.remove('eject');
    $('#score').textContent = state.total;
    $('#score').classList.remove('score-pop'); void $('#score').offsetWidth; $('#score').classList.add('score-pop');
    const popup = document.createElement('div'); popup.className = `float-score ${event.outcome === 3 ? 'jackpot' : ''}`;
    popup.textContent = `+${event.points}`; stage.append(popup); setTimeout(() => popup.remove(), 900);
    if (event.outcome > 0) {
      drop.remove(); fillBasket(arm, machine);
      const basket = machine.querySelector('.basket-wrap'); basket.classList.remove('bounce'); void basket.offsetWidth; basket.classList.add('bounce');
      tone(event.outcome === 3 ? 660 : 520, .16); tone(event.outcome === 3 ? 990 : 780, .2, .1);
      $('#status').textContent = event.outcome === 3 ? `${letters[arm]} 掉下一块大西瓜！+10 分，这一枚很值。` : `${letters[arm]} 的${names[event.outcome]}落进篮子，+${event.points} 分。下一枚投给谁？`;
    } else {
      const speech = document.createElement('div'); speech.className = 'speech'; speech.textContent = ['嘿嘿，这颗归我啦！', '水果我收下啦～', '嘻嘻，下次再来！'][state.stats[arm].outcomes[0] % 3]; stage.append(speech);
      tone(310, .09); tone(410, .07, .12); tone(270, .12, .23);
      $('#status').textContent = `${letters[arm]} 跑出一只小馋猴，本次 +0。已经拿到的分数都还在。`;
      setTimeout(() => {speech.remove(); drop.style.animationDuration = ''; drop.classList.add('escape'); setTimeout(() => drop.remove(), 550);}, fast ? 220 : 520);
    }
    records();
    if (event.outcome === 0) await wait(reduced.matches ? 40 : fast ? 100 : 180);
    if (generation !== ownGeneration) return;
    busy = false; lock(false);
    if (state.history.length === 100) finish();
  }
  function finish() {
    const totals = [0, 1, 2, 3].map(o => state.stats.reduce((sum, s) => sum + s.outcomes[o], 0));
    $('#status').textContent = '100 枚硬币已全部用完。来看看你的收获！';
    $('#result').innerHTML = `<p class="eyebrow">A BASKET FULL OF DECISIONS</p><h2>收获了 <strong>${state.total}</strong> 分！</h2><div class="harvest">${[1,2,3].map(o => `<span>${svg(o)}× ${totals[o]}</span>`).join('')}</div><p>还有 ${totals[0]} 次，小猴子抢先了一步。<br>每一枚硬币，都让你多了解了一点这三台机器。</p><button class="primary" id="reveal">揭晓机器的秘密 ↓</button><div id="secrets" hidden></div>`;
    $('#result').hidden = false; $('#result').focus({preventScroll:true}); $('#result').scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block:'nearest'});
    $('#reveal').addEventListener('click', reveal);
  }
  function reveal() {
    const s = E.summary(state), maxCount = Math.max(...state.stats.map(x => x.count));
    const most = state.stats.map((x, i) => x.count === maxCount ? letters[i] : null).filter(Boolean).join('、');
    const best = s.means.map((m, i) => Math.abs(m - s.means[s.best]) < 1e-10 ? letters[i] : null).filter(Boolean).join('、');
    $('#secrets').innerHTML = `<div class="reveal-grid">${state.profiles.map((p, i) => `<article class="reveal-card ${s.means[i] === s.means[s.best] ? 'best' : ''}"><h3>机器 ${letters[i]}<small>${s.means[i] === s.means[s.best] ? '真实平均收益最高' : '概率在本局内保持固定'}</small></h3>${[1,2,3,0].map(o => `<div class="prob-row"><span>${names[o]} ${E.rewards[o]}分</span><span>${(p[o] * 100).toFixed(1)}%</span></div>`).join('')}<div class="mean"><strong>${s.means[i].toFixed(2)}</strong> 分 / 枚<br>你投入了 ${state.stats[i].count} 枚</div></article>`).join('')}</div><p>你选择${most.includes('、') ? '次数并列最多的是' : '最多的是'} ${most}，共${most.includes('、') ? '各' : ''} ${maxCount} 枚。<br>本局机器 ${best} 的真实平均收益最高。一次好运或坏运，都不是全部答案。</p><details><summary>这和多臂老虎机有什么关系？</summary><p>选择一台机器，一方面获得分数，另一方面了解它。继续尝试未知机器是「探索」，选择当前看好的机器是「利用」。每次独立开奖；机器不会因为连败而改变概率。</p><p>按你实际的硬币分配，把每次得分替换成对应机器的真实均值，合计为 ${s.expected.toFixed(2)} 分。100 次都选最高真实均值的机器，期望总分为 ${(100 * s.means[s.best]).toFixed(2)} 分，两个数相差 ${s.regret.toFixed(2)}。这个累计均值差是本局的 pseudo-regret：Σ Nᵢ(μ* − μᵢ)。它不是「最佳期望分减实际总分」，也不能凭一局判定长期策略水平。</p><p>每局配置不同，跨局总分不能直接比较策略好坏。</p></details><button id="play-again" class="primary">换一组机器，再来一局 ↗</button>`;
    $('#secrets').hidden = false; $('#reveal').hidden = true;
    $('#play-again').addEventListener('click', () => { start(); $('.game').scrollIntoView({behavior:'smooth'}); $('.play-button').focus({preventScroll:true}); });
  }
  $('#machines').addEventListener('click', e => {const b = e.target.closest('.play-button'); if (b) play(Number(b.dataset.arm));});
  document.addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || $('#restart-dialog').open) return;
    if (['1','2','3'].includes(e.key)) {e.preventDefault(); play(Number(e.key) - 1);}
  });
  $('#records-toggle').addEventListener('click', () => {const open = $('#records').hidden; $('#records').hidden = !open; $('#records-toggle').setAttribute('aria-expanded', String(open)); $('#records-toggle').innerHTML = `${open ? '收起记录' : '查看记录'} <span>${open ? '−' : '＋'}</span>`;});
  $('#sound').addEventListener('click', async () => {
    sound = !sound;
    if (sound) {
      try {audio ||= new (window.AudioContext || window.webkitAudioContext)(); await audio.resume();}
      catch {sound = false; $('#status').textContent = '当前浏览器暂时无法播放音效，仍可正常游戏。';}
    }
    $('#sound').setAttribute('aria-pressed', String(sound)); $('#sound span').textContent = sound ? '开' : '关';
    $('#sound').title = sound ? '关闭音效' : '开启音效'; if (sound) tone(660, .12);
  });
  $('#restart').addEventListener('click', () => {if (!state.history.length || state.history.length === 100) start(); else {$('#restart-dialog').showModal(); $('#cancel-restart').focus();}});
  $('#cancel-restart').addEventListener('click', () => $('#restart-dialog').close());
  $('#confirm-restart').addEventListener('click', () => {$('#restart-dialog').close(); start(); $('.play-button').focus();});
  start();
})();
