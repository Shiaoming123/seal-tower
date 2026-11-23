(async () => {
  "use strict";
  const play=new URLSearchParams(location.search).get("play");
  if(play==="hunt"||play==="crawl"){await HuntUI.open(play==="crawl");return}
  const $=id=>document.getElementById(id);
  const game=$("game"),world=$("world"),hud=$("hud"),target=$("target");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  try{await Promise.all([TowerSprites.ready,TowerFonts.ready])}
  catch{const message=$("loading");message.textContent="画卷载入失败，点此重试";const retry=document.createElement("button");retry.textContent="重新载入";retry.onclick=()=>location.reload();message.append(retry);return}
  $("loading").hidden=true;
  let fightView;
  const fixedSeed=new URLSearchParams(location.search).get("seed")?.trim().slice(0,64);
  let seed=fixedSeed||"1";
  function followingSeed(s){
    if(fixedSeed)return fixedSeed;
    const hot=Tower.view(s).market.hot,start=Number(s.seed)||1;
    for(let i=1;i<=64;i++){
      const candidate=String(start+i);
      if(Tower.view(Tower.start(candidate,{marketTrial:true})).market.hot!==hot)return candidate;
    }
    return String(start+1);
  }
  const fresh=()=>Tower.act(Tower.start(seed,{marketTrial:true}),"sword");
  const bootOrder=await MarketOrder.claim();
  const huntEntry=$("hunt-entry"),huntUrl=new URL(location.href);huntUrl.searchParams.set("play","crawl");huntEntry.href=huntUrl.href;
  let state=bootOrder?Tower.act(Tower.redeemOrder(bootOrder,seed),"sword"):fresh(), shownHp=state.hp,shownFoe=state.foeHp;
  fightView=Tower.view(state);
  let swing=null,hold=null,hover=false,layout,raf=0,lastPaint=-1000;
  let elapsed=0,lastTick=0;
  const open=360,close=1100,duration=735;
  let marketPending=false,feedbackTimer,inputEpoch=0;
  function clearFeedback(){clearTimeout(feedbackTimer);$("item-feedback").hidden=true}
  function showItemFeedback(after){
    const {lastHeal,lastPrevented}=after.trial;
    const notes=[];
    if(after.trial.sweptAsh&&!state.trial.sweptAsh)notes.push("挡住蛾翅 · 可多拾 1 份灯灰");
    if(after.trial.cleanClasp&&!state.trial.cleanClasp)notes.push("狐扣完整 · 卖价 3 → 5 石");
    if(after.trial.lastAbacusDamage)notes.push("算盘首击 · 添 "+after.trial.lastAbacusDamage+" 伤");
    if(lastPrevented)notes.push("护心镜 · 抵 "+lastPrevented+" 伤");
    if(lastHeal)notes.push("续灯膏 · 回 "+lastHeal+" 血");
    if(after.trial.lastBloodDamage)notes.push("释珀 +"+after.trial.lastBloodDamage+" 伤"+(after.trial.lastDrainHeal?" · 回 "+after.trial.lastDrainHeal+" 血":""));
    if(!notes.length)return;
    const feedback=$("item-feedback");clearFeedback();feedback.textContent=notes.join("　");feedback.hidden=false;
    feedbackTimer=setTimeout(clearFeedback,1650);
  }
  function phase(){return window.EscortUI?.active?"escort":MarketPlay.stage|| (swing?"swing":state.phase==="fight"?"idle":state.phase==="lost"?"lost":"cleared")}
  function status(message){$("status").textContent=message}
  function sync(){
    huntEntry.hidden=Boolean(bootOrder||swing||state.turn||state.floor!==1||state.phase!=="fight"||state.foeHp!==9||MarketPlay.stage);
    game.dataset.phase=phase();game.dataset.seed=state.seed;game.dataset.combatKind=state.foeKind||"";game.dataset.hp=shownHp;game.dataset.foe=shownFoe;
    game.dataset.floor=state.floor;game.dataset.gold=state.gold;game.dataset.seals=state.seals.length;
    if(fightView.enemy){
      const label=fightView.enemy.name;
      target.setAttribute("aria-label","向"+label+"出剑，长按可合锋");
      world.setAttribute("aria-label","斩妖人迎战"+label);
    }
    target.disabled=!!swing||state.phase!=="fight";$("guard").disabled=target.disabled;$("strike").disabled=!!swing;
    $("strike").setAttribute("aria-label",state.phase!=="fight"?"再斩一场":"出剑");
  }
  function box(el,x,y,w,h){
    Object.assign(el.style,{left:Math.round(x)+"px",top:Math.round(y)+"px",width:Math.round(w)+"px",height:Math.round(h)+"px"});
  }
  function buttons(){
    for(const id of ["strike","sound","reset","guard"]){
      const r=layout.rects[id],k=layout.ratio,h=Math.max(r.h*k,44),w=Math.max(r.w*k,44);
      box($(id),(r.x+r.w/2)*k-w/2,(r.y+r.h/2)*k-h/2,w,h);
    }
  }
  function positionJournal(atMarket){
    const trigger=$("profile-open"), reset=$("reset"), sound=$("sound");
    const x=parseFloat(reset.style.left),y=parseFloat(reset.style.top);
    const k=layout.ratio,w=Math.max(44,Math.round(35*k)),h=Math.max(44,Math.round(29*k));
    const midY=y+parseFloat(reset.style.height)/2;
    // The battle intent slip occupies the left of the toggles on landscape.
    const beside=atMarket||layout.portrait;
    const left=beside?x-w-Math.round(4*k):parseFloat(sound.style.left)+(parseFloat(sound.style.width)-w)/2;
    box(trigger,left,beside?midY-h/2:midY+h/2+3,w,h);
    trigger.style.fontSize=Math.round(Math.max(14,12*k))+"px";
  }
  function resize(){layout=CutHud.layout(game,world,hud,state.foeKind==="ink-mite"?2:state.floor);buttons();lastPaint=-1000;wake()}
  function cancelHold(){hold=null;lastPaint=-1000;wake()}
  function reset(){
    window.EscortUI?.close();MarketOrder.cancel();clearFeedback();MarketPlay.clear();marketPending=false;
    state=fresh();fightView=Tower.view(state);swing=null;hold=null;shownHp=state.hp;shownFoe=state.foeHp;
    resize();sync();status("纸灯蛾有 9 血。点妖出剑；守势挡住蛾翅，多收一份灯灰。");lastPaint=-1000;wake();
  }
  function strike(focus,guard=false){
    if(FieldJournal.active||swing||state.phase!=="fight")return;
    const after=Tower.act(state,guard?"guard":focus?"focus-strike":"strike");if(after===state)return;
    swing={start:performance.now(),after,focus,guard,hit:state.foeHp-after.foeHp,hurt:after.trial.lastHit??Math.max(0,state.hp-after.hp),
      snapped:false,replied:false,whooshed:false,incoming:fightView.combat.now};
    sync();lastPaint=-1000;wake();
  }
  function press(source){
    if(FieldJournal.active||swing||hold||state.phase!=="fight")return false;
    CutVoice.unlock();
    hold={source,since:performance.now(),chimed:false};lastPaint=-1000;wake();return true;
  }
  function release(source){
    if(!hold||hold.source!==source)return;
    const age=performance.now()-hold.since;
    const focus=!state.focusSpent&&age>=open&&age<=close;
    hold=null;strike(focus);
  }
  function hitEnemy(e){
    const r=world.getBoundingClientRect();
    return CutScene.hitEnemy((e.clientX-r.left)*640/r.width,(e.clientY-r.top)*360/r.height);
  }
  // On touch Chrome can target a nearby button and synthesize a click at a *different* location.
  // Commit from the two original coordinates. Keep native zero-detail activation for assistive tech.
  function bindInput(control,{hit,activate,start=()=>true,cancel=()=>{}}){
    let pending=null;
    const context=()=>({state,layout,stage:MarketPlay.stage,revision:MarketPlay.revision,inputEpoch});
    const current=record=>!FieldJournal.active&&record&&record.inputEpoch===inputEpoch&&record.revision===MarketPlay.revision&&record.state===state&&record.layout===layout&&record.stage===MarketPlay.stage&&!control.hidden&&!control.disabled;
    const inside=e=>!FieldJournal.active&&document.elementFromPoint(e.clientX,e.clientY)===control&&(!hit||hit(e));
    function forget(){if(pending){pending=null;cancel()}}
    control.addEventListener("pointerdown",e=>{
      if(!e.isPrimary||e.button!==0)return;
      if(pending||!inside(e)||!start(e.pointerId)){e.preventDefault();return}
      pending={...context(),id:e.pointerId};control.setPointerCapture(e.pointerId);
    });
    control.addEventListener("pointerup",e=>{
      if(pending?.id!==e.pointerId)return;
      if(!current(pending)||!inside(e)){forget();return}
      pending=null;activate(e.pointerId,false);
    });
    for(const name of ["lostpointercapture","pointercancel"])control.addEventListener(name,e=>{if(pending?.id===e.pointerId)forget()});
    control.addEventListener("keydown",e=>{
      if(e.key!=="Enter"&&e.key!==" ")return;
      e.preventDefault();if(e.repeat||pending)return;
      pending={...context(),key:e.key};
    });
    control.addEventListener("keyup",e=>{
      if(pending?.key!==e.key)return;
      e.preventDefault();const valid=current(pending);pending=null;
      if(valid)activate(null,true);
    });
    control.addEventListener("blur",forget);
    window.addEventListener("blur",forget);
    control.addEventListener("click",e=>{
      if(!FieldJournal.active&&e.detail===0&&!e.pointerType&&!control.disabled&&!control.hidden)activate(null,true);
      else e.preventDefault();
    });
  }
  const swingInput=control=>bindInput(control,{
    hit:control===target?hitEnemy:null,
    start:id=>state.phase==="lost"&&control!==target||press(id),
    activate:(id,keyboard)=>{
      if(state.phase==="lost"&&control!==target){reset();return}
      if(keyboard){CutVoice.unlock();strike(false)}else release(id);
    },cancel:cancelHold
  });
  swingInput(target);swingInput($("strike"));
  target.addEventListener("pointermove",e=>{const on=hitEnemy(e);if(hover!==on){hover=on;wake()}});
  target.addEventListener("pointerleave",()=>{hover=false;wake()});
  function guard(){cancelHold();CutVoice.unlock();strike(false,true)}
  bindInput($("guard"),{activate:guard});
  bindInput($("reset"),{activate:reset});
  bindInput($("sound"),{activate:()=>{const on=CutVoice.toggle();$("sound").setAttribute("aria-label",on?"关闭声音":"打开声音");$("sound").setAttribute("aria-pressed",String(on));lastPaint=-1000;wake()}});
  function openJournal(){
    if(swing||FieldJournal.active)return;
    cancelHold();
    inputEpoch++;
    WeighGesture.cancel();
    FieldJournal.open(state,op=>{
      const next=Tower.arrange(state,op);
      if(next!==state){
        state=next;fightView=Tower.view(state);
        if(!window.EscortUI?.active)MarketPlay.refreshState(state);
        game.dataset.hp=state.hp;game.dataset.gold=state.gold;game.dataset.seals=state.seals.length;
        lastPaint=-1000;wake();
      }
      return state;
    });
  }
  bindInput($("profile-open"),{activate:openJournal});
  document.addEventListener("keydown",e=>{
    if(e.repeat||e.isComposing||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.code==="KeyI"){e.preventDefault();if(FieldJournal.active)FieldJournal.close();else openJournal();return}
    if(FieldJournal.active||window.EscortUI?.active)return;
    if(e.code==="KeyJ"){e.preventDefault();press("key")}
    if(e.code==="KeyK"){e.preventDefault();guard()}
    if(e.code==="KeyR"){e.preventDefault();reset()}
  });
  document.addEventListener("keyup",e=>{if(e.code==="KeyJ")release("key")});
  window.addEventListener("tower:open-bag",()=>{openJournal();if(FieldJournal.active)FieldJournal.showBag()});
  window.addEventListener("tower:escort",()=>{
    if(!window.EscortUI||FieldJournal.active||MarketPlay.stage!=="counter")return;
    cancelHold();inputEpoch++;
    EscortUI.open({
      view:()=>Tower.escortView(state),
      apply:op=>{
        const next=Tower.escortAct(state,op);if(next===state)return false;
        state=next;fightView=Tower.view(state);shownHp=state.hp;
        game.dataset.gold=state.gold;game.dataset.hp=state.hp;
        return true;
      },
      pack:openJournal,
      returnToCounter:()=>{
        inputEpoch++;MarketPlay.refreshState(state);game.dataset.phase=MarketPlay.stage;
        lastPaint=-1000;wake();
      }
    });
    if(EscortUI.active)game.dataset.phase="escort";
  });
  let redeeming=false;
  for(const id of MarketPlay.controls){
    bindInput($(id),{hit:e=>MarketPlay.hit(id,e),activate:async(_,keyboard)=>{
      if(redeeming)return;
      CutVoice.unlock();
      const prior=state,wasReceipt=MarketPlay.stage==="receipt",redeem=wasReceipt&&id==="secondary"&&Boolean(state.trial.order);
      let claim="";
      if(redeem){
        redeeming=true;
        try{claim=await MarketOrder.claim(true)}finally{redeeming=false}
        if(state!==prior||MarketPlay.stage!=="receipt")return;
      }
      let next=MarketPlay.act(id,state,performance.now(),reduced.matches,wasReceipt&&id==="secondary"?followingSeed(state):seed);
      if(!next){reset();return}
      if(wasReceipt&&next!==prior&&!redeem)MarketOrder.cancel();
      if(wasReceipt&&id==="secondary"&&next!==prior)seed=next.seed;
      if(redeem&&next!==prior&&!claim)next=fresh();
      if(next.phase==="won"&&prior.phase!=="won"){
        MarketOrder.recordSettlement(next);
        if(next.trial.order)MarketOrder.issue(next.trial.order);
      }
      state=next;
      if(!MarketPlay.active&&next.phase==="fight"){
        swing=null;hold=null;marketPending=false;hover=false;fightView=Tower.view(next);
        shownHp=next.hp;shownFoe=next.foeHp;resize();sync();
        status(fightView.title+"，妖力 "+shownFoe+"。"+fightView.intent);
        if(redeem&&claim)announceOrder(claim);
        if(keyboard)target.focus({preventScroll:true});
      }else{game.dataset.floor=state.floor;game.dataset.hp=state.hp}
      lastPaint=-1000;wake();
      if(keyboard&&$(id).hidden)$("primary").focus({preventScroll:true});
    }});
  }
  function animationP(ms){
    if(ms<=245)return ms/245*.43;
    if(ms<=310)return .43;
    return .43+(ms-310)/(duration-310)*.57;
  }
  function draw(time){
    if(FieldJournal.active||window.EscortUI?.active)return;
    $("profile-open").disabled=!!swing;
    if(MarketPlay.active){
      marketPending=MarketPlay.draw(layout,state,time,reduced.matches);
      positionJournal(true);
      return;
    }
    positionJournal(false);
    let p=-1,focus=false,guarding=false,hit=0,hurt=0,killed=state.phase==="reward";
    const ticking=swing;
    if(ticking){
      const age=Math.max(0,time-ticking.start);
      p=Math.min(1,animationP(age));
      ({focus,hit,hurt,guard:guarding}=ticking);killed=ticking.after.foeHp===0;
      if(!guarding&&p>=.22&&!ticking.whooshed){CutVoice.play("slash");ticking.whooshed=true}
      if(p>=.43&&!ticking.snapped){
        ticking.snapped=true;shownFoe=ticking.after.foeHp;p=.43;if(hit)CutVoice.play("hit",focus);
        if(ticking.after.trial.lastAbacusDamage){CutVoice.play("abacus",ticking.after.trial.lastAbacusDamage);showItemFeedback(ticking.after)}
        sync();
      }
      if(p>=.74&&!ticking.replied){ticking.replied=true;shownHp=ticking.after.hp;showItemFeedback(ticking.after);if(ticking.after.trial.lastPrevented||guarding&&fightView.combat.now>0)CutVoice.play("guard");else if(hurt)CutVoice.play("reply");sync()}
      if(age>=duration&&p>=1){
        state=ticking.after;fightView=Tower.view(state);swing=null;shownHp=state.hp;shownFoe=state.foeHp;p=-1;
        sync();status(state.log.at(-1));
        if(killed||state.phase==="lost"){
          clearFeedback();if(killed)CutVoice.play("sealed");MarketPlay.begin(state,time,reduced.matches);
          marketPending=MarketPlay.draw(layout,state,time,reduced.matches);
          if(document.activeElement===$("strike")||document.activeElement===target)$("primary").focus({preventScroll:true});
          return;
        }
      }
    }
    const held=hold?time-hold.since:0,ready=!!hold&&!state.focusSpent&&held>=open&&held<=close;
    if(ready&&!hold.chimed){CutVoice.play("ready");hold.chimed=true}
    const ageSec=swing?(time-swing.start)/1000:0;
    const hitStopped=swing&&p===.43;
    const sceneTime=hitStopped?(elapsed-ageSec+.245):elapsed;
    const stage=CutScene.draw(world,{weaponId:state.trial.weapon,foeKind:state.foeKind,floor:state.floor,compactGate:layout.portrait&&state.floor===2,sharpened:!!state.trial.gritActive,t:reduced.matches?0:sceneTime,p:reduced.matches&&p>=0?(p<.43?.20:p<.64?.43:.84):p,focus,hit,hurt,killed,cleared:phase()==="cleared",
      abacusHit:guarding?0:ticking?.after.trial.lastAbacusDamage||0,guard:guarding,incoming:ticking?.incoming||0,reduced:reduced.matches,charge:hold&&!state.focusSpent?Math.min(1,held/open):null,ready,hover,heavy:!!fightView.combat?.heavy});
    const {left,top,zoom}=layout.world;
    const rx=stage.target?.rx??114,ry=stage.target?.ry??81;
    const hitX=left+((stage.target?.x??stage.lamp.x)-rx)*zoom;
    const hitY=top+((stage.target?.y??stage.lamp.y-31)-ry)*zoom;
    const hitLeft=Math.max(0,hitX),hitTop=Math.max(0,hitY);
    box(target,hitLeft,hitTop,Math.min(game.clientWidth,hitX+2*rx*zoom)-hitLeft,
      Math.min(game.clientHeight,hitY+2*ry*zoom)-hitTop);
    CutHud.draw(hud,layout,{abacus:fightView.combat?.abacusBonus||0,blood:fightView.profile?.bloodBonus,charged:state.counter,grit:state.trial.gritActive,sweptAsh:state.trial.sweptAsh,cleanClasp:state.trial.cleanClasp,weaponName:fightView.profile?.weapon?.name||"照影剑",foeKind:state.foeKind,maxHp:state.maxHp??24,floor:state.floor,name:fightView.enemy?.name||"夜市狐",maxFoe:fightView.enemy?.maxHp||(state.floor===2?19:9),damage:fightView.combat?.swordDamage??6,carrying:state.seals.some(x=>x.id===1),foe:shownFoe,hp:shownHp,focusSpent:state.focusSpent,ready,holding:!!hold,
      sound:CutVoice.enabled,busy:!!swing,cleared:state.phase!=="fight",lost:state.phase==="lost",intent:fightView.intent.split(" → ")[0].replace("本手 ","").replace("（重击）","")});
  }
  function tick(time){
    raf=0;if(document.hidden)return;
    if(lastTick)elapsed+=Math.min(.1,(time-lastTick)/1000);
    lastTick=time;
    if(time-lastPaint>=(swing||hold||marketPending?15:32)||lastPaint<0){draw(time);lastPaint=time}
    if(!reduced.matches||swing||hold||marketPending)raf=requestAnimationFrame(tick);
  }
  function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(tick)}
  window.addEventListener("blur",cancelHold);
  document.addEventListener("visibilitychange",()=>{hold=null;lastTick=0;lastPaint=-1000;wake()});
  reduced.addEventListener("change",()=>{lastPaint=-1000;wake()});
  window.addEventListener("tower:repaint",()=>{lastPaint=-1000;wake()});
  function announceOrder(order){
    const name=order==="order-ash"?"上局订货已到 · 行囊内有 3 份灯灰":order==="order-hook"?"寄锋契已兑 · 饮棘钩在手":"开市本钱已兑 · 灵石 6";
    clearFeedback();const note=$("item-feedback");note.textContent=name;note.hidden=false;status(name);
    feedbackTimer=setTimeout(clearFeedback,2400);
  }
  new ResizeObserver(resize).observe(game);sync();resize();if(bootOrder)announceOrder(bootOrder);
})();
