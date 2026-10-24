/* Slot-machine effects for the approved 1254px illustration, reward pickup v3.
 * Browser: SlotCatEffects. Node: require('./effects-v3.js').
 * Inputs: the calibrated transparent fruit canvases, plus pose.t in [0,8.9).
 * Optional pose.roundIndex / pose.roundTime override the derived round.
 * The functions draw in ORIGINAL IMAGE PIXELS; scale the context outside.
 */
(function (root) {
  'use strict';
  const C = {
    size: 1254,
    roundDurations: [3.6,5.3],
    roundStarts: [0,3.6],
    duration: 8.9,
    spinStart: 0.9,
    stopTimes: [2.95, 3.12, 3.30],
    results: [[0, 1, 2], [0, 0, 0]],
    prizeStart: 3.38,
    prizeFlight: 0.34,
    prizePickup: 3.98,
    mouthArrival: 4.40,
    biteTimes: [4.55,4.82],
    prizeSource: [766, 941],
    prizeLanding: [775, 957]
  };
  const centers = [[692,445], [814,469], [924,488]];
  const reelWindows = [
    [[669,355],[747,364],[724,536],[681,530],[672,508],[658,471],[642,445]],
    [[778,361],[866,372],[871,379],[869,390],[841,551],[837,559],[826,559],[749,549],[742,543],[738,531],[738,516],[742,477],[749,426],[759,382],[766,367]],
    [[889,378],[980,389],[984,396],[982,410],[956,563],[951,573],[943,574],[865,564],[858,558],[854,546],[853,532],[855,509],[860,472],[867,434],[875,400],[881,386]]
  ];
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const mod = (x,n) => ((x%n)+n)%n;
  const mix = (a,b,u) => a+(b-a)*u;
  const smooth = u => { u=clamp(u,0,1); return u*u*(3-2*u); };

  function state(pose) {
    pose=pose||{};
    let loopTime=mod(Number.isFinite(pose.t)?pose.t:(Number.isFinite(pose.loopTime)?pose.loopTime:0),C.duration);
    // Keep the explicit round intact. Modulo on 3.6 + 0 can round down to
    // 3.5999999999999996 and briefly reveal the NEXT result before the spin.
    const explicit=Number.isFinite(pose.roundTime)&&Number.isFinite(pose.roundIndex);
    const roundIndex=explicit?mod(Math.floor(pose.roundIndex),2):(loopTime<C.roundStarts[1]?0:1);
    const roundTime=explicit?pose.roundTime:loopTime-C.roundStarts[roundIndex];
    if(explicit)loopTime=C.roundStarts[roundIndex]+roundTime;
    return {loopTime,roundIndex,roundTime,
      roundDuration:C.roundDurations[roundIndex],
      previous:pose.previousReels || C.results[1-roundIndex],
      result:pose.eventReels || C.results[roundIndex], staticReels:!!pose.staticReels};
  }

  // An accelerating start, a visibly moving middle, and a short clean stop.
  // Integrating this velocity profile gives exactly the selected strip length.
  function reelTravel(elapsed,duration,distance) {
    const t=clamp(elapsed,0,duration),a=0.12,d=0.58,c=duration-a-d;
    const area=duration-(a+d)/2;
    let swept;
    if(t<a) swept=t*t/(2*a);
    else if(t<a+c) swept=a/2+t-a;
    else { const q=t-a-c; swept=a/2+c+q-q*q/(2*d); }
    return distance*clamp(swept/area,0,1);
  }

  function drawReels(ctx,fruits,pose) {
    const s=state(pose),h=158,scale=0.96;
    for(let j=0;j<3;j++) {
      // k=0 shows the previous result. Integer end travel selects the new one.
      const delta=mod(s.result[j]-s.previous[j],3);
      const symbols=12+3*j+delta;
      const elapsed=s.roundTime-C.spinStart;
      const travel=s.staticReels ? 0 : reelTravel(elapsed,C.stopTimes[j]-C.spinStart,symbols*h);
      const points=reelWindows[j];
      ctx.save();ctx.beginPath();ctx.moveTo(...points[0]);
      for(let k=1;k<points.length;k++)ctx.lineTo(...points[k]);
      ctx.closePath();ctx.clip();
      const g=ctx.createLinearGradient(0,345,0,570);
      g.addColorStop(0,'#f1d9b8');g.addColorStop(0.23,'#fff8e7');
      g.addColorStop(0.72,'#fff9ed');g.addColorStop(1,'#e9ccaa');
      ctx.fillStyle=g;ctx.fillRect(610,345,400,240);
      const n=Math.floor(travel/h);
      for(let k=n-2;k<=n+2;k++) {
        const shift=travel-k*h,f=fruits[mod((s.staticReels?s.result[j]:s.previous[j])+k,3)];
        ctx.drawImage(f,centers[j][0]-shift*0.135-f.width*scale/2,
          centers[j][1]+shift-f.height*scale/2,f.width*scale,f.height*scale);
      }
      ctx.restore();
    }
    return s;
  }

  // A small intact dried fish: amber skin, tail, eye, gill and drying marks.
  // It is drawn natively so the prize has no external image dependency.
  function fish(ctx) {
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.strokeStyle='#4a2b20';ctx.lineWidth=6;
    ctx.fillStyle='#b87b3d';ctx.beginPath();
    ctx.moveTo(-32,-2);ctx.lineTo(-58,-18);ctx.lineTo(-53,2);
    ctx.lineTo(-60,20);ctx.lineTo(-31,8);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#bf8241';ctx.beginPath();ctx.moveTo(-13,-14);
    ctx.lineTo(-6,-27);ctx.lineTo(13,-18);ctx.closePath();ctx.fill();ctx.stroke();
    const g=ctx.createLinearGradient(0,-20,0,19);
    g.addColorStop(0,'#e8b766');g.addColorStop(0.45,'#d49b50');g.addColorStop(1,'#ba7b3c');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(41,-2);
    ctx.bezierCurveTo(35,-19,12,-23,-8,-20);
    ctx.bezierCurveTo(-24,-18,-35,-10,-39,1);
    ctx.bezierCurveTo(-28,15,-16,20,4,19);
    ctx.bezierCurveTo(24,19,38,10,41,-2);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#f2cf88';ctx.lineWidth=3.4;ctx.beginPath();
    ctx.moveTo(-25,8);ctx.quadraticCurveTo(0,15,28,7);ctx.stroke();
    ctx.strokeStyle='#986032';ctx.lineWidth=3.1;
    for(const x of [-23,-10,3]) {ctx.beginPath();ctx.moveTo(x-2,-10);ctx.lineTo(x+6,5);ctx.stroke();}
    ctx.strokeStyle='#76462b';ctx.lineWidth=3.3;ctx.beginPath();
    ctx.moveTo(17,-12);ctx.quadraticCurveTo(9,0,17,12);ctx.stroke();
    ctx.fillStyle='#f3d38e';ctx.beginPath();ctx.arc(28,-4,5.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#4a2b20';ctx.beginPath();ctx.arc(28,-4,2.8,0,Math.PI*2);ctx.fill();
  }

  function prizeState(pose) {
    pose=pose||{};
    const s=state(pose),age=s.roundTime-C.prizeStart;
    if(pose.staticReels||s.roundIndex!==1||age<0)return {visible:false,held:false,age,alpha:0};
    const biteAmount=clamp(Number.isFinite(pose.biteAmount)?pose.biteAmount:0,0,1);
    if(biteAmount>=0.999)return {visible:false,held:!!pose.fishHeld,inMouth:!!pose.fishInMouth,age,alpha:0,biteAmount};
    if(pose.fishHeld||pose.fishInMouth) {
      // Pickup and carrying are fully owned by the pose rig. No independent
      // tween is allowed here: the exact same attachment is used every frame.
      const q=pose.fishPosition;
      if(!Array.isArray(q)||!Number.isFinite(q[0])||!Number.isFinite(q[1]))
        return {visible:false,held:!!pose.fishHeld,inMouth:!!pose.fishInMouth,age,alpha:0,reason:'missing-fish-attachment'};
      return {visible:true,held:!!pose.fishHeld,inMouth:!!pose.fishInMouth,age,alpha:1,x:q[0],y:q[1],
        angle:Number.isFinite(pose.fishAngle)?pose.fishAngle:0.16,
        scale:Number.isFinite(pose.fishScale)?pose.fishScale:0.90,
        biteAmount,biteSide:pose.fishBiteSide==='right'?'right':'left'};
    }
    // After the pickup time a pose is required; never leave a duplicate fish
    // on the tray while the real one is carried, eaten or the paw is returning.
    if(s.roundTime>=C.prizePickup)return {visible:false,held:false,age,alpha:0,biteAmount};
    const u=clamp(age/C.prizeFlight,0,1);
    const x=mix(C.prizeSource[0],C.prizeLanding[0],1-Math.pow(1-u,2));
    let y=mix(C.prizeSource[1]-34,C.prizeLanding[1],u*u);
    if(age>C.prizeFlight&&age<C.prizeFlight+0.09) {
      y-=3*Math.sin((age-C.prizeFlight)/0.09*Math.PI);
    }
    return {visible:true,held:false,age,alpha:1,x,y,
      angle:mix(-0.23,0.16,smooth(u)),scale:0.90,biteAmount:0,biteSide:'left'};
  }

  // The remaining half has a scalloped bite edge. The fish is removed by
  // geometry in two bites, never by opacity or by fading away from the tray.
  function biteClip(ctx,amount,side) {
    if(amount<=0)return;
    const sign=side==='right'?-1:1;
    const cut=mix(-66,47,amount);
    ctx.beginPath();ctx.moveTo(sign*cut,-65);ctx.lineTo(sign*75,-65);
    ctx.lineTo(sign*75,65);ctx.lineTo(sign*cut,65);ctx.lineTo(sign*cut,24);
    for(let y=24;y>-30;y-=12)ctx.quadraticCurveTo(sign*(cut+6),y-6,sign*cut,y-12);
    ctx.lineTo(sign*cut,-65);ctx.closePath();ctx.clip();
  }

  function drawPrize(ctx,pose,layer) {
    const p=prizeState(pose);if(!p.visible||p.alpha<=0)return p;
    layer=layer||'all';
    if(layer==='front'&&!p.held&&!p.inMouth)return p;
    if(layer==='back'&&p.inMouth)return p;
    ctx.save();
    if(!p.inMouth&&layer!=='front') {
      const shadow=p.held?1-clamp((C.prizeLanding[1]-p.y)/70,0,1):smooth((p.age-0.14)/0.20);
      ctx.fillStyle='rgba(64,36,24,'+(0.16*shadow)+')';ctx.beginPath();
      ctx.ellipse(C.prizeLanding[0]-3,C.prizeLanding[1]+12,42,6,0.10,0,Math.PI*2);ctx.fill();
    }
    if(!p.held&&!p.inMouth) {
      if(p.age<C.prizeFlight) {ctx.beginPath();ctx.rect(678,927,218,150);ctx.clip();}
    }
    // Optional two-pass integration: drawPrizeBack before the paw, then
    // drawPrizeFront afterwards. A small palm overlap remains in front.
    if(layer==='front'&&p.held&&!p.inMouth&&pose&&Array.isArray(pose.palm)) {
      const a=Number.isFinite(pose.handAngle)?pose.handAngle:0;
      const grip=Array.isArray(pose.fishGripPosition)?pose.fishGripPosition:
        [pose.palm[0]+32*Math.cos(a)-20*Math.sin(a),pose.palm[1]+32*Math.sin(a)+20*Math.cos(a)];
      ctx.beginPath();ctx.rect(-1500,-1500,4500,4500);
      ctx.ellipse(grip[0],grip[1],12,10,a,0,Math.PI*2);ctx.clip('evenodd');
    }
    ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.scale(p.scale,p.scale);
    biteClip(ctx,p.biteAmount,p.biteSide);fish(ctx);
    ctx.restore();return p;
  }

  function drawPrizeBack(ctx,pose) {return drawPrize(ctx,pose,'back');}
  function drawPrizeFront(ctx,pose) {return drawPrize(ctx,pose,'front');}

  function drawLamp(ctx,pose) {
    const s=state(pose),age=s.roundTime-C.stopTimes[2];
    if(pose.staticReels||s.roundIndex!==1||age<0||age>=0.68)return 0;
    const envelope=smooth(age/0.06)*(1-smooth((age-0.46)/0.22));
    const strength=envelope*(0.76+0.16*Math.sin(age*Math.PI*7));
    ctx.save();
    const glow=ctx.createRadialGradient(863,209,18,863,209,66);
    glow.addColorStop(0,'rgba(255,231,109,'+(0.45*strength)+')');
    glow.addColorStop(1,'rgba(255,231,109,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(863,209,66,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,205,'+(0.72*strength)+')';
    ctx.beginPath();ctx.ellipse(863,209,29,31,0,0,Math.PI*2);ctx.fill();
    ctx.restore();return strength;
  }

  const api={constants:C,drawReels,drawPrize,drawPrizeBack,drawPrizeFront,drawLamp,state,prizeState};
  root.SlotCatEffects=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
