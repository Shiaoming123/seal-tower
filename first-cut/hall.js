/* Zhaoying Gallery. All architecture, cliff faces, inscriptions and surface marks are
   painted on a 640 x 360 pixel grid. The seed fixes the landscape for every pose. */
(() => {
  "use strict";
  const W=640,H=360, TAU=2*Math.PI;
  let back, front;
  function layer() {
    const canvas=document.createElement("canvas");
    canvas.width=W;canvas.height=H;
    return canvas;
  }
  function noise(seed) {
    return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
  }
  function box(c,color,x,y,w,h) {
    c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  // Scanline spans have no antialiased fringes even along the fine ridges of the mountains.
  function shape(c,col,pts) {
    const lo=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1]))));
    const hi=Math.min(H-1,Math.ceil(Math.max(...pts.map(p=>p[1]))));
    c.fillStyle=col;
    for(let y=lo;y<=hi;y++){
      const sy=y+.5,cross=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[i],b=pts[(i+1)%pts.length];
        if((a[1]<=sy&&b[1]>sy)||(b[1]<=sy&&a[1]>sy))
          cross.push(a[0]+(sy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      cross.sort((a,b)=>a-b);
      for(let i=0;i+1<cross.length;i+=2){
        const x=Math.ceil(cross[i]-.5), end=Math.ceil(cross[i+1]-.5);
        c.fillRect(x,y,end-x,1);
      }
    }
  }
  function line(c,col,x0,y0,x1,y1) {
    x0=Math.round(x0);x1=Math.round(x1);y0=Math.round(y0);y1=Math.round(y1);
    const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0);
    const sx=x0<x1?1:-1,sy=y0<y1?1:-1; let e=dx+dy;
    c.fillStyle=col;
    while(true){c.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;
      const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}
    }
  }
  function arc(c,col,x,y,rx,ry,start,end) {
    let a=[x+rx*Math.cos(start),y+ry*Math.sin(start)];
    const count=Math.ceil((end-start)*Math.max(rx,ry)/3);
    for(let n=1;n<=count;n++){
      const t=start+(end-start)*n/count;
      const b=[x+rx*Math.cos(t),y+ry*Math.sin(t)];
      line(c,col,...a,...b);a=b;
    }
  }
  function disc(c,col,x,y,r) {
    for(let j=-r;j<=r;j++){const half=Math.floor(Math.sqrt(r*r-j*j));box(c,col,x-half,y+j,half*2+1,1);}
  }
  function inkPine(c,x,y,s,color){
    const path=(p)=>p.map(([a,b])=>[x+a*s,y+b*s]);
    shape(c,color,path([[-1,0],[0,-8],[-6,-11],[-10,-10],[-13,-11],[-10,-13],[-4,-13],[0,-10],[1,-15],[-5,-16],[-2,-18],[1,-19],[2,-23],[4,-24],[7,-22],[3,-21],[3,-17],[6,-17],[10,-19],[13,-17],[9,-16],[6,-16],[3,-14],[2,-7],[6,-10],[12,-10],[11,-8],[5,-8],[2,-5],[2,0]]));
  }
  function mountain(c,x,y,w,h,p,rnd) {
    const bend=(rnd()-.5)*.53, kink=.64+rnd()*.73;
    const pts=(data)=>data.map(([u,v])=>[x+(u+bend*Math.sin(v*2.5))*w,y+v**kink*h]);
    const outline=pts([[-.80,1],[-.59,.86],[-.46,.79],[-.41,.48],[-.35,.45],[-.32,.26],[-.25,.31],[-.21,.25],[-.12,.23],[-.09,.08],[-.04,.055],[0,0],[.09,.025],[.16,.21],[.23,.27],[.29,.54],[.40,.63],[.45,.60],[.51,.72],[.54,.84],[.86,1]]);
    shape(c,p[0],outline);
    shape(c,p[1],pts([[-.8,1],[-.47,.79],[-.41,.49],[-.34,.46],[-.31,.27],[-.24,.34],[-.28,.67],[-.19,.57],[-.12,.26],[-.09,.09],[0,.015],[.05,.045],[.015,.21],[-.035,.27],[-.09,.52],[-.13,.64],[-.21,.69],[-.26,.87]]));
    shape(c,p[1],pts([[.10,.30],[.15,.23],[.21,.32],[.23,.51],[.20,.47],[.23,.68],[.15,.54]]));
    for(let j=0;j<18;j++){
      const v=.25+rnd()*.6, u=-.11-v*.19+rnd()*.12;
      const l=.028+rnd()*.09;
      const seam=pts([[u,v],[u-l*.35,v+l]]);
      line(c,j%4===0?p[2]:p[0],...seam[0],...seam[1]);
    }
    for(let j=0;j<4;j++){
      const u=rnd()*.09-.05;inkPine(c,x+u*w,y+.048*h,.10+rnd()*.15,p[0]);
    }
  }
  function pagoda(c,x,y,s,p) {
    const b=(co,a,d,w,h)=>box(c,co,x+a*s,y+d*s,w*s,h*s);
    const poly=(co,a)=>shape(c,co,a.map(q=>[x+q[0]*s,y+q[1]*s]));
    b(p[0],-11,-4,22,4);
    for(let i=0;i<4;i++){
      const k=1-i*.14,base=-4-i*9;
      b(p[1],-8*k,base-6,16*k,6);
      b(p[0],-6*k,base-5,2,4);b(p[0],1*k,base-5,2,4);
      poly(p[0],[[-15*k,base-9],[-11*k,base-7],[-4*k,base-11],[0,base-13],[4*k,base-11],[11*k,base-7],[15*k,base-9],[13*k,base-5],[-13*k,base-5]]);
      b(p[2],-10*k,base-6,18*k,1);
    }
    b(p[0],-1,-47,2,7);
  }
  function sky(c,rnd) {
    // Subtle ordered dithering between adjacent sky values avoids horizontal bands.
    const ramp=[[25,50,66],[37,72,87],[65,104,115],[105,149,146],[155,180,160]];
    const bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    const skyImage=c.createImageData(W,205);
    for(let y=0;y<205;y++)for(let x=0;x<W;x++){
      const v=Math.min(3.999, y/193*3.85+.09*Math.sin(x/126+y/74));
      const k=Math.max(0,Math.floor(v)),f=Math.max(0,v-k),i=(y*W+x)*4;
      for(let j=0;j<3;j++){const n=ramp[k][j]*(1-f)+ramp[k+1][j]*f;
        skyImage.data[i+j]=Math.round((n+(bayer[y%4][x%4]-8)*.14)/2)*2;}
      skyImage.data[i+3]=255;
    }
    c.putImageData(skyImage,0,0);
    for(let i=0;i<48;i++){
      const x=rnd()*W,y=28+rnd()*98,w=7+rnd()*49;
      shape(c,"#a9c5b311",[[x,y],[x+w*.5,y-2],[x+w*.7,y-2],[x+w*.79,y-1],[x+w,y-1],[x+w*.8,y+1],[x+w*.13,y+1]]);
    }
    for(let i=0;i<83;i++){const x=rnd()*640,y=14+rnd()*100;
      box(c,i%5?"#6e9390":"#9aafa2",x,y,1,1);}
    disc(c,"#678e8b",293,106,31);disc(c,"#92b8a6",293,106,29);
    disc(c,"#b9cbb0",292,105,27);
    for(let i=0;i<330;i++){
      const x=264+rnd()*56, y=78+rnd()*57;
      const lobes=Math.sin(x*.31+y*.1)+Math.cos(y*.4-x*.14);
      if((x-292)**2+(y-105)**2<25.5**2&&lobes>.20)
        box(c,lobes>1.25?"#a7bda6":"#adc4ab",x,y,2+rnd()*3,1+rnd()*2);
    }
    for(const [y,n,w,h,cols] of [
      [149,14,73,61,["#719694","#80a39a","#8eada1"]],
      [174,10,86,70,["#527e80","#67918a","#71988d"]],
      [194,8,100,76,["#3d686c","#507c79","#648883"]]
    ]){
      for(let i=-1;i<n;i++){
        const high=h*(.28+rnd()*.85), x=i*W/(n-1)+rnd()*30;
        mountain(c,x,y-high,w*(.6+rnd()*.5),high,cols,rnd);
      }
      box(c,cols[0],0,y-1,W,15);
      for(let m=0;m<72;m++){const x=rnd()*W;
        box(c,cols[1],x,y+rnd()*5-2,4+rnd()*34,1);}
    }
    const cliff=["#325c62","#477474","#608581"];
    mountain(c,107,91,84,112,cliff,rnd);mountain(c,533,101,80,102,cliff,rnd);
    pagoda(c,112,100,.51,["#294e55","#446c6b","#62857a"]);
    pagoda(c,556,135,.38,["#31585c","#4b7270","#638579"]);
    inkPine(c,79,139,.4,"#32595c");inkPine(c,548,141,.38,"#32595c");
    for(let i=0;i<4;i++)line(c,i%2?"#79a298":"#628e88",94+i*2,148+i,93+i*2,170+i*3);
  }
  function moonGate(c) {
    // The missing wedge at the top right opens a clear sightline behind the moth's wings.
    const cx=285,cy=157,R=101;
    const pt=(a,r)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r];
    for(let i=0;i<26;i++){
      const a=(i+1.3)*TAU/26, b=a+TAU/26-.009;
      if(i>=20&&i<=22)continue;
      const pts=[pt(a,R+2),pt(b,R+2),pt(b,R-13),pt(a,R-13)];
      const side=pts.map(([x,y])=>[x-4,y+3]);
      shape(c,"#345558",side);shape(c,i%4===1?"#487471":"#426e6b",pts);
      const nib=pt(a,R+1);line(c,"#779487",...nib,...pt(b,R+1));
      line(c,"#627f76",...pt(a,R-2),...pt(b,R-2));
      line(c,"#315955",...pt(a,R-11),...pt(b,R-11));
      line(c,"#83a293",...pt(a,R-13),...pt(b,R-13));
      // Stepped fretwork follows each wedge and leaves a visibly hand-cut break between stones.
      const h=(b-a)/9;
      let last=pt(a+h,R-7);
      for(const [u,r] of [[2,R-7],[2,R-9],[4,R-9],[4,R-5],[6,R-5],[6,R-8],[8,R-8]]){
        const next=pt(a+h*u,r);line(c,"#719083",...last,...next);last=next;
      }
    }
    for(const x of [185,379]){
      box(c,"#3b6060",x-8,180,19,26);box(c,"#496f6b",x-11,197,24,4);
    }
  }
  function floor(c,rnd){
    box(c,"#294e53",0,196,W,164);box(c,"#466b68",0,196,W,2);
    // Rear parapet and five small window openings per bay.
    for(let x=-8;x<W;x+=46){
      box(c,"#25474b",x,185,4,15);box(c,"#6e9083",x-1,183,6,2);
      box(c,"#30585a",x+4,188,42,2);box(c,"#365e60",x+4,193,42,1);
    }
    const horizon=163, vanish=315;
    const rows=[200,204,211,222,239,263,298,338,369];
    const palette=["#426464","#436361","#3e5e5e","#405e5f","#3c585b","#3e5d5c"];
    for(let r=0;r<rows.length-1;r++){
      const y=rows[r],end=rows[r+1];
      const project=(i,at)=>vanish+(i+(r%2)*.5)*.71*(at-horizon);
      for(let j=-19;j<19;j++){
        const a=project(j,y),b=project(j+1,y),d=project(j,end),e=project(j+1,end);
        if(Math.max(b,e)<0||Math.min(a,d)>640)continue;
        shape(c,palette[Math.floor(rnd()*palette.length)],[[a,y],[b,y],[e,end-1],[d,end-1]]);
        line(c,"#54716b",a+1,y+1,b-1,y+1);line(c,"#345254",a,y+.5,d,end-1);
        for(let k=0;k<4;k++){
          const py=y+2+rnd()*Math.max(1,end-y-4),l=project(j,py),rr=project(j+1,py);
          const px=l+(rr-l)*(.03+rnd()*.84);
          box(c,k%2?"#496966":"#385857",px,py,2+rnd()*(rr-l)*.1,1);
        }
      }
    }
    // Broken inlaid lines around the duelling circle. Reflected rather than emissive.
    for(let j=0;j<30;j++){
      const a=j*TAU/30, b=a+TAU/30-.019;
      arc(c,"#637e75",320,267,204,34,a,b);
      arc(c,"#2c4c50",320,269,205,35,a,b);
      if(j%3!==0)arc(c,"#62776e",320,267,191,31,a,b);
      let px=320+196*Math.cos(a),py=267+32*Math.sin(a);
      line(c,"#667970",px,py,320+201*Math.cos(a+.012),267+34*Math.sin(a+.012));
    }
    for(let k=0;k<24;k++){
      const x=238+rnd()*147,y=206+rnd()*94;
      box(c,k%3?"#66837a":"#799388",x,y,2+rnd()*8,1);
    }
    // Worn edge of the near stair.
    shape(c,"#30484b",[[-4,332],[170,346],[393,348],[645,324],[645,360],[0,360]]);
    shape(c,"#526865",[[-2,331],[171,345],[393,347],[642,323],[642,326],[395,350],[170,348],[-2,334]]);
    shape(c,"#273e43",[[0,341],[169,354],[394,356],[641,333],[642,340],[394,361],[164,360],[0,347]]);
  }
  function architecture(c,rnd){
    // Left roof soffit rising out of frame: visible rafters between two rails and a carved corbel.
    shape(c,"#142d35",[[0,0],[272,0],[169,12],[99,38],[0,73]]);
    shape(c,"#294449",[[0,45],[128,9],[194,0],[213,0],[133,14],[0,57]]);
    for(let i=0;i<19;i++){
      const x=i*10-12,y=51-.29*x;
      shape(c,"#324b4b",[[x,y-13],[x+6,y-15],[x+15,y-10],[x+8,y-8]]);
    }
    line(c,"#53645a",0,57,133,15);
    shape(c,"#1c373c",[[0,61],[83,34],[78,43],[0,70]]);
    for(const [x,top,ground,w] of [[40,46,218,10],[591,10,218,11],[13,30,292,20],[628,2,302,22]]){
      const rear=w<13, main=rear?"#455656":"#343d43",hi=rear?"#67716a":"#555957";
      box(c,rear?"#32484a":"#1e3036",x-w/2,top,w,ground-top);
      box(c,main,x-w/2+2,top,w*.64,ground-top);
      box(c,hi,x-w/2+2,top,2,ground-top);
      for(let i=0;i<11;i++){let py=top+10+rnd()*(ground-top-20);box(c,rear?"#475b58":"#443f42",x-2+rnd()*4,py,1,4+rnd()*9);}
      for(let i=0;i<3;i++){
        const yy=top+3+i*5,ww=w+20-i*6;
        shape(c,i===1?"#455451":"#2a4143",[[x-ww/2-2,yy-3],[x-ww/2+3,yy],[x+ww/2-3,yy],[x+ww/2+2,yy-3],[x+ww/2,yy+3],[x-ww/2,yy+3]]);
        line(c,"#787e68",x-ww/2+3,yy,x+ww/2-3,yy);
      }
      for(const dy of [8,12])box(c,"#58675e",x-w/2-1,ground-dy,w+2,2);
      box(c,"#293f41",x-w/2-3,ground-5,w+6,6);
      box(c,"#56665e",x-w/2-2,ground-5,w+4,1);
    }
    // Asymmetric strips of dyed cloth hang close to the upper right. Their pattern has only three values.
    shape(c,"#513e46",[[531,0],[621,0],[605,31],[578,51],[572,48],[553,66],[551,60],[531,76],[536,58],[528,61],[545,35]]);
    shape(c,"#754b4d",[[546,0],[589,0],[568,32],[547,51],[554,34]]);
    shape(c,"#614247",[[596,0],[612,0],[596,25],[568,47],[579,29]]);
    for(const [ax,ay,bx,by] of [[545,55,567,32],[569,32,588,5],[560,55,585,32],[586,32,602,9]])
      line(c,"#917469",ax,ay,bx,by);
    for(let n=0;n<5;n++){
      let x=571+n*4,y=30-n*5;
      line(c,"#9b7f6b",x-3,y,x,y-4);line(c,"#9b7f6b",x,y-4,x+2,y-1);
    }
    // A bronze wind bell at one edge, its tint stays below the creature's lantern.
    const x=481;line(c,"#435554",x,0,x,23);
    [5,10,15,20].forEach(y=>box(c,"#687467",x-1,y,3,2));
    shape(c,"#3a5150",[[x-2,23],[x+2,23],[x+3,32],[x+7,36],[x+7,38],[x-7,38],[x-7,36],[x-3,32]]);
    line(c,"#768174",x-5,36,x+5,36);box(c,"#556661",x,38,1,5);
  }
  // Distant inhabited cliff: overhangs, small pines and slivers of reflected water.
  function distantDetails(c,rnd) {
    const spine=[[0,149],[11,141],[19,142],[26,133],[33,133],[40,122],[48,121],[53,111],[63,108],[66,101],[77,100],[80,105],[98,105],[104,108],[119,108],[126,113],[141,115],[135,119],[124,120],[121,134],[110,138],[108,151],[101,154],[97,166],[87,172],[80,190],[0,197]];
    shape(c,"#31545b",spine);
    shape(c,"#466d6d",[[0,152],[33,136],[45,124],[61,111],[78,102],[93,108],[122,110],[136,114],[125,117],[94,116],[82,121],[72,120],[48,133],[34,137],[13,151]]);
    shape(c,"#577c75",[[48,125],[63,110],[77,102],[89,106],[117,109],[124,112],[91,111],[75,111],[66,115]]);
    for(let j=0;j<66;j++){
      const y=121+rnd()*63,x=1+rnd()*(118-(y-121)*.53);
      const len=2+rnd()*14;
      line(c,j%3?"#416568":"#4d7470",x,y,x-len*.35,y+len);
    }
    for(let i=0;i<9;i++)inkPine(c,52+i*6,115-Math.sin(i*.4)*6,.18+rnd()*.16,"#344f53");
    inkPine(c,118,109,.58,"#304f52");inkPine(c,44,125,.43,"#35565a");
    pagoda(c,82,106,.66,["#294a50","#4d6d67","#718773"]);
    pagoda(c,60,113,.34,["#355459","#567370","#7f9281"]);
    for(let i=0;i<6;i++){const x=125+i*.77;
      line(c,i%2?"#769b90":"#658983",x,120+i%3,x-2,157+i*3);}
    // Ridge plantations at the far right. Their low-contrast broken crowns soften the peaks.
    for(let i=0;i<23;i++){
      const x=508+i*5.3,y=165+Math.sin(i*.32)*8;
      inkPine(c,x,y,.13+rnd()*.24,"#416668");
    }
    for(let i=0;i<17;i++){let y=158+i*2.2,x=rnd()*80-29;
      box(c,"#9cbdac25",x,y,24+rnd()*76,1);}
  }
  function pavingFinish(c,rnd) {
    // Slim moonlit steps and fine stone crystal on the two wet, separated planes.
    for(let i=0;i<1620;i++){
      const y=200+rnd()*133,x=rnd()*640;
      const reflection=Math.max(0,1-Math.abs(x-(297+(y-200)*.06))/(12+(y-200)*.47));
      const light=rnd()<reflection*.84, width=(.4+rnd()*3)*(1+(y-200)/70);
      box(c,light?(i%5?"#a0b79a29":"#b2c5a341"):(i%2?"#8fa79812":"#172d361e"),x,y,width,1);
    }
    for(const [x,y,sc,flip] of [[76,255,.73,1],[502,270,.9,-1],[50,324,1.3,1],[531,324,1.1,1],[280,311,.45,-1]]){
      const points=[[0,0],[11,-1],[16,1],[24,2],[27,5],[40,3],[46,5],[51,4]];
      const coord=([u,v])=>[x+u*sc*flip,y+v*sc];
      for(let i=1;i<points.length;i++){
        const a=coord(points[i-1]),b=coord(points[i]);
        line(c,"#2b494c",...a,...b);
        if(i%2)line(c,"#59726a",a[0],a[1]+1,b[0],b[1]+1);
      }
      line(c,"#355255",...coord(points[3]),x+33*sc*flip,y-3*sc);
    }
    for(let z=0;z<31;z++){
      const a=z*TAU/31,co=Math.cos(a),si=Math.sin(a);
      const at=(r,angle)=>[320+204*r*Math.cos(a+angle),267+34*r*Math.sin(a+angle)];
      if(si<.10)continue;
      const corners=[at(.945,-.015),at(.968,-.026),at(.982,0),at(.968,.022),at(.947,.012)];
      for(let i=1;i<corners.length;i++)line(c,"#7c8977",...corners[i-1],...corners[i]);
      box(c,"#789081",320+193*co,267+32*si,2,1);
    }
    // Shadows widen toward the camera, anchoring the four pillars at the edges.
    shape(c,"#15293838",[[2,290],[25,288],[109,348],[78,343]]);
    shape(c,"#182d3830",[[618,301],[640,300],[640,325],[549,346]]);
    for(let x=-17;x<668;x+=35){
      const y=x<174?332+x*.082:x<391?346:347-(x-391)*.095;
      line(c,"#263e44",x,y+4,x-1,y+9);
      line(c,"#52685f",x+1,y+4,x,y+8);
    }
  }
  function carving(c,rnd){
    // The capitals stack interlocking double brackets and ruyi-scroll spurs.
    for(const [x,y,s] of [[13,43,1.4],[628,13,1.5],[40,55,.66],[591,21,.73]]){
      const hom=(pts)=>pts.map(([a,b])=>[x+a*s,y+b*s]);
      const ornament=(col,pts)=>shape(c,col,hom(pts));
      for(let d=0;d<3;d++){
        const yy=d*4,w=18-d*4;
        ornament(d%2?"#4b5651":"#394c4a",[[-w-4,yy-1],[-w-4,yy-5],[-w+1,yy-5],[-w+1,yy-1],[-7,yy+1],[7,yy+1],[w-1,yy-1],[w-1,yy-5],[w+4,yy-5],[w+4,yy-1],[w,yy+3],[7,yy+4],[3,yy+6],[-3,yy+6],[-8,yy+4],[-w,yy+3]]);
        for(let k of [-1,1]){
          const a=hom([[k*w,yy-3],[k*(w-2),yy],[k*6,yy+2]]);
          line(c,"#7b7c67",...a[0],...a[1]);line(c,"#657365",...a[1],...a[2]);
        }
      }
    }
    // Front charcoal-lacquer posts carry narrow bronze sleeves with carved pinwheel marks.
    for(const [x,y] of [[13,245],[628,254]]){
      for(let i=0;i<4;i++){
        box(c,i%2?"#69695b":"#444b49",x-10,y+i*3,20,2);
      }
      for(let i=0;i<10;i++){
        let ax=x-7+(i%2)*8,ay=y-105+i*8;
        line(c,"#47504b",ax,ay,ax+4,ay+3);line(c,"#535950",ax+4,ay+3,ax,ay+8);
        line(c,"#2e393e",ax+1,ay,ax+5,ay+3);
      }
    }
    // Slim pendant with tied ends rather than an unarticulated triangle of silk.
    for(const [x,y] of [[536,61],[554,57],[570,46]]){
      line(c,"#7d6161",x,y-3,x-3,y+2);box(c,"#796158",x-4,y+2,3,2);
      line(c,"#705358",x-3,y+5,x-8,y+15);
      line(c,"#844f53",x-4,y+5,x-10,y+13);
    }
    for(let i=0;i<14;i++){let x=33+i*5,y=54-x*.285;
      line(c,"#5d6c60",x,y,x+2,y-2);line(c,"#465a53",x+2,y-2,x+4,y-1);}
  }
  function thresholdStone(c,rnd) {
    // The near lip belongs to a lower, shaded landing. Broad ink shapes separate it
    // from the pale stones in the circle, even in a small monochrome thumbnail.
    shape(c,"#203040",[[0,327],[165,343],[328,347],[430,342],[640,319],[640,360],[0,360]]);
    shape(c,"#344552",[[0,331],[169,346],[330,350],[423,346],[640,324],[640,329],[424,351],[330,355],[170,351],[0,336]]);
    shape(c,"#506263",[[0,327],[167,342],[327,346],[433,341],[640,318],[640,319],[433,343],[327,348],[168,344],[0,329]]);
    shape(c,"#182936",[[0,342],[160,356],[203,360],[0,360]]);
    shape(c,"#172b37",[[640,333],[640,360],[400,360]]);
    for(let i=0;i<21;i++){
      const x=i*41-70, y=x<169?328+Math.max(0,x)*.09:x<328?343+(x-169)*.025:347-(x-328)*.09;
      line(c,"#182f3b",x,y+1,x-4,y+6); line(c,"#56615f",x-2,y+1,x-5,y+5);
    }
    // One asymmetric pool reflects the open sky. Clipped, horizontal facets break
    // the reflection at tile joints rather than scattering highlights everywhere.
    for(const [x,y,w] of [[272,210,39],[289,215,31],[283,220,55],[294,230,41],
      [282,238,62],[303,247,43],[275,256,77],[282,284,82],[318,289,44],[267,300,119],[287,308,105],[308,314,60]]){
      shape(c,"#839c901b",[[x,y],[x+w*.22,y-1],[x+w*.73,y-1],[x+w*.69,y],[x+w,y+1],[x+w*.70,y+2],[x+w*.12,y+2]]);
      if(y%2===0){box(c,"#a9c3ae44",x+w*.23,y+1,w*.25,1);box(c,"#9db9a73d",x+w*.67,y,4,1);}
    }
    // The eave creates one coherent blue shadow plane across the lower-left
    // stones. Bright rivets are limited to the right-hand, sky-facing post.
    shape(c,"#1a2e4252",[[0,238],[37,242],[75,265],[59,265],[105,293],[88,291],[144,329],[130,337],[0,323]]);
    shape(c,"#2334443d",[[640,235],[607,243],[599,248],[564,256],[574,256],[540,278],[558,276],[505,302],[640,295]]);
    for(const side of [-1,1]){
      const at=(u,v)=>[side<0?u:640-u,v+(side>0?-4:0)];
      const poly=(col,points)=>shape(c,col,points.map(([u,v])=>at(u,v)));
      // Low corner rail, receding behind its sculpted end-post.
      poly("#263a43",[[0,277],[11,276],[61,291],[62,296],[7,284],[0,285]]);
      poly("#526361",[[0,275],[9,274],[63,291],[62,293],[8,278],[0,279]]);
      for(const [x,y,k] of [[2,272,1.0],[52,287,.55]]){
        const obj=(color,vs)=>poly(color,vs.map(([u,v])=>[x+u*k,y+v*k]));
        obj("#24353f",[[-9,-18],[-6,-20],[5,-20],[9,-17],[8,25],[2,30],[-8,29]]);
        obj("#35494e",[[-7,-17],[-3,-19],[3,-18],[3,24],[-6,27]]);
        obj("#53625f",[[-9,-19],[-7,-21],[-3,-22],[-2,-25],[2,-26],[4,-22],[8,-21],[9,-18],[4,-16],[-5,-16]]);
        obj("#6d7970",[[-6,-21],[-3,-24],[0,-25],[1,-24],[-2,-21],[3,-20],[1,-19]]);
        obj("#182d39",[[-9,25],[8,22],[10,25],[9,28],[-8,31]]);
      }
    }
    for(let j=0;j<26;j++){
      const x=rnd()*140,y=346+rnd()*12;
      box(c,"#56656755",x,y,2+rnd()*7,1);
    }
  }
  // The bronze tripod sits on the camera side of the fighting ring. Its near
  // lip covers the feet of the far handle, while the third leg recedes underneath.
  function nearBronze(c){
    const p=(col,d,edge,w=1)=>{const path=new Path2D(d);if(col){c.fillStyle=col;c.fill(path)}if(edge){c.strokeStyle=edge;c.lineWidth=w;c.lineJoin='round';c.stroke(path)}};
    c.save();c.translate(613,308);c.scale(1.17,1.17);
    const dark='#172631',bronze='#655746',ridge='#a88859',glint='#d7ae72',verdigris='#627567';
    p('#152c3388','M-45 2 Q-17-7 17-4 L33 1 Q15 6-22 6Z');
    p('#293c41','M-5-17 L2-18 7-6 9-5 8-3 2-4Z',dark);
    for(const [x,y,dir] of [[6,-57,1],[-22,-50,-1],[22,-55,1]]){
      c.save();c.translate(x,y);c.scale(dir,1);
      p(null,'M1 22 L-2 2', '#3c3838',1.45);p(null,'M-2 2 L-2.7-.6','#a75242',1.4);
      p(null,'M-2.7-.55 L-2.9-1.4','#ffbd75',1);
      c.restore();
    }
    p(verdigris,'M-18-30 Q-22-41-33-42 L-37-45-35-39-38-40-37-34-34-32-34-35 Q-27-36-26-30 Q-24-25-28-26 Q-30-27-30-29 L-32-29 Q-33-21-25-22 L-17-26Z',dark,1.7);
    p(null,'M-36-41 Q-34-38-31-38 Q-25-37-22-30 M-30-24 Q-24-23-25-28',ridge,1);
    p(bronze,'M15-31 Q17-42 28-43 L33-47 33-42 37-43 36-37 33-34 32-36 Q27-38 23-33 Q19-26 24-26 L28-29 29-26 Q26-20 19-23Z',dark,1.4);
    p(null,'M18-33 Q20-41 29-41 L34-43 M21-25 Q25-24 27-27',ridge,1.1);
    p('#685a49','M-22-19 Q-21-12-14-11 L-17 1-21 3-26 2-23-2-24-12Z',dark,1.3);
    p(null,'M-22-16 L-21-5-24 .9-21 1 M-17-12 L-19-5',ridge,.9);
    p('#685b49','M9-14 Q15-19 20-16 L19-6 23-1 23 2 17 2 13-1 12-7Z',dark,1.4);
    p(null,'M17-14 L16-7 19 0 22 .7',ridge,.95);
    p(bronze,'M-25-32 Q-10-38 17-34 L25-30 23-24 20-17 Q15-9 0-8 Q-15-8-21-16 L-25-23Z',dark,1.7);
    p('#384a49','M-25-29 Q-17-28-12-30 Q-15-19-8-13 L-1-9 Q-20-10-22-19Z');
    p('#8b775b','M3-32 L12-32 16-30 Q18-23 13-19 Q16-26 9-28 L2-26Z');
    p(null,'M-21-18 Q1-8 21-19 M-19-15 Q-1-7 17-15',verdigris,1);
    p('#8b7660','M-26-32 Q-21-36-2-37 Q16-37 25-33 L26-29 Q15-25-5-25 Q-23-26-26-29Z',dark,1.2);
    p('#283b40','M-23-32 Q-10-37 9-35 L21-33 Q15-30-4-30 Q-16-30-23-32Z');
    p('#5b5750','M-16-32 L-6-34 5-33 12-33 16-32 Q3-29-16-32Z');
    p(null,'M-25-29 Q-3-24 23-30 M-21-33 Q-4-37 15-34',ridge,.93);
    for(const [x,y] of [[-15,-23],[-5,-22],[8,-22],[15,-24]]){
      p(null,'M'+x+' '+y+'q4 -3 6 0l-3 2q-2 2 1 3',ridge,.7);
    }
    p(null,'M-10-16 Q-5-19-3-16 L0-18 3-16 Q7-19 10-17 M-6-16 L-3-14 0-15 3-14 6-16',glint,.7);
    c.restore();
  }
  function lightWell(c){
    // Moonlight and the shade under the eaves occupy different planes in the courtyard.
    c.save();
    const cast=c.createLinearGradient(256,193,378,319);
    cast.addColorStop(0,'rgba(219,223,177,.22)');cast.addColorStop(.62,'rgba(196,214,182,.09)');cast.addColorStop(1,'rgba(151,176,156,0)');
    shape(c,cast,[[260,192],[332,191],[430,335],[255,321]]);
    const edge=c.createLinearGradient(0,0,640,0);
    edge.addColorStop(0,'rgba(12,20,32,.37)');edge.addColorStop(.23,'rgba(21,30,42,.04)');edge.addColorStop(.68,'rgba(0,0,0,0)');
    edge.addColorStop(1,'rgba(16,17,30,.34)');c.fillStyle=edge;c.fillRect(0,0,W,H);c.restore();
  }
  function incense(c,t){
    c.save();c.translate(588,247);c.lineCap='round';c.lineJoin='round';
    for(let j=0;j<3;j++){
      const dx=[0,33,52][j],shift=Math.sin(t*.65+j)*2, y=j===1?-8:0;
      c.beginPath();c.moveTo(dx,y);c.bezierCurveTo(dx-3+shift,y-7,dx+5+shift,y-9,dx+1,y-16);
      c.bezierCurveTo(dx-2,y-22,dx-8+shift,y-21,dx-6+shift,y-28);
      c.strokeStyle=j===0?'#acc5b43d':'#9ab3a738';c.lineWidth=.9;c.stroke();
    }
    c.restore();
  }
  function create(){
    back=layer();front=layer();
    const b=back.getContext("2d"),f=front.getContext("2d"),rnd=noise(76041);
    sky(b,rnd);distantDetails(b,rnd);moonGate(f);floor(f,rnd);pavingFinish(f,rnd);architecture(f,rnd);carving(f,rnd);thresholdStone(f,rnd);lightWell(f);nearBronze(f);
  }
  function draw(ctx,{t=0,width=W,height=H,reduced=false}={}){
    if(!back)create();
    if(reduced)t=0;
    ctx.save();ctx.scale(width/W,height/H);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(back,0,0);
    // Thin banks of vapour travel behind the ring. Their small horizontal steps remain on-grid.
    for(let i=0;i<18;i++){
      const x=Math.round(((i*91+t*(1+i%3))%745)-70),y=150+(i*13)%45;
      const len=10+(i*17)%73;
      box(ctx,i%2?"#86aaa033":"#9db7a52b",x,y,len,1);
      box(ctx,"#86aaa025",x+7,y-1,len*.55,1);
    }
    ctx.drawImage(front,0,0);incense(ctx,t);
    ctx.restore();
  }
  window.CutHall={draw};
})();
