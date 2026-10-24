import { GameEngine } from './game-engine.js';

export function createGameUI({session,setPaused,resetNight}) {
  const $=id=>document.getElementById(id);
  const chart=$('backlog-chart'),ctx=chart.getContext('2d');
  let finishedShown=false,helpWasRunning=false;
  function reset(){finishedShown=false;if($('result-dialog').open)$('result-dialog').close();update();}
  function showResults(){
    const s=session.state;if(!s.finished)return;
    const compare=session.comparisons();$('r-served').textContent=s.served;$('r-cat').textContent=s.q.cat.length;$('r-dog').textContent=s.q.dog.length;
    const rows=[{label:'你的熊猫小摊',n:s.q.cat.length+s.q.dog.length,kind:'mine'},{label:'MaxWeight',n:compare.MW.backlog,kind:'mw'},{label:'LyapOpt',n:compare.Lyap.backlog,kind:'lyap'}];
    const max=Math.max(1,...rows.map(r=>r.n));$('compare-bars').innerHTML=rows.map(r=>`<div class="compare-row ${r.kind}"><span>${r.label}</span><div class="compare-track"><i style="width:${r.n/max*100}%"></i></div><b>${r.n} 位</b></div>`).join('');
    if(!$('result-dialog').open)$('result-dialog').showModal();
  }
  function update(){
    const s=session.state,t=s.time,left=Math.max(0,Math.ceil(GameEngine.T-t));
    $('cat-count').innerHTML=`${s.q.cat.length} <small>位</small>`;$('dog-count').innerHTML=`${s.q.dog.length} <small>位</small>`;
    $('served-count').textContent=s.served;
    $('game-clock').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');$('game-clock').classList.toggle('urgent',left<=10);
    $('play-button').disabled=false;
    $('play-label').textContent=s.finished?'查看结算':!s.started?'开摊营业':session.paused?'继续营业':'暂停';
    $('play-button').querySelector('use').setAttribute('href',s.started&&!s.finished&&!session.paused?'#i-pause':'#i-play');
    $('play-button').setAttribute('aria-label',$('play-label').textContent);
    $('live-dot').classList.toggle('paused',session.paused||!s.started||s.finished);
    $('cooking-label').textContent=s.finished?'今夜已收摊':s.started?'本锅：'+GameEngine.modes[s.current].name:'每锅 2.5 秒';
    const progress=s.finished?100:s.started?(t-s.round*GameEngine.DT)/GameEngine.DT*100:0;
    $('cooking-progress').style.width=progress+'%';$('cooking-progress').parentElement.setAttribute('aria-valuenow',String(Math.round(progress)));
    document.querySelectorAll('[data-mode]').forEach(b=>{const chosen=b.dataset.mode===s.selected;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));b.disabled=s.finished;});
    $('scene-canvas').dataset.gameTime=t.toFixed(2);
    $('scene-canvas').setAttribute('aria-label',`熊猫夜宵摊，剩余 ${left} 秒，等待小猫 ${s.q.cat.length} 位、柯基 ${s.q.dog.length} 位，已出餐 ${s.served} 份。左上猫队，左下柯基队，右侧熊猫小摊。`);
    drawChart();
    if(s.finished&&!finishedShown){finishedShown=true;showResults();}
  }
  function drawChart(){
    const s=session.state,t=s.time,r=chart.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=r.width,h=r.height;if(w<10)return;
    if(chart.width!==Math.round(w*dpr)||chart.height!==Math.round(h*dpr)){chart.width=Math.round(w*dpr);chart.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const l=28,right=14,top=9,bottom=24,pw=w-l-right,ph=h-top-bottom;
    let max=8;for(const p of s.history)max=Math.max(max,p.cat+p.dog);max=Math.ceil((max+1)/4)*4;
    const x=n=>l+n/60*pw,y=n=>top+ph-n/max*ph;
    ctx.font='10px system-ui';ctx.textBaseline='middle';ctx.textAlign='right';ctx.lineWidth=.6;
    for(let i=0;i<=4;i++){ctx.strokeStyle='#a4bd9c24';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(l,y(max*i/4));ctx.lineTo(w-right,y(max*i/4));ctx.stroke();ctx.fillStyle='#8ca69a';ctx.fillText(max*i/4,l-9,y(max*i/4));}
    ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='top';for(let sec=0;sec<=60;sec+=15)ctx.fillText(sec+'s',x(sec),h-16);
    const trace=f=>{ctx.beginPath();ctx.moveTo(x(0),y(f(s.history[0])));for(let i=1;i<s.history.length;i++){const p=s.history[i],prev=s.history[i-1];ctx.lineTo(x(p.t),y(f(prev)));ctx.lineTo(x(p.t),y(f(p)));}ctx.lineTo(x(t),y(f(s.history.at(-1))));};
    trace(p=>p.cat+p.dog);ctx.lineTo(x(t),y(0));ctx.lineTo(l,y(0));ctx.closePath();ctx.fillStyle='#e9c9850a';ctx.fill();
    for(const [f,color,width] of [[p=>p.cat,'#f1a875',1.6],[p=>p.dog,'#9ccfb5',1.6],[p=>p.cat+p.dog,'#efcf89',2.2]]){trace(f);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();if(t>0){ctx.beginPath();ctx.arc(x(t),y(f(s.history.at(-1))),2.3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}}
    chart.setAttribute('aria-label',`营业 ${Math.floor(t)} 秒，小猫积压 ${s.q.cat.length} 位，柯基积压 ${s.q.dog.length} 位，总积压 ${s.q.cat.length+s.q.dog.length} 位。`);
  }
  $('help-button').onclick=()=>{helpWasRunning=session.running;if(helpWasRunning)setPaused(true);$('help-dialog').showModal();};
  $('close-help').onclick=$('got-it').onclick=()=>$('help-dialog').close();
  $('help-dialog').addEventListener('close',()=>{if(helpWasRunning){helpWasRunning=false;setPaused(false);}});
  $('retry').onclick=()=>resetNight(false);$('new-night').onclick=()=>resetNight(true);$('review').onclick=()=>$('result-dialog').close();
  new ResizeObserver(drawChart).observe(chart);
  return {update,reset,showResults};
}
