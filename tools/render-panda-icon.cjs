#!/usr/bin/env node
/**
 * Render the genuinely transparent paper-row icon from approved scene artwork.
 * No rectangular background, page-colored fill, or outside lantern haze is baked in.
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
// Leave the entire roof, leaves, knot and cabinet inside the transparent frame.
const STALL={x:78,y:8,width:240};
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
  // The full game uses this glow against its dark courtyard. An inline icon
  // should not paint a broad amber haze over the surrounding white webpage.
  const glow=/\bdrawLanternGlow\(ctx,time,p\);/g;
  if((source.match(glow)||[]).length!==1) throw new Error('The vendor glow adapter needs updating.');
  source=source.replace(glow,'/* Outside lantern glow omitted for the transparent paper icon. */');
  // A data module works in repositories with either CommonJS or ESM defaults.
  const {createVendor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  return createVendor({loadImage:url=>loadImage(url.startsWith('file:')?fileURLToPath(url):url)});
}

async function encodeWebP(frames,filename,quality) {
  const args=['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS),
    '-vcodec','png','-i','pipe:0','-an','-pix_fmt','bgra','-c:v','libwebp_anim','-lossless','0',
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
  await Promise.all(['cat-wait','cat-fed','corgi-wait','corgi-fed'].map(async name=>{
    art[name]=await loadImage(path.join(assetDir,`${name}.webp`));
  }));
  const vendor=await loadVendor();
  const canvas=createCanvas(WIDTH,HEIGHT),ctx=canvas.getContext('2d');
  const initialVendor=createCanvas(WIDTH,HEIGHT),iv=initialVendor.getContext('2d');
  iv.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);vendor.draw(iv,{...STALL,time:0});
  const movingVendor=createCanvas(WIDTH,HEIGHT),mv=movingVendor.getContext('2d');
  const mixedVendor=createCanvas(WIDTH,HEIGHT),mix=mixedVendor.getContext('2d');

  function drawFrame(time) {
    // Start from empty RGBA every time; no scene from the previous frame survives.
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    ctx.save();ctx.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);
    ctx.fillStyle='rgba(40,33,27,.09)';ctx.beginPath();ctx.ellipse(222,248,78,3.5,0,0,TAU);ctx.fill();ctx.restore();
    const actor=customerAt(time);
    const flight=actor?.foodProgress;
    const handPulse=flight!==null&&flight!==undefined?Math.sin(flight*Math.PI):0;
    const vendorTime=Math.max(0,time-.3);
    const blend=smooth((time-10.7)/.45);
    if(time<=.3||blend===1) ctx.drawImage(initialVendor,0,0);
    else {
      mv.clearRect(0,0,WIDTH,HEIGHT);mv.save();mv.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);
      vendor.draw(mv,{...STALL,time:vendorTime,serveCat:actor?.kind==='cat'?handPulse:0,serveDog:actor?.kind==='corgi'?handPulse:0});mv.restore();
      if(blend===0) ctx.drawImage(movingVendor,0,0);
      else {
        // A premultiplied linear blend on an EMPTY layer. Both old RGB and old
        // alpha fade away; source-over would leave a second arm/lantern behind.
        mix.clearRect(0,0,WIDTH,HEIGHT);mix.save();
        mix.globalAlpha=1-blend;mix.drawImage(movingVendor,0,0);
        mix.globalCompositeOperation='lighter';mix.globalAlpha=blend;mix.drawImage(initialVendor,0,0);mix.restore();
        ctx.drawImage(mixedVendor,0,0);
      }
    }
    ctx.save();ctx.scale(WIDTH/WORLD.width,HEIGHT/WORLD.height);
    if(actor&&actor.alpha>0) {
      const sprite=art[`${actor.kind}-${actor.fed?'fed':'wait'}`],height=actor.size,width=height*sprite.width/sprite.height;
      ctx.save();ctx.globalAlpha=actor.alpha;
      ctx.fillStyle='rgba(40,33,27,.13)';ctx.beginPath();ctx.ellipse(actor.x,actor.y+1,width*.37,height*.035,0,0,TAU);ctx.fill();
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

  const frames=[],sourceAlphas=[],frameCount=Math.round(DURATION*FPS);
  let first,last,boundsFailures=0,foodStateFailures=0,sourceBorderFailures=0;
  const borderPixels=[];
  for(let x=0;x<WIDTH;x++) {borderPixels.push(x,(HEIGHT-1)*WIDTH+x);}
  for(let y=1;y<HEIGHT-1;y++) {borderPixels.push(y*WIDTH,y*WIDTH+WIDTH-1);}
  for(let i=0;i<frameCount;i++) {
    const time=i/FPS,{png,actor}=drawFrame(time);frames.push(png);
    const rgba=ctx.getImageData(0,0,WIDTH,HEIGHT).data;
    const alpha=Buffer.alloc(WIDTH*HEIGHT);
    for(let p=0;p<alpha.length;p++) alpha[p]=rgba[p*4+3];
    sourceAlphas.push(alpha);
    if(borderPixels.some(p=>alpha[p]!==0)) sourceBorderFailures++;
    if(i===0) first=Buffer.from(rgba);
    if(i===frameCount-1) last=Buffer.from(rgba);
    if(actor&&actor.alpha>.001) {
      const aspect=actor.kind==='cat'?459/512:539/512;
      const half=actor.size*aspect*.5;
      if(actor.x-half<5||actor.x+half>315||actor.y-actor.size-actor.hop<5||actor.y+3>253) boundsFailures++;
      if(actor.fed&&actor.foodProgress!==null) foodStateFailures++;
    }
  }
  if(boundsFailures||foodStateFailures||sourceBorderFailures||!first.equals(last))
    throw new Error(`Frame QA failed: bounds=${boundsFailures}, early food=${foodStateFailures}, border=${sourceBorderFailures}, loop=${first.equals(last)}`);
  const animated=path.join(outputDir,'panda-stall-animated.webp');
  let quality=QUALITY,bytes=0;
  for(const candidate of [...new Set([QUALITY,Math.max(40,QUALITY-10),Math.max(40,QUALITY-20)])]) {
    quality=candidate;await encodeWebP(frames,animated,quality);bytes=(await fs.stat(animated)).size;
    console.log(`Encoding ${FPS} fps / quality ${quality}: ${(bytes/1024).toFixed(1)} KiB`);
    if(bytes<=TARGET_BYTES) break;
  }
  const still=drawFrame(3.0).png;
  await sharp(still).webp({quality:90,effort:6}).toFile(path.join(outputDir,'panda-stall-static.webp'));

  // Inspect decoded animation frames, including WebP disposal/blending, not
  // only the input PNGs. This catches persistent transparent-frame trails.
  const metadata=await sharp(animated,{animated:true}).metadata();
  const {data:decoded,info}=await sharp(animated,{animated:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(!metadata.hasAlpha||info.channels!==4) throw new Error('The encoded WebP lost its alpha channel.');
  const encodedDurationMs=(metadata.delay||[]).reduce((sum,delay)=>sum+delay,0);
  const pageBytes=WIDTH*HEIGHT*4,starts=[];
  let elapsed=0,decodedCornerFailures=0,decodedBorderFailures=0,ghostPixels=0;
  const corners=[0,WIDTH-1,(HEIGHT-1)*WIDTH,WIDTH*HEIGHT-1];
  for(let frame=0;frame<metadata.pages;frame++) {
    starts.push(elapsed);
    const page=decoded.subarray(frame*pageBytes,(frame+1)*pageBytes);
    if(corners.some(p=>page[p*4+3]!==0)) decodedCornerFailures++;
    if(borderPixels.some(p=>page[p*4+3]!==0)) decodedBorderFailures++;
    const sourceIndex=Math.min(sourceAlphas.length-1,Math.round(elapsed*FPS/1000));
    const expected=sourceAlphas[sourceIndex];
    for(let p=0;p<expected.length;p++) if(expected[p]===0&&page[p*4+3]>8) ghostPixels++;
    elapsed+=metadata.delay[frame];
  }
  if(decodedCornerFailures||decodedBorderFailures||ghostPixels)
    throw new Error(`Decoded alpha QA failed: corners=${decodedCornerFailures}, border=${decodedBorderFailures}, ghost pixels=${ghostPixels}`);

  const moments=[
    [0,'empty opening'],[1.1,'cat approaches'],[2.25,'fish in flight'],[3.0,'cat receives'],
    [4.2,'cat leaves'],[5.2,'empty pause'],[6.6,'corgi approaches'],[7.8,'soup in flight'],
    [8.5,'corgi receives'],[9.7,'corgi leaves'],[10.6,'empty ending'],[11.55,'opening pose'],
  ];
  const proofImages=await Promise.all(moments.map(async([time])=>{
    let frame=starts.findLastIndex(start=>start<=time*1000);
    if(frame<0) frame=0;
    const pixels=decoded.subarray(frame*pageBytes,(frame+1)*pageBytes);
    return loadImage(await sharp(pixels,{raw:{width:WIDTH,height:HEIGHT,channels:4}}).png().toBuffer());
  }));
  function checker(context,x,y,width,height,cell=12) {
    context.fillStyle='#ffffff';context.fillRect(x,y,width,height);
    context.fillStyle='#e3e5e7';
    for(let row=0;row<height/cell;row++) for(let col=0;col<width/cell;col++) if((row+col)%2===0)
      context.fillRect(x+col*cell,y+row*cell,Math.min(cell,width-col*cell),Math.min(cell,height-row*cell));
  }
  for(const mode of ['white','checker']) {
    const sheet=createCanvas(1280,1200),sc=sheet.getContext('2d');
    sc.fillStyle='#ffffff';sc.fillRect(0,0,sheet.width,sheet.height);
    sc.fillStyle='#213b3b';sc.font='bold 22px sans-serif';sc.fillText(`Transparent panda paper icon · ${mode} proof`,16,30);
    sc.font='14px sans-serif';sc.fillText('Decoded WebP frames · full stall silhouette · no outside haze · all frame borders alpha = 0',16,52);
    for(let i=0;i<moments.length;i++) {
      const [time,label]=moments[i],x=(i%4)*320,y=68+Math.floor(i/4)*292;
      sc.fillStyle='#213b3b';sc.font='14px sans-serif';sc.fillText(`${time.toFixed(2)} s · ${label}`,x+8,y+18);
      if(mode==='checker') checker(sc,x,y+28,320,256);
      sc.drawImage(proofImages[i],x,y+28,320,256);
    }
    sc.fillStyle='#213b3b';sc.font='bold 18px sans-serif';sc.fillText('Actual webpage size · 80 × 64 px',16,970);
    for(let i=0;i<moments.length;i++) {
      const [time,label]=moments[i],x=16+(i%6)*208,y=986+Math.floor(i/6)*102;
      if(mode==='checker') checker(sc,x,y,80,64,6);
      sc.drawImage(proofImages[i],x,y,80,64);sc.fillStyle='#213b3b';sc.font='12px sans-serif';sc.fillText(`${time.toFixed(2)} s · ${label}`,x,y+81);
    }
    const png=sheet.toBuffer('image/png');
    await fs.writeFile(path.join(outputDir,`contact-sheet-${mode}.png`),png);
    if(mode==='white') await fs.writeFile(path.join(outputDir,'contact-sheet.png'),png);
  }
  console.log(JSON.stringify({animated,static:path.join(outputDir,'panda-stall-static.webp'),width:WIDTH,height:HEIGHT,
    fps:FPS,sourceFrames:frameCount,encodedFrames:metadata.pages,requestedDurationSeconds:DURATION,
    encodedDurationMs,loop:metadata.loop,quality,
    bytes,underTarget:bytes<=TARGET_BYTES,hasAlpha:metadata.hasAlpha,loopFramesIdentical:first.equals(last),
    boundsFailures,foodStateFailures,sourceBorderFailures,decodedCornerFailures,decodedBorderFailures,ghostPixels},null,2));
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
