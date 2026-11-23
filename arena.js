// Fixed-camera tower court. Perspective meshes and illustrated actors share world coordinates.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = n => Math.max(0, Math.min(1, n));
  const ramp = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t*t*(3-2*t); };
  const pulse = (n, a, b) => Math.sin(Math.PI * clamp((n-a)/(b-a)));
  const instances = new WeakMap();
  const assets = {};
  const palette = { stone:[.09,.12,.14,1], bronze:[.47,.29,.14,1], gold:[.91,.64,.33,1], jade:[.47,.88,.83,1] };
  const withAlpha = (c,a) => [c[0],c[1],c[2],a];
  function loadArt() {
    if (assets.court) return;
    for (const name of ['court','market','belfry','hunter','hunter-strike','hunter-guard','moth','fox','bell','bell-heavy','trader','seal']) {
      const img = new Image();
      assets[name] = {img, ready:false};
      img.onload = () => {assets[name].ready=true; window.dispatchEvent(new Event('tower-arena-ready'));};
      img.src = 'assets/'+name+'.webp';
    }
  }
  // A CPU copy of the small camera transform also drives picking and the software renderer.
  function camera(w,h,s) {
    const aspect=w/h, p=s.progress ?? 1, t=s.time||0;
    const contact=s.action==='strike' ? pulse(p,.33,.52) : 0;
    const cx = s.reduced ? 0 : Math.sin(t*.18)*.032 + contact*.028;
    const eye=[cx,2.47,8.8-contact*.10];
    const pitch=.127, co=Math.cos(pitch), si=Math.sin(pitch), f=2.58;
    function project(x,y,z) {
      const d=co*(eye[2]-z)-si*(y-eye[1]);
      return {x:.5+(x-eye[0])*f/(2*d*aspect), y:.5-(co*(y-eye[1])+si*(eye[2]-z))*f/(2*d),d};
    }
    function atX(fraction,z) { return eye[0]+(fraction-.5)*2*project(0,0,z).d*aspect/f; }
    return {aspect,eye,co,si,f,project,atX};
  }
  // Every triangle carries its world position, linear color, UV and material (solid, glow or actor).
  function vertex(list,pos,color,uv=[0,0],kind=0) {list.push(...pos,...color,...uv,kind);}
  function triangle(list,a,b,c,color) {vertex(list,a,color);vertex(list,b,color);vertex(list,c,color);}
  function quad(list,a,b,c,d,color) {triangle(list,a,b,c,color);triangle(list,a,c,d,color);}
  function panel(list,points,color,kind=0) {
    for(const i of [0,1,2,0,2,3]) vertex(list,points[i],color,[[0,0],[1,0],[1,1],[0,1]][i],kind);
  }
  function disc(list,x,y,z,rx,rz,color,kind=1) {
    panel(list,[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y,z+rz],[x-rx,y,z+rz]],color,kind);
  }
  function ring(list,x,y,z,rx,rz,width,color,parts=56,rotation=0) {
    const at=(a,inner)=>[x+(rx-inner)*Math.cos(a),y,z+(rz-inner)*Math.sin(a)];
    for(let i=0;i<parts;i++) {const a=i/parts*TAU+rotation,b=a+TAU/parts;quad(list,at(a,0),at(b,0),at(b,width),at(a,width),color);}
  }
  function vessel(list,x,z,y0,y1,r0,r1,c,sides=8) {
    for(let i=0;i<sides;i++) {
      const a=i*TAU/sides, b=(i+1)*TAU/sides, light=.70+.27*Math.cos(a+.95);
      const col=[c[0]*light,c[1]*light,c[2]*light,c[3]];
      const at=(a,y,r)=>[x+Math.cos(a)*r,y,z+Math.sin(a)*r];
      quad(list,at(a,y0,r0),at(b,y0,r0),at(b,y1,r1),at(a,y1,r1),col);
      triangle(list,[x,y1,z],at(a,y1,r1),at(b,y1,r1),c);
    }
  }
  function flame(list,x,y,z,t,scale) {
    const glow=[1,.51,.16,.24], k=scale*(1+.12*Math.sin(t*5+x));
    panel(list,[[x-k*.56,y-k*.4,z],[x+k*.56,y-k*.4,z],[x+k*.56,y+k*.9,z],[x-k*.56,y+k*.9,z]],glow,1);
    triangle(list,[x-k*.06,y,z],[x+k*.06,y,z],[x+.022*Math.sin(t*3+x),y+k*.52,z],[1,.71,.29,1]);
    triangle(list,[x-k*.033,y,z+.004],[x+k*.031,y,z+.004],[x,y+k*.26,z+.004],[1,.94,.72,1]);
  }
  function altar(list,x,z,t) {
    vessel(list,x,z,0,.14,.89,.92,palette.stone);vessel(list,x,z,.14,.22,.91,.73,palette.bronze);
    vessel(list,x,z,.22,.57,.68,.52,palette.stone);vessel(list,x,z,.57,.65,.53,.76,palette.bronze);
    vessel(list,x,z,.65,.73,.78,.74,palette.stone);ring(list,x,.739,z,.64,.64,.017,palette.gold);
    flame(list,x-.46,.75,z,t,.34);flame(list,x+.46,.75,z,t+1,.33);
  }
  function charm(list,x,y,z,t) {
    const a=t*.7, radius=.34, corners=[];
    for (let i=0;i<4;i++){const k=i*TAU/4+a; corners.push([x+Math.cos(k)*radius,y,z+Math.sin(k)*radius]);}
    for(let i=0;i<4;i++){
      const col=i%2?[.86,.54,.19,1]:[1,.80,.46,1];
      triangle(list,corners[i],corners[(i+1)%4],[x,y+.42,z],col);
      triangle(list,corners[i],corners[(i+1)%4],[x,y-.39,z],i%2?palette.bronze:palette.gold);
    }
  }
  // The engraved circle sits flush with the painted stone. Its ticks share the same depth as the actors.
  function paving(list,cam) {
    const z=1.46, radius=Math.min(3.95,cam.aspect*2.55);
    ring(list,0,.008,z,radius,1.64,.013,[.80,.68,.48,.34],88);
    ring(list,0,.009,z,radius*.96,1.57,.008,[.87,.72,.51,.26],88);
    for(let i=0;i<48;i++){
      const a=i*TAU/48,b=a+.006;
      const pt=(r,a)=>[Math.cos(a)*radius*r,.012,z+Math.sin(a)*1.64*r];
      quad(list,pt(.97,a),pt(1,a),pt(1,b),pt(.97,b),[.82,.67,.44,.54]);
    }
  }
  function layout(cam,s) {
    const t=s.time||0, p=s.progress??1, fight=s.phase==='fight', start=s.phase==='start';
    const combatant=['moth','fox','bell'][s.floor-1]||'moth';
    const contact=ramp(.20,.34,p)*(1-ramp(.47,.83,p));
    const strike=fight&&s.action==='strike', guard=fight&&s.action==='guard';
    const reply=s.enemyReplies ? pulse(p,.63,.97) : 0;
    const heroZ=start?.55:1.3, enemyZ=-.48;
    const narrow=cam.aspect<1.05;
    let hx=cam.atX(start?.69:(!fight&&s.phase!=='shop'?.34:(narrow?.26:.345)),heroZ);
    let ex=cam.atX(narrow?.73:.675,enemyZ);
    const gap=ex-hx;
    const lunge=strike ? contact*.68 - pulse(p,.015,.20)*.055 : 0;
    hx+=gap*lunge;
    ex +=gap*((strike?pulse(p,.34,.61)*.058:0)-reply*(s.floor===3?.15:.33));
    const hz=heroZ+lunge*(enemyZ-heroZ), ez=enemyZ+reply*.36;
    const breath=(s.reduced?0:Math.sin(t*2.4))*.011;
    const heroH=(start?3.42:2.72)*(1+breath*.5)*(guard?1-.15*pulse(p,.12,.78):1);
    const tilt=strike ? (-.07*pulse(p,.01,.2)+.12*contact) : guard ? -.10*pulse(p,.12,.8) : .006*Math.sin(t*1.3);
    const attackPose=strike&&p>.19&&p<.65&&assets['hunter-strike']?.ready;
    const guardPose=guard&&p>.12&&p<.84&&assets['hunter-guard']?.ready;
    const actors=[{name:attackPose?'hunter-strike':guardPose?'hunter-guard':'hunter',x:hx,z:hz,y:0,h:attackPose?heroH*.90:heroH,tilt,flash:s.hurt?pulse(p,.73,.87)*.24:0,limit:attackPose?.68:start?.51:.46}];
    if(fight || s.phase==='lost'){
      const moth=combatant==='moth';
      const h=[2.42,2.95,3.68][s.floor-1]||2.5;
      const bellRaised=combatant==='bell'&&s.heavy&&reply<.4&&assets['bell-heavy']?.ready;
      actors.push({name:bellRaised?'bell-heavy':combatant,x:ex,z:ez,y:moth?.53+Math.sin(t*2.4)*.09+(s.heavy?.18:0):0,
        h:h*(1+breath)*(bellRaised?1.08:s.heavy&&combatant==='bell'?.94:1),tilt:(moth?.025*Math.sin(t*2):0)+(strike?.13*pulse(p,.34,.6):0)-reply*.12,
        flash:strike||s.echoTriggered?pulse(p,.33,.51)*.53:0,limit:.49});
    }else if(s.phase==='shop'){
      actors.push({name:'trader',x:ex,z:-.12,y:0,h:3.17*(1+breath*.55),tilt:.005*Math.sin(t*1.2),flash:0,limit:.56});
    }
    const anchor=actors.at(-1);
    const object=['reward','prep','route','won'].includes(s.phase);
    const objectX=cam.atX(.63,-.2), objectZ=-.2;
    const mid=object?cam.project(objectX,1.02,objectZ):cam.project(anchor.x,anchor.y+anchor.h*.54,anchor.z);
    const high=object?cam.project(objectX,1.78,objectZ):cam.project(anchor.x,anchor.y+anchor.h*.94,anchor.z);
    const ry=Math.abs(high.y-mid.y);
    return {actors,object,objectX,objectZ,bounds:{x:mid.x,y:mid.y,rx:object?.10:Math.min(.24,.085+ry/cam.aspect*.53),ry:Math.max(.12,ry)}};
  }
  function bladeTip(actor,cam) {
    const geo=spriteGeometry(cam,actor);
    if(!geo)return [actor.x+.4,actor.h*.72,actor.z+.02];
    // The strike plate's point and the guard are on the same horizontal scanline, 28% down.
    return [actor.x+geo.w*.494+actor.tilt*geo.h*.718,actor.y+geo.h*.718,actor.z+.022];
  }
  function drawEffects(list,cam,s,arrangement) {
    const t=s.time||0, p=s.progress??1, hero=arrangement.actors[0], foe=arrangement.actors[1];
    if(s.phase==='fight'&&foe){
      if(s.heavy) ring(list,foe.x,.024,foe.z,.84,.55,.034,[.88,.30,.17,.60+.14*Math.sin(t*3)],32,t*.23);
      if(s.armed||s.action==='cast'||s.echoTriggered){
        const focus=s.echoTriggered?foe:hero;
        for(let i=0;i<3;i++){
          const r=.65+i*.24+.18*Math.sin(t*3+i);
          ring(list,focus.x,.06+.09*i,focus.z,r,r*.75,.022,palette.jade,6+i*3,t*(i%2?-1:1));
        }
      }
      if(hero.name==='hunter-strike'&&p>.19&&p<.62){
        const strength=1+.12*Math.min(3,s.upgrades||0)+(s.focusStrike?.24:0);
        const cut=ramp(.19,.33,p), fade=1-ramp(.40,.60,p),g=spriteGeometry(cam,hero);
        const [x,y,z]=bladeTip(hero,cam), length=g.w*.24*strength;
        const tip=[x+.16*cut*strength,y+.006,z];
        triangle(list,[x-length,y-.023*cut,z],[x-length*.3,y+.026*cut,z],tip,[1,.70,.32,fade*.55]);
        triangle(list,[x-length*.95,y-.009,z+.002],[x-length*.22,y+.009,z+.002],tip,[.86,.98,1,fade*.92]);
      }
      if(s.action==='guard' && p>.08 && p<.94){
        const g=pulse(p,.08,.94);const x=hero.x+.32, y=1.24,z=hero.z+.06;
        for(let i=0;i<36;i++){
          const at=(a,r)=>[x+Math.cos(a)*r*.35,y+Math.sin(a)*r,z+Math.cos(a)*r*.55];
          const a=i*TAU/36,b=(i+1)*TAU/36;
          quad(list,at(a,1),at(b,1),at(b,.965),at(a,.965),[.69,.93,.9,g]);
          triangle(list,[x,y,z],at(a,1),at(b,1),[.38,.84,.83,g*.12]);
        }
      }
      const emission=s.action==='strike'||s.echoTriggered?pulse(p,.33,.83):0;
      if(emission>0){
        const q=clamp((p-.33)/.50);
        const at=s.action==='strike'?bladeTip(layout(cam,{...s,progress:.38}).actors[0],cam):[foe.x,foe.y+.49*foe.h,foe.z+.32];
        const [x,y,z]=at;
        for(let i=0;i<22;i++){
          const a=i*2.40, speed=.33+(i%5)*.13, dx=Math.cos(a)*speed,dy=Math.sin(a)*speed;
          const px=x+dx*q*2,py=y+dy*q*2-q*q*.3;
          triangle(list,[px,py,z],[px+.027,py+.012,z],[px+dx*.19*(1-q),py+dy*.19*(1-q),z],[1,.70+(i%3)*.10,.42,clamp(emission*1.7)]);
        }
        if(p<.47){
          const a=pulse(p,.33,.47)*.62;
          panel(list,[[x-.31,y-.30,z],[x+.31,y-.30,z],[x+.31,y+.30,z],[x-.31,y+.30,z]],[1,.86,.61,a],1);
        }
      }
      if(s.enemyReplies&&p>.64&&p<.95){
        const q=clamp((p-.64)/.31),x=foe.x+(hero.x-foe.x)*q,y=1.2+Math.sin(q*Math.PI)*.3,z=foe.z+(hero.z-foe.z)*q;
        if(s.floor===3)ring(list,foe.x,.12,foe.z,.4+q*4.4,.32+q*2.5,.07,[1,.57,.32,1-q]);
        else triangle(list,[x,y,z+.1],[x+.47,y+.10,z],[x+.14,y+.04,z],[1,.46,.30,1-q*.6]);
      }
    }
    if(!s.reduced){
      for(let i=0;i<16;i++){
        const z=-3.1+(i%5)*.63, x=cam.atX(.13+((i*.618+.007*t)% .76),z);
        const y=.18+((t*.085+i*.38)%2.8),d=.008+(i%3)*.004;
        triangle(list,[x-d,y,z],[x,y+d*1.8,z],[x+d,y,z],[.99,.75,.46,.21+.19*Math.sin(i+t)]);
      }
    }
  }
  function spriteGeometry(cam,actor) {
    const entry=assets[actor.name];if(!entry?.ready)return null;
    const ratio=entry.img.naturalWidth/entry.img.naturalHeight;
    const base=cam.project(actor.x,actor.y,actor.z);
    const maxW=actor.limit*base.d*2*cam.aspect/cam.f;
    const h=Math.min(actor.h,maxW/ratio), w=h*ratio;
    const left=actor.x-w*.5, right=actor.x+w*.5, top=actor.y+h, lean=actor.tilt*h;
    const points=[[left+lean,top,actor.z],[right+lean,top,actor.z],[right,actor.y,actor.z],[left,actor.y,actor.z]];
    return {points,entry,w,h};
  }
  // Subdivide illustrated figures at their anatomical hinges. The wings fold in depth,
  // cloth moves at the hem, and both standing feet stay anchored to the same floor point.
  function skinnedSprite(actor,geo,s) {
    const out=[], cols=10,rows=7,t=s.reduced?0:s.time||0, h=geo.h,w=geo.w, vertices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=i/cols,v=j/rows;
      let x=actor.x+(u-.5)*w+(1-v)*actor.tilt*h,y=actor.y+(1-v)*h,z=actor.z;
      if(actor.name==='moth'){
        const wing=ramp(.23,.92,u), flutter=Math.sin(t*7.8-.72*u), side=(.47-v)*1.2;
        x-=wing*(.09+.07*flutter)*w;y+=wing*side*flutter*.11*h;
        z+=wing*(.2+.33*flutter)*w;
      }else if(actor.name==='trader'){
        const tail=(1-ramp(.05,.42,u))*pulse(v,.10,.82);
        x+=tail*Math.sin(t*2.15-v*3)*.031*w;y+=tail*Math.cos(t*2.15-v*3)*.018*h;
      }else if(actor.name==='hunter'){
        const ribbon=(1-ramp(.03,.43,u))*pulse(v,.09,.76);
        y+=ribbon*Math.sin(t*3.4+u*6)*h*.036;z+=ribbon*Math.sin(t*2.8+v*4)*.048;
      }
      vertices.push({pos:[x,y,z],uv:[u,v]});
    }
    const color=[1,1,1,1];
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const p=j*(cols+1)+i;
      for(const k of [p,p+1,p+cols+2,p,p+cols+2,p+cols+1])vertex(out,vertices[k].pos,color,vertices[k].uv,2);
    }
    return out;
  }
  const vs=`attribute vec3 pos;attribute vec4 tint;attribute vec2 tex;attribute float mat;
    uniform vec3 eye;uniform vec4 cam;varying vec4 color;varying vec2 uv;varying float kind;varying vec3 ref;
    void main(){float z=eye.z-pos.z;float y=pos.y-eye.y;float d=cam.x*z-cam.y*y;
      gl_Position=vec4((pos.x-eye.x)*cam.z/cam.w,(cam.x*y+cam.y*z)*cam.z,d*1.00334-.200334,d);
      float rz=8.8-pos.z;float ry=pos.y-2.47;float rd=cam.x*rz-cam.y*ry;
      ref=vec3(pos.x*cam.z/cam.w*.5,-(cam.x*ry+cam.y*rz)*cam.z*.5,rd);
      color=tint;uv=tex;kind=mat;}`;
  const fs=`precision mediump float;uniform sampler2D sheet;uniform float flash;uniform vec2 cover;
    varying vec4 color;varying vec2 uv;varying float kind;varying vec3 ref;
    void main(){vec4 c=color;
      if(kind>3.5){c*=texture2D(sheet,uv);c.a*=uv.y*uv.y;}
      else if(kind>2.5){c*=texture2D(sheet,.5+ref.xy/ref.z*cover);}
      else if(kind>1.5){vec4 t=texture2D(sheet,uv);if(t.a<.018)discard;c*=t;c.rgb=mix(c.rgb,vec3(1.,.87,.66),flash);}
      else if(kind>.5){float r=dot(uv*2.-1.,uv*2.-1.);c.a*=pow(max(0.,1.-r),2.);}
      gl_FragColor=c;}`;
  function makeGL(gl) {
    function shader(type,source){const sh=gl.createShader(type); gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}
    const prog=gl.createProgram();
    const vert=shader(gl.VERTEX_SHADER,vs), frag=shader(gl.FRAGMENT_SHADER,fs);
    gl.attachShader(prog,vert);gl.attachShader(prog,frag);gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
    gl.deleteShader(vert);gl.deleteShader(frag);gl.useProgram(prog);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [name,size,offset] of [['pos',3,0],['tint',4,3],['tex',2,7],['mat',1,9]]){
      const a=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,40,offset*4);
    }
    const eye=gl.getUniformLocation(prog,'eye'), camLoc=gl.getUniformLocation(prog,'cam'), flash=gl.getUniformLocation(prog,'flash'), cover=gl.getUniformLocation(prog,'cover');
    const textures={};
    function texture(img){const id=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,id);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(img)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));return id;}
    const white=texture();gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
    function batch(list,name,light,depth){
      if(!list.length)return;
      let map=white;
      if(name){if(!textures[name])textures[name]=texture(assets[name].img);map=textures[name];}
      gl.bindTexture(gl.TEXTURE_2D,map);gl.uniform1f(flash,light||0);gl.depthMask(depth);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(list),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,list.length/10);
    }
    return {begin(w,h,c,imageAspect){gl.viewport(0,0,w,h);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform3fv(eye,c.eye);gl.uniform4f(camLoc,c.co,c.si,c.f,c.aspect);gl.uniform2f(cover,Math.min(1,c.aspect/imageAspect),Math.min(1,imageAspect/c.aspect));},batch};
  }
  function floorSurface(cam) {
    const out=[];
    // Back-project the painted floor onto a fixed world plane. The floor and its actors
    // then respond together to the camera, while the remote scenery stays on the horizon.
    for(let iz=0;iz<6;iz++) {
      const z0=-2.1+iz*1.48,z1=z0+1.48;
      for(let ix=-3;ix<3;ix++){
        const x0=ix*4.8*cam.aspect,x1=x0+4.8*cam.aspect;
        panel(out,[[x0,-.015,z0],[x1,-.015,z0],[x1,-.015,z1],[x0,-.015,z1]],[1,1,1,1],3);
      }
    }
    return out;
  }
  function rgba(c) {return 'rgba('+Math.round(c[0]*255)+','+Math.round(c[1]*255)+','+Math.round(c[2]*255)+','+c[3]+')';}
  function softwareBatch(ctx,list,cam,w,h) {
    const pt=i=>{const a=cam.project(list[i],list[i+1],list[i+2]);return [a.x*w,a.y*h];};
    for(let j=0;j<list.length;j+=30){
      const c=list.slice(j+3,j+7);
      if(list[j+9]===1){
        const a=pt(j), b=pt(j+10), d=pt(j+20), cx=(a[0]+d[0])/2,cy=(a[1]+d[1])/2;
        ctx.save();ctx.translate(cx,cy);ctx.scale(Math.max(1,Math.abs(a[0]-b[0])*.5),Math.max(1,Math.abs(a[1]-d[1])*.5));
        const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(c));g.addColorStop(1,rgba(withAlpha(c,0)));
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.restore();j+=30;continue;
      }
      const a=pt(j), b=pt(j+10), d=pt(j+20);
      ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...d);ctx.closePath();ctx.fillStyle=rgba(c);ctx.fill();
    }
  }
  function softwareActor(ctx,geo,actor,cam,w,h) {
    const corners=geo.points.map(v=>cam.project(...v));
    const a=corners[0], b=corners[1], d=corners[3];
    ctx.save();ctx.transform((b.x-a.x)*w,(b.y-a.y)*h,(d.x-a.x)*w,(d.y-a.y)*h,a.x*w,a.y*h);
    if(actor.flash>0)ctx.filter='brightness('+(1+actor.flash)+')';
    ctx.drawImage(geo.entry.img,0,0,1,1);ctx.restore();
  }
  function create(canvas) {
    let gl=null,backend=null;
    if(location.protocol!=='file:'){
      gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
      if(gl) try {backend=makeGL(gl);} catch(error){console.warn('Tower court shader unavailable',error);}
    }
    const entry={backend,ctx:null,canvas,surface:canvas,lost:false,scene:null};
    function software(){
      if(gl && entry.surface===canvas){
        // A canvas can own only one context type. The presentation canvas retains its hit area.
        const layer=document.createElement('canvas');Object.assign(layer.style,{position:'absolute',pointerEvents:'none'});
        layer.setAttribute('aria-hidden','true');canvas.after(layer);entry.surface=layer;
      }
      entry.ctx=entry.surface.getContext('2d');entry.backend=null;canvas.dataset.renderer='canvas2d';
    }
    if(!backend)software();else canvas.dataset.renderer='webgl';
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();entry.lost=true;software();if(entry.scene)draw(canvas,entry.scene);});
    canvas.addEventListener('webglcontextrestored',()=>{
      if(entry.surface!==canvas)entry.surface.remove();entry.surface=canvas;entry.ctx=null;entry.backend=makeGL(gl);entry.lost=false;canvas.dataset.renderer='webgl';if(entry.scene)draw(canvas,entry.scene);
    });
    entry.software=software;
    window.addEventListener('tower-arena-ready',()=>{if(entry.scene)draw(canvas,entry.scene);});
    return entry;
  }
  function draw(canvas,s) {
    loadArt();let state=instances.get(canvas);
    if(!state){state=create(canvas);instances.set(canvas,state);}state.scene=s;
    const surface=state.surface, box=canvas.getBoundingClientRect();
    if(surface!==canvas) Object.assign(surface.style,{left:canvas.offsetLeft+'px',top:canvas.offsetTop+'px',width:box.width+'px',height:box.height+'px'});
    const dpr=Math.min(1.5,window.devicePixelRatio||1,1600/Math.max(1,box.width));
    const w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
    if(surface.width!==w)surface.width=w;if(surface.height!==h)surface.height=h;
    const cam=camera(w,h,s),l=layout(cam,s);
    const selected=s.phase==='shop'?'market':s.floor===3?'belfry':s.floor===2?'market':'court';
    const room=assets[selected].ready?selected:'court';
    if(state.room!==room){canvas.style.background='center center / cover no-repeat url("assets/'+room+'.webp"), #172828';state.room=room;}
    const objects=[],effects=[],shadows=[];
    if(!state.staticStage||state.aspect!==cam.aspect){const base=[];paving(base,cam);state.staticStage=base;state.floorMesh=floorSurface(cam);state.aspect=cam.aspect;}
    const t=s.time||0;
    if(l.object){
      altar(objects,l.objectX,l.objectZ,t);
      if(s.phase==='reward'||s.phase==='won'||s.phase==='prep'){
        if(assets.seal.ready){l.actors.push({name:'seal',x:l.objectX,y:.83+Math.sin(t*2)*.074,z:l.objectZ,h:.96,tilt:Math.sin(t)*.04,flash:0,limit:.23});}
        else charm(objects,l.objectX,1.23+Math.sin(t*2)*.074,l.objectZ,t);
      }else {for(let i=0;i<3;i++)charm(objects,l.objectX+(i-1)*.33,.97+i*.14,l.objectZ,t*.7+i);}
    }
    const actors=l.actors.map(actor=>({actor,geo:spriteGeometry(cam,actor)})).filter(item=>item.geo).sort((a,b)=>a.actor.z-b.actor.z);
    for(const {actor,geo} of actors){
      const x=actor.x,z=actor.z,rx=Math.min(1.28,geo.w*.35);
      disc(shadows,x+.11,.017,z+.09,rx*1.3,.43,[.015,.021,.026,.61]);
      disc(shadows,x,.020,z,rx*.65,.21,[.012,.019,.023,.72]);
      if(actor.name==='hunter'){
        // The left boot sits near the lower edge. The rear boot is higher in the drawing,
        // so its contact point belongs farther upstage on the perspective plane.
        disc(shadows,x-geo.w*.35,.022,z+.01,geo.w*.085,.15,[.006,.009,.014,.88]);
        disc(shadows,x+geo.w*.43,.022,z-.50,geo.w*.08,.15,[.006,.009,.014,.78]);
      }
    }
    drawEffects(effects,cam,s,l);
    if(state.backend){
      const web=state.backend,photo=assets[room];
      web.begin(w,h,cam,photo.ready?photo.img.naturalWidth/photo.img.naturalHeight:1.78);
      try{
        if(photo.ready)web.batch(state.floorMesh,room,0,true);
        web.batch(state.staticStage,null,0,true);
        for(const {actor:a,geo} of actors){
          if(a.y>.15)continue;
          const floor=[], l=a.x-geo.w/2,r=a.x+geo.w/2, far=a.z+.60*geo.h;
          panel(floor,[[l,.001,far],[r,.001,far],[r,.001,a.z],[l,.001,a.z]],[.54,.68,.63,.29],4);
          web.batch(floor,a.name,0,false);
        }
        web.batch(shadows,null,0,false);web.batch(objects,null,0,true);
        for(const {actor,geo} of actors)web.batch(skinnedSprite(actor,geo,s),actor.name,actor.flash,true);
        web.batch(effects,null,0,false);
      }catch(error){state.software();return draw(canvas,s);}
    }else if(state.ctx){
      const ctx=state.ctx;ctx.clearRect(0,0,w,h);softwareBatch(ctx,state.staticStage,cam,w,h);softwareBatch(ctx,shadows,cam,w,h);softwareBatch(ctx,objects,cam,w,h);
      for(const {actor,geo} of actors)softwareActor(ctx,geo,actor,cam,w,h);
      softwareBatch(ctx,effects,cam,w,h);
    }
    // Calculate picking from the actual visible proportions, including width-constrained mobile sprites.
    if(!l.object){
      const item=actors.find(a=>a.actor===l.actors.at(-1));
      if(item){const corners=item.geo.points.map(v=>cam.project(...v));const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
        const xl=Math.min(...xs),xr=Math.max(...xs),yt=Math.min(...ys),yb=Math.max(...ys);
        return {x:(xl+xr)/2,y:(yt+yb)/2,rx:(xr-xl)*.44,ry:(yb-yt)*.48};}
    }
    return l.bounds;
  }
  window.TowerArena={draw};
})();
