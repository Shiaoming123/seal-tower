/* One fixed rear camera. The rule engine owns the cargo, stops, road choices and receipt. */
window.EscortUI=(()=>{
  "use strict";
  const game=document.querySelector("#game");
  const el=(tag,cls,content)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;if(content!==undefined)node.textContent=content;
    return node;
  };
  const button=(name,cls)=>{
    const b=el("button",cls,name);b.type="button";return b;
  };
  const root=el("section","escort");root.id="escort-view";root.hidden=true;
  root.setAttribute("aria-label","狐灯押运");
  const stage=el("div","escort-scene"),canvas=el("canvas","escort-world");
  canvas.setAttribute("aria-label","沿山路前行的镖车，左右滑动换道，点车护封");
  const marketSign=button("","escort-road-sign");marketSign.hidden=true;
  marketSign.onclick=()=>actions.querySelector("[data-escort=enter-market]")?.click();
  const front=el("header","escort-head"),place=el("h2","escort-place"),location=el("span","escort-place-label","狐灯镖局");
  const mast=el("div","escort-mast"),instruments=el("div","escort-instruments");
  const stat=(name)=>{const n=el("div","escort-stat"),cap=el("span","",name),val=el("b");n.append(cap,val);instruments.append(n);return val};
  const silver=stat("灵石"),crates=stat("在车"),rig=stat("封签");
  const pack=button("行囊","escort-pack");pack.dataset.escort="pack";pack.setAttribute("aria-label","暂停行车，查看行囊");
  mast.append(location,place);front.append(mast,instruments,pack);
  const trail=el("div","escort-trail"),mile=el("span","escort-mile"),bar=el("div","escort-rail"),fill=el("div","escort-rail-fill");
  for(let i=1;i<6;i++){const tick=el("i");tick.style.left=i/6*100+"%";bar.append(tick)}bar.append(fill);
  const pace=button("催马","escort-pace");pace.dataset.escort="pace";trail.append(mile,bar,pace);
  const live=el("span","escort-live");trail.insertBefore(live,pace);
  const panel=el("section","escort-ledger"),caption=el("span","escort-caption"),title=el("h3"),desc=el("p","escort-desc");
  const summary=el("div","escort-summary"),notice=el("p","escort-notice"),actions=el("div","escort-actions");
  notice.setAttribute("role","status");const feedback=el("output","escort-toast");feedback.hidden=true;
  panel.append(caption,title,desc,summary,notice,actions);stage.append(canvas,marketSign,feedback);root.append(stage,front,trail,panel);
  game.insertBefore(root,document.querySelector("#profile"));
  let api=null,v=null,frame=0,previous=0,travel=0,odometer=0,lane=0,targetLane=0,fast=false;
  let wheel="right",bracing=false,enteringTurnoff=false,turnoffProgress=0;
  let viewToken="",effect=0,effectKind="",swipe=null,cartHit=null,roadHorizon=.5;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
  // Seconds to traverse one whole marker. The turnoff keeps a separate reading clock.
  const normalPace={clear:1.85,hazard:5.4},expressPace={clear:1.16,hazard:3.6},marketApproachSeconds=7.5;
  let roadRate=0;
  function needsResponse(){return v.cargo.intact>0&&(bracing?"brace":wheel)!==v.cue}
  function advanceRoad(dt){
    const pace=fast?expressPace:normalPace;
    const alert=needsResponse();
    const target=1/(alert?pace.hazard:pace.clear);
    // Brake on the first frame of a warning. Ease back up once the cargo is safe.
    if(alert||roadRate===0||roadRate>=target)roadRate=target;
    else roadRate+=(target-roadRate)*(1-Math.exp(-dt/.14));
    const step=Math.min(1-travel,dt*roadRate);
    travel+=step;odometer+=step;
  }
  function active(){return !!api}
  function token(view){return [view.stage,view.leg,view.marker,view.options[0]?.revision].join("/")}
  function sceneKey(){return v.leg===0?"escort-road":"escort-road-"+(v.leg+1)}
  function reveal(message,good){
    if(!message)return;feedback.textContent=message;feedback.hidden=false;effect=2.8;effectKind=good?"safe":"impact";
    feedback.dataset.kind=effectKind;
  }
  function direction(id){return id==="left"?-1:id==="right"?1:0}
  function choose(op){
    if(!api||document.hidden||FieldJournal.active||op.disabled)return;
    if(v.stage==="road"){
      if(op.id==="brace"){bracing=true}
      else if(op.id==="left"||op.id==="right"){wheel=op.id;bracing=false;targetLane=direction(wheel)}
      else return;
      syncChoice();return;
    }
    if(op.id==="return"){
      if(api.apply(op))close();return;
    }
    if(!api.apply(op))return;
    if(op.id==="start")CutVoice.play("market");
    else if(op.id!=="continue")CutVoice.play(op.id==="deliver"?"stamp":"paper");
    render(true);wake();
  }
  function settleRoad(){
    if(!api||v.stage!=="road")return;
    const picked=bracing?"brace":wheel,op=v.options.find(a=>a.id===picked),good=picked===v.cue,old=v;
    if(!op||!api.apply(op))return;
    const fresh=api.view();
    if(!fresh){close();return}
    const change=fresh.cargo.intact-old.cargo.intact,condition=fresh.condition-old.condition;
    const difference=(change?" · 完封 "+old.cargo.intact+" → "+fresh.cargo.intact:"")+
      (condition?" · 车况 "+old.condition+" → "+fresh.condition:"");
    const resultMessage=fresh.notice||((good?"货车平稳通过":"车队受阻")+difference);
    if(!good&&old.cargo.intact){CutVoice.play("reply");reveal(resultMessage,false)}
    else if(bracing&&good){CutVoice.play("scale");reveal("箱绳拉紧，封签完好。",true)}
    render(true);wake();
  }
  function laneText(id){return id==="left"?"左":"右"}
  function syncChoice(){
    const picked=bracing?"brace":wheel;
    root.dataset.selected=picked;root.dataset.track=wheel;root.dataset.waiting="false";root.dataset.danger=String(needsResponse());
    for(const b of actions.querySelectorAll("button[data-escort-action]")){
      const id=b.dataset.escortAction;
      b.setAttribute("aria-pressed",String(id===picked));
      b.querySelector("strong").textContent=id==="brace"?(bracing?"已护住车厢":"护住车厢"):(wheel===id?"沿":"换")+laneText(id)+"辙";
    }
    let text;
    if(!v.cargo.intact)text="车上已无托箱，私货仍在行囊。自动快行。";
    else if(v.cue==="brace")text=bracing?"已护住车厢，自动快行。":"已放慢。前方横索，点车尾或「护住车厢」。";
    else if(picked===v.cue)text="当前"+laneText(wheel)+"辙可安全通过，自动快行。";
    else text="已放慢。当前"+laneText(wheel)+"辙会松一层封签，可换"+laneText(v.cue)+"辙。";
    if(notice.textContent!==text)notice.textContent=text;
  }
  function renderRoadChoices(){
    title.textContent=v.title;caption.textContent=v.cue==="brace"?"横索 · 货封":"前方路况";
    desc.textContent=v.description;
    actions.replaceChildren(...v.options.filter(o=>o.id!=="brace"||v.cue==="brace").map(optionButton));
    syncChoice();
  }
  function showTurnoff(){
    marketSign.hidden=false;marketSign.style.left=wheel==="left"?"72%":"24%";marketSign.textContent=v.station;marketSign.setAttribute("aria-label","拐入"+v.station);
    const turn=button("拐入"+v.station,"escort-action");
    turn.dataset.escort="enter-market";
    turn.onclick=()=>{
      if(!api||!enteringTurnoff||FieldJournal.active||document.hidden)return;
      enteringTurnoff=false;turnoffProgress=0;CutVoice.play("market");render();
    };
    const next=v.options.find(o=>o.id==="continue"),pass=optionButton(next);
    pass.querySelector("strong").textContent="沿正路驶过";
    pass.setAttribute("aria-label","沿正路驶过，跳过本驿买卖");pass.querySelector("small")?.remove();
    caption.textContent="前方驿市";title.textContent=v.station;desc.textContent=v.turnoff;
    notice.textContent="沿本辙将驶过驿口，入市可停车慢慢挑。";
    summary.replaceChildren();actions.replaceChildren(turn,pass);
  }
  function money(n){return n>0?"+"+n:String(n)}
  function receiptRows(r){
    const estimate=v.stage==="delivery";
    const fields=[[estimate?"应收脚程":"实收脚程",estimate?r.expectedFee:r.roadFee],
      [estimate?"应收箱钱":"实收箱钱",estimate?r.expectedCargo:r.cargoPay],
      ["进货",-(r.buyCost||0)],["卖货",r.saleIncome],["沿途采买货利",r.tradeProfit],...(r.openingGoodsIncome?[["自带货售入",r.openingGoodsIncome]]:[]),["修理",-(r.serviceCost||0)],
      [estimate?"交割后净收":"净收",estimate?r.netCash+r.expectedFee+r.expectedCargo:r.netCash]];
    for(const [label,value] of fields){const cell=el("div","escort-entry");cell.append(el("span","",label),el("b","",money(value??0)+" 石"));summary.append(cell)}
  }
  function optionButton(op){
    const b=button("","escort-action");b.dataset.escortAction=op.id;b.disabled=!!op.disabled;
    const item=op.typeId||({"branch-ash":"ash","branch-shell":"ink-shell","branch-sale":"ash"})[op.id];
    if(item){
      const sprite=TowerSprites.get("merch-"+item);
      if(sprite){const sample=el("img","escort-ware");sample.src=sprite.src;sample.alt="";b.append(sample)}
    }
    b.append(el("strong","",op.label));if(v.stage!=="road"&&op.detail)b.append(el("small","",op.disabled?op.reason:op.detail));
    b.setAttribute("aria-label",[op.label,op.disabled?op.reason:op.detail].filter(Boolean).join("，"));
    const captured=viewToken;
    b.onclick=()=>{if(api&&captured===viewToken)choose(op)};
    return b;
  }
  function render(changed=false){
    const prior=v;v=api?.view();
    if(!v){close();return}
    const next=token(v),transition=next!==viewToken;
    if(changed||transition){
      if(v.stage==="station"&&prior?.stage==="road"&&!prior.branchRoad){enteringTurnoff=true;turnoffProgress=0}
      else if(v.stage!=="station"){enteringTurnoff=false;turnoffProgress=0}
      travel=0;bracing=false;previous=0;viewToken=next;
    }
    if(enteringTurnoff){
      feedback.hidden=true;effect=0;root.dataset.stage="turnoff";root.dataset.fork="market";root.dataset.waiting="false";root.dataset.selected=wheel;
      root.dataset.cue="";root.dataset.marker=String(v.marker);root.dataset.completed=String(v.completedWaypoints);
      root.classList.add("escort-moving");trail.hidden=false;pace.hidden=true;
      place.textContent=v.road;mile.textContent="第 "+(v.leg+1)+" 程 · 驿口";
      crates.textContent=v.cargo.intact+" / "+v.cargo.max;rig.textContent=v.condition+" / 6";
      showTurnoff();updateTrail();paint();return;
    }
    marketSign.hidden=true;root.dataset.driving="continuous";root.dataset.fork=v.stage==="road"?"risk":"";pace.hidden=false;
    root.dataset.stage=v.stage;root.dataset.leg=String(v.leg);root.dataset.marker=String(v.marker);
    root.dataset.branchRoad=String(v.branchRoad);root.dataset.cue=v.cue||"";root.dataset.completed=String(v.completedWaypoints||0);
    const road=v.stage==="road";root.classList.toggle("escort-moving",road);
    trail.hidden=!road;pack.disabled=false;place.textContent=v.road||"狐灯镖局";
    if(v.stage==="offer")place.textContent="狐柜发镖";
    if(v.branchRoad||v.stage==="branchMarket")place.textContent=v.branchName;
    silver.textContent=v.cash;crates.textContent=v.stage==="offer"?"待领":v.cargo.intact+" / "+v.cargo.max;rig.textContent=v.stage==="offer"?"待领":v.condition+" / 6";
    crates.previousElementSibling.textContent=v.stage==="done"?(v.receipt.returned?"退回":"实交"):"在车";
    if(v.stage==="done"){
      crates.textContent=v.receipt.returned?"退契":v.receipt.remaining+" / 3";
      rig.textContent="已卸";
    }
    caption.textContent=road?"前路应对":v.stage==="offer"?"狐灯镖契":v.stage==="branchMarket"?"支道小市":v.stage==="station"?"沿路停靠":v.stage==="delivery"?"终点交验":"脚程清账";
    title.textContent=v.title;desc.textContent=v.description||"";notice.textContent=road?"":v.notice||"";
    if(v.hint&&!desc.textContent.includes(v.hint))desc.textContent+="　"+v.hint;
    summary.replaceChildren();actions.replaceChildren();
    if(v.stage==="delivery"||v.stage==="done")receiptRows(v.receipt||{});
    else if(!road){
      const mark=el("div","escort-manifest");
      mark.textContent="随身商货　灯灰 "+v.cargo.ash+" 份　墨蠹壳 "+v.cargo.shell+" 件";
      summary.append(mark);
      if(v.stage==="offer"){
        const rigging=el("div","escort-manifest");rigging.textContent="车尾挂三箱，上方包袱是行装。沿辙自动快行，遇险会放慢。换到安全侧，遇横索点车尾，见驿牌可拐市。";summary.append(rigging);
      }
      if(v.stage==="station"){
        const seals=el("div","escort-manifest");
        seals.textContent=v.cargo.crates.map((crate,i)=>"箱"+(i+1)+" "+["已空","松封","封牢"][crate.hp]).join("　");summary.append(seals);
      }
    }
    actions.append(...v.options.map(optionButton));
    if(v.stage==="offer"){
      const back=button("合契，回货摊","escort-action escort-back");back.dataset.escort="back";back.onclick=close;actions.append(back);
    }
    if(road){renderRoadChoices();mile.textContent=v.branchRoad?"第 "+(v.leg+1)+" 程 · 支道":"第 "+(v.leg+1)+" 程 · 路标 "+(v.marker+1)+"/6";syncChoice()}
    paint();updateTrail();
  }
  function updateTrail(){
    if(enteringTurnoff){
      fill.style.transform="scaleX("+turnoffProgress+")";
      live.textContent="距岔口 "+Math.max(0,Math.ceil((1-turnoffProgress)*45))+" 丈";return;
    }
    if(v.stage!=="road")return;
    fill.style.transform="scaleX("+(v.branchRoad?travel:(v.marker+travel)/6)+")";
    const km=(v.completedWaypoints+travel)*.38;
    live.textContent=km.toFixed(1)+" 里";
  }
  pace.onclick=()=>{
    if(!api||v.stage!=="road")return;
    fast=!fast;pace.textContent=fast?"收缰":"催马";
    pace.setAttribute("aria-pressed",String(fast));root.dataset.pace=fast?"quick":"normal";
    CutVoice.play("paper");wake();
  };
  pack.onclick=()=>{if(api){previous=0;api.pack()}};
  canvas.addEventListener("pointerdown",e=>{
    if(!api||v.stage!=="road"||!e.isPrimary||FieldJournal.active)return;
    swipe={id:e.pointerId,x:e.clientX,y:e.clientY,token:viewToken};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup",e=>{
    if(!swipe||swipe.id!==e.pointerId)return;
    const start=swipe;swipe=null;
    if(start.token!==viewToken||v?.stage!=="road")return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dy)>50&&Math.abs(dx)<Math.abs(dy))return;
    const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
    const y=(e.clientY-r.top)/r.height;
    const onCargo=cartHit && x>=cartHit.left&&x<=cartHit.right&&y>=cartHit.top&&y<=cartHit.bottom;
    let id;
    if(Math.abs(dx)>25)id=dx<0?"left":"right";
    else if(onCargo){if(v.cue!=="brace")return;id="brace"}
    else{
      const depth=(y-roadHorizon)/(1-roadHorizon);
      if(depth<=.06||depth>1)return;
      const rut=(.012+.53*depth**(1.22/1.65))*.64;
      if(Math.abs(Math.abs(x-.5)-rut)>Math.max(.024,rut*.46))return;
      id=x<.5?"left":"right";
    }
    const op=v.options.find(o=>o.id===id);if(op)choose(op);
  });
  canvas.addEventListener("pointercancel",()=>{swipe=null});
  window.addEventListener("keydown",e=>{
    if(!api||FieldJournal.active||document.hidden||e.repeat||v.stage!=="road"||e.altKey||e.ctrlKey||e.metaKey)return;
    const id={ArrowLeft:"left",ArrowRight:"right",ArrowDown:"brace"}[e.key];
    if(id){e.preventDefault();const op=v.options.find(o=>o.id===id);if(op&&(id!=="brace"||v.cue==="brace"))choose(op)}
  });
  document.getElementById("profile").addEventListener("close",()=>{
    if(api){previous=0;render();wake()}
  });
  document.addEventListener("visibilitychange",()=>{previous=0;if(!document.hidden)wake()});
  function close(){
    if(!api)return;
    const finish=api.returnToCounter;api=null;v=null;root.hidden=true;delete game.dataset.escorting;
    cancelAnimationFrame(frame);frame=0;previous=0;viewToken="";swipe=null;
    finish();const entry=document.querySelector("#market-escort");
    (entry&&!entry.hidden?entry:document.querySelector("#primary"))?.focus({preventScroll:true});
  }
  function open(controller){
    if(api||!controller.view())return;
    api=controller;game.dataset.escorting="true";root.hidden=false;feedback.hidden=true;
    wheel="right";lane=direction(wheel);targetLane=lane;bracing=false;enteringTurnoff=false;odometer=0;roadRate=0;fast=false;effect=0;previous=0;root.dataset.pace="normal";
    pace.textContent="催马";pace.setAttribute("aria-pressed","false");render(true);wake();
    actions.querySelector("button")?.focus({preventScroll:true});
  }
  function tick(time){
    frame=0;if(!api||document.hidden)return;
    const dt=previous&&!FieldJournal.active?Math.min(.16,(time-previous)/1000):0;
    previous=FieldJournal.active?0:time;
    if(!FieldJournal.active&&enteringTurnoff){
      turnoffProgress=Math.min(1,turnoffProgress+dt/marketApproachSeconds);odometer+=dt*.12;updateTrail();
      if(turnoffProgress>=1){const next=v.options.find(o=>o.id==="continue");if(next)choose(next)}
    }else if(!FieldJournal.active&&v.stage==="road"){
      advanceRoad(dt);
      lane+=(targetLane-lane)*Math.min(1,dt*5);
      if(travel>=1)settleRoad();
      if(api&&v.stage==="road")updateTrail();
    }
    if(effect>0){effect=Math.max(0,effect-dt);if(!effect)feedback.hidden=true}
    if(!FieldJournal.active&&api)paint();
    if(api)wake();
  }
  function wake(){if(api&&!frame&&!document.hidden)frame=requestAnimationFrame(tick)}
  const ctx=canvas.getContext("2d",{alpha:false});
  const paints=[
    {sky:"#344c58",soil:"#51483e",mist:"#8fa9a3",edge:"#9db0a3",dark:"#273a39",flag:"#a75a44"},
    {sky:"#534745",soil:"#684637",mist:"#b8997d",edge:"#b68859",dark:"#483328",flag:"#c68a49"},
    {sky:"#3a4c51",soil:"#464d49",mist:"#bac4b6",edge:"#b9bda6",dark:"#2d393a",flag:"#738c7a"},
    {sky:"#393f4c",soil:"#55473c",mist:"#9c9a95",edge:"#b4a585",dark:"#3d3435",flag:"#c46642"}
  ];
  function polygon(points,color){
    ctx.beginPath();for(const [i,p] of points.entries())i?ctx.lineTo(...p):ctx.moveTo(...p);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  function stroke(points,color,width){
    ctx.beginPath();for(const [i,p] of points.entries())i?ctx.lineTo(...p):ctx.moveTo(...p);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  const horizons=[.49,.50,.50,.52];
  function cover(im,w,h,vanishing){
    const k=Math.max(w/im.naturalWidth,h/im.naturalHeight),sw=im.naturalWidth*k,sh=im.naturalHeight*k;
    const dx=(w-sw)/2,dy=(h-sh)*vanishing;
    ctx.drawImage(im,dx,dy,sw,sh);
    return dy+sh*vanishing;
  }
  const terrainArt=["obstacle-water","obstacle-rock","obstacle-plank","obstacle-ruin"];
  function roughTerrain(x,y,size,leg){
    const im=TowerSprites.get(terrainArt[leg]);
    if(!im)return;
    const width=(leg===1?96:106)*size,height=width*im.height/im.width;
    ctx.drawImage(im,x-width/2,y-height*.75,width,height);
  }
  function roadSign(x,y,size,answer){
    const im=TowerSprites.get(answer==="brace"?"sign-brace":"sign-turn");
    if(!im)return;
    const height=72*size,width=height*im.width/im.height;
    ctx.save();ctx.translate(x,y);
    if(answer==="left")ctx.scale(-1,1);
    ctx.drawImage(im,-width*.43,-height,width,height);
    ctx.restore();
  }
  function rearCargo(x,y,w,h,crates){
    // Place the three contract boxes across the tailboard. The packed luggage above it belongs to the driver.
    ctx.save();ctx.translate(x,y);ctx.scale(w/250,h/365);
    for(let i=0;i<3;i++){
      const left=65+i*42,top=253+(i===1?1:0),hp=crates[i]?.hp||0;
      ctx.fillStyle="#34241d";ctx.fillRect(left,top+26,40,6);
      ctx.fillStyle="#a87a46";ctx.fillRect(left+1,top+25,38,2);
      if(!hp){
        stroke([[left+8,top+27],[left+10,top+22],[left+28,top+22],[left+30,top+27]],"#987143",2);
        continue;
      }
      const end=left+37;
      polygon([[left,top+3],[left+5,top-1],[end-2,top-1],[end+2,top+4],[end,top+26],[left,top+26]],"#382c22");
      polygon([[left+2,top+5],[left+6,top+1],[end-4,top+1],[end-1,top+5]],"#bd945b");
      polygon([[left+2,top+6],[end-2,top+6],[end-3,top+23],[left+2,top+24]],"#916b43");
      polygon([[end-3,top+7],[end+1,top+4],[end-1,top+24],[end-4,top+25]],"#5b4430");
      for(const row of [11,17,21])stroke([[left+3,top+row],[end-4,top+row-1]],"#775437",1);
      for(const offset of [7,27]){
        const a=left+offset;
        stroke([[a+2,top],[a,top+5],[a+(hp===1&&offset===27?5:0),top+24]],"#583a27",3.6);
        stroke([[a+2,top],[a,top+5],[a+(hp===1&&offset===27?5:0),top+24]],"#d0aa6d",2);
      }
      if(hp===2){
        polygon([[left+15,top+9],[left+22,top+9],[left+21,top+19],[left+18,top+17],[left+15,top+19]],"#963e30");
        stroke([[left+16,top+11],[left+20,top+11]],"#e4b66f",1.3);
      }else{
        stroke([[left+14,top+3],[left+19,top+10],[left+16,top+15],[left+21,top+20]],"#452d24",2);
        stroke([[left+20,top+12],[left+26,top+18],[left+33,top+16]],"#d0a568",1.7);
      }
    }
    ctx.restore();
  }
  // Motion is confined to the actual stone path. The verge, pillars and horizon
  // stay in the original painting, so scenery can still occlude the moving ground.
  const movingGround=document.createElement("canvas"),groundMask=document.createElement("canvas");
  let groundKey="",groundDistance=-1;
  function pavement(scene,w,h,horizon){
    if(!scene||reduced.matches)return;
    const k=Math.max(w/scene.naturalWidth,h/scene.naturalHeight);
    const sw=scene.naturalWidth*k,sh=scene.naturalHeight*k,dx=(w-sw)/2;
    const vanishing=horizons[v.leg],dy=(h-sh)*vanishing;
    const key=[w,h,v.leg].join("/");
    if(key!==groundKey){
      groundKey=key;groundDistance=-1;
      for(const layer of [movingGround,groundMask]){layer.width=w;layer.height=h}
      const mask=groundMask.getContext("2d");
      for(let y=Math.ceil(horizon);y<h;y+=3){
        const depth=(y-horizon)/(sh*(1-vanishing)),span=sw*(.008+.30*depth);
        const blend=mask.createLinearGradient(w/2-span,0,w/2+span,0);
        blend.addColorStop(0,"transparent");blend.addColorStop(.21,"black");
        blend.addColorStop(.79,"black");blend.addColorStop(1,"transparent");
        mask.fillStyle=blend;mask.globalAlpha=.80*Math.min(1,depth*1.6);mask.fillRect(0,y,w,3);
      }
    }
    if(groundDistance!==odometer){
      const surface=movingGround.getContext("2d");
      surface.clearRect(0,0,w,h);surface.imageSmoothingEnabled=false;
      const phase=(odometer*1.17)%1;
      function project(t,alpha){
        const zoom=1+.25*t;
        surface.globalAlpha=alpha;
        surface.drawImage(scene,w/2+(dx-w/2)*zoom,horizon+(dy-horizon)*zoom,sw*zoom,sh*zoom);
      }
      project(phase,1);
      project((phase+.5)%1,Math.cos(Math.PI*phase)**2);
      surface.globalAlpha=1;surface.globalCompositeOperation="destination-in";
      surface.drawImage(groundMask,0,0);
      surface.globalCompositeOperation="source-over";groundDistance=odometer;
    }
    ctx.drawImage(movingGround,0,0);
  }
  function paint(){
    if(!v||root.hidden)return;
    const w=Math.round(Math.min(950,Math.max(304,stage.clientWidth))),h=Math.max(130,Math.round(stage.clientHeight*w/Math.max(1,stage.clientWidth)));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    const leg=clamp(v.leg,0,3),palette=paints[leg],scene=TowerSprites.get(sceneKey())||TowerSprites.get("escort-road");
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle=palette.sky;ctx.fillRect(0,0,w,h);
    const horizon=scene?cover(scene,w,h,horizons[leg]):h*horizons[leg];
    if(!scene){
      polygon([[0,h*.65],[w*.22,h*.25],[w*.41,h*.48],[w*.62,h*.19],[w,h*.53],[w,h],[0,h]],palette.dark);
      polygon([[w*.5,horizon],[w,h],[0,h]],palette.soil);
    }
    roadHorizon=horizon/h;
    const mid=w*.5;
    const ground=z=>horizon+(h-horizon)*z**1.65,spread=z=>w*(.012+.53*z**1.22);
    const moving=v.stage==="road"||enteringTurnoff,stationary=!moving;
    if(moving)pavement(scene,w,h,horizon);
    if(v.stage==="road"){
      const phase=odometer;
      ctx.save();
      for(let i=0;i<13;i++){
        const z=((i/13+phase*.64)%1),y=ground(z),s=spread(z);
        ctx.globalAlpha=.14+.21*z;
        for(const side of [-1,1])stroke([[mid+side*.64*s,y],[mid+side*.64*(s+Math.max(1,z*w*.017)),y+Math.max(1,z*h*.024)]],palette.edge,Math.max(1,z*2.2));
      }
      ctx.restore();
      const z=.15+.61*clamp(travel);
      const recommended=v.cue,side=recommended==="left"?1:recommended==="right"?-1:0;
      const y=ground(z),size=clamp(w/640,.63,1.5)*(.23+1.3*z);
      const narrowBridge=w>h*1.35&&(leg===0||leg===2);
      const hazardSize=narrowBridge?size*.74:size;
      const bridgeHalfWidth=depth=>w*(.012+.30*depth**1.65);
      const roadHalfWidth=bridgeHalfWidth(z);
      const lateral=narrowBridge?Math.min(spread(z)*.62,Math.max(0,roadHalfWidth-55*hazardSize)):spread(z)*.62;
      roughTerrain(mid+lateral*side,y,hazardSize,leg);
      if(v.cue==="brace"){
        const cx=mid,span=narrowBridge?Math.max(6,roadHalfWidth-size*4):spread(z)*1.12;
        for(const side of [-1,1]){
          const foot=cx+side*span;
          const post=TowerSprites.get("barrier-post");
          if(post){
            const height=50*size,width=height*post.width/post.height;
            ctx.drawImage(post,foot-width/2,y-height,width,height);
          }
        }
        stroke([[cx-span,y-size*37],[cx-span*.4,y-size*31],[cx+span*.5,y-size*31],[cx+span,y-size*37]],"#c7a36a",Math.max(1,size*2));
      }
      // Two advance signs keep the cue visible from either track; brace signs stand nearer than the rope posts.
      const signZ=recommended==="brace"?Math.min(.95,z+.15):z;
      const signWidth=size*47;
      const shoulder=narrowBridge?Math.max(6,bridgeHalfWidth(signZ)-signWidth*.16):
        Math.min(mid-signWidth*.62,Math.max(spread(signZ)*1.15,w*(.11+.16*signZ)));
      for(const side of [-1,1])roadSign(mid+side*shoulder,ground(signZ)+2,size*.91,recommended);
    }
    const art=TowerSprites.get("escort-cart"),cartW=Math.min(w*(w<h*1.2?.56:.36),h*.80);
    const x=mid+lane*w*.19,bob=moving&&!reduced.matches?Math.sin(odometer*36)*h*.0035:0,y=h*(stationary?.98:.96)+bob;
    ctx.save();ctx.globalAlpha=.46;ctx.fillStyle="#171f22";ctx.beginPath();ctx.ellipse(x,y-3,cartW*.43,cartW*.081,0,0,Math.PI*2);ctx.fill();ctx.restore();
    if(art){
      const ah=cartW*art.naturalHeight/art.naturalWidth,actualH=Math.min(ah,h*.66),aw=actualH*art.naturalWidth/art.naturalHeight;
      const left=Math.round(x-aw*.5),top=Math.round(y-actualH),width=Math.round(aw),height=Math.round(actualH);
      cartHit={left:(left+.04*width)/w,right:(left+.96*width)/w,top:(top+.43*height)/h,bottom:(top+.96*height)/h};
      ctx.drawImage(art,left,top,width,height);
      rearCargo(left,top,width,height,v.stage==="offer"||v.stage==="done"?[]:v.cargo.crates);
    }else{
      const u=cartW/112;
      ctx.save();ctx.translate(x,y);ctx.scale(u,u);
      polygon([[-36,-8],[-40,-47],[-33,-66],[31,-65],[41,-46],[36,-8]],"#482e25");
      polygon([[-36,-44],[-27,-70],[25,-70],[36,-43]],"#8b5942");
      ctx.fillStyle="#be9361";ctx.fillRect(-36,-42,73,4);ctx.fillRect(-29,-21,58,3);
      ctx.fillStyle="#282522";ctx.fillRect(-40,-32,5,31);ctx.fillRect(36,-32,5,31);ctx.restore();
    }
    if(effect>1.9&&effectKind==="impact"&&!reduced.matches){
      ctx.fillStyle="rgba(143,68,28,"+(.09*(effect-1.9)) +")";ctx.fillRect(0,0,w,h);
    }
    if(!moving){
      const grad=ctx.createLinearGradient(0,h*.66,0,h);grad.addColorStop(0,"transparent");grad.addColorStop(1,"#15201c7a");ctx.fillStyle=grad;ctx.fillRect(0,h*.66,w,h*.34);
    }
  }
  new ResizeObserver(()=>{if(api)paint()}).observe(stage);
  return {open,close,get active(){return active()}};
})();
