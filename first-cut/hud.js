/* Lacquer tablets, a folded dispatch and sword-scabbard vitality for the duelling floor. */
window.CutHud=(()=>{
  "use strict";
  const {text,poly,line,diamond}=CutInk;
  const ivory="#f9e9c9",gold="#deb77a",antique="#916b44";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const touchHover=matchMedia("(any-hover: hover)");
  const still=matchMedia("(prefers-reduced-motion: reduce)");
  // In reduced-motion mode the main RAF sleeps. Wake it on a real control transition.
  const controls=new Set(["guard","strike","reset","sound"]);
  for(const event of ["pointerover","pointerout","pointerdown","pointerup","focusin","focusout"]){
    document.addEventListener(event,e=>{
      if(still.matches&&controls.has(e.target.id))window.dispatchEvent(new Event("tower:repaint"));
    });
  }
  const materials=new Map();
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
  function gradient(c,y,h,stops){const g=c.createLinearGradient(0,y,0,y+h);stops.forEach(([v,col])=>g.addColorStop(v,col));return g}
  function edge(c,x,y,w,h,r=4){
    c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.lineTo(x+w,y+r);c.lineTo(x+w,y+h-r);
    c.lineTo(x+w-r,y+h);c.lineTo(x+r,y+h);c.lineTo(x,y+h-r);c.lineTo(x,y+r);c.closePath();
  }
  function texture(kind){
    if(materials.has(kind))return materials.get(kind);
    const a=document.createElement("canvas");a.width=157;a.height=79;
    const g=a.getContext("2d");let seed=kind==="paper"?17120:84621;
    const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    if(kind==="paper"){
      for(let n=0;n<510;n++){const u=rnd();rect(g,rnd()*157,rnd()*79,u<.8?1:2+rnd()*3,1,u<.58?"#815c382d":"#fff3c84d")}
      for(let n=0;n<15;n++){const x=rnd()*157,y=rnd()*79;line(g,x,y,x+3+rnd()*6,y-1,"#94734b23")}
    }else{
      for(let n=0;n<110;n++){
        const x=rnd()*157,y=Math.floor(rnd()*79),w=4+rnd()*36;
        line(g,x,y,x+w*.5,y+(n%4===0?1:0),n%4?"#fff1b911":"#170d1570");
        if(n%5===0)line(g,x+w*.5,y+1,x+w,y,"#b78c591e");
      }
      for(let n=0;n<37;n++)rect(g,rnd()*157,rnd()*79,1,1,"#edde9b36");
    }
    materials.set(kind,a);return a;
  }
  function grain(c,kind,x,y,w,h){
    const tile=texture(kind);c.save();c.translate(x,y);c.fillStyle=c.createPattern(tile,"repeat");c.fillRect(0,0,w,h);c.restore();
  }
  const finishes={
    ebony:[[0,"#675342"],[.09,"#493d36"],[.22,"#362e2e"],[.75,"#2c2528"],[1,"#211e23"]],
    red:[[0,"#bb7054"],[.12,"#96543e"],[.34,"#7d3c34"],[.78,"#562b2a"],[1,"#3e2527"]],
    green:[[0,"#788980"],[.12,"#556b65"],[.34,"#3c514d"],[.78,"#2b4141"],[1,"#233134"]],
    subdued:[[0,"#696259"],[.15,"#4f4840"],[.75,"#373137"],[1,"#2b282c"]]
  };
  function wood(c,x,y,w,h,finish="ebony",active=false){
    // A heavy base projects below the varnished face. A depressed tablet moves into its base.
    const shift=active?2:0,yy=y+shift,hh=h-shift;
    edge(c,x+1,y+3,w,h,5);c.fillStyle="#0f1519bb";c.fill();
    edge(c,x,y+1,w,h,5);c.fillStyle="#30251f";c.fill();
    edge(c,x,yy,w,hh-2,5);c.fillStyle=gradient(c,yy,hh,finishes[finish]);c.fill();
    c.save();c.clip();grain(c,"wood",x,yy,w,hh);c.restore();
    line(c,x+5,yy,x+w-6,yy,"#bb9a70");line(c,x,yy+5,x+5,yy,"#ad8d64");
    line(c,x+4,yy+3,x+w-5,yy+3,"#d2ae752f");
    line(c,x+w-1,yy+6,x+w-1,y+h-7,"#6d5542");line(c,x+5,y+h-3,x+w-6,y+h-3,"#1b1b21");
    return yy;
  }
  function rivet(c,x,y,lit=gold){
    rect(c,x-2,y-1,4,3,"#3c302c");rect(c,x-1,y-2,3,4,antique);rect(c,x-1,y-2,2,1,lit);
  }
  function bracket(c,x,y,sign=1){
    c.save();c.translate(x,y);c.scale(sign,1);
    poly(c,[[0,8],[0,3],[3,0],[12,0],[12,2],[5,2],[2,5],[2,9]],"#c6a367");
    line(c,3,3,7,3,"#6e5845");rect(c,10,3,1,2,"#b38c5a");c.restore();
  }
  function seal(c,x,y){
    poly(c,[[x+3,y],[x+17,y],[x+20,y+3],[x+20,y+23],[x+18,y+26],[x+2,y+26],[x,y+23],[x,y+3]],"#722f2e");
    rect(c,x+2,y+2,16,22,"#bd6b4c");rect(c,x+3,y+3,14,20,"#984b39");
    const z="#f6d0a0";
    for(const [a,b,d,e] of [[4,10,9,6],[9,6,15,10],[5,12,15,12],[10,10,10,21],[5,16,9,16],[6,17,6,19],[12,15,15,15],[15,15,15,19],[12,19,15,19]])line(c,x+a,y+b,x+d,y+e,z);
    rect(c,x+1,y+23,2,1,"#573132");rect(c,x+17,y+4,1,2,"#d28a63");
  }
  function signboard(c,x,y,s){
    const w=137,h=49;
    for(const xx of [x+14,x+w-14]){line(c,xx-2,y-9,xx,y+2,"#55463d");line(c,xx,y-8,xx+1,y+2,"#bb9261")}
    wood(c,x,y,w,h);
    bracket(c,x+2,y+1);bracket(c,x+w-3,y+1,-1);
    line(c,x+7,y+40,x+7,y+44,antique);line(c,x+7,y+44,x+17,y+44,antique);
    line(c,x+w-8,y+40,x+w-8,y+44,antique);line(c,x+w-8,y+44,x+w-18,y+44,antique);
    seal(c,x+9,y+10);line(c,x+35,y+8,x+35,y+37,"#92745473");
    CutInk.textAtCenterY(c,s.foeKind==="ink-mite"?"斩妖塔 · 侧廊":s.floor===2?"斩妖塔 · 守关":"斩妖塔 · 壹层",x+42,y+11,9.5,gold,true,"price");
    CutInk.textAtCenterY(c,s.foeKind==="ink-mite"?"墨蠹巢":s.floor===2?"狐灯关":"照影廊",x+42,y+30,23,ivory,true,"title");
  }
  function dispatch(c,x,y,w,s){
    const h=55;
    const pts=[[x+2,y+3],[x+w-4,y+3],[x+w-4,y+h-9],[x+w-11,y+h-4],[x+w-31,y+h-3],[x+w-60,y+h-4],[x+8,y+h-3],[x+2,y+h-6]];
    poly(c,pts.map(([px,py])=>[px+1,py+3]),"#13202595");
    c.save();c.beginPath();pts.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip();
    c.fillStyle=gradient(c,y,h,[[0,"#9c8868"],[.12,"#c9b78d"],[.28,"#e9d9ae"],[.72,"#dfcba2"],[1,"#c4ad82"]]);c.fillRect(x,y,w,h);grain(c,"paper",x,y,w,h);
    line(c,x+6,y+4,x+6,y+h-5,"#9a6d53");line(c,x+8,y+4,x+8,y+h-5,"#b58c6766");
    line(c,x+11,y+h-6,x+w-12,y+h-7,"#ad9775");c.restore();
    poly(c,[[x+w-15,y+h-4],[x+w-10,y+h-11],[x+w-5,y+h-10]],"#ab916b");
    rect(c,x,y,w,4,"#584737");rect(c,x+1,y,w-2,1,"#d8b779");
    for(const xx of [x,x+w-5]){rect(c,xx,y-1,5,6,"#7b5d3c");rect(c,xx+1,y-1,3,2,"#e0be7e")}
    text(c,s.name,x+14,y+5,14,"#422d26",true);
    text(c,s.foe+"/"+s.maxFoe,x+w-48,y+5,13,"#46352e",true,"price");
    const mw=w-31,mx=x+15,my=y+28,hp=clamp(s.foe/s.maxFoe,0,1);
    rect(c,mx,my,mw,3,"#a29279");rect(c,mx,my,mw*hp,3,"#9c5836");rect(c,mx,my,mw*hp,1,"#b77b48");
    diamond(c,x+16,y+40,3,"#934c3a");
    const intent=s.cleared?(s.lost?"折戟":"封妖"):s.intent;
    if(!s.cleared)text(c,"将出",x+23,y+32,10,"#81493b",true,"price");
    text(c,intent,x+(s.cleared?24:47),y+30,12,"#4a3029",true,"price");
  }
  function stateOf(id){
    const el=document.getElementById(id);
    return {hover:touchHover.matches&&el?.matches(":hover"),focus:el?.matches(":focus-visible"),down:el?.matches(":active")};
  }
  function sword(c,x,y,col){
    poly(c,[[x-7,y+6],[x-4,y+6],[x+7,y-5],[x+9,y-10],[x+5,y-8],[x-6,y+3]],col);
    line(c,x-4,y+1,x,y+5,"#d29660",2);line(c,x-6,y+6,x-9,y+9,"#f1c182",2);
  }
  function shield(c,x,y,col){
    poly(c,[[x-8,y-6],[x,y-9],[x+8,y-6],[x+7,y+2],[x+4,y+6],[x,y+9],[x-5,y+5],[x-8,y+1]],"#372e2b");
    poly(c,[[x-6,y-5],[x,y-7],[x+6,y-5],[x+5,y+1],[x,y+7],[x-5,y+2]],col);
    poly(c,[[x-4,y-4],[x,y-5],[x,y+4],[x-3,y+1]],"#697267");
    line(c,x,y-3,x,y+3,"#4b4a3e");diamond(c,x,y,2,"#9e754b");
  }
  function scabbard(c,x,y,w,s){
    const h=41;
    wood(c,x,y,w,h);bracket(c,x+2,y+1);bracket(c,x+w-3,y+1,-1);
    diamond(c,x+11,y+11,5,"#987043");diamond(c,x+11,y+10,3,"#eac683");diamond(c,x+11,y+10,1,"#6d4436");
    text(c,s.weaponName||"照影剑",x+20,y+1,15,ivory,true);
    {
      const prefix=s.abacus?"算盘首击+"+s.abacus:s.blood?"血珀":s.charged?"蓄势":s.grit?"砺锋":s.carrying?"携印":"";
      const tag=(prefix?prefix+" · ":"")+"剑伤 "+s.damage;
      text(c,tag,x+78,y+4,11,s.damage>=10?"#ffd792":"#cab99a",true);
    }
    text(c,"气血",x+6,y+22,10,"#dfc5a1",true);
    const hiltX=x+34,barX=hiltX+10,barW=w-90,barY=y+29;
    poly(c,[[hiltX,barY-2],[barX,barY-2],[barX,barY+2],[hiltX,barY+2]],"#bf8e58");
    for(let i=0;i<3;i++)line(c,hiltX+i*3,barY+1,hiltX+i*3+2,barY-2,"#60423a");
    rect(c,barX-2,barY-5,3,10,"#d8b67b");
    poly(c,[[barX+1,barY-3],[barX+barW-3,barY-3],[barX+barW+2,barY],[barX+barW-3,barY+3],[barX+1,barY+3]],"#ab9168");
    rect(c,barX+2,barY-2,barW-5,4,"#372e30");
    const n=Math.round((barW-5)*clamp(s.hp/s.maxHp,0,1));
    rect(c,barX+2,barY-2,n,4,s.hp<=6?"#c15a4e":"#bf6952");rect(c,barX+2,barY-2,n,1,"#e6a17b");
    text(c,s.hp+"/"+s.maxHp,x+w-42,barY-10,13,ivory,true,"price");
  }
  function command(c,id,r,s,portrait){
    const action=id==="strike",st=stateOf(id),disabled=action?s.busy:s.busy||s.cleared;
    const pressed=(st.down||action&&s.holding)&&!disabled;
    let {x,y,w,h}=r;
    const face=wood(c,x,y,w,h,disabled?"subdued":action?"red":"green",pressed);
    const mid=Math.round((face+y+h-2)/2);
    if((st.hover||st.focus||action&&s.ready)&&!disabled){
      edge(c,x+2,face+1,w-4,y+h-face-5,4);
      c.strokeStyle=s.ready?"#ffe9ab":st.focus?"#ffe8a7":"#d9b978";c.lineWidth=1.5;c.stroke();
    }
    bracket(c,x+3,face+2);bracket(c,x+w-4,face+2,-1);
    if(w>83){rivet(c,x+5,mid+1);rivet(c,x+w-5,mid+1)}
    const label=action?(s.cleared?"再斩一场":"出剑"):"守势";
    const labelW=label.length*16, keySpace=portrait?0:12, iconX=Math.round(x+(w-labelW-keySpace-22)/2)+8;
    if(action)sword(c,iconX,mid,disabled?"#ad9d86":"#ffe4a5");else shield(c,iconX,mid,"#dbbd8a");
    text(c,label,iconX+12,mid-12,16,disabled?"#c0b4a0":ivory,true);
    if(!portrait&&!s.cleared){
      const kx=x+w-17;rect(c,kx,mid-6,9,12,"#24232688");line(c,kx,mid+6,kx+8,mid+6,"#c69e6755");
      text(c,action?"J":"K",kx+1,mid-7,9,"#e3c393",true);
    }
  }
  function toggle(c,id,r,on){
    const st=stateOf(id),x=Math.round(r.x+r.w/2),y=Math.round(r.y+r.h/2);
    const d=st.down?1:0;
    const shape=[[x-5,y-10+d],[x+5,y-10+d],[x+10,y-5+d],[x+10,y+5+d],[x+5,y+10+d],[x-5,y+10+d],[x-10,y+5+d],[x-10,y-5+d]];
    poly(c,shape.map(([px,py])=>[px+1,py+2]),"#171a1bbb");poly(c,shape,st.hover||st.focus?"#d5b47b":"#92744c");
    poly(c,shape.map(([px,py])=>[x+(px-x)*.86,y+d+(py-y-d)*.86]),"#3b3530");
    if(id==="reset"){
      line(c,x-4,y-3,x+2,y-3,gold);line(c,x+3,y-2,x+4,y,ivory);
      line(c,x+4,y+1,x+2,y+3,gold);line(c,x+2,y+3,x-3,y+3,gold);
      poly(c,[[x-5,y-3],[x-1,y-6],[x-1,y]],ivory);
    }else{
      poly(c,[[x-6,y-2],[x-3,y-2],[x+1,y-5],[x+1,y+5],[x-3,y+2],[x-6,y+2]],ivory);
      if(on){line(c,x+3,y-3,x+5,y-1,gold);line(c,x+5,y-1,x+5,y+1,gold);line(c,x+5,y+1,x+3,y+3,gold)}
      else{line(c,x+3,y-2,x+6,y+1,gold);line(c,x+3,y+1,x+6,y-2,gold)}
    }
  }
  function mobileMount(c,w,h,sceneTop,sceneBottom){
    for(const [sy,sh] of [[0,sceneTop],[sceneBottom,h-sceneBottom]]){
      c.fillStyle=gradient(c,sy,Math.max(1,sh),[[0,"#142123"],[.65,"#1e2a2a"],[1,"#182526"]]);
      c.fillRect(0,sy,w,sh);
      c.save();c.beginPath();c.rect(0,sy,w,sh);c.clip();c.globalAlpha=.25;grain(c,"wood",0,sy,w,sh);
      c.strokeStyle="#87978931";c.lineWidth=.7;
      for(const side of [-1,1])for(let i=0;i<6;i++){
        const cx=side<0?-10:w+12,cy=sy+(sy===0?1:sh)+i*3;
        c.beginPath();c.ellipse(cx,cy,27+i*9,14+i*6,side*.45,0,Math.PI*2);c.stroke();
      }
      c.restore();
    }
    for(const y of [sceneTop-3,sceneBottom]){
      rect(c,0,y,w,3,"#312c28");rect(c,0,y,w,1,"#927d5d");rect(c,0,y+2,w,1,"#4e4b3e");
      for(const x of [9,w-17]){rect(c,x,y-1,8,5,"#7e674a");rect(c,x+1,y-1,6,1,"#d2b480")}
    }
  }
  function layout(game,world,hud,floor=1){
    const w=game.clientWidth,h=game.clientHeight,portrait=w/h<1;
    const ratio=portrait?1:clamp(w/820,1,2.8),W=Math.round(w/ratio),H=Math.round(h/ratio);
    const dpr=Math.min(window.devicePixelRatio||1,2);hud.width=Math.round(w*dpr);hud.height=Math.round(h*dpr);
    const pen=hud.getContext("2d");pen.setTransform(hud.width/W,0,0,hud.height/H,0,0);pen.imageSmoothingEnabled=false;
    const gateView=portrait&&floor===2;
    const zoom=portrait?w/(gateView?604:494):Math.min(h/360,w/535),ww=640*zoom,wh=360*zoom;
    const density=Math.min(3,Math.max(1,ww*dpr/640));
    const pixelsW=Math.round(640*density),pixelsH=Math.round(360*density);
    if(world.width!==pixelsW||world.height!==pixelsH){world.width=pixelsW;world.height=pixelsH}
    const left=Math.round(gateView?w-ww:(w-ww)/2),top=portrait?Math.round((h-wh)*.43):Math.round((h-wh)/2);
    Object.assign(world.style,{left:left+"px",top:top+"px",width:ww+"px",height:wh+"px"});
    const inset=portrait?14:19,space=portrait?Math.round(top/ratio):0;
    const actionY=portrait?Math.round(top+wh)+57:H-44;
    const toggleY=portrait?Math.max(2,space-99):9;
    const actionGap=portrait?11:9,guardW=portrait?Math.round((W-2*inset-actionGap)*.38):96;
    const strikeW=portrait?W-2*inset-actionGap-guardW:108;
    const rects={
      strike:{x:portrait?inset:W-inset-strikeW,y:actionY,w:strikeW,h:34},
      guard:{x:portrait?W-inset-guardW:W-inset-strikeW-actionGap-guardW,y:actionY,w:guardW,h:34},
      reset:{x:W-inset-69,y:toggleY,w:30,h:29},sound:{x:W-inset-27,y:toggleY,w:30,h:29}
    };
    return {w:W,h:H,ratio,portrait,inset,rects,space,world:{left,top,zoom,width:ww,height:wh}};
  }
  function draw(canvas,L,s){
    const c=canvas.getContext("2d"),{w,h,inset,portrait,rects,space}=L;
    c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
    const sceneBottom=Math.round(L.world.top+L.world.height);
    if(portrait)mobileMount(c,w,h,space,sceneBottom);
    const titleY=portrait?space-62:14;
    signboard(c,inset,titleY,s);
    const slipW=portrait?Math.min(153,w-inset*2-143):150;
    const slipX=portrait?w-inset-slipW:rects.reset.x-slipW-10;
    dispatch(c,slipX,portrait?space-63:13,slipW,s);
    toggle(c,"reset",rects.reset,true);toggle(c,"sound",rects.sound,s.sound);
    scabbard(c,inset,portrait?sceneBottom+7:h-52,portrait?Math.min(227,w-2*inset):201,s);
    command(c,"guard",rects.guard,s,portrait);command(c,"strike",rects.strike,s,portrait);
    const a=rects.strike;
    const cue=s.cleared?(s.lost?"气血已尽 · 可重新试剑":"封住"+s.name+" · 可重新试剑"):s.ready?"松手合锋":s.holding?"凝锋中":s.foeKind==="gate-fox"&&s.heavy&&!s.cleanClasp?"挡这次重击：狐扣卖 5 石":s.floor===1&&s.foeKind!=="ink-mite"&&!s.sweptAsh?"守势接灰，多得 1 份":"出剑 "+s.damage+" 伤 · 敌血 "+s.foe+" → "+Math.max(0,s.foe-s.damage);
    const cueW=Math.ceil(cue.length*(portrait?12:10.5))+14;
    const cx=portrait?inset:rects.strike.x+rects.strike.w-cueW,cy=portrait?a.y+41:a.y-22;
    if(!portrait){
      poly(c,[[cx-3,cy+2],[cx+cueW,cy+2],[cx+cueW,cy+18],[cx-3,cy+18],[cx,cy+10]],s.ready?"#783f31ee":"#26302aec");
      line(c,cx+2,cy+17,cx+cueW-1,cy+17,"#bc9e665e");
    }
    text(c,cue,cx+4,cy,portrait?12:11,s.ready?"#ffe5a2":"#e4d8b5",true);
    if(s.cleared&&!portrait){
      const x=Math.round(w/2)-51,y=Math.round(h*.15);wood(c,x,y,102,27,"red");
      text(c,s.lost?"剑势已尽":"封妖",x+(s.lost?18:32),y+1,16,ivory,true);
    }
  }
  return {layout,draw};
})();
