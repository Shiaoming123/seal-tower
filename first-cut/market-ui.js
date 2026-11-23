/* The merchant's tally board. Geometry is in HUD units; the real buttons sit over its tickets. */
window.MarketUI=(()=>{
  "use strict";
  const {text,textRun,textAtCenterY}=CutInk;
  const ink="#30291f",faded="#6a513c",ivory="#f6dfac",red="#874735",jade="#315b52";
  function shape(c,points,fill,stroke,width=1){
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
    if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}
  }
  function stroke(c,points,color,w=1){
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.stroke();
  }
  function ellipse(c,x,y,rx,ry,color){
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,2*Math.PI);c.fillStyle=color;c.fill();
  }
  function fill(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h)}
  function wash(c,x,y,w,h,stops,across=false){
    const gradient=c.createLinearGradient(x,y,across?x+w:x,across?y:y+h);
    stops.forEach(([at,color])=>gradient.addColorStop(at,color));fill(c,x,y,w,h,gradient);
  }
  const grain=new Map();
  function material(kind){
    if(grain.has(kind))return grain.get(kind);
    const tile=document.createElement("canvas");tile.width=151;tile.height=91;
    const c=tile.getContext("2d");let n=3917;
    const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
    for(let i=0;i<(kind==="wood"?360:790);i++){
      const x=rand()*151,y=rand()*91;
      c.strokeStyle=kind==="wood"?(i%4?"#8f614b30":"#060b0c70"):(i%5?"#9f7c4c27":"#fff9cb69");
      c.lineWidth=kind==="wood"?.64:.50;c.beginPath();c.moveTo(x,y);
      const len=(kind==="wood"?21:2.4)*rand()+.7;
      c.quadraticCurveTo(x+len*.65,y+rand()*1.7,x+len,y+(rand()-.5)*(kind==="wood"?2:3));c.stroke();
    }
    grain.set(kind,tile);return tile;
  }
  function pattern(c,kind,x,y,w,h){const p=c.createPattern(material(kind),"repeat");fill(c,x,y,w,h,p)}
  function corner(c,x,y,fx,fy){
    c.save();c.translate(x,y);c.scale(fx,fy);
    shape(c,[[0,0],[19,0],[19,2],[9,3],[4,7],[2,16],[0,16]],"#987445","#493a2b");
    stroke(c,[[2,13],[3,5],[8,2],[16,1]],"#cfab72",.8);
    ellipse(c,4,4,1.4,1.4,"#40372a");ellipse(c,3.6,3.6,.7,.7,"#e0cb89");c.restore();
  }
  function back(c,x,y,w,h){
    const edge=[[0,5],[6,0],[w-5,0],[w,5],[w-1,h-5],[w-7,h],[4,h-1],[0,h-5]];
    c.save();c.translate(x,y);
    c.save();c.translate(4,6);c.shadowBlur=8;c.shadowColor="#121014a8";shape(c,edge,"#1f1519d9");c.restore();
    shape(c,edge,"#4d352c","#201e1a",1.3);
    c.save();c.beginPath();edge.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.closePath();c.clip();
    wash(c,0,0,w,h,[[0,"#654634"],[.06,"#392b27"],[.40,"#3b3029"],[.91,"#302823"],[1,"#604331"]]);pattern(c,"wood",0,0,w,h);c.restore();
    stroke(c,[[3,8],[7,4],[w-8,4],[w-4,7]],"#a17c50",.8);
    stroke(c,[[5,h-6],[w-8,h-6],[w-4,h-10]],"#987046",.8);
    for(const [a,b,fx,fy] of [[2,2,1,1],[w-2,2,-1,1],[2,h-2,1,-1],[w-2,h-2,-1,-1]])corner(c,a,b,fx,fy);
    c.restore();
  }
  function sheet(c,x,y,w,h,warm,shadow=3){
    c.save();c.translate(x,y);
    const edges=[[0,3],[3,1],[w*.28,1],[w*.31,2],[w*.70,0],[w-5,1],[w,5],[w-1,h*.39],[w-3,h*.41],[w-1,h*.45],[w-1,h-7],[w-8,h-1],[w*.74,h-1],[w*.71,h-3],[w*.67,h-1],[w*.24,h],[6,h-2],[1,h-5]];
    c.save();c.translate(1.6,shadow);shape(c,edges,"#160e0f74");c.restore();shape(c,edges,"#b59a75","#775e43",.8);
    c.save();c.beginPath();edges.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.closePath();c.clip();
    wash(c,0,0,w,h,warm?[[0,"#cdb990"],[.13,"#e4d3a8"],[.55,"#eddfb9"],[1,"#dcc596"]]:[[0,"#bdba96"],[.13,"#d8d3ae"],[.62,"#e5dfbc"],[1,"#cac5a1"]]);
    pattern(c,"paper",0,0,w,h);stroke(c,[[2,h-5],[w*.24,h-3],[w-11,h-4]],"#83664467",.7);
    shape(c,[[w-9,h-1],[w-8,h-9],[w-1,h-8]],warm?"#b39b72":"#a6a787");c.restore();c.restore();
  }
  function cord(c,x,y,wide){
    // Twin hemp stitches fasten the paper to a split bamboo slat.
    const ends=wide?[-14,14]:[-5,5];
    for(const dx of ends){
      ellipse(c,x+dx+1,y+3.6,2.2,1.4,"#79613c");
      stroke(c,[[x+dx+1,y+4],[x+dx-1,y+1],[x+dx,y-6],[x+dx+3,y-8]],"#46372c",2.1);
      stroke(c,[[x+dx,y+2],[x+dx,y-5],[x+dx+2,y-7]],"#dec28a",.8);
    }
  }
  // Each symbol is cut into a different working tool: stamp block, drawstring, sword or book.
  function icon(c,id,x,y,scale,color){
    c.save();c.translate(x,y);c.scale(scale,scale);c.lineCap="round";c.lineJoin="round";
    const l=(p,w=1.6)=>stroke(c,p,color,w);
    if(id==="seal"){
      l([[-7,7],[7,7],[7,3],[-7,3],[-7,7]]);l([[-6,1],[-4,-2],[-2,-2],[-3,-5],[-1,-8],[2,-8],[4,-5],[2,-2],[4,-1],[6,1]]);
      l([[-5,5],[4,5]],.7);
    }else if(id==="bag"){
      l([[-5,-8],[-1,-7],[1,-9],[3,-7],[6,-8],[3,-3],[-3,-3],[-5,-8]]);
      l([[-3,-1],[-7,3],[-7,7],[-3,9],[4,9],[7,6],[6,2],[3,-1]]);l([[-5,-2],[5,-2],[7,0],[9,-1]],1.1);
    }else if(id==="lock"){
      l([[-5,-1],[-5,-5],[-3,-7],[2,-7],[4,-5],[4,-1]]);
      l([[-7,-1],[6,-1],[6,7],[-7,7],[-7,-1]]);l([[0,2],[0,5]]);
    }else if(id==="coin"){
      c.beginPath();c.arc(0,0,7.5,0,Math.PI*2);c.lineWidth=1.4;c.strokeStyle=color;c.stroke();
      l([[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]],1.1);
    }else if(id==="link"){
      l([[-7,-2],[-7,-5],[-3,-8],[1,-7],[3,-4],[2,-1],[-1,2]]);
      l([[7,2],[7,5],[3,8],[-1,7],[-3,4],[-2,1],[1,-2]]);
    }else if(id==="drop"){
      l([[0,-8],[3,-2],[6,2],[5,6],[2,8],[-2,8],[-5,6],[-6,2],[-2,-4],[0,-8]]);
      l([[-3,3],[-2,5],[0,6]],.8);
    }else if(id==="slots"){
      l([[-8,-6],[-3,-6],[-3,6],[-8,6],[-8,-6]]);
      l([[0,-6],[6,-6],[6,6],[0,6],[0,-6]]);
    }else if(id==="blade"){
      l([[-7,8],[5,-5],[8,-9],[7,-4],[-5,7]]);l([[-6,1],[0,6]]);l([[-9,7],[-6,10]],1);
    }else if(id==="road"){
      l([[-8,-4],[8,-4],[6,-6],[-6,-6],[-8,-4]]);l([[-6,-2],[6,-2]]);l([[-5,-3],[-5,7]]);l([[5,-3],[5,7]]);l([[-8,8],[8,8]],1);
    }else if(id==="book"){
      l([[-8,-5],[-3,-6],[0,-4],[4,-6],[8,-5],[8,6],[4,5],[0,7],[-4,5],[-8,6],[-8,-5]]);l([[0,-4],[0,7]],1);
    }else if(id==="rewind"){
      l([[-7,-2],[-3,-6],[3,-6],[7,-2],[7,3],[3,7],[-4,7]]);l([[-7,-6],[-7,-2],[-2,-2]]);
    }else if(id==="sound"){
      l([[-8,-2],[-5,-2],[0,-6],[0,6],[-5,2],[-8,2],[-8,-2]]);l([[3,-3],[6,0],[3,3]]);
    }else{
      l([[0,-8],[7,-1],[3,6],[0,8],[-5,5],[-7,-1],[0,-8]]);l([[-3,-1],[1,-4],[4,-1],[1,2],[-3,-1]],1);
    }
    c.restore();
  }
  function chop(c,x,y,size,color){
    c.save();c.translate(x,y);c.rotate(-.065);const k=size/17;c.scale(k,k);
    shape(c,[[0,1],[13,0],[16,1],[16,15],[14,17],[0,16]],color);
    const l=(a)=>stroke(c,a,"#f3d9a9",1);
    l([[2,4],[5,5],[7,3],[8,6],[11,4],[14,3],[12,10],[8,13],[4,10],[2,4]]);
    l([[4,7],[7,8]]);l([[12,7],[9,8]]);l([[7,10],[9,10],[8,12]]);c.restore();
  }
  function widthOf(str){return [...str].reduce((w,ch)=>w+(ch.charCodeAt(0)>255?1:.57),0)}
  function fitted(c,str,x,y,nominal,space,col,bold=false,role){text(c,str,x,y,Math.min(nominal,space/(widthOf(str)||1)),col,bold,role)}
  function ticket(c,r,side,offer,hover,down,valid){
    const w=r.w,h=r.h;
    c.save();c.translate(r.x,r.y);
    const tone=side?jade:red;
    sheet(c,0,0,w,h,!side,down?1:hover?5:3);
    // A mostly unprinted fore-edge, hairline rule and two staple holes belong to the same ticket.
    stroke(c,[[9,11],[9,h-13]],tone+"78",.7);stroke(c,[[11,11],[11,h-13]],tone+"3d",.6);
    fitted(c,side?"末市路签":"首摊兑票",17,7,12,w-38,tone,true,"title");
    chop(c,w-20,9,11,tone);
    const mark=side?"柒":"肆",amount=(side?offer.later:offer.price)+" 石";
    text(c,mark,15,22,33,tone,true,"title");
    text(c,amount,56,35,14,ink,true,"price");
    stroke(c,[[16,66],[w-11,65]],tone+"70",.8);
    const size=w<119?12:13;
    text(c,side?"持印过夜市狐关":"四石可换砺锋砂",15,68,size,ink);
    text(c,side?"过关再兑价":"狐关剑伤 6 → 10",15,87,size,ink,true);
    const action=r.action;
    const ax=action.x,ay=action.y,aw=action.w,ah=action.h;
    const cy=ay+ah/2+(down?1:0),cx=ax+13,hot=hover&&valid;
    shape(c,[[ax,ay+3],[ax+3,ay],[ax+aw-3,ay],[ax+aw,ay+3],[ax+aw,ay+ah-3],[ax+aw-3,ay+ah],[ax+3,ay+ah],[ax,ay+ah-3]],tone,hot?"#ffdfa4":"#8e7755",hot?1.5:1);
    stroke(c,[[ax+3,ay+5],[ax+6,ay+2],[ax+aw-5,ay+2]],hot?"#f7d49f":"#d4b080",.7);
    stroke(c,[[ax+4,ay+ah-2],[ax+aw-5,ay+ah-2]],"#302820",1);
    icon(c,side?"bag":"seal",cx,cy,.80,"#f5e2b9");
    const label=side?"系袋留印":"钤印成交";
    textAtCenterY(c,label,ax+27,cy,Math.min(15,(aw-33)/4),"#fff1cf",true,"title");
    c.restore();
  }
  const sigils={drop:"mark",guide:"book",rumor:"book",stall:"seal",finalStall:"book",finalQuote:"seal",finalSale:"book",whet:"blade",sharpened:"blade",receipt:"rewind",failed:"rewind"};
  const commands={purchase:"book",nextItem:"book",crossroads:"road",gate:"blade",counter:"bag",scavenge:"coin",skirt:"road",
    "blood-coins":"drop","blood-slot":"slots","skip-blood":"book","barter-mirror":"link","barter-fang":"link",
    "buy-mirror":"coin","buy-fang":"coin",salve:"coin",grit:"coin"};
  function actionSlug(c,r,i,stage,hover,down,valid){
    const w=r.w,h=r.h; c.save();c.translate(r.x,r.y+(down?2:hover?-1:0));
    if(r.disabled)c.globalAlpha*=.51;
    const p=[[0,4],[5,0],[w-3,0],[w,3],[w-1,h-4],[w-6,h],[3,h-1],[0,h-4]];
    c.save();c.translate(1,down?1:3);shape(c,p,"#19141199");c.restore();
    shape(c,p,i?"#4b4940":"#664434",hover&&valid?"#efd59a":"#a88954",1.1);
    stroke(c,[[3,6],[7,3],[w-6,3]],hover?"#d6bb8c":"#af8b63",.7);
    stroke(c,[[3,h-5],[w-7,h-4],[w-4,h-7]],"#302820",.8);
    const emblem=r.disabled?"lock":commands[r.command]||(i?"road":sigils[stage]||"road"),cx=17,cy=h/2;
    ellipse(c,cx,cy,8,8,"#322f28");icon(c,emblem,cx,cy,.71,"#e6c28c");
    fitted(c,r.label,30,(h-21)/2,14,w-37,"#f5dfb5",true);
    c.restore();
  }
  function header(c,L,m,cash,seals,sound){
    const x=L.base.portrait?10:14,y=L.topY;
    c.save();
    const ph=28,cy=y+ph/2,title=m.place,stones="灵石 "+cash,marks="妖印 "+seals;
    const titleW=textRun(title,15,ivory,true,"speech").inkWidth;
    const amountW=textRun(stones,12,"#dfc591",true,"price").inkWidth;
    const marksW=textRun(marks,12,"#dfc591",true,"price").inkWidth;
    const left=x+27,divider=left+titleW+8,statsX=divider+8;
    const compact=L.base.portrait&&L.base.w<365;
    const marksX=statsX+amountW+10,plateW=(compact?statsX+amountW:marksX+marksW)+12-x;
    shape(c,[[x+1,y+5],[x+6,y],[x+plateW-6,y],[x+plateW,y+5],[x+plateW-1,y+ph-3],[x+plateW-6,y+ph],[x+4,y+ph],[x,y+ph-4]],"#302a25ee","#94754d",1);
    stroke(c,[[x+5,y+3],[x+plateW-7,y+3]],"#c4a17174",.8);
    chop(c,x+8,cy-6.5,13,"#9b513b");
    textAtCenterY(c,title,left,cy,15,ivory,true,"speech");
    stroke(c,[[divider,cy-7.5],[divider,cy+7.5]],"#8c7755",.8);
    textAtCenterY(c,stones,statsX,cy,12,"#dfc591",true,"price");
    if(!compact)textAtCenterY(c,marks,marksX,cy,12,"#dfc591",true,"price");
    for(const [cx,token] of [[L.resetX,"rewind"],[L.soundX,"sound"]]){
      const cy=y+13;
      ellipse(c,cx+1,cy+2,12,12,"#201a18b3");ellipse(c,cx,cy,12,12,"#9a7949");ellipse(c,cx-.5,cy-.5,10.5,10.5,"#44392e");
      icon(c,token,cx,cy,.83,"#ead09c");if(token==="sound"&&!sound)stroke(c,[[cx-7,cy+7],[cx+7,cy-7]],"#db8868",1.4);
    }
    c.restore();
  }
  function ribbon(c,x,y,w,label){
    shape(c,[[x,y],[x+w,y],[x+w-4,y+7],[x+w,y+15],[x+2,y+15]],"#86503c");
    fitted(c,label,x+4,y-.3,10,w-11,"#fff0d0",true);
  }
  function draw(c,L,m,state){
    const {stage,give,selling,landed,offer,active,hover,down,cash,seals,sound}=state;
    const {w,h,scale}=L.panel,x=0,y=0;
    c.clearRect(0,0,L.base.w,L.base.h);header(c,L,m,cash,seals,sound);
    c.save();c.translate(L.panel.x,L.panel.y);c.scale(scale,scale);
    back(c,x,y,w,h);
    const waiting=(stage==="quote"||stage==="finalQuote")&&give<.94;
    const tally=selling&&landed<offer.price;
    const choice=stage==="quote"&&!waiting;
    if(choice){
      text(c,"灯纹印估单",x+15,y+5,24,ivory,true,"title");
      const rw=64;ribbon(c,x+w-rw-10,y+11,rw,"绯绡出价");
      L.rects.forEach((r,i)=>{ticket(c,r,i,offer,hover===i,down===i,active);cord(c,r.x+r.w*.62,r.y+2,false)});
      c.restore();
      return;
    }
    const xx=x+8,yy=y+8,ww=w-16,hh=h-16;
    sheet(c,xx,yy,ww,hh,true);
    stroke(c,[[xx+11,yy+14],[xx+11,yy+hh-10]],"#965e446e",.8);
    cord(c,xx+ww-30,yy+2,true);
    const title=waiting?"绯绡落秤":tally?"灵石过手":m.title;
    const tag=waiting?"验纹":tally?"清点":m.tag;
    const tx=xx+17;
    text(c,title,tx,yy+14,25,ink,true,"title");
    let tw=Math.min(ww*.36,widthOf(tag)*10+13);
    ribbon(c,xx+ww-tw-12,yy+14,tw,tag);
    stroke(c,[[tx,yy+52],[xx+ww-15,yy+51]],"#947351a0",.85);
    const lines=waiting?["绯绡将秤递到灯前，","缺角的灯纹印稳稳压低了秤杆。"]:tally?["绯绡拨过秤砣，正在清点灵石。","已收  "+landed+" / "+offer.price+" 石"]:m.lines;
    lines.forEach((value,i)=>fitted(c,value,tx,yy+58+i*21,14,ww-34,ink,false,"speech"));
    const note=m.note&&!waiting&&!tally;
    const extraRows=Math.max(0,lines.length-2)*21;
    if(note)fitted(c,m.note,tx,yy+100+extraRows,13,ww-34,ink,false,"speech");
    if(m.ledger&&!waiting&&!tally){
      const offset=extraRows+(note?21:0);
      stroke(c,[[tx,yy+107+offset],[xx+ww-15,yy+106+offset]],"#9b825c70",.7);
      fitted(c,m.ledger,tx,yy+110+offset,12,ww-36,"#694932",true);
    }
    if(!waiting&&!tally){
      L.rects.forEach((r,i)=>actionSlug(c,r,i,stage,hover===i,down===i,active));
    }
    c.restore();
  }
  return {draw,header,back,sheet,cord,icon,chop,actionSlug};
})();
