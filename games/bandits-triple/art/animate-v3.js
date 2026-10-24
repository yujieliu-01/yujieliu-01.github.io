/* Original illustration layers + deterministic, locally rendered animation. */
(function (root) {
  'use strict';
  const P = typeof module !== 'undefined' && module.exports ? require('./pose-v3.js') : root.SlotCatPoseV3;
  const E = typeof module !== 'undefined' && module.exports ? require('./effects-v3.js') : root.SlotCatEffects;
  const M = typeof module !== 'undefined' && module.exports ? require('./character-motion.js') : root.SlotCatCharacterMotion;
  const W = 1254;
  const armBox = {x: 546, y: 590, w: 284, h: 250};
  function armPath(c) {
    c.beginPath();
    c.moveTo(550, 700);
    c.bezierCurveTo(585, 705, 596, 699, 609, 686);
    c.bezierCurveTo(641, 677, 668, 650, 695, 626);
    c.bezierCurveTo(721, 602, 743, 594, 766, 594);
    c.bezierCurveTo(799, 594, 816, 612, 819, 633);
    c.bezierCurveTo(821, 649, 812, 663, 797, 666);
    c.bezierCurveTo(792, 683, 778, 690, 760, 696);
    c.bezierCurveTo(745, 741, 713, 782, 675, 804);
    c.bezierCurveTo(653, 817, 630, 827, 610, 830);
    c.lineTo(551, 833); c.closePath();
  }
  function matrixForTriangle(s, d) {
    const [p0,p1,p2]=s,[q0,q1,q2]=d;
    const x1=p1[0]-p0[0],y1=p1[1]-p0[1],x2=p2[0]-p0[0],y2=p2[1]-p0[1];
    const u1=q1[0]-q0[0],v1=q1[1]-q0[1],u2=q2[0]-q0[0],v2=q2[1]-q0[1];
    const det=x1*y2-x2*y1;
    const a=(u1*y2-u2*y1)/det,b=(v1*y2-v2*y1)/det;
    const c=(u2*x1-u1*x2)/det,dv=(v2*x1-v1*x2)/det;
    return [a,b,c,dv,q0[0]-a*p0[0]-c*p0[1],q0[1]-b*p0[0]-dv*p0[1]];
  }
  function drawTriangle(ctx, img, s, d) {
    const center=[(d[0][0]+d[1][0]+d[2][0])/3,(d[0][1]+d[1][1]+d[2][1])/3];
    const expanded=d.map(p=>{let dx=p[0]-center[0],dy=p[1]-center[1],r=Math.hypot(dx,dy)||1;return[p[0]+dx/r*3,p[1]+dy/r*3];});
    ctx.save(); ctx.beginPath(); ctx.moveTo(...expanded[0]);ctx.lineTo(...expanded[1]);ctx.lineTo(...expanded[2]);ctx.closePath();ctx.clip();
    ctx.transform(...matrixForTriangle(s,d));ctx.drawImage(img,0,0);ctx.restore();
  }
  function makeMesh() {
    const triangles=[],step=18;
    for(let y=0;y<armBox.h;y+=step)for(let x=0;x<armBox.w;x+=step){
      const x1=Math.min(x+step,armBox.w),y1=Math.min(y+step,armBox.h);
      triangles.push([[x,y],[x1,y],[x1,y1]],[[x,y],[x1,y1],[x,y1]]);
    }
    return triangles;
  }
  function drawLever(ctx, angle) {
    const pivot=P.constants.leverPivot,ball=P.constants.knob;
    ctx.save();ctx.translate(...pivot);ctx.rotate(angle);ctx.translate(-pivot[0],-pivot[1]);
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(...pivot);ctx.lineTo(ball[0]+4,ball[1]+24);ctx.strokeStyle='#3b211b';ctx.lineWidth=30;ctx.stroke();
    ctx.strokeStyle='#9e948f';ctx.lineWidth=16;ctx.stroke();
    ctx.beginPath();ctx.moveTo(pivot[0]-3,pivot[1]-2);ctx.lineTo(ball[0]+1,ball[1]+24);ctx.strokeStyle='#c7beb6';ctx.lineWidth=6;ctx.stroke();
    const g=ctx.createLinearGradient(ball[0]-30,ball[1]-36,ball[0]+25,ball[1]+35);g.addColorStop(0,'#ff4d42');g.addColorStop(0.6,'#ff2d32');g.addColorStop(1,'#df2328');
    ctx.beginPath();ctx.ellipse(ball[0],ball[1],40,42,-0.12,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#3b211b';ctx.lineWidth=10;ctx.stroke();
    ctx.beginPath();ctx.ellipse(ball[0]-12,ball[1]-18,8,12,0.5,0,Math.PI*2);ctx.fillStyle='rgba(255,220,207,0.5)';ctx.fill();
    ctx.restore();
  }
  const fruitBoxes=[{x:639,y:386,w:105,h:111},{x:748,y:407,w:108,h:114},{x:868,y:434,w:105,h:100}];
  const fruitMasks=[
    [[694,395],[704,390],[716,393],[728,401],[733,409],[729,417],[720,423],[707,426],[698,424],[702,433],[712,436],[720,443],[726,453],[727,464],[723,476],[715,486],[705,490],[695,487],[687,480],[682,469],[671,470],[661,473],[650,469],[644,460],[642,447],[645,432],[651,423],[659,418],[671,417],[678,420],[684,410],[689,403]],
    [[816,422],[818,414],[832,410],[843,415],[850,423],[850,433],[845,440],[838,445],[840,449],[840,466],[836,482],[826,495],[813,505],[795,512],[779,513],[772,511],[764,516],[755,513],[751,507],[750,496],[753,484],[752,475],[756,460],[765,447],[779,435],[795,424],[810,422]],
    [[874,439],[967,449],[968,464],[965,482],[957,502],[944,517],[924,527],[906,528],[889,522],[878,513],[869,499],[866,480],[868,458]]
  ].map((points,index)=>points.map(p=>[p[0]-fruitBoxes[index].x,p[1]-fruitBoxes[index].y]));
  const reelWindows=[
    [[669,355],[747,364],[724,536],[681,530],[672,508],[658,471],[642,445]],
    [[778,361],[866,372],[871,379],[869,390],[841,551],[837,559],[826,559],[749,549],[742,543],[738,531],[738,516],[742,477],[749,426],[759,382],[766,367]],
    [[889,378],[980,389],[984,396],[982,410],[956,563],[951,573],[943,574],[865,564],[858,558],[854,546],[853,532],[855,509],[860,472],[867,434],[875,400],[881,386]]
  ];
  function makeFruit(createCanvas,source,b,index) {
    const can=createCanvas(b.w,b.h),c=can.getContext('2d');const m=fruitMasks[index];c.beginPath();c.moveTo(...m[0]);for(let i=1;i<m.length;i++)c.lineTo(...m[i]);c.closePath();c.clip();c.drawImage(source,-b.x,-b.y);
    const im=c.getImageData(0,0,b.w,b.h);
    // Remove only pale background connected to the cutout edge, keeping the
    // enclosed cream highlights on the fruit. The tight masks exclude the frame.
    const visited=new Uint8Array(b.w*b.h),queue=new Int32Array(b.w*b.h);let head=0,tail=0;
    function enqueue(p){if(p<0||p>=visited.length||visited[p])return;const k=p*4,r=im.data[k],g=im.data[k+1],bl=im.data[k+2];if(im.data[k+3]<8||(r>198&&g>173&&bl>119)){visited[p]=1;queue[tail++]=p;}}
    for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const p=y*b.w+x;if(!x||!y||x===b.w-1||y===b.h-1||im.data[p*4+3]<8)enqueue(p);}
    if(index===0)enqueue((423-b.y)*b.w+(688-b.x));
    while(head<tail){const p=queue[head++],x=p%b.w,y=Math.floor(p/b.w);im.data[p*4+3]=0;if(x)enqueue(p-1);if(x<b.w-1)enqueue(p+1);if(y)enqueue(p-b.w);if(y<b.h-1)enqueue(p+b.w);}
    c.putImageData(im,0,0);return can;
  }
  function drawReels(ctx,fruits,time) {
    const start=3.96;
    const centers=[[692,445],[814,469],[924,488]],h=158;
    for(let j=0;j<3;j++){
      const duration=1.27+0.24*j,u=(time-start)/duration;
      if(u<=0||u>=1)continue;
      const v=1-Math.pow(1-u,3),travel=(6+3*j)*h*v;
      const points=reelWindows[j];ctx.save();ctx.beginPath();ctx.moveTo(...points[0]);for(let k=1;k<points.length;k++)ctx.lineTo(...points[k]);ctx.closePath();ctx.clip();
      const g=ctx.createLinearGradient(0,345,0,570);g.addColorStop(0,'#f1d9b8');g.addColorStop(0.23,'#fff8e7');g.addColorStop(0.72,'#fff9ed');g.addColorStop(1,'#e9ccaa');ctx.fillStyle=g;ctx.fillRect(610,345,400,240);
      const n=Math.floor(travel/h);
      for(let k=n-2;k<=n+2;k++){
        const shift=travel-k*h,idx=((j+k)%3+3)%3,f=fruits[idx],scale=0.96;
        ctx.drawImage(f,centers[j][0]-shift*0.135-f.width*scale/2,centers[j][1]+shift-f.height*scale/2,f.width*scale,f.height*scale);
      }
      ctx.restore();
    }
  }
  async function create({createCanvas,loadImage},originalSrc,cleanSrc,groundSrc,machineSrc) {
    const [original,clean,ground,machine]=await Promise.all([loadImage(originalSrc),loadImage(cleanSrc),loadImage(groundSrc),loadImage(machineSrc)]);
    const arm=createCanvas(armBox.w,armBox.h),ac=arm.getContext('2d');
    ac.save();ac.translate(-armBox.x,-armBox.y);armPath(ac);ac.clip();ac.drawImage(original,0,0);ac.restore();
    // Remove only the coral panel included in the few pixels around the sprite.
    const ai=ac.getImageData(0,0,armBox.w,armBox.h);
    for(let i=0;i<ai.data.length;i+=4){const r=ai.data[i],g=ai.data[i+1],b=ai.data[i+2];if(r>158&&g<152&&b>38&&r>g*1.48)ai.data[i+3]=0;}
    ac.putImageData(ai,0,0);
    const mesh=makeMesh(),fruits=fruitBoxes.map((b,i)=>makeFruit(createCanvas,original,b,i));
    // A cat-shaped replacement keeps the ground pose from repainting the machine.
    const mask=createCanvas(W,W),mc=mask.getContext('2d');
    mc.beginPath();mc.moveTo(510,696);mc.lineTo(614,696);mc.bezierCurveTo(640,730,659,778,642,820);mc.lineTo(666,975);mc.bezierCurveTo(695,981,701,1018,680,1044);mc.lineTo(700,1083);mc.lineTo(510,1083);mc.closePath();mc.fill();
    const waitBase=createCanvas(W,W),wc=waitBase.getContext('2d');wc.drawImage(clean,0,0);const basePixels=wc.getImageData(0,0,W,W);
    const sourceCanvas=createCanvas(W,W),src=sourceCanvas.getContext('2d');src.drawImage(ground,0,0);const gp=src.getImageData(0,0,W,W).data,mp=mc.getImageData(0,0,W,W).data;
    for(let y=696;y<1083;y++)for(let x=510;x<701;x++){const i=(y*W+x)*4,w=mp[i+3]/255*Math.max(0,Math.min(1,(x-510)/30)),a=basePixels.data[i+3]/255,b=gp[i+3]/255,na=a*(1-w)+b*w;if(!w)continue;for(let k=0;k<3;k++)basePixels.data[i+k]=na?(basePixels.data[i+k]*a*(1-w)+gp[i+k]*b*w)/na:0;basePixels.data[i+3]=na*255;}
    wc.putImageData(basePixels,0,0);const mixedBase=createCanvas(W,W),mixc=mixedBase.getContext('2d');
    const motion=M.create({createCanvas},clean,ground,machine);
    const cleanBase=motion.prepareBase(clean),groundBase=motion.prepareBase(waitBase);
    const eye=createCanvas(45,70),ec=eye.getContext('2d');
    ec.save();ec.translate(-628,-496);ec.beginPath();ec.ellipse(649.5,531,12,26,-0.20,0,Math.PI*2);ec.clip();ec.drawImage(original,0,0);ec.restore();
    const ei=ec.getImageData(0,0,eye.width,eye.height);
    for(let i=0;i<ei.data.length;i+=4){if(ei.data[i]>105||ei.data[i+1]>85||ei.data[i+2]>80)ei.data[i+3]=0;}
    ec.putImageData(ei,0,0);
    function render(canvas,seconds,options) {
      options=options||{};
      const ctx=canvas.getContext('2d'),pose=Object.assign(P.sample(seconds),options.pose||{});
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
      if(options.viewport) {
        const v=options.viewport, scale=Math.min(canvas.width/v.width,canvas.height/v.height);
        ctx.translate((canvas.width-v.width*scale)/2,(canvas.height-v.height*scale)/2);
        ctx.scale(scale,scale);ctx.translate(-v.x,-v.y);
      } else ctx.scale(canvas.width/W,canvas.height/W);
      const groundBlend=pose.groundBlend;
      motion.drawTail(ctx,pose);
      if(groundBlend===0)ctx.drawImage(cleanBase,0,0);else if(groundBlend===1)ctx.drawImage(groundBase,0,0);else{mixc.clearRect(0,0,W,W);mixc.globalCompositeOperation='source-over';mixc.globalAlpha=1-groundBlend;mixc.drawImage(cleanBase,0,0);mixc.globalCompositeOperation='lighter';mixc.globalAlpha=groundBlend;mixc.drawImage(groundBase,0,0);mixc.globalAlpha=1;mixc.globalCompositeOperation='source-over';ctx.drawImage(mixedBase,0,0);}
      E.drawReels(ctx,fruits,pose);drawLever(ctx,pose.leverAngle);
      motion.drawHead(ctx,pose,eye);
      E.drawPrizeBack(ctx,pose);
      if(groundBlend<1){ctx.save();ctx.globalAlpha=1-groundBlend;for(const tri of mesh){const dst=tri.map(p=>P.deformArmPoint([p[0]+armBox.x,p[1]+armBox.y],pose));drawTriangle(ctx,arm,tri,dst);}ctx.restore();}
      // Put the fixed chest edge over the shoulder attachment, hiding the seam.
      ctx.save();ctx.globalAlpha=1-groundBlend;ctx.beginPath();ctx.moveTo(520,691);ctx.lineTo(579,691);ctx.bezierCurveTo(591,724,588,752,579,776);ctx.bezierCurveTo(575,800,582,826,585,848);ctx.lineTo(520,848);ctx.closePath();ctx.clip();ctx.drawImage(clean,0,0);ctx.restore();
      E.drawPrizeFront(ctx,pose);E.drawLamp(ctx,pose);
      ctx.restore();return pose;
    }
    return {render,original,clean,ground,machine,arm,fruits,eye,motion,duration:P.constants.duration};
  }
  const api={create};root.SlotCatAnimation=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
