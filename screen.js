(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const floors = ["照影廊", "狐灯市", "沉钟殿"];
  const floorLabels = ["第一层", "第二层", "第三层"];
  const shortcuts = {strike:"J", guard:"K", cast:"L"};
  const paths = {
    sword:"M4 20l4-4m-3-3 6 6m-3-5L18 4l3-1-1 4L10 17",
    disc:"M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M12 2v4m10 6h-4M12 22v-4M2 12h4",
    shield:"M12 3l8 3v6c0 5-5 8-8 10-3-2-8-5-8-10V6z M12 7v10",
    seal:"M4 16l3-7h10l3 7z M7 17v3h10v-3 M10 9V6a2 2 0 1 1 4 0v3",
    coin:"M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z M10 10h4v4h-4z",
    way:"M4 12h15m-6-6 6 6-6 6",
    potion:"M9 3h6m-5 1v5l-4 5c-3 4 0 7 3 7h6c3 0 6-3 3-7l-4-5V4 M7.5 15h9",
    sound:"M3 9h4l5-4v14l-5-4H3z M16 8q4 4 0 8m3-11q7 7 0 14",
    mute:"M3 9h4l5-4v14l-5-4H3z M16 9l5 6m0-6-5 6",
    pack:"M5 8h14l1 12H4z M9 8V6a3 3 0 0 1 6 0v2 M9 13h6",
    help:"M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M9.5 9a2.6 2.6 0 1 1 4 2.2Q12 12 12 14m0 3h.01"
  };
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    const path = document.createElementNS(svg.namespaceURI,"path");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("class","icon");
    svg.setAttribute("aria-hidden","true");
    path.setAttribute("d",paths[name] || paths.way);
    svg.append(path);
    return svg;
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const randomSeed = () => Math.floor(Math.random()*1e9);
  const requested = new URLSearchParams(location.search).get("seed");
  let state = Tower.start(requested && /^[0-9]{1,12}$/.test(requested) ? requested : randomSeed());
  let view = Tower.view(state), motion = null, queued = false;
  let frameId = 0, lastDraw = 0, feedbackTimer = 0;
  let target = {x:.69,y:.50,rx:.14,ry:.20};
  const canvas = el("plate");
  const hot = el("hotspot");

  function draw(time) {
    const progress = motion ? Math.min(1, Math.max(0,(time-motion.start)/motion.length)) : 1;
    const scene = motion ? motion.scene : view;
    const geometry = window.TowerArena?.draw(canvas,{
      floor:scene.floor,phase:scene.phase,action:motion?.id || "",progress,
      time:reduced.matches?0:time/1000, reduced:reduced.matches,
      heavy:!!scene.combat?.heavy, combat:scene.combat, intent:scene.intent, build:scene.build,
      enemyReplies:!!motion?.reply, echoTriggered:!!motion?.echo,
      hit:motion?.hit || 0,hurt:motion?.hurt || 0,
      focusStrike:!!motion?.focus,armed:state.armed,upgrades:state.upgrades,hasSeal:state.seals.length>0
    });
    if(geometry && Number.isFinite(geometry.x)) target=geometry;
    if(!hot.hidden) {
      hot.style.left=100*target.x+"%";
      hot.style.top=100*target.y+"%";
      hot.style.width=200*target.rx+"%";
      hot.style.height=200*target.ry+"%";
    }
  }
  function tick(time) {
    frameId=0;
    if(document.hidden || document.querySelector("dialog[open]"))return;
    const interval=motion ? 1000/60 : 1000/30;
    if(time-lastDraw>=interval-1){draw(time);lastDraw=time;}
    if(!reduced.matches || motion)frameId=requestAnimationFrame(tick);
  }
  function wake(){
    if(frameId)cancelAnimationFrame(frameId);
    lastDraw=-1000;frameId=requestAnimationFrame(tick);
  }

  function node(tag, text, className="") {
    const e=document.createElement(tag);e.textContent=text;
    if(className)e.className=className;
    return e;
  }
  function actionIcon(id) {
    if(id.startsWith("sell")) return "coin";
    if(id.startsWith("embed")||id==="take") return "seal";
    return ({strike:"sword",guard:"shield",cast:"disc",mirror:"disc"})[id] || id;
  }
  const firstNumber = text => text.match(/\d+/)?.[0] || "0";
  function makeChoice(a) {
    const button=document.createElement("button");
    button.type="button";button.dataset.action=a.id;button.disabled=!!a.disabled;
    button.className="choice";button.title=a.detail;
    button.setAttribute("aria-label",a.label+"，"+a.detail);
    let detail=a.detail;
    if(view.phase==="start")detail={sword:"剑伤 "+firstNumber(a.detail),disc:"预布截招",shield:"格挡 8"}[a.id];
    if(view.phase==="fight")detail=a.id==="strike"?firstNumber(a.detail)+" 剑伤":
      a.id==="guard"?"格挡 "+firstNumber(a.detail):"充能 "+state.charges;
    const text=document.createElement("span");
    text.append(node("strong",a.label),node("small",detail));
    button.append(icon(actionIcon(a.id)),text);
    if(shortcuts[a.id])button.append(node("kbd",shortcuts[a.id],"shortcut"));
    return button;
  }
  function feedback(text, duration=1250) {
    clearTimeout(feedbackTimer);
    el("beat").textContent=text;
    if(text)feedbackTimer=setTimeout(()=>{el("beat").textContent="";},duration);
  }
  function floatAt(id,text,x,y) {
    const e=el(id);
    e.classList.remove("show");
    e.textContent=text;
    e.style.left=Math.min(.9,Math.max(.1,x))*100+"%";
    e.style.top=Math.min(.83,Math.max(.12,y))*100+"%";
    void e.offsetWidth;
    e.classList.add("show");
    if(reduced.matches)setTimeout(()=>e.classList.remove("show"),450);
  }
  function render(keyboard=false) {
    view=Tower.view(state);
    document.body.dataset.phase=view.phase;
    const start=view.phase==="start", fight=view.phase==="fight";
    const i=view.floor-1;
    el("chapter").textContent=start?"入塔":floorLabels[i];
    el("room").textContent=floors[i];
    el("title").textContent=start?"斩妖塔":view.title;
    el("description").textContent=start?"取一件家传佩器，封住塔顶的负钟君。":view.description;
    el("enemy").hidden=!fight;
    el("intent").replaceChildren();
    if(fight){
      const [now,next]=view.intent.split(" → ");
      el("intent").append(node("span",now,"current"+(view.combat.heavy?" danger":"")),node("span",next,"future"));
      el("foe-meter").style.width=(100*view.enemy.hp/view.enemy.maxHp)+"%";
      el("foe-hp").textContent=view.enemy.hp+" / "+view.enemy.maxHp;
    }else if(!start)el("intent").textContent=view.phase==="lost"?view.log.at(-1):view.intent;
    el("equipped").textContent=view.bag[0].value.split(" · ")[0];
    el("hp").textContent="气血 "+view.stats[0].value;
    el("gold").textContent="灵石 "+state.gold;
    el("seals").textContent="妖印 "+state.seals.length;
    el("life").style.width=100*state.hp/24+"%";
    el("bag").replaceChildren(...[...view.stats,...view.bag].map(x=>node("p",x.label+"　"+x.value)));
    el("seed").textContent="塔签 "+view.seed;
    el("chronicle").replaceChildren(...view.log.map(line=>node("li",line)));
    el("action-prompt").textContent=start?"选择家传佩器":fight && state.turn===0?"点击妖物出剑":"";
    if(fight && view.combat.focusReady)el("action-prompt").textContent="点按出剑 · 长按妖物至环亮松手　+2";
    document.querySelectorAll(".steps li").forEach((e,n)=>{
      if(n===i)e.setAttribute("aria-current","step");else e.removeAttribute("aria-current");
    });
    const actions=["won","lost"].includes(view.phase)?[
      {id:"retry",label:"原签再试",detail:"换一件佩器，重走此塔"},
      {id:"new",label:"另抽塔签",detail:"新行情与新敌势"}
    ]:view.actions;
    el("actions").replaceChildren(...actions.map(makeChoice));
    if(fight && view.combat.focusReady && el("assist").checked){
      const accessible=node("button","合锋 +2","choice");accessible.dataset.action="focus-strike";
      el("actions").append(accessible);
    }
    canvas.setAttribute("aria-label",floors[i]+" · "+view.title+"。"+view.description);
    hot.hidden=!(fight || view.phase==="reward");
    hot.disabled=false;
    el("target-label").textContent=fight?"对"+view.title+"出剑":"拾取妖印";
    TowerSound.phase(view.phase);
    if(keyboard)el("actions").querySelector("button:not(:disabled)")?.focus({preventScroll:true});
    wake();
  }

let held=null;
  let readyTimer=0, expiryTimer=0, previousRelease=-1000;
  const focusOpens=360, focusCloses=1100;
  function clearHold(){
    clearTimeout(readyTimer);clearTimeout(expiryTimer);
    held=null;
    delete document.body.dataset.charge;
    el("charge-label").textContent="";
  }
  function startHold(source) {
    if(queued || held || view.phase!=="fight")return false;
    held={source,start:performance.now()};
    if(view.combat.focusReady) {
      document.body.dataset.charge="charging";
      el("charge-label").textContent="凝锋";
      readyTimer=setTimeout(()=>{
        document.body.dataset.charge="ready";
        el("charge-label").textContent="松手 · 合锋";
        TowerSound.effect("focus-ready");
      },focusOpens);
      expiryTimer=setTimeout(()=>{
        document.body.dataset.charge="spent";
        el("charge-label").textContent="松手 · 出剑";
      },focusCloses);
    }
    return true;
  }
  function finishHold(source) {
    if(!held || held.source!==source)return;
    const age=performance.now()-held.start;
    const focus=view.combat.focusReady && age>=focusOpens && age<=focusCloses;
    previousRelease=performance.now();
    clearHold();
    perform(focus?"focus-strike":"strike",source==="keyboard");
  }
  function perform(id,keyboard=false) {
    if(queued)return;
    const old=view;
    const next=["new","retry"].includes(id) && ["lost","won"].includes(old.phase)
      ? Tower.start(id==="retry"?old.seed:randomSeed()):Tower.act(state,id);
    if(next===state)return;
    clearHold();
    feedback("");
    queued=true;
    const combat=old.phase==="fight", focus=id==="focus-strike";
    const action=focus?"strike":id;
    const duration=reduced.matches?0:combat?610:old.phase==="shop"?180:105;
    const hit=combat?Math.max(0,state.foeHp-next.foeHp):0;
    const hurt=Math.max(0,state.hp-next.hp);
    const echo=combat && next.echoes>state.echoes;
    motion={id:action,start:performance.now(),length:Math.max(1,duration),scene:old,hit,hurt,echo,focus,
      reply:combat && old.combat.now>0 && next.foeHp>0 && !echo};
    el("actions").querySelectorAll("button").forEach(button=>button.disabled=true);
    hot.disabled=true;
    TowerSound.effect(action);
    if(combat) {
      setTimeout(()=>{
        if(hit>0){
          floatAt("hit","−"+hit,target.x,target.y-target.ry*.44);
          el("foe-meter").style.width=100*next.foeHp/old.enemy.maxHp+"%";
          el("foe-hp").textContent=next.foeHp+" / "+old.enemy.maxHp;
          TowerSound.effect(focus?"focus-hit":"hit");
        }
        if(focus)feedback("合锋　剑伤 +2");
        if(echo)feedback("回声截招　反击 6");
      },duration*.32);
      if(hurt>0 || action==="guard" && old.combat.now>0){
        setTimeout(()=>{
          floatAt("recoil",hurt?"−"+hurt:next.parries>state.parries?"反震":"格挡",.31,.56);
          TowerSound.effect(hurt?"hurt":"parry");
          el("life").style.width=100*next.hp/24+"%";
          el("hp").textContent="气血 "+next.hp+"/24";
        },duration*.64);
      }
    }else if(id.startsWith("embed")){
      const before=old.bag[0].value.split(" · ")[1];
      const after=Tower.view(next).bag[0].value.split(" · ")[1];
      feedback("嵌印　"+before+" → "+after);
    }else if(next.gold!==state.gold)feedback("灵石　"+state.gold+" → "+next.gold);
    else if(id==="take")feedback("妖印入囊");
    setTimeout(()=>{
      state=next;queued=false;motion=null;render(keyboard);
      if(view.phase==="won" || view.phase==="lost")TowerSound.effect(view.phase);
      el("announce").textContent=[view.log.at(-1),view.title,view.intent].join("。");
    },duration);
    wake();
  }
  hot.addEventListener("pointerdown",e=>{
    previousRelease=-1000;
    if(e.button!==0 || !e.isPrimary || !startHold(e.pointerId))return;
    hot.setPointerCapture(e.pointerId);
  });
  hot.addEventListener("pointerup",e=>finishHold(e.pointerId));
  hot.addEventListener("pointercancel",clearHold);
  hot.addEventListener("lostpointercapture",e=>{if(held?.source===e.pointerId)clearHold();});
  hot.addEventListener("contextmenu",e=>e.preventDefault());
  hot.addEventListener("click",e=>{
    if(e.detail && performance.now()-previousRelease<600)return;
    if(view.phase==="reward")perform("take",e.detail===0);
    else if(view.phase==="fight")perform("strike",e.detail===0);
  });
  el("actions").addEventListener("click",e=>{
    const b=e.target.closest("[data-action]");
    if(b && !b.disabled)perform(b.dataset.action,e.detail===0);
  });
  document.addEventListener("keydown",e=>{
    if(e.altKey || e.metaKey || e.ctrlKey || e.isComposing || view.phase!=="fight" ||
       document.querySelector("dialog[open]"))return;
    const key=e.key.toUpperCase();
    if(!["J","K","L"].includes(key))return;
    e.preventDefault();
    if(e.repeat)return;
    if(key==="J")startHold("keyboard");
    else perform(key==="K"?"guard":"cast",true);
  });
  document.addEventListener("keyup",e=>{
    if(e.key.toUpperCase()==="J" && held?.source==="keyboard"){
      e.preventDefault();finishHold("keyboard");
    }
  });
  [["help","guide","help"],["record","history","pack"]].forEach(([id,dialog,mark])=>{
    el(id).append(icon(mark));
    el(id).addEventListener("click",()=>{clearHold();el(dialog).showModal();});
    el(dialog).addEventListener("close",wake);
  });
  el("assist").addEventListener("change",()=>{if(!queued)render();});
  el("sound").append(icon("mute"));
  el("sound").addEventListener("click",async()=>{
    try{
      const on=await TowerSound.toggle();
      const label=on?"关闭声音":"打开声音";
      el("sound").setAttribute("aria-pressed",String(on));el("sound").setAttribute("aria-label",label);
      el("sound").title=label;el("sound").replaceChildren(icon(on?"sound":"mute"));
    }catch{feedback("该浏览器无法播放声音");}
  });
  window.addEventListener("blur",clearHold);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)clearHold();wake();});
  reduced.addEventListener("change",wake);
  window.addEventListener("tower-arena-ready",wake);
  new ResizeObserver(wake).observe(canvas);
  render();
})();

