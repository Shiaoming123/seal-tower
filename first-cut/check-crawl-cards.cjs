"use strict";
const assert=require("node:assert/strict");
const rules=require("./crawl-cards.js");
const {act,create,view}=rules;
const available=(s,id)=>view(s).actions.some(a=>a.id===id&&!a.disabled);
const cards=s=>view(s).actions.filter(a=>a.fx&&!a.disabled);
const art=new Set(["knife","hook","buckler","ash","shell","plate","wick","footwork"]);
function checked(s,id){
  const orig=JSON.stringify(s);
  assert(available(s,id),s.phase+" "+id);
  const n=act(s,id),v=view(n);
  assert.notEqual(n,s);assert.equal(JSON.stringify(s),orig);
  assert(n.hp>=0&&n.hp<=n.maxHp&&n.cash>=0&&v.used<=v.capacity);
  assert.equal(n.cash,3+n.sales+n.fee-n.expenses);
  if(v.cards){
    const c=n.cardFight,all=[...c.hand,...c.draw,...c.discard];
    assert.equal(new Set(all).size,c.deck.length);assert.equal(all.length,c.deck.length);
    assert(c.energy>=0&&c.energy<=3);assert.equal(c.hand.length,v.cards.handCount);
    for(const a of v.actions.filter(a=>a.fx))assert(art.has(a.art));
  }
  return n;
}
const walk=(s,ids)=>ids.reduce(checked,s);
const open=(seed,order="ash",gear="knife",enemy="moth")=>walk(create(seed),["order-"+order,"gear-"+gear,"gather-ash","hunt-"+enemy]);

// Choose only from a visible hand and current enemy intent. Never inspect the draw pile.
function playRound(s){
  const start=view(s),wantClasp=s.contract==="clasp"&&s.foe.clasp==="挂在颈下";
  let best={score:-Infinity,seq:[]};
  function assess(state,seq){
    const v=view(state),dead=v.phase==="loot",next=dead?state:act(state,"end-turn");
    const hurt=start.hp-next.hp,damage=start.foe.hp-(v.foe?.hp||0);
    let score=damage*3-hurt*5+(dead?20:0)+(next.items.ash-start.items.ash)*3-seq.length*0.01;
    if(!next.hp)score-=1000;
    if(wantClasp){
      if(dead&&next.loot.id!=="clasp"||v.foe?.clasp==="已断")score-=600;
      if(next.foe?.clasp==="完整收好")score+=60;
    }
    if(score>best.score)best={score,seq};
    if(dead)return;
    for(const a of cards(state)){
      if(a.fx==="flare"&&state.contract==="ash"&&!state.fulfilled&&state.items.ash<=2)continue;
      assess(act(state,a.id),[...seq,a.id]);
    }
  }
  assess(s,[]);
  s=walk(s,best.seq);
  return s.phase==="fight"?checked(s,"end-turn"):s;
}
function fight(s){
  for(let turn=0;s.phase==="fight";turn++){assert(turn<24,"fight stalled");s=playRound(s)}
  return s;
}
function run(seed,order){
  let s=walk(create(seed),["order-"+order,"gear-"+(order==="ash"?"knife":"buckler")]);
  for(let step=0;s.phase!=="done";step++){
    assert(step<40);
    switch(s.phase){
      case "gather":s=checked(s,s.leg===1||s.hp>=18?"gather-ash":"rest");break;
      case "route":s=checked(s,order==="ash"?"hunt-moth":"hunt-rat");break;
      case "fight":s=fight(s);break;
      case "loot":
        if(available(s,"take-loot"))s=checked(s,"take-loot");
        while(available(s,"recover-ash"))s=checked(s,"recover-ash");
        s=checked(s,"onward");break;
      case "market":
        if(available(s,"early-order"))s=checked(s,"early-order");
        if(s.hp<=17&&available(s,"medicine"))s=checked(s,"medicine");
        s=checked(s,"leave-market");break;
      case "settle":s=checked(s,"commit");break;
      default:assert.fail(s.phase);
    }
  }
  assert.equal(act(s,"commit"),s);
  return s.receipt;
}
function exerciseHands(){
  let first,fullCombo;
  for(let i=1;i<=256&&!fullCombo;i++){
    const s=open(i),availableCards=cards(s);
    const trio=[0,1,2].map(cost=>availableCards.find(a=>a.cost===cost&&a.fx!=="flare"));
    if(trio.some(a=>!a))continue;
    const after0=checked(s,trio[0].id),after1=checked(after0,trio[1].id);
    const eligible=cards(after1).find(a=>a.id===trio[2].id);
    if(!eligible)continue;
    assert.equal(view(after0).cards.combo,1);assert.equal(view(after1).cards.combo,2);assert(eligible.combo);
    assert.equal(eligible.power,trio[2].power+2);
    const after2=checked(after1,eligible.id);
    if(after2.phase!=="fight")continue;
    assert.equal(view(after2).cards.combo,3);assert.equal(view(after2).cards.energy,0);
    assert.equal(s.hp,after2.hp);assert.equal(after2.foe.turn,0);
    assert.equal(act(after0,trio[0].id),after0);
    const disabled=view(after2).actions.find(a=>a.fx&&a.cost>0);
    if(disabled){assert(disabled.disabled);assert.equal(act(after2,disabled.id),after2)}
    const wrong=walk(s,[trio[1].id,trio[0].id]);assert(!cards(wrong).find(a=>a.id===trio[2].id).combo);
    const next=checked(after2,"end-turn");
    assert.equal(view(next).cards.energy,3);assert.equal(view(next).cards.handCount,4);
    assert.equal(view(next).cards.combo,0);assert.equal(next.foe.turn,1);
    assert.equal(act(next,trio[0].id),next);
    assert.deepEqual(act(JSON.parse(JSON.stringify(after2)),"end-turn"),next);
    fullCombo={seed:i,cards:trio.map(a=>a.label),bonus:eligible.power-trio[2].power};first=s;
  }
  assert(fullCombo);
  let s=first;
  const allHands=[];
  for(let i=0;i<4;i++){
    allHands.push([...s.cardFight.hand]);
    s=checked(s,"end-turn");
  }
  assert.equal(new Set([...allHands[0],...allHands[1]]).size,8);
  assert.equal(new Set([...allHands[2],...allHands[3]]).size,8);
  assert.deepEqual(first,open(fullCombo.seed));
  return fullCombo;
}
function exerciseTools(){
  let sample,prime;
  for(let i=1;i<=48&&!prime;i++){
    const base=open(i,"free","hook"),guard=cards(base).find(a=>a.fx==="guard");
    if(!guard)continue;
    const stop=checked(base,guard.id);assert(!stop.foe.primed);
    const guarded=checked(stop,"end-turn"),attack=cards(guarded).find(a=>a.fx==="strike");
    if(!attack)continue;
    assert(guarded.foe.primed);
    const core=checked(guarded,attack.id);
    assert.equal(core.items.ash,2);assert(!core.foe.core);
    prime=i;
  }
  assert(prime);
  let rat=open(1,"free","knife","rat");assert.equal(rat.items.ash,1);
  rat=checked(rat,"end-turn");assert.equal(rat.items.ash,0);assert.equal(rat.foe.theft,1);
  rat=fight(rat);assert.equal(rat.loot.stolen,1);
  rat=checked(rat,"recover-ash");assert.equal(rat.items.ash,1);assert.equal(act(rat,"recover-ash"),rat);
  let s=fight(open(1,"ash","knife"));assert.equal(s.loot.gear,"hook");
  s=walk(s,["take-gear","take-loot","onward"]);assert(s.cardFight.deck.includes("hook"));
  assert(!s.cardFight.deck.includes("knife"));s=fight(s);s=walk(s,["onward","early-order","buy-plate","leave-market","gather-ash","hunt-rat"]);
  assert.equal(s.cardFight.deck.length,9);assert(s.cardFight.deck.includes("plate"));
  for(let i=1;i<=64&&!sample;i++){
    let fox=fight(open(i,"clasp","plate","rat"));
    if(available(fox,"recover-ash"))fox=checked(fox,"recover-ash");
    fox=checked(fox,"onward");fox=checked(fox,"end-turn");
    const flare=cards(fox).find(a=>a.fx==="flare");
    if(!flare||!fox.items.ash)continue;
    assert.equal(view(fox).foe.intent,"飞扑");
    const before=fox.hp;fox=checked(fox,flare.id);assert(fox.cardFight.stopped);assert.equal(fox.foe.clasp,"挂在颈下");
    fox=checked(fox,"end-turn");assert.equal(fox.foe.clasp,"完整收好");assert.equal(fox.hp,before);sample=i;
  }
  assert(sample);
  const stopped=walk(open(1),["retreat","commit"]);assert.equal(stopped.receipt.reason,"提前回铺");
}
function exerciseFreight(){
  let s=fight(open(1,"clasp","buckler","rat"));
  if(available(s,"recover-ash"))s=checked(s,"recover-ash");
  s=checked(s,"onward");s=fight(s);
  s=walk(s,["take-loot","onward","early-order"]);
  assert(s.fulfilled);assert.equal(view(s).freightPrice,1);
  assert.match(view(s).description,/1 灰换 1 枚完扣/);
  s=walk(s,["buy-plate","leave-market","gather-ash","hunt-rat"]);
  assert.equal(view(s).foe.intent,"掀货筐");assert.equal(view(s).foe.damage,5);
  const snapshot=JSON.stringify(s);
  function firstTurn(block){
    const ready=JSON.parse(snapshot);ready.cardFight.block=block;
    return checked(ready,"end-turn");
  }
  const lost=firstTurn(4),safe=firstTurn(5);
  assert.equal(s.hp-lost.hp,1);assert.equal(s.hp,safe.hp);
  assert.equal(view(lost).freight,"lost");assert.equal(view(safe).freight,"safe");
  assert.notEqual(view(lost).foe.intent,"掀货筐");
  assert.equal(view(fight(lost)).freight,"lost");assert.equal(available(fight(lost),"trade-freight"),false);
  // Exercise each exact hand boundary before the bill falls due.
  for(const plate of [false,true]){
    const ready=JSON.parse(snapshot),c=ready.cardFight;
    ready.plate=plate;ready.items.ash=1;
    const dust=c.deck.indexOf("dust");
    if(!c.hand.includes(dust)){const i=c.draw.indexOf(dust);assert(i>=0);[c.hand[0],c.draw[i]]=[c.draw[i],c.hand[0]]}
    const flare=cards(ready).find(a=>a.label==="扬灰");
    const lit=checked(ready,flare.id);assert.equal(lit.items.ash,0);
    const resolved=checked(lit,"end-turn");
    assert.equal(view(resolved).freight,plate?"safe":"lost");
    assert.equal(ready.hp-resolved.hp,plate?0:5);
  }
  const quick=JSON.parse(snapshot);quick.foe.hp=1;
  const hit=cards(quick).find(a=>a.fx==="strike");
  assert(hit);const instant=checked(quick,hit.id);
  assert.equal(instant.phase,"loot");assert.equal(view(instant).freight,"safe");
  const lot=fight(safe);
  for(const [contract,price] of [["ash",3],["clasp",1],["free",3]]){
    const bag={...lot,contract,items:{ash:price,shell:5-price,clasp:0}};
    assert.equal(view(bag).used,5);assert.equal(view(bag).freightPrice,price);
    const denied={...bag,items:{...bag.items,ash:price-1}};
    assert.equal(act(denied,"trade-freight"),denied);
    const bought=checked(bag,"trade-freight");
    assert.equal(bought.items.ash,0);assert.equal(bought.items.clasp,1);
    assert.equal(view(bought).used,6-price);assert.equal(bought.cash,bag.cash);
    assert.equal(bought.freightPaid,price);assert.equal(bought.loot.freight,"traded");
    assert.deepEqual(checked(JSON.parse(JSON.stringify(bag)),"trade-freight"),bought);
    assert.equal(act(bought,"trade-freight"),bought);
    const gate=checked(bought,"onward");assert.equal(act(gate,"trade-freight"),gate);
    const books=walk(gate,["retreat","commit"]);
    assert.match(view(books).description,new RegExp("鼠洞用 "+price+" 灰"));
    assert.equal(books.sales,bag.sales+2*(5-price)+4);
  }
  const legacy=JSON.parse(snapshot);delete legacy.cardFight.freight;
  assert.notEqual(view(legacy).foe.intent,"掀货筐");
  assert.equal(view(fight(legacy)).freight,null);
  assert.equal(JSON.stringify(s),snapshot);
}
const combo=exerciseHands();exerciseTools();exerciseFreight();
const examples={},ranges={};
for(const order of ["ash","clasp"]){
  let min=Infinity,max=0;
  for(let seed=1;seed<=64;seed++){
    const r=run(seed,order);
    assert(r.fulfilled&&r.cleared===4&&r.hp>0,"seed "+seed+" "+order+" "+JSON.stringify(r));
    assert.equal(r.paid,order==="ash"?7:9);
    min=Math.min(min,r.turns);max=Math.max(max,r.turns);
    if(seed===1)examples[order]=r;
  }
  ranges[order]=[min,max];
}
console.log(JSON.stringify({journeys:128,combo,examples,ranges}));
