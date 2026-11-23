/* A fixed-camera stage. Paint architecture once, characters at pixel resolution. */
(() => {
"use strict";
const H=232, cache=new WeakMap();
const ink="#171926",gold="#e8b676",light="#ffdfa1",teal="#75c8bd";
function brush(c){
  function poly(fill,...v){c.fillStyle=fill;c.beginPath();c.moveTo(v[0],v[1]);for(let i=2;i<v.length;i+=2)c.lineTo(v[i],v[i+1]);c.closePath();c.fill();}
  function line(fill,width,...v){c.strokeStyle=fill;c.lineWidth=width;c.beginPath();c.moveTo(v[0],v[1]);for(let i=2;i<v.length;i+=2)c.lineTo(v[i],v[i+1]);c.stroke();}
  function rect(fill,x,y,w,h){c.fillStyle=fill;c.fillRect(x,y,w,h);}
  function oval(fill,x,y,rx,ry){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,2*Math.PI);c.fill();}
  function ring(fill,x,y,rx,ry,n=24,width=1){const v=[];for(let i=0;i<=n;i++){const a=i*2*Math.PI/n;v.push(x+Math.cos(a)*rx,y+Math.sin(a)*ry);}line(fill,width,...v);}
  function glow(x,y,size,color){const g=c.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,color);g.addColorStop(1,"rgba(0,0,0,0)");rect(g,x-size,y-size,size*2,size*2);}
  function at(x,y,s,fn,ys=s){c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,ys);fn();c.restore();}
  return {c,poly,line,rect,oval,ring,glow,at};
}
function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function pagoda(b,x,y,s,tone){
  const {at,poly,rect,line}=b;
  at(x,y,s,()=>{rect(tone,-3,-48,6,46);
    for(let j=0;j<4;j++){const t=-43+j*10,r=7+j*3;
      poly(tone,-2,t-4,2,t-4,r-1,t+3,r+3,t+1,r,t+5,-r,t+5,-r-3,t+1,-r+1,t+3);
      rect(tone,-r*.48,t+4,r*.96,7);}
    line(tone,1,0,-54,0,-44);
  });
}
function lamp(b,x,y,s){
  const {at,line,rect,poly,glow}=b;
  at(x,y,s,()=>{glow(0,7,25,"rgba(255,140,67,.28)");line("#ad8261",1,0,-21,0,-3);rect("#382c35",-6,-3,12,3);
    poly("#9d4544",-6,0,5,0,8,4,8,12,4,16,-4,16,-8,12,-8,4);
    poly("#ef9255",-4,0,4,0,6,4,6,12,3,15,-3,15,-6,12,-6,4);
    rect("#ffd99a",-3,2,5,11);rect("#aa5c4c",-7,5,14,1);rect("#b6674f",-7,11,14,1);
    rect("#573a3e",-5,15,10,3);rect(gold,-3,16,6,1);line("#9f534b",1,0,18,0,24);rect("#ba4e49",-1,22,3,4);
  });
}
function post(b,x,y,s){
  const {at,rect,poly,line}=b;at(x,y,s,()=>{
    poly("#2b2835",-7,-151,7,-151,7,-4,3,0,-8,-2);rect("#54333e",-5,-147,7,142);rect("#78454a",-4,-141,2,133);
    for(const k of [-132,-126,-17,-12]){rect("#332d38",-8,k,16,3);rect("#ac8458",-6,k,11,1);}
    poly("#52505d",-11,-7,4,-9,12,-5,12,-2,2,1,-11,-3);
    poly("#323643",-12,-2,1,1,12,-2,13,3,1,7,-13,3);line("#817784",1,-12,-2,0,1,12,-2);
  });
}
function galleryDetails(b,w,f,shop){
 const {poly,rect,line,oval,glow,ring}=b,mid=w/2,r=random(713+f);
 const edge=Math.min(w*.467,163);
 // Moonlight sweeps the tiles and the brighter strips break at individual slab joints.
 poly("rgba(159,171,186,.055)",mid+51,121,mid+75,121,mid-47,195,mid-91,198);
 for(let i=0;i<32;i++){
  const y=126+r()*65, x=mid+69-(y-126)*1.8+r()*27;
  rect(i%5?"#585763":"#726775",x|0,y|0,1+r()*8,1);
 }
 for(const side of [-1,1]){
  const x=mid+side*edge;
  const inward=-side;
  // Sloped depth brackets and repeated dougong blocks tie front and back bays together.
  poly("#34313f",x+side*36,0,x+side*51,0,x+side*8,27,x,29);
  line("#66515a",1,x+side*50,1,x+side*6,29);
  for(let j=0;j<3;j++){
   const bx=x+side*(8+j*9),by=23-j*6;
   rect("#5f414c",bx-6,by,12,3);rect("#856052",bx-3,by+3,6,2);
  }
  const ax=x+inward*12;
  // Carved frame, paired side lamps and floor-level pools of warm reflection.
  line("#927866",1,ax,86,ax+inward*5,91,ax+inward*1,95);
  rect("#57404a",ax-3,96,7,22);rect("#806550",ax-3,95,7,2);
  glow(x+inward*28,133,18,"rgba(210,132,91,.15)");
  for(let j=0;j<8;j++)rect(j%4?"#69565b":"#8b6d60",x+inward*28-4+r()*7,128+j*2,2+r()*6,1);
  if(f===1){
   const px=x+inward*42;
   line("#554954",1,px-11,25,px,34,px+8,31);
   for(let j=0;j<3;j++){let xx=px-6+j*5,yy=31+j%2*3;poly(j%2?"#ae7c65":"#b69576",xx,yy,xx+3,yy+1,xx+1,yy+13,xx-2,yy+10);rect("#874852",xx,yy+3,1,5);}
  }else if(f===2){
   const px=x+inward*45;
   line("#775461",1,px-16,29,px,35,px+12,32);
   for(let j=0;j<4;j++){let xx=px-12+j*6,yy=30+Math.sin(j)*3;poly(j%2?"#9b5969":"#6c526e",xx,yy,xx+5,yy,xx+3,yy+7);}
   lamp(b,px,49,.58);
  }else{
   const px=x+inward*46;
   for(let j=0;j<6;j++)ring(j%2?"#766f71":"#5e5964",px,24+j*3.4,1.7,2.6,8);
   poly("#514a45",px-4,44,px-3,40,px+3,40,px+4,44,px+5,54,px+9,58,px+8,60,px-8,60,px-9,58,px-5,53);
   line("#a28a68",1,px-5,54,px,55,px+5,54);rect("#9c8463",px-1,60,2,4);
  }
 }
 // Incense vessel in the near corner anchors the camera to the stone threshold.
 const xx=mid-Math.min(w*.395,148),yy=203;
 oval("#262835",xx+3,yy+1,17,3);
 poly("#34333c",xx-8,yy-9,xx+11,yy-10,xx+8,yy-3,xx+5,yy-2,xx+7,yy,xx+4,yy+1,xx+1,yy-2,xx-3,yy-2,xx-6,yy,xx-8,yy-1,xx-6,yy-4);
 oval("#8a7365",xx+1,yy-9,11,2);oval("#3e393e",xx+1,yy-10,7,1);
 for(let j=0;j<3;j++){let dx=xx-3+j*4;line("#876e5c",1,dx,yy-10,dx+j-1,yy-20-j*2);rect("#e4a478",dx+j-1,yy-21-j*2,1,1);}
}
function stage(b,w,f,shop){
 const {c,poly,rect,line,oval,ring,glow}=b,mid=w/2,r=random(1638+f),g=c.createLinearGradient(0,0,0,149);
 g.addColorStop(0,"#1d2740");g.addColorStop(.48,f===3?"#524c65":"#595474");g.addColorStop(1,"#ad8b90");rect(g,0,0,w,H);
 for(let i=0;i<73;i++)rect(i%7?"#91899c":"#cbb8c5",r()*w|0,r()*89|0,1,1);
 const moonX=mid+(shop?-42:23);glow(moonX,46,40,"rgba(236,196,153,.14)");oval("#e9dabe",moonX,46,17,17);oval("#f7e7c7",moonX-1,45,14,14);
 for(let j=0;j<3;j++){const pts=[-5,147,-5,102];let x=-5;while(x<w+30){pts.push(x,70+j*14+Math.sin(x*.037+j)*9+r()*15);x+=9+r()*16;}pts.push(w+5,148);poly(["#706a82","#565a71","#414d60"][j],...pts);}
 for(let i=0;i<18;i++)rect("#928697",r()*w,78+r()*30,10+r()*25,1);
 pagoda(b,mid-65,114,.68,"#434c61");pagoda(b,mid+91,114,.47,"#4a5167");
 poly("#454658",0,114,w,114,w,132,0,136);rect("#a1807b",0,114,w,1);
 for(let x=-8;x<w+12;x+=27){rect("#423a4c",x,98,4,17);rect("#937377",x-1,97,6,2);line("#6e5763",2,x,102,x+27,102);line("#493e52",2,x,107,x+27,107);}
 poly("#353744",0,123,w,120,w,H,0,H);
 for(let j=0;j<7;j++){const y=123+j*6+j*j*1.45;poly(j%2?"#3c3d4b":"#44424f",0,y,w,y-3,w,y+5+j*3,0,y+6+j*3);line("#292e3b",1,0,y,w,y-3);}
 for(let j=-14;j<=14;j++)line("#2c303d",1,mid-35+j*14,122,mid-35+j*75,H+3);
 for(let i=0;i<190;i++)rect(i%5?"#504a57":"#605966",r()*w|0,124+r()*108|0,1+r()*3,1);
 const rx=Math.min(w*.412,128),cy=166;
 oval("#40414f",mid,cy,rx,26);ring("#706575",mid,cy,rx,26,8,2);ring("#92806d",mid,cy,rx-4,24,8);ring("#554e57",mid,cy,rx-9,22,8);
 for(let i=0;i<36;i++){const a=i*Math.PI/18;line(i%3?"#716165":"#9a8172",1,mid+Math.cos(a)*(rx-8),cy+Math.sin(a)*22,mid+Math.cos(a)*(rx-4),cy+Math.sin(a)*24);}
 const edge=Math.min(w*.467,163);
 for(const side of [-1,1]){const x=mid+side*edge;
  const wx=side<0?x-33:x;rect("#302d42",wx,49,33,62);rect("#485369",wx+3,52,27,55);
  for(let j=0;j<3;j++)line("#2a3243",2,wx+5+j*10,52,wx+5+j*10,106);
  for(let j=0;j<4;j++)line("#292f3e",2,wx+2,57+j*13,wx+31,57+j*13);
  post(b,x,133,.82);const bx=x-side*14;
  poly("#422f46",bx-5,29,bx+8,29,bx+7,77,bx+2,72,bx-5,79);
  poly(shop?"#a55360":"#764654",bx-5,30,bx+5,30,bx+4,72,bx,69,bx-4,75);
  line("#bb8b72",1,bx-3,33,bx-3,66);line("#c0906d",1,bx,47,bx+3,43,bx,39,bx-2,44,bx,47);
  lamp(b,x-side*29,38,.8);
 }
 poly("#222634",0,0,w,0,w,12,mid+98,20,mid,16,mid-94,23,0,14);
 for(let x=-18;x<w+9;x+=17){poly("#353240",x,3,x+12,3,x+6,12,x-4,13);line("#514650",1,x+10,4,x+3,12);}
 line("#77575c",2,0,14,mid-90,23,mid,16,mid+98,20,w,12);
 for(const x of [mid-edge,mid+edge]){rect("#6e4a50",x-18,17,36,3);rect("#4d3945",x-14,20,28,5);rect("#8b6259",x-9,25,18,2);rect("#523d47",x-6,27,12,3);}
 galleryDetails(b,w,f,shop);
}
function hero(b,x,y,action,beat,t){
 const {at,poly,rect,line,oval,glow}=b;
 const jab=action==="strike"?beat:0,guard=action==="guard"?beat:0,cast=action==="cast"?beat:0;
 oval("#262937",x+3,y+1,22,4);
 at(x+8*jab,y,1,()=>{
   // Back scabbard, boots, split layers of the travelling cloak and loose red sash.
   line("#141b28",4,-9,-43,-25,-5);line("#987a69",1,-10,-42,-24,-9);
   poly(ink,-8,-28,5,-26,10,-15,9,-2,13,-1,13,1,4,1,1,-12,-3,-19,-9,-4,-9,0,-20,1,-19,-2,-14,-5,-13,-19);
   poly("#394351",-9,-25,-1,-22,-7,-8,-11,-6,-12,-7);rect("#716858",4,-4,6,2);
   poly("#19252f",-10,-52,-1,-57,8,-50,12,-43,7,-34,5,-25,11,-9,4,-12,-2,-9,-6,-15,-12,-9,-15,-14,-24,-9,-18,-23,-21,-19,-17,-37);
   poly("#334a4c",-11,-47,-5,-52,-4,-38,-7,-30,-15,-15,-12,-32,-20,-18);
   poly("#476261",-6,-52,4,-51,8,-47,4,-43,-6,-42,-14,-35,-10,-44);
   line("#849484",1,-11,-43,-5,-47,0,-47);line("#536361",1,-10,-36,-12,-24,-18,-15);
   poly("#663640",-8,-37,7,-39,7,-35,0,-33,-12,-28,-27,-23,-38,-24,-27,-27,-13,-31);
   poly("#bc6b57",-2,-36,6,-37,6,-35,-12,-29,-25,-27);
   // Face side plane beneath the hat. The metal clasp catches the warm lamp.
   poly("#312a30",-6,-64,4,-66,10,-59,8,-52,5,-50,-2,-52,-5,-55);
   poly("#b7846f",2,-58,10,-60,10,-57,12,-55,8,-54,7,-52,3,-52);
   rect("#d5aa87",6,-57,3,1);rect("#4b3740",7,-59,3,1);
   poly("#242731",-23,-58,-12,-64,-3,-71,1,-73,6,-67,19,-60,21,-57,7,-56,-10,-55);
   poly("#786856",-23,-59,-10,-65,0,-72,7,-66,19,-60,10,-60,-3,-61,-15,-57);
   line("#b2946f",1,-22,-59,-3,-62,2,-69);line("#a18469",1,-10,-61,1,-69,10,-63);line("#af9678",1,1,-70,16,-60);
   const ax=9+10*jab, ay=-40-2*guard+4*jab;
   poly("#22333a",2,-49,8,-48,ax+5,ay+2,ax+1,ay+4,5,-39,0,-42);
   rect("#b99070",ax+1,ay,4,3);rect(gold,ax+1,ay-1,1,4);
   const sx=ax+4,sy=ay+1, tx=sx+18+20*jab-15*guard,ty=sy-21+20*jab-11*guard;
   line("#141e2a",3,sx-4,sy+4,tx,ty);line("#a8c5c1",2,sx,sy,tx,ty);line("#e2d9c2",1,sx+1,sy,tx,ty);
   line("#d2a56b",2,sx-2,sy-2,sx+4,sy+2);
   if(guard>0){b.ring("#9ae2cf",10,-33,9+guard*7,22,18,2);}
   if(cast>0){glow(20,-40,19,"rgba(108,238,208,.45)");b.ring(teal,20,-40,7+cast*2,7+cast*2,6);}
 });
}
function moth(b,x,y,t,heavy){
 const {at,poly,oval,ring,line,rect,glow}=b;
 oval("#292c39",x+3,165,31,4);glow(x,y+4,43,"rgba(255,163,97,.13)");
 at(x,y+Math.sin(t*2)*2,1,()=>{
  for(const dir of [-1,1])at(0,0,dir,()=>{
   const sweep=Math.sin(t*2+.4)*2-(heavy?3:0);
   b.c.save();b.c.transform(1,0,0,1,0,sweep);
   poly("#292838",1,0,10,-13,29,-28,55,-42,71,-50,69,-40,64,-27,56,-17,49,-12,42,-9,40,-4,31,-4,28,0,18,0,11,5,3,5);
   poly("#dfa36e",4,0,15,-16,40,-31,65,-44,60,-32,48,-18,38,-14,30,-7,20,-6,13,0);
   poly("#9d535b",7,-1,27,-18,50,-30,57,-34,49,-22,38,-15,30,-14,21,-5);
   poly("#f5c58a",5,-3,20,-17,48,-33,62,-41,49,-29,32,-20,17,-12);
   poly("#39465a",11,1,24,-5,31,-6,37,-10,47,-11,42,-5,34,0,26,1,19,5);
   poly("#232d41",22,-13,29,-23,39,-27,44,-24,40,-17,31,-12);
   poly("#6caaab",25,-14,31,-21,38,-24,40,-22,37,-18,30,-14);
   poly("#252c3c",31,-17,34,-21,37,-21,35,-18);rect("#f7d3a2",35,-22,2,1);
   for(let k=0;k<5;k++)line("#775861",1,10+k*6,-3-k*3,19+k*7,-10-k*4);
   for(let k=0;k<4;k++)rect("#d4ae83",49+k*3,-18-k*4,2,1);
   poly("#262c3b",2,4,15,0,30,1,43,-4,39,7,32,13,25,16,22,21,12,28,10,22,4,18,1,12);
   poly("#8e7983",4,5,15,3,27,3,37,0,31,9,20,15,13,22,9,15);
   poly("#cfa892",7,7,17,5,29,5,23,11,15,15,12,19);
   poly("#4d586b",10,8,17,7,21,7,16,11,12,14);
   line("#7e6b75",1,4,6,14,11,14,17);b.c.restore();
  },1);
  poly("#2b2630",-4,-10,2,-13,6,-7,5,8,2,19,-2,18,-5,6);
  poly("#967359",-3,-5,1,-9,4,-4,2,10,-1,14,-2,7);rect("#ffcb81",0,-6,2,9);
  line("#382d3b",1,-2,-9,-7,-17,-13,-19,-15,-17);line("#382d3b",1,2,-10,7,-18,13,-20,15,-18);
  rect("#f3a974",-4,-8,2,2);rect("#f3a974",3,-8,2,2);
  line("#bf895b",1,0,15,0,24);
  glow(0,28,15,"rgba(246,144,61,.37)");poly("#bf7852",0,20,5,25,4,32,0,36,-4,32,-5,25);poly("#ffce7b",0,22,3,26,2,31,0,33,-2,30,-2,26);rect(light,-1,25,2,5);
 });
}
function tail(b,x,y,s,tilt,pal){
 const {c,at,poly,line}=b;at(x,y,s,()=>{c.rotate(tilt);
  poly(pal[0],-7,3,-17,-7,-24,-20,-24,-33,-20,-39,-18,-28,-14,-23,-13,-36,-7,-48,-5,-55,-1,-43,-1,-33,3,-39,4,-27,9,-20,11,-8,7,1,1,6);
  poly(pal[1],-9,-2,-17,-16,-19,-27,-14,-18,-12,-30,-6,-43,-4,-34,1,-23,6,-14,6,-5,1,0);
  poly(pal[2],-22,-34,-19,-27,-14,-21,-13,-34,-7,-47,-5,-54,-3,-44,-5,-35,-1,-37,-3,-29,-8,-18,-12,-19,-11,-11,-18,-19);
  line(pal[1],1,-17,-22,-13,-16,-13,-12);
 });
}
function foxDemon(b,x,y,t,heavy){
 const {at,poly,line,rect,oval,glow}=b;
 oval("#282a36",x,y,33,5);
 at(x,y,1,()=>{
  const colors=["#553449","#af5e61","#ecc28e"];
  for(let j=0;j<4;j++)tail(b,8+j*3,-18,.75+j*.065,.4+j*.38+Math.sin(t+j)*.04,colors);
  poly("#493444",-24,-48,-12,-49,2,-39,15,-31,22,-19,18,-7,11,-5,3,-11,-2,-16,-9,-14,-14,-9,-20,-9,-25,-15,-25,-32);
  poly("#bb7069",-22,-44,-10,-44,2,-35,13,-29,17,-21,9,-13,1,-17,-10,-17,-17,-11,-22,-21);
  poly("#dac199",-23,-39,-13,-41,-6,-35,-14,-32,-11,-30,-18,-22,-18,-17,-23,-23,-26,-33);
  for(const k of [-17,8]){poly("#493242",k,-18,k+7,-17,k+7,-6,k+10,-2,k+10,0,k-3,0,k-6,-1,k,-6);}
  const dy=heavy?-4:0;
  at(-18,-41+dy,1,()=>{
    poly("#392b3c",-18,-3,-12,-12,-14,-25,-8,-22,-4,-16,4,-19,11,-28,13,-15,9,-9,13,-2,7,4,1,7,-6,9,-8,6,-16,5,-23,1);
    poly("#c9766b",-16,-3,-11,-12,-12,-21,-5,-14,3,-16,10,-24,10,-14,7,-9,9,-4,4,2,-6,7,-10,3,-21,0);
    poly("#ecd6b4",-21,0,-11,-4,-4,-4,4,-9,1,-3,5,-3,0,1,-6,6,-10,3,-17,3);
    line("#242537",2,-13,-7,-7,-8,-3,-10);rect("#ffcb6a",-9,-8,3,1);rect("#231e30",-22,-1,3,2);
  });glow(-25,-49,13,"rgba(252,152,89,.14)");
 });
}
function bellDemon(b,x,y,t,heavy){
 const {at,poly,rect,oval,ring,line,glow}=b;oval("#272832",x+2,y,39,6);
 at(x,y,1,()=>{
  // Four weathered stone limbs brace beneath the bronze bell.
  for(const [k,o] of [[-16,-3],[16,-4],[-23,0],[13,1]]){
   poly("#2b303b",k-4,-30,k+7,-32,k+9,-22,k+5,-13,k+8,-4+o,k+13,-2+o,k+11,0+o,k-5,0+o,k-6,-6,k-3,-15,k-8,-21);
   poly("#676769",k-4,-24,k+3,-26,k+5,-21,k+1,-16,k-2,-17);line("#898274",1,k-2,-13,k-1,-9,k+5,-6);
  }
  poly("#353441",-32,-42,-20,-52,11,-52,26,-48,35,-36,31,-24,19,-20,8,-23,-6,-22,-15,-19,-28,-23,-37,-32);
  poly("#706763",-31,-39,-21,-47,8,-48,25,-42,26,-33,19,-28,4,-31,-9,-25,-26,-26);
  const lift=heavy?4:0;
  at(0,-43-lift,1,()=>{
   poly("#3d3438",-29,3,-22,-4,-19,-26,-14,-37,-11,-43,7,-44,16,-38,20,-23,22,-6,30,1,30,6,17,10,-15,11,-29,7);
   poly("#896746",-25,2,-19,-5,-16,-25,-11,-36,4,-40,12,-36,16,-24,19,-5,24,1,23,5,14,7,-11,8,-24,5);
   poly("#bc9059",-19,-6,-15,-25,-10,-35,-4,-37,-8,-24,-10,-7);
   poly("#675245",4,-37,12,-34,16,-10,13,-7,9,-23);
   for(const k of [-30,-24,-6,-2,5]){const width=k<-10?15:23;
    line("#473f3d",2,-width,k,-width+9,k+3,width-8,k+2,width,k-1);
    line("#d5a766",1,-width,k-1,-width+9,k+1,width-8,k+1,width,k-2);}
   poly("#364c49",-8,-19,-1,-23,7,-18,5,-12,0,-9,-7,-13);
   line("#d9aa62",1,-5,-16,0,-19,4,-16,0,-12,-5,-16);rect("#a4cead",-1,-17,2,3);
   ring("#5d4943",-2,-46,6,7,12,4);ring("#b59262",-3,-47,6,7,12,1);
  });
  // Stone guardian, arched pale horns and lit eye.
  poly("#322e38",-19,-39,-24,-54,-34,-61,-41,-59,-30,-53,-29,-44,-37,-47,-44,-57,-46,-54,-43,-42,-38,-35,-44,-31,-42,-23,-35,-21,-30,-25,-23,-24,-16,-31);
  poly("#999184",-35,-42,-29,-45,-23,-39,-20,-34,-25,-33,-27,-28,-35,-26,-39,-29,-36,-34,-41,-33);
  line("#514955",2,-38,-38,-31,-37,-27,-40);rect("#f4aa68",-35,-37,4,2);glow(-34,-36,10,"rgba(255,154,76,.24)");
  for(let j=0;j<5;j++)ring("#7f7464",-15+j*6,-33+Math.sin(j*.7)*4,3,2,8);
 });
}
function counter(b,x,y,s){
 const {at,poly,rect,line,oval}=b;at(x,y,s,()=>{
  for(const k of [-38,36]){rect("#332a36",k,2,5,19);rect("#795348",k,4,1,13);}
  poly("#604245",-45,-3,28,-9,49,-2,-26,6);poly("#9c6d53",-43,-4,29,-10,47,-3,-26,4);
  poly("#44343f",-45,-2,-25,5,-25,12,-45,5);poly("#68504b",-25,5,49,-2,49,5,-25,13);
  line("#cc966b",1,-24,5,46,-2);
  poly("#783c54",-24,-4,-8,-6,5,-2,4,12,-7,15,-8,0);
  line("#c88d67",1,-6,0,-6,12,2,10);
  for(let j=0;j<3;j++){oval("#a77b4d",17+j*4,-4-j,3,1.3);rect("#d8af67",16+j*4,-5-j,2,1);}
 });
}
function scale(b,x,y,s){
 const {at,poly,rect,line,oval}=b;at(x,y,s,()=>{
  oval("#654c45",0,0,7,2);rect("#d0a26a",-1,-25,2,24);rect("#f1c581",-1,-25,1,19);
  line("#d3ac76",1,-14,-23,11,-27);rect("#f6d394",-1,-29,2,3);
  for(const [k,top] of [[-13,-23],[11,-27]]){
   line("#b8a483",.8,k,top,k-5,top+10,k+5,top+10,k,top);
   poly("#ae7a52",k-6,top+10,k+6,top+10,k+3,top+13,k-3,top+13);
   line("#edbf74",1,k-5,top+10,k+5,top+10);
  }
 });
}
function merchant(b,x,y,t){
 const {at,poly,line,rect,oval,glow}=b;
 at(x,y,1.46,()=>{
  // Lacquered seat and layered fire-tipped tails, kept behind the crossed sleeves.
  rect("#332737",-19,-5,38,7);rect("#a7755e",-20,-5,41,2);
  const pal=["#743947","#b86060","#f2cd9c"];
  tail(b,11,-12,.8,.59+Math.sin(t)*.018,pal);tail(b,18,-9,.95,1.05,pal);tail(b,20,-5,.75,1.53,pal);
  // Trailing skirt, seated knee, waist and a silk sleeve laid across the counter.
  poly("#452b48",-4,-47,8,-50,15,-44,19,-31,15,-18,28,-14,35,-8,32,-4,18,-3,13,-6,10,-2,-4,1,-19,0,-27,3,-36,2,-32,-3,-18,-10,-14,-20,-14,-31);
  poly("#995675",2,-45,9,-47,13,-40,11,-28,8,-18,21,-14,29,-8,26,-7,10,-9,-3,-5,-18,-2,-26,0,-13,-10,-9,-23);
  poly("#c0778b",-7,-39,1,-43,7,-41,5,-34,0,-29,-6,-23,-11,-23,-13,-29);
  poly("#d29a91",-7,-40,-2,-45,4,-45,7,-42,3,-37,-2,-34);
  poly("#673d59",-8,-43,-4,-43,2,-34,9,-44,12,-42,6,-30,1,-29);
  line("#edb892",1,-7,-41,1,-32,9,-42);
  poly("#775650",-9,-28,10,-30,10,-25,-9,-22);line("#ddb27b",1,-9,-26,10,-28);rect("#93c5b0",1,-28,4,4);
  poly("#734963",-8,-23,-15,-15,-28,-9,-36,-2,-26,-4,-10,-9,3,-15,7,-22);
  line("#da9b8d",1,-11,-15,-25,-9,-34,-3);line("#e7bb89",1,15,-12,20,-11,24,-9);
  // Pale hair mass, tufted ears, narrow eyes and gilded hairpins.
  poly("#48384b",-8,-55,-9,-65,-5,-72,4,-73,11,-69,16,-66,18,-56,15,-48,18,-37,12,-42,10,-39,5,-49,-3,-47,-9,-48);
  poly("#dfbfa9",-10,-62,-7,-68,2,-70,10,-65,9,-56,4,-51,0,-50,-5,-52,-9,-55,-8,-58,-11,-59);
  poly("#f1d3b8",-9,-62,-6,-66,1,-68,6,-65,5,-60,-1,-54,-5,-54,-8,-56,-7,-59);
  poly("#b5a1b5",-10,-63,-9,-69,-14,-81,-7,-77,-1,-72,6,-75,13,-83,15,-81,14,-71,18,-66,16,-58,18,-50,14,-52,13,-45,9,-49,9,-60,5,-65,-1,-67,-6,-64,-4,-68);
  poly("#eed1bc",-13,-80,-7,-76,-3,-71,-8,-73);poly("#cd9192",6,-72,13,-81,12,-73,10,-70);
  poly("#e3c6ba",-8,-68,-2,-72,5,-72,9,-69,11,-61,8,-63,4,-67,-1,-69);
  line("#503849",1.3,-9,-62,-6,-61,-3,-61,-1,-63);
  rect("#fff0ce",-7,-61,3.5,1);rect("#53443d",-6,-61,1.5,1.5);
  line("#b28080",.8,-8,-64,-4,-65,-2,-65);rect("#d69591",-7,-58,3,1);
  line("#644651",1,0,-63,3,-64);line("#b15265",1,-8,-55,-6,-55,-5,-56);rect("#ffddba",-7,-54,2,1);
  line(gold,1,7,-69,17,-72,21,-74);rect(light,19,-75,2,2);
  line("#dfb787",1,11,-62,12,-55,12,-51);rect("#9dd6ba",11,-51,2,3);
  for(const k of [0,1,2])rect("#e3ae79",7+k*3,-68-k,2,2);
  // The wrist has a deliberate, readable palm-up trading gesture.
  poly("#8f5772",-7,-38,-11,-37,-16,-30,-22,-32,-25,-29,-17,-23,-9,-24,-3,-32);
  line("#d69895",1,-25,-29,-17,-26,-11,-27);
  poly("#e2b99f",-21,-32,-25,-34,-28,-34,-31,-37,-32,-36,-29,-31,-24,-29);
  rect(gold,-24,-33,2,3);oval(gold,-31,-39,3,1);rect("#fff2bd",-32,-40,2,1);
  for(const [dx,dy] of [[-11,-12],[-16,-8],[10,-16],[21,-11]]){
   line("#d9ac87",.8,dx-2,dy,dx,dy-2,dx+2,dy,dx,dy+1,dx-2,dy);
  }
  glow(10,-65,8,"rgba(237,167,105,.14)");
 });
 counter(b,x-21,y+1,1.08);scale(b,x-52,y-5,1);
}
function seal(b,x,y,s,t){
 const {at,poly,line,glow}=b;
 at(x,y,s,()=>{
  glow(0,0,22,"rgba(255,177,88,.22)");
  poly("#684654",-9,-3,-4,-11,5,-12,10,-7,6,-4,10,0,6,8,-2,12,-9,6);
  poly("#dfa45f",-7,-3,-3,-9,4,-10,7,-7,3,-4,7,0,4,6,-2,9,-7,5);
  poly("#ae5e59",-4,-2,1,-6,3,-5,1,-2,4,0,-1,5,-4,3);
  line("#ffdfa0",1,-6,0,-2,-6,3,-8);
 });
}
function foreground(b,w,f){
 const {poly,rect,line,oval}=b,mid=w/2;
 // Broad stepped masonry comes towards the viewer; edges stay away from both actors.
 poly("#272a37",0,199,mid-125,192,mid-103,194,mid-7,207,w,194,w,H,0,H);
 poly("#50505c",0,196,mid-119,189,mid-100,193,mid-9,205,w,192,w,195,mid-10,209,mid-104,196,mid-121,193,0,201);
 poly("#383844",0,210,mid-122,202,mid-7,220,w,206,w,211,mid-9,226,mid-122,207,0,215);
 line("#756470",1,0,210,mid-121,202,mid-8,221,w,206);
 for(const side of [-1,1]){
  const x=mid+side*Math.min(w*.49,202);
  post(b,x,189,1.12);
  const nx=x-side*10;
  poly("#222332",nx-14,180,nx,175,nx+15,181,nx+14,189,nx,194,nx-14,188);
  poly("#524552",nx-14,180,nx,176,nx+14,181,nx,186);
  line("#977f74",1,nx-12,180,nx,184,nx+11,181);
  oval("#2b2632",nx,174,8,3);rect("#43363c",nx-4,171,8,4);oval("#66534d",nx,171,7,2);
  if(f===3)rect("#67616b",nx-1,158,1,13);
 }
}
function relicCase(b,x,y,t){
 const {at,poly,rect,line,oval,ring,glow}=b;
 at(x,y,1,()=>{
  oval("#232632",2,2,65,9);
  // Coffer lid, seen open from above, lacquer edge and red velvet lining.
  poly("#302d39",-55,-11,-50,-43,43,-49,51,-19,49,-9);
  poly("#725345",-52,-13,-48,-42,42,-47,48,-19);
  poly("#4e3548",-46,-15,-44,-38,38,-42,43,-22);
  line("#b7956a",1,-50,-38,41,-44,46,-23);
  poly("#5e4047",-61,-11,42,-20,62,-12,-40,-1);
  poly("#a37556",-60,-12,42,-21,62,-13,-40,-2);
  poly("#5e3b46",-53,-12,41,-18,54,-13,-40,-5);
  poly("#49333c",-60,-10,-40,-1,-40,12,-60,4);
  poly("#6c4845",-40,-1,62,-12,62,2,-40,13);
  line("#c79765",1,-40,0,60,-11);line("#98715b",1,-39,10,61,0);
  for(const q of [-36,-6,25,54]){rect("#bc8b60",q,0-(q+36)*.105,3,7);}
  // Long jade-edged sword, old bronze astronomical disc, layered tortoiseshell shield.
  at(-30,-14,1,()=>{
   glow(0,-17,20,"rgba(168,224,215,.18)");
   poly("#5b736f",-3,-10,10,-49,14,-55,14,-46,1,-9);
   poly("#d7e6cc",-2,-10,11,-48,14,-54,12,-46,0,-10);
   line("#71938a",1,-1,-12,10,-45);
   line("#ddb87c",3,-7,-12,5,-8);line("#6a4244",4,-3,-9,-7,2);
   line("#dbad77",1,-4,-8,-5,-4,-7,-5);rect("#d9b67d",-9,1,5,3);
   line("#b35b59",1,-8,3,-11,7,-15,8);
  });
  at(4,-28,1,()=>{
   glow(0,0,21,"rgba(85,207,178,.23)");oval("#56433e",0,2,14,13);
   oval("#bb9a64",0,0,14,13);oval("#476c69",0,0,11,10);ring("#a4c8aa",0,0,9,8,16);
   ring("#dfc287",0,0,6,5,8);line("#d5b879",1,-11,4,10,-5);rect("#e8d39a",-2,-2,4,4);
   for(let j=0;j<8;j++){const a=j*Math.PI/4;rect("#5d554b",Math.cos(a)*12,Math.sin(a)*11,1,2);}
  });
  at(38,-28,1,()=>{
   glow(0,0,17,"rgba(224,157,95,.14)");poly("#3c3840",-13,-12,0,-16,12,-12,11,2,7,10,0,17,-7,12,-12,5);
   poly("#b88b58",-12,-11,0,-14,10,-11,9,2,6,9,0,14,-6,9,-10,3);
   poly("#646b61",-9,-9,0,-12,7,-9,7,1,4,7,0,11,-5,6,-7,1);
   line("#939d87",1,-8,-8,-1,-10,1,10);poly("#c3a874",-3,-1,0,-6,3,-2,1,3,-1,4);
  });
 });
}
function render(canvas,input={}){
 if(!canvas)return;
 const {floor=1,phase="fight",action="",time=0,intent="",emphasis=""}=input;
 const progress=Math.max(0,Math.min(1,Number(input.progress??1)));
 const t=Number.isFinite(time)?time:0, beat=Math.sin(progress*Math.PI);
 const bounds=canvas.getBoundingClientRect();
 const w=Math.max(240,Math.min(680,Math.round((bounds.width/(bounds.height||1))*H)));
 let entry=cache.get(canvas);
 if(!entry){entry={key:"",bg:document.createElement("canvas")};cache.set(canvas,entry);}
 const shop=phase==="shop", k=[w,floor,shop].join("/");
 if(k!==entry.key){
  entry.bg.width=w;entry.bg.height=H;stage(brush(entry.bg.getContext("2d")),w,floor,shop);entry.key=k;
 }
 if(canvas.width!==w||canvas.height!==H){canvas.width=w;canvas.height=H;}
 canvas.style.imageRendering="pixelated";
 const c=canvas.getContext("2d");if(!c)return;c.imageSmoothingEnabled=false;c.drawImage(entry.bg,0,0);
 const b=brush(c),mid=w/2,d=Math.min(w*.20,91),hx=mid-d,ex=mid+d*.71;
 const heavy = typeof input.heavy === "boolean" ? input.heavy : /heavy|重击|钟落/.test(String(intent).split("→")[0]);
 const attacking=["strike","cast","guard"].includes(action)&&progress>0&&progress<1;
 if(phase==="start"||phase==="intro"){
  hero(b,hx-6,180,"",0,t);relicCase(b,mid+20,159,t);
 }else if(phase==="fight"){
  const reply=input.enemyReplies===true&&progress>.55&&progress<1?Math.sin((progress-.55)/.45*Math.PI):0;
  const recoil=(attacking&&(action==="strike"||input.echoTriggered)?beat*3:0)-reply*(floor===2?19:6);
  if(floor===1){moth(b,ex+recoil,107,t,heavy);seal(b,ex+29,87+Math.sin(t*2)*2,.3,t);}
  else if(floor===2)foxDemon(b,ex+recoil,161,t,heavy);
  else {
   if(heavy){
    b.line("#9f9c97",2,ex-21,116,ex-52,163);b.line("#59555b",1,ex-22,115,ex-53,162);
    b.line("#d6b38b",1,ex+16,116,ex+42,160);
   }else{
    b.line("#827678",2,ex-18,122,ex-25,144,ex-32,158,ex-44,164,ex-52,163);
    b.line("#a49078",1,ex+17,123,ex+23,143,ex+32,157,ex+42,160);
   }
   bellDemon(b,ex+recoil,163,t,heavy);
  }
  hero(b,hx-(action==="guard"||input.hurt===0?0:reply*3),180,action,beat,t);
  if(input.armed){b.ring("#7aa69a",hx+7,170,18,4,8);b.ring("#c6aa76",hx+7,169,14,3,8);}
  if(reply>.12){
   const reach=(ex-hx-16)*reply;
   if(floor===3){b.ring("rgba(241,194,128,.8)",ex-reach*.52,165,Math.max(2,reach*.50),3+reply*4,20);}
   else if(floor===2){b.line("#e2ac93",1.5,ex-reach,140,ex-reach+7,133,ex-reach+15,130);}
   else{b.poly("#e5ad6a",ex-reach-3,135,ex-reach+2,131,ex-reach+9,130,ex-reach+7,134,ex-reach+2,137);}
  }
  if(attacking&&action==="strike"){
   const ax=hx+25+progress*(ex-hx-24),ay=143-progress*20;
   b.poly("#efc9a0",ax-18,ay+8,ax+4,ay-4,ax+13,ay-15,ax+7,ay-4);
   b.line("#f5e2c3",1,ax-19,ay+9,ax+5,ay-3);
  }
  if(attacking&&action==="cast"){
   const ax=hx+23,ay=133-Math.sin(progress*Math.PI)*3;
   b.glow(ax,ay,21,"rgba(89,235,200,.34)");b.ring(teal,ax,ay,11,11,6);b.ring("#f4dc99",ax,ay,6,6,4);
  }
  if(attacking&&input.echoTriggered&&progress>.43){
   const pulse=Math.sin(Math.min(1,(progress-.43)/.57)*Math.PI);
   b.glow(ex,130,13+pulse*15,"rgba(100,224,197,.33)");b.ring("#b3e9d0",ex,130,10+pulse*10,10+pulse*10,6,1.6);
  }
  if(attacking&&progress>.62&&(action!=="cast"||input.echoTriggered)){
   const effectX=action==="guard"?hx+14:ex, effectY=action==="guard"?146:126;
   for(let i=0;i<6;i++){const a=i*Math.PI/3,len=(progress-.62)*40;
    b.line(action==="guard"?teal:gold,1,effectX+Math.cos(a)*len,effectY+Math.sin(a)*len,effectX+Math.cos(a)*(len+4),effectY+Math.sin(a)*(len+4));}
  }
 }else if(shop){
  // A silk awning and diagonally oriented counter convert the chamber into the fox market.
  b.poly("#492e43",mid-49,30,mid+100,23,mid+107,40,mid-40,49);
  b.line("#b7896b",2,mid-40,49,mid+107,40);
  for(let j=0;j<6;j++){const x=mid-36+j*25,y=48-j*1.5;
   b.poly(j%2?"#79506a":"#97536c",x,y,x+23,y-2,x+16,y+6,x+8,y+8);}
  lamp(b,mid-47,54,.76);lamp(b,mid+95,47,.8);
  b.oval("#242532",mid+7,172,60,7);
  merchant(b,mid+15,170,t);
  if(beat>.1)b.glow(mid-41,151,18+beat*5,"rgba(242,185,107,.3)");
 }else if(phase==="reward"||phase==="prep"){
  hero(b,hx,180,"",0,t);
  const sx=mid+21,sy=165;
  if(phase==="prep"&&!input.hasSeal){relicCase(b,mid+20,159,t);}else{
  altar(b,sx,sy);
  seal(b,sx,sy-35+Math.sin(t*2)*2,1.15,t);
  for(let j=0;j<5;j++){const a=t*.6+j*1.27;b.rect("#edc495",sx+Math.cos(a)*17,sy-36+Math.sin(a)*8,1,2);}}
 }else if(phase==="route"){
  hero(b,hx,180,"",0,t);
  const sx=mid+20;b.rect("#514445",sx,114,4,52);
  b.poly("#97795c",sx-16,120,sx+14,117,sx+18,120,sx+14,124,sx-16,127);
  b.poly("#817568",sx-14,128,sx+16,131,sx+16,137,sx-14,135,sx-18,131);
  lamp(b,sx+12,139,.48);
 }else{
  hero(b,hx,180,phase==="lost"?"guard":"",phase==="lost"?.9:0,t);
  altar(b,mid+19,165);if(phase==="won"){b.glow(mid+19,125,34,"rgba(122,232,192,.3)");seal(b,mid+19,128,1.2,t);}
 }
 foreground(b,w,floor);
}
function altar(b,x,y){
 const {poly,line,rect}=b;
 poly("#242935",x-22,y-11,x-1,y-16,x+23,y-11,x+23,y,x-2,y+6,x-22,y);
 poly("#5a5361",x-22,y-11,x-1,y-16,x+23,y-11,x-2,y-5);
 line("#af9479",1,x-20,y-11,x-2,y-7,x+19,y-11);
 rect("#89765f",x-7,y-3,8,2);
}
window.drawTowerScene=render;
})();
