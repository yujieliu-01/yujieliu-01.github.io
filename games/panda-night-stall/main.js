import { GameSession } from './game-session.js';
import { createGameUI } from './game-ui.js';
import { createVendor } from './vendor.js';

const $ = id => document.getElementById(id);
const canvas = $('scene-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const shell = $('scene-shell');
const W = 1800, H = 1000, TAU = Math.PI * 2;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const art = {};
const stall = { x: 1100, y: 200, width: 670 };
let vendor, model, ready = false, time = 0, previous = 0, uiClock = 0;
let serveCat = 0, serveDog = 0, bubbleTimer = 0, paused = false;
let baseScale = 1, offsetX = 0, offsetY = 0;
let session, gameUI;
let particles = [], deliveries = [], cheers = new Map(), hoverActor = null;
const pointer = { down: false, moved: false, startX: 0, startY: 0 };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fireflies = Array.from({ length: 14 }, (_, i) => ({
  x: 70 + ((i * 317) % 1650), y: 170 + ((i * 137) % 600), phase: i * 2.31,
}));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片未能加载：${url}`));
    img.src = url;
  });
}

function makeModel() {
  session = new GameSession({ aspects: { cat: art.cat.width / art.cat.height, corgi: art.corgi.width / art.corgi.height } });
  return session.scene;
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  baseScale = Math.min(canvas.width / W, canvas.height / H);
  offsetX = (canvas.width - W * baseScale) / 2;
  offsetY = (canvas.height - H * baseScale) / 2;
  if (ready) render();
}

function worldPoint(event) {
  const r = canvas.getBoundingClientRect();
  const px = (event.clientX - r.left) * canvas.width / r.width;
  const py = (event.clientY - r.top) * canvas.height / r.height;
  return { x: (px - offsetX) / baseScale, y: (py - offsetY) / baseScale };
}

function showBubble(message, seconds = 2.8) {
  $('stall-bubble').textContent = message;
  $('stall-bubble').classList.add('show');
  bubbleTimer = seconds;
}

function setPaused(value) {
  if (!ready) return;
  paused = Boolean(value); session.setPaused(paused);
  shell.dataset.paused=String(paused);
  $('paused-overlay').hidden=!paused;
  updateUI();
}

function resetNight(newTraffic) {
  session.reset(newTraffic); model=session.scene;
  particles=[];deliveries=[];cheers.clear();serveCat=0;serveDog=0;time=0;previous=0;
  paused=false;shell.dataset.paused='false';$('paused-overlay').hidden=true;
  $('stall-bubble').classList.remove('show');bubbleTimer=0;
  gameUI.reset();updateUI();
}

function toggleGame() {
  if (!ready) return;
  if (session.state.finished) { gameUI.showResults(); return; }
  if (!session.state.started) {session.start();showBubble('灯亮了，开摊啦。');updateUI();return;}
  setPaused(!paused);
}

function updateUI() {
  if (!gameUI) return;
  gameUI.update();
  const v=model.getState();
  canvas.dataset.waiting=String(v.total);canvas.dataset.rendered=String(v.actorCount);
  canvas.dataset.queueCats=String(v.catCount);canvas.dataset.queueDogs=String(v.dogCount);
  canvas.dataset.delivering=String(v.outgoingCount);canvas.dataset.paused=String(paused);
}

function handleGameEvent(event) {
  if (event.kind==='batch' && event.served) {
    if (bubbleTimer<.4) showBubble('这一锅好了，慢慢来取。',1.6);
  }
}

function addHearts(actor, count = 3) {
  for (let i = 0; i < count; i++) {
    particles.push({ x: actor.x + (i - (count - 1) / 2) * actor.size * .16,
      y: actor.y - actor.size * .9, vx: (i - 1) * 12, vy: -25 - i * 9,
      life: 1.2 + i * .15, total: 1.2 + i * .15, size: clamp(actor.size * .07, 5, 12),
      color: actor.species === 'cat' ? '#eb7562' : '#f3b24e', phase: i * 2 });
  }
}

function handleEvents() {
  for (const event of model.drainEvents()) {
    if (event.type !== 'serve') continue;
    const actor = model.getActors().find(a => a.id === event.id);
    if (!actor) continue;
    const isCat = event.species === 'cat';
    if (isCat) serveCat = 1; else serveDog = 1;
    const anchors = vendor.getAnchors({ ...stall, time, serveCat, serveDog });
    const from = anchors[isCat ? 'fish' : 'soup'];
    deliveries.push({ species: event.species, actorId: actor.id, from: { ...from },
      to: { x: actor.x + actor.size * .24, y: actor.y - actor.size * .49 }, t: 0, duration: .5 });
    addHearts(actor, 3);
    if (bubbleTimer < .5) showBubble(isCat ? '鱼肉满满，慢慢吃。' : '热汤一碗，暖到尾巴尖。', 1.8);
  }
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawHeart(x, y, size, color, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 12, size / 12); ctx.globalAlpha = alpha;
  ctx.fillStyle = color; ctx.strokeStyle = '#8a493640'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-20, -5, -7, -17, 0, -7);
  ctx.bezierCurveTo(7, -17, 20, -5, 0, 7);
  ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawFish(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#ffe7b1'; ctx.strokeStyle = '#8a5139'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(-2, 0, 11, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(17, -6); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#583b2a'; ctx.beginPath(); ctx.arc(-7, -1, 1.3, 0, TAU); ctx.fill(); ctx.restore();
}

function drawFood(species, x, y, size, rotation) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size / 44, size / 44);
  ctx.shadowColor = '#ffe9a8'; ctx.shadowBlur = 10;
  if (species === 'cat') {
    ctx.fillStyle = '#df6d4c'; ctx.strokeStyle = '#70442e'; ctx.lineWidth = 2;
    roundedRect(-19, -14, 38, 28, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffddb1'; ctx.beginPath(); ctx.ellipse(0, -13, 19, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    drawFish(0, 1, .75);
  } else {
    ctx.fillStyle = '#96cfbd'; ctx.strokeStyle = '#49736b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-22, -9); ctx.quadraticCurveTo(-19, 18, 0, 18); ctx.quadraticCurveTo(19, 18, 22, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4bf68'; ctx.beginPath(); ctx.ellipse(0, -8, 22, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff3ce'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(7, -10); ctx.stroke();
    for (const [a, b] of [[-8,-10],[-7,-6],[8,-12],[9,-8]]) { ctx.beginPath(); ctx.arc(a,b,3,0,TAU); ctx.fillStyle='#fff3ce'; ctx.fill(); }
  }
  ctx.restore();
}

function drawQueuePaths() {
  const layouts = model.getLayout();
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const species of ['cat', 'corgi']) {
    const layout = layouts[species];
    if (layout.rows < 2) continue;
    ctx.strokeStyle = species === 'cat' ? '#b7763829' : '#60837329';
    // Ground marks share the same depth as the customers above them.
    for (let i = 1; i < layout.slots.length; i++) {
      const a = layout.slots[i - 1], b = layout.slots[i];
      const depthSize = Math.min(a.size, b.size);
      ctx.lineWidth = clamp(depthSize * .035, 1.2, 4.5);
      ctx.setLineDash([1.4, Math.max(5, depthSize * .18)]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y + 2); ctx.lineTo(b.x, b.y + 2); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawActor(actor) {
  const isCat = actor.species === 'cat';
  const isFed = actor._served && !deliveries.some(d => d.actorId === actor.id);
  const img = isFed && art[`${actor.species}Fed`] ? art[`${actor.species}Fed`] : art[actor.species];
  const w = actor.size * img.width / img.height, h = actor.size;
  const hello = cheers.get(actor.id) || 0;
  const hop = hello > 0 ? Math.sin(clamp(hello / .65, 0, 1) * Math.PI) * h * .085 : 0;
  const bob = reducedMotion ? 0 : actor.bob || 0;
  ctx.save(); ctx.globalAlpha = actor.alpha ?? 1;
  ctx.fillStyle = '#65452535'; ctx.beginPath();
  ctx.ellipse(actor.x, actor.y - 2, w * .31, h * .048, 0, 0, TAU); ctx.fill();
  ctx.translate(actor.x, actor.y + Math.min(bob, 1) - hop - Math.max(0, bob));
  const breathing = reducedMotion || actor.moving ? 0 : Math.sin(time * 1.8 + actor.idlePhase) * .007;
  ctx.scale(actor.face, 1 + breathing);
  if (actor.moving && !reducedMotion) ctx.rotate(Math.sin(actor.walkPhase) * .018);
  ctx.drawImage(img, -w / 2, -h, w, h);
  // A tiny warm reflection ties the illustrated characters into the lantern-lit floor.
  if (isFed && !art[`${actor.species}Fed`]) {
    if (isCat) {
      ctx.fillStyle = '#e7a263'; ctx.strokeStyle = '#744a34'; ctx.lineWidth = Math.max(.8, h * .006);
      ctx.beginPath(); ctx.ellipse(w * .31, -h * .465, w * .125, h * .019, 0, 0, TAU); ctx.fill();
      drawFish(w * .31, -h * .47, h / 560);
    } else {
      ctx.fillStyle = '#edbd68'; ctx.beginPath(); ctx.ellipse(w * .32, -h * .455, w * .135, h * .032, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff4d3'; ctx.lineWidth = h * .017; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*.27,-h*.46); ctx.lineTo(w*.38,-h*.47); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawAtmosphere() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const [x,y,r,phase] of [[1120,260,230,0],[1440,370,280,2],[360,190,120,4]]) {
    const glow = ctx.createRadialGradient(x,y,0,x,y,r);
    glow.addColorStop(0,`rgba(255,184,61,${.028 + Math.sin(time * 1.4 + phase) * .006})`);
    glow.addColorStop(1,'rgba(255,184,61,0)'); ctx.fillStyle=glow;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for (const f of fireflies) {
    const x = f.x + Math.sin(time*.3+f.phase)*16;
    const y = f.y + Math.cos(time*.36+f.phase)*11;
    const alpha = Math.pow(Math.max(0,Math.sin(time*.7+f.phase)),3)*.42;
    ctx.globalAlpha=alpha; ctx.fillStyle='#ffefaa'; ctx.shadowColor='#ffcf6c'; ctx.shadowBlur=9;
    ctx.beginPath(); ctx.arc(x,y,2.1,0,TAU); ctx.fill();
  }
  ctx.restore();
}

function render() {
  if (!ready) return;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#132e30'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(baseScale,0,0,baseScale,offsetX,offsetY);
  ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();
  ctx.drawImage(art.background,0,0,W,H);
  drawQueuePaths();
  vendor.draw(ctx,{...stall,time:reducedMotion?0:time,serveCat,serveDog});
  const actors = model.getActors().sort((a,b)=>a.y-b.y || a.x-b.x);
  for (const actor of actors) drawActor(actor);
  for (const delivery of deliveries) {
    const p = clamp(delivery.t / delivery.duration,0,1), t = ease(p);
    const actor = actors.find(a=>a.id===delivery.actorId);
    const target = actor ? {x:actor.x+actor.size*.24,y:actor.y-actor.size*.49} : delivery.to;
    const x = delivery.from.x+(target.x-delivery.from.x)*t;
    const y = delivery.from.y+(target.y-delivery.from.y)*t - Math.sin(Math.PI*t)*62;
    const size = (actor ? clamp(actor.size*.24,24,43) : 36)*(1-.18*p);
    ctx.save(); ctx.globalAlpha=1-Math.pow(p,6); drawFood(delivery.species,x,y,size,Math.sin(p*Math.PI)*-.15); ctx.restore();
  }
  for (const p of particles) drawHeart(p.x+Math.sin(time*3+p.phase)*3,p.y,p.size,p.color,Math.min(1,p.life/.4));
  drawAtmosphere();
  ctx.restore();
}

function frame(now) {
  const raw = previous ? (now-previous)/1000 : 0;
  previous = now;
  const dt = document.hidden ? 0 : Math.min(raw,.05);
  if (ready) {
    if (!paused) {
      // Keep exact gameplay time, but never fast-forward a late visual frame.
      const step= Math.min(raw, 10);
      session.advance(step,handleGameEvent,dt);
      time+=dt; handleEvents();
      serveCat=Math.max(0,serveCat-dt*1.45); serveDog=Math.max(0,serveDog-dt*1.25);
      bubbleTimer=Math.max(0,bubbleTimer-dt);
      if (!bubbleTimer) $('stall-bubble').classList.remove('show');
      deliveries=deliveries.filter(d=>(d.t+=dt)<d.duration);
      particles=particles.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;return p.life>0;});
      for (const [id, remaining] of cheers) { if (remaining<=dt) cheers.delete(id); else cheers.set(id,remaining-dt); }
    }
    uiClock+=dt; if(uiClock>.08){updateUI();uiClock=0;}
    render();
  }
  requestAnimationFrame(frame);
}

function hitTest(point) {
  return model.getActors().sort((a,b)=>b.y-a.y).find(a=>{
    const w=a.size*a.aspect;
    return a.alpha>.2 && point.x>a.x-w*.42 && point.x<a.x+w*.42 && point.y>a.y-a.size*.96 && point.y<a.y;
  });
}

function bindControls() {
  $('play-button').addEventListener('click',toggleGame);
  $('resume-button').addEventListener('click',()=>setPaused(false));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{session.choose(b.dataset.mode);updateUI();}));
  $('fullscreen-button').addEventListener('click',async()=>{
    try {if(document.fullscreenElement) await document.exitFullscreen();else await shell.requestFullscreen();}
    catch {showBubble('横过手机，也能看得更开。');}
  });
  document.addEventListener('fullscreenchange',resize);
  document.addEventListener('keydown',event=>{
    if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]')||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    if(['1','2','3'].includes(event.key)){event.preventDefault();session.choose(['cat','mix','dog'][Number(event.key)-1]);updateUI();}
    if(event.code==='Space'){event.preventDefault();toggleGame();}
  });
  canvas.addEventListener('pointerdown',event=>{
    pointer.down=true;pointer.moved=false;pointer.startX=event.clientX;pointer.startY=event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(pointer.down){
      if(Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)>5)pointer.moved=true;
    }else{
      hoverActor=hitTest(worldPoint(event));
      canvas.style.cursor=hoverActor?'pointer':'default';
    }
  });
  canvas.addEventListener('pointerup',event=>{
    const clicked=pointer.down&&!pointer.moved;pointer.down=false;
    if(clicked){const actor=hitTest(worldPoint(event));if(actor){
      if(paused)return;cheers.set(actor.id,.65);addHearts(actor,2);
      showBubble(actor.species==='cat'?'喵，今天要鱼肉满满的！':'汪，想要一大碗热汤！',2);
    }}
  });
  canvas.addEventListener('pointercancel',()=>{pointer.down=false;});
  new ResizeObserver(resize).observe(shell);
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='homepage:pause'&&session.running)setPaused(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&session.running)setPaused(true);previous=0;});
}

async function boot() {
  try {
    const [background,cat,corgi,v] = await Promise.all([
      loadImage('./assets/background-night.webp'),loadImage('./assets/cat-wait.webp'),
      loadImage('./assets/corgi-wait.webp'),createVendor({loadImage}),
    ]);
    Object.assign(art,{background,cat,corgi});vendor=v;model=makeModel();ready=true;
    gameUI=createGameUI({session,setPaused,resetNight});
    bindControls();resize();setPaused(false);updateUI();
    $('loader').classList.add('hidden');$('loader').setAttribute('aria-hidden','true');showBubble('慢慢来，都有份。',3.5);
    // Optional alternate food states preserve identical outlines and anchors.
    Promise.allSettled([loadImage('./assets/cat-fed.webp'),loadImage('./assets/corgi-fed.webp')]).then(states=>{
      if(states[0].status==='fulfilled')art.catFed=states[0].value;
      if(states[1].status==='fulfilled')art.corgiFed=states[1].value;
    });
    requestAnimationFrame(frame);
  } catch(error) {
    console.error(error);
    $('loader').querySelector('p').textContent='灯笼还在路上，请刷新再试一次。';
    $('loader').classList.add('load-error');
  }
}

boot();
