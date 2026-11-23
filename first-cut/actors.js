// Moon Gate duel. The silhouettes, textile patterns, face and wing membranes are
// drawn in bone space. They are rasterised directly onto the low-resolution scene.
(() => {
  'use strict';
  const ink='#17202b', black='#191b26', slate='#393e50', jade='#42716d', jadeLight='#80aba0',
    brocade='#2c414c', bone='#dad4bb', linen='#fff0d4', fold='#8d9d93', wine='#762842',
    red='#b6414a', silk='#ed705e', gold='#d4a464', glint='#ffde97', skin='#f2c6a8', blush='#ca8b7e';
  const paths=new Map();
  function path(c,d,fill,edge,width=.7){
    let p=paths.get(d);if(!p){p=new Path2D(d);paths.set(d,p)}
    if(fill){c.fillStyle=fill;c.fill(p)}
    if(edge){c.strokeStyle=edge;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke(p)}
  }
  const mark=(c,d,color,w=.65)=>path(c,d,null,color,w);
  function at(c,x,y,angle,sx,sy,fn){c.save();c.translate(x,y);c.rotate(angle);c.scale(sx,sy);fn(c);c.restore()}
  // Paint a part along its own bone. It keeps its authored width as the joint angle changes.
  function onBone(c,ax,ay,bx,by,len,fn){
    at(c,ax,ay,Math.atan2(by-ay,bx-ax)-Math.PI/2,1,Math.hypot(bx-ax,by-ay)/len,fn);
  }
  function oval(c,x,y,rx,ry,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill()}
  // Each row describes pelvis, shoulders, elbows, fists, knees, planted feet and blade angle.
  // Elbows and feet take their own hand-drawn arcs instead of mechanically rotating a whole picture.
  const poses=[
    [0,    [0,-42,   1,-72,   2,-58, 17,-66,    -13,-60,-25,-53,    -19,-25,-33,-3,    20,-29,23,-3,   -49]],
    [.19, [-9,-36, -13,-64, -25,-55,-10,-62,    -15,-51, -1,-50,    -24,-23,-35,-3,    10,-27,22,-3,   -16]],
    [.26, [-10,-36, -13,-64, -25,-55,-10,-62,    -15,-51, 0,-51,    -24,-23,-36,-3,    12,-27,28,-6,   -15]],
    [.405,[-13,-38,   7,-61,  22,-62, 33,-62,     -8,-53,-26,-51,    -33,-22,-57,-2,    21,-27,34,-3,     0]],
    [.52, [-13,-38,   7,-61,  22,-62, 33,-62,     -8,-53,-26,-51,    -33,-22,-57,-2,    21,-27,34,-3,     0]],
    [.67, [-6,-39,    8,-64,  18,-60, 27,-63,     -7,-55,-23,-48,    -29,-23,-49,-3,    25,-30,35,-3,   -12]],
    [.83, [ 1,-43,    0,-74,  -4,-58, 12,-68,     -12,-63,-19,-66,    -17,-23,-27,-4,    21,-30,29,-3,   -79]],
    [1,   [0,-42,    1,-72,   2,-58, 17,-66,    -13,-60,-25,-53,    -19,-25,-33,-3,    20,-29,23,-3,   -49]]
  ];
  // The feet stay planted while a second grip comes under the pommel to receive the blow.
  const guardPoses=[
    poses[0],
    [.23,[-3,-38,-7,-65,  3,-52,17,-58,   -7,-48, 8,-51,  -24,-24,-33,-3, 16,-27,23,-3, -62]],
    [.39,[-5,-35,-8,-63,  4,-49,22,-55,   -3,-47,20,-49,  -23,-25,-33,-3, 18,-25,23,-3, -69]],
    [.54,[-6,-35,-11,-62, 1,-48,17,-54,   -6,-47,15,-48,  -23,-25,-33,-3, 17,-26,23,-3, -72]],
    [.68,[-5,-36,-8,-64,  3,-50,19,-56,   -4,-47,17,-50,  -23,-25,-33,-3, 18,-25,23,-3, -68]],
    [.87,[-2,-40,-2,-70,  2,-53,17,-60,   -9,-53,-8,-51,  -21,-25,-33,-3, 20,-27,23,-3, -58]],
    poses[poses.length-1]
  ];
  function pose(progress,time,guard=false){
    const keys=guard && progress>=0?guardPoses:poses;
    const p=Math.max(0,progress);
    let i=1;while(i<keys.length-1&&keys[i][0]<p)i++;
    const [a,from]=keys[i-1],[b,to]=keys[i];
    let u=Math.min(1,(p-a)/(b-a));u=u*u*(3-2*u);
    const joints=from.map((v,j)=>v+(to[j]-v)*u);
    const breath=progress<0?.65*Math.sin(time*2.7):0;
    for(const j of [3,5,7,9,11])joints[j]+=breath;
    return joints;
  }

  function trousers(c,hx,hy,kx,ky,fx,fy,near){
    onBone(c,hx,hy,kx,ky,28,b=>{
      path(b,'M-4-3 C-12 0-12 12-8 17 Q-11 20-6 26 L-1 30 5 28 Q10 26 9 20 C12 14 11 5 6-2Z',near?bone:'#87948d',ink,1.2);
      path(b,'M-7 1 Q-9 9 2 20 L-3 17 Q-7 21-5 25 L0 28 4 27 Q0 23 4 22 L9 20 5 26-1 30-7 26-8 21-7 18 Q-13 9-7 1Z',near?fold:'#59676a');
      path(b,'M0 0 Q6 9 6 15 L8 19 9 13 Q10 7 6 2Z',near?linen:'#a6afa1');
      mark(b,'M-4 5 Q-5 12 1 16 M4 18 Q0 22-4 23',near?'#b3afa0':'#708283');
    });
    onBone(c,kx,ky,fx,fy,25,b=>{
      path(b,'M-4-3 Q0-5 6-2 L7 3 4 10 3 19 4 25 -4 26 -5 18 -6 8 -7 3Z',black,ink,.9);
      path(b,'M-5 0 Q0-3 5-1 L4 4 0 7 -5 4Z',near?'#8a9990':'#52626b');
      path(b,'M-4 7 L2 9 3 23 -2 23Z',near?'#414b55':'#323e47');
      mark(b,'M-4 7 L4 9 M-4 9 L3 11 M-3 15 L4 12 M-3 17 L3 15',near?gold:'#998661',.75);
    });
    at(c,fx,fy,0,1,1,b=>{
      path(b,'M-5-5 Q-1-3 3-5 L4-2 Q7-.2 11-.5 L13 .5 Q12 3 7 3 L-6 3-7 1Z','#322e39',ink,1);
      path(b,'M-5-1 Q-1 1 2-2 Q3-.5 6 .3 L11 .4 11 1.3-5 1.7Z','#6a625b');mark(b,'M-4 2 L7 2 11 1',gold,.6);
    });
  }
  function scarf(c,x,y,t,p){
    const wind=Math.sin(t*3.1)*.04-(p<0?0:Math.sin(p*Math.PI)*.08);
    at(c,x,y,wind,1,1,b=>{
      path(b,'M3-2 Q-8-8-23-4 C-38 2-40-10-53-9 Q-61-9-68-3 Q-56-7-51-2 C-44 8-35 11-24 5 Q-10-2 2 4Z',wine,'#4e2c3d',.8);
      path(b,'M-5-4 Q-14-7-23-3 C-39 3-42-9-53-8 Q-58-8-63-5 Q-53-8-48-1 C-40 7-32 7-25 3 Q-13-3-5-2Z',red);
      mark(b,'M-9-5 Q-18-6-24-3 M-40-1 Q-49-8-55-7',silk,.75);
      path(b,'M0 1 Q-11 0-19 9 C-26 19-38 15-46 26 Q-40 22-34 24 Q-31 21-28 20 C-32 26-36 26-40 30 Q-26 25-20 17 Q-10 7 2 5Z','#8e2a42','#572a39',.65);
      mark(b,'M-6 4 Q-13 5-20 13 T-33 21','#e06153',.9);
    });
  }
  function apron(c,x,y,t,p){
    const sweep=Math.sin(t*3)*.025+(p<0?0:.11*Math.sin(p*Math.PI));
    at(c,x,y,sweep,1,1,b=>{
      path(b,'M-9-4 Q-13 6-29 11 Q-45 18-51 32 Q-45 29-40 30 L-45 35 Q-28 33-17 28 Q-23 32-24 34 Q-9 31-1 24 L10 27 13 22 Q7 13 8-2Z',brocade,ink,1.3);
      path(b,'M-6 1 Q-11 12-24 21 Q-36 26-47 30 Q-35 18-22 14Z','#456661');
      path(b,'M-3 2 Q-3 13-16 26 Q-26 30-36 31 Q-16 24-9 12Z','#243544');
      path(b,'M1 1 L6 2 Q1 12 8 23 L4 25 Q-2 19 0 13 L-7 24 Q-3 16 1 1Z','#667d76');
      mark(b,'M-45 31 Q-29 32-16 23 M-40 29 Q-28 29-23 25 M-15 24 Q-10 24-8 20',gold,.8);
      path(b,'M-8 2 Q-14 12-27 18 Q-32 20-38 27 Q-30 23-22 23 Q-12 19-3 9Z','#b1bdaa');
      path(b,'M0 0 Q-5 11-9 16 L-5 14 -10 25 -2 18 2 12 6 1Z',red,ink,.65);
      mark(b,'M-1 3 Q-3 11-7 15',silk,.7);
      for(let i=0;i<4;i++)at(b,-30+i*5,27-i*1.8,-.36,.53,.52,g=>mark(g,'M-3 0 Q-3-4 0-4 Q3-4 2-2 Q0-1 0-2 M2-2 Q5-.8 6-3','#c4a46c',1));
    });
  }
  function chest(c,hx,hy,sx,sy,robe){
    onBone(c,sx,sy,hx,hy,29,b=>{
      path(b,'M-8-3 Q-13-1-12 7 Q-12 15-9 20 L-8 29 Q0 32 8 29 L8 22 Q9 16 12 12 Q13 4 7-.3 L4-3Z',robe?'#334650':bone,ink,1.15);
      path(b,'M-9 2 Q-8 8-2 10 L3 18 6 15 Q3 22 5 29 L-5 29 Q-4 18-9 12Z',robe?'#536d69':fold);
      path(b,'M-6-1 L0-1 10 6 7 13 5 15 4 10Z',linen);
      path(b,'M-5-2 L-1-2 8 6 1 13 -4 18 -7 26 -8 28 -8 21 Q-5 14 3 8Z',robe?'#742e3d':'#b7aa96');
      mark(b,'M-6-2 L4 7 Q-4 14-7 22',robe?gold:'#aa927a',1.15);
      path(b,'M-10 3 Q-11 9-7 13 L-4 10 -4 6Z',robe?'#37414c':'#c3c3b1');
      if(robe){
        mark(b,'M6 13 L6 17 Q8 18 8 16 M4 18 Q-1 16-1 20 Q0 22 2 20 M-4 24 Q0 22 3 24',gold,.6);
        path(b,'M-8 24 Q0 26 8 23 L9 29 Q2 32-9 29Z','#863f40',ink,.7);
        mark(b,'M-7 25 Q2 28 8 25','#eca26c',.8);
        path(b,'M4 26 L7 25 8 27 6 30 3 28Z',gold);
      }
    });
  }
  function sleeve(c,sx,sy,ex,ey,wx,wy,front,robe,grip){
    onBone(c,sx,sy,ex,ey,21,b=>{
      path(b,'M-3-4 Q-10-4-11 2 Q-11 9-5 15 L-7 24 Q-1 29 8 26 L6 23 10 22 Q7 18 8 13 Q9 7 5 1Z',front?bone:'#889a91',ink,.95);
      path(b,'M-8 1 Q-6 8 2 11 Q-2 12-1 16 L2 21-3 18-5 25-6 23-4 15 Q-10 7-8 1Z',front?fold:'#697c78');
      path(b,'M0-1 Q6 1 7 7 L7 14 5 11 Q3 5-1 4Z',front?linen:'#b6c1ab');
      path(b,'M-6 20 Q0 24 7 20 L9 24 Q2 29-6 25Z',robe?'#344650':fold,ink,.55);
      mark(b,'M-6 22 Q1 26 8 22',gold,.8);
      if(robe){
        path(b,'M-8-1 Q-4-7 2-5 Q5-4 7 0 L6 4 4 2-4 5-9 4Z',brocade,ink,.9);
        mark(b,'M-8 0 Q-5-4 1-4 L5-1 M-8 2 Q-1 4 5 0',gold,.75);
      }
    });
    onBone(c,ex,ey,wx,wy,19,b=>{
      path(b,'M-5-2 L4-2 Q6 6 3 11 L3 17 1 20 -3 18 -3 13-5 8Z',front?skin:blush,ink,.8);
      path(b,'M-4 5 Q.5 6 4 4 L3 15 Q0 17-3 16Z','#42494b',ink,.8);
      path(b,'M-3 6 L-.5 7 1 14 -1 15Z','#6c7770');
      mark(b,'M-4 5 Q0 7 4 4 M-3 8 L3 13 M-3 13 L3 8 M-2 16 L2 15',gold,.7);
    });
    at(c,wx,wy,0,1,1,b=>{
      if(front||grip){
        path(b,'M-3-3 Q-1-5 1-3 L3-4 4-2 3 0 3 2 1 4-2 3-4 0Z',skin,ink,.7);mark(b,'M1-2 L3-2 M1 0 L3 0 M0 2 L2 2',blush,.65);
      }else{
        path(b,'M-4-3 Q0-3 2-1 L7-4 Q8-3 6-1 L3 1 6 0 4 2 1 3-2 2-7 4-9 4-6 2-8 2-4-.5Z',skin,ink,.55);
      }
    });
  }

  function face(c,x,y,wind,p){
    at(c,x,y,0,1,1,b=>{
      const angle=Math.sin(wind*2.5)*.035+(p<0?0:.13*Math.sin(p*3));
      // Nape, main knot and long unbound temple lock have separate cloth lag.
      at(b,-8,-22,angle,1,1,g=>{
        path(g,'M3-5 Q-8-7-12-1 C-16 4-15 13-23 19 Q-29 24-41 23 Q-36 26-32 25 Q-39 29-45 28 C-32 33-18 24-15 20 Q-18 26-24 29 C-8 25-8 9-2 6 L4 3Z','#232431','#111b28',.9);
        path(g,'M-5-1 Q-10 1-12 8 Q-15 19-26 23 Q-18 22-13 18 Q-16 23-21 26 C-10 21-10 7-4 4Z','#444557');
        mark(g,'M-6 0 Q-11 4-13 12 T-28 24 M-3 3 Q-8 10-8 15','#646373',.6);
        mark(g,'M-10-1 Q-19 5-20 13 T-36 25 M-17 18 Q-23 26-35 26','#292a39',.75);
      });
      path(b,'M-4-10 L5-10 Q4-2 8 1 L3 6 -4 1Z',blush,ink,.75);
      path(b,'M1-6 L5-7 5-1 7 1 3 4 1 1Z',skin);
      // Warm light on the cheek; reflected cool jade under the jaw.
      path(b,'M-9-22 Q-4-30 5-27 Q13-25 14-19 Q14-16 12.4-13.6 L15-10.5 Q15.4-9.5 13-9.1 L14.2-7.5 12.8-6.8 13.5-5.6 Q12-2.2 8-.5 Q2-1.3-2-5.2 L-7-9 Q-11-11-11-16Z',skin,'#48313f',.9);
      path(b,'M-7-22 Q-1-27 4-25 L7-21 5-18 1-17-2-10 Q0-7 4-3 L9-1.1 Q5-.9 1-3.4 L-3-6-8-10Z',blush);
      path(b,'M6-22 Q11-23 13-19 L12-16.7 8.5-17Z','#ffe3c7');
      path(b,'M5.5-12 Q8-12.5 10.5-11.4 L13.5-10.2 11.9-9.5 8.6-9.8 7-6.7 3.5-7.8Z','#ffddbe');
      path(b,'M5.6-14.5 Q8.5-17 12.7-16.2 Q11.8-13.6 8-13Z','#fff1d9');
      path(b,'M5.2-14.4 Q8.4-17.8 13.5-16.7 L12.3-15.3 Q9.5-16.2 6-14.1Z','#292635');
      path(b,'M9.1-16 L11.5-16 11-14.5 9.5-13.7 8.8-14.3Z','#37776e');oval(b,10.8,-15.5,.65,.5,'#fff6df');
      mark(b,'M5.3-18.9 Q7.4-19.7 9.2-19.1 L12.7-18.2','#443340',1.1);
      mark(b,'M11.7-13 Q11.1-11.7 13.5-10.5','#b4786c',.55);
      mark(b,'M10.2-6.7 Q12.1-7.7 13.6-7.15','#9c4c59',.7);
      mark(b,'M10.2-5.7 L12-5.5','#ffe1c4',.55);
      // An asymmetric fringe breaks the profile at the brow, not over the eye.
      path(b,'M-12-13 Q-18-22-11-29 Q-7-34-.4-33 Q6-33 10-29 L14-26 12-25 16-23 13-23.4 14-21 10.5-22 9.5-19.5 8.5-23 Q5-23.8 2-19.5 L-.2-12.5 -1.8-14Q-2.8-8.5 0-5.2 Q-4-6.4-5.2-11 Q-6-7.5-5.5-5 Q-9-7-10-12Z','#20212e','#151b25',1);
      path(b,'M-12-18 Q-14-28-5-30 Q-.5-33 4-30 Q-.5-30-4-26 Q-1-28 2-28 Q-3-24-4-20 L-6-17-5-23 Q-8-22-9-17 L-10-19 -11-15Z','#404253');
      path(b,'M-7-29 Q-3-32 .5-30.8 L-2-29.4 -5-28.2 -4-29.6Z','#6e6974');
      mark(b,'M-3-23 Q1-29 7-28 M1-22 Q6-26 10-24','#535263',.75);
      path(b,'M-8-15 Q-4-16-4.7-11 L-6.2-8.8 Q-8.8-9.8-9-12Z',skin,'#563c46',.55);
      mark(b,'M-7.9-13.6 Q-5.1-14.3-6.6-10.5',blush,.7);
      path(b,'M-7.6-8.5 L-6.4-8.7-6.7-5.6-7.6-3.5-8.6-5.8Z','#d9ac64','#594749',.5);
      oval(b,-7.8,-5.5,.7,.9,'#a9d9ca');
      path(b,'M-13-26.7 Q-21-30-20-36 Q-18-43-11-43 Q-5-45 .4-40 Q3-35-.6-31 L-5-28Z','#232535',ink,1);
      path(b,'M-18-35 Q-18-40-12-41 Q-6-43-2-39 Q-8-40-12-37 L-16-32Z','#494856');
      mark(b,'M-15-38 Q-11-41-7-39 M-5-39 Q-2-37-2-35','#64606e',.8);
      path(b,'M-16.7-29 Q-10-33-2-31 L-.8-29 Q-8-30-14.5-26.5Z','#a87b51',ink,.6);
      mark(b,'M-16-29.5 Q-9-32.5-2-31',glint,.9);
      mark(b,'M-23-29.6 L3-34.4',gold,1.2);
      path(b,'M-25.7-30.2 L-23.3-32.4-20.2-30.6-22.9-28.7Z','#79b5aa','#675e53',.6);
      mark(b,'M-23.9-29 L-25-25 -24-22','#d3ae7a',.65);oval(b,-24,-21.4,1.2,1.7,'#be594b');
    });
  }
  function weapon(c,wx,wy,angle,focus,p,t){
    at(c,wx,wy,angle,1,1,b=>{
      // The sword knot stays vertical at rest, trails the pommel on the lunge,
      // then overshoots forward as the wrist turns the edge back into guard.
      const swing=p<0?.09*Math.sin(t*3.2):.97*Math.sin(Math.PI*p*1.65);
      at(b,-10,0,-angle+swing,1,1,g=>{
        mark(g,'M0 0 Q-2 1-2 4 Q-2 7 0 7 Q2 7 2 4 Q2 1 0 0',gold,.73);
        oval(g,0,8,1.5,1.7,'#deac69');
        path(g,'M-1 9 Q-3 14-1 16 L1 23 2 20 4 23 Q3 19 2 17 L5 21 Q4 15 1 9Z','#933d46','#49313a',.6);
        mark(g,'M.2 10 Q-1 15 2 19','#e77665',.72);
      });
      path(b,'M-11-1.7 L.7-1.7 Q2-4 7-5.6 L5.1-2.2 35-2.1 47 0 35 1.8 5.2 2.2 7 5.2 Q2.5 4.8 .6 1.7 L-11 1.7Z',ink,ink,.75);
      path(b,'M5-1.7 L35-1.6 47 0 34 .3 5 .3Z',focus?'#ffffd5':'#e7f3de');
      path(b,'M5 .3 L34 .3 47 0 35 1.5 5 1.8Z','#8eafa8');
      mark(b,'M8 1 L13 1 M14 .9 L15 .8 M16 .8 L18 .8','#5f8789',.37);
      mark(b,'M7-.7 L34-.7 43-.1',focus?'#ffffed':'#fffbea',.5);
      path(b,'M1.1-1.7 Q3-4.2 6.4-5 L4-1.6 4.8 1.9 6.4 4.5 Q2.7 3.8 1 1Z',gold,ink,.5);
      path(b,'M-9-1.2 L.8-1.2 .8 1.2-9 1.2Z',wine);
      for(let i=0;i<3;i++)mark(b,'M'+(-7+i*2.5)+' -.9 l-1.1 1.8',gold,.55);
      oval(b,-10.5,0,1.9,1.7,gold);oval(b,-10.6,-.4,.8,.6,glint);
    });
  }
  function blade(o){
    const j=pose(o.p??-1,o.t||0,o.guard),scale=o.scale??1,a=j[20]*Math.PI/180;
    return {hilt:{x:o.x+j[6]*scale,y:o.y+j[7]*scale},tip:{x:o.x+(j[6]+47*Math.cos(a))*scale,y:o.y+(j[7]+47*Math.sin(a))*scale}};
  }
  const bodyCanvases={};
  function layerFor(key,w,h){
    if(!bodyCanvases[key]){const v=document.createElement('canvas');v.width=w;v.height=h;bodyCanvases[key]=v}
    const v=bodyCanvases[key],c=v.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,v.width,v.height);return c;
  }
  function castShadow(out,sprite,key,ax,ay,x,y,detail,scale,moth=false){
    // Project this frame's silhouette from its pin point along the slant of the moonlight.
    // Squashing a lit sprite into an ellipse loses the individual boots and moving wingtips.
    const mask=layerFor(key,sprite.width,sprite.height);
    mask.drawImage(sprite,0,0);mask.globalCompositeOperation='source-in';
    mask.fillStyle='#0c1f2c';mask.fillRect(0,0,sprite.width,sprite.height);mask.globalCompositeOperation='source-over';
    out.save();out.translate(Math.round(x),Math.round(y));out.transform(1,0,moth?.17:.38,moth?.15:-.115,0,0);
    out.globalAlpha*=moth?.20:.45;out.imageSmoothingEnabled=false;
    out.drawImage(mask.canvas,-ax*scale/detail,-ay*scale/detail,sprite.width*scale/detail,sprite.height*scale/detail);out.restore();
  }
  function hero(out,o){
    const {x,y,t=0,p=-1,robe=true,scale=1,focus=false}=o;
    const [hx,hy,sx,sy,ex,ey,wx,wy,lx,ly,lwx,lwy,bkx,bky,bfx,bfy,fkx,fky,ffx,ffy,angle]=pose(p,t,o.guard);
    const c=layerFor('hunter',398,302),detail=1.85,ax=174,ay=260;
    c.setTransform(detail,0,0,detail,ax,ay);
    scarf(c,sx-4,sy-4,t,p);
    trousers(c,hx-3,hy,bkx,bky,bfx,bfy,false);
    trousers(c,hx+4,hy+1,fkx,fky,ffx,ffy,true);
    const bracing=o.guard&&p>.22&&p<.75;
    if(!bracing)sleeve(c,sx-5,sy+2,lx,ly,lwx,lwy,false,robe,false);
    if(robe)apron(c,hx,hy,t,p);
    chest(c,hx,hy,sx,sy,robe);
    at(c,hx+2,hy-1,.12*Math.sin(t*3),1,1,b=>{
      mark(b,'M3-1 Q8 5 4 12 M5 1 Q6 5 3 9',gold,.75);
      path(b,'M4 9 L7 12 5 16 2 17 1 14Z','#77ad98','#425953',.65);
      mark(b,'M4 11 L5.6 12.1 4.1 14.6','#b8dcc3',.65);
    });
    face(c,sx+3+Math.max(0,sx-hx-6)*.2,sy-2,t,p);
    weapon(c,wx,wy,angle*Math.PI/180,focus,p,t);
    sleeve(c,sx+3,sy+1,ex,ey,wx,wy,true,robe,true);
    if(bracing)sleeve(c,sx-5,sy+2,lx,ly,lwx,lwy,false,robe,true);
    if(o.floorY!=null)castShadow(out,c.canvas,'hunter-shadow',ax,ay,x,o.floorY,detail,scale);
    out.save();out.imageSmoothingEnabled=false;
    out.drawImage(c.canvas,Math.round(x-ax/detail*scale),Math.round(y-ay/detail*scale),Math.round(c.canvas.width/detail*scale),Math.round(c.canvas.height/detail*scale));out.restore();
    return blade(o);
  }

  const fore='M0 1 C3-9 12-28 31-41 Q54-58 76-67 Q82-70 84-66 Q82-50 73-36 L74-33 68-29 69-26 63-23 Q57-14 49-10 L46-10 43-7 36-6 32-3 26-4 Q13-2 5 4Z';
  const hind='M0-2 Q16-14 36-19 Q48-23 57-29 Q59-24 54-12 L55-9 50-5 Q46 7 37 10 Q29 12 26 17 C23 27 33 30 32 41 C31 45 27 51 21 52 Q27 45 25 39 C23 32 13 28 13 19 Q10 11 5 8 Q0 8 0-2Z';
  function fan(c,isHind,far,t){
    const outline=isHind?hind:fore;
    const ribs=far?'#827578':'#967e75',dark=far?'#403843':'#553945',ivory=far?'#b9baae':'#e8ddbf';
    path(c,outline,far?'rgba(155,161,155,.86)':'rgba(224,213,179,.89)',dark,1.3);
    c.save();c.clip(paths.get(outline));
    if(!isHind){
      path(c,'M-1 3 Q13-25 33-41 Q54-58 87-71 L83-62 Q44-47 19-23 Q8-12 5 2Z',ivory);
      path(c,'M-2 7 Q15-7 33-12 Q65-21 81-53 L87-72 88-43 69-11 43-1 16 8Z',far?'#62565c':'#8c635a');
      path(c,'M1 4 Q20-11 40-15 Q66-24 82-52 Q67-18 48-11 Q27-9 4 6Z',far?'#97a398':'#ece0bb');
      path(c,'M16-15 Q30-30 47-37 Q63-44 72-57 Q70-42 59-34 Q50-26 38-23 Q24-21 16-15Z',far?'#75626a':'#80535a');
      path(c,'M19-17 Q33-30 46-34 Q63-41 69-50 Q62-34 47-28 Q32-23 19-17Z',far?'#c19a75':'#deb273');
      path(c,'M30-25 Q32-35 42-39 Q49-41 51-35 Q52-29 42-25 Q36-22 30-25Z',dark);
      path(c,'M32-26 Q33-33 41-36 Q48-38 49-34 Q47-28 41-26 Q35-23 32-26Z',far?'#b88d56':'#edb862');
      path(c,'M35-27 Q36-32 42-34.8 Q46-35.5 45.5-32.8 Q42-28 37-27Z',dark);
      mark(c,'M33-29 Q35-35 42-36',far?'#d5ccac':'#fff1c0',1);
      const veins=['M2 1 Q16-32 80-65','M5-3 Q20-23 40-32 T78-58','M6-4 Q27-19 51-24 Q67-31 79-51','M4-1 Q24-12 49-15 T73-36','M4 1 Q22-7 43-7','M17-15 Q21-26 38-42','M25-22 Q32-34 54-51','M51-25 Q59-32 67-47','M41-16 Q49-20 55-27','M20-9 Q27-9 36-7','M54-20 Q62-20 67-29'];
      veins.forEach((d,i)=>mark(c,d,ribs,i<5?.56:.40));
      for(let i=0;i<20;i++){
        const u=19+i*2.7,v=-u*.64+(Math.sin(i*6.1)*3)-.5;
        oval(c,u,v,i%4===0?1.3:.7,.45,far?'#bfc2af':'#fff1c9');
      }
      mark(c,'M7-13 Q26-43 78-65',far?'#d3d1bc':'#fff1cf',1.0);
      for(let i=0;i<7;i++)at(c,32+i*5.4,-4-i*2.3,-.32,1,1,b=>{
        path(b,'M0 0 Q2-4 5-4 Q3-1 1.5 1Z',ivory);
      });
    }else{
      path(c,'M1-4 Q27-19 56-29 Q46-17 29-13 Q21-10 10-2Z',ivory);
      path(c,'M5 0 Q23-12 37-15 L50-21 Q45-6 30-2 Q20 2 13 7Z',far?'#72646b':'#976955');
      path(c,'M12 2 Q27-7 42-14 Q36-3 23 1 L17 5Z',far?'#ad9b82':'#e7c194');
      path(c,'M14 5 Q31-2 44-6 Q39 6 29 8 Q19 12 18 19 Q17 26 24 32 Q30 39 26 46 Q25 35 19 31 Q9 20 14 5Z',far?'#7f6771':'#966e68');
      path(c,'M26-2 Q30-9 37-9 Q41-9 39-5 Q35 1 30 2 Q26 2 26-2Z',dark);
      path(c,'M28-1 Q30-6 36-7 Q38-6 35-3 Q31 1 28-1Z','#dda966');
      mark(c,'M27-2 Q30-8 37-8',ivory,.9);
      for(const d of ['M2 1 Q19-9 49-21','M3 3 Q23-3 49-11','M3 3 Q17 7 29 6','M4 4 Q13 10 16 19 T25 35','M15-5 Q25-14 37-18','M32-5 Q40-5 46-9'])mark(c,d,ribs,.56);
      mark(c,'M25 39 Q30 45 24 49',ivory,.9);
    }
    // Several distinct patches of paper catch the moon as the wing turns.
    const gleam=(Math.sin(t*5.4)+(far?.8:1))*.10;
    if(gleam>0){c.globalAlpha=gleam;path(c,'M3-10 Q20-27 81-62 Q60-30 6-1Z','#fffae4')}
    c.restore();
  }
  function wings(c,side,far,lower,t,p,heavy){
    let q=Math.min(1,Math.max(0,(p-.365)/.065));
    q*=1-Math.min(1,Math.max(0,(p-.54)/.26));
    const wave=Math.sin(t*6.7+side*.29+(lower?.55:0));
    const projected=(far?.77:.94)*(1+(far?-.05:.096)*wave-q*(far?.69:.37)-(heavy?.21:0));
    const rot=far?-.11:-.04;
    c.save();c.translate(-4,-15);c.scale(side,1);c.rotate(rot+wave*.065+(lower?.26:0)+q*(far?.65:-.54));
    c.transform(projected,far?-.02:-.15,far?.08:-.04,far?.67:.88,0,0);
    if(far)c.globalAlpha*=.80;
    fan(c,lower,far,t);c.restore();
  }
  function feeler(c,x,y,dir,len,t){
    c.save();c.translate(x,y);c.rotate(dir+.025*Math.sin(t*3));c.scale(len,len);
    const shaft='M0 0 Q-9-12-10-25 Q-11-37-21-41 Q-26-43-27-38 Q-26-35-24-37';
    mark(c,shaft,'#544650',1.3);mark(c,'M-2-3 Q-10-17-10.4-27 Q-13-37-19-39','#dbc99c',.55);
    for(let i=1;i<=8;i++){
      const u=i/9,xx=-6-5*u-4*u*u,yy=-13-22*u,l=4*Math.sin(u*Math.PI)+2;
      mark(c,'M'+xx+' '+yy+' q'+(-l)+' -1 '+(-l-1.5)+' -4','#b09c87',.62);
      mark(c,'M'+xx+' '+(yy-.8)+' q2 -3 2.7 -6','#e5d8ae',.48);
    }
    c.restore();
  }
  function moth(out,o){
    const {x,y,t=0,p=-1,heavy=false,scale=1}=o,c=layerFor('moth',374,292),detail=1.82,ax=178,ay=185;
    c.setTransform(detail,0,0,detail,ax,ay);
    const pulse=(1+Math.sin(t*4))*.5,ignite=p>=.4&&p<.57;
    wings(c,-1,true,false,t,p,heavy);wings(c,-1,true,true,t,p,heavy);
    for(let i=0;i<3;i++){
      at(c,-5+i*3,-14-i*.6,-.34+i*.29+.04*Math.sin(t*4+i),1,1,g=>{
        mark(g,'M0 0 Q-7-2-13 3 L-19 13-22 14','#4e3c43',1.65);
        mark(g,'M-1-.6 L-12.4 2.5 -15 7','#d2ac7a',.69);
        mark(g,'M-19 13 L-19 15-21 15','#dbcaa4',.6);
      });
    }
    wings(c,1,false,true,t,p,heavy);wings(c,1,false,false,t,p,heavy);
    // The near pair catches the lamp on the inner faces and crosses in front of the pleated wings.
    at(c,-6,-14,-.04+.055*Math.sin(t*3.5),1,1,g=>{
      mark(g,'M0 0 Q-9 2-14 7 L-20 19-24 22 M-12 7 Q-15 15-21 20','#473944',1.55);
      mark(g,'M-1 0 Q-9 2-13.5 7 L-16 11 M-19 18 L-21 20','#d6b77e',.7);
      mark(g,'M3 1 Q5 6 1 12 L-6 22-5 25 M1 11 L-2 18','#52424b',1.3);
      mark(g,'M3.6 2 Q5 7 .5 12 L-3 17','#c8a56f',.62);
    });
    feeler(c,-10,-22,-.3,.84,t);feeler(c,-8,-23,.41,.97,t);
    path(c,'M-16-20 Q-17-25-12-28 L-13-30-8-27-5-29-4-27 1-27-1-24 5-23 3-21 7-19 4-18 8-16 4-15 7-12 1-12 1-8-4-10-9-8-10-12-14-11-13-15-18-16Z','#ded3af','#54454a',.9);
    path(c,'M-13-24 L-8-25-7-26-7-22-2-24-3-20 2-21-1-18 4-18-1-15 2-15-3-12-8-15-9-12-11-17-14-17Z','#f6e8c6');
    path(c,'M-16-21 Q-14-24-11-23 Q-9-22-11-19 L-13-17-16-18Z','#663d40','#392f39',.75);
    oval(c,-13.2,-21.2,1.9,1.7,'#b48158');oval(c,-13.9,-21.5,.75,.6,'#fff0bb');
    path(c,'M-10-18 Q-8-20-6-19 L-7-16-3-18-4-15 1-17-1-13-6-11-7-13-10-12Z','#b7a89a');
    mark(c,'M-11-17.5 Q-12-15-15-13 M-9-16 Q-9-13-12-12','#ebdcb6',.7);
    mark(c,'M-16-17.8 Q-21-15.2-18.6-13.4 Q-16-11.7-16-14','#6c5048',.75);
    // The seal cage is a hanging hexagonal lantern. Paper facets, ribs, finial
    // and weighted knot are anchored separately so the glow remains the hit target.
    path(c,'M-6-11 L-4-14 2-15 5-13 5-11 9-8 7-7-8-7-10-8Z','#775048','#3b3039',1);
    mark(c,'M-8-8.5 Q-1-11 7-9','#f6c67e',.85);
    path(c,'M-7-7 L-.5-10 6-7 8-3.5 7 5 3 9-3 10-8 6-9-2Z','#b8764b','#493b3d',1.5);
    path(c,'M-5-6 L-.5-8.6 3.6-7 5.2-2 4 5.4 1 8-3 8-5.8 4-6.5-1Z',ignite?'#fff6b9':'#f3b85e');
    path(c,'M-.7-7.9 L3.3-6.6 4.8-2.6 3.9 3.9 1.3 7.2-.6 7Z',ignite?'#fffbdc':'#ffde82');
    path(c,'M-2.3 4.2 Q-4.6 1-2.1-1.9 Q-.3-3.3-.5-5.1 Q1.1-3.4.7-1.4 Q3-2 3.2-3 Q4-1.6 2.6.7 Q1.7 3.9.4 4.5Z','#fff4b6');
    mark(c,'M-5-7 Q-8 0-4 7 M3.8-7 Q7.3 0 3.2 7.7','#ae763f',.85);
    mark(c,'M-8-3 Q-.7-5.1 7.6-2.4 M-7 4 Q-.2 2.2 7 4','#c18a51',.56);
    path(c,'M-6 7 Q0 10 6 6 L4 10.4 1 11.4-3 11Z','#8e6549','#493c3b',.75);
    mark(c,'M-4.8 8.5 Q1 11 4.4 8.4',glint,.7);
    at(c,0,11,Math.sin(t*4.5)*.10,1,1,g=>{
      mark(g,'M0 0 L0 5','#c09155',.9);oval(g,.1,5.9,1.6,1.7,'#bd6c45');mark(g,'M0 7 Q.4 13 4.3 16 M.5 8 Q2 14 5 14 M-.8 8 Q-1 13 1 15',gold,.7);
    });
    c.save();c.globalCompositeOperation='screen';c.globalAlpha=ignite?.45:.11+.07*pulse;
    const glow=c.createRadialGradient(0,-.5,1,0,-.5,21);glow.addColorStop(0,'#ffca66');glow.addColorStop(.35,'#c57535');glow.addColorStop(1,'rgba(176,80,25,0)');c.fillStyle=glow;c.fillRect(-22,-23,44,44);c.restore();
    if(o.floorY!=null)castShadow(out,c.canvas,'moth-shadow',ax,ay,x+9,o.floorY,detail,scale,true);
    out.save();out.imageSmoothingEnabled=false;
    out.drawImage(c.canvas,Math.round(x-ax/detail*scale),Math.round(y-ay/detail*scale),Math.round(c.canvas.width/detail*scale),Math.round(c.canvas.height/detail*scale));out.restore();
    return {lamp:{x,y}};
  }
  window.CutActors={hero,moth,blade};
})();
