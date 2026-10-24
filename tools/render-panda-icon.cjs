#!/usr/bin/env node
/**
 * Render the paper-row panda stall icon from the approved scene artwork.
 * Dependencies: @napi-rs/canvas, sharp, and an ffmpeg build with libwebp_anim.
 * Repository defaults (when this file lives in tools/):
 *   source: ../games/panda-night-stall/assets and ../games/panda-night-stall/vendor.js
 *   output: ../assets
 * Example:
 *   node tools/render-panda-icon.cjs --assets games/panda-night-stall/assets --out assets
 * Options: --assets DIR --vendor FILE --out DIR --fps N --quality N --width N
 *          --ffmpeg FILE --target-kb N
 * Paths supplied on the command line are relative to the current directory.
 * Default paths are relative to this script, never to the current directory.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
const {createRequire}=require('node:module');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {spawn}=require('node:child_process');
const {once}=require('node:events');

function dependency(name) {
  try {return require(name);} catch(error) {
    const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
    if(modules) return createRequire(path.join(modules,'package.json'))(name);
    throw new Error(`Missing ${name}. Install @napi-rs/canvas and sharp before rendering.`,{cause:error});
  }
}
const {createCanvas,loadImage}=dependency('@napi-rs/canvas');
const sharp=dependency('sharp');

const flags={};
for(let i=2;i<process.argv.length;i+=2) {
  const key=process.argv[i],value=process.argv[i+1];
  if(!/^--(?:assets|vendor|out|fps|quality|width|ffmpeg|target-kb)$/.test(key)||value===undefined)
    throw new Error(`Unknown or incomplete option: ${key}`);
  flags[key.slice(2)]=value;
}
const assetDir=flags.assets?path.resolve(flags.assets):path.resolve(__dirname,'../games/panda-night-stall/assets');
const vendorFile=flags.vendor?path.resolve(flags.vendor):path.join(path.dirname(assetDir),'vendor.js');
const outputDir=flags.out?path.resolve(flags.out):path.resolve(__dirname,'../assets');
const ffmpeg=flags.ffmpeg||process.env.FFMPEG_PATH||'ffmpeg';
const WIDTH=Number(flags.width||320),HEIGHT=Math.round(WIDTH*.8);
const FPS=Number(flags.fps||12),QUALITY=Number(flags.quality||68);
const TARGET_BYTES=Number(flags['target-kb']||700)*1024;
const DURATION=11.6,TAU=Math.PI*2;
if(!Number.isFinite(WIDTH)||WIDTH<160||!Number.isFinite(FPS)||FPS<8||FPS>30||!Number.isFinite(QUALITY)||QUALITY<1||QUALITY>100)
  throw new Error('Use width ≥160, fps 8–30 and quality 1–100.');
const WORLD={width:320,height:256};
const STALL={x:54,y:-18,width:270};
const VISITS=[{kind:'cat',start:.4},{kind:'corgi',start:5.9}];
const PHASE={arriveEnd:1.2,foodStart:1.55,foodEnd:2.15,happyEnd:2.85,turnEnd:3.1,end:4.5};
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const lerp=(a,b,t)=>a+(b-a)*t;

function customerAt(time) {
  for(const visit of VISITS) {
    const local=time-visit.start;
    if(local<0||local>=PHASE.end) continue;
    const isCat=visit.kind==='cat',startX=isCat?56:62,pickupX=isCat?72:76;
    let x=pickupX,y=246,size=116,alpha=1,face=1,moving=false,hop=0;
    if(local<PHASE.arriveEnd) {
      const p=smooth(local/PHASE.arriveEnd);
      x=lerp(startX,pickupX,p);y=lerp(231,246,p);size=lerp(98,116,p);
      alpha=smooth(local/.3);moving=true;
    } else if(local>=PHASE.turnEnd) {
      const p=smooth((local-PHASE.turnEnd)/(PHASE.end-PHASE.turnEnd));
      x=lerp(pickupX,startX,p);y=lerp(246,231,p);size=lerp(116,98,p);
      face=-1;alpha=1-smooth((local-(PHASE.end-.4))/.4);moving=true;
    } else if(local>=PHASE.happyEnd) {
      // A short in-place turn, rather than an instantaneous mirrored jump.
      face=Math.cos(smooth((local-PHASE.happyEnd)/(PHASE.turnEnd-PHASE.happyEnd))*Math.PI);
    } else if(local>=PHASE.foodEnd) {
      hop=Math.sin(clamp((local-PHASE.foodEnd)/.55)*Math.PI)*2.5;
    }
    const walk=moving?Math.sin(local*TAU*2.5)*1.2:0;
    return {kind:visit.kind,start:visit.start,local,x,y,size,alpha,face,moving,hop,walk,
      fed:local>=PHASE.foodEnd,
      foodProgress:local>=PHASE.foodStart&&local<PHASE.foodEnd
        ?(local-PHASE.foodStart)/(PHASE.foodEnd-PHASE.foodStart):null};
  }
  return null;
}

function receiverPoint(actor) {
  const aspect=actor.kind==='cat'?459/512:539/512;
  const anchor=actor.kind==='cat'?{x:.792,y:.518}:{x:.823,y:.544};
  return {x:actor.x+(anchor.x-.5)*actor.size*aspect,
    y:actor.y-actor.size+actor.size*anchor.y-actor.hop};
}

function drawFood(ctx,kind,x,y,progress) {
  ctx.save();ctx.translate(x,y);
  ctx.rotate(Math.sin(progress*Math.PI)*(kind==='cat'?.22:-.18));
  const scale=.85+Math.sin(progress*Math.PI)*.15;ctx.scale(scale,scale);
  ctx.lineCap='round';ctx.lineJoin='round';
  if(kind==='cat') {
    // Fish portions land inside the existing empty tin; no second tin appears.
    ctx.strokeStyle='#975436';ctx.lineWidth=1.1;
    for(const [px,py,rx,ry,rotation] of [[-7,1,7,4,-.3],[5,0,7.5,4.6,.2],[0,-4,6.2,4.1,-.1]]) {
      ctx.fillStyle='#ffb27d';ctx.beginPath();ctx.ellipse(px,py,rx,ry,rotation,0,TAU);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#ffe5b8';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(px-rx*.3,py-1);ctx.lineTo(px+rx*.25,py-2);ctx.stroke();
      ctx.strokeStyle='#975436';ctx.lineWidth=1.1;
    }
  } else {
    ctx.strokeStyle='#93683c';ctx.fillStyle='#fff1c7';ctx.lineWidth=1.1;
    ctx.beginPath();ctx.moveTo(-7,-1);ctx.lineTo(5,-3);ctx.lineTo(7,2);ctx.lineTo(-6,4);ctx.closePath();ctx.fill();ctx.stroke();
    for(const [px,py] of [[-8,-2],[-7,4],[6,-4],[8,1]]) {
      ctx.beginPath();ctx.arc(px,py,3.5,0,TAU);ctx.fill();ctx.stroke();
    }
    ctx.strokeStyle='#fff1c7';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-7,1);ctx.lineTo(7,-1);ctx.stroke();
    ctx.fillStyle='#efba62';
    for(const [px,py,r] of [[-12,6,1.7],[11,6,1.5],[0,9,1.8]]) {
      ctx.beginPath();ctx.ellipse(px,py,r,r*1.4,0,0,TAU);ctx.fill();
    }
  }
  ctx.restore();
}

async function loadVendor() {
  const base=pathToFileURL(assetDir+path.sep).href;
  let source=await fs.readFile(vendorFile,'utf8');
  const pattern=/new URL\(`\.\/assets\/\$\{part\.file\}`,\s*import\.meta\.url\)\.href/g;
  let matches=0;
  source=source.replace(pattern,()=>{matches++;return `new URL(part.file,${JSON.stringify(base)}).href`;});
  if(matches!==1) throw new Error('The approved vendor asset-loader shape changed; update the renderer adapter.');
  // A data module works in repositories with either CommonJS or ESM defaults.
  const {createVendor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  return createVendor({loadImage:url=>loadImage(url.startsWith('file:')?fileURLToPath(url):url)});
}

async function encodeWebP(frames,filename,quality) {
  const args=['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS),
    '-vcodec','png','-i','pipe:0','-an','-c:v','libwebp_anim','-lossless','0',
    '-quality',String(quality),'-compression_level','6','-preset','drawing','-loop','0',filename];
  const child=spawn(ffmpeg,args,{stdio:['pipe','ignore','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  const completed=new Promise((resolve,reject)=>{
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
  });
  // Start observing errors before writing so an unavailable encoder is reported.
  completed.catch(()=>{});
  for(const frame of frames) if(!child.stdin.write(frame)) await once(child.stdin,'drain');
  child.stdin.end();await completed;
}

async function main() {
  await fs.mkdir(outputDir,{recursive:true});
  const art={};
  await Promise.all(['background-night','cat-wait','cat-fed','corgi-wait','corgi-fed'].map(async name=>{
    art[name]=await loadImage(path.join(assetDir,`${name}.webp`));
  }));
  const vendor=await loadVendor();
  const canvas=createCanvas(WIDTH,HEIGHT),ctx=canvas.getContext('2d');
  const initialVendor=createCanvas(WIDTH,HEIGHT),iv=initialVendor.getContext('2d');
  iv.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);vendor.draw(iv,{...STALL,time:0});
  const movingVendor=createCanvas(WIDTH,HEIGHT),mv=movingVendor.getContext('2d');
  const background=createCanvas(WIDTH,HEIGHT),bg=background.getContext('2d');
  const source=art['background-night'],cover=Math.max(WIDTH/source.width,HEIGHT/source.height);
  bg.drawImage(source,(WIDTH-source.width*cover)*.5,(HEIGHT-source.height*cover)*.45,source.width*cover,source.height*cover);
  bg.fillStyle='rgba(8,27,41,.10)';bg.fillRect(0,0,WIDTH,HEIGHT);
  bg.save();bg.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);
  bg.fillStyle='rgba(53,38,32,.18)';bg.beginPath();bg.ellipse(206,246,94,7,0,0,TAU);bg.fill();bg.restore();

  function drawFrame(time) {
    ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(background,0,0);
    const actor=customerAt(time);
    const flight=actor?.foodProgress;
    const handPulse=flight!==null&&flight!==undefined?Math.sin(flight*Math.PI):0;
    const vendorTime=Math.max(0,time-.3);
    const blend=smooth((time-10.7)/.45);
    if(time<=.3||blend===1) ctx.drawImage(initialVendor,0,0);
    else {
      mv.clearRect(0,0,WIDTH,HEIGHT);mv.save();mv.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);
      vendor.draw(mv,{...STALL,time:vendorTime,serveCat:actor?.kind==='cat'?handPulse:0,serveDog:actor?.kind==='corgi'?handPulse:0});mv.restore();
      ctx.drawImage(movingVendor,0,0);
      // The empty ending dissolves into the exact opening pose. Steam never
      // reverses, and the last and first frames match pixel for pixel.
      if(blend>0) {ctx.save();ctx.globalAlpha=blend;ctx.drawImage(initialVendor,0,0);ctx.restore();}
    }
    ctx.save();ctx.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);
    if(actor&&actor.alpha>0) {
      const sprite=art[`${actor.kind}-${actor.fed?'fed':'wait'}`],height=actor.size,width=height*sprite.width/sprite.height;
      ctx.save();ctx.globalAlpha=actor.alpha;
      ctx.fillStyle='rgba(70,46,28,.21)';ctx.beginPath();ctx.ellipse(actor.x,actor.y+1,width*.37,height*.045,0,0,TAU);ctx.fill();
      ctx.translate(actor.x,actor.y-Math.max(0,actor.walk)-actor.hop);
      ctx.scale(actor.face,1);
      if(actor.moving) ctx.rotate(Math.sin(actor.local*TAU*2.5)*.012);
      ctx.drawImage(sprite,-width/2,-height,width,height);ctx.restore();
      if(flight!==null) {
        const launchTime=actor.start+PHASE.foodStart-.3;
        const anchors=vendor.getAnchors({...STALL,time:launchTime});
        const from=anchors[actor.kind==='cat'?'fish':'soup'],to=receiverPoint(actor);
        const x=lerp(from.x,to.x,flight),y=lerp(from.y,to.y,flight)-Math.sin(flight*Math.PI)*17;
        drawFood(ctx,actor.kind,x,y,flight);
      }
    }
    ctx.restore();
    return {png:canvas.toBuffer('image/png'),actor};
  }

  const frames=[],frameCount=Math.round(DURATION*FPS);
  let first,last,boundsFailures=0,foodStateFailures=0;
  for(let i=0;i<frameCount;i++) {
    const time=i/FPS,{png,actor}=drawFrame(time);frames.push(png);
    if(i===0) first=Buffer.from(ctx.getImageData(0,0,WIDTH,HEIGHT).data);
    if(i===frameCount-1) last=Buffer.from(ctx.getImageData(0,0,WIDTH,HEIGHT).data);
    if(actor&&actor.alpha>.001) {
      const aspect=actor.kind==='cat'?459/512:539/512;
      const half=actor.size*aspect*.5;
      if(actor.x-half<5||actor.x+half>315||actor.y-actor.size-actor.hop<5||actor.y+3>253) boundsFailures++;
      if(actor.fed&&actor.foodProgress!==null) foodStateFailures++;
    }
  }
  if(boundsFailures||foodStateFailures||!first.equals(last))
    throw new Error(`Frame QA failed: bounds=${boundsFailures}, early food=${foodStateFailures}, loop=${first.equals(last)}`);
  const animated=path.join(outputDir,'panda-stall-animated.webp');
  let quality=QUALITY,bytes=0;
  for(const candidate of [...new Set([QUALITY,Math.max(40,QUALITY-10),Math.max(40,QUALITY-20)])]) {
    quality=candidate;await encodeWebP(frames,animated,quality);bytes=(await fs.stat(animated)).size;
    console.log(`Encoding ${FPS} fps / quality ${quality}: ${(bytes/1024).toFixed(1)} KiB`);
    if(bytes<=TARGET_BYTES) break;
  }
  const still=drawFrame(3.0).png;
  await sharp(still).webp({quality:90,effort:6}).toFile(path.join(outputDir,'panda-stall-static.webp'));

  const moments=[
    [0,'empty opening'],[1.1,'cat approaches'],[2.25,'fish in flight'],[3.0,'cat receives'],
    [4.2,'cat leaves'],[5.2,'empty pause'],[6.6,'corgi approaches'],[7.8,'soup in flight'],
    [8.5,'corgi receives'],[9.7,'corgi leaves'],[10.6,'empty ending'],[11.55,'opening pose'],
  ];
  const sheet=createCanvas(1280,1200),sc=sheet.getContext('2d');
  sc.fillStyle='#f3f0e7';sc.fillRect(0,0,sheet.width,sheet.height);
  sc.fillStyle='#213b3b';sc.font='bold 22px sans-serif';sc.fillText('Panda paper icon · 11.6 s loop',16,30);
  sc.font='14px sans-serif';sc.fillText('One customer at a time · food arrives before filled state · opening and ending match',16,52);
  for(let i=0;i<moments.length;i++) {
    const [time,label]=moments[i],image=await loadImage(drawFrame(time).png),x=(i%4)*320,y=68+Math.floor(i/4)*292;
    sc.fillStyle='#213b3b';sc.font='14px sans-serif';sc.fillText(`${time.toFixed(2)} s · ${label}`,x+8,y+18);
    sc.drawImage(image,x,y+28,320,256);
  }
  sc.font='bold 18px sans-serif';sc.fillText('Actual webpage size · 80 × 64 px',16,970);
  for(let i=0;i<moments.length;i++) {
    const [time,label]=moments[i],image=await loadImage(drawFrame(time).png),x=16+(i%6)*208,y=986+Math.floor(i/6)*102;
    sc.drawImage(image,x,y,80,64);sc.font='12px sans-serif';sc.fillText(`${time.toFixed(2)} s · ${label}`,x,y+81);
  }
  await fs.writeFile(path.join(outputDir,'contact-sheet.png'),sheet.toBuffer('image/png'));
  const metadata=await sharp(animated,{animated:true}).metadata();
  const encodedDurationMs=(metadata.delay||[]).reduce((sum,delay)=>sum+delay,0);
  console.log(JSON.stringify({animated,static:path.join(outputDir,'panda-stall-static.webp'),width:WIDTH,height:HEIGHT,
    fps:FPS,sourceFrames:frameCount,encodedFrames:metadata.pages,requestedDurationSeconds:DURATION,
    encodedDurationMs,loop:metadata.loop,quality,
    bytes,underTarget:bytes<=TARGET_BYTES,loopFramesIdentical:first.equals(last),boundsFailures,foodStateFailures},null,2));
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
