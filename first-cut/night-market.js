// Original night-market scenery: a pinhole camera projects the colonnade, tiles,
// counter and brass scale. Paper, ink and character shapes are drawn at run time.
window.NightMarket = (() => {
  "use strict";
  const W=960,H=540,TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{n=clamp(n);return n*n*(3-2*n)};
  const mix=(a,b,u)=>a+(b-a)*u;
  const caches=new Map(), paths=new Map();
  function path(c,d,fill,stroke,w=1) {
    let p=paths.get(d);if(!p){p=new Path2D(d);if(paths.size<550)paths.set(d,p)}
    if(fill){c.fillStyle=fill;c.fill(p)}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.lineJoin="round";c.lineCap="round";c.stroke(p)}
  }
  function polygon(c,points,col){
    c.fillStyle=col;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
  }
  function line(c,points,col,w=1){
    c.strokeStyle=col;c.lineWidth=w;c.lineJoin="round";c.lineCap="round";c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
  }
  function oval(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);c.fill()}
  function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h)}
  function fade(c,colors){const g=c.createLinearGradient(0,0,0,H);colors.forEach(([a,b])=>g.addColorStop(a,b));return g}
  function glow(c,x,y,rx,ry,color){
    c.save();c.translate(x,y);c.scale(rx,ry);const g=c.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,color);g.addColorStop(1,"transparent");c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  function rng(n){return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
  function paper(c,x,y,s,rot,ink){
    c.save();c.translate(x,y);c.rotate(rot);polygon(c,[[0,0],[s*1.6,-s*.4],[s*1.1,s*.8],[-s*.2,s*.5]],ink);c.restore();
  }
  function camera(room,advance,look=0,lookY=0){
    const h=room==="drop"?115:205;
    const eye={x:(room==="drop"?15:5)+look*14,y:(room==="drop"?104:194)+lookY*3,z:advance*32};
    const f=710;
    return (x,y,z)=>{const k=f/(z-eye.z);return [498+(x-eye.x)*k,h+(eye.y-y)*k,k]};
  }
  function face(c,P,verts,col){polygon(c,verts.map(v=>P(...v)),col)}
  function beam(c,P,x,y,z,w,h,d,colors){
    const xr=x+w,yt=y+h,zb=z+d;
    face(c,P,[[x,yt,z],[x,yt,zb],[xr,yt,zb],[xr,yt,z]],colors[0]);
    const side=x+w*.5<5?xr:x;
    face(c,P,[[side,y,z],[side,yt,z],[side,yt,zb],[side,y,zb]],colors[2]);
    face(c,P,[[x,y,z],[x,yt,z],[xr,yt,z],[xr,y,z]],colors[1]);
  }
  function lantern(c,x,y,s,night=false){
    c.save();c.translate(x,y);c.scale(s,s);const lineCo=night?"#ab8050":"#536459";
    line(c,[[0,-65],[0,-26]],lineCo,1.3);glow(c,0,0,46,58,night?"#ff9e563d":"#f6da7b23");
    path(c,"M-12 -23 Q-21 -18 -23 -1 Q-24 17 -13 25 L11 25 Q22 17 23 -1 Q22 -18 12 -23Z",night?"#c8814d":"#afa780","#392b2e",2);
    path(c,"M-9 -21 Q-14 -7 -12 8 Q-11 20 -6 23 L6 23 Q13 6 10 -10 L7 -21Z",night?"#fad593":"#d1caa2");
    for(const q of [-15,-7,7,15])path(c,"M"+q*.7+" -21 Q"+q*1.55+" 0 "+q*.65+" 24",null,night?"#945d43":"#767e65",1);
    rect(c,-13,-25,26,4,"#353337");rect(c,-12,-24,24,1,"#e6bb77");rect(c,-12,24,24,4,"#493a36");rect(c,-7,28,14,2,"#ddac68");
    line(c,[[0,30],[0,41]],"#ba9c67",1.7);for(let i=-2;i<=2;i++)line(c,[[0,40],[i,45],[i*1.4,54-i%2]],"#985745",1);
    c.restore();
  }
  function vessel(c,x,y,s,kind=0){
    c.save();c.translate(x,y);c.scale(s,s);
    const shape="M-11 -49 Q0 -51 11 -49 L9 -45 L7 -43 L7 -32 Q11 -29 19 -23 Q25 -18 23 -10 Q22 -2 13 0 L-13 0 Q-24 -4 -23 -16 Q-21 -24 -10 -29 L-7 -33 L-7 -44 L-11 -46 Z";
    path(c,shape,kind?"#4d5154":"#365759","#222d32",1.5);
    path(c,"M-6 -43 L-3 -43 L-4 -30 Q-6 -24 -14 -20 Q-17 -14 -14 -7 L-17 -7 Q-23 -19 -13 -25 L-7 -31Z",kind?"#928f7a":"#76a198");
    oval(c,0,-49,10.5,2,"#acac8e");oval(c,0,-49,7,1,"#202d33");
    path(c,"M-20 -20 Q0 -15 21 -20 M-20 -17 Q0 -12 21 -17",null,kind?"#b69a74":"#b4ad83",1);
    path(c,"M-11 -2 Q0 -4 13 -2",null,"#98937b",1.4);c.restore();
  }
  function skyline(c,night){
    rect(c,0,0,W,H,fade(c,night?[[0,"#13242d"],[.44,"#657776"],[1,"#a67761"]]:[[0,"#274552"],[.47,"#93b8ac"],[1,"#677d72"]]));
    const rand=rng(night?31:42);
    const mx=night?284:590,my=night?127:86;
    glow(c,mx,my,85,77,night?"#e0b57e30":"#e4eaca58");oval(c,mx,my,35,35,night?"#dacc9d":"#cbdbbb");
    for(let i=0;i<40;i++){const x=rand()*920,y=rand()*110;rect(c,x,y,1+rand(),1,"#d4dec16a")}
    for(let j=0;j<4;j++){
      const pts=[[-45,350]];let x=-45,y=150+j*16;
      while(x<1010){const high=rand()*88+9;pts.push([x,y+15],[x+7,y-2],[x+15,y-high*.45],[x+20,y-high*.48],[x+27,y-high],[x+34,y-high+2],[x+43,y-high*.61],[x+53,y-high*.55],[x+65,y+4]);x+=60+rand()*32;y=150+j*18+rand()*26}
      pts.push([1020,350]);polygon(c,pts,(night?["#637672","#55696a","#40565b","#35494c"]:["#8ca99b","#72978f","#587c79","#425e60"])[j]);
    }
    for(let i=0;i<40;i++){let x=rand()*W,y=180+rand()*90;rect(c,x,y,rand()*60+15,1,"#c7c7a329")}
    for(const x of [60,320,742,835]){
      const y=183+rand()*30;rect(c,x-6,y,12,28,"#31494c");
      for(let k=0;k<3;k++)polygon(c,[[x-17+k*3,y+2-k*7],[x-7+k,y-1-k*7],[x,y-6-k*7],[x+6-k,y-1-k*7],[x+17-k*3,y+2-k*7]],"#2d4146");
    }
  }
  function backdrop(room){
    if(caches.has(room))return caches.get(room);
    const cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");const night=room==="shop";skyline(c,night);
    if(window.CutHall){
      const mountain=document.createElement("canvas");mountain.width=640;mountain.height=360;
      CutHall.draw(mountain.getContext("2d"),{width:640,height:360,t:0,reduced:true});
      c.imageSmoothingEnabled=false;c.drawImage(mountain,76,25,484,171,0,0,W,283);
      if(night)rect(c,0,0,W,283,"#27253170");
    }
    if(night){
      // Rows of objects are stored in the painted recesses of the far wall.
      rect(c,0,14,206,308,"#263634");rect(c,212,20,132,294,"#283b3c");rect(c,748,0,212,331,"#2e3033");
      for(const x of [5,89,174,217,292,760,849,933]){
        for(let y=58;y<277;y+=57){
          rect(c,x,y-41,62,49,"#273133");rect(c,x+2,y+7,65,3,"#6b5141");
          const id=(x+Math.floor(y/57))%4;
          if(id<2){vessel(c,x+15,y+5,.54,id);vessel(c,x+39,y+5,.75+id*.14,1-id)}
          else if(id===2){
            for(let k=0;k<4;k++){rect(c,x+6+k%2*4,y-1-k*5,47-k*2,4,["#796554","#626e64","#926557","#886b57"][k]);rect(c,x+9+k%2*4,y-1-k*5,2,4,"#b09b7b")}
          }else{
            rect(c,x+7,y-14,43,18,"#785540");rect(c,x+7,y-15,43,3,"#a3845c");
            rect(c,x+13,y-12,3,16,"#c1a776");rect(c,x+42,y-12,3,16,"#b7a273");rect(c,x+25,y-10,5,6,"#cfaa6f");
          }
        }
        rect(c,x-3,9,3,294,"#78523e");
      }
      path(c,"M0 0H960V23 Q809 9 672 55 Q518 97 360 49 Q181 10 0 98Z","#6a4144","#3b3233",3);
      path(c,"M0 29 Q154 -8 296 27 Q436 70 576 59 Q749 40 866 1 L960 0 Q837 25 745 44 Q508 116 345 52 Q160 6 0 91Z","#875358");
      for(let i=0;i<20;i++){
        const x=i*54-24,y=21-14*Math.sin(x/131);c.save();c.translate(x,y);c.scale(.80,.80);
        path(c,"M0 0 Q10 -15 20 -6 Q25 0 17 4 Q11 6 11 0 Q15 -5 17 -2 M0 0 Q-3 -8 -10 -9 Q-14 -4 -9 0 Q-3 4 0 0 M1 1 Q7 9 16 7",null,"#ae756854",1.4);
        c.restore();
      }
      path(c,"M0 91 Q187 2 357 54 Q523 108 675 57 Q836 8 960 20",null,"#b48a63",2);
      for(let i=0;i<45;i++){const x=i*23,y=59-28*Math.sin(x/110);line(c,[[x,y],[x+2,y+6],[x+4,y+1]],"#aa7a58",1)}
      for(const [x,y,s] of [[75,66,.9],[173,92,.53],[283,109,.38],[786,88,.47],[877,73,.72],[929,49,1.13]])lantern(c,x,y,s,true);
    }else{
      for(const x of [20,220,840,935]){
        rect(c,x,0,11,245,"#354a49");rect(c,x+2,0,2,244,"#67726a");
      }
      path(c,"M0 0H960V16 Q742 -2 632 14 L342 48 Q193 64 0 90Z","#273838");
      path(c,"M0 76 Q230 47 406 23 L749 0H802 Q605 22 352 54 L0 94Z","#47584e");
      for(let i=0;i<6;i++){const x=80+i*131;lantern(c,x,22+(i%3)*13,.49)}
      const rand=rng(519);for(let i=0;i<16;i++){const x=Math.floor(rand()*W);const y=40+rand()*29;path(c,"M"+x+" 0 Q"+(x-3)+" 15 "+(x+6)+" "+y,null,"#4b4f45",1);paper(c,x+5,y,5.5,.65,"#a68e68")}
    }
    const g=c.createLinearGradient(0,0,420,0);g.addColorStop(0,"#15282d88");g.addColorStop(1,"#15282d00");rect(c,0,0,W,H,g);
    if(night){
      const warmth=c.createLinearGradient(0,0,W,100);warmth.addColorStop(0,"#422c334a");warmth.addColorStop(.52,"#2b283129");warmth.addColorStop(1,"#593d3433");rect(c,0,0,W,H,warmth);
    }
    caches.set(room,cv);return cv;
  }

  function floor(c,P,room){
    const tone=room==="shop"?["#34464a","#374548","#3e4a49","#414c4b"]:["#39504f","#415957","#4e6460","#485f5b"];
    const rand=rng(761);const p0=P(0,0,2200);rect(c,0,p0[1],960,540-p0[1],tone[0]);
    for(let z=1840;z>120;z-=80){
      for(let j=-11;j<=10;j++){
        const k=j*112+((z%160===0)?42:0);
        face(c,P,[[k+1,0,z+1],[k+110,0,z+1],[k+110,0,z+78],[k+1,0,z+78]],tone[Math.floor(rand()*tone.length)]);
        line(c,[P(k,0,z),P(k+106,0,z)],"#81938755",.7);
        if(rand()>.52){const h=k+rand()*85;line(c,[P(h,0,z+9),P(h+3,0,z+13),P(h-1,0,z+19),P(h+4,0,z+27)],"#1b35383f",1)}
      }
    }
    for(let i=0;i<125;i++){const z=240+rand()*1000,x=(rand()-.5)*1400;line(c,[P(x,0,z),P(x+1+rand()*40,0,z+1)],"#b9c6a52b",1)}
  }
  function column(c,P,x,z,h){
    const y=0;
    beam(c,P,x-12,y,z,24,9,24,["#8d8c71","#4d625b","#41514e"]);
    beam(c,P,x-9,y+9,z+3,18,12,18,["#84816a","#607269","#42554f"]);
    beam(c,P,x-7,y+21,z+4,14,h-20,16,["#84725d","#574d42","#3d403a"]);
    beam(c,P,x-7.9,25,z+3.5,16,4,17,["#9e865f","#837458","#514f40"]);
    for(let j=0;j<3;j++)beam(c,P,x-11-j*3,h-10+j*4,z-j,22+j*6,3,19+j*2,["#8f7961","#79654e","#4e4f43"]);
  }
  function colonnade(c,P,room){
    const zs=[1330,990,730,535];const xs=room==="shop"?[-235,270]:[-266,306];
    for(const z of zs){
      const high=room==="shop"?335:260;for(const x of xs)column(c,P,x,z,high);
      beam(c,P,xs[0]-18,high-3,z, xs[1]-xs[0]+36,10,20,["#726752","#414b42","#283a39"]);
    }
    for(const x of [-290,-205,-120,180,265,350])beam(c,P,x,0,1150,4,40,5,["#829484","#5c746b","#405b55"]);
    for(const x of [-310,160])beam(c,P,x,34,1150,220,2.8,4.5,["#98a58b","#586e61","#4b645e"]);
  }
  function countertop(c,P) {
    const x=-217,z=285,w=448,depth=345,y=74;
    beam(c,P,x,51,z,w,23,depth,["#796553","#302f30","#443b35"]);
    beam(c,P,x,69,z-1,w,3,depth+2,["#9a7c58","#a5835d","#75684e"]);
    beam(c,P,x,50,z-2,w,3.3,depth+5,["#695044","#84664f","#65483d"]);
    // Horizontal strips project the wood grain and brocade onto the same plane as the bowls.
    const surface=TowerSprites.get("counter"),strips=64;
    for(let i=0;i<strips;i++){
      const u=i/strips,v=(i+1)/strips,far=z+depth*(1-u),near=z+depth*(1-v);
      const left=P(x,y+.08,far),right=P(x+w,y+.08,far),lower=P(x,y+.08,near);
      c.drawImage(surface,0,u*surface.height,surface.width,surface.height/strips,
        Math.floor(left[0]),Math.floor(left[1]),Math.ceil(right[0]-left[0]),Math.max(1,Math.ceil(lower[1])-Math.floor(left[1])));
    }
    // Small carved quatrefoils on the front apron are perspective-projected.
    for(let xx=-200;xx<220;xx+=24){const q=[[xx,62,z-.8],[xx+4,65,z-.8],[xx+7,63,z-.8],[xx+11,65,z-.8],[xx+14,62,z-.8],[xx+7,58,z-.8],[xx,62,z-.8]];line(c,q.map(a=>P(...a)),"#866952",1)}
  }
  function chip(c,x,y,size,tilt=0){
    c.save();c.translate(x,y);c.rotate(tilt);c.scale(size,size);
    oval(c,0,5,27,11,"#7a5033");oval(c,0,2,27,10,"#ae7443");oval(c,0,0,27,10,"#d9a760");oval(c,-1,-1,20,6.3,"#967044");oval(c,-1,-2,17.5,5.7,"#e4bb78");
    polygon(c,[[-6,-2],[0,-4],[7,-2],[1,1]],"#473f36");line(c,[[-21,2],[-14,4]],"#fff0b0",1);line(c,[[13,3],[18,1]],"#f3d593",1);c.restore();
  }
  const sealWidth=70, sealCenterY=.436;
  let sealMask=null;
  function seal(c,x,y,s,rot=0){
    const img=TowerSprites.get("lamp-seal"),h=sealWidth*img.height/img.width;
    c.save();c.translate(x,y);c.rotate(rot);c.scale(s,s);
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";
    c.drawImage(img,-sealWidth/2,-h*sealCenterY,sealWidth,h);
    c.restore();
  }
  function sealHit(dx,dy,size,angle){
    const img=TowerSprites.get("lamp-seal");
    if(!sealMask){
      const cv=document.createElement("canvas");cv.width=img.width;cv.height=img.height;
      const brush=cv.getContext("2d",{willReadFrequently:true});brush.drawImage(img,0,0);
      sealMask=brush.getImageData(0,0,cv.width,cv.height).data;
    }
    const k=img.width/(sealWidth*size),cs=Math.cos(angle),sn=Math.sin(angle);
    const u=Math.floor((dx*cs+dy*sn)*k+img.width/2);
    const v=Math.floor((dy*cs-dx*sn)*k+img.height*sealCenterY);
    return u>=0&&u<img.width&&v>=0&&v<img.height&&sealMask[(v*img.width+u)*4+3]>=48;
  }
  function dropScene(c,s,age){
    const t=s.reduced?0:s.t||0,settle=ease(age/.78);
    // Register the drop to the flower at the centre of the painted floor inlay.
    const groundX=484-3*(s.lookX||0),groundY=508-(s.lookY||0);
    const x=groundX+24*(1-settle),y=groundY-93-75*(1-settle)+Math.sin(t*1.6)*2.5;
    c.save();c.globalCompositeOperation="screen";c.globalAlpha=.48+settle*.32;
    glow(c,groundX,groundY-2,60,14,"#c4813e60");c.restore();
    glow(c,groundX,groundY,41,6,"#101c22a8");glow(c,groundX-3,groundY-3,28,5,"#ca9a485c");
    glow(c,x,y+1,71,64,"#ffbb5222");
    for(let i=0;i<9;i++){
      const xx=groundX-85+(i*37)%176,yy=groundY-19+(i*9)%26;
      paper(c,xx,yy,1.9+i%3,(i%4)*.53,i%3?"#b59970":"#7a6752");
    }
    if(age<1.3){const a=clamp(age/1.3);for(let i=0;i<14;i++)paper(c,x+Math.sin(i*4)*a*102,y-34+Math.cos(i*2)*a*28+a*a*64,(1-a)*4+.4,i-a,"#d8aa75")}
    for(let i=0;i<12;i++){const z=(i*11.3+t*18)%89;const dx=Math.sin(i*3.4+z*.032)*(10+z*.24);rect(c,x+dx,y-z,1+i%2,1,i%4?"#d09d6291":"#ffe1a7")}
    const size=1.51,angle=-.12+.025*Math.sin(t*1.3);
    seal(c,x,y,size,angle);return {x,y,rx:62,ry:88,sealSize:size,angle};
  }

  function guideScene(c,P,s,t,look){
    const dx=-look*5;
    c.save();c.translate(dx,0);
    const hit=MarketPortraits.guide(c,t);
    c.restore();return {...hit,x:hit.x+dx};
  }

  function scalePan(c,hand,t,give,deal,keeping,look,shadowsOnly=false){
    const taken=keeping?ease(deal/.45):ease((deal-.35)/.26);
    const load=ease((give-.72)/.22)*(1-taken);
    const tremor=Math.sin(t*2)*.01+Math.sin(give*Math.PI)*.05+Math.sin(deal*TAU*1.8)*Math.exp(-deal*3)*.065;
    const hx=hand.x,hy=hand.y,angle=-.025+tremor-load*.15;
    const pivot=[hx,hy+16];
    const arm=(u,v)=>[pivot[0]+u*Math.cos(angle)-v*Math.sin(angle),pivot[1]+u*Math.sin(angle)+v*Math.cos(angle)];
    const a=arm(-70,0),b=arm(85,0),bar=arm(48+load*13,0);
    const swing=.024*Math.sin(give*Math.PI)+.014*Math.sin(t*2)-look*.014;
    const pan={x:a[0]+62*Math.sin(swing),y:a[1]+62*Math.cos(swing)};
    if(shadowsOnly){
      // Oblique lamp at upper right. Lowering the pan shortens the throw and tightens the penumbra.
      const cast=([x,y])=>[x-41+(y-hy)*.38,hy+48+(y-hy)*.64];
      const [px,py]=cast([pan.x,pan.y+12]);
      c.save();c.lineCap="round";
      line(c,[cast(a),cast(b)],"#1e202534",6);
      line(c,[cast(a),cast(b)],"#29232849",2.4);
      line(c,[cast(bar),cast([bar[0],bar[1]+28])],"#1a222542",1.7);
      const weight=cast([bar[0],bar[1]+34]);oval(c,weight[0],weight[1],7,3,"#24232652");
      line(c,[cast(a),cast([pan.x-31,pan.y]),cast([pan.x+32,pan.y]),cast(a)],"#29232a3b",1.6);
      glow(c,px,py,49-load*7,12-load*3,"#151c2382");
      oval(c,px,py,34-load*3,6-load*1.7,"#2121264b");
      const palm=cast([hx+5,hy]);glow(c,palm[0],palm[1],33,10,"#1820266c");
      line(c,[palm,cast([hx+29,hy-8]),cast([hx+54,hy-15])],"#22212746",9);
      c.restore();return pan;
    }
    // The ring is painted into the hand sprite. Its lower eye carries this short vertical link.
    line(c,[[hx,hy],[hx,hy+3],pivot],"#483b2c",2.6);
    line(c,[[hx-.3,hy+1],[hx-.3,pivot[1]-1]],"#e6c889",1);
    line(c,[a,b],"#3a2c21",4.4);
    line(c,[[a[0],a[1]-.4],[b[0],b[1]-.4]],"#c09a60",2.8);
    line(c,[[a[0],a[1]-1],[b[0],b[1]-1]],"#f5d998",1);
    for(let i=-10;i<=12;i++)line(c,[arm(i*6,0),arm(i*6,i%3===0?2.7:1.5)],i%3===0?"#fcdf9e":"#83663f",.9);
    oval(c,...pivot,2.3,2.3,"#59462e");oval(c,pivot[0]-.3,pivot[1]-.3,1.3,1.3,"#f2ce88");
    line(c,[bar,[bar[0],bar[1]+25]],"#65482e",2.1);
    line(c,[[bar[0]-.35,bar[1]],[bar[0]-.35,bar[1]+24]],"#e5c68a",.85);
    pathWeight(c,bar[0],bar[1]+28,1);
    const hanger=[a[0],a[1]+2];
    const cords=[[-28,2],[8,-4.3],[28,2]];
    function cord([dx,dy]){
      const end=[pan.x+dx,pan.y+dy];
      line(c,[hanger,end],"#5b4938",1.9);
      line(c,[[hanger[0]-.2,hanger[1]],[end[0]-.2,end[1]]],"#dbc494",.85);
      oval(c,...end,1.4,1.1,"#ac8959");
    }
    cord(cords[1]);
    c.save();c.translate(pan.x,pan.y);
    path(c,"M-34 0 Q-30 10 -11 13 Q0 15 11 13 Q30 10 34 0Z","#967346","#48382c",1.4);
    path(c,"M-28 4 Q-18 11 4 11 Q16 10 21 7",null,"#d8b476",1.1);
    oval(c,0,-.6,34,5.15,"#f3d397");oval(c,0,-.6,30.7,3.7,"#c7a66a");
    c.restore();
    if((give>.34||WeighGesture.placed)&&!keeping&&taken<1){
      const p=WeighGesture.placed?1:ease((give-.34)/.41);
      const x=mix(pan.x-57,pan.x,p)+taken*52,y=mix(pan.y+53,pan.y-4.5,p)-Math.sin(p*Math.PI)*48-taken*21;
      c.save();c.translate(x,y);c.scale(1,.82-p*.15);c.globalAlpha=1-taken;
      seal(c,0,0,.43,-.38);c.restore();
    }
    cord(cords[0]);cord(cords[2]);
    oval(c,...hanger,1.8,1.65,"#d7b377");
    return {x:pan.x,y:pan.y,rx:52,ry:36};
  }
  function pathWeight(c,x,y,s){
    c.save();c.translate(x,y);c.scale(s,s);
    path(c,"M-3 -3 Q0 -7 3 -3 L4 0 L10 12 Q0 17 -9 12 L-4 0Z","#ad8953","#463929",1.5);
    path(c,"M-2 0 L2 -1 L0 7 L-4 10Z","#efd39a");line(c,[[-7,12],[2,14],[8,11]],"#dcc68f",1);c.restore();
  }
  function purse(c,x,y,s,tied){
    const im=TowerSprites.get(tied?"seal-purse-tied":"seal-purse");
    if(!im)return;
    const h=66*s,w=h*im.width/im.height;
    glow(c,x,y+14*s,w*.52,5*s,"#2115139c");
    c.drawImage(im,x-w/2,y+16*s-h,w,h);
  }
  function drawGrit(c,s,t,look){
    const x=638-look*10,y=452,im=TowerSprites.get("grit"),gold=s.mode==="sharpened";
    const width=gold?110:150,height=width*im.height/im.width;
    glow(c,x,475,100,14,"#130e15b8");c.drawImage(im,x-width/2,481-height,width,height);
    if(gold){
      const walk=s.reduced?1:ease(s.progress);
      c.save();c.translate(x-70,y+19);c.rotate(-.25);
      polygon(c,[[-40,3],[-8,-7],[115,-8],[141,-4],[121,2],[-8,4]],"#587579");
      polygon(c,[[-8,-6],[111,-7],[141,-4],[-8,0]],"#c5d3bd");
      line(c,[[-7,3],[123,0],[140,-4]],"#ffcc70",2);
      line(c,[[1,-19],[-6,14]],"#c69855",5);
      for(let i=0;i<10;i++){
        const u=(i*.16+t*.72)%1,xx=walk*110-10-i*2;
        rect(c,xx+Math.cos(i)*u*15,-3-u*(12+i%4),2,2,i%2?"#de9c4a":"#ffe7a5");
      }
      c.restore();
    }
    return {x,y:y-12,rx:79,ry:60};
  }
  function drawLedger(c,table){
    const [x,y]=table(121,74.5,379);
    c.save();c.translate(x,y);c.rotate(-.06);c.scale(.94,.70);
    glow(c,2,5,74,32,"#121a19af");
    polygon(c,[[-66,-29],[-9,-29],[0,-25],[9,-28],[63,-29],[67,29],[8,32],[-1,35],[-9,31],[-63,32]],"#55382e");
    path(c,"M-63 -32 Q-30 -36 0 -24 Q27 -37 62 -31 L65 24 Q30 21 0 30 Q-30 22 -62 27Z","#b89d72","#594736",1.1);
    path(c,"M-63 -33 Q-33 -37 -2 -26 L-1 26 Q-28 19 -62 24Z","#decca0","#8b7255",1);
    path(c,"M1 -26 Q30 -38 62 -32 L64 22 Q34 17 1 26Z","#ecdcaf","#907958",1);
    path(c,"M-61 28 Q-30 23 -3 29 M4 29 Q34 21 62 25 M-58 30 Q-29 25 -7 30",null,"#d3bd94",.9);
    for(const j of [-22,-9,4,17])line(c,[[j+38,-22],[j+39,15]],"#a08b6d88",.75);
    for(let n=0;n<6;n++){
      const yy=-21+n*6;
      line(c,[[-55,yy],[-43,yy-.5],[-29,yy+1],[-9,yy+3]],"#a1836480",.7);
      line(c,[[9,yy+2],[29,yy-.3],[56,yy-.7]],"#9b7e5e76",.7);
    }
    c.save();c.translate(-36,-5);c.rotate(.08);rect(c,-8,-8,16,16,"#974c3c");
    path(c,"M-5 4 V-4 H1 L3 -1 V4 M-3 0 H0 M4 -4 V4",null,"#e6c394",1.3);c.restore();
    line(c,[[1,-24],[0,25],[4,30],[4,36],[6,33],[8,35],[7,28]],"#954638",1.8);
    c.restore();return {x,y,rx:65,ry:26};
  }
  function shopScene(c,P,s,t,look,lookY){
    const give=clamp(s.give||0),deal=clamp(s.deal||0),sell=s.choice==="sell",keep=s.choice==="keep";
    const atEnd=s.mode==="receipt"||s.mode?.startsWith("final")||s.mode==="failed";
    if(atEnd){
      const moon=c.createLinearGradient(0,0,770,280);
      moon.addColorStop(0,"#152b5552");moon.addColorStop(1,"#4d7d861e");
      rect(c,0,0,W,H,moon);
    }
    const focus=1.39+give*.045,y=189-lookY*3,x=688-look*9;
    // Draw rear edge, then the figure, then nearer table surfaces. The arm projects over the edge.
    // Place the rear edge below the merchant's ribcage; the nearest edge shifts less in screen space.
    const table=(x,y,z)=>{
      const p=P(x,y,z);return [p[0],p[1]+Math.max(20,74-(p[1]-345)*.22),p[2]];
    };
    const inWorkshop=s.mode==="whet"||s.mode==="sharpened";
    const reading=s.mode==="receipt"||(s.mode==="finalStall"&&!s.hasOriginal);
    const portrait={t,give,deal,kind:s.choice||"",mode:s.mode,hasOriginal:s.hasOriginal,reduced:s.reduced};
    function fox(frontArmOnly=false){
      c.save();c.translate(x,y);c.scale(focus,focus);c.translate(-617,-172);
      const actor=FoxArt.draw(c,{...portrait,frontArmOnly});c.restore();return actor;
    }
    const actor=fox();
    const local=actor?.handle||{x:493-44*give,y:315-13*give};
    const hand={x:x+(local.x-617)*focus,y:y+(local.y-172)*focus};
    countertop(c,table);
    if(!inWorkshop&&!reading&&s.mode!=="bazaar"){
      c.save();c.beginPath();
      const desk=[table(-217,74,285),table(231,74,285),table(231,74,630),table(-217,74,630)];
      desk.forEach(([dx,dy],i)=>i?c.lineTo(dx,dy):c.moveTo(dx,dy));c.closePath();c.clip();
      c.save();c.translate(hand.x+72,hand.y+19);c.rotate(-.23);glow(c,0,0,94,19,"#1020277d");c.restore();
      scalePan(c,hand,t,give,deal,keep,look,true);
      c.restore();
    }
    fox(true);
    let pan;
    if(s.mode==="bazaar")pan={x:638,y:452,rx:1,ry:1};
    else if(inWorkshop)pan=drawGrit(c,s,t,look);
    else if(reading)pan=drawLedger(c,table);
    else pan=scalePan(c,hand,t,give,deal,keep,look);
    if(s.mode==="stall"||(s.mode==="finalStall"&&s.hasOriginal)){
      const origin={x:606-look*10,y:473};
      WeighGesture.render(c,s,pan,origin,seal);
    }
    let landed=0;
    if(keep){
      const k=ease(Math.min(1,deal/.86)),bx=630-look*13,by=483,lip=by-34;
      purse(c,bx,by,.91,deal>=.89);
      if(deal<.89){
        c.save();
        if(k>.77){c.beginPath();c.rect(0,0,W,lip);c.clip()}
        seal(c,mix(pan.x,bx,k),mix(pan.y-7,lip+12,k)-Math.sin(k*Math.PI)*59,.4-k*.14,.05-k*.23);
        c.restore();
      }
    }
    if(sell){
      const count=s.price??4;
      // The player receives this stack on the near, brocaded corner of the counter.
      const [cx,cy]=table(117,74.5,365);
      const pile=[[-10,-4,-.08],[11,-3,.11],[25,-.5,-.05],[-21,2,.13],[-5,5,.04],[14,6,-.10],[1,9,.09]];
      for(let i=0;i<count;i++){
        const stagger=.27*i/Math.max(1,count-1);
        const k=clamp((deal-.34-stagger)/.28);if(!k)continue;
        if(k>=1)landed++;
        const [offsetX,offsetY,tilt]=pile[i];
        const b=ease(k),ex=cx+offsetX,ey=cy+offsetY;
        const lift=Math.sin(k*Math.PI);
        const x=mix(hand.x+108,ex,b),y=mix(hand.y+35,ey,b)-lift*42;
        const shadow=clamp((k-.66)/.34);
        if(shadow){
          c.save();c.globalAlpha=shadow;
          glow(c,ex+1.4,ey+3,16,5,"#1015179c");
          oval(c,ex+.7,ey+2.9,11.6,3.7,"#20201b9c");c.restore();
        }
        chip(c,x,y,.43+.055*b,tilt*b+lift*.38);
      }
    }
    // Warm suspended motes originate near the lanterns and never cover the quote.
    for(let i=0;i<9;i++){const yy=(i*41-t*(3+i%3))%280,xx=725+i*31+Math.sin(i+t*.5)*8;
      rect(c,xx,yy<0?yy+280:yy,1+i%2,1,"#ddbc8573")}
    return {...pan,landed};
  }
  let previousScene="",started=0;
  function draw(ctx,s={}){
    const scene=s.scene||"shop",room=scene==="result"?"shop":scene;
    if(previousScene!==scene){started=s.t||0;previousScene=scene}
    const age=s.reduced?2:Math.max(0,(s.t||0)-started);
    const t=s.reduced?0:(s.t||0),look=Math.max(-1,Math.min(1,s.lookX||0)),ly=Math.max(-1,Math.min(1,s.lookY||0));
    const advance=room==="shop"?.46*ease(s.give||0):.17*ease(age);
    const P=camera(room,advance,look,ly);
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);
    // The far mountains respond less than the balcony, the counter and the hanging scale.
    const endMarket=s.mode?.startsWith("final")||s.mode==="receipt";
    const wall=TowerSprites.get(s.mode==="failed"?"gate":endMarket?"last-market":room==="shop"?"shop-wall":"hall");
    ctx.drawImage(wall||backdrop(room),-6-look*3,-5-ly,972,550);
    let target;
    if(s.mode==="failed"){
      rect(ctx,0,0,W,H,"#11161e69");target={x:620,y:415,rx:1,ry:1};
    }else if(room==="drop")target=dropScene(ctx,s,age);
    else if(room==="guide")target=guideScene(ctx,P,s,t,look);
    else target=shopScene(ctx,P,s,t,look,ly);
    ctx.restore();
    return {target,landed:target.landed||0};
  }
  return {draw,seal,sealHit};
})();
