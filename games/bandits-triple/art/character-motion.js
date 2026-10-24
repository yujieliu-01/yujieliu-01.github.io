/* Small facial and tail motions; source art remains at its native coordinates. */
(function (root) {
  'use strict';
  const W=1254, headPivot=[330,695];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mix=(a,b,u)=>a+(b-a)*u;
  const edge=[[285,580],[300,583],[320,592],[350,606],[390,614],[430,634],[470,660],[510,678],[550,697],[590,699],[630,688],[670,657],[690,633],[720,650]];
  function rightEdge(y) {
    for(let i=1;i<edge.length;i++)if(y<=edge[i][0])return mix(edge[i-1][1],edge[i][1],(y-edge[i-1][0])/(edge[i][0]-edge[i-1][0]));
    return edge[edge.length-1][1];
  }
  function neckEdge(x) {
    if(x<329)return 720;
    if(x<519)return mix(696,682,(x-329)/190);
    if(x<612)return mix(682,690,(x-519)/93);
    return 690;
  }
  function create({createCanvas},clean,ground,machine) {
    const source=createCanvas(W,W),sc=source.getContext('2d');sc.drawImage(clean,0,0);
    const plate=createCanvas(W,W),pc=plate.getContext('2d');pc.drawImage(machine,0,0,W,W);
    const a=sc.getImageData(0,0,W,W),b=pc.getImageData(0,0,W,W);
    const headMask=createCanvas(W,W),mc=headMask.getContext('2d');
    // The removed-cat clean plate identifies the head silhouette. Filling each
    // scanline keeps tiny coincident dark outline pixels inside the cutout.
    for(let y=285;y<720;y++){
      let lo=W,hi=-1,limit=Math.floor(rightEdge(y));
      for(let x=205;x<=limit;x++){
        const i=(y*W+x)*4;
        if(a.data[i+3]<4||y>neckEdge(x))continue;
        const delta=a.data[i+3]/255*Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]))+Math.abs(a.data[i+3]-b.data[i+3]);
        if(delta>45){lo=Math.min(lo,x);hi=x;}
      }
      if(hi<lo)continue;
      hi=Math.min(limit,hi+2);
      for(let x=lo;x<=hi;x++)if(y<=neckEdge(x))mc.fillRect(x,y,1,1);
    }
    const head=createCanvas(W,W),hc=head.getContext('2d');hc.drawImage(clean,0,0);
    hc.drawImage(ground,632,498,40,64,632,498,40,64);
    hc.globalCompositeOperation='destination-in';hc.drawImage(headMask,0,0);hc.globalCompositeOperation='source-over';
    const neck=createCanvas(W,W),nc=neck.getContext('2d');
    nc.save();nc.beginPath();nc.rect(300,664,338,66);nc.clip();
    const ni=(678*W+420)*4;nc.fillStyle='rgb('+a.data[ni]+','+a.data[ni+1]+','+a.data[ni+2]+')';
    nc.beginPath();nc.moveTo(342,660);nc.quadraticCurveTo(325,697,312,734);nc.lineTo(625,734);nc.lineTo(620,660);nc.closePath();nc.fill();
    nc.strokeStyle='#3b211b';nc.lineWidth=14;nc.lineCap='round';nc.beginPath();nc.moveTo(342,660);nc.quadraticCurveTo(325,697,312,734);nc.stroke();
    nc.drawImage(clean,0,-14);nc.restore();
    nc.globalCompositeOperation='destination-in';nc.drawImage(headMask,0,0);nc.globalCompositeOperation='source-over';
    const tailBox={x:70,y:800,w:158,h:190},tail=createCanvas(tailBox.w,tailBox.h),tc=tail.getContext('2d');
    tc.drawImage(clean,-tailBox.x,-tailBox.y);
    function prepareBase(image) {
      const out=createCanvas(W,W),c=out.getContext('2d');c.drawImage(image,0,0);
      c.globalCompositeOperation='destination-out';c.drawImage(headMask,0,0);c.globalCompositeOperation='source-over';
      const backing=createCanvas(W,W),bc=backing.getContext('2d');bc.drawImage(machine,0,0,W,W);
      bc.globalCompositeOperation='destination-in';bc.drawImage(headMask,0,0);bc.globalCompositeOperation='source-over';
      c.globalCompositeOperation='destination-over';c.drawImage(backing,0,0);c.globalCompositeOperation='source-over';c.drawImage(neck,0,0);
      c.clearRect(tailBox.x,tailBox.y,tailBox.w,tailBox.h);
      return out;
    }
    function drawTail(ctx,pose) {
      const happy=pose.happyAmount||0;
      const wag=Number.isFinite(pose.tailWag)?pose.tailWag:happy*Math.sin((pose.roundTime-4.35)*Math.PI*4);
      for(let y=0;y<tailBox.h;y+=2){
        const weight=Math.pow(clamp((176-y)/150,0,1),1.4),dx=14*wag*weight;
        ctx.drawImage(tail,0,y,tailBox.w,Math.min(2,tailBox.h-y),tailBox.x+dx,tailBox.y+y,tailBox.w,Math.min(2,tailBox.h-y));
      }
    }
    function drawHead(ctx,pose,eye) {
      const happy=pose.happyAmount||0,blink=Math.max(pose.blinkAmount||0,happy);
      ctx.save();ctx.translate(headPivot[0],headPivot[1]+(pose.headOffsetY||0));ctx.rotate(pose.headAngle||0);ctx.translate(-headPivot[0],-headPivot[1]);
      ctx.drawImage(head,0,0);
      const open=1-blink;
      if(open>.12){ctx.save();ctx.translate(649.5,531);ctx.scale(1,Math.max(.08,open));ctx.drawImage(eye,628-649.5,496-531);ctx.restore();}
      if(blink>.45){ctx.save();ctx.globalAlpha=clamp((blink-.45)/.55,0,1);ctx.beginPath();ctx.moveTo(641,532);ctx.quadraticCurveTo(649,happy>.45?521:538,659,531);ctx.lineWidth=5;ctx.lineCap='round';ctx.strokeStyle='#3b211b';ctx.stroke();ctx.restore();}
      if(happy>.03||pose.chewAmount>0){
        const chew=pose.chewAmount||0;
        ctx.save();ctx.globalAlpha=Math.max(happy,chew);ctx.strokeStyle='#3b211b';ctx.fillStyle='#6c3930';ctx.lineWidth=4.5;ctx.lineCap='round';
        if(chew>.1){ctx.beginPath();ctx.ellipse(680,600,5,1.5+chew*2.6,-.15,0,Math.PI*2);ctx.fill();}
        ctx.beginPath();ctx.moveTo(666,601);ctx.quadraticCurveTo(674,607+chew*2,682,600);ctx.stroke();ctx.restore();
      }
      ctx.restore();
    }
    return {prepareBase,drawTail,drawHead,head,headMask,tail,headPivot};
  }
  const api={create};root.SlotCatCharacterMotion=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
