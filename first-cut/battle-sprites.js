// Poses use world units. Each trimmed painting is sampled at its own native resolution.
window.BattleSprites=(()=>{
  "use strict";
  const get=key=>window.TowerSprites.get(key);
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t)};
  const ready={key:"hero-ready",w:175,h:216,foot:[90,214],tip:[168,2],hilt:[120,79]};
  const thrust={key:"hero-thrust",w:311,h:156,foot:[117,154.7],tip:[309.8,43.1],hilt:[225,43.5]};
  const recover={key:"hero-recover",w:183,h:231,foot:[91,229],tip:[142,1.5],hilt:[137,68]};
  const cache=new Map();
  const enemies={
    warden:{w:326,h:218,ax:116,ay:134.8,scale:.88},
    moth:{w:237,h:239,ax:102,ay:162,scale:.80}
  };
  let lastEnemy=null;
  function tint(img,key,color){
    if(cache.has(key))return cache.get(key);
    const a=document.createElement("canvas");a.width=img.naturalWidth||img.width;a.height=img.naturalHeight||img.height;
    const c=a.getContext("2d");c.drawImage(img,0,0);c.globalCompositeOperation="source-in";
    c.fillStyle=color;c.fillRect(0,0,a.width,a.height);cache.set(key,a);return a;
  }
  function pose(p,t,guard,goal){
    const wind=ease(0,.22,p)*(1-ease(.25,.40,p)),u=guard?0:ease(.24,.411,p)*(1-ease(.59,.95,p));
    const f=guard?(p>.22&&p<.78?recover:ready):p<.32?ready:p<.67?thrust:p<.94?recover:ready;
    const dx=thrust.tip[0]-thrust.foot[0],dy=thrust.tip[1]-thrust.foot[1];
    // Aim the thrust from the planted foot. The fox's shoulder sits below the paper lantern.
    const bend=f===thrust?Math.max(0,goal.y-171.64):0;
    const endY=goal.y-dy-Math.max(0,goal.y-171.64);
    let ang=f===thrust?-.12*(1-u):f===recover?-.11*(1-ease(.70,.92,p)):-.060*wind;
    const breath=p<0?Math.sin(t*2.75):0;
    if(guard)ang+=.062*Math.sin(Math.PI*clamp(p));
    const x=197-8*wind+(goal.x-dx-197)*u,y=290+(endY-290)*u;
    const sx=1+(guard?.012*Math.sin(Math.PI*clamp(p)):0),sy=1+.0055*breath-.031*wind;
    const point=([px,py])=>{const vx=(px-f.foot[0])*sx,vy=(py+bladeBend(px,py,bend)-f.foot[1])*sy;
      return {x:Math.round((x+vx*Math.cos(ang)-vy*Math.sin(ang))*10000)/10000,y:Math.round((y+vx*Math.sin(ang)+vy*Math.cos(ang))*10000)/10000}};
    return {x,y,f,ang,sx,sy,bend,tip:point(f.tip),hilt:point(f.hilt)};
  }
  function bladeBend(x,y,amount){
    return amount*clamp((x-150)/(thrust.tip[0]-150))*clamp((155-y)/70);
  }
  // Aim the arm and blade down for a quadruped; the shoes keep both contact points.
  function bentFrame(img,amount){
    if(!amount)return img;
    const key="thrust-bent-"+amount;if(cache.has(key))return cache.get(key);
    const a=document.createElement("canvas");a.width=img.naturalWidth;a.height=img.naturalHeight;
    const ctx=a.getContext("2d");ctx.imageSmoothingEnabled=false;
    const densityX=a.width/thrust.w,densityY=a.height/thrust.h;
    const cut=Math.round(85*densityY);
    // Adjacent columns share the same vertical shift; submit each run once.
    const offset=x=>Math.round(bladeBend(x/densityX,85,amount)*densityY);
    let start=0,off=offset(0);
    for(let x=1;x<=a.width;x++){
      const next=offset(x);
      if(x<a.width&&next===off)continue;
      const width=x-start;
      ctx.drawImage(img,start,0,width,cut,start,off,width,cut);
      ctx.drawImage(img,start,cut,width,a.height-cut,start,cut+off,width,a.height-cut-off);
      start=x;off=next;
    }
    cache.set(key,a);return a;
  }
  function cast(c,img,key,o,fx,fy,w,h,alpha,skew,compression){
    const shade=tint(img,key+"-shadow","#10212a");
    c.save();c.globalAlpha*=alpha;c.translate(o.x,o.y+1);
    c.transform(1,0,skew,compression,0,0);c.rotate(o.ang||0);c.scale(o.sx||1,o.sy||1);
    c.drawImage(shade,-fx,-fy,w,h);c.restore();
  }
  function hero(c,o){
    const {f}=o,source=get(f.key);if(!source)return;
    const img=bentFrame(source,o.bend);
    cast(c,img,f.key+(o.bend?"-aimed":""),o,...f.foot,f.w,f.h,.46,.36,-.115);
    c.save();c.translate(o.x,o.y);c.rotate(o.ang);c.scale(o.sx,o.sy);
    c.drawImage(img,-f.foot[0],-f.foot[1],f.w,f.h);c.restore();
  }
  // A single source alpha mask serves all poses. Only the most recently drawn rows
  // are inverted for a pointer event; animation never reads back the visible canvas.
  function enemyBuffer(img,key,f){
    if(cache.has(key))return cache.get(key);
    const dx=img.naturalWidth/f.w,dy=img.naturalHeight/f.h,pad=Math.ceil(28*dx);
    const canvas=document.createElement("canvas");
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);
    const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const alpha=new Uint8Array(canvas.width*canvas.height);
    for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
    canvas.width+=2*pad;
    const rows=[];
    const bandHeight=Math.max(1,Math.round(2*dy));
    for(let row=0;row<canvas.height;row+=bandHeight)rows.push({row,height:Math.min(bandHeight,canvas.height-row),left:0,width:0});
    const buf={canvas,ctx,alpha,rows,pad,dx,dy,bandHeight,srcWidth:img.naturalWidth};
    cache.set(key,buf);return buf;
  }
  function hitEnemy(x,y){
    if(!lastEnemy)return false;
    const {left,top,scale,buf}=lastEnemy;
    const py=Math.floor((y-top)*buf.dy/scale);
    if(py<0||py>=buf.canvas.height)return false;
    const row=buf.rows[Math.floor(py/buf.bandHeight)];
    const px=Math.floor(((x-left)*buf.dx/scale-row.left)*buf.srcWidth/row.width);
    return px>=0&&px<buf.srcWidth&&buf.alpha[py*buf.srcWidth+px]>=48;
  }
  function enemy(c,s){
    const fox=s.floor===2,key=fox?"warden":"moth",img=get(key);
    if(!img)return;
    const f=enemies[key],{ax,ay,w,h}=f,scale=f.scale*(s.fit??1);
    const pulse=Math.sin(fox?s.t*2.1:s.t*6.2);
    const hitFold=s.taking&&s.p>=.43?.82*(1-ease(.435,.60,s.p)):0;
    const react=Math.max(hitFold,s.recoil);
    const ground=fox?s.y+(h-ay)*scale:263;
    cast(c,img,key,{x:s.x+(fox?0:10),y:ground,sx:scale,sy:scale},ax,h,w,h,fox?.55:.21,fox?.31:.15,-.09);
    const buf=enemyBuffer(img,key,f),{canvas,ctx,rows,pad,dx,dy}=buf;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=false;
    const fold=s.reduced?0:pulse*.105-.37*react-(s.heavy?.07:0);
    let leftmost=Infinity,rightmost=-Infinity;
    for(const band of rows){
      const y=band.row/dy;
      const u=fox?clamp((106-y)/92):clamp((ay-14-y)/127);
      const k=fox?1+u*.044*pulse-(s.taking?react:0)*clamp((215-y)/100)*.073:1+fold*u;
      const drift=fox?u*9*Math.sin(s.t*2+y*.009):u*u*fold*45;
      band.left=Math.round(pad+(ax*(1-k)+drift)*dx);
      band.width=Math.round(img.naturalWidth*k);
      ctx.drawImage(img,0,band.row,img.naturalWidth,band.height,band.left,band.row,band.width,band.height);
      leftmost=Math.min(leftmost,band.left);rightmost=Math.max(rightmost,band.left+band.width);
    }
    const left=s.x-(ax+pad/dx)*scale,top=s.y-ay*scale;
    if(c.globalAlpha>=.18)lastEnemy={buf,scale,left,top};
    c.drawImage(canvas,left,top,canvas.width/dx*scale,h*scale);
    c.save();c.translate(s.x,s.y);
    if(s.taking&&s.p>=.43&&s.p<.56){
      const age=clamp((s.p-.43)/.13),r=(fox?13:14)*(1-age);
      c.fillStyle="rgba(255,237,173,"+(.48*(1-age))+")";
      c.beginPath();c.ellipse(0,0,Math.max(1,r),Math.max(1,r*.88),0,0,Math.PI*2);c.fill();
    }
    c.restore();
    return {x:left+(leftmost+rightmost)*.5*scale/dx,y:top+h*scale*.5,rx:(rightmost-leftmost)*.5*scale/dx,ry:h*scale*.5};
  }
  function backdrop(c,floor,t,reduced){
    lastEnemy=null;
    const night=floor===2,img=get(night?"gate":"hall");
    if(img){c.drawImage(img,0,0,640,360)}else{CutHall.draw(c,{width:640,height:360,t,reduced})}
    c.fillStyle=night?"rgba(13,24,31,.20)":"rgba(13,24,29,.10)";c.fillRect(0,0,640,360);
    if(reduced)t=0;
    if(night){
      // Wet paving breaks the warm side-lantern reflections into fine moving slivers.
      for(const lx of [24,191,543,594])for(let k=0;k<5;k++){
        const y=265+k*12+(lx%7),pulse=(Math.sin(t*2.3+lx+k*.94)+1)*.5;
        c.fillStyle="rgba(255,201,122,"+(.05+.10*pulse)+")";
        c.fillRect(Math.round(lx+Math.sin(k*2.6+t)*3),y,Math.round(2+(k+1)*pulse),1);
      }
      c.save();c.lineWidth=1;
      for(let i=0;i<49;i++){
        const x=((i*97.37-t*(11+i%4))%673+673)%673,y=(i*41.7+t*(98+i%7*8))%391-20;
        if(y>258){c.fillStyle="#abbdac30";c.fillRect(Math.round(x-3),Math.round(y),4+i%3,1);continue}
        c.strokeStyle=i%4?"#a2b8ad48":"#ccd2bf6b";c.beginPath();c.moveTo(Math.round(x),Math.round(y));c.lineTo(Math.round(x)-2,Math.round(y)+4+i%4);c.stroke();
      }
      c.restore();
    }else{
      for(let i=0;i<15;i++){
        const x=(i*93+Math.sin(t*.45+i)*5)%640,y=70+(i*41+t*(1+i%3))%190;
        c.fillStyle=i%3?"#aabfa955":"#fbd59499";c.fillRect(Math.round(x),Math.round(y),i%5===0?2:1,1);
      }
    }
  }
  return {pose,hero,enemy,backdrop,hitEnemy};
})();
