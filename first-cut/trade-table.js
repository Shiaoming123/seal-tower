/* An overhead view of the existing counter. All dimensions are shared with the input layer. */
window.TradeTable=(()=>{
  "use strict";
  const {textRun,textAtCenterY}=CutInk;
  const {sheet,back,header,icon,chop,cord,actionSlug}=MarketUI;
  const idForSprite={"order-ash":"merch-ash",grit:"grit",salve:"merch-salve",mirror:"merch-mirror",fang:"merch-fang",hook:"merch-hook","ward-blade":"merch-ward-blade",knot:"merch-knot"};
  const ink="#312b24",umber="#694836",cream="#f0d9ae",gold="#b7935f",jade="#315b51",cinnabar="#874735";
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const box=(x,y,w,h)=>({x,y,w,h});
  function line(c,points,color,width=1){
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();
  }
  function poly(c,points,color,edge){
    c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();
    if(edge){c.strokeStyle=edge;c.lineWidth=.85;c.stroke()}
  }
  function oval(c,x,y,rx,ry,col){
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=col;c.fill();
  }
  function label(c,s,x,y,max,size,color=ink,role="speech",center=false){
    if(!s)return;
    const run=textRun(s,size,color,true,role),k=Math.min(1,max/Math.max(1,run.inkWidth));
    c.save();c.translate(x,y);c.scale(k,k);
    textAtCenterY(c,s,center?-run.inkWidth/2:0,0,size,color,true,role);c.restore();
  }
  function wrap(c,s,r,y,size,maxLines,color=ink){
    let value="",lines=[];
    for(const ch of s||""){
      if(value&&!/[，。！？、；）]/.test(ch)&&textRun(value+ch,size,color,false,"speech").inkWidth>r.w){lines.push(value);value=""}
      value+=ch;
    }
    if(value)lines.push(value);
    if(lines.length>maxLines){lines[maxLines-1]=lines.slice(maxLines-1).join("");lines.length=maxLines}
    for(const [i,l] of lines.entries())label(c,l,r.x,y+i*(size+4),r.w,size,color);
    return y+lines.length*(size+4);
  }
  function layout(L,m){
    const {w,h,ratio,portrait}=L,short=h<350,topY=portrait?7:6,top=topY+37;
    const edge=portrait?11:Math.max(12,w*.02),gap=portrait?8:13;
    const bh=Math.max(29,Math.ceil(44/ratio)),navY=h-bh-9;
    const nav=portrait?box(edge,navY,w-edge*2,bh):box(edge,navY,Math.min(w*.56,368),bh);
    let paper,display,rows,cols;
    const count=m.lots.length;
    if(portrait){
      cols=count<=2?2:3;rows=Math.max(1,Math.ceil(count/cols));
      const paperH=m.invoice?clamp(h*.34,220,237):clamp(h*.275,174,190);
      paper=box(edge,navY-gap-paperH,w-edge*2,paperH);
      display=box(edge,top+17,w-edge*2,Math.max(72,paper.y-top-20-gap));
    }else{
      const dw=clamp(w*.317,206,283);
      paper=box(w-edge-dw,top+7,dw,h-top-19);
      display=box(edge,top+25,paper.x-edge-gap,Math.max(77,navY-top-32));
      cols=count<=3?Math.max(2,count):count<=6?3:4;rows=Math.max(1,Math.ceil(count/cols));
    }
    const extra={};
    if(m.sheets.length){
      const tabH=Math.max(25,Math.ceil(43/ratio)),tabW=Math.min(89,display.w*.28);
      const tabY=top-2;
      extra["market-gear"]=box(display.x,tabY,tabW,tabH);
      extra["market-cargo"]=box(display.x+tabW+5,tabY,tabW,tabH);
      const shift=Math.max(0,tabY+tabH+4-display.y);display.y+=shift;display.h-=shift;
    }
    const cellW=display.w/cols,cellH=Math.min(display.h/rows,rows===1?cellW*1.02:Infinity),lots=[];
    const topInset=(display.h-cellH*rows)*.46;
    for(let i=0;i<count;i++){
      const row=Math.floor(i/cols),n=Math.min(cols,count-row*cols);
      const offset=(cols-n)*cellW*.5;
      lots.push(box(display.x+offset+(i%cols)*cellW+2,display.y+topInset+row*cellH+1,cellW-4,cellH-3));
    }
    const pad=portrait?13:14,buttonGap=5;
    const aw=paper.w-pad*2,x=paper.x+pad,lastY=paper.y+paper.h-8-bh;
    const pair=!!m.commands[1],horiz=portrait||short;
    const ar=[
      box(x,!horiz&&pair?lastY-bh-5:lastY,horiz&&pair?(aw-buttonGap)/2:aw,bh),
      pair?(horiz?box(x+(aw+buttonGap)/2,lastY,(aw-buttonGap)/2,bh):box(x,lastY,aw,bh)):null
    ];
    if(m.escort&&m.commands[3]){
      const lane=(nav.w-gap)/3;
      ar.push(box(nav.x,nav.y,lane,bh),box(nav.x+2*lane+gap,nav.y,lane,bh));
      extra["market-escort"]=box(nav.x+lane+gap/2,nav.y,lane,bh);
    }else if(m.commands[3]){ar.push(box(nav.x,nav.y,(nav.w-gap)/2,bh),box(nav.x+(nav.w+gap)/2,nav.y,(nav.w-gap)/2,bh))}
    else ar.push(box(nav.x,nav.y,Math.min(nav.w,portrait?nav.w:200),bh),null);
    const choose=[];
    if(m.maxQty>1)choose.push("market-quantity");
    if(m.stacks?.length>1)choose.push("market-stack");
    const pickH=Math.max(25,Math.ceil(40/ratio));
    for(const [i,id] of choose.entries()){
      const sw=(aw-buttonGap*(choose.length-1))/choose.length;
      extra[id]=box(x+i*(sw+buttonGap),ar[0].y-53-pickH,sw,pickH);
    }
    return {base:L,lots,ar,paper,display,cols,topY,nav,extra,soundX:w-20,resetX:w-57};
  }
  function background(c,w,h){
    c.fillStyle="#24413b";c.fillRect(0,0,w,h);
    const im=TowerSprites.get("trade-cloth");
    if(im){
      // Fit the embroidered edges to the table on both wide and narrow screens.
      c.drawImage(im,0,0,w,h);
    }else{
      const tone=c.createLinearGradient(0,0,w,h);tone.addColorStop(0,"#3d5345");tone.addColorStop(.58,"#35504a");tone.addColorStop(1,"#1e3130");c.fillStyle=tone;c.fillRect(0,0,w,h);
      for(let x=0;x<w;x+=4)line(c,[[x,0],[x+7,h]],"#b2a88012",.65);
      for(let y=2;y<h;y+=4)line(c,[[0,y],[w,y-4]],"#c3c19e0e",.65);
      for(const y of [0,h-7]){c.fillStyle="#704b35";c.fillRect(0,y,w,7);line(c,[[0,y+2],[w,y+2]],"#b08b5b",.9)}
      for(const x of [4,w-7])line(c,[[x,6],[x,h-6]],"#b3996c78",2);
    }
    const vign=c.createRadialGradient(w*.38,h*.38,0,w*.46,h*.43,w*.74);
    vign.addColorStop(0,"#ccb58109");vign.addColorStop(.65,"#19262702");vign.addColorStop(1,"#141c19a6");c.fillStyle=vign;c.fillRect(0,0,w,h);
  }
  function paperOrder(c,id,x,y,w,h){
    const sw=Math.min(w*.75,h*1.04),sh=sw*.78;
    c.save();c.translate(x,y-sh*.06);c.rotate(id==="order-hook"?-.10:.07);
    for(let i=2;i>=0;i--)sheet(c,-sw*.5+i*2,-sh*.58+i*2,sw,sh,false,1);
    label(c,id==="order-hook"?"兵　帖":"银　帖",-sw*.40,-sh*.30,sw*.72,sh*.27,umber,"title");
    for(let i=0;i<4;i++)line(c,[[-sw*.40,-sh*.04+i*sh*.095],[sw*(i%2?.06:.23),-sh*.04+i*sh*.095]],"#78664790",.75);
    chop(c,sw*.20,sh*.11,sh*.24,cinnabar);cord(c,sw*.20,-sh*.59,false);c.restore();
  }
  function object(c,item,x,y,w,h){
    const id=item.id,sprite=TowerSprites.get(idForSprite[id]||"merch-"+id);
    if(sprite){
      const k=Math.min(w/sprite.naturalWidth,h/sprite.naturalHeight),iw=sprite.naturalWidth*k,ih=sprite.naturalHeight*k;
      // Ambient shadows follow the main contact, while the offset silhouette reaches into the weave.
      const yy=y-ih/2,xx=x-iw/2;
      const contact=(u,v,rx)=>oval(c,xx+u*iw,yy+v*ih,Math.max(2,iw*rx),Math.max(.8,ih*.012),"#1425228c");
      if(id==="mirror"){contact(.10,.925,.10);contact(.756,.94,.09);contact(.326,.985,.07)}
      else if(id==="fang"){contact(.28,.865,.26);contact(.70,.846,.17)}
      else if(id==="salve")contact(.50,.979,.23);
      else if(id==="grit")contact(.50,.96,.33);
      c.save();c.shadowColor="#11231fb3";c.shadowBlur=Math.max(1.5,iw*.03);c.shadowOffsetX=iw*.023;c.shadowOffsetY=ih*.035;
      c.drawImage(sprite,xx,yy,iw,ih);c.restore();return;
    }
    if(item.tradeKind==="order")paperOrder(c,id,x,y,w,h);
  }
  function price(item){
    if(item.id==="abacus"&&!item.owned)return "换铃";
    if(item.owned&&item.tradeKind!=="sell")return item.tradeKind==="order"?"已订":"已取";
    const n=item.price??item.actions?.[0]?.label?.match(/\d+/)?.[0];
    return (item.tradeKind==="sell"?"收 ":item.tradeKind==="order"?"订 ":"")+(n??"")+" 石";
  }
  function pin(c,x,y,size){
    const im=TowerSprites.get("fox-pin");
    c.save();c.translate(x,y);
    if(im){
      const w=size,h=w*im.naturalHeight/im.naturalWidth;
      c.drawImage(im,-w*.06,-h*.88,w,h);
    }else{
      c.scale(size/63,size/63);line(c,[[0,0],[36,-23]],"#ab793e",3);line(c,[[1,-1],[34,-23]],"#f0d294",1);
      poly(c,[[24,-20],[25,-31],[32,-27],[38,-30],[41,-27],[41,-20],[32,-15]],"#8fb99a","#d5dab1");
      line(c,[[40,-23],[43,-20],[48,-25],[54,-23]],"#dab26b",1.1);line(c,[[53,-23],[59,-17],[62,-18]],"#ae5845",2.1);
    }c.restore();
  }
  function lotGeometry(item,r,large){
    const [cx,tip]=[r.x+r.w/2,Math.min(large?24:20,r.h*.3)];
    const tagW=Math.min(r.w-4,large?130:103),tagH=clamp(tip,15,23),tagY=r.y+r.h-tagH;
    const iw=Math.min(r.w*.91,(r.h-tagH)*1.92),ih=Math.max(22,r.h-tagH-5);
    const im=TowerSprites.get(idForSprite[item.id]||"merch-"+item.id);
    const artH=im?Math.min(ih,iw*im.naturalHeight/im.naturalWidth):Math.min(iw*.75,ih*1.04)*.78;
    return {cx,tagW,tagH,tagY,iw,ih,cy:tagY-3-artH*.52};
  }
  const masks=new Map();
  function hitLot(item,r,x,y,large){
    const {cx,tagW,tagH,tagY,iw,ih,cy}=lotGeometry(item,r,large);
    if(x>=cx-tagW/2&&x<=cx+tagW/2&&y>=tagY&&y<=tagY+tagH)return true;
    const im=TowerSprites.get(idForSprite[item.id]||"merch-"+item.id);
    if(!im)return Math.abs(x-cx)<Math.min(iw,ih*1.04)*.41&&Math.abs(y-cy)<ih*.31;
    const k=Math.min(iw/im.naturalWidth,ih/im.naturalHeight);
    const u=(x-cx)/k+im.naturalWidth/2,v=(y-cy)/k+im.naturalHeight/2;
    if(u<0||u>=im.naturalWidth||v<0||v>=im.naturalHeight)return false;
    let d=masks.get(im);
    if(!d){
      const tile=document.createElement("canvas");tile.width=im.naturalWidth;tile.height=im.naturalHeight;
      const pen=tile.getContext("2d",{willReadFrequently:true});pen.drawImage(im,0,0);
      d=pen.getImageData(0,0,tile.width,tile.height).data;masks.set(im,d);
    }
    return d[(Math.floor(v)*im.naturalWidth+Math.floor(u))*4+3]>32;
  }
  function showLot(c,item,r,selected,hovered,pressed,large){
    const {cx,tagW,tagH,tagY,iw,ih,cy}=lotGeometry(item,r,large);
    c.save();
    if(pressed)c.translate(0,1.5);
    const nameSize=large?12:11.7;
    if(selected||hovered){
      const g=c.createRadialGradient(cx,r.y+r.h*.48,0,cx,r.y+r.h*.48,r.w*.54);g.addColorStop(0,selected?"#ffdf8e3b":"#fbecc024");g.addColorStop(1,"#f5dda400");
      c.fillStyle=g;c.fillRect(r.x,r.y,r.w,r.h);
    }
    const x=cx-tagW/2,y=tagY;
    const pts=[[x,y+3],[x+4,y],[x+tagW-6,y],[x+tagW,y+3],[x+tagW-2,y+tagH-2],[x+tagW-6,y+tagH],[x+2,y+tagH-1]];
    c.save();c.translate(1,2);poly(c,pts,"#1a282398");c.restore();poly(c,pts,selected?"#e6cd9b":"#bfa77e",selected?"#f2d99e":"#816b4c");
    if(hovered){
      for(const side of [-1,1]){
        const bx=side<0?x-1:x+tagW+1;
        line(c,[[bx-side*7,y-1],[bx,y-1],[bx,y+tagH+1],[bx-side*7,y+tagH+1]],"#fff0ba",1.65);
      }
    }
    line(c,[[x+3,y+tagH-3],[x+tagW-4,y+tagH-3]],"#896c4c75",.7);
    const money=price(item),mw=clamp(money.length*5.2+4,17,35),split=x+tagW-mw-3;
    label(c,item.name,x+5,y+tagH*.50,split-x-7,nameSize,ink,"speech");
    line(c,[[split,y+4],[split,y+tagH-4]],"#8a624784",.7);
    label(c,money,split+2,y+tagH*.50,mw-2,Math.min(nameSize,11.3),item.owned?umber:"#82392d","price");
    if(selected){
      const size=Math.min(r.w*.58,r.h*.74,83);
      pin(c,Math.min(x+tagW*.57,r.x+r.w-size*.94),y+4,size);
    }
    c.restore();
  }
  function clothTab(c,r,title,active,focus){
    const x=r.x+2,y=r.y+2,w=r.w-4,h=r.h-4;
    poly(c,[[x+4,y],[x+w-4,y],[x+w,y+4],[x+w,y+h-3],[x+w-3,y+h],[x+3,y+h],[x,y+h-3],[x,y+4]],
      active?"#e0c291":"#394640",focus?"#fff0bf":"#bb9364");
    line(c,[[x+4,y+h-4],[x+w-4,y+h-4]],active?"#af7747":"#657466",1.2);
    label(c,title,x+w/2,y+h*.48,w-9,13.8,active?ink:cream,"title",true);
  }
  function invoice(c,T,m,x,y,wr,bottom){
    const o=m.order,p=T.paper,choices=[T.extra["market-quantity"],T.extra["market-stack"]].filter(Boolean);
    const foot=T.ar[0].y;
    const toolsY=choices.length?choices[0].y:foot-55;
    const available=toolsY-y-3,desc=m.item.effect||"";
    if(!T.base.portrait&&available>100){
      const h=Math.min(87,available-47);object(c,m.item,x+wr/2,y+h/2-5,wr*.81,h);
      y+=h+6;
    }
    if(toolsY-y>10){
      const brief=m.item.id==="silk"?(m.late?"旺常价照路签，按份交割。":"一叠占两格，最多三份，首柜限购两份。"):desc;
      wrap(c,brief,box(x,y,wr,0),y,13,toolsY-y>33?2:1);
    }
    const qty=T.extra["market-quantity"],stack=T.extra["market-stack"];
    if(qty)clothTab(c,qty,"数量　"+m.quantity+" 份  →",true,document.activeElement.id==="market-quantity");
    if(stack)clothTab(c,stack,"货叠　"+(m.stackIndex+1)+"/"+m.stacks.length+"  →",true,document.activeElement.id==="market-stack");
    line(c,[[x,foot-51],[x+wr,foot-51]],"#9b856079");
    const dir=m.item.tradeKind==="sell"?"收":"付";
    const amount=m.item.id==="abacus"?"旧铜铃换算盘 · 免添灵石":o.unitPrice+" 石／份 × "+o.qty+" 份　"+dir+" "+o.total+" 石";
    label(c,amount,x,foot-42,wr,13.2,ink,"price");
    const balance="余额 "+m.cash+" → "+o.balanceAfter;
    const forecast=o.balanceAfter<0?"现有 "+m.cash+" 石 · 尚缺 "+(-o.balanceAfter)+" 石":m.late?
      balance+(m.item.id==="silk"?"　此单绢利 "+((o.unitPrice-2)*o.qty)+" 石":""):balance+"　首击加伤 "+o.bonusBefore+" → "+o.bonusAfter;
    label(c,forecast,x,foot-25,wr,12.3,jade,"price");
    const sale=m.item.id==="silk"&&m.late?"本行绢款 "+m.market.ledger.silkRevenue+" 石 · 本钱 "+m.market.ledger.silkCost+" 石":"";
    const note=m.notice||(o.disabled?o.reason:sale||m.exitReason);
    if(note)label(c,note,x,foot-9,wr,11.8,o.disabled&&!m.notice?cinnabar:umber);
  }
  function documentView(c,T,m){
    const p=T.paper,{portrait}=T.base,x=p.x+14,wr=p.w-28,item=m.item;
    back(c,p.x,p.y,p.w,p.h);sheet(c,p.x+5,p.y+5,p.w-10,p.h-11,true);
    cord(c,p.x+p.w-30,p.y+9,true);
    if(!item){label(c,"柜上货已清",x,p.y+29,wr,21,ink,"title");return}
    const bottom=T.ar[0].y-5;
    const showPreview=!portrait&&bottom-p.y>175;
    const headerY=p.y+(portrait?21:25);
    const seal=item.tradeKind==="sell"?"收货":item.tradeKind==="order"?"订契":"验货";
    label(c,item.name,x,headerY,wr-62,portrait?23:28,ink,"title");
    label(c,seal,p.x+p.w-52,headerY,34,13,cinnabar,"title");
    line(c,[[x,headerY+17],[x+wr,headerY+16]],"#987751a3",.85);
    let yy=headerY+30;
    if(m.invoice){invoice(c,T,m,x,yy,wr,bottom);return}
    if(showPreview){
      const previewH=clamp((bottom-p.y)*.36,56,122);
      object(c,item,x+wr/2,yy+previewH*.48,wr*.80,previewH);
      yy+=previewH+7;
    }
    const ctxRect=box(x,yy,wr,0),description=item.effect||"";
    yy=wrap(c,description,ctxRect,yy,portrait?13.7:14.3,portrait?2:3);
    const main=m.commands[0],alt=m.commands[1];
    const cashAfter=main.balanceAfter;
    const pay=main?.disabled?main.reason:(item.tradeKind==="sell"?"售后 ":"付后余 ")+cashAfter+" 石"+(main.bonusBefore||main.bonusAfter?" · 首击 +"+main.bonusBefore+" → +"+main.bonusAfter:"");
    const barter=alt&&!alt.disabled?"交铃后余 "+(m.cash-Number(alt.label.match(/\d+/)?.[0]||0))+" 石，血棘失去护持":"";
    const note=m.notice||m.exitReason||barter||m.equipNote,small=note||item.slot+" · "+item.duration;
    const one=m.notice||m.exitReason?pay:[pay,alt?.disabled?alt.reason:""].filter((a,i,x)=>a&&x.indexOf(a)===i).join(" · ");
    const areaY=bottom-30;
    if(yy<areaY-15&&note)label(c,item.slot+" · "+item.duration,x,yy+2,wr,12,umber);
    if(yy<areaY-3)line(c,[[x,areaY-4],[x+wr,areaY-4]],"#9b856054",.75);
    if(small)label(c,small,x,Math.max(yy-3,areaY+5),wr,12.3,m.notice?jade:umber);
    if(one)label(c,one,x,bottom-5,wr,12.5,main.disabled&&!m.notice?cinnabar:jade,"price");
  }
  function ease(x){
    x=clamp(x,0,1);return x*x*(3-2*x);
  }
  function copyCanvas(source){
    const copy=document.createElement("canvas");copy.width=source.width;copy.height=source.height;
    copy.getContext("2d").drawImage(source,0,0);return copy;
  }
  function capture(source,hud,artBox,width,height){
    const scene=copyCanvas(source),pen=scene.getContext("2d"),edge=.12;
    // Blend only the near lip of the old counter into the cloth beneath the moving lens.
    const shade=pen.createLinearGradient(0,scene.height*(1-edge),0,scene.height);
    shade.addColorStop(0,"transparent");shade.addColorStop(1,"black");
    pen.globalCompositeOperation="destination-out";pen.fillStyle=shade;pen.fillRect(0,0,scene.width,scene.height);
    return {scene,ledger:copyCanvas(hud),x:artBox.x/width,bottom:(artBox.y+540*artBox.zoom)/height,
      width:960*artBox.zoom/width,height:540*artBox.zoom/height,edge};
  }
  function wares(c,T,m,f){
    const large=!T.base.portrait;
    for(const [i,r] of T.lots.entries()){
      const item=m.lots[i],g=lotGeometry(item,r,large);
      object(c,item,g.cx,g.cy+(i===f.lotDown?1.5:0),g.iw,g.ih);
    }
  }
  function draw(c,T,m,f){
    const {w,h,portrait}=T.base,p=f.tableProgress??1,origin=f.counterOrigin;
    const tilt=ease(p/.8),paper=ease((p-.80)/.20);
    c.clearRect(0,0,w,h);c.save();
    if(origin&&p<.8){
      const sceneW=origin.width*w,sceneH=origin.height*h;
      const zoom=1+.30*tilt,foot=origin.bottom*h*(1-tilt)-h*.04*tilt;
      const x=origin.x*w-(sceneW*.78)*.30*tilt;
      const seam=foot-sceneH*zoom*origin.edge;
      c.save();c.beginPath();c.rect(0,seam,w,h-seam);c.clip();
      // We enter through the brocade in the foreground. The table extends beyond both
      // sides of the shot until the lens is perpendicular and its frame enters view.
      const overscan=1+.48*(1-tilt);
      c.translate(w*(1-overscan)*.5,Math.max(0,foot)-h*.49*(1-tilt));
      c.scale(overscan,1+.50*(1-tilt));
      background(c,w,h);
      if(p>.42){
        c.globalAlpha=ease((p-.42)/.30);
        wares(c,T,m,f);
      }
      c.restore();
      c.drawImage(origin.scene,x,foot-sceneH*zoom,sceneW*zoom,sceneH*zoom);
    }else{
      background(c,w,h);
      c.save();c.globalAlpha=origin||p===1?1:ease(p/.65);wares(c,T,m,f);c.restore();
    }
    if(origin&&p<.16){
      c.save();c.globalAlpha=1-ease(p/.16);c.drawImage(origin.ledger,0,0,w,h);c.restore();
    }
    if(paper===0){c.restore();return}
    c.globalAlpha=paper;
    const d=T.display;
    if(m.sheets.length){
      for(const [key,title] of [["gear","器物"],["cargo","商货"]]){
        const id="market-"+key;
        clothTab(c,T.extra[id],title,m.shelf===key,document.activeElement.id===id);
      }
      const start=T.extra["market-cargo"].x+T.extra["market-cargo"].w+8;
      label(c,m.shelf==="cargo"?(m.market.hot?"旺市 · 每份收 4 石":"常市 · 每份收 1 石"):"绯绡的货摊",start,T.extra["market-cargo"].y+T.extra["market-cargo"].h/2,d.x+d.w-start-3,13,cream,"speech");
    }else label(c,m.late?"闭市 · 收料与订契":"绯绡的货摊",d.x+7,d.y-(portrait?10:13),Math.min(d.w*.61,235),portrait?17:20,cream,"title");
    if(!m.sheets.length)label(c,"点货验看",d.x+d.w-64,d.y-(portrait?9:12),64,12,"#d8c7a0");
    T.lots.forEach((r,i)=>showLot(c,m.lots[i],r,i===m.index,i===f.lotHover,i===f.lotDown,!portrait));
    documentView(c,T,m);
    for(let i=0;i<4;i++){
      const a=m.commands[i],r=T.ar[i];if(!a||!r)continue;
      actionSlug(c,{...r,label:m.keys[i],command:a.id,disabled:a.disabled},i<2?i:1,"counter",f.hover===i,f.down===i,f.active);
    }
    if(m.escort){
      const r=T.extra["market-escort"];
      actionSlug(c,{...r,label:"接押运",command:"gate"},0,"counter",document.activeElement.id==="market-escort",false,f.active);
    }
    header(c,T,m,f.cash,f.seals,f.sound);c.restore();
  }
  return {layout,draw,hitLot,capture};
})();
