/* The action studies call the same camera, staging and drawing pass as each playable strike. */
window.CutScene = (() => {
  "use strict";
  const {line,poly,diamond,digits}=CutInk;
  const footY=290,home=197,lampX=450,contact=.43;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const ease=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u)};
  function shadow(c,x,y,w,h){
    for(let j=-h;j<=h;j++){
      const length=Math.floor(w*Math.sqrt(Math.max(0,1-(j/h)**2)));
      c.fillStyle=Math.abs(j)<h*.4?"#0c2028a8":"#11202c53";c.fillRect(Math.round(x)-length,y+j,length*2,1);
    }
  }
  function stancePose(p,t,guard,goal){
    const pose=BattleSprites.pose(p,t,guard,goal);
    if(goal.low){
      const thrust=guard?0:ease(.24,.411,p)*(1-ease(.59,.95,p)),dx=-57*(1-thrust);
      pose.x+=dx;pose.hilt.x+=dx;pose.tip.x+=dx;
    }
    return pose;
  }
  function trail(c,p,t,focus,goal,hero) {
    if(p<.27||p>.47)return;
    // A hand-drawn pose change is a cut. Do not connect the raised blade in
    // the previous painting to the forward blade in the next painting.
    const samples=[hero];
    for(let i=1;i<=6;i++){
      const past=stancePose(p-i*.009,t,false,goal);
      if(past.f!==hero.f)break;
      samples.unshift(past);
    }
    const tail=samples[0].tip,head=hero.tip;
    const length=Math.hypot(head.x-tail.x,head.y-tail.y);
    if(samples.length<3||length<1.5)return;
    const ink=c.createLinearGradient(tail.x,tail.y,head.x,head.y);
    const rgb=focus?"243,200,114":"209,232,224";
    ink.addColorStop(0,"rgba("+rgb+",0)");
    ink.addColorStop(.58,"rgba("+rgb+",.38)");
    ink.addColorStop(1,"rgba("+rgb+",.76)");
    c.save();c.fillStyle=ink;c.globalAlpha=1-ease(contact,.47,p);
    c.beginPath();c.moveTo(tail.x,tail.y);
    // One edge lies on the sampled tip path. The other follows the local
    // blade normal, narrowing to zero at both the tail and the live tip.
    for(let i=1;i<samples.length-1;i++){
      const {tip,hilt}=samples[i],dx=tip.x-hilt.x,dy=tip.y-hilt.y;
      const u=i/(samples.length-1);
      const width=Math.sin(Math.PI*u)*(focus?3.8:2.8)/Math.hypot(dx,dy);
      c.lineTo(tip.x+dy*width,tip.y-dx*width);
    }
    c.lineTo(head.x,head.y);
    for(let i=samples.length-2;i>0;i--)c.lineTo(samples[i].tip.x,samples[i].tip.y);
    c.closePath();c.fill();c.restore();
  }
  const impactMaterial={
    paper:{light:"#ffe8ad",mid:"#c9915c",dark:"#70483c",flake:"#e3ce96"},
    inkScale:{light:"#ccdad0",mid:"#91a49a",dark:"#24343e",flake:"#576b69"},
    ember:{light:"#fff1ad",mid:"#e19a4f",dark:"#774c43",flake:"#ecb873"}
  };
  function impact(c,x,y,p,focus=false,material=impactMaterial.paper,angle=0,reduced=false){
    if(p<contact||p>.82)return;
    const age=clamp((p-contact)/.39),flash=1-ease(0,.32,age),fade=1-ease(.4,1,age);
    const strength=focus?1.25:1;
    c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle);c.scale(strength,strength);
    if(flash){
      // Short directional flash: darkest contour first, then the contact flash on the blade axis.
      c.save();c.scale(flash*.65+.35,flash*.65+.35);
      poly(c,[[-24,1],[-5,-2],[-10,-8],[-2,-4],[2,-13],[3,-4],[11,-8],[8,-1],[29,-3],[12,2],[13,5],[4,4],[1,11],[-2,5],[-8,8],[-5,3]],material.dark);
      poly(c,[[-22,1],[-3,-2],[-6,-6],[0,-3],[2,-10],[3,-2],[10,-6],[6,0],[25,-2],[9,2],[3,3],[1,8],[-1,3],[-6,5],[-3,2]],material.light);
      poly(c,[[-17,1],[-1,-1],[2,-5],[3,0],[16,0],[4,2],[1,5],[0,2]],"#fffdef");
      c.restore();
    }
    const wave=ease(0,.80,age);
    if(!reduced&&age>.02&&age<.78){
      // A thin pressure front passes only through the struck side of the target.
      const r=5+wave*22;
      c.globalAlpha=(1-wave)*.8;
      for(const side of [-1,1]){
        line(c,4+wave*5,side*(r*.7),9+wave*8,side*(r*.43),material.mid);
        line(c,9+wave*8,side*(r*.43),11+wave*8,side*(r*.19),material.light);
      }
    }
    const count=reduced?4:focus?15:11;
    for(let i=0;i<count;i++){
      const a=-1.39+((i*47)%119)/118*2.85,travel=(13+(i*19)%37)*age;
      const dx=Math.cos(a),dy=Math.sin(a)*.85;
      const ex=3+dx*travel,ey=dy*travel+age*age*(7+i%5);
      c.globalAlpha=fade;
      line(c,ex-dx*(2+5*fade),ey-dy*(2+5*fade),ex,ey,material.mid,i%4===0?2:1);
      if(i%3!==1)line(c,ex-dx*2,ey-dy*2,ex,ey,material.light);
    }
    // Paper flutters, silver scales and fur-bound amber splinters travel differently.
    for(let i=0;i<(reduced?2:5);i++){
      const t=clamp((age-i*.03)*1.12);
      if(t<=0)continue;
      c.save();c.globalAlpha=1-ease(.45,1,t);
      c.translate(Math.round(4+(17+i*8)*t),Math.round((i%2?1:-1)*(7+i*4)*t+19*t*t));
      c.rotate((i-2)*.7+t*(i%2?2:-3));
      if(material===impactMaterial.inkScale){
        poly(c,[[-5,-1],[-1,-2],[2,-2],[4,0],[3,2],[0,3],[-2,2]],material.dark);
        c.fillStyle=i%2?material.flake:"#a54e44";c.fillRect(0,-1,3,2);
        if(i%2)line(c,-3,-1,-6,-2,"#e3d6aa");
        c.fillStyle=material.light;c.fillRect(0,-1,1,1);
      }else if(material===impactMaterial.ember){
        poly(c,[[-5,0],[-1,-2],[4,-1],[1,1],[-2,2]],material.mid);
        line(c,-2,0,2,-1,material.light);
      }else{
        const fold=.4+.6*Math.abs(Math.cos(t*7+i));
        c.scale(1,fold);poly(c,[[-4,-2],[0,-3],[6,0],[1,3],[-4,2]],material.flake);
        line(c,-3,-1,3,0,material.light);
      }
      c.restore();
    }
    c.restore();
  }

  // Raise the abacus seal above the weapons: the fox already wears round gold beads.
  function countingBeads(c,tip,phase,bonus,reduced){
    if(!bonus || phase<contact || phase>.74)return;
    const t=reduced?0:ease(contact,.74,phase);
    c.save();
    c.translate(Math.round(tip.x-49),Math.round(tip.y-45-5*t));
    c.globalAlpha=1-t*t;
    c.fillStyle="#122c30";c.fillRect(-16,-10,32,21);
    c.strokeStyle="#a4e7ce";c.lineWidth=1;c.strokeRect(-15.5,-9.5,31,19);
    line(c,-15,-10,-8,-10,"#fff0b9");line(c,9,10,15,10,"#dbbd7d");
    line(c,-14,-1,14,-1,"#859d84",2);
    for(let i=0;i<3;i++){
      const x=-9+i*9,lit=i<bonus;
      line(c,x,-8,x,8,"#bcab73");
      const y=lit?Math.round(-5+3*t):4;
      poly(c,[[x-3,y-1],[x-1,y-3],[x+2,y-3],[x+4,y-1],[x+3,y+2],[x-2,y+2]],lit?"#6bdbbd":"#806d47");
      if(lit)line(c,x-1,y-2,x+1,y-2,"#f9f2c4");
    }
    c.restore();
  }
  function weapon(c,hero,id){
    if(id!=="hook"&&id!=="ward-blade")return;
    const h=hero.hilt,t=hero.tip,dx=t.x-h.x,dy=t.y-h.y,len=Math.hypot(dx,dy);
    c.save();c.translate(h.x,h.y);c.rotate(Math.atan2(dy,dx));
    if(id==="ward-blade"){
      // A broad celadon ridge and pierced square bronze quillons echo the stall piece.
      poly(c,[[2,-3],[len*.24,-3.8],[len*.78,-2.7],[len,0],[len*.76,2.7],[len*.22,3.8],[2,3]],"#394f4b");
      poly(c,[[3,-2.5],[len*.24,-3.4],[len*.76,-2.2],[len,0],[len*.28,0]],"#b5c6b0");
      line(c,4,1,len*.76,0,"#709789");line(c,6,-1,len*.46,-1,"#e1e7c8");
      poly(c,[[-3,-10],[1,-12],[6,-11],[6,-5],[3,-3],[3,3],[6,5],[6,11],[1,12],[-3,10],[-2,5],[-1,4],[-1,-4],[-2,-5]],"#554936");
      c.fillStyle="#bb9c65";c.fillRect(-1,-10,6,5);c.fillRect(-1,5,6,5);
      c.fillStyle="#344b43";c.fillRect(1,-9,2,3);c.fillRect(1,6,2,3);
      line(c,0,-10,4,-10,"#f1dcab");line(c,0,10,4,10,"#d4bc86");
      diamond(c,3,0,2,"#b2d2bc");
    }else{
      // The shop blade has a cinnabar crescent on its concave edge. Its forward
      // corner remains the contact tip in both the thrust and the raised guard.
      poly(c,[[2,-1],[len*.57,-2],[len-17,-2],[len-10,-4],[len-5,-8],[len-7,-12],[len-14,-15],[len-8,-16],[len-2,-13],[len,-8],[len,0],[len-6,3],[len-18,2],[3,2]],"#46313a");
      poly(c,[[len-19,-1],[len-12,-3],[len-7,-6],[len-5,-10],[len-8,-13],[len-13,-15],[len-7,-14],[len-3,-11],[len-1,-6],[len-1,0],[len-8,2]],"#a64646");
      line(c,3,1,len-6,1,"#bf8981");line(c,len-13,-15,len-8,-14,"#f4b19c");
      line(c,len-3,-10,len-2,-5,"#e27a65");line(c,len-5,1,len,0,"#f1c3a6");
      line(c,-3,-4,2,4,"#a24841");line(c,-1,-5,4,3,"#d2926b");
    }
    c.restore();
  }
  function ring(c,x,y,q,ready){
    const expired=q>=1&&!ready, r=ready?25:34-q*8;
    const quarter=Math.PI/2,gap=.10;
    c.save();c.translate(Math.round(x),Math.round(y));
    c.lineCap="butt";c.lineJoin="bevel";
    for(let i=0;i<4;i++){
      const start=-quarter+i*quarter+gap,end=start+quarter-gap*2;
      c.beginPath();c.arc(0,0,r,start,end);
      c.lineWidth=4;c.strokeStyle="#10272c";c.stroke();
      c.lineWidth=1.2;c.strokeStyle=expired?"#52706b":"#758f89";c.stroke();
      const amount=ready?1:expired?0:clamp(q*4-i);
      if(amount>0){
        c.beginPath();c.arc(0,0,r,start,start+(end-start)*amount);
        c.lineWidth=ready?2.1:2;c.strokeStyle=ready?"#d5fff2":"#86ddd2";c.stroke();
      }
    }
    if(ready){
      // Four inward-locking facets distinguish a held charge from the round
      // gold lantern itself. The ink surround keeps the marks legible on fur.
      for(let i=0;i<4;i++){
        c.beginPath();c.moveTo(-6,-r-4);c.lineTo(-3,-r-4);c.lineTo(0,-r+.5);
        c.lineTo(3,-r-4);c.lineTo(6,-r-4);
        c.lineWidth=4.8;c.strokeStyle="#10272c";c.stroke();
        c.lineWidth=2;c.strokeStyle="#ffffed";c.stroke();
        c.rotate(quarter);
      }
    }
    c.restore();
  }
  function fallenSeal(c,x,y,fall,t,reduced){
    const d=reduced?0:Math.sin(t*2.1), turn=(1-fall)*.9;
    for(let i=0;i<7;i++){
      const a=i*2.4, r=(11+i*2)*(1-fall);
      c.fillStyle=i%2?"#b68a6044":"#fbc98088";
      c.fillRect(Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r+i*1.4),2,1);
    }
    shadow(c,x,252,11,2);
    NightMarket.seal(c,Math.round(x),Math.round(y+d),.37,-.14+(reduced?0:turn));
  }
  let pickEnemy=null;
  function hitEnemy(x,y){return pickEnemy?pickEnemy(x,y):false}
  function draw(canvas,s) {
    const c=canvas.getContext("2d");
    c.setTransform(canvas.width/640,0,0,canvas.height/360,0,0);
    // Minify the high-resolution cut-outs in one pass. Code-drawn pixel effects
    // remain on the six-hundred-forty-unit grid and keep their square steps.
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality="low";
    const p=s.p??-1,t=s.t||0,focus=!!s.focus;
    const floor=s.floor||1,mite=s.foeKind==="ink-mite";
    const zoom=(canvas.clientWidth||640)/640;
    const right=mite&&canvas.parentElement?(canvas.parentElement.clientWidth-canvas.offsetLeft)/zoom:640;
    const goal=mite?TrailCreature.stance(right,zoom):{x:lampX,y:floor===2?204:171.64};
    const aimX=goal.x,abdomenY=goal.y;
    pickEnemy=null;
    BattleSprites.backdrop(c,floor,s.worldTime??t,s.reduced);
    const hero=stancePose(p,t,s.guard,goal);
    const gateFit=floor===2?Math.min(s.compactGate?.92:1,(640-lampX-6/zoom)/198):1;
    const snap=clamp((p-contact)/.20),hitRecoil=p<contact||s.guard?0:Math.sin(Math.PI*snap)*(focus?19:13);
    const reply=(s.hurt>0||s.guard&&s.incoming>0)?Math.sin(Math.PI*ease(.61,.87,p)):0;
    const bodyPitch=mite?(s.guard?.43:.29)*reply:0;
    let mx=aimX+hitRecoil;
    let my=abdomenY+(!mite&&floor===1&&p<0?Math.sin(t*2.4)*3:0)-hitRecoil*.28;
    // The visible contact is the jaw, snout, or proboscis, not the targeting seal.
    // Keep the enemy's face in front of the lead sleeve or close on the actual steel.
    let intercept;
    if(reply>0){
      const h=hero.hilt,b=hero.tip;
      intercept=s.guard?{x:h.x+(b.x-h.x)*.22,y:h.y+(b.y-h.y)*.22}:{x:h.x+24,y:h.y+41};
      // Visible mouth coordinates measured from each sprite's targeting landmark.
      const reach=mite?TrailCreature.reach(goal.scale,bodyPitch):
        floor===2?{x:-93*.88*gateFit,y:26*.88*gateFit}:{x:-86*.8,y:-42*.8};
      mx=aimX+hitRecoil+reply*(intercept.x-reach.x-aimX);
      my=abdomenY-hitRecoil*.28+reply*(intercept.y-reach.y-abdomenY);
    }
    if(s.killed&&p>=contact){const fall=ease(.47,.90,p);my+=fall*(mite?3:27);mx+=fall*(mite?3:9)}
    // Contact stays dark directly beneath the soles. The wash on the paving stretches away from the moon.
    shadow(c,hero.x-5,Math.round(hero.y)+2,65,4);
    if(!s.cleared){
      if(mite){
        TrailCreature.leaf(c,goal);
        shadow(c,Math.round(mx+25),284,Math.round(56-30*reply),reply>.4?1:3);
        if(reply<.10){shadow(c,Math.round(mx+7),283,9,1);shadow(c,Math.round(mx+52),280,7,1)}
      }
      else if(floor===2)shadow(c,mx+22*gateFit,Math.round(abdomenY+73.2*gateFit)+3,75*gateFit,3);
      else shadow(c,mx+7,263,31,3);
    }
    if(!s.guard&&p>=.23&&p<.42){
      const dust=ease(.22,.41,p);for(let i=0;i<9;i++){
        c.fillStyle=i%2?"#9cafa388":"#b8bba577";c.fillRect(Math.round(home-16-i*4-dust*10),Math.round(footY-i%3-dust*Math.sin(i)*4),2+i%3,1);
      }
    }
    let target;
    if(!s.cleared){
      c.save();
      if(s.killed&&p>.53)c.globalAlpha=1-ease(.53,.89,p);
      const actorState={floor,fit:gateFit,louseScale:goal.scale,pitch:bodyPitch,x:mx,y:my,t,p,reduced:s.reduced,heavy:s.heavy,taking:!s.guard,striking:reply,recoil:hitRecoil/19};
      // Pitch the fox's haunches down during a high parry. The visible nose is
      // the pivot, keeping the bite on the steel and its full tail beneath the eaves.
      const pitch=floor===2&&s.guard?.195*reply:0;
      const nx=mx-93*.88*gateFit,ny=my+26*.88*gateFit;
      if(pitch>.001){c.translate(nx,ny);c.rotate(pitch);c.translate(-nx,-ny)}
      target=mite?TrailCreature.draw(c,actorState):BattleSprites.enemy(c,actorState);
      if(c.globalAlpha>=.18)pickEnemy=mite?TrailCreature.hit:BattleSprites.hitEnemy;
      if(target&&pitch>.001){
        const cos=Math.cos(pitch),sin=Math.sin(pitch),cx=target.x-nx,cy=target.y-ny;
        target={x:nx+cx*cos-cy*sin,y:ny+cx*sin+cy*cos,
          rx:target.rx*cos+target.ry*sin,ry:target.rx*sin+target.ry*cos};
        if(pickEnemy)pickEnemy=(x,y)=>BattleSprites.hitEnemy(nx+(x-nx)*cos+(y-ny)*sin,ny-(x-nx)*sin+(y-ny)*cos);
      }
      c.restore();
    }
    BattleSprites.hero(c,hero);weapon(c,hero,s.weaponId);
    if(!s.guard)trail(c,p,t,focus,goal,hero);
    if(s.sharpened){
      // The bought grit stays on the edge for the entire gate fight.
      const h=hero.hilt,b=hero.tip,x=h.x+(b.x-h.x)*.09,y=h.y+(b.y-h.y)*.09;
      line(c,x,y,b.x,b.y,"#edaf55");
      const along=.36+.45*(.5+.5*Math.sin(t*2.7)),gx=x+(b.x-x)*along,gy=y+(b.y-y)*along;
      line(c,gx-2,gy,gx+2,gy,"#fff2ba");line(c,gx,gy-2,gx,gy+2,"#fff2ba");
    }
    if(!s.guard&&p>=contact){
      const surface=mite?impactMaterial.inkScale:floor===2?impactMaterial.ember:impactMaterial.paper;
      const thrust=stancePose(contact,t,false,goal);
      const angle=Math.atan2(thrust.tip.y-thrust.hilt.y,thrust.tip.x-thrust.hilt.x);
      impact(c,aimX,abdomenY,p,focus,surface,angle,s.reduced);
      countingBeads(c,thrust.tip,p,s.abacusHit,s.reduced);
    }
    if(reply>.60){
      for(let i=0;i<4;i++){
        const x=mx+(mite?14:10)+i*3,y=my+10-i*5;
        line(c,x,y,x+8+i*2,y-2,i%2?"#cc9d64":"#ffe6a0");
      }
      if(s.guard&&reply>.91){
        impact(c,intercept.x,intercept.y,contact,false,mite?impactMaterial.inkScale:impactMaterial.ember,0,s.reduced);
      }
    }
    if(p>=.74&&s.hurt){digits(c,"−"+s.hurt,hero.x-13,footY-115,2,"#35282c");digits(c,"−"+s.hurt,hero.x-14,footY-116,2,"#ea977c")}
    
    if(!mite&&floor===1&&s.killed&&(s.cleared||p>.62)){
      const fall=s.cleared?1:ease(.62,.94,p), y=abdomenY+70*fall-Math.sin(fall*Math.PI)*10;
      fallenSeal(c,lampX,y,fall,t,s.reduced);
    }
    if(p>=contact&&p<=.87&&s.hit){
      const dy=ease(.43,.80,p)*12, size=focus?3:2;
      const x=aimX+25,y=abdomenY-24-dy;
      digits(c,"−"+s.hit,x+1,y+2,size,"#2d2828");digits(c,"−"+s.hit,x,y,size,focus?"#fff0a8":"#ffebc1");
    }
    if(s.charge!=null)ring(c,mx,my,s.charge,s.ready);
    if(s.hover&&p<0&&!s.cleared&&s.charge==null){
      for(const side of [-1,1]){line(c,mx+side*16,my,mx+side*22,my,"#f5d38c");diamond(c,mx+side*24,my,1,"#f5d38c")}
    }
    return {lamp:{x:mx,y:my},target,tip:hero.tip};
  }
  function study(canvas,index){
    canvas.width=640;canvas.height=360;
    return draw(canvas,{p:[.20,.43,.84][index],t:2.5,worldTime:2.5,focus:false,hit:6,hurt:2});
  }
  return {draw,study,hitEnemy};
})();