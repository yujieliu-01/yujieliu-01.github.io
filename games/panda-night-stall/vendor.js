/**
 * Panda vendor rig. All part artwork comes from the approved illustration.
 * Coordinates are expressed in its 1254 × 1254 native art space.
 * Call draw with time in seconds; the caller owns the animation clock.
 */
export const VENDOR_NATIVE_SIZE = 1254;

const PARTS = {
  base: {file:'vendor-base.webp', box:[0,0,1254,1254]},
  lantern: {file:'vendor-lantern.webp', box:[17,211,250,444], pivot:[148,216]},
  knot: {file:'vendor-knot.webp', box:[1023,343,177,385], pivot:[1108,346]},
  catArm: {file:'vendor-cat-arm.webp', box:[298,523,180,176], pivot:[461,650]},
  dogPaw: {file:'vendor-dog-paw.webp', box:[736,665,125,91], pivot:[760,706]},
  ladle: {file:'vendor-ladle.webp', box:[709,603,159,211], pivot:[803,705]},
  leftEye: {file:'vendor-eye-left.webp', box:[510,472,56,62], pivot:[539,503]},
  rightEye: {file:'vendor-eye-right.webp', box:[646,509,62,65], pivot:[677,542]},
};

const clamp = n => Math.max(0,Math.min(1,Number(n)||0));
const ease = n => n*n*(3-2*n);

function blinkAt(time) {
  const cycle=5.8, p=((time%cycle)+cycle)%cycle;
  const centers=Math.floor(time/cycle)%3===1 ? [4.12,4.44] : [4.12];
  let open=1;
  for(const c of centers) {
    const d=Math.abs(p-c)/.13;
    if(d<1) open=Math.min(open,.035+.965*(1-Math.cos(d*Math.PI))*.5);
  }
  return open;
}

function pose(time,cat,dog) {
  cat=ease(clamp(cat));dog=ease(clamp(dog));
  const stir=time*(Math.PI*2/5.2),side=Math.sin(stir),depth=Math.cos(stir);
  const wrist={angle:side*.007,dx:side*1.3,dy:depth*.55};
  return {
    cat:{angle:Math.sin(time*1.35)*.006+cat*.095,dx:-cat*8,dy:-cat*2},
    // The cuff and paw heel stay almost still. The handle hinges behind the
    // fingers; slight foreshortening keeps the scoop on a shallow soup ellipse.
    wrist,
    ladle:{angle:-side*.095,dx:wrist.dx,dy:wrist.dy,
      scaleY:1+depth*.03-side*.046+dog*.025},
    lantern:Math.sin(time*.88+.3)*.022+Math.sin(time*.36)*.008,
    knot:Math.sin(time*1.05+1.8)*.014,
    eyes:blinkAt(time),
  };
}

function movedPoint(point,pivot,p) {
  const a=p.angle||0,dx=point[0]-pivot[0],dy=(point[1]-pivot[1])*(p.scaleY??1);
  return [pivot[0]+dx*Math.cos(a)-dy*Math.sin(a)+(p.dx||0),pivot[1]+dx*Math.sin(a)+dy*Math.cos(a)+(p.dy||0)];
}

function drawPart(ctx,image,part,{angle=0,dx=0,dy=0,scaleY=1}={}) {
  const [x,y,w,h]=part.box, [px,py]=part.pivot||[0,0];
  ctx.save();ctx.translate(px+dx,py+dy);ctx.rotate(angle);ctx.scale(1,scaleY);
  ctx.drawImage(image,x-px,y-py,w,h);ctx.restore();
}

function drawSteam(ctx,time) {
  ctx.save();ctx.lineCap='round';
  const plumes=[{x:873,y:777,offset:0,s:1},{x:904,y:762,offset:.48,s:.83},{x:963,y:694,offset:.7,s:.68}];
  for(const plume of plumes) {
    for(let j=0;j<2;j++) {
      const phase=((time*.24+plume.offset+j*.5)%1+1)%1;
      const alpha=Math.sin(phase*Math.PI)*.33;
      const y=plume.y-phase*135*plume.s;
      const drift=Math.sin(time*.7+phase*3+plume.offset)*8;
      ctx.save();ctx.translate(plume.x+drift,y);ctx.scale(plume.s,plume.s);
      ctx.globalAlpha=alpha;ctx.strokeStyle='#fff0cc';ctx.lineWidth=7.5-phase*2;
      ctx.beginPath();ctx.moveTo(-5,10);
      ctx.bezierCurveTo(-26,-7,24,-22,9,-40);
      ctx.bezierCurveTo(-2,-51,-10,-55,-1,-70);ctx.stroke();ctx.restore();
    }
  }
  ctx.restore();
}

function drawSoupRipples(ctx,time,p) {
  const [x,y]=movedPoint([767,778],PARTS.ladle.pivot,p.ladle);
  ctx.save();
  // Restrict the surface ripples to the painted soup, away from the bowl rim.
  ctx.beginPath();ctx.ellipse(823,793,115,29,0,0,Math.PI*2);ctx.clip();
  ctx.lineWidth=1.8;ctx.strokeStyle='#fff1a0';
  for(let i=0;i<2;i++) {
    const phase=((time/2.6+i*.5)%1+1)%1;
    ctx.globalAlpha=(1-phase)*.23;
    ctx.beginPath();ctx.ellipse(x+6,y+9,29+phase*21,8+phase*8,0,.12,Math.PI*.94);ctx.stroke();
  }
  ctx.restore();
}

function drawBowlForeground(ctx,image) {
  // The painted front lip can occlude the scoop at its nearest point. This
  // redraw contains only the bowl front and never covers the gripping paw.
  ctx.save();ctx.beginPath();ctx.moveTo(691,799);
  ctx.bezierCurveTo(724,840,908,851,952,797);
  ctx.lineTo(965,926);ctx.lineTo(681,926);ctx.closePath();ctx.clip();
  ctx.drawImage(image,0,0,1254,1254);ctx.restore();
}

function drawLanternGlow(ctx,time,p) {
  const point=movedPoint([145,365],PARTS.lantern.pivot,{angle:p.lantern});
  const intensity=.92+Math.sin(time*1.3)*.035+Math.sin(time*2.8)*.018;
  ctx.save();ctx.globalAlpha=intensity;
  const gradient=ctx.createRadialGradient(point[0],point[1],12,point[0],point[1],310);
  gradient.addColorStop(0,'rgba(255,177,70,.19)');
  gradient.addColorStop(.38,'rgba(255,142,51,.085)');
  gradient.addColorStop(1,'rgba(255,142,51,0)');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(point[0],point[1],310,0,Math.PI*2);ctx.fill();ctx.restore();
}

async function browserLoadImage(url) {
  const image=new Image();image.decoding='async';image.src=url;
  await image.decode();return image;
}

/**
 * @param {{loadImage?:(url:string)=>Promise<CanvasImageSource>}} options
 * @returns {Promise<{draw:Function,getAnchors:Function,trigger:Function,nativeSize:number}>}
 */
export async function createVendor({loadImage=browserLoadImage}={}) {
  const entries=await Promise.all(Object.entries(PARTS).map(async([key,part])=>
    [key,await loadImage(new URL(`./assets/${part.file}`,import.meta.url).href)]
  ));
  const images=Object.fromEntries(entries);
  const started={cat:-100,dog:-100};let lastTime=0;

  function values(options={}) {
    const time=Number.isFinite(options.time)?options.time:0;
    const cat=Math.max(clamp(options.serveCat),clamp(1-(time-started.cat)/.8));
    const dog=Math.max(clamp(options.serveDog),clamp(1-(time-started.dog)/.95));
    return {time,cat,dog,p:pose(time,cat,dog)};
  }

  function getAnchors(options={}) {
    const {x=0,y=0,width=600}=options,{p}=values(options),s=width/VENDOR_NATIVE_SIZE;
    const point=n=>({x:x+n[0]*s,y:y+n[1]*s});
    return {
      fish:point(movedPoint([392,585],PARTS.catArm.pivot,p.cat)),
      soup:point(movedPoint([767,778],PARTS.ladle.pivot,p.ladle)),
      face:point([615,520]),
      lantern:point(movedPoint([145,365],PARTS.lantern.pivot,{angle:p.lantern})),
    };
  }

  function draw(ctx,options={}) {
    const {x=0,y=0,width=600}=options,{time,p}=values(options);
    lastTime=time;
    ctx.save();ctx.translate(x,y);ctx.scale(width/VENDOR_NATIVE_SIZE,width/VENDOR_NATIVE_SIZE);
    drawLanternGlow(ctx,time,p);
    drawPart(ctx,images.base,PARTS.base);
    drawPart(ctx,images.lantern,PARTS.lantern,{angle:p.lantern});
    drawPart(ctx,images.knot,PARTS.knot,{angle:p.knot});
    drawPart(ctx,images.leftEye,PARTS.leftEye,{scaleY:p.eyes});
    drawPart(ctx,images.rightEye,PARTS.rightEye,{scaleY:p.eyes});
    drawPart(ctx,images.catArm,PARTS.catArm,p.cat);
    drawSoupRipples(ctx,time,p);
    drawPart(ctx,images.ladle,PARTS.ladle,p.ladle);
    drawPart(ctx,images.dogPaw,PARTS.dogPaw,p.wrist);
    drawBowlForeground(ctx,images.base);
    drawSteam(ctx,time);
    ctx.restore();
    return {x,y,width,height:width};
  }

  /** Optional convenience for callers that prefer events over pulse values. */
  function trigger(kind,time=lastTime) {
    started[kind==='dog'||kind==='soup'?'dog':'cat']=time;
  }

  return {draw,getAnchors,trigger,nativeSize:VENDOR_NATIVE_SIZE};
}
