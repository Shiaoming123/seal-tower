/* Original 96 px inventory cuts and a 175 × 96 px side-view field creature.
   These are local, transparent bitmaps baked once per requested animation cel. */
window.HuntArt=(()=>{
  "use strict";
  const objects=new Map(),creatureFrames=new Map(),paths=new Map();
  const carbon="#241c24",umber="#49342e",bronze="#966239",brass="#d49b55",gold="#f6d491";
  const iron="#43545b",steel="#859691",glint="#d9ddd0",silk="#963f39",ember="#f29d55";
  function shape(c,d,fill,stroke,width=1.4){
    let p=paths.get(d);if(!p){p=new Path2D(d);paths.set(d,p)}
    if(fill){c.fillStyle=fill;c.fill(p)}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke(p)}return p;
  }
  function oval(c,x,y,rx,ry,fill,stroke,w=1){
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke()}
  }
  function line(c,points,color,width=1){
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.lineWidth=width;c.strokeStyle=color;c.stroke();
  }
  function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
  function grain(c,mask,bounds,seed,colors,count,dx,dy){
    c.save();c.clip(mask);const random=rng(seed),[x,y,w,h]=bounds;
    for(let i=0;i<count;i++){
      const px=x+random()*w,py=y+random()*h,l=.3+random()*.8;
      line(c,[[px,py],[px+l*dx,py+l*dy]],colors[Math.floor(random()*colors.length)],.65+random()*.65);
    }
    c.restore();
  }
  function rivet(c,x,y,r){
    oval(c,x,y+.5,r,r,"#62452f",carbon,.7);oval(c,x-.3,y-.5,r*.70,r*.65,brass);
    c.fillStyle=gold;c.fillRect(Math.round(x-r*.45),Math.round(y-r*.64),1,1);
  }
  function knife(c){
    shape(c,"M11 83 L29 59 L33 55 L40 61 L35 67 L19 88 L14 89Z","#694936",carbon,2.5);
    const blade=shape(c,"M30 58 L50 32 Q66 19 88 8 Q89 27 77 41 L41 66Z",iron,carbon,2.4);
    shape(c,"M34 57 L52 34 Q69 21 85 12 Q72 28 68 36 L40 61Z","#6c8487");
    shape(c,"M38 61 L68 37 Q81 23 87 12 Q86 30 76 40 L41 65 Z","#bdc9bc");
    shape(c,"M42 61 L75 38 Q82 29 85 23",null,glint,1.4);
    grain(c,blade,[32,10,52,53],241,["#4d6167","#9ba99c","#889c9c"],39,3,-2);
    line(c,[[49,40],[60,32],[69,27]],"#53696a",1.2);
    for(let i=0;i<5;i++){const x=16+i*3,y=81-i*4;line(c,[[x-1,y-1],[x+5,y+1]],"#342925",3);line(c,[[x,y-2],[x+4,y]],"#b7875b",1.4)}
    shape(c,"M26 55 L29 52 L44 62 L43 67 L38 67 L26 59Z",bronze,carbon,1.8);
    line(c,[[28,55],[39,62],[43,63]],gold,1.5);
    shape(c,"M10 82 L13 79 L21 86 L20 90 L15 91 L10 87Z",bronze,carbon,1.7);rivet(c,15,85,2);
    shape(c,"M13 90 Q8 94 5 89 Q4 84 9 83",null,"#477a72",2);
  }
  function hook(c){
    shape(c,"M14 87 L50 40 L56 42 L21 90 L15 92Z","#b78a4b",carbon,2);
    line(c,[[17,87],[52,42]],"#e3bd72",2);
    line(c,[[22,86],[52,46]],"#72552f",1);
    for(let i=0;i<4;i++){
      const x=21+7*i,y=81-i*9;
      line(c,[[x-2,y-2],[x+3,y+2]],"#6c5234",2);
      line(c,[[x-2,y-3],[x+3,y+1]],"#d7bc77",1);
    }
    const metal=shape(c,"M44 48 L48 36 Q57 18 68 11 Q80 4 85 12 Q90 22 76 35 Q75 27 78 20 Q78 14 72 16 Q62 23 57 37 L52 48Z",iron,carbon,2.3);
    shape(c,"M48 42 Q57 20 69 12 Q79 6 83 12 Q74 8 67 17 L54 39Z",steel);
    shape(c,"M84 15 Q88 23 76 34 L80 23Z",glint);
    grain(c,metal,[49,10,35,35],191,["#697676","#a9aca0"],18,1,-2);
    for(let i=0;i<4;i++)line(c,[[43+i,49-i*2],[50+i,53-i*2]],i%2?brass:"#714e30",2);
    shape(c,"M45 47 Q34 48 36 57 L40 55 L39 62 Q46 54 47 49Z",silk,carbon,1.1);
    line(c,[[39,53],[42,50]],"#da7551",1.2);
  }
  function buckler(c){
    const body=shape(c,"M16 27 Q32 8 57 10 Q80 11 86 33 Q92 56 73 76 Q56 90 34 85 Q13 81 9 63 Q5 45 16 27Z","#815535",carbon,2.6);
    grain(c,body,[8,10,80,80],207,["#5e4232","#966a44","#ad7d4c"],170,1.5,7);
    c.save();c.clip(body);
    for(let i=0;i<6;i++){
      const x=4+i*14;
      line(c,[[x+6,8],[x+3,33],[x+4,58],[x,88]],"#513e33",2);
      line(c,[[x+8,10],[x+5,34],[x+6,55]],"#c08b52",1);
    }
    line(c,[[22,26],[33,31],[30,35],[36,39]],"#c79b60",1.4);
    c.restore();
    shape(c,"M18 28 Q33 10 57 12 Q79 13 84 34 Q89 57 71 75 Q53 90 33 83 Q15 78 12 61 Q8 44 18 28Z",null,"#383e3b",6);
    shape(c,"M15 49 Q17 26 37 18 Q57 9 72 20 M70 74 Q55 87 38 82",null,"#a8a68b",2);
    for(const [x,y] of [[18,38],[31,21],[54,15],[75,24],[83,45],[75,66],[54,81],[32,79],[16,63]])rivet(c,x,y,1.6);
    const boss=shape(c,"M34 36 L48 31 L61 39 L63 53 L52 64 L38 62 L29 50Z",iron,carbon,2);
    shape(c,"M33 42 L47 34 L53 36 L44 48 L35 57 L31 49Z",steel);
    shape(c,"M44 48 L54 37 L60 41 L60 51 L50 61 L41 59Z","#647674");
    grain(c,boss,[30,32,32,30],107,["#4b5a5c","#a3ada0"],12,2,-2);
    line(c,[[32,44],[38,37],[47,34]],glint,1.3);rivet(c,46,47,3);
  }
  function plate(c){
    shape(c,"M18 53 Q23 72 48 74 Q72 72 81 58 L77 58 Q69 82 42 81 Q22 79 16 66Z","#715034",carbon,2.2);
    for(const x of [29,62])shape(c,"M"+x+" 71 l5 1 l-2 12 l-6 2 l1 -6Z",bronze,carbon,1.6);
    shape(c,"M28 39 Q30 31 34 27 Q43 20 46 12 Q48 22 41 30 L38 40Z","#89623a",carbon,1.5);
    shape(c,"M45 40 Q50 30 61 25 L60 29 Q66 23 65 14 Q76 28 66 39 L64 43Z",brass,carbon,1.5);
    oval(c,49,51,37,17,brass,carbon,2.3);oval(c,49,49,32,13,"#6c5038","#f1c97b",1.5);
    oval(c,48,49,25,8,"#446c64",bronze,1.4);
    shape(c,"M48 39 L52 46 L69 51 L53 52 L43 60 L45 53 L31 48 L44 48Z","#edd289",umber,1.3);rivet(c,48,50,2.2);
    for(let i=0;i<12;i++){const a=i*Math.PI/6,cx=49+33*Math.cos(a),cy=50+14*Math.sin(a);line(c,[[cx,cy],[cx+2*Math.cos(a),cy+Math.sin(a)]],gold,1.2)}
    shape(c,"M18 63 L24 65 Q20 74 23 83 L18 80 L15 85 Q12 75 18 63Z",silk,carbon,1.2);
  }
  function ash(c){
    shape(c,"M10 55 Q19 47 28 47 Q34 39 40 40 L44 34 L51 37 L56 29 Q64 34 64 39 Q73 39 75 46 Q82 46 85 54 Q92 59 87 65 Q74 75 47 76 Q18 75 9 65Z","#4c5354",carbon,2.5);
    const mound=shape(c,"M13 55 Q21 50 29 48 Q37 39 42 42 L46 37 L51 39 L56 32 L62 39 L69 42 L73 49 L80 50 L85 57 Q81 66 62 69 Q31 75 13 62Z","#727c78");
    grain(c,mound,[12,31,75,44],403,["#414d52","#566769","#a2aaa0","#b1b5a8","#d0c6a9"],170,2,-1);
    shape(c,"M24 57 L33 50 L37 50 L33 55Z M51 41 L56 34 L59 38 L54 42Z M65 56 L69 50 L75 53 L70 57Z","#adb4a5");
    for(const [x,y] of [[39,55],[25,63],[60,47],[70,62],[45,64],[54,51]]){
      line(c,[[x-2,y+1],[x+1,y-1],[x+3,y]],silk,2.6);line(c,[[x,y],[x+2,y-1]],"#e38d4d",1.3);
    }
    for(const [x,y] of [[12,75],[22,71],[77,70],[83,67],[53,78]])oval(c,x,y,2.5,1.5,"#626c69",umber,.7);
    shape(c,"M51 31 Q43 26 51 22 Q56 20 52 14 M62 32 Q68 28 65 24",null,"#898983",1.1);
  }
  function clasp(c){
    shape(c,"M26 66 Q14 78 14 83 Q21 88 38 68 L72 31 L68 25Z","#8e653f",carbon,2.2);
    line(c,[[17,82],[34,65],[67,29]],gold,1.7);
    shape(c,"M19 22 L36 29 Q46 26 58 27 L79 14 L76 37 L81 45 L73 57 L62 67 L55 78 L48 79 L42 69 Q27 67 19 56 L22 47 L16 42Z","#c18a50",carbon,2.4);
    shape(c,"M20 24 L36 31 L27 41Z M61 31 L76 18 L73 41Z","#73503b",umber,1);
    shape(c,"M23 26 L32 32 L27 37Z M65 31 L74 23 L71 36Z",silk);
    shape(c,"M20 45 L34 43 L47 52 L50 66 L46 71 L40 63 L32 63Z","#e7b46c");
    shape(c,"M50 58 L58 39 L74 35 L68 52 L57 65 L53 74 L49 72Z","#a46d40");
    shape(c,"M23 46 Q35 45 44 52 Q33 56 26 49Z M56 50 Q62 38 75 38 Q70 47 59 51Z","#503b34");
    line(c,[[28,48],[38,51]],"#ffda88",1.2);line(c,[[61,47],[69,41]],"#f6d599",1.2);
    shape(c,"M46 66 L53 63 L56 67 L51 72Z","#56392e",umber,1);
    shape(c,"M40 37 L48 31 L53 36 L46 44Z","#5a887c","#66523e",1);rivet(c,48,36,1.6);
    line(c,[[22,24],[35,30],[41,29]],gold,1.3);
  }
  function shell(c){
    const p=shape(c,"M11 58 Q17 28 40 17 L62 13 Q78 21 85 41 L79 49 L81 55 L68 65 L59 64 L50 76 L33 81 L17 73Z","#354648",carbon,2.5);
    shape(c,"M15 57 Q24 32 43 21 L58 17 Q44 25 38 37 L29 60 L21 68Z","#536b68");
    shape(c,"M34 62 Q44 28 64 18 Q75 26 78 34 L65 35 L52 49 L46 64Z","#48605d");
    shape(c,"M17 67 L30 71 L42 64 L53 64 L64 52 L73 51 L83 40 L80 49 L81 55 L68 65 L59 64 L50 76 L33 81 L17 73Z","#b09666",umber,1.25);
    line(c,[[18,69],[31,74],[44,67],[52,68],[65,55],[74,54],[80,48]],"#e2c58a",2);
    grain(c,p,[12,14,70,64],819,["#677a72","#394748","#60706a","#9b8c6c"],55,2,-2);
    for(const [x,y,r] of [[30,53,5],[44,37,4],[60,28,3],[58,48,4],[22,64,3]]){
      shape(c,`M${x-r} ${y+r} q0 -${r*2} ${r*2} -${r*2} l-${r} ${r*2}Z`,"#748477");
    }
  }
  function wick(c){
    const cords=[ "M20 65 Q10 73 18 80 Q30 88 46 77 Q59 68 56 58 Q54 51 43 53 Q27 57 22 68 Q19 76 32 75 Q45 74 59 61 Q68 53 64 47", "M19 66 Q14 55 31 47 Q46 39 56 45 Q67 51 59 58 Q52 65 39 65", "M56 50 Q62 41 58 32 Q56 25 65 17 L70 12" ];
    for(const d of cords){shape(c,d,null,carbon,7.5);shape(c,d,null,"#9a794e",5.5);shape(c,d,null,"#dab67a",2.5)}
    for(const [x,y] of [[18,74],[24,80],[35,79],[46,74],[52,66],[52,56],[36,59],[27,66],[29,73],[46,47],[40,46],[31,49],[23,54],[59,48],[60,39],[59,31],[62,25]]){
      line(c,[[x-1,y-1],[x+2,y+2]],"#715637",1.4);
    }
    shape(c,"M62 24 L64 17 L70 13 L75 8 L74 16 L69 22Z","#504139",umber,1.3);
    line(c,[[65,20],[69,17],[72,12]],ember,2);
    line(c,[[69,16],[72,12]],"#ffe2a1",1);
    for(const [x,y] of [[70,8],[78,10],[73,4]]){c.fillStyle=ember;c.fillRect(x,y,1.5,1.5)}
  }
  const inventory={knife,hook,buckler,plate,ash,clasp,shell,wick};
  function canvas(width,height){
    const c=document.createElement("canvas");c.width=width;c.height=height;return c;
  }
  function drawItem(ctx,id,x,y,size){
    if(!inventory[id]||!(size>0))return;
    let sprite=objects.get(id);
    if(!sprite){sprite=canvas(96,96);const c=sprite.getContext("2d");c.lineJoin="round";c.lineCap="round";inventory[id](c);objects.set(id,sprite)}
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,x-size/2,y-size/2,size,size);ctx.restore();
  }

  const fur="#4c4954",furLight="#80746e",furTip="#b29a7c";
  const furDark="#333441",ear="#9c6c64",foot="#806662";
  function leg(c,points,far){
    const [hip,knee,ankle,toe]=points;
    const coat=far?"#3a3540":"#625660",skin=far?"#715855":foot;
    line(c,[hip,knee],carbon,8.5);line(c,[hip,knee],coat,5.8);
    line(c,[knee,ankle],carbon,5.4);line(c,[knee,ankle],skin,3.2);
    line(c,[ankle,toe],carbon,4.4);line(c,[ankle,toe],skin,2.5);
    const dir=Math.sign(toe[0]-ankle[0])||-1;
    for(let i=0;i<3;i++){
      const start=[toe[0]-dir*(2+i),toe[1]-.8],end=[toe[0]+dir*(2.7-i*.5),toe[1]+i*.85-1];
      line(c,[start,end],far?"#9c8277":"#d5b39a",1.1);
    }
  }
  function tail(c,f,tension,lunge,flinch){
    const points=[];
    for(let i=0;i<=18;i++){
      const q=i/18,arc=Math.sin(q*Math.PI);
      const x=101+53*q+(8+3*flinch)*arc+4*Math.sin(q*5+f)*q;
      const y=52+(27-21*lunge)*arc-(12+25*flinch-14*lunge)*q*q+
        4*Math.sin(q*5+f)*q-13*tension*q*q;
      points.push([x,y]);
    }
    for(let i=1;i<points.length;i++){
      const q=i/18,r=6.2*(1-q)+.65;
      line(c,[points[i-1],points[i]],carbon,r+1.8);
    }
    for(let i=1;i<points.length;i++){
      const q=i/18,r=6.2*(1-q)+.65;
      line(c,[points[i-1],points[i]],i%3===0?"#69545b":"#a17b76",r);
      if(i%3===1){const [x,y]=points[i];line(c,[[x-1,y-r*.32],[x+1,y-r*.35]],"#c69a86",1)}
    }
  }
  function ratEar(c,x,y,s,back){
    c.save();c.translate(x,y);c.scale(s,s);
    shape(c,"M-5 8 Q-13 2 -11 -8 Q-9 -15 -1 -14 Q9 -13 10 -6 Q12 3 4 10Z",back?"#54454e":"#735f60",carbon,1.6);
    shape(c,"M-7 3 Q-13 -9 -4 -11 Q5 -13 7 -7 Q8 -1 3 6 L1 0 L-2 -3 L-5 4Z",back?"#77545a":ear);
    shape(c,"M-8 -5 Q-6 -11 -2 -10 M0 -10 Q6 -10 7 -5",null,back?"#98756a":"#c79681",1.3);
    shape(c,"M-5 7 L-4 2 L-2 5 L1 2 L4 7Z",furDark);
    c.restore();
  }
  function ratBody(c){
    const p=shape(c,"M33 50 L40 38 L48 33 L45 31 L53 32 L59 26 L59 29 Q70 20 78 19 L76 17 L83 18 Q94 15 103 21 L102 18 Q114 23 117 30 L119 27 Q124 35 121 42 L124 42 L122 51 Q119 62 111 65 L114 65 L104 69 Q89 72 75 66 L69 65 L65 67 L61 64 Q52 64 46 60 L40 60Z",fur,carbon,2.1);
    shape(c,"M42 48 Q56 31 71 25 Q89 18 99 23 Q111 26 115 35 Q106 30 99 30 L101 34 L94 31 L88 33 Q83 30 78 33 L79 35 L74 34 L65 38 L61 38 L54 45Z","#77706f");
    shape(c,"M40 53 Q58 62 71 58 Q77 44 90 40 Q79 51 80 60 L85 64 Q100 70 113 61 Q104 74 84 68 L70 65 L64 67 L62 64 L47 61Z",furDark);
    grain(c,p,[35,16,88,55],84,["#5e5a60","#867b73","#464852","#6b6468","#a08d77"],135,3.8,2.0);
    shape(c,"M48 42 Q67 25 77 23 M80 21 Q93 18 103 24",null,"#b09a80",1.2);
    shape(c,"M82 61 Q79 55 88 45 Q97 36 106 40 M86 61 Q85 55 91 48",null,"#51474f",1.7);
    line(c,[[100,29],[105,31],[111,38]],"#a28b79",1.4);
    // Singe marks and tiny pale tufts follow the spine rather than an applied emblem.
    for(const [x,y] of [[59,34],[68,30],[77,26],[89,23],[104,27]]){
      line(c,[[x-1,y],[x+2,y+1],[x+4,y+4]],"#a18c78",1.5);
      line(c,[[x+2,y+3],[x+5,y+7]],"#4a454c",1.2);
    }
  }
  function ratHead(c,open,warn,hit){
    ratEar(c,38,35,.73,true);
    const p=shape(c,"M11 53 L18 47 L22 42 L25 40 L25 37 L33 38 L39 34 Q49 33 55 40 L59 42 L56 44 L62 46 L57 48 L61 51 L55 53 L57 55 L49 57 L50 59 L44 59 Q38 65 27 62 L21 61 L14 58 L9 57Z",fur,carbon,1.8);
    shape(c,"M12 54 L24 45 Q34 40 40 40 L45 41 L37 46 L29 48 L24 53 L17 56Z",furLight);
    shape(c,"M17 56 L24 54 L29 54 L33 51 L42 52 L47 50 L52 51 L46 55 L47 56 L39 57 L35 60 L26 61Z","#a19481");
    grain(c,p,[11,36,47,27],312,["#92877a","#615b60","#bbb096","#757174"],43,3,-.3);
    ratEar(c,48,34,1,false);
    shape(c,"M26 47 Q30 42 37 44 L34 49 Q29 51 26 48Z",carbon);
    if(hit)line(c,[[26,47],[30,45],[34,45]],"#e5bf8c",1.5);
    else{oval(c,30.3,46.7,warn?3.4:2.4,warn?2.2:1.8,warn?"#fcab52":"#d89454");c.fillStyle=carbon;c.fillRect(30,46,1,2);c.fillStyle="#ffe5ac";c.fillRect(29,45,1,1)}
    shape(c,"M9 53 Q11 51 15 53 L15 55 L12 57 L8 55Z","#a87771",carbon,1);
    const down=open?4:0;c.save();c.translate(0,down);
    shape(c,"M12 56 L20 57 L25 56 L28 58 L24 61 L17 61 L13 59Z",open?"#855a58":"#938572",carbon,1);
    c.restore();
    shape(c,"M14 56 L19 56 L17 61 L15 62Z","#f3d5a8","#66524b",.75);
    for(const [x,y,ex,ey] of [[21,54,5,48],[20,55,3,53],[22,57,5,60],[25,57,12,64]])line(c,[[x,y],[(x+ex)/2,(y+ey)/2-1],[ex,ey]],"#baae96",.8);
    // The rat gathers its stolen twist against the lips before springing.
    const twist=warn?"M16 59 Q10 63 8 60 Q6 58 4 61":"M16 59 Q20 65 13 65 Q8 64 10 68";
    shape(c,twist,null,"#634736",3.2);shape(c,twist,null,"#d6b574",1.65);
    const sparkX=warn?4:10,sparkY=warn?61:68;
    oval(c,sparkX,sparkY,2,1.5,"#dc7147");c.fillStyle="#ffce80";c.fillRect(sparkX-1,sparkY-1,1.5,1.5);
  }
  // Hip, knee, ankle and toes travel independently. Far legs lead by a half-step.
  const limbs={
    idle:[[[61,57],[63,66],[60,76],[51,77]],[[99,58],[108,63],[107,75],[96,76]],[[91,57],[98,67],[95,79],[83,80]],[[53,56],[49,67],[50,78],[39,80]]],
    warn:[[[60,64],[58,72],[55,77],[45,78]],[[103,55],[113,64],[111,75],[99,77]],[[99,55],[108,65],[102,78],[88,80]],[[46,60],[32,69],[33,62],[23,61]]],
    attack:[[[52,49],[36,53],[18,56],[8,57]],[[102,49],[121,49],[133,55],[142,56]],[[95,53],[111,58],[131,64],[144,64]],[[55,53],[45,68],[22,72],[2,74]]],
    hit:[[[68,49],[68,58],[58,57],[55,52]],[[102,60],[115,68],[113,76],[102,78]],[[96,62],[110,69],[103,79],[91,80]],[[65,54],[61,62],[50,56],[45,51]]]
  };
  const frames=8;
  function ratFrame(pose,frame){
    const key=pose+":"+frame;if(creatureFrames.has(key))return creatureFrames.get(key);
    const a=canvas(175,96),c=a.getContext("2d");c.lineJoin="round";c.lineCap="round";c.translate(10,3);
    const f=frame*Math.PI/4,breath=Math.sin(f),warn=pose==="warn",hit=pose==="hit",attack=pose==="attack";
    const lunge=attack?[0,.12,.52,1,.86,.66,.38,.12][frame]:0;
    const flinch=hit?[.12,.55,1,.87,.63,.43,.23,0][frame]:0;
    const tension=warn?(1-Math.cos(f))*.5:0;
    const dx=Math.round(flinch*5-lunge*5);
    const amount=attack?lunge:hit?flinch:warn?tension:0;
    const legs=limbs.idle.map((leg,j)=>leg.map((pt,k)=>pt.map((v,d)=>v+((limbs[pose][j][k][d])-v)*amount)));
    // Ground plane stays fixed while the hind limbs propel the torso and sweep its contact shadow.
    oval(c,79+dx,81,46-7*lunge,4.5-lunge,"#17202a80");
    oval(c,80+dx,81,28,2.2,"#11192375");
    c.save();c.translate(dx,0);
    leg(c,legs[0],true);leg(c,legs[1],true);
    tail(c,f,tension,lunge,flinch);
    c.save();c.translate(99,57-9*lunge+4*flinch);c.rotate(-.21*tension+.26*flinch);
    c.scale(1+.13*lunge-.12*flinch,1-.27*lunge-.06*tension);c.translate(-99,-57+Math.round(breath*.9));
    ratBody(c);c.restore();
    leg(c,legs[2],false);
    const forwardPaw=attack&&lunge>.38;
    if(!forwardPaw)leg(c,legs[3],false);
    c.save();c.translate(38+12*flinch,54+5*tension-10*lunge-12*flinch+Math.round(breath*.75));
    c.rotate(-.10*tension+.68*flinch-.07*lunge);c.translate(-38,-42);
    ratHead(c,attack&&lunge>.6,warn,hit&&flinch>.4);
    if(warn&&frame>1&&frame<7){
      line(c,[[7,48],[4,47],[2,45]],"#d3c4a7",1);line(c,[[9,45],[9,42]],"#a9b1a5",1);
    }
    c.restore();
    if(forwardPaw)leg(c,legs[3],false);
    if(attack&&lunge>.55){
      line(c,[[111,52],[128,49],[139,50]],"#c894687f",1.5);
      line(c,[[112,59],[130,58]],"#d3a06c8c",1);
    }
    c.restore();creatureFrames.set(key,a);return a;
  }
  const staticPose={idle:0,warn:4,hit:2,attack:3};
  function drawBeast(ctx,id,x,y,size,time=0,pose="idle",reduced=false){
    if(id!=="rat"||!(size>0))return;
    if(!(pose in staticPose))pose="idle";
    const rate=pose==="idle"?5:pose==="warn"?8:14;
    const tick=Math.floor(Math.max(0,Number(time)||0)*rate)%frames;
    const source=ratFrame(pose,reduced?staticPose[pose]:tick),scale=size/175;
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.drawImage(source,x-87*scale,y-83*scale,size,96*scale);ctx.restore();
  }
  return {drawItem,drawBeast};
})();
