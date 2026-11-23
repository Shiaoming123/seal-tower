/* One encounter and one physical decision at a time. Inventory always belongs to Tower.act. */
window.MarketPlay=(()=>{
  "use strict";
  const el=id=>document.getElementById(id);
  const art=el("market-art"),board=art.getContext("2d"),hud=el("hud"),game=el("game");
  const actions=["primary","secondary","market-third","market-fourth"];
  const lotIds=["grit","salve","mirror","fang","hook","ward-blade","knot","ink-shell","fox-clasp","order-purse","order-hook","abacus","silk","ash","lining","order-ash"];
  const slots=lotIds.map((lot,i)=>{
    const button=document.createElement("button");button.type="button";button.id="market-lot-"+i;
    button.className="hitbox";button.style.outline="none";button.hidden=true;button.dataset.lot=lot;
    game.insertBefore(button,el("primary"));return button.id;
  });
  const extra=["market-gear","market-cargo","market-quantity","market-stack","market-escort"];
  for(const id of extra){
    const b=document.createElement("button");b.id=id;b.type="button";b.className="hitbox";b.hidden=true;
    game.insertBefore(b,el("primary"));
  }
  const buttons=[...actions,"object",...slots,...extra];
  const ledgerTypes=new Set(["abacus","silk","ash","lining"]);
  let leaveLoot=false;
  let shelf="gear",quantity=1,selectedStack="";
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  let stage="",entered=0,marketStart=0,enabledAt=0,choice="",offer=null,atStall=null,lastSound=false,landed=0,purseBeforeSale=0;
  let lens={x:0,y:0,dx:0,dy:0},lastLayout=null,artBox=null,model=null;
  let hovered=-1,pressed=-1,pressPointer=null,frame=null,objectShape=null;
  let selectedLot="grit",tradeNote=null,counterNote="",revision=0,tablePaint=null,counterOrigin=null;
  const stageScene={drop:"drop",guide:"guide",rumor:"guide",stall:"shop",quote:"shop",result:"result",
    counter:"shop",crossroads:"side",wound:"wound",
    blood:"blood",bloodReceipt:"blood",sideFailed:"side",finalStall:"shop",finalQuote:"shop",finalSale:"result",receipt:"shop",failed:"shop"};
  const objects=new Set(["drop","guide","rumor","stall","finalStall"]);
  function counterPage(s){
    const v=Tower.view(s),stock=v.stock||[],late=s.floor===2;
    const goods=stock.filter(i=>ledgerTypes.has(i.id)),gear=stock.filter(i=>!ledgerTypes.has(i.id));
    if(!goods.length)shelf="gear";
    if(!gear.length)shelf="cargo";
    const lots=shelf==="cargo"?goods:gear;
    const index=Math.max(0,lots.findIndex(lot=>lot.id===selectedLot)),item=lots[index];
    selectedLot=item?.id||"";
    const gate=v.actions.find(a=>a.id==="gate"),settle=v.actions.find(a=>a.id==="settle");
    const side=v.actions.find(a=>a.id==="detour");
    const exit=late?settle&&{...settle,label:"合账离市"}:side&&{...side,id:"crossroads",label:v.side.done?"侧廊已闭":"去侧廊"};
    const escort=!late&&Tower.escortView?.(s)?.stage==="offer";
    const stacks=item?.sellStacks||[],stack=stacks.find(a=>a.instanceId===selectedStack)||stacks[0];
    selectedStack=stack?.instanceId||"";
    const pileGoods=item?.id==="silk"||item?.id==="ash";
    const maxQty=pileGoods?(stack?stack.qty:item.tradeKind==="buy"?Math.max(1,2-v.market.ledger.silkBought):1):1;
    quantity=clamp(quantity,1,maxQty);
    const order=item?Tower.quoteTrade(s,{id:item.actions[0].id,qty:quantity,instanceId:selectedStack||undefined}):null;
    const resolveExit=a=>a?.disabled&&s.trial.pending.length&&a.reason?.includes("行囊")?{id:"open-loot",label:"处理地上战利品",detail:"点这里收起或留下余货，再继续。"}:a;
    const commands=[order||item?.actions[0],item?.actions[1],resolveExit(exit),late?null:resolveExit(gate)].map(a=>a||null);
    const title=item?.name||"货摊";
    return {place:late?"狐灯末市":"绯绡狐柜",title,late,lots,index,item,commands,escort,cash:s.gold,shelf,order,invoice:!!item&&(ledgerTypes.has(item.id)||stacks.length>1),market:v.market,
      sheets:goods.length&&gear.length?["器物","商货"]:[],maxQty,quantity,stacks,stack,
      stackIndex:stack?stacks.indexOf(stack):0,
      equipNote:item?.slot==="主手"&&!item.owned?"换下"+v.profile.weapon.name+"，旧兵收入行囊":item?.tradeKind==="order"?"每行限寄一单，结账后可领单再入塔":"",
      lines:[item?.effect||"",...commands.filter(Boolean).map(a=>a.disabled?a.label+" · "+a.reason:a.detail)],
      keys:commands.map((a,i)=>i===0&&pileGoods&&order?(item.tradeKind==="sell"?"售 ":"购 ")+quantity+" 份　"+order.total+" 石":a?.label||""),disabled:commands.map(a=>!a||a.disabled),
      notice:counterNote,exitReason:commands.find((a,i)=>i>=2&&a?.disabled&&a.reason?.includes("行囊"))?.reason};
  }
  function bazaarPage(s){
    const v=Tower.view(s),p=v.profile;
    const sheet=(title,tag,lines,ledger,commands,place="绯绡狐柜")=>({
      place,title,tag,lines,ledger,commands,keys:commands.map(a=>a.label),disabled:commands.map(a=>a.disabled)
    });
    const go=(id,label)=>({id,label});
    const gate=go("gate","直闯狐关"),back=go("counter","回到狐柜");
    if(stage==="crossroads"){
      const [thorn,mite,haul]=v.side.actions;
      const offers=["血棘廊　花 "+v.side.toll+" 血，拾 "+v.side.coins+" 石。","墨蠹巢　打赢得 3 石和 1 枚壳。"];
      if(haul)offers.push("抢巢货　付 4 血再打，得 3 壳和 12 灰。");
      return sheet("侧廊选路","本局选一条",offers,"货装不下时，可以留下或整理。",
        haul?[thorn,mite,haul,back]:[thorn,mite,back],"狐灯侧廊");
    }
    if(stage==="wound"){
      return {...sheet(v.title,"棘钱",[v.actions[0].detail+"。"+v.intent+"。",v.actions[0].disabled?v.actions[0].reason:"绕开倒刺，可全身去见血客。"],
        "气血 "+s.hp+"/"+p.maxHp+"    钱囊 "+s.gold+" 石",v.actions,"血棘廊"),coins:v.side?.coins};
    }
    if(stage==="blood"){
      const [coins,slot,skip]=v.actions;
      const pending=p.bag.pending;
      if(pending.length){
        const first=pending[0];
        if(leaveLoot)return sheet("留下余货？","请确认",["将留下 "+pending.length+" 叠地面战利品。","行囊、身上装备和原印都会保留。"],"留下的物品无法取回。",
          [go("cancel-leave","继续整理"),go("confirm-leave","确认留下")],"血客灯下");
        return sheet("地上有余货","整理行囊",["地上还有 "+pending.length+" 叠，包括"+first.name+"。","点下面的按钮，可整理腾位，或留下装不下的物品。"],
          "处理完就能交易或回店。",[go("open-loot","处理地上战利品"),go("leave-loot","留下地上的货")],"血客灯下");
      }
      return {...sheet("和血客交易",s.trial.sideTaken==="detour-haul"||s.trial.sideTaken==="haul"?"抢收巢货":s.trial.sideTaken==="ink-mite"?"封蠹得三石":"廊尽见客",
        [coins.disabled?coins.reason:"换钱　花 4 血，拿 3 石。",slot.disabled?slot.reason:"开栏　气血上限 "+p.maxHp+" → "+(p.maxHp-4)+"，法宝可装 2 件。"],
        "只能选一项；也可以直接回店。",[coins,slot,skip],"血客灯下"),
        note:"现在有 "+p.hp+" 血、"+s.gold+" 石。"};
    }
    if(stage==="bloodReceipt"){
      return sheet("交易结果","血客",[tradeNote.cost,tradeNote.effect],
        "气血 "+s.hp+"/"+p.maxHp+"    钱囊 "+s.gold+" 石",[back,gate],"血客灯下");
    }
    return sheet("墨灯熄灭","侧廊折戟",["你没能走出墨蠹巢。","回到首摊，可改换行装再走一次。"],
      "气血 0/"+p.maxHp+"    钱囊 "+s.gold+" 石",[go("rewind","回首摊再选"),go("reset","重新入塔")],"墨蠹巢");
  }
  function describe(s){
    const name=offer?offer.mark+"印":"灯纹印",price=offer?.price??0,later=offer?.later;
    switch(stage){
      case "drop":return {place:"照影廊",tag:"阵心遗物",title:"灯纹印",lines:["灯芯沉成一枚缺角的印。",s.trial.sweptAsh?"你挡住了蛾翅：这次有 2 份灯灰，每份值 1 石。":"还有 1 份灯灰，狐柜收 1 石。"],keys:["拾起灯纹印","连灯灰一并收好"]};
      case "guide":return {place:"照影廊",tag:"免费问价",title:"行脚道友",lines:["道友刚从末市回来。","把印给他看看，先问清两地的收价。"],keys:["问卖价"]};
      case "rumor":return {place:"照影廊",tag:"行情签 "+s.seed,title:"先看末市收价",lines:["这枚"+name+"在首柜卖 4 石，带过狐关能卖 "+later+" 石。","封蜡绢首摊 2 石，末市每份收 "+Tower.view(s).market.silkPrice+" 石。"],ledger:Tower.view(s).market.hot?"路签 · 旺市收绢，上限两份":"常市：转卖每份亏 1 石",keys:["去找狐商"]};
      case "stall":return {place:"狐灯市",tag:MarketOrder.hasGuildSeal()?"狐灯商号 · 熟客":"妖市开秤",title:"狐商 · 绯绡",lines:MarketOrder.hasGuildSeal()?["“上回那批绢卖得好，我还认得你的客印。","把这次的灯纹印放上秤吧。”"]:["“好轻的一团灯火。放上来吧，","秤砣会告诉你，它在我这里值多少。”"],ledger:"点秤或拖印上秤",keys:["把灯纹印放上秤"]};
      case "quote":return {place:"狐灯市",tag:"绯绡出价",title:"灯纹印估单",lines:["首摊卖 "+price+" 石可换砺锋砂，狐关剑伤 6 → 10。","现在不卖，打赢夜市狐后还能卖 "+later+" 石。"],keys:["成交  ＋"+price+" 石","留印上楼"]};
      case "result":return choice==="sell"?
        {place:"狐灯市",tag:"印账 · 成交",title:"银货两讫",lines:["铜盘轻响，"+price+" 枚灵石已落入你的钱囊。","“砂匣在这里，旁的货也随你看。”"],ledger:"灵石  "+atStall.gold+" → "+s.gold+"     妖印  1 → "+s.seals.length,keys:["俯看货摊","直接闯关"]}:
        {place:"狐灯市",tag:"印账 · 留货",title:"带印赴末市",lines:["绯绡收回秤。你将"+name+"裹回囊中。","带它过夜市狐这一关，末市收价 "+later+" 石。"],ledger:"灵石  "+s.gold+"     原印随身",keys:["俯看货摊","持印闯关"]};
      case "counter":return counterPage(s);
      case "crossroads":case "wound":case "blood":case "bloodReceipt":case "sideFailed":return bazaarPage(s);
      case "finalStall":return offer?
        {place:"狐灯末市",tag:"闭市前的秤",title:"卖掉留下的印",lines:["“缺了一角，还是照影廊那枚。","把它放上秤，我照路签给七石。”"],ledger:"点秤或拖印上秤",keys:["将原印放秤"]}:
        {place:"狐灯末市",tag:"闭市前的账",title:"再见绯绡",lines:["“关过了。你的灯纹印在首摊就结了。","过来，我还收妖材。也能替你寄一单。”"],ledger:"原印首摊售出  ＋"+s.trial.firstSale+" 石",keys:["查看末市货摊"]};
      case "finalQuote":return {place:"狐灯末市",tag:"绯绡验过缺角",title:"末市收价",lines:["“七石如数。你一路攥着的这点灯火，","今天就归末市了。”"],ledger:"灯纹印 ×1    收价 "+price+" 石",keys:["卖原印 ＋"+price+" 石"]};
      case "finalSale":return {place:"狐灯末市",tag:"印账 · 末市成交",title:"已收到 7 石",lines:["最后一枚灵石落稳，绯绡取走秤盘上的印。","“看看末市吧。你能卖点妖材，或寄一单。”"],ledger:"灵石  "+purseBeforeSale+" → "+s.gold+"     妖印  1 → 0",keys:["查看末市货摊"]};
      case "receipt":{
        const {ledger}=Tower.view(s).market,trip=ledger.escort;
        const journey=trip?"驿运净收 "+(trip.netCash>=0?"+":"")+trip.netCash+" 石 · "+(trip.returned?"已退契":"交箱 "+trip.remaining+"/3"):"";
        return {place:"狐灯末市",tag:"行情签 "+s.seed,title:s.trial.finalSale?"藏印得价":s.trial.gritBought?"磨刃破关":s.trial.stockTaken.length?"佩器破关":"携银破关",
        lines:[s.trial.finalSale?"灯纹印在末市售出  ＋"+s.trial.finalSale+" 石":"灯纹印在首摊售出  ＋"+s.trial.firstSale+" 石"+(s.trial.gritBought?"    砺锋砂  −4 石":""),
          "守关 "+s.trial.gateTurns+" 手 · 出剑 "+s.trial.gateStrikes+" 次    气血 "+s.trial.gateEntryHp+" → "+s.hp,...(journey?[journey]:[])],
        ledger:"结余 "+s.gold+" 石 · 绢销 "+ledger.silkSold+" 份 · 绢利 "+ledger.silkProfit+" 石",note:s.trial.order?"已寄 "+Tower.view(s).profile.order.name+" · 下次入塔领取":s.trial.stockTaken.length>0?
          "狐柜取货 · "+Tower.view(atStall).stock.filter(a=>s.trial.stockTaken.includes(a.id)).map(a=>a.name).join("、"):"",keys:["回首摊再选",s.trial.order?"领寄单再入塔":"开始下一局"]};
      }
      case "failed":return {place:"狐灯关",tag:"守关未过",title:"灯影止步",lines:["夜市狐堵住了去末市的路。","守关 "+s.trial.gateTurns+" 手 · 出剑 "+s.trial.gateStrikes+" 次    气血 "+s.trial.gateEntryHp+" → "+s.hp],
        ledger:"行囊  "+s.gold+" 灵石    妖印  "+s.seals.length+" 枚",keys:["回首摊再选","重新入塔"]};
    }
  }
  function placeButton(id,x,y,w,h){
    const e=el(id);e.style.left=Math.round(x)+"px";e.style.top=Math.round(y)+"px";e.style.width=Math.round(w)+"px";e.style.height=Math.round(h)+"px";
  }
  function syncControls(s){
    game.dataset.gold=s.gold;game.dataset.seals=s.seals.length;game.dataset.decision=choice;
    const lots=model.lots||[];
    actions.forEach((id,i)=>{
      const button=el(id),label=model.keys[i];button.hidden=!label;
      if(label)button.setAttribute("aria-label",label);
      button.dataset.command=model.commands?.[i]?.id||"";
      button.setAttribute("aria-disabled",String(!!model.disabled?.[i]));
    });
    const extras={
      "market-escort":model.escort?"接押运，查看护送契约":null,
      "market-gear":model.sheets?.length?"查看器物":null,
      "market-cargo":model.sheets?.length?"查看商货":null,
      "market-quantity":model.maxQty>1?"数量 "+quantity+" 份，切换数量":null,
      "market-stack":model.stacks?.length>1?"第 "+(model.stackIndex+1)+" 叠，切换货叠":null
    };
    for(const id of extra){
      const b=el(id);b.hidden=!extras[id];if(extras[id])b.setAttribute("aria-label",extras[id]);
      if(id==="market-cargo"||id==="market-gear")b.setAttribute("aria-pressed",String(id==="market-"+shelf));
    }
    for(const id of slots){
      const b=el(id),lot=lots.find(lot=>lot.id===b.dataset.lot);b.hidden=!lot;
      b.setAttribute("aria-pressed",String(!!lot&&selectedLot===lot.id));
      if(lot)b.setAttribute("aria-label","验看"+lot.name+"，"+lot.price+" 石");
    }
    if(stage==="counter"){game.dataset.lot=selectedLot;game.dataset.shelf=shelf;game.dataset.qty=quantity}else{delete game.dataset.shelf;delete game.dataset.qty}
    if(stage==="counter")game.dataset.lot=selectedLot;else delete game.dataset.lot;
    el("status").textContent=[model.title,...model.lines,model.notice,model.note,model.ledger,...model.keys].filter(Boolean).join("\n");
  }
  function refreshState(s){
    if(!stage)return;
    revision++;model=describe(s);lastLayout=null;frame=null;tablePaint=null;
    pressPointer=null;pressed=-1;hovered=-1;syncControls(s);
  }
  function enter(next,s,now,reduced){
    leaveLoot=false;
    if(!stage){
      marketStart=now;
      // A narrow phone crops the scene. Focusing a partially visible prop must not scroll its HUD.
      game.scrollLeft=0;game.scrollTop=0;
    }
    // Preserve the outgoing physical counter and the closing ledger for the camera move.
    counterOrigin=next==="counter"&&!reduced&&artBox&&(stageScene[stage]==="shop"||stageScene[stage]==="result")
      ?TradeTable.capture(art,hud,artBox,game.clientWidth,game.clientHeight):null;
    if(next==="counter"){
      counterNote="";quantity=1;selectedStack="";
      if(s.floor===2){
        const silk=Tower.view(s).stock.find(lot=>lot.id==="silk"&&lot.sellStacks?.length);
        shelf=silk?"cargo":"gear";selectedLot=silk?"silk":"";
      }
    }
    stage=next;entered=now;lastSound=false;landed=0;objectShape=null;
    const delay=next==="result"||next==="finalSale"?1080:next==="quote"||next==="finalQuote"?940:next==="counter"?650:300;
    enabledAt=now+(reduced?100:delay);
    refreshState(s);game.dataset.phase=stage;
    art.hidden=next==="counter";el("world").hidden=true;
    ["strike","guard","target"].forEach(id=>el(id).hidden=true);
    el("object").hidden=!objects.has(stage);
    el("object").setAttribute("aria-label",model.keys[0]+"（场景物件）");
    buttons.forEach(id=>el(id).disabled=true);
  }
  function hide(){
    counterOrigin=null;stage="";model=null;lastLayout=null;frame=null;objectShape=null;hovered=-1;pressed=-1;pressPointer=null;lens={x:0,y:0,dx:0,dy:0};
    art.hidden=true;el("world").hidden=false;buttons.forEach(id=>el(id).hidden=true);
    ["strike","guard","target"].forEach(id=>el(id).hidden=false);
    revision++;delete game.dataset.gold;delete game.dataset.seals;delete game.dataset.decision;delete game.dataset.lot;delete game.dataset.shelf;delete game.dataset.qty;
  }
  function clear(){hide();choice="";offer=null;atStall=null;purseBeforeSale=0;selectedLot="grit";shelf="gear";quantity=1;selectedStack="";counterNote="";tradeNote=null}
  function begin(s,now,reduced){
    if(s.phase==="blood"){enter("blood",s,now,reduced);return}
    if(s.phase==="lost"&&s.foeKind==="ink-mite"){enter("sideFailed",s,now,reduced);return}
    if(s.floor===1){if(s.phase==="reward")enter("drop",s,now,reduced);return}
    if(s.phase==="lost"){enter("failed",s,now,reduced);return}
    offer=Tower.view(s).offers.find(item=>item.id==="sell-1")||null;
    enter("finalStall",s,now,reduced);
  }
  function enterGate(s){
    const next=Tower.act(s,"gate");
    if(next!==s){hide();CutVoice.play("market")}
    return next;
  }
  function bazaarAct(action,s,now,reduced){
    const command=action.id;
    if(command==="leave-loot"||command==="cancel-leave"){
      leaveLoot=command==="leave-loot";refreshState(s);return s;
    }
    if(command==="confirm-leave"){
      if(!leaveLoot)return s;
      let next=s;
      for(const item of Tower.view(s).profile.bag.pending){
        const changed=Tower.arrange(next,{action:"discard",id:item.id,instanceId:item.instanceId});
        if(changed===next)return s;
        next=changed;
      }
      leaveLoot=false;refreshState(next);return next;
    }
    if(command==="open-loot"){window.dispatchEvent(new Event("tower:open-bag"));return s}
    if(command==="reset")return null;
    if(command==="rewind"){
      selectedLot="grit";shelf="gear";tradeNote=null;choice="";
      offer=Tower.view(atStall).offers.find(item=>item.id==="sell-1");enter("quote",atStall,now,reduced);return atStall;
    }
    if(command==="gate")return enterGate(s);
    if(command==="counter"||command==="crossroads"){
      CutVoice.play("paper");enter(command,s,now,reduced);return s;
    }
    const isTrade=stage==="counter"&&(model.commands[0]===action||model.commands[1]===action);
    const v=Tower.view(s),a=isTrade?action:v.actions.find(a=>a.id===command);
    if(!a||a.disabled)return s;
    const next=Tower.act(s,isTrade?a:command);if(next===s)return s;
    if(next.phase==="fight"){CutVoice.play("market");hide();return next}
    if(next.phase==="wound"||next.phase==="blood"){CutVoice.play("paper");enter(next.phase,next,now,reduced);return next}
    if(command==="settle"){CutVoice.play("stamp");enter("receipt",next,now,reduced);return next}
    if(stage==="counter"){
      const item=model.item;
      const verb=item.tradeKind==="sell"?"已售":item.tradeKind==="order"?"已寄":command.startsWith("barter-")?"已交铃换得":"已取";
      counterNote=verb+item.name+(model.order?.qty>1?" ×"+model.order.qty:"")+" · 灵石 "+s.gold+" → "+next.gold;
      quantity=1;
      CutVoice.play(item.id==="grit"?"grind":"stamp");refreshState(next);
      if(item.tradeKind==="sell")el(slots[lotIds.indexOf(selectedLot)])?.focus({preventScroll:true});
    }else if(stage==="blood"){
      tradeNote={cost:a.label+" · "+(a.id==="skip-blood"?"一笔未签":a.id==="blood-slot"?"法宝栏增至两格":"已收 3 灵石"),
        effect:a.id==="blood-slot"?"气血上限 "+v.profile.maxHp+" → "+Tower.view(next).profile.maxHp+"，新栏可回柜添置法宝。":
          a.id==="blood-coins"?"气血 "+s.hp+" → "+next.hp+"，钱囊 "+s.gold+" → "+next.gold+" 石。":"你带着原有的灵石和气血回到狐柜。"};
      CutVoice.play(a.id==="skip-blood"?"paper":"stamp");enter("bloodReceipt",next,now,reduced);
    }
    return next;
  }
  function act(id,s,now,reduced,nextSeed=s.seed){
    if(!stage||now<enabledAt||el(id).hidden||el(id).disabled)return s;
    let next=s;
    if(stage==="counter"&&id==="market-escort"){
      if(model.escort)window.dispatchEvent(new Event("tower:escort"));
      return s;
    }
    if(stage==="counter"&&extra.includes(id)){
      if(id==="market-gear"||id==="market-cargo"){shelf=id==="market-gear"?"gear":"cargo";selectedLot="";quantity=1;selectedStack=""}
      if(id==="market-quantity")quantity=quantity%model.maxQty+1;
      if(id==="market-stack"){selectedStack=model.stacks[(model.stackIndex+1)%model.stacks.length].instanceId;quantity=1}
      counterNote="";CutVoice.play("paper");refreshState(s);return s;
    }
    if(stage==="counter"&&slots.includes(id)){
      const lot=el(id).dataset.lot;
      if(selectedLot!==lot){selectedLot=lot;quantity=1;selectedStack="";counterNote="";CutVoice.play("paper");refreshState(s)}
      return s;
    }
    if(model.commands){
      const selected=model.commands[actions.indexOf(id)];
      return !selected||selected.disabled?s:bazaarAct(selected,s,now,reduced);
    }
    switch(stage){
      case "drop":next=Tower.act(s,id==="secondary"?"take-ash":"take");if(next!==s){CutVoice.play("take");enter("guide",next,now,reduced)}break;
      case "guide":
        next=Tower.act(s,"guide");
        if(next!==s){offer=Tower.view(next).offers.find(item=>item.id==="sell-1");atStall=next;CutVoice.play("paper");enter("rumor",next,now,reduced)}break;
      case "rumor":CutVoice.play("market");enter("stall",s,now,reduced);break;
      case "stall":enter("quote",s,now,reduced);break;
      case "quote":{
        choice=id==="secondary"?"keep":"sell";
        purseBeforeSale=s.gold;
        next=Tower.act(s,choice==="sell"?"sell-1":"keep");
        if(next===s)return s;
        CutVoice.play(choice==="sell"?"stamp":"tie");
        enter("result",next,now,reduced);break;
      }
      case "result":
        if(id==="secondary")return enterGate(s);
        CutVoice.play("paper");enter("counter",s,now,reduced);break;
      case "finalStall":
        if(offer){enter("finalQuote",s,now,reduced);break}
        CutVoice.play("paper");enter("counter",s,now,reduced);break;
      case "finalQuote":
        purseBeforeSale=s.gold;next=Tower.act(s,"sell-1");
        if(next!==s){CutVoice.play("stamp");enter("finalSale",next,now,reduced)}break;
      case "finalSale":
        CutVoice.play("paper");enter("counter",s,now,reduced);break;
      case "receipt":case "failed":
        if(id==="secondary"){
          if(stage==="failed")return null;
          const fresh=Tower.nextRun(s,nextSeed);clear();return Tower.act(fresh,"sword");
        }
        choice="";next=atStall;selectedLot="grit";shelf="gear";tradeNote=null;offer=Tower.view(next).offers.find(item=>item.id==="sell-1");enter("quote",next,now,reduced);break;
    }
    return next;
  }
  function look(e){
    if(!stage||!artBox)return;
    const rect=game.getBoundingClientRect();
    lens.dx=clamp((e.clientX-rect.left)/rect.width*2-1,-1,1);
    lens.dy=clamp((e.clientY-rect.top)/rect.height*2-1,-1,1);
  }
  game.addEventListener("pointermove",look);
  game.addEventListener("pointerleave",()=>{lens.dx=0;lens.dy=0});
  function refresh(){
    if(!frame||!lastLayout||!model)return;
    const focused=buttons.findIndex(id=>el(id).matches(":focus-visible"));
    const hot=hovered<0?focused:hovered,ctx=hud.getContext("2d");
    if(stage==="counter"){
      // A stationary tabletop has no idle animation. Repaint it when a ticket or input actually changes.
      if(frame.tableProgress===1&&tablePaint?.layout===lastLayout&&tablePaint.hot===hot&&tablePaint.down===pressed&&
         tablePaint.sound===frame.sound&&tablePaint.active===frame.active)return;
      tablePaint=frame.tableProgress===1?{layout:lastLayout,hot,down:pressed,sound:frame.sound,active:frame.active}:null;
      const lotAt=k=>k<0?-1:model.lots.findIndex(item=>item.id===el(buttons[k])?.dataset.lot);
      TradeTable.draw(ctx,lastLayout,model,{...frame,hover:hot,down:pressed,lotHover:lotAt(hot),lotDown:lotAt(pressed)});
      return;
    }
    MarketUI.draw(ctx,lastLayout,model,{...frame,hover:hot,down:pressed});
    if(hot===buttons.indexOf("object")&&objectShape&&artBox){
      const {ratio}=lastLayout.base,{x,y,zoom}=artBox;
      const cx=(x+objectShape.x*zoom)/ratio,cy=(y+objectShape.y*zoom)/ratio;
      const rx=objectShape.rx*zoom*.80/ratio,ry=objectShape.ry*zoom*.80/ratio;
      ctx.save();ctx.strokeStyle=pressed===hot?"#fff1b8":"#e2c68f";ctx.lineWidth=1.6;ctx.beginPath();
      for(const side of [-1,1]){ctx.moveTo(cx+side*(rx-3),cy-ry*.38);ctx.lineTo(cx+side*rx,cy-ry*.22);ctx.lineTo(cx+side*rx,cy+ry*.22);ctx.lineTo(cx+side*(rx-3),cy+ry*.38)}
      ctx.stroke();ctx.restore();
    }
  }
  function hit(id,e){
    const target=el(id);
    if(!frame||!frame.active||!target||target.hidden||target.disabled)return false;
    if(document.elementFromPoint(e.clientX,e.clientY)!==target)return false;
    const r=target.getBoundingClientRect(),u=e.clientX-r.left,v=e.clientY-r.top;
    if(u<0||v<0||u>=r.width||v>=r.height)return false;
    if(stage==="counter"&&slots.includes(id)){
      const index=model.lots.findIndex(item=>item.id===target.dataset.lot);
      const lot=lastLayout.lots[index],rr=game.getBoundingClientRect(),ratio=lastLayout.base.ratio;
      return !!lot&&TradeTable.hitLot(model.lots[index],lot,(e.clientX-rr.left)/ratio,(e.clientY-rr.top)/ratio,!lastLayout.base.portrait);
    }
    if(id!=="object"){
      const corner=Math.min(6,(lastLayout.panel?.scale||1)*lastLayout.base.ratio*4);
      return Math.min(u,r.width-u)+Math.min(v,r.height-v)>=corner;
    }
    if(!objectShape)return false;
    const a=art.getBoundingClientRect();
    const dx=(e.clientX-a.left)*960/a.width-objectShape.x,dy=(e.clientY-a.top)*540/a.height-objectShape.y;
    const ellipse=(x,y,rx,ry)=>(x/rx)**2+(y/ry)**2<=1;
    if(stage==="drop")return NightMarket.sealHit(dx,dy,objectShape.sealSize,objectShape.angle);
    if(stage==="guide"||stage==="rumor")return ellipse(dx,dy,objectShape.rx*.64,objectShape.ry*.84);
    if(stage==="stall"||(stage==="finalStall"&&offer))return WeighGesture.overPan(dx,dy);
    return Math.abs(dx+dy*.1)<60&&Math.abs(dy+dx*.1)<26;
  }
  for(const [i,id] of buttons.entries()){
    const control=el(id),k=i;
    if(slots.includes(id))control.addEventListener("keydown",e=>{
      if(stage!=="counter"||e.repeat||!lastLayout||!frame?.active)return;
      const shift={ArrowLeft:-1,ArrowRight:1,ArrowUp:-lastLayout.cols,ArrowDown:lastLayout.cols}[e.key];
      if(shift===undefined)return;
      e.preventDefault();
      const from=model.lots.findIndex(item=>item.id===control.dataset.lot);
      const to=clamp(from+shift,0,model.lots.length-1);
      if(from!==to){
        const button=el(slots[lotIds.indexOf(model.lots[to].id)]);
        button.focus({preventScroll:true});button.click();
      }
    });
    control.addEventListener("pointermove",e=>{
      const next=hit(id,e)?k:-1,nextPressed=e.pointerId===pressPointer?next:pressed;
      if(next!==hovered||nextPressed!==pressed){hovered=next;pressed=nextPressed;refresh()}
    });
    control.addEventListener("pointerleave",()=>{hovered=-1;refresh()});
    control.addEventListener("pointerdown",e=>{if(e.isPrimary&&e.button===0&&hit(id,e)){pressed=k;pressPointer=e.pointerId;refresh()}});
    control.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){pressed=k;refresh()}});
    for(const event of ["pointerup","pointercancel","keyup","blur"])control.addEventListener(event,()=>{pressed=-1;pressPointer=null;refresh()});
    control.addEventListener("focus",refresh);
  }
  function position(L){
    const {w,h,portrait,ratio}=L,cw=game.clientWidth,ch=game.clientHeight;
    if(stage==="counter"){
      const table=TradeTable.layout(L,model);
      for(const [id,r] of Object.entries(table.extra)){
        placeButton(id,r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio);
      }
      for(const [i,r] of table.ar.entries())if(r)placeButton(actions[i],r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio);
      table.lots.forEach((r,i)=>{
        const id=slots[lotIds.indexOf(model.lots[i].id)];
        placeButton(id,r.x*ratio,r.y*ratio,r.w*ratio,r.h*ratio);
      });
      for(const [id,cx] of [["reset",table.resetX],["sound",table.soundX]]){
        const hit=Math.max(36,34*ratio);
        placeButton(id,cx*ratio-hit/2,(table.topY+13)*ratio-hit/2,hit,hit);
      }
      return table;
    }
    art.style.transform="";art.style.transformOrigin="";
    const columns=Math.min(model.keys.length,2),rows=Math.ceil(model.keys.length/columns),isQuote=stage==="quote";
    const panelWidth=portrait?Math.min(w-20,430):Math.min(289,w*.333);
    const scale=portrait?Math.min(1.14,panelWidth/286):Math.min(1.05,panelWidth/263,(h-47)/198);
    const actionHeight=Math.max(isQuote?32:36,Math.ceil(44/(scale*ratio)));
    const pw=panelWidth/scale,ph=isQuote?201+actionHeight-32:193+actionHeight-36+(rows-1)*(actionHeight+6)+(model.note?21:0)+Math.max(0,model.lines.length-2)*21;
    const panelHeight=ph*scale;
    const zoom=portrait?Math.min(cw/588,(ch-panelHeight*ratio-49)/540):Math.max(cw/960,ch/540);
    const at=stageScene[stage]==="shop"||stage==="result"?552:535;
    const x=portrait?cw/2-at*zoom:(cw-960*zoom)/2;
    const y=portrait?Math.max(35,Math.min(ch*.115,ch-panelHeight*ratio-540*zoom-8)):(ch-540*zoom)/2;
    artBox={x,y,zoom};
    const density=Math.min(2,Math.max(1,zoom*(window.devicePixelRatio||1)));
    const width=Math.round(960*density),height=Math.round(540*density);
    if(art.width!==width||art.height!==height){art.width=width;art.height=height}
    board.setTransform(width/960,0,0,height/540,0,0);
    Object.assign(art.style,{left:x+"px",top:y+"px",width:(960*zoom)+"px",height:(540*zoom)+"px"});
    const xx=portrait?(w-panelWidth)/2:Math.max(8,w*.016);
    const yy=portrait?Math.min(h-panelHeight-5,(y+540*zoom)/ratio+3):Math.max(39,(h-panelHeight)*.34);
    const panel={x:xx,y:yy,w:pw,h:ph,scale};
    const inset=isQuote?11:17,gap=isQuote?7:6;
    const rw=(pw-inset*2-(columns-1)*gap)/columns;
    const rects=model.keys.map((label,i)=>{
      const col=i%columns,row=Math.floor(i/columns),span=i===model.keys.length-1&&model.keys.length%columns&&row>0;
      const r={x:inset+col*(rw+gap),y:isQuote?43:ph-15-actionHeight-(rows-1-row)*(actionHeight+6),
        w:span?pw-inset*2:rw,h:isQuote?ph-54:actionHeight,label,command:model.commands?.[i]?.id,disabled:!!model.disabled?.[i]};
      if(isQuote)r.action={x:6,y:r.h-6-actionHeight,w:r.w-12,h:actionHeight};
      return r;
    });
    rects.forEach((r,i)=>{
      const a=r.action||{x:0,y:0,w:r.w,h:r.h},k=scale*ratio;
      placeButton(actions[i],(xx+(r.x+a.x)*scale)*ratio,(yy+(r.y+a.y)*scale)*ratio,a.w*k,a.h*k);
    });
    const topY=portrait?Math.max(3,Math.min(14,y/ratio-31)):7;
    const soundX=w-20,resetX=w-57;
    for(const [id,cx] of [["reset",resetX],["sound",soundX]]){
      const hit=Math.max(36,34*ratio);
      placeButton(id,cx*ratio-hit/2,(topY+13)*ratio-hit/2,hit,hit);
    }
    return {base:L,panel,rects,topY,soundX,resetX};
  }
  function draw(L,s,now,reduced){
    if(!lastLayout||lastLayout.base!==L)lastLayout=position(L);
    const u=Math.max(0,(now-entered)/1000),progress=reduced?1:smooth(u/.94);
    if(stage==="counter"){
      const tableProgress=reduced?1:clamp(u/.65);
      if(tableProgress===1)counterOrigin=null;
      for(const [i,id] of buttons.entries())el(id).disabled=now<enabledAt||i<actions.length&&!!model.disabled[i];
      frame={stage,tableProgress,counterOrigin,active:now>=enabledAt,cash:s.gold,seals:s.seals.length,sound:CutVoice.enabled};
      refresh();return now<Math.max(enabledAt,entered+690);
    }
    const selling=stage==="finalSale"||(stage==="result"&&choice==="sell");
    const weighing=stage==="quote"||stage==="finalQuote";
    const closing=stage==="result"||stage==="finalSale";
    const give=closing?1:weighing?progress:0;
    const deal=closing?progress:0;
    if((weighing&&give>.62||stage==="result"&&choice==="keep"&&deal>.40)&&!lastSound){
      lastSound=true;CutVoice.play(weighing?"scale":choice);
    }
    lens.x+=(lens.dx-lens.x)*.17;lens.y+=(lens.dy-lens.y)*.17;
    const scene=stageScene[stage];
    const artChoice=stage==="finalSale"?"sell":stage==="result"?choice:"";
    const t=reduced?0:(now-marketStart)/1000;
    let obj=null;
    if(scene==="side"||scene==="blood"||scene==="wound"){
      Bazaar.draw(board,{scene,t,look:reduced?0:lens.x,coins:model.coins});
    }else{
    obj=NightMarket.draw(board,{scene,mode:stage,t:(now-marketStart)/1000,progress,give,deal,choice:artChoice,
      firstChoice:choice,hasOriginal:s.seals.some(item=>item.id===1),gritBought:!!s.trial?.gritBought,price:offer?.price,
      reduced,lookX:reduced?0:lens.x,lookY:reduced?0:lens.y});
    }
    if(selling&&obj.landed>landed){
      CutVoice.play("sell",{from:landed,to:obj.landed});landed=obj.landed;
    }
    const bounds=objectShape=obj?.target;
    if(bounds&&!el("object").hidden){
      const {zoom,x,y}=artBox;
      placeButton("object",x+(bounds.x-bounds.rx)*zoom,y+(bounds.y-bounds.ry)*zoom,bounds.rx*2*zoom,bounds.ry*2*zoom);
    }
    buttons.forEach((id,i)=>{el(id).disabled=now<enabledAt||!!model.disabled?.[i]});
    const cash=selling?purseBeforeSale+landed:s.gold;
    const seals=selling&&landed===0?s.seals.length+1:s.seals.length;
    frame={stage,give,selling,landed,offer,active:now>=enabledAt,cash,seals,sound:CutVoice.enabled};
    refresh();
    return now<Math.max(enabledAt,entered+1020);
  }
  return {controls:buttons,get revision(){return revision},get place(){return game.dataset.escorting?document.querySelector(".escort-place")?.textContent||"":stage?model?.place||"":""},get stage(){return stage},get active(){return !!stage},clear,begin,act,draw,hit,refreshState};
})();
