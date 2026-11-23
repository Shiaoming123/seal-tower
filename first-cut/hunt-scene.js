/* All positions below are in a fixed-height stage. The camera widens on landscape. */
window.HuntScene=(()=>{
  "use strict";
  const grips={knife:[24,74,88,8],hook:[28,76,76,35],buckler:[46,47,78,59]};
  const cuts={
    "hero-ready":[[113,73],[117,73],[164,-3],[176,-3],[176,8],[129,74],[131,78],[129,83],[121,81],[114,78]],
    "hero-thrust":[[220.7,34],[312,32],[312,52],[221.5,52],[220.7,48]],
    "hero-recover":[[125,64],[131,63],[137,-3],[150,-3],[141,64],[145,66],[144,73],[137,73],[126,71]]
  };
  const hands={"hero-ready":[119,83],"hero-thrust":[215,42],"hero-recover":[132,75]};
  const cleaned=new Map();
  function unarmed(f){
    if(cleaned.has(f.key))return cleaned.get(f.key);
    const pic=TowerSprites.get(f.key),layer=document.createElement("canvas");layer.width=pic.width;layer.height=pic.height;
    const c=layer.getContext("2d");c.drawImage(pic,0,0);
    c.scale(pic.width/f.w,pic.height/f.h);c.globalCompositeOperation="destination-out";c.beginPath();
    cuts[f.key].forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
    cleaned.set(f.key,layer);return layer;
  }
  function ease(a,b,t){const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u)}
  // Rigid above the belt, planted below the knees. Only the folds between them flex.
  function bendPoint(x,y,lean){
    const a=lean*(1-ease(62,132,y)),co=Math.cos(a),si=Math.sin(a);
    return [113+(x-113)*co-(y-86)*si,86+(x-113)*si+(y-86)*co];
  }
  const bentPoses=new Map();
  function bentHunter(f,angle){
    const key=Math.round(angle*160);
    if(bentPoses.has(key))return bentPoses.get(key);
    const im=unarmed(f),layer=document.createElement("canvas"),pad=50;
    layer.width=(f.w+2*pad)*1.5;layer.height=(f.h+2*pad)*1.5;
    const ctx=layer.getContext("2d");ctx.scale(1.5,1.5);ctx.translate(pad,pad);
    const ys=[0,62,78,96,114,132,f.h],xs=[0,80,150,223,f.w];
    function tri(src,dst){
      const [a,b,c]=src,[A,B,C]=dst,dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],det=dx*ey-dy*ex;
      const l=((B[0]-A[0])*ey-(C[0]-A[0])*dy)/det,m=((C[0]-A[0])*dx-(B[0]-A[0])*ex)/det;
      const n=((B[1]-A[1])*ey-(C[1]-A[1])*dy)/det,o=((C[1]-A[1])*dx-(B[1]-A[1])*ex)/det;
      ctx.save();ctx.transform(l,n,m,o,A[0]-l*a[0]-m*a[1],A[1]-n*a[0]-o*a[1]);
      const cx=(a[0]+b[0]+c[0])/3,cy=(a[1]+b[1]+c[1])/3;ctx.beginPath();
      src.forEach(([x,y],i)=>{const len=Math.hypot(x-cx,y-cy)||1;const u=x+.9*(x-cx)/len,v=y+.9*(y-cy)/len;if(i)ctx.lineTo(u,v);else ctx.moveTo(u,v)});ctx.closePath();ctx.clip();
      ctx.drawImage(im,0,0,f.w,f.h);ctx.restore();
    }
    for(let i=1;i<ys.length;i++)for(let j=1;j<xs.length;j++){
      const a=[xs[j-1],ys[i-1]],b=[xs[j],ys[i-1]],c=[xs[j-1],ys[i]],d=[xs[j],ys[i]];
      for(const pts of [[a,b,c],[b,d,c]])tri(pts,pts.map(([x,y])=>bendPoint(x,y,key/160)));
    }
    if(bentPoses.size>=18)bentPoses.delete(bentPoses.keys().next().value);
    bentPoses.set(key,layer);return layer;
  }
  function drawHunter(c,weapon,p,guard,t,goal){
    const drive=ease(.13,.40,p)*(1-ease(.54,.74,p));
    const brace=guard?ease(.11,.33,p)*(1-ease(.93,1,p)):0;
    const pressing=guard?brace:drive;
    // The palm, actual pointed end (or shield rim) and feet are separate anchors.
    // The torso drops for a low quarry; the metal tool keeps its rigid proportions.
    const o=BattleSprites.pose(pressing>.01?.47:p,t,false,goal),f=o.f;
    const [hx,hy]=hands[f.key],tool=grips[weapon]?weapon:"knife",[gx,gy,tx,ty]=grips[tool];
    const width=tool==="buckler"?66:tool==="hook"?87:69;
    const idleAngle=tool==="buckler"?.14:Math.atan2(f.tip[1]-hy,f.tip[0]-hx)-Math.atan2(ty-gy,tx-gx);
    const aim=goal.y>228?.48:goal.y>185?.16:-.14;
    const actionAngle=tool==="buckler"?.11:aim-Math.atan2(ty-gy,tx-gx);
    const angle=idleAngle+(actionAngle-idleAngle)*pressing;
    const vx=(tx-gx)*width/96,vy=(ty-gy)*width/96;
    const tipX=vx*Math.cos(angle)-vy*Math.sin(angle),tipY=vx*Math.sin(angle)+vy*Math.cos(angle);
    const targetY=goal.y-290+f.foot[1]-tipY;
    let low=-.45,high=.68;
    for(let i=0;i<12;i++){const mid=(low+high)/2;if(bendPoint(hx,hy,mid)[1]<targetY)low=mid;else high=mid}
    const lean=f.key==="hero-thrust"?Math.round((low+high)*.5*pressing*160)/160:0;
    const [px,py]=lean?bendPoint(hx,hy,lean):[hx,hy];
    const reach=px-f.foot[0]+tipX;
    const baseX=197+(guard?0:(goal.x-reach-197)*drive);
    const palmX=baseX+px-f.foot[0],palmY=290+py-f.foot[1];
    function arm(){
      c.save();c.translate(palmX,palmY);c.rotate(angle);
      HuntArt.drawItem(c,tool,(48-gx)*width/96,(48-gy)*width/96,width);c.restore();
    }
    c.save();
    if(tool!=="buckler")arm();
    if(lean)c.drawImage(bentHunter(f,lean),baseX-f.foot[0]-50,290-f.foot[1]-50,f.w+100,f.h+100);
    else c.drawImage(unarmed(f),baseX-f.foot[0],290-f.foot[1],f.w,f.h);
    if(tool==="buckler")arm();
    c.restore();
    return {x:palmX+tipX,y:palmY+tipY,shin:{x:baseX+44,y:253},footX:baseX};
  }
  const quarryFrames=new Map();
  function paintedQuarry(fox,part){
    const key=(fox?"fox":"moth")+part;
    if(quarryFrames.has(key))return quarryFrames.get(key);
    const pic=TowerSprites.get(fox?"warden":"moth");
    const layer=document.createElement("canvas");layer.width=pic.width;layer.height=pic.height;
    const g=layer.getContext("2d");g.drawImage(pic,0,0);
    if(fox){
      g.save();g.scale(pic.width/978,pic.height/654);g.translate(349,406);
      g.beginPath();for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4;const x=46*Math.cos(a),y=46*Math.sin(a);if(i)g.lineTo(x,y);else g.moveTo(x,y)}g.closePath();
      g.fillStyle="#483b34";g.fill();g.strokeStyle="#756449";g.lineWidth=4;g.stroke();
      g.beginPath();g.ellipse(0,1,31,33,-.12,0,Math.PI*2);g.fillStyle="#283432";g.fill();g.strokeStyle="#8a7756";g.lineWidth=3;g.stroke();
      for(const [x,y] of [[-22,-13],[20,-15],[-1,23]]){g.fillStyle="#171d1f";g.fillRect(x-3,y-3,6,6);g.fillStyle="#a18e62";g.fillRect(x-3,y+3,5,1)}
      if(part==="full"||part==="chipped"){
        g.save();
        if(part==="chipped"){g.beginPath();g.moveTo(-52,-52);g.lineTo(9,-52);g.lineTo(5,-20);g.lineTo(20,-11);g.lineTo(13,-1);g.lineTo(52,10);g.lineTo(52,52);g.lineTo(-52,52);g.closePath();g.clip()}
        HuntArt.drawItem(g,"clasp",0,-1,99);g.restore();
        if(part==="chipped"){g.beginPath();g.moveTo(5,-20);g.lineTo(17,-11);g.lineTo(11,-1);g.lineTo(23,3);g.strokeStyle="#d0aa6c";g.lineWidth=2;g.stroke()}
      }
      g.restore();
    }else if(part!=="full"){
      // Preserve the painted brass ribs and embroidery; only the luminous paper darkens.
      g.save();g.scale(pic.width/711,pic.height/717);
      const bulb=new Path2D("M245 393 Q303 375 356 405 Q418 430 419 489 Q417 541 359 568 Q310 587 253 565 Q198 552 191 506 Q181 448 218 418Z");
      g.clip(bulb);g.fillStyle="rgba(25,44,45,.80)";g.fill(bulb);g.restore();
    }
    quarryFrames.set(key,layer);return layer;
  }
  function drawQuarry(c,fox,x,y,t,part,hurt,reduced){
    const im=paintedQuarry(fox,part);
    const w=fox?326*.88*.81:237*.80*.80,h=fox?218*.88*.81:239*.80*.80;
    const ax=(fox?116/326:102/237)*w,ay=(fox?134.8/218:162/239)*h;
    const pulse=reduced?0:Math.sin(t*(fox?2.2:5.6));
    // The lantern and the fox's collar stay on their own painting as it breathes.
    const bands=18;
    for(let i=0;i<bands;i++){
      const top=Math.round(im.height*i/bands),end=Math.round(im.height*(i+1)/bands);
      const u=i/bands,sway=fox?.022*(1-u)*pulse:.085*Math.max(0,1-u*1.7)*(pulse-hurt*.7);
      const k=1+sway;c.drawImage(im,0,top,im.width,end-top,x-ax*k,y-ay+h*top/im.height,w*k,h*(end-top)/im.height+.15);
    }
  }
  function cover(c,img,w,h,focus=.5){
    const k=Math.max(w/img.width,h/img.height),dw=img.width*k,dh=img.height*k;
    c.drawImage(img,(w-dw)*focus,(h-dh)*.54,dw,dh);
  }
  function shadow(c,x,y,rx,ry){
    c.save();c.translate(x,y);c.scale(rx,ry);
    const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,"#12201ecd");g.addColorStop(1,"#111d1e00");
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  function install(canvas,onEnemy){
    const c=canvas.getContext("2d",{alpha:false}),tmp=document.createElement("canvas"),ec=tmp.getContext("2d",{willReadFrequently:true});

    const media=matchMedia("(prefers-reduced-motion: reduce)");
    let v=null,fx=null,running=false,last=0,clock=0,raf=0,scale=1,width=640,height=300,mask=false,pointer=null,stopped=false;
    function paint(now){
      if(!v||!canvas.clientWidth||!canvas.clientHeight)return;
      const ratio=canvas.clientWidth/canvas.clientHeight;
      width=Math.max(180,Math.round(height*ratio));scale=Math.min(devicePixelRatio||1,1.5,1280/width);
      const pw=Math.round(width*scale),ph=Math.round(height*scale);
      if(canvas.width!==pw||canvas.height!==ph){canvas.width=tmp.width=pw;canvas.height=tmp.height=ph}
      c.setTransform(pw/width,0,0,ph/height,0,0);c.imageSmoothingEnabled=false;
      ec.setTransform(pw/width,0,0,ph/height,0,0);ec.imageSmoothingEnabled=false;
      ec.clearRect(0,0,width,height);mask=false;
      const reduced=media.matches,t=reduced?0:clock,p=fx?Math.max(0,Math.min(1,(now-fx.start)/fx.duration)):-1;
      const battle=v.phase==="fight",loot=v.phase==="loot",inside=["contract","gear","market","settle","done"].includes(v.phase);
      if(inside){
        cover(c,TowerSprites.get("shop-wall"),width,height);
        const k=Math.min(.86,width/435),top=17;
        c.save();c.translate(width*.60-606*k,top-61*k);c.scale(k,k);
        FoxArt.draw(c,{mode:"bazaar",t,reduced});c.restore();
        const wood=TowerSprites.get("counter"),edge=height*.82;
        c.fillStyle="#765232";c.fillRect(0,edge-2,width,height-edge+2);
        for(let i=0;i<32;i++){
          const u=i/32,near=(i+1)/32,row=edge+(height-edge)*u;
          const w=width*(1+.20*u);
          c.drawImage(wood,0,u*wood.height,wood.width,wood.height/32,(width-w)/2,row,w,(height-edge)*(near-u)+1);
        }
        const wares=v.phase==="gear"?["knife","hook","buckler"]:v.phase==="market"?["ash","plate","shell"]:
          v.phase==="contract"?["ash","clasp"]:Object.keys(v.items).filter(id=>v.items[id]>0);
        if(v.counterStock!==false)wares.forEach((id,i)=>{
          const x=width*.32+(i-(wares.length-1)/2)*Math.min(width*.125,58),y=edge+19,size=id==="hook"||id==="knife"?45:32;
          shadow(c,x,y+8,size*.48,3);HuntArt.drawItem(c,id,x,y,size);
        });
        return;
      }
      const foe=v.foe,kind=foe?.id||v.loot?.enemy;
      const background=kind==="fox"?"gate":kind==="rat"?"escort-road-3":v.phase==="route"?"escort-road":"hall";
      cover(c,TowerSprites.get(background),width,height);
      const unit=Math.min(.95,width/568),foot=height*.93;
      // Anchor both characters on the road. Their shadows stay on that plane during recoil.
      const hx=width*.29,ex=width*.69;
      const heroOrigin=hx-197*unit,heroTop=foot-290*unit;
      const goalY=kind==="rat"?242:kind==="fox"?(v.weapon==="buckler"?239:224):166;
      const goalX=(ex-heroOrigin)/unit;
      const markX=goalX+(kind==="rat"?(v.weapon==="buckler"?-51:-23):kind==="fox"?(v.weapon==="buckler"?-69:-11):-3);
      if(!reduced){
        for(let i=0;i<13;i++){
          const x=(i*71+t*(i%3+1))%width,y=(271+i*27-t*(i%4+2))%292;
          c.fillStyle=i%3?"#e7d1a166":"#fbecc999";c.fillRect(Math.round(x),Math.round((y+292)%292),1+i%2,1);
        }
      }
      const swing=fx&&fx.id==="strike",guard=fx&&fx.id==="guard";
      const actionP=reduced&&fx?(p<.63?.44:.81):p;
      const playerP=swing||guard?actionP:-1;
      const advance=swing?ease(.13,.4,playerP)*(1-ease(.54,.74,playerP)):0;
      shadow(c,hx+advance*(markX-197-129)*unit,foot+1,55*unit,5*unit);
      c.save();c.translate(heroOrigin,heroTop);c.scale(unit,unit);
      const hunter=drawHunter(c,v.weapon,playerP,guard,t,{x:markX,y:goalY});c.restore();
      if(battle){
        const hurt=swing&&actionP>.36&&actionP<.61;
        const reply=fx&&actionP>.61&&actionP<.99&&fx.after.phase==="fight";
        const jump=reply?ease(.61,.77,actionP)*(1-ease(.85,.99,actionP)):0;
        const blocked=guard||(fx?.id==="flare"&&v.plate);
        const receiver=guard?hunter:hunter.shin;
        ec.save();ec.translate(heroOrigin,heroTop);ec.scale(unit,unit);
        if(kind==="rat"){
          const stealing=foe.intent.includes("伸爪");
          const mx=goalX+(receiver.x+82-goalX)*jump;
          const my=289+(receiver.y+28-289)*jump-13*Math.sin(jump*Math.PI);
          const telegraph=stealing||foe.damage>=4;
          const pose=hurt?"hit":reply?"attack":telegraph?"warn":"idle";
          const moment=hurt?.15:reply?(jump*3+.1)/14:telegraph?(3.5+.9*Math.sin(t*4))/8:t;
          HuntArt.drawBeast(ec,"rat",mx,my,208,moment,pose,reduced);
          if(stealing&&!hurt&&!reply){
            // The near paw comes out below the muzzle; three tiny claws rake the grit.
            const reach=reduced?1:(1+Math.sin(t*3))*.5;
            ec.save();ec.translate(mx-34,my-28);
            const px=-33-15*reach;
            ec.beginPath();ec.moveTo(0,0);ec.quadraticCurveTo(-10,15,-19,13);ec.lineTo(px,12+2*reach);
            ec.lineCap="round";ec.lineJoin="round";ec.strokeStyle="#312933";ec.lineWidth=5;ec.stroke();ec.strokeStyle="#9c8076";ec.lineWidth=2.8;ec.stroke();
            ec.strokeStyle="#e9c399";ec.lineWidth=1;for(let i=0;i<3;i++){ec.beginPath();ec.moveTo(px+1,12+i);ec.lineTo(px-4+i,13+i*1.5);ec.stroke()}
            ec.restore();
          }
        }else{
          const fox=kind==="fox";
          const current=fx&&actionP>(guard?.76:.41)&&fx.after.foe?.id===kind?fx.after.foe:foe;
          const part=fox?(current.clasp==="挂在颈下"?"full":current.clasp==="缺了一角"?"chipped":"empty"):(current.core?"full":"empty");
          const x=goalX+(receiver.x+(fox?69:55)-goalX)*jump;
          const homeY=fox?225:167+(reduced?0:Math.sin(t*3)*2);
          const y=homeY+(receiver.y-(fox?19:-28)-homeY)*jump-10*Math.sin(Math.PI*jump);
          shadow(c,heroOrigin+x*unit,foot+1,(fox?69:39)*unit,(fox?5:3)*unit);
          drawQuarry(ec,fox,x,y,t,part,hurt?1:0,reduced);
        }
        ec.restore();c.drawImage(tmp,0,0,width,height);mask=true;
        const impactY=heroTop+goalY*unit;
        const spark=fx&&((swing&&actionP>.38&&actionP<.58)||(reply&&jump>.90));
        if(spark||fx?.id==="flare"&&p>.28&&p<.62){
          const counterHit=reply&&jump>.90;
          const touch=counterHit?receiver:hunter;
          const ix=heroOrigin+touch.x*unit,iy=heroTop+touch.y*unit;
          const u=Math.max(0,Math.min(1,(p-.28)/.34));
          c.save();c.strokeStyle=counterHit&&blocked?"#88dfcc":fx.id==="flare"?"#f1c260":"#ffe4a1";c.lineWidth=Math.max(1,1.8*unit);
          c.beginPath();
          if(fx.id==="flare"&&!counterHit)c.ellipse(ex,impactY,28*unit,38*unit,0,0,2*Math.PI);
          else for(const [dx,dy] of [[-8,-7],[3,-9],[8,3],[-4,7]]){c.moveTo(ix+dx*unit*.35,iy+dy*unit*.35);c.lineTo(ix+dx*unit,iy+dy*unit)}
          c.stroke();c.restore();
          if(fx.id==="flare"&&!reduced){
            for(let i=0;i<12;i++){c.fillStyle=i%2?"#e2bd75":"#a89267";const x=hx+(ex-hx)*Math.min(1,2*u)+(i-6)*u*4;c.fillRect(x,impactY+Math.sin(i*3+u*4)*17*u,2,2)}
          }
        }
        if(fx&&p>.4&&p<.93){
          const afterHp=fx.after.foe?.id===kind?fx.after.foe.hp:(fx.after.phase==="loot"?0:foe.hp);
          const dmg=foe.hp-afterHp;
          if(dmg>0){c.save();c.font='bold 22px "Tower Ledger",serif';c.lineWidth=4;c.strokeStyle="#32251e";c.fillStyle="#ffe5a1";
            const y=impactY-(32+(reduced?0:18*p))*unit;c.strokeText("−"+dmg,ex,y);c.fillText("−"+dmg,ex,y);c.restore()}
        }
      }else if(loot||v.phase==="gather"){
        const obj=loot?v.loot?.id:"ash";
        if(obj&&(!loot||v.loot.qty)){shadow(c,ex,foot,26*unit,5*unit);HuntArt.drawItem(c,obj,ex,foot-20*unit,46*unit)}
        if(loot&&v.offer)HuntArt.drawItem(c,v.offer.id,ex+57*unit,foot-21*unit,55*unit);
      }
    }
    function loop(now){
      raf=0;if(!running||document.hidden||stopped)return;
      if(!last||now-last>=1000/(media.matches?8:30)-1){
        if(last)clock+=Math.min(.12,(now-last)/1000);
        last=now;paint(now);
      }
      raf=requestAnimationFrame(loop);
    }
    function wake(){if(!raf&&running&&!stopped&&!document.hidden)raf=requestAnimationFrame(loop)}
    function hit(e){
      if(!mask||fx||stopped)return false;
      const b=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-b.left)*tmp.width/b.width),y=Math.floor((e.clientY-b.top)*tmp.height/b.height);
      return x>=0&&y>=0&&x<tmp.width&&y<tmp.height&&ec.getImageData(x,y,1,1).data[3]>60;
    }
    canvas.addEventListener("pointerdown",e=>{pointer=e.isPrimary&&hit(e)?{id:e.pointerId,x:e.clientX,y:e.clientY}:null});
    canvas.addEventListener("pointerup",e=>{const start=pointer;pointer=null;if(start?.id===e.pointerId&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<12&&hit(e))onEnemy()});
    canvas.addEventListener("pointercancel",()=>{pointer=null});
    document.addEventListener("visibilitychange",()=>{last=0;wake()});
    new ResizeObserver(()=>{if(v)paint(performance.now())}).observe(canvas);
    return {show(view,anim=null){v=view;fx=anim;pointer=null;running=true;paint(performance.now());wake()},
      pause(value){stopped=value;last=0;if(value){cancelAnimationFrame(raf);raf=0}else wake()}};
  }
  return {install,quarryImage:(id,part)=>paintedQuarry(id==="fox",part)};
})();
