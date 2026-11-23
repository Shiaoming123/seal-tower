/* A grid-unit ray camera. Each wall column and each visible marker uses the same depth buffer. */
window.CrawlScene=(()=>{
  "use strict";
  const S=128,TAU=Math.PI*2;
  const indoor=new Set(["contract","gear","shop","market","settle","done"]);
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>(v=clamp(v),v*v*(3-2*v));
  function blank(w,h){const a=document.createElement("canvas");a.width=w;a.height=h;return a}
  function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
  function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h)}
  function polygon(c,pts,color){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()}
  function line(c,pts,color,w=1){c.strokeStyle=color;c.lineWidth=w;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()}
  function ellipse(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill()}
  const sets=[
    {wood:"#5c3931",light:"#a16544",edge:"#d79959",panel:"#284c48",stone:"#646b61",fabric:"#762b27",floor:"#586762"},
    {wood:"#48424a",light:"#86736a",edge:"#cda674",panel:"#294757",stone:"#666c70",fabric:"#355a65",floor:"#536269"},
    {wood:"#67362d",light:"#a15e40",edge:"#e8ae65",panel:"#3a4743",stone:"#6b625b",fabric:"#822e31",floor:"#62605d"}
  ];
  function recess(c,x,y,w,h){
    rect(c,x,y,w,h,"#201f22");rect(c,x+2,y+2,w-4,h-4,"#986b49");rect(c,x+3,y+3,w-6,h-6,"#3b3934");
  }
  function warmLantern(c,x,y,size){
    c.save();c.translate(x,y);c.scale(size,size);
    const aura=c.createRadialGradient(0,3,2,0,3,20);
    aura.addColorStop(0,"#fdb65c80");aura.addColorStop(.5,"#e59c3c44");aura.addColorStop(1,"#ef8b3500");
    rect(c,-20,-17,40,40,aura);
    rect(c,-1,-16,2,6,"#ac8458");polygon(c,[[-9,-7],[-5,-11],[5,-11],[9,-7],[5,-5],[-5,-5]],"#44342a");
    polygon(c,[[-6,-6],[6,-6],[7,4],[4,10],[-4,10],[-7,4]],"#ed9b49");
    polygon(c,[[-3,-5],[4,-5],[4,5],[2,9],[-2,8]],"#ffe5a0");
    for(const z of [-5,0,5])line(c,[[z,-6],[z*.9,7]],"#b87334",.85);
    rect(c,-5,8,10,2,"#58412c");rect(c,-2,10,4,2,"#d9a158");rect(c,-1,12,2,5,"#ae4539");
    c.restore();
  }
  function texture(theme,kind,withPaint){
    const pal=sets[theme-1],a=blank(S,S),c=a.getContext("2d",{willReadFrequently:true});
    const salt=["stone","ceiling","shelf","shrine","window","door","panel"].indexOf(kind)+7;
    const r=seeded(theme*7919+salt*323);c.imageSmoothingEnabled=true;
    if(theme===2)return bridgeSurface(a,c,r,kind,withPaint?window.TowerSprites?.get("bridge-bluestone"):null);
    if(kind==="stone"){
      rect(c,0,0,S,S,"#333d3b");
      for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
        const x=col*64+(row%2)*32,y=row*32;
        rect(c,x+1,y+1,62,30,pal.floor);rect(c,x+2,y+2,60,1,"#879086");rect(c,x+2,y+3,1,26,"#748078");
        rect(c,x+3,y+28,59,2,"#414a48");
        if(r()>.42)line(c,[[x+4,y+8],[x+12,y+10],[x+17,y+8],[x+26,y+12]],"#49534e");
      }
      for(let i=0;i<1600;i++){const x=r()*S,y=r()*S;rect(c,x,y,1+r()*4,1,r()>.46?"#c6b59b22":"#222c2d33")}
      for(const y of [3,125]){rect(c,0,y,S,1,"#998c6b");rect(c,0,y+1,S,1,"#4c5449")}
      return a;
    }
    if(kind==="ceiling"){
      rect(c,0,0,S,S,"#403b39");for(let i=0;i<8;i++){rect(c,0,i*16,S,2,"#262d2d");rect(c,0,i*16+2,S,1,"#716050")}
      for(let i=0;i<270;i++){rect(c,r()*S,r()*S,3+r()*18,1,r()>.45?"#86746042":"#25252770")}
      for(const x of [1,55,120]){rect(c,x,0,7,S,"#3a302c");rect(c,x+1,0,2,S,"#8b6546");rect(c,x+6,0,2,S,"#252626")}
      return a;
    }
    rect(c,0,0,S,S,pal.panel);
    for(let i=0;i<650;i++)rect(c,r()*S,r()*S,1,1+r()*4,r()>.5?"#93b3a826":"#10191b40");
    recess(c,13,20,103,82);
    const paste=(id,x,y,w,h,dx,dy,dw,dh)=>{
      const im=window.TowerSprites?.get(id);if(!im||!withPaint)return false;
      c.drawImage(im,x*im.width/960,y*im.height/540,w*im.width/960,h*im.height/540,dx,dy,dw,dh);return true;
    };
    if(kind==="shelf"){
      if(!paste("shop-wall",196,77,294,351,18,23,92,77)){
        for(let shelf=0;shelf<3;shelf++){
          const y=24+shelf*24;rect(c,17,y,93,21,"#293531");
          for(let j=0;j<17;j++){const x=19+5*j,h=9+r()*10;rect(c,x,y+20-h,3.7,h,["#916644","#925140","#5c7770","#a78855"][j%4]);rect(c,x,y+20-h/2,3.7,1,"#cab48c")}
          rect(c,15,y+21,98,3,"#946742");
        }
      }
    }else if(kind==="window"){
      if(!paste("hall",86,22,769,357,13,18,103,84)){rect(c,18,24,92,74,"#526b70");ellipse(c,76,41,15,15,"#c9cbb1")}
      for(const x of [18,35,92,108])rect(c,x,24,3,76,"#443934");
      for(const y of [29,36,87,94])rect(c,18,y,92,2,"#665340");
      for(const x of [22,97])for(const y of [39,59,78]){rect(c,x,y,9,2,"#786143");rect(c,x+5,y-5,2,7,"#91785a")}
    }else if(kind==="door"){
      for(let i=0;i<12;i++){rect(c,16+i*8,23,8,76,i%2?pal.wood:"#593c33");rect(c,16+i*8,23,1,76,"#362f2b")}
      for(const x of [20,64]){recess(c,x,27,43,67);rect(c,x+4,32,35,56,pal.wood);for(let j=0;j<7;j++)rect(c,x+5+j*5,34,2,52,"#76533d")}
      for(const x of [52,72]){ellipse(c,x,60,5,6,"#a47a4b");ellipse(c,x,60,2.5,3,"#3c3129");rect(c,x-1,54,3,2,"#dfb674")}
      rect(c,36,21,54,6,"#3b483c");rect(c,39,22,48,1,"#c59c63");
      paste("gate",469,7,487,354,13,18,103,84);
    }else if(kind==="shrine"){
      paste("gate",571,37,231,137,35,31,58,32);
      rect(c,27,68,74,25,pal.fabric);rect(c,25,67,78,3,pal.edge);rect(c,30,92,69,4,pal.wood);
      for(const x of [27,101])warmLantern(c,x,51,.70);
      ellipse(c,64,70,12,4,"#bd8857");ellipse(c,64,68,11,3,"#f2cc83");warmLantern(c,64,57,.57);
      paste("shop-wall",8,284,127,122,30,71,67,22);
    }else{
      paste("shop-wall",594,125,204,168,23,25,82,68);
      for(const x of [17,105]){rect(c,x,23,5,73,pal.wood);rect(c,x,23,1,73,pal.edge)}
      warmLantern(c,64,47,1.28);
    }
    // Pillars, stone skirting and the continuous bracket frieze connect at cell edges.
    for(const x of [0,117]){
      rect(c,x,2,11,111,"#332921");rect(c,x+1,3,8,107,pal.wood);rect(c,x+3,3,2,107,pal.light);
      for(let j=0;j<17;j++)rect(c,x+2+r()*6,24+r()*74,1,2+r()*7,r()>.4?"#35292780":"#a47a4c60");
      rect(c,x,17,11,3,"#bc8b55");rect(c,x,99,11,3,"#a07e50");
    }
    rect(c,0,0,S,5,"#322c29");rect(c,0,5,S,11,pal.wood);rect(c,0,16,S,3,"#312d2b");
    for(let x=0;x<S;x+=16){line(c,[[x,12],[x+4,12],[x+4,8],[x+12,8],[x+12,12],[x+9,12]],pal.edge,1)}
    rect(c,0,103,S,25,pal.stone);rect(c,0,102,S,3,"#514b3e");rect(c,0,105,S,2,"#ada28a");
    for(let row=0;row<2;row++)for(let j=-1;j<4;j++){const x=j*42+row*17;rect(c,x,108+row*11,2,10,"#464c47");rect(c,x,117+row*11,42,1,"#39403e")}
    for(let j=0;j<200;j++)rect(c,r()*S,107+r()*21,1+r()*3,1,r()>.5?"#a7a58c77":"#43474266");
    return a;
  }
  function bridgeSurface(a,c,r,kind,stone){
    const floor=kind==="stone",roof=kind==="ceiling",opening=kind==="window";
    if(!floor&&!roof){
      rect(c,0,0,S,S,"#172a2d");
      for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
        const x=col*38+(row%2)*18,y=row*16,t=r();
        rect(c,x+1,y+1,36,14,t>.78?"#455252":t>.4?"#34494a":"#2d4042");
        rect(c,x+2,y+1,35,1,"#65706a");rect(c,x+1,y+2,1,11,"#465754");
        for(let i=0;i<12;i++)rect(c,x+2+r()*32,y+3+r()*10,r()*6+1,1,r()>.55?"#a7b4a322":"#16242657");
      }
      if(stone)c.drawImage(stone,0,0,S,S);
      if(opening){
        polygon(c,[[24,98],[24,42],[32,28],[47,18],[82,18],[97,28],[104,42],[104,98]],"#73817a");
        polygon(c,[[29,95],[29,43],[36,32],[50,23],[81,23],[94,33],[99,44],[99,95]],"#122530");
        const mist=c.createLinearGradient(0,25,0,97);mist.addColorStop(0,"#162c40");mist.addColorStop(1,"#3b7980");
        polygon(c,[[34,93],[34,44],[41,34],[52,28],[79,28],[89,36],[94,45],[94,93]],mist);
        for(let i=0;i<15;i++){
          const x=36+r()*54,y=54+r()*37;
          line(c,[[x,y],[x+3,y-3],[x+6,y]],i%3?"#152f3c":"#6898a0",2);
        }
        for(const x of [45,64,83]){rect(c,x,39,3,55,"#17252b");rect(c,x+1,42,1,47,"#87928a63")}
        rect(c,30,76,68,3,"#26383b");rect(c,20,94,87,4,"#71827c");rect(c,24,98,79,5,"#283a3b");
      }else if(kind==="panel"||kind==="shrine"){
        rect(c,51,34,26,46,"#1a2d31");rect(c,62,28,4,55,"#55645e");
        warmLantern(c,64,49,1.05);
      }else if(kind==="door"){
        rect(c,11,15,106,93,"#233437");rect(c,15,19,98,86,"#51483c");
        for(let x=18;x<112;x+=13){rect(c,x,21,11,80,"#443d36");rect(c,x+9,25,1,75,"#282c2c")}
        rect(c,16,27,97,3,"#9c784e");rect(c,16,88,97,3,"#9c784e");
        for(const x of [57,70])ellipse(c,x,62,3,5,"#bd9564");
      }else{
        for(const x of [19,102]){
          rect(c,x,14,6,90,"#222e30");rect(c,x,14,2,90,"#708078");
          for(const y of [40,64,87])rect(c,x-1,y,9,2,"#ac8964");
        }
      }
      rect(c,0,106,S,4,"#71817a");rect(c,0,110,S,3,"#27373b");
      rect(c,0,116,S,11,"#223539");rect(c,0,125,S,2,"#4b6661");
      return a;
    }
    rect(c,0,0,S,S,floor?"#172b30":"#19282c");
    for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
      const x=col*64+row%2*32,y=row*32,t=r();
      rect(c,x+1,y+1,61,29,floor?(t>.6?"#47615f":"#384f52"):(t>.6?"#37474a":"#304145"));
      rect(c,x+2,y+1,59,1,"#647e7888");rect(c,x+2,y+29,57,1,"#111f2377");
      for(let i=0;i<90;i++)rect(c,x+r()*61,y+2+r()*27,1+r()*6,1,r()>.65?"#a5c3b52e":"#13252f4a");
      for(let i=0;i<3;i++){
        const u=x+6+r()*43,v=y+3+r()*22;
        line(c,[[u,v],[u+4,v-1],[u+9,v+1]],i===1?"#6985834c":"#182e3377");
      }
    }
    if(stone){
      c.save();c.globalAlpha=roof?.63:.78;
      c.drawImage(stone,0,0,256,171,0,0,S,S);
      c.restore();
    }
    return a;
  }
  const textureCache=new Map(),materials=["shelf","window","panel","shrine","door"];
  function surfaces(theme){
    if(textureCache.has(theme))return textureCache.get(theme);
    const table={};
    for(const kind of ["stone","ceiling",...materials]){
      let a=texture(theme,kind,true);
      try{table[kind]=a.getContext("2d").getImageData(0,0,S,S).data}
      catch{a=texture(theme,kind,false);table[kind]=a.getContext("2d").getImageData(0,0,S,S).data}
    }
    if(theme===2){
      const stone=window.TowerSprites?.get("bridge-bluestone"),tile=blank(S,S),ctx=tile.getContext("2d");
      if(stone){
        ctx.drawImage(stone,0,0,S,S);
        table.arch=ctx.getImageData(0,0,S,S).data;
      }else table.arch=table.shelf;
    }
    textureCache.set(theme,table);return table;
  }
  const fallback={rows:["#######","#.....#","#.###.#","#.....#","###.###","#.....#","#######"],x:3,y:5,dir:0,markers:[],theme:1};
  function field(nav,cam,w,h){
    const theme=clamp(Number(nav.theme)||1,1,3),tex=surfaces(theme),a=blank(w,h),c=a.getContext("2d");
    const image=c.createImageData(w,h),px=image.data,depths=new Float32Array(w);
    const forward=[Math.sin(cam.angle),-Math.cos(cam.angle)],right=[-forward[1],forward[0]];
    const bridge=theme===2,focal=Math.max(h*.65,Math.min(w*.69,h*.99)),horizon=h*.43,eye=.54;
    const ceiling=bridge?1.68:1.34;
    const rows=nav.rows,closed=(x,y)=>!rows[y]||!rows[y][x]||rows[y][x]==="#";
    function write(i,data,j,light,fog){
      px[i]=data[j]*light+12*fog;px[i+1]=data[j+1]*light+24*fog;px[i+2]=data[j+2]*light+26*fog;px[i+3]=255;
    }
    for(let y=0;y<h;y++){
      const ground=y>horizon,dist=Math.min(28,focal*(ground?eye:ceiling-eye)/Math.max(.35,Math.abs(y+.5-horizon)));
      const side=dist*(-w*.5+.5)/focal,dx=right[0]*dist/focal,dy=right[1]*dist/focal;
      let xx=cam.x+forward[0]*dist+right[0]*side,yy=cam.y+forward[1]*dist+right[1]*side;
      const data=ground?tex.stone:tex.ceiling,light=(ground?.99:.77)/(1+dist*.13),fog=Math.min(.75,dist*.09);
      for(let x=0,i=y*w*4;x<w;x++,i+=4,xx+=dx,yy+=dy){
        const u=Math.floor(xx*S)&127,v=Math.floor(yy*S)&127;
        write(i,data,(v*S+u)*4,light,fog);
        if(bridge&&ground){
          // A warm patch falls across the wet stone under each wall lantern.
          const lateral=xx-Math.floor(xx);
          const cave=Math.floor(xx)===2||Math.floor(xx)===6;
          const channel=xx-(xx<4.5?3:7);
          if(channel>.033&&channel<.306&&yy>1.34&&yy<3.76){
            const bank=channel<.070||channel>.271||yy<1.38||yy>3.72;
            const stoneLight=data[(v*S+u)*4]/255;
            const glint=(Math.sin(yy*61+Math.floor(channel*13)*.72)+Math.sin(yy*23))*.5;
            const k=1/(1+dist*.13);
            if(bank){
              const crest=channel<.044||channel>.293;
              const light=(crest?94:61)+stoneLight*49;
              px[i]=light*k+fog*12;px[i+1]=(light+9)*k+fog*24;px[i+2]=(light+5)*k+fog*28;
            }else{
              const edge=channel<.082||channel>.263,reflected=Math.max(0,glint-.37)*75;
              px[i]=((edge?10:23)+reflected)*k+fog*12;
              px[i+1]=((edge?34:61)+reflected)*k+fog*24;
              px[i+2]=((edge?38:69)+reflected)*k+fog*28;
            }
          }
          const warmth=Math.max(0,1-3.5*(yy-Math.floor(yy*.5)*2-.62)**2)*Math.max(0,1-5*(lateral-(cave?.83:.17))**2);
          const wet=(data[(v*S+u)*4]>57?.82:.3)*warmth/(1+dist*.24);
          px[i]+=wet*33;px[i+1]+=wet*19;px[i+2]+=wet*4;
        }
      }
    }
    for(let sx=0;sx<w;sx++){
      const offset=(sx+.5-w*.5)/focal,rx=forward[0]+right[0]*offset,ry=forward[1]+right[1]*offset;
      let ix=Math.floor(cam.x),iy=Math.floor(cam.y);const stepx=rx<0?-1:1,stepy=ry<0?-1:1;
      const dx=1/Math.max(1e-9,Math.abs(rx)),dy=1/Math.max(1e-9,Math.abs(ry));
      let tx=(rx<0?cam.x-ix:ix+1-cam.x)*dx,ty=(ry<0?cam.y-iy:iy+1-cam.y)*dy,side=0,distance=.01;
      for(let n=0;n<48;n++){
        if(tx<ty){ix+=stepx;distance=tx;tx+=dx;side=0}else{iy+=stepy;distance=ty;ty+=dy;side=1}
        if(closed(ix,iy)){
          // Free-standing posts and wall faces sit behind the tile edge, opening the covered galleries.
          const inset=.31,minX=ix+(closed(ix-1,iy)?0:inset),maxX=ix+1-(closed(ix+1,iy)?0:inset);
          const minY=iy+(closed(ix,iy-1)?0:inset),maxY=iy+1-(closed(ix,iy+1)?0:inset);
          const entryX=((stepx>0?minX:maxX)-cam.x)/(rx||1e-12),entryY=((stepy>0?minY:maxY)-cam.y)/(ry||1e-12);
          const entry=Math.max(entryX,entryY);
          if(entry<=Math.min(tx,ty)+.0001){distance=Math.max(distance,entry);side=entryX>entryY?0:1;break}
        }
      }
      distance=Math.max(.05,distance);depths[sx]=distance;
      const span=focal*ceiling/distance,y0=horizon-(ceiling-eye)*focal/distance,y1=y0+span;
      const hit=side?cam.x+rx*distance:cam.y+ry*distance;
      let u=Math.floor((hit-Math.floor(hit))*S);if(side?ry>0:rx<0)u=127-u;
      const salt=Math.abs(ix*11+iy*7+side*3+theme);
      const caveSide=bridge&&side===0&&iy>=1&&iy<=3?(ix===1||ix===5?-1:ix===3||ix===7?1:0):0;
      const key=(iy===0&&ix===4)?"door":bridge
        ?(caveSide===-1?"window":caveSide===1?"panel":salt%6===2?"window":salt%6===0?"panel":"shelf")
        :materials[salt%5],mat=tex[key];
      const brightness=(side?.99:.87)/(1+distance*.085),fog=Math.min(.62,distance*.065);
      const lampU=(u-65)/88;
      for(let yy=Math.max(0,Math.ceil(y0));yy<Math.min(h,Math.ceil(y1));yy++){
        const v=clamp(Math.floor((yy+.5-y0)*S/span),0,127),lampV=(v-49)/82;
        const pool=(key==="panel"||key==="shrine")?Math.max(0,1-lampU*lampU-lampV*lampV)*.24:0;
        const arch=(.84+.16*Math.min(1,Math.min(v,128-v)/16))*(.92+.08*Math.min(1,Math.min(u,128-u)/8));
        write((yy*w+sx)*4,mat,(v*S+u)*4,brightness*arch+pool,fog);
      }
    }
    const projection={a,depths,horizon,eye,focal,forward,right};
    const lamps=bridge?bridgeArches(px,tex.arch,projection,cam,w,h):[];
    c.putImageData(image,0,0);
    if(bridge){
      for(const [x,y,scale] of lamps)warmLantern(c,x,y,scale);
      const eyePool=c.createRadialGradient(w*.50,h*.43,h*.13,w*.50,h*.46,Math.max(w*.59,h*.72));
      eyePool.addColorStop(0,"#8cc7bb12");eyePool.addColorStop(.58,"#091b2313");eyePool.addColorStop(1,"#061015b3");
      rect(c,0,0,w,h,eyePool);
    }
    return projection;
  }
  const bridgeRibs=[
    [4.5,6.08,false,.57],[4.5,4.30,false,.56],[4.5,3.69,false,.57],
    [3.08,3.5,true,.57],[5.92,3.5,true,.57],
    [2.5,3.12,false,.63],[6.5,3.12,false,.63],
    [2.5,1.90,false,.58],[6.5,1.90,false,.58],[4.5,1.5,true,.63]
  ];
  function bridgeArches(pixels,stone,f,cam,w,h){
    const nearest=.12,depth=new Float32Array(w*h);
    const point=(x,y,height,u=0,v=0)=>{
      const dx=x-cam.x,dy=y-cam.y;
      return [dx*f.right[0]+dy*f.right[1],f.eye-height,dx*f.forward[0]+dy*f.forward[1],u,v];
    };
    const screen=([x,y,z,u,v])=>{
      const iz=1/z,k=f.focal*iz;
      return [w*.5+x*k,f.horizon+y*k,iz,u*iz,v*iz];
    };
    function triangle(a,b,c,shade){
      const [ax,ay,az,au,av]=a,[bx,by,bz,bu,bv]=b,[cx,cy,cz,cu,cv]=c;
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if(Math.abs(area)<.01)return;
      const minX=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),maxX=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5));
      const minY=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),maxY=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));
      const dx=(cy-ay)/area,dy=(ay-by)/area;
      for(let y=minY;y<=maxY;y++){
        const py=y+.5-ay,px=minX+.5-ax;
        let q=(px*(cy-ay)-py*(cx-ax))/area,r=((bx-ax)*py-(by-ay)*px)/area;
        for(let x=minX,i=y*w+x;x<=maxX;x++,i++,q+=dx,r+=dy){
          const p=1-q-r;if(p<-.0001||q<-.0001||r<-.0001)continue;
          const z=p*az+q*bz+r*cz;
          if(z<=depth[i]||z<1/(f.depths[x]+.018))continue;
          depth[i]=z;
          const u=(p*au+q*bu+r*cu)/z,v=(p*av+q*bv+r*cv)/z;
          const ix=Math.floor(u*S)&127,iy=Math.floor(v*S)&127,j=(iy*S+ix)*4;
          const joint=Math.abs(v*4-Math.round(v*4));
          const light=shade*(joint<.022?.58:joint<.04?1.21:1)*(.72+.28*Math.min(1,z));
          const fog=Math.min(.7,.077/z),k=i*4;
          pixels[k]=stone[j]*light+14*fog;
          pixels[k+1]=stone[j+1]*light+25*fog;
          pixels[k+2]=stone[j+2]*light+26*fog;
        }
      }
    }
    function face(points,shade){
      const clipped=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],aIn=a[2]>=nearest,bIn=b[2]>=nearest;
        if(aIn)clipped.push(a);
        if(aIn!==bIn){
          const t=(nearest-a[2])/(b[2]-a[2]);
          clipped.push(a.map((n,k)=>n+(b[k]-n)*t));
        }
      }
      const p=clipped.map(screen);
      for(let i=1;i<p.length-1;i++)triangle(p[0],p[i],p[i+1],shade);
    }
    const lamps=[];
    for(const [x,y,cross,span] of bridgeRibs){
      if(Math.hypot(x-cam.x,y-cam.y)>6.3)continue;
      const outer=[[-span,0],[-span,.86],[-span*.75,1.14],[-span*.43,1.34],
        [0,1.40],[span*.43,1.34],[span*.75,1.14],[span,.86],[span,0]];
      const inner=outer.map(([u,v],i)=>[u*.78,v-(i===0||i===8?0:i===1||i===7?.03:.15)]);
      const pointOn=([u,v],d,side)=>point(x+(cross?d:u),y+(cross?u:d),v,(side?d:u)*1.3,-v*1.16);
      const half=.098;
      for(let i=0;i<outer.length-1;i++){
        const a=outer[i],b=outer[i+1],m=inner[i],n=inner[i+1];
        for(const d of [-half,half]){
          face([pointOn(a,d),pointOn(b,d),pointOn(n,d),pointOn(m,d)],d>0?1.10:.95);
        }
        face([pointOn(m,-half,true),pointOn(n,-half,true),pointOn(n,half,true),pointOn(m,half,true)],.76);
        face([pointOn(a,-half,true),pointOn(b,-half,true),pointOn(b,half,true),pointOn(a,half,true)],.71);
      }
      if(!cross){
        const lamp=point(x+(x===4.5?-.47:.47),y-.13,.95);
        if(lamp[2]>.42)lamps.push(screen(lamp));
      }
    }
    f.archDepth=depth;
    return lamps.sort((a,b)=>a[2]-b[2]).filter(([x,y,iz])=>{
      const ix=Math.floor(x),iy=Math.floor(y);
      return ix>=0&&ix<w&&iy>=0&&iy<h&&1/iz<f.depths[ix]+.09&&iz+.025>=depth[iy*w+ix];
    }).map(([x,y,iz])=>[x,y,clamp(f.focal*.024*iz,.5,4)]);
  }
  const spriteCache=new Map();
  function markerPic(m){
    const key=m.id+"/"+m.label;
    if(spriteCache.has(key))return spriteCache.get(key);
    const a=blank(128,132),c=a.getContext("2d");c.imageSmoothingEnabled=false;
    if(m.id==="lamp"){
      ellipse(c,64,124,30,6,"#16232483");
      polygon(c,[[43,122],[51,116],[77,116],[86,122],[76,126],[50,126]],"#787d70");
      polygon(c,[[50,117],[54,112],[74,112],[80,118],[69,121]],"#a29d82");rect(c,59,78,9,36,"#826044");
      rect(c,60,78,2,37,"#ceaa70");rect(c,55,76,18,5,"#937046");warmLantern(c,64,54,2.25);
    }else if(m.id==="fork"){
      rect(c,61,61,5,64,"#514132");rect(c,61,62,1,63,"#b69460");
      for(let i=0;i<2;i++){
        const y=33+26*i,arr=i?[[7,y],[109,y],[123,y+10],[109,y+20],[7,y+20]]:[[5,y+10],[19,y],[120,y],[120,y+20],[19,y+20]];
        polygon(c,arr,"#353429");line(c,arr.concat([arr[0]]),"#b59663",2);
        c.fillStyle=i?"#edca86":"#bbd6c5";c.textAlign="center";c.font='bold 14px "Tower Script","Microsoft YaHei",sans-serif';c.fillText(m.label[i],64,y+15);
      }
    }else{
      rect(c,60,61,7,63,"#6a4d37");rect(c,61,61,2,63,"#bd9664");
      polygon(c,[[26,29],[91,29],[101,40],[97,65],[38,66],[26,56]],"#423d31");
      line(c,[[29,32],[89,32],[97,41],[94,59],[39,62]],"#d6ad66",2);
      c.fillStyle="#f4d799";c.textAlign="center";c.font='bold 18px "Tower Script","Microsoft YaHei",sans-serif';c.fillText(m.label||"路口",64,53);
      polygon(c,[[41,64],[52,64],[50,82],[45,77],[40,84]],"#a74e3d");
    }
    spriteCache.set(key,a);return a;
  }
  function item(c,id,x,y,size){
    const art={ash:"merch-ash",shell:"merch-ink-shell",clasp:"merch-fox-clasp"}[id];
    const im=art&&TowerSprites.get(art);
    if(!im){HuntArt.drawItem(c,id,x,y,size);return}
    const scale=size/Math.max(im.width,im.height),w=im.width*scale,h=im.height*scale;
    c.drawImage(im,Math.round(x-w*.5),Math.round(y-h*.5),Math.round(w),Math.round(h));
  }
  function clipAtDepth(c,f,z,left,right,top,bottom){
    const {width:w,height:h}=f.a;
    c.beginPath();
    if(z>.24){
      const lo=Math.max(0,Math.floor(left)),hi=Math.min(w,Math.ceil(right)),iz=1/z;
      for(let y=Math.max(0,Math.floor(top));y<Math.min(h,Math.ceil(bottom));y++){
        let run=-1;
        for(let x=lo;x<=hi;x++){
          const visible=x<hi&&z<f.depths[x]+.025&&(!f.archDepth||iz>=f.archDepth[y*w+x]);
          if(visible&&run<0)run=x;
          else if(!visible&&run>=0){c.rect(run,y,x-run,1);run=-1}
        }
      }
    }
    c.clip();
  }
  function markers(c,f,cam,nav,w,h){
    const list=[...(nav.markers||[])];
    const left=list.find(m=>m.x===2&&m.y===3),right=list.find(m=>m.x===6&&m.y===3);
    if(left&&right)list.push({id:"fork",label:["← "+left.label,right.label+" →"],x:4,y:2.24});
    const projected=[];
    for(const m of list){
      const shoulder=nav.theme===2 && m.id==="rat" ? .29 : 0;
      const dx=m.x+.5-cam.x,dy=m.y+.5+shoulder-cam.y,z=dx*f.forward[0]+dy*f.forward[1];
      if(z<.27)continue;
      const offset=dx*f.right[0]+dy*f.right[1],x=w/2+offset*f.focal/z;
      const size=Math.min(h*.95,f.focal*(m.id==="lamp"?.8:.83)/z),foot=f.horizon+f.eye*f.focal/z;
      if(x+size*.5<0||x-size*.5>w||foot-size>h)continue;
      projected.push({m,z,x,size,foot});
    }
    projected.sort((a,b)=>b.z-a.z);
    for(const b of projected){
      const {m,z,x,size,foot}=b,wid=size*128/132;
      c.save();clipAtDepth(c,f,z,x-wid*.5,x+wid*.5,foot-size,foot);
      c.drawImage(markerPic(m),Math.round(x-wid*.5),Math.round(foot-size),Math.round(wid),Math.round(size));c.restore();
    }
  }
  const frontCache=new Map();
  function frontSkin(id,part){
    const im=window.TowerSprites?.get("crawl-"+id);
    if(!im||part==="full")return im;
    const key=id+part;if(frontCache.has(key))return frontCache.get(key);
    const a=blank(im.width,im.height),c=a.getContext("2d");c.drawImage(im,0,0);
    if(id==="fox"){
      c.save();
      if(part==="chipped"){c.beginPath();c.moveTo(128,238);c.lineTo(151,227);c.lineTo(150,253);c.lineTo(137,249);c.closePath();c.clip()}
      ellipse(c,129,238,14,14,"#302b2e");ellipse(c,129,238,10,10,"#463d39");ellipse(c,129,238,6,6,"#272c31");
      for(const [x,y] of [[128,226],[117,238],[129,249],[139,238]])rect(c,x,y,2,2,"#927953");
      if(part==="chipped")line(c,[[140,230],[130,236],[132,240],[138,246]],"#d6a15c",1.7);
      c.restore();
    }else{
      // Keep the painted blossoms, bronze ribs and silk folds when the warm emission goes out.
      const x0=122,y0=151,cw=75,ch=66;
      try{
        const patch=c.getImageData(x0,y0,cw,ch),rgba=patch.data;
        for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
          const u=(x+x0-159)/35.8,v=(y+y0-184)/31.8;
          const weight=clamp((1.04-u*u-v*v)*8);if(!weight)continue;
          const i=(y*cw+x)*4,R=rgba[i],G=rgba[i+1],B=rgba[i+2],l=.34*R+.53*G+.13*B;
          const cold=[l*.49+6+(R-G)*.06,l*.43+9,l*.40+14];
          for(let k=0;k<3;k++)rgba[i+k]=rgba[i+k]*(1-weight)+cold[k]*weight;
        }
        c.putImageData(patch,x0,y0);
      }catch{
        c.save();c.beginPath();c.ellipse(159,184,36,32,0,0,TAU);c.clip();
        c.filter="saturate(.2) brightness(.48)";c.drawImage(im,0,0);c.restore();
      }
    }
    frontCache.set(key,a);return a;
  }
  function scaleAt(f,z,x=0){
    return {x:f.a.width*.5+x*f.focal/z,y:f.horizon+f.eye*f.focal/z,scale:f.focal/z,depth:z};
  }
  function drawRat(c,x,y,width,t,pose,reduced,swipe){
    const rest=TowerSprites.get("crawl-rat");
    const attack=pose==="attack"&&TowerSprites.get("crawl-rat-swipe");
    const im=attack||rest;if(!im)return;
    const breath=reduced?0:Math.sin(t*2.8)*.013;
    const top=width*im.height/im.width*(1+breath);
    const hit=pose==="hit";
    c.save();
    ellipse(c,x+width*.06,y-width*.026,width*.43,width*.045,"#08181dc0");
    for(const dx of [-.36,-.04,.34])ellipse(c,x+width*dx,y-width*.016,width*.068,width*.014,"#152729");
    c.translate(Math.round(x+(hit?-width*.028:0)),Math.round(y));
    if(hit){c.rotate(-.035);c.filter="brightness(1.33) sepia(.2)"}
    if(pose==="warn"&&!attack)c.transform(1,0,-.07,.96,0,0);
    c.drawImage(im,-Math.round(width*.5),-Math.round(top),Math.round(width),Math.round(top));
    c.restore();
    if(swipe){
      // Visible contact at the basket lip. The planted paws stay on the floor plane.
      const {x:tx,y:ty}=swipe;
      const a=Math.max(3,width*.025);
      c.save();c.globalAlpha=swipe.alpha*.88;
      line(c,[[tx+a*.45,ty-a*.4],[tx+a*1.25,ty-a*1.15]],"#fae4ac",1);
      line(c,[[tx+a*.71,ty+.4],[tx+a*1.56,ty+a*.12]],"#edbd75",1);
      rect(c,Math.round(tx+a*.62),Math.round(ty-a*1.07),1,1,"#fff0bf");
      c.restore();
    }
  }
  function beast(c,id,x,y,width,t,pose,reduced,part,swipe){
    if(id==="rat"){drawRat(c,x,y,width,t,pose,reduced,swipe);return}
    const im=frontSkin(id,part)||window.HuntScene?.quarryImage(id,part)||TowerSprites.get(id==="fox"?"warden":"moth");
    if(!im)return;
    const height=width*im.height/im.width,beat=reduced?0:Math.sin(t*(id==="moth"?5.7:2.4));
    const wiggle=id==="moth"?beat*width*.009:0;
    ellipse(c,x,y+1,width*(id==="fox"?.39:.24),width*.028,"#10202281");
    for(let i=0;i<14;i++){
      const y0=Math.round(im.height*i/14),y1=Math.round(im.height*(i+1)/14),s=1+(id==="moth"?.07:.024)*beat*Math.max(0,1-i/8);
      c.drawImage(im,0,y0,im.width,y1-y0,x-width*s/2,y-height+height*y0/im.height+wiggle,width*s,height*(y1-y0)/im.height+.2);
    }
  }
  function gauntlet(c,x,y,size){
    c.save();c.translate(x,y);c.scale(size,size);
    polygon(c,[[-87,63],[-56,16],[-24,-7],[-4,-4],[12,7],[-3,27],[-35,63]],"#202d33");
    polygon(c,[[-82,61],[-55,24],[-28,4],[-18,12],[-43,53],[-48,63]],"#315155");
    polygon(c,[[-56,23],[-22,-6],[-2,-3],[6,8],[-20,29],[-37,37]],"#3a3b38");
    for(let i=0;i<3;i++)line(c,[[-46+i*9,20-i*6],[-33+i*9,32-i*6],[-26+i*9,30-i*6]],i%2?"#67766c":"#bc9558",3);
    polygon(c,[[-11,2],[0,-8],[7,-9],[14,-6],[17,-1],[12,6],[7,8],[7,12],[1,15],[-9,9]],"#b68c65");
    line(c,[[1,-5],[7,-7],[12,-4]],"#e0b890",2);
    for(let n=0;n<3;n++)line(c,[[3-n*2,1+n*3],[8-n*2,3+n*3],[12-n*2,1+n*3]],"#705544",1);
    c.restore();
  }
  function weapon(c,id,w,h,k,block,t,reduced,contact=null){
    const tool=["knife","hook","buckler"].includes(id)?id:"knife",grip=tool==="knife"?[24,74]:tool==="hook"?[28,76]:[46,47];
    const size=Math.min(w*.32,h*.53)*(1+.10*k);
    let x=w*(.12+.10*k)+((reduced||block)?0:Math.sin(t*1.4)*1.2),y=h*(.79-.13*k);
    const angle=block?-.42*k:.16+.32*k;
    const tip=tool==="knife"?[88,8]:tool==="hook"?[76,35]:[83,42];
    const dx=tool==="buckler"?(tip[0]-48)*size*.9/96:(tip[0]-grip[0])*size/96;
    const dy=tool==="buckler"?(tip[1]-48)*size*.9/96:(tip[1]-grip[1])*size/96;
    const tipX=dx*Math.cos(angle)-dy*Math.sin(angle),tipY=dx*Math.sin(angle)+dy*Math.cos(angle);
    if(contact){x+=(contact.x-tipX-x)*k;y+=(contact.y-tipY-y)*k}
    c.save();c.translate(x,y);c.rotate(angle);
    if(tool!=="buckler")item(c,tool,(48-grip[0])*size/96,(48-grip[1])*size/96,size);
    gauntlet(c,0,0,Math.min(w*.0042,h*.0055));
    if(tool==="buckler")item(c,tool,0,0,size*.9);
    c.restore();
    return {x:x+tipX,y:y+tipY};
  }
  function grounded(c,id,x,y,size,angle){
    const thick=id==="ash"||id==="shell",flat=thick?.82:.54;
    ellipse(c,x,y,size*(thick?.33:.34),size*.049,"#16272aa0");
    c.save();c.translate(x,y);c.transform(1,0,-.16,flat,0,0);c.rotate(angle);
    item(c,id,0,-size*(thick?.18:.16),size);c.restore();
  }
  const basketArt=new Map();
  function basketImage(state){
    if(basketArt.has(state))return basketArt.get(state);
    const a=blank(88,76),c=a.getContext("2d"),ink="#302b27",wood="#94613f",pale="#e1bb77";
    const rim=[[7,29],[27,19],[79,25],[80,32],[60,43],[8,36]];
    // The wicker handle rises behind the goods; the near rim hides their lower edge.
    const handle=[[19,29],[20,20],[26,10],[34,6],[42,7],[47,12],[50,26]];
    line(c,handle,ink,6);line(c,handle,"#a5764d",3);line(c,handle.slice(1,5),pale,1);
    polygon(c,rim,ink);polygon(c,[[12,29],[29,23],[72,27],[59,35]],"#4e3e31");
    if(state==="traded")item(c,"ash",43,26,34);
    else item(c,"clasp",44,22,33);
    polygon(c,[[7,31],[60,37],[77,29],[72,60],[57,69],[14,61]],ink);
    polygon(c,[[10,35],[58,41],[55,65],[17,58]],wood);
    polygon(c,[[60,41],[75,33],[70,58],[57,65]],"#634a36");
    for(let j=0;j<5;j++){
      const y=37+j*4;
      line(c,[[12+j,y],[57,y+6],[73-j*.7,y-1]],j%2?"#b68b5d":"#765136",1.5);
    }
    for(const x of [17,27,37,48,55,66]){
      const right=x>58,y=right?37:34+(x-12)*.11;
      line(c,[[x,y],[x+(right?-3:2),y+23]],"#543e31",3);
      line(c,[[x,y],[x+(right?-3:2),y+21]],"#c19865",1.2);
    }
    for(const offset of [0,5]){
      const y=33+offset,edge=[[7,y],[59,y+6],[80,y-4]];
      line(c,edge,ink,4);line(c,edge,offset?"#997647":pale,2);
    }
    if(state==="safe"){
      const tie=[[18,25],[34,31],[51,37],[58,50],[68,62]];
      line(c,tie,ink,4);line(c,tie,"#c6ab79",2);
      polygon(c,[[55,43],[59,46],[60,53],[55,59],[55,52],[50,55]],"#7fa595");
      line(c,[[54,46],[60,50]],pale,2);
    }
    basketArt.set(state,a);return a;
  }
  function freightPlace(f,w,h,ground=(z,x)=>scaleAt(f,z,x)){
    const z=Math.max(1.10,.39*f.focal/(w*.40)),p=ground(z,.49);
    return {...p,size:Math.min(w*.22,p.scale*.31)};
  }
  function drawFreight(c,state,next,place,progress,reduced){
    if(!state)return;
    const {x,y,size}=place;
    c.save();c.translate(x,y);c.scale(size/88,size/88);
    const falling=state==="waiting"&&next==="lost";
    const drop=state==="lost"?1:falling?(reduced?(progress>=.40?1:0):smooth((progress-.36)/.50)):0;
    if(drop>=.68){
      const splash=drop<1?1-drop:0;
      for(const [lx,ly,span] of [[44,0,9],[47,4,8],[57,0,7]]){
        line(c,[[lx-span,ly],[lx,ly+1],[lx+span,ly-2]],"#8ebcba",1.3);
        if(splash)line(c,[[lx-3,ly-3],[lx-6,ly-4-splash*24]],"#d9d2a6",2);
      }
      line(c,[[37,-1],[40,-6],[48,-7],[54,-5]],"#b69a6c",2);
    }
    if(drop<.87){
      ellipse(c,-1,-1,30,4,"#19282b91");
      const held=state==="safe"||(next==="safe"&&progress>=.4);
      c.save();c.translate(31*drop,11*drop);c.rotate(drop*1.08);
      if(drop>.45){c.beginPath();c.rect(-58,-100,126,100-drop*30);c.clip()}
      c.drawImage(basketImage(held?"safe":state==="traded"?"traded":"waiting"),-44,-67);
      c.restore();
    }
    c.restore();
  }
  function bolts(c,src,target,h,p,act){
    if(p<.13||p>.67)return;
    const u=smooth((p-.13)/.29),x=src.x+(target.x-src.x)*u,y=src.y+(target.y-src.y)*u;
    const tone=act==="flare"?"#ffc15e":act==="guard"?"#9ed7c4":"#ffb56a";
    if(p<.47&&act!=="guard"){
      for(let i=4;i>=0;i--){
        const q=clamp(u-i*.048),px=src.x+(target.x-src.x)*q,py=src.y+(target.y-src.y)*q;
        const s=Math.max(2,h*(.021-i*.003));polygon(c,[[px-s,py],[px,py-s*.75],[px+s,py],[px,py+s*.75]],i%2?tone:"#fff0bc");
      }
    }
    if(p>.37){
      c.save();c.globalAlpha=clamp((.67-p)/.22);const radius=h*(.025+.11*(p-.37));
      for(let i=0;i<9;i++){const a=i*TAU/9+.22;
        line(c,[[x+Math.cos(a)*radius*.35,y+Math.sin(a)*radius*.35],[x+Math.cos(a)*radius*(i%2?1.35:1),y+Math.sin(a)*radius*(i%2?1.35:1)]],i%3?tone:"#ffedb1",Math.max(1,Math.round(h*.006)))}
      c.restore();
    }
  }
  function install(canvas,callback){
    const c=canvas.getContext("2d",{alpha:false}),merchant=HuntScene.install(canvas,()=>{}),media=matchMedia("(prefers-reduced-motion: reduce)");
    let current,fx=null,cam=null,jump=null,arrival=null,paused=false,raf=0,last=0,background=null,cacheKey="",inside=false;
    const poseOf=nav=>({x:nav.x+.5,y:nav.y+.5,angle:(Number(nav.dir)||0)*Math.PI/2});
    function cameraAt(now){
      if(!jump)return cam;
      let elapsed=now-jump.start;
      for(const {from:a,to:b,span} of jump.legs){
        if(elapsed>=span){elapsed-=span;continue}
        const k=smooth(elapsed/span);
        return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,angle:a.angle+(b.angle-a.angle)*k};
      }
      jump=null;return cam;
    }
    function shortestAngle(from,to){
      const d=to-from;
      return from+Math.atan2(Math.sin(d),Math.cos(d));
    }
    function setCamera(nav,now,instant){
      const to=poseOf(nav);
      if(cam&&to.x===cam.x&&to.y===cam.y&&Math.abs(Math.sin((to.angle-cam.angle)/2))<.001)return;
      const from=cam?cameraAt(now):null;cam=to;
      if(instant||!from||Math.hypot(to.x-from.x,to.y-from.y)>1.5){jump=null;return}
      to.angle=shortestAngle(from.angle,to.angle);
      jump={start:now,legs:[{from,to,span:170}]};
    }
    function walk(prior,next,id){
      if(media.matches)return 0;
      const now=performance.now(),from=cameraAt(now)||poseOf(prior.nav),to=poseOf(next.nav);
      to.angle=shortestAngle(from.angle,to.angle);
      const rat=next.phase==="fight"&&next.foe?.id==="rat"&&next.leg===2;
      const span=id==="step"?230:265;
      let legs;
      if(rat){
        // Keep the heading for the last step. Reveal the encounter while turning on the new tile.
        const landing={...to,angle:from.angle},turn=320;
        legs=[{from,to:landing,span},{from:landing,to,span:turn},{from:to,to,span:64}];
        arrival={view:next,at:now+span,origin:to};
      }else{
        arrival=null;
        legs=[{from,to,span}];
      }
      current=prior;fx=null;cam=to;jump={start:now,legs};last=0;wake();
      return legs.reduce((total,leg)=>total+leg.span,0);
    }
    function paint(now){
      if(!current||inside||paused||!canvas.clientWidth||!canvas.clientHeight)return;
      const revealing=arrival&&now>=arrival.at;
      const v=revealing?arrival.view:current;
      const cssW=canvas.clientWidth,cssH=canvas.clientHeight,k=Math.min(1,704/cssW,420/cssH);
      const w=Math.max(96,Math.round(cssW*k)),h=Math.max(96,Math.round(cssH*k));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;cacheKey=""}
      const nav=v.nav||fallback,camNow=cameraAt(now),key=[w,h,nav.theme,nav.rows.join("/"),camNow.x.toFixed(3),camNow.y.toFixed(3),camNow.angle.toFixed(3)].join(",");
      if(key!==cacheKey){background=field(nav,camNow,w,h);cacheKey=key}
      const f=background,t=media.matches?0:now/1000;
      c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;c.drawImage(f.a,0,0);
      if(v.phase==="walk"){
        markers(c,f,camNow,nav,w,h);
        return;
      }
      if(v.phase==="fight"&&v.foe){
        const foe=v.foe,id=foe.id,act=fx?.id;
        const ground=revealing?(z,x)=>{
          const dx=arrival.origin.x+x-camNow.x,dy=arrival.origin.y-z-camNow.y;
          const depth=dx*f.forward[0]+dy*f.forward[1];
          return {...scaleAt(f,Math.max(.24,depth),dx*f.right[0]+dy*f.right[1]),depth};
        }:(z,x)=>scaleAt(f,z,x);
        const raw=fx?clamp((now-fx.start)/fx.duration):-1,p=media.matches&&fx?(raw<.64?.42:.81):raw;
        const hurt=act==="strike"&&p>.36&&p<.61;
        const answer=act==="enemy"&&p>=0&&!v.cards?.stopped;
        const leap=answer?smooth((p-.12)/.28)*(1-smooth((p-.57)/.32)):0;
        const basketswipe=id==="rat"&&v.freight==="waiting"&&foe.intent==="掀货筐";
        const place=freightPlace(f,w,h,ground),basketGrip={x:place.x-place.size*.17,y:place.y-place.size*.43};
        const rat=ground(1.40-(basketswipe?.19:.28)*leap,(basketswipe?.24:.055)*leap-(basketswipe?.22:.05));
        const width=id==="rat"?Math.min(w*.71,rat.scale*1.33):Math.min(w*.70,h*(id==="fox"?.72:.71))*(1+.32*leap);
        const reach=basketGrip.x-width*.453;
        const cx=id==="rat"?(basketswipe?rat.x+(reach-rat.x)*leap:rat.x):w*(.5+.014*leap);
        const strikeFoot=basketGrip.y+width*.146;
        const foot=id==="rat"?(basketswipe?rat.y+(strikeFoot-rat.y)*leap:rat.y):h*(.81+.16*leap);
        const lifted=id==="moth"?h*.031:0,ty=foot-lifted;
        const fresh=fx?.after?.foe?.id===id&&p>(act==="guard"?.77:.40)?fx.after.foe:foe;
        const part=id==="fox"?(fresh.clasp==="挂在颈下"?"full":fresh.clasp==="缺了一角"?"chipped":"empty"):(fresh.core?"full":"empty");
        const warn=basketswipe||foe.damage>=4||foe.intent?.includes("伸爪"),pose=hurt?"hit":answer&&(id!=="rat"||leap>.53)?"attack":warn?"warn":"idle";
        const swipe=basketswipe&&answer&&leap>.67?{...basketGrip,alpha:smooth((leap-.67)/.33)}:null;
        // The near hand and the card strike share the target point on the animal.
        if(revealing){
          c.save();clipAtDepth(c,f,rat.depth,cx-width*.56,cx+width*.56,ty-width*.84,ty+width*.05);
        }
        beast(c,id,cx,ty,width,t,pose,media.matches,part,swipe);
        if(revealing)c.restore();
        if(id==="rat"){
          if(revealing){
            c.save();clipAtDepth(c,f,place.depth,place.x-place.size*.65,place.x+place.size*.65,
              place.y-place.size,place.y+place.size*.12);
          }
          drawFreight(c,v.freight,fx?.after?.freight,place,p,media.matches);
          if(revealing)c.restore();
        }
        c.save();if(revealing)c.globalAlpha=smooth((now-arrival.at-156)/128);
        const attack=smooth((p-.08)/.22)*(1-smooth((p-.49)/.34)),block=act==="guard"||(answer&&v.cards?.block>0);
        const gesture=act==="enemy"?(block?leap:0):attack;
        const clash=basketswipe?basketGrip:{x:cx-width*(id==="fox"?.12:id==="rat"?-.23:0),y:ty-width*(id==="fox"?.49:id==="rat"?.29:.52)};
        const tip=weapon(c,v.weapon,w,h,gesture,block,t,media.matches,block&&answer?clash:null);
        const center={x:cx-width*(id==="moth"?0:id==="fox"?.105:-.19),y:ty-width*(id==="moth"?.35:id==="fox"?.43:.31)};
        if(act==="strike"||act==="flare")bolts(c,tip,center,h,p,act);
        if(block&&gesture>.3){
          c.save();c.strokeStyle="#a8d2ba";c.globalAlpha=gesture*.8;c.lineWidth=2;
          if(answer&&leap>.87){
            for(let i=0;i<7;i++){const a=i*TAU/7-.2,s=h*(i%2?.049:.068);line(c,[[tip.x+Math.cos(a)*2,tip.y+Math.sin(a)*2],[tip.x+Math.cos(a)*s,tip.y+Math.sin(a)*s]],i%2?"#f2c67c":"#d7ecd0",2)}
          }else{c.beginPath();c.arc(tip.x-h*.025,tip.y,h*.031,-1.1,1.08);c.stroke()}c.restore();
        }
        c.restore();
      }else if(v.phase==="loot"){
        if(v.freight)drawFreight(c,v.freight,null,freightPlace(f,w,h),0,media.matches);
        const center=v.freight?.38:.45,gearX=v.freight?.52:.61;
        const id=v.loot?.id;if(id&&v.loot.qty)grounded(c,id,w*(v.offer?center:.5),h*.83,Math.min(w*.32,h*.34),-.14);
        if(v.offer)grounded(c,v.offer.id,w*gearX,h*.87,Math.min(w*.31,h*.38),.45);
      }else if(v.phase==="gather"){
        const pic=markerPic({id:"lamp",label:"旧灯台"}),sz=h*.56;
        c.drawImage(pic,w*.50-sz*.5,h*.72-sz,sz,sz);item(c,"ash",w*.58,h*.70,h*.10);
      }else markers(c,f,camNow,nav,w,h);
    }
    function loop(now){
      raf=0;if(paused||inside||document.hidden||!current)return;
      if(!last||now-last>=1000/(media.matches?8:28)-1){paint(now);last=now}
      if(jump||current.phase==="fight")raf=requestAnimationFrame(loop);
    }
    function wake(){if(!raf&&!paused&&!inside&&!document.hidden)raf=requestAnimationFrame(loop)}
    new ResizeObserver(()=>{if(!inside&&!paused&&current){paint(performance.now());wake()}}).observe(canvas);
    document.addEventListener("visibilitychange",()=>{last=0;wake()});
    return {
      walk,
      show(v,action=null){
        current=v;arrival=null;fx=action;inside=indoor.has(v.phase);
        if(inside){cancelAnimationFrame(raf);raf=0;merchant.pause(paused);merchant.show(v.phase==="market"?{...v,counterStock:false}:v,fx);return}
        merchant.pause(true);const now=performance.now();setCamera(v.nav||fallback,now,media.matches);
        if(!paused){paint(now);wake()}
      },
      pause(value){
        paused=!!value;merchant.pause(paused||!inside);
        if(paused){cancelAnimationFrame(raf);raf=0}else if(current&&!inside){paint(performance.now());wake()}
      }
    };
  }
  return {install};
})();
