/* The game engine owns every draw; the original cat illustration only shows it. */
(() => {
  'use strict';
  const E = window.TripleBandits;
  const $ = selector => document.querySelector(selector);
  const letters = ['A', 'B', 'C'];
  const fruits = ['cherry', 'orange', 'melon'];
  const fruitNames = ['樱桃', '柠檬', '西瓜'];
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const fruitIcon = fruit => `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#${fruits[fruit]}"/></svg>`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let state, busy = false, generation = 0, ready = false, sharedArt = null;
  let renderers = [], sound = false, audio, glowTimer, paused = false;
  const machine = arm => document.querySelector(`.machine[data-arm="${arm}"]`);
  const dialogOpen = () => !!document.querySelector('dialog[open]');

  function markup(arm) {
    const letter = letters[arm];
    return `<article class="machine" data-arm="${arm}" aria-labelledby="machine-title-${arm}">
      <h2 class="machine-heading" id="machine-title-${arm}"><span class="machine-letter">${letter}</span>${arm + 1} 号水果机<span>ONE COIN, ONE TRY</span></h2>
      <div class="stage"><div class="machine-floor" aria-hidden="true"></div><canvas class="cat-scene" width="640" height="571" aria-hidden="true"></canvas><img class="scene-poster" src="../assets/cat-slot-static.png" alt="" decoding="async"><button class="stage-button" data-play="${arm}" aria-label="点击 ${letter} 号水果机，投入1枚硬币" title="点击投币，也可以向下拉动" disabled></button><span class="stage-hint">投一枚，试试手气</span></div>
      <div class="machine-controls"><button class="play-button" data-play="${arm}" aria-label="向 ${letter} 号机投1枚硬币" disabled>${icon('coin')}<span>投 1 枚</span><small>${arm + 1}</small></button><button class="batch-button" data-play="${arm}" data-count="5" aria-label="向 ${letter} 号机连续投5枚硬币" disabled><b>×5</b><span>连续投</span></button></div>
      <div class="machine-status">小猫已经坐好，就等你啦。</div><span class="sr-only" data-outcome>尚未开奖。</span>
      <div class="station-ledger"><span>${icon('fish')}<strong data-stat="wins">0</strong> 条</span><i class="ledger-divider" aria-hidden="true"></i><span>已投 <strong data-stat="count">0</strong> 枚</span></div>
      <details class="machine-record"><summary aria-label="${letter} 号机开奖记录">开奖记录 ${icon('chevron')}</summary><div class="machine-data"><div class="rate-line"><span>历史中奖率</span><strong data-stat="rate">—</strong></div><div class="history-head"><span>最近 10 次</span><span class="history-key"><i></i>中 <i></i>未中</span></div><div class="history-dots" aria-label="最近10次开奖结果，从左到右">${'<i class="pending" aria-hidden="true"></i>'.repeat(10)}</div><p>这只是目前的观察；真实中奖率将在结算时揭晓。</p></div></details>
    </article>`;
  }

  function lock() {
    const coins = 100 - state.history.length;
    document.querySelectorAll('[data-play]').forEach(button => {
      const cost = Number(button.dataset.count || 1);
      button.disabled = busy || !ready || paused || coins < cost;
      if (cost === 5) button.title = coins < 5 ? '剩余不足5枚，请单次投币' : '在同一台连续开奖5次，每次1枚';
    });
    $('#restart').disabled = busy || !ready || paused;
    $('.arcade').classList.toggle('is-busy', busy);
    $('#machines').setAttribute('aria-busy', String(busy || !ready));
  }

  function mountArt() {
    renderers.forEach(renderer => renderer?.destroy());
    renderers = letters.map((_, arm) => {
      if (!sharedArt) return null;
      try {
        const scene = sharedArt.mount(machine(arm).querySelector('canvas'), {index: arm});
        const latest = state.history.filter(event => event.arm === arm).at(-1);
        scene.idle(latest?.reels || [0, 1, 2]);
        machine(arm).classList.add('scene-ready');
        return scene;
      } catch (error) {
        console.error('Cat scene initialization failed:', error);
        return null;
      }
    });
  }

  function start() {
    generation++;
    renderers.forEach(renderer => renderer?.destroy());
    renderers = [];
    busy = false;
    paused = false;
    clearTimeout(glowTimer);
    $('.dashboard').classList.remove('win-celebrate');
    state = E.create();
    $('#machines').innerHTML = letters.map((_, arm) => markup(arm)).join('');
    $('#win-count').textContent = '0';
    $('#coins').textContent = '100';
    $('#progress').style.width = '100%';
    $('#result').hidden = true;
    $('#result').innerHTML = '';
    $('#status').textContent = ready ? '选一台，帮小猫赢下第一条小鱼干。' : '小猫正在准备水果机……';
    if (sharedArt) mountArt();
    lock();
    document.querySelectorAll('.stage-button').forEach(button => {
      let origin = null, dragged = false;
      button.addEventListener('pointerdown', event => {
        if (button.disabled || event.button !== 0) return;
        origin = event.clientY;
        dragged = false;
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove', event => {
        if (origin === null || dragged || event.pointerType === 'touch') return;
        if (event.clientY - origin > 22) {
          dragged = true;
          play(Number(button.dataset.play));
        }
      });
      button.addEventListener('pointerup', () => { origin = null; });
      button.addEventListener('pointercancel', () => { origin = null; dragged = false; });
      button.addEventListener('click', event => {
        if (dragged) { event.stopPropagation(); dragged = false; }
      });
    });
  }

  function tone(frequency, duration = .1, delay = 0, type = 'sine') {
    if (!sound || !audio || paused) return;
    const oscillator = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.035, t + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(t);
    oscillator.stop(t + duration);
  }

  function renderStats(arm) {
    const element = machine(arm), stat = state.stats[arm];
    for (const key of ['count', 'wins']) element.querySelector(`[data-stat="${key}"]`).textContent = stat[key];
    const rate = element.querySelector('[data-stat="rate"]');
    rate.textContent = stat.count ? `${Math.round(100 * stat.wins / stat.count)}%` : '—';
    rate.setAttribute('aria-label', `历史中奖率：${rate.textContent}`);
    const history = state.history.filter(event => event.arm === arm).slice(-10);
    element.querySelector('.history-dots').innerHTML = history.map(event => `<i class="${event.win ? 'win' : 'loss'}" role="img" aria-label="第 ${event.turn} 次：${event.win ? '中奖' : '未中'}" title="第 ${event.turn} 次：${event.win ? '中奖' : '未中'}"></i>`).join('') + '<i class="pending" aria-hidden="true"></i>'.repeat(10 - history.length);
  }

  function celebrate(arm) {
    const stage = machine(arm).querySelector('.stage');
    const badge = document.createElement('div');
    badge.className = 'reward-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = `${icon('fish')}<b>+1</b>`;
    stage.append(badge);
    setTimeout(() => badge.remove(), 1300);
    if (!reduced.matches) for (let i = 0; i < 7; i++) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.setAttribute('aria-hidden', 'true');
      spark.innerHTML = icon('star');
      spark.style.setProperty('--x', `${Math.cos(i * 2.4) * 65}px`);
      spark.style.setProperty('--y', `${Math.sin(i * 2.4) * 55}px`);
      stage.append(spark);
      setTimeout(() => spark.remove(), 850);
    }
    const counter = $('#win-count'), ticket = $('.dashboard');
    counter.classList.remove('pop');
    ticket.classList.remove('win-celebrate');
    void counter.offsetWidth;
    counter.classList.add('pop');
    ticket.classList.add('win-celebrate');
    clearTimeout(glowTimer);
    glowTimer = setTimeout(() => ticket.classList.remove('win-celebrate'), 700);
  }

  function showFallback(arm, reels) {
    const stage = machine(arm).querySelector('.stage');
    let display = stage.querySelector('.fallback-reels');
    if (!display) { display = document.createElement('div'); display.className = 'fallback-reels'; stage.append(display); }
    display.innerHTML = reels.map(fruitIcon).join('');
    const canvas = machine(arm).querySelector('canvas');
    canvas.dataset.reels = reels.join(',');
    canvas.dataset.phase = 'idle';
  }

  async function playOnce(arm, token, fast, prefix) {
    const event = E.choose(state, arm), element = machine(arm);
    if (!event) return;
    document.querySelectorAll('.machine').forEach(node => node.classList.remove('won', 'miss', 'playing'));
    element.querySelectorAll('.reward-badge,.spark').forEach(node => node.remove());
    element.classList.add('playing');
    $('#coins').textContent = 100 - state.history.length;
    $('#progress').style.width = `${100 - state.history.length}%`;
    $('#status').textContent = `${prefix}${letters[arm]} 号机开转，小猫盯紧水果啦。`;
    element.querySelector('.machine-status').textContent = `${prefix}转呀转，好运快出现……`;
    tone(560, .07); tone(390, .08, .08, 'triangle');
    let announced = false;
    const reveal = () => {
      if (token !== generation || paused || announced) return;
      announced = true;
      element.classList.add(event.win ? 'won' : 'miss');
      element.querySelector('[data-outcome]').textContent = `${event.reels.map(fruit => fruitNames[fruit]).join('、')}。${event.win ? '中奖，小鱼干加1。' : '本次未中奖。'}`;
      if (event.win) {
        element.querySelector('.machine-status').textContent = `三连${fruitNames[event.reels[0]]}，小鱼干 +1！`;
        $('#status').textContent = `${prefix}${letters[arm]} 号机三连${fruitNames[event.reels[0]]}，小猫开饭啦！`;
        tone(523, .15); tone(659, .16, .09); tone(784, .23, .18);
        celebrate(arm);
      } else {
        element.querySelector('.machine-status').textContent = '差一点点，下一枚投哪里？';
        $('#status').textContent = `${prefix}${letters[arm]} 号机这次没凑成三连。再观察一下？`;
        tone(200, .1, 0, 'triangle');
      }
      $('#win-count').textContent = state.wins;
      renderStats(arm);
    };
    if (renderers[arm]) {
      try {
        await renderers[arm].play({reels: event.reels, win: event.win, fast, reducedMotion: reduced.matches, onReelsStopped: reveal});
      } catch (error) {
        console.error('Cat animation failed; showing the drawn outcome:', error);
        renderers[arm]?.destroy();
        renderers[arm] = null;
        showFallback(arm, event.reels);
      }
    } else {
      await wait(reduced.matches ? 100 : fast ? 420 : 850);
      if (token === generation && !paused) showFallback(arm, event.reels);
    }
    if (token !== generation || paused) return;
    reveal();
    element.classList.remove('playing');
  }

  async function play(arm, count = 1) {
    if (!Number.isInteger(arm) || arm < 0 || arm > 2 || busy || !ready || paused || dialogOpen() || ![1, 5].includes(count) || 100 - state.history.length < count) return;
    if (sound && audio?.state === 'suspended') audio.resume().catch(() => {});
    busy = true;
    lock();
    const token = generation, fast = $('#fast').checked, beforeWins = state.wins, element = machine(arm);
    const batch = element.querySelector('.batch-button');
    if (count === 5) element.classList.add('batch-running');
    try {
      for (let step = 1; step <= count; step++) {
        if (token !== generation || paused) return;
        if (count === 5) batch.innerHTML = `<b>${step}/5</b><span>连续投</span>`;
        await playOnce(arm, token, fast, count === 5 ? `连投 ${step}/5 · ` : '');
      }
      if (token !== generation || paused) return;
      if (count === 5) {
        const message = `${letters[arm]} 号机连投完成，收获 ${state.wins - beforeWins} 条小鱼干。`;
        $('#status').textContent = message;
        element.querySelector('.machine-status').textContent = message;
      }
    } finally {
      if (token === generation) {
        busy = false;
        element.classList.remove('batch-running', 'playing');
        batch.innerHTML = '<b>×5</b><span>连续投</span>';
        lock();
      }
    }
    if (token === generation && !paused && state.history.length === 100) finish();
  }

  function finish() {
    const wins = state.wins, best = state.probabilities.indexOf(Math.max(...state.probabilities));
    const max = Math.max(...state.stats.map(stat => stat.count));
    const most = state.stats.map((stat, arm) => stat.count === max ? letters[arm] : null).filter(Boolean).join('、');
    const benchmark = window.FruitBanditsUCB;
    const difference = wins - benchmark.mean;
    const comparison = Math.abs(difference) < .05 ? '与 UCB 平均表现持平' : `比 UCB 平均表现${difference > 0 ? '多' : '少'} ${Math.abs(difference).toFixed(1)} 条`;
    $('#status').textContent = '100 枚投完啦！来看看机器的小秘密。';
    $('#result').innerHTML = `<div class="result-emblem">${icon('fish')}</div><p class="eyebrow">A LITTLE FEAST, A HUNDRED CHOICES</p><h2>小猫今天收获了 <strong>${wins}</strong> 条小鱼干。</h2><p>现在，揭晓三台水果机的小秘密。</p>
      <div class="benchmark-comparison"><div class="comparison-player"><span>你和小猫</span><div><strong>${wins}</strong><small>条</small></div><span>本局 100 枚硬币的收获</span></div><div class="comparison-ucb"><span>UCB 平均表现</span><div><strong>${benchmark.mean.toFixed(1)}</strong><small>条</small></div><span>${benchmark.games.toLocaleString('zh-CN')} 局独立模拟均值</span></div></div><p class="comparison-difference">这一局，${comparison}。</p>
      <div class="reveals">${state.probabilities.map((probability, arm) => `<article class="reveal-card ${arm === best ? 'best' : ''}"><h3>${letters[arm]} 号水果机${arm === best ? '<span>本局最高</span>' : ''}</h3><strong>${Math.round(probability * 100)}%</strong> <small>真实中奖率</small><p>投了 ${state.stats[arm].count} 枚 · 收获 ${state.stats[arm].wins} 条</p><p>历史中奖率 ${state.stats[arm].count ? Math.round(100 * state.stats[arm].wins / state.stats[arm].count) + '%' : '—'}</p><div class="allocation"><i style="width:${state.stats[arm].count}%"></i></div></article>`).join('')}</div>
      <p class="choice-note">你最常选择 ${most} 号机；本局真正最容易中奖的是 ${letters[best]} 号机。</p>
      <details class="result-details"><summary>回看这 100 次选择</summary><p>从左到右按时间排列，金色表示中奖。</p><div class="round-timeline">${state.history.map(event => `<span class="${event.win ? 'win' : ''}" title="第 ${event.turn} 次：${letters[event.arm]}，${event.win ? '中奖' : '未中'}" aria-label="第 ${event.turn} 次，${letters[event.arm]}号机，${event.win ? '中奖' : '未中'}">${letters[event.arm]}</span>`).join('')}</div></details>
      <details class="result-details"><summary>小猫背后的「探索与利用」</summary><p class="explanation">试试别的机器，是「探索」；继续选择看好的机器，是「利用」。每次开奖彼此独立，连中或连败不会改变真实中奖率。60% 的机器也会输，40% 的机器也能连中；短期的观察，不一定就是真相。</p><p class="benchmark-note">UCB 使用同样的 40% / 50% / 60% 概率、随机机器位置和 100 枚预算。它会根据已经看到的结果决定下一枚投给谁。探索系数 c = ${benchmark.c.toFixed(2)}，由另组模拟调参。这里展示的是 ${benchmark.games.toLocaleString('zh-CN')} 局独立模拟的均值；单局表现会波动。<a href="${benchmark.source}" target="_blank" rel="noopener noreferrer">算法参考 ↗</a></p></details>
      <div class="result-buttons"><button class="primary" id="play-again">打乱机器，再陪小猫玩一局 ${icon('arrow')}</button></div>`;
    $('#result').hidden = false;
    $('#result').focus({preventScroll: true});
    $('#result').scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});
    $('#play-again').addEventListener('click', () => {
      start();
      $('.game').scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth'});
      $('.play-button').focus({preventScroll: true});
    });
  }

  function closeGame(event) {
    if (window.parent === window) return;
    event?.preventDefault();
    window.parent.postMessage({type: 'homepage:close'}, location.origin);
  }

  $('#machines').addEventListener('click', event => {
    const button = event.target.closest('[data-play]');
    if (button && !button.disabled) play(Number(button.dataset.play), Number(button.dataset.count || 1));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!dialogOpen()) closeGame(event);
      return;
    }
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || dialogOpen() || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (['1', '2', '3'].includes(event.key)) { event.preventDefault(); play(Number(event.key) - 1); }
  });
  $('#sound').addEventListener('click', async () => {
    sound = !sound;
    if (sound) try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      await audio.resume();
    } catch {
      sound = false;
      $('#status').textContent = '当前浏览器无法播放音效，小猫照样可以玩。';
    }
    $('#sound').setAttribute('aria-pressed', String(sound));
    $('#sound').querySelector('span').textContent = sound ? '音效开' : '音效关';
    if (sound) tone(660, .1);
  });
  $('#help').addEventListener('click', () => $('#help-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  $('#restart').addEventListener('click', () => {
    if (!state.history.length || state.history.length === 100) start();
    else { $('#restart-dialog').showModal(); $('#cancel-restart').focus(); }
  });
  $('#cancel-restart').addEventListener('click', () => $('#restart-dialog').close());
  $('#confirm-restart').addEventListener('click', () => { $('#restart-dialog').close(); start(); $('.play-button').focus(); });
  $('#back').addEventListener('click', closeGame);
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'homepage:pause') return;
    paused = true;
    generation++;
    renderers.forEach(renderer => renderer?.destroy());
    audio?.suspend().catch(() => {});
    lock();
  });
  window.addEventListener('pagehide', () => {
    paused = true;
    generation++;
    busy = false;
    renderers.forEach(renderer => renderer?.destroy());
    renderers = [];
    audio?.suspend().catch(() => {});
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    paused = false;
    busy = false;
    if (sharedArt) mountArt();
    letters.forEach((_, arm) => {
      const element = machine(arm);
      const latest = state.history.filter(item => item.arm === arm).at(-1);
      element.classList.remove('playing', 'batch-running', 'won', 'miss');
      element.querySelector('.batch-button').innerHTML = '<b>×5</b><span>连续投</span>';
      element.querySelectorAll('.reward-badge,.spark').forEach(node => node.remove());
      if (latest) {
        if (!renderers[arm]) showFallback(arm, latest.reels);
        element.classList.add(latest.win ? 'won' : 'miss');
        element.querySelector('.machine-status').textContent = latest.win ? '上一枚收获了小鱼干。' : '上一枚未中，下一枚投哪里？';
        element.querySelector('[data-outcome]').textContent = `${latest.reels.map(fruit => fruitNames[fruit]).join('、')}。${latest.win ? '中奖，小鱼干加1。' : '本次未中奖。'}`;
      }
      renderStats(arm);
    });
    $('#coins').textContent = 100 - state.history.length;
    $('#progress').style.width = `${100 - state.history.length}%`;
    $('#win-count').textContent = state.wins;
    $('#status').textContent = '欢迎回来，小猫还在等你的下一枚硬币。';
    lock();
    if (state.history.length === 100) finish();
  });

  start();
  Promise.resolve().then(() => window.CatSlotRenderer.create()).then(art => {
    sharedArt = art;
    ready = true;
    if (paused) return;
    mountArt();
    $('#status').textContent = '选一台，帮小猫赢下第一条小鱼干。';
    lock();
  }).catch(error => {
    console.error('Cat artwork loading failed:', error);
    ready = true;
    if (paused) return;
    $('#status').textContent = '动画暂时没加载好，可以继续投币，或刷新后再试。';
    lock();
  });
})();
