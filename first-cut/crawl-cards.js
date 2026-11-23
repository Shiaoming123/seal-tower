/* Cards own the initiative in the walkable branch. Both branches settle the same cargo and orders. */
(() => {
  "use strict";
  const hunt=typeof module!=="undefined"&&module.exports?require("./hunt-rules.js"):window.HuntRules;
  const {move,finishFight,add}=hunt.encounter;
  const definitions={
    tap:     {label:"挑灯试刃",cost:0,fx:"strike",art:"wick",power:1},
    step:    {label:"侧身",cost:0,fx:"guard",art:"footwork",power:2},
    attack:  {label:"进击",cost:1,fx:"strike",art:"weapon",power:3},
    parry:   {label:"架招",cost:1,fx:"guard",art:"weapon",power:4},
    dust:    {label:"扬灰",cost:1,fx:"flare",art:"ash",power:3},
    heavy:   {label:"全力一击",cost:2,fx:"strike",art:"weapon",power:6},
    shell:   {label:"护住货袋",cost:2,fx:"guard",art:"shell",power:7},
    knife:   {label:"短刺",cost:0,fx:"strike",art:"knife",power:2},
    hook:    {label:"回钩",cost:1,fx:"strike",art:"hook",power:4},
    buckler: {label:"扎稳盾步",cost:1,fx:"guard",art:"buckler",power:6},
    plate:   {label:"盘照",cost:0,fx:"flare",art:"plate",power:4}
  };
  const handSize=4,energyPerTurn=3;
  function shuffle(pile,c){
    // The RNG cursor travels with the run so reopening the same fight reproduces exactly the same hand.
    for(let i=pile.length-1;i>0;i--){
      c.rng=(Math.imul(1664525,c.rng)+1013904223)>>>0;
      const j=Math.floor(c.rng/4294967296*(i+1));
      [pile[i],pile[j]]=[pile[j],pile[i]];
    }
    return pile;
  }
  function drawHand(c){
    while(c.hand.length<handSize){
      if(!c.draw.length){
        if(!c.discard.length)break;
        c.draw=shuffle(c.discard,c);c.discard=[];
      }
      c.hand.push(c.draw.pop());
    }
  }
  const basketHit={name:"掀货筐",damage:5};
  function freightPrice(s){return s.contract==="clasp"?1:3}
  function freightPreview(s){
    return "货郎把一枚完扣放在鼠洞的水渠旁。护住筐，战后用 "+freightPrice(s)+" 灰换 1 枚完扣。回铺散卖 4 石。"+
      (s.contract==="clasp"?"桥驿提前交扣后，换价仍是 1 灰。":"另一条灯架路可以收灰。");
  }
  function intent(s){return s.cardFight?.freight==="waiting"?basketHit:move(s)}
  function begin(s){
    const deck=["tap","step","attack","parry","dust","heavy","shell",s.weapon];
    if(s.plate)deck.push("plate");
    const c={deck,hand:[],draw:[],discard:[],rng:(s.sign^Math.imul(s.cleared+1,2654435761)^(s.foe.id==="fox"?71:s.foe.id==="rat"?43:17))>>>0,
      round:1,energy:energyPerTurn,block:0,combo:0,lastCost:null,stopped:false,lightPower:0};
    if(s.leg===2&&s.foe.id==="rat")c.freight="waiting";
    c.draw=shuffle(deck.map((_,i)=>i),c);drawHand(c);
    // A hand can contain several attacks before a single answer. Tune this branch's health at spawn only.
    const hp=Math.ceil(s.foe.maxHp*1.55)+1;
    return {...s,cardFight:c,foe:{...s.foe,hp,maxHp:hp}};
  }
  function create(seed,standing){return hunt.create(seed,standing)}
  function startsWithGuard(s){return s.cardFight.block>0||s.cardFight.stopped}
  function nextCombo(progress,cost){
    if(cost===0)return 1;
    if(cost===1&&progress===1)return 2;
    if(cost===2&&progress===2)return 3;
    return 0;
  }
  function cardAction(s,index){
    const f=s.foe,c=s.cardFight,key=c.deck[index],card=definitions[key];
    const m=intent(s),combo=nextCombo(c.combo,card.cost)===3;
    const bonus=combo?2:0;
    let power=card.power+bonus;
    let detail;
    if(card.fx==="strike"){
      if(key==="attack"&&s.weapon==="knife")power++;
      if(f.counter)power+=3;
      if(f.lit)power+=c.lightPower;
      if(m.pounce&&["挂在颈下","缺了一角"].includes(f.clasp))power+=3;
      detail="打 "+power+" 伤。";
      if(m.pounce&&["挂在颈下","缺了一角"].includes(f.clasp))detail+="会斩断颈扣。";
      if(f.core&&f.primed)detail+="可挑走灯芯。";
    }else if(card.fx==="guard"){
      if(key==="parry"&&s.weapon==="buckler")power++;
      detail="本轮加 "+power+" 格挡。";
      if(s.weapon==="hook"&&f.core)detail+="接住扑翅可露芯。";
      if(s.weapon==="buckler")detail+="接招后下击多打 3 伤。";
    }else{
      detail="用 1 灰，下击多打 "+power+" 伤。"+(s.plate?"本轮截住敌招。":"敌招仍会落下。");
    }
    if(c.freight==="waiting"&&card.fx==="guard"&&c.block<5)detail+=c.block+power>=5?"够护筐。":"还差 "+(5-c.block-power)+" 格挡护筐。";
    if(c.freight==="waiting"&&card.fx==="flare"&&s.plate&&s.items.ash>0&&s.items.ash-1<freightPrice(s))detail+="用后不够换扣。";
    if(combo)detail+="含连招加成 2。";
    const disabled=c.energy<card.cost||(card.fx==="flare"&&!s.items.ash);
    if(disabled)detail+=c.energy<card.cost?"行动点不足。":"货袋里没有灯灰。";
    const art=card.art==="weapon"?s.weapon:card.art;
    return {id:"card-"+s.cleared+"-"+c.round+"-"+index,label:card.label,detail,disabled,
      cost:card.cost,art,fx:card.fx,power,combo,index};
  }
  function view(s){
    const v=hunt.view(s);
    v.freight=s.cardFight?.freight||s.loot?.freight||null;
    v.freightPrice=freightPrice(s);
    if(s.phase!=="fight"){
      if(s.phase==="market"){
        v.description=freightPreview(s)+" 鼠首招 5 伤，攒够 5 格挡、用盘截招或先击倒，都能保货。"+v.description;
      }
      if(s.phase==="gather"&&s.leg===2){
        v.description+=" 鼠洞换扣要 "+v.freightPrice+" 灰。你现在有 "+s.items.ash+" 灰。";
      }
      if(s.phase==="loot"&&v.freight){
        if(v.freight==="safe"){
          const cost=v.freightPrice,ash=s.items.ash;
          v.description="货郎的完扣保住了。你有 "+ash+" 灰，换扣需 "+cost+" 灰。"+v.description;
          v.actions.unshift({id:"trade-freight",label:"用 "+cost+" 灰换完扣",detail:ash<cost?
            "还差 "+(cost-ash)+" 灰。":"付后剩 "+(ash-cost)+" 灰，得 1 枚完整狐扣。",disabled:ash<cost});
        }else v.description=(v.freight==="lost"?"货筐落水，完扣换不到了。":"完扣已装袋。")+v.description;
      }
      if((s.phase==="settle"||s.phase==="done")&&s.freightPaid)
        v.description+=" 鼠洞用 "+s.freightPaid+" 灰换回 1 枚完扣。";
      if(s.phase==="gear"){
        for(const a of v.actions){
          if(a.id==="gear-knife")a.detail="免费。牌组多一张 0 点短刺，进击多打 1 伤。";
          if(a.id==="gear-hook")a.detail="牌组多一张回钩。架住蛾翅后，下击可取灯芯。";
          if(a.id==="gear-buckler")a.detail="多一张盾步。格挡接招后，下击多打 3 伤。";
          if(a.id==="gear-plate")a.detail="刀牌加 0 点盘照。扬灰花 1 灰截住本轮敌招。";
        }
      }
      if(s.phase==="loot"&&v.offer){
        const a=v.actions.find(o=>o.id==="take-gear");
        if(a)a.detail="下一战换入"+definitions[v.offer.id].label+"。"+
          ({knife:"进击多打 1 伤。",hook:"架住蛾翅后，下击可取芯。",buckler:"接招后下击多打 3 伤。"}[v.offer.id]);
      }
      v.cards=null;return v;
    }
    const c=s.cardFight,m=intent(s);
    v.foe.intent=m.name;v.foe.damage=m.damage;
    v.cards={energy:c.energy,lastCost:c.lastCost,draw:c.draw.length,discard:c.discard.length,combo:c.combo,
      handCount:c.hand.length,block:c.block,round:c.round,stopped:c.stopped};
    const incoming=c.stopped?0:Math.max(0,m.damage-c.block);
    v.description=m.name+" · "+m.damage+" 伤；结束回合预计受 "+incoming+" 伤。"+
      (m.pounce&&s.foe.clasp==="挂在颈下"?"挡下飞扑保扣，此刻出刀会断扣。":m.steal?"留格挡可护住灰。":"");
    if(c.freight==="waiting"){
      const answer=c.stopped?"灯盘已截招，货筐保住":c.block>=5?"已凑够 5 格挡，货筐保住":"还差 "+(5-c.block)+" 格挡，结束回合货筐会沉";
      v.description="掀筐 5 伤，预计受 "+incoming+" 伤。"+answer+"。先击倒也可保货。";
    }
    v.actions=c.hand.map(i=>cardAction(s,i));
    v.actions.push({id:"end-turn",label:"结束回合",detail:"敌人出招，弃掉余牌，重抽 4 张。",disabled:false},
      {id:"retreat",label:"带货回铺",detail:"退出此战，保留已装好的货。",disabled:false});
    return v;
  }
  function cloneFight(s){
    const c=s.cardFight;
    return {...s,foe:{...s.foe},items:{...s.items},cardFight:{...c,hand:[...c.hand],draw:[...c.draw],discard:[...c.discard]}};
  }
  function playCard(s,a){
    const f=s.foe,c=s.cardFight,m=intent(s),notes=[];
    c.hand=c.hand.filter(i=>i!==a.index);c.discard.push(a.index);c.energy-=a.cost;
    c.lastCost=a.cost;c.combo=nextCombo(c.combo,a.cost);
    if(a.combo)notes.push("连招，多得 2 点");
    if(a.fx==="strike"){
      f.hp=Math.max(0,f.hp-a.power);notes.push("击中 "+a.power+" 伤");
      if(m.pounce&&["挂在颈下","缺了一角"].includes(f.clasp)){f.clasp="已断";notes.push("狐扣被斩断")}
      f.lit=false;c.lightPower=0;f.counter=false;
      if(f.primed&&f.core){
        if(add(s,"ash",1)){f.core=false;notes.push("挑出一份灯灰")}
        else notes.push("货袋已满，没能收芯");
        f.primed=false;
      }
      if(!f.hp){
        s.turns++;finishFight(s);notes.push("敌人倒下");
        if(c.freight){s.loot.freight=c.freight==="waiting"?"safe":c.freight;if(c.freight==="waiting")notes.push("抢先保住货筐")}
        delete s.cardFight;
      }
    }else if(a.fx==="guard"){
      c.block+=a.power;notes.push("本轮格挡 "+c.block);
    }else{
      s.items.ash--;s.ashBurned++;f.lit=true;c.lightPower=a.power;c.stopped=s.plate;
      notes.push("用掉 1 灰，下击多打 "+a.power+" 伤");
      if(c.stopped)notes.push("灯盘已截招");
    }
    s.notice=notes.join("，")+"。";
  }
  function endTurn(s){
    const f=s.foe,c=s.cardFight,m=intent(s);
    const guarding=startsWithGuard(s);
    const damage=c.stopped?0:Math.max(0,m.damage-c.block);
    const notes=[m.name+(damage?"，受 "+damage+" 伤":"，未受伤")];
    if(c.freight==="waiting"){
      c.freight=c.stopped||c.block>=m.damage?"safe":"lost";
      notes.push(c.freight==="safe"?"货筐保住，打赢后可以换扣":"货筐落水，完扣没了");
    }
    if(m.pounce&&f.clasp==="挂在颈下"&&guarding){f.clasp="完整收好";notes.push("接住飞扑，保住完整狐扣")}
    if(c.block&&s.weapon==="hook"&&f.core&&m.damage>=3){f.primed=true;notes.push("灯芯露出，下击可取")}
    if(c.block&&s.weapon==="buckler"){f.counter=true;notes.push("下击多打 3 伤")}
    if(m.steal&&!guarding&&s.items.ash){s.items.ash--;f.theft++;notes.push("窃芯鼠偷去 1 份灰")}
    s.hp=Math.max(0,s.hp-damage);s.turns++;f.turn++;
    if(!s.hp){s.exitReason="受伤撤回";s.phase="settle";s.foe=null;delete s.cardFight;notes.push("道友送你和货回铺")}
    else{
      c.discard.push(...c.hand);c.hand=[];c.energy=energyPerTurn;c.block=0;c.combo=0;c.lastCost=null;c.stopped=false;
      c.round++;drawHand(c);
    }
    s.notice=notes.join("，")+"。";
  }
  function act(s,id){
    if(id==="trade-freight"){
      const cost=freightPrice(s);
      if(s.phase!=="loot"||s.loot?.freight!=="safe"||s.items.ash<cost)return s;
      // Giving at least one unit for one clasp fits even when the bag starts full.
      return {...s,items:{...s.items,ash:s.items.ash-cost,clasp:s.items.clasp+1},loot:{...s.loot,freight:"traded"},
        freightPaid:cost,notice:"付了 "+cost+" 灰，完整狐扣已装袋。"};
    }
    if(s.phase!=="fight"||id==="retreat"){
      const n=hunt.act(s,id);
      if(n===s)return s;
      if(n.phase==="fight")return begin(n);
      if(n.cardFight)delete n.cardFight;
      return n;
    }
    const a=view(s).actions.find(o=>o.id===id);
    if(!a||a.disabled)return s;
    const n=cloneFight(s);
    if(id==="end-turn")endTurn(n);else playCard(n,a);
    return n;
  }
  const api=Object.freeze({create,view,act});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(typeof window!=="undefined")window.CrawlCards=api;
})();
