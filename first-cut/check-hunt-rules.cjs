"use strict";
const assert=require("node:assert/strict");
const rules=require("./hunt-rules.js");
const view=rules.view;
const legal=(s,id)=>view(s).actions.some(a=>a.id===id&&!a.disabled);
function step(s,id){
  const before=JSON.stringify(s);
  assert(legal(s,id),s.phase+" / "+id);
  const next=rules.act(s,id);
  assert.notEqual(next,s);
  assert.equal(JSON.stringify(s),before);
  const frame=view(next);
  assert(frame.cash>=0&&frame.hp>=0&&frame.hp<=frame.maxHp);
  assert(frame.used<=frame.capacity&&Object.values(frame.items).every(q=>q>=0));
  assert.equal(frame.cash,3+next.sales+next.fee-next.expenses);
  if(frame.phase!=="done")assert(frame.actions.some(a=>!a.disabled));
  return next;
}
const walk=(s,ids)=>ids.reduce(step,s);
function fight(s,style,counters={}){
  let guard=0;
  while(s.phase==="fight"){
    assert(++guard<16,"fight must progress");
    const f=view(s).foe;
    let move="strike";
    if(style==="clasp"){
      if(f.intent==="飞扑")move="guard";
      if(f.intent==="伸爪掏灰"&&s.items.ash)move="guard";
    }
    if(style==="lamp"){
      if(f.id==="moth"&&s.foe.core&&!s.foe.primed&&s.weapon==="hook"&&view(s).used<s.capacity)move="guard";
      if(f.intent==="飞扑"&&s.plate&&s.items.ash)move="flare";
    }
    counters[move]=(counters[move]||0)+1;
    s=step(s,move);
  }
  return s;
}
function run(seed,style){
  let s=rules.create(seed);
  const counters={},itemsTaken=[];
  const contract=style==="clasp"?"clasp":"ash",gear={rush:"knife",clasp:"buckler",lamp:"hook"}[style];
  s=walk(s,["order-"+contract,"gear-"+gear]);
  const premarket=[];
  for(let i=0;s.phase!=="done";i++){
    assert(i<55);
    switch(s.phase){
      case "gather":s=step(s,s.hp<s.maxHp-4?"rest":"gather-ash");break;
      case "route":s=step(s,style==="clasp"?"hunt-rat":"hunt-moth");break;
      case "fight":s=fight(s,style,counters);break;
      case "loot":
        if(legal(s,"take-loot")){itemsTaken.push(s.loot.id);s=step(s,"take-loot")}
        while(legal(s,"recover-ash"))s=step(s,"recover-ash");
        s=step(s,"onward");break;
      case "market":
        premarket.push({cash:s.cash,hp:s.hp,items:{...s.items}});
        if(legal(s,"early-order"))s=step(s,"early-order");
        if(style==="lamp"&&legal(s,"buy-plate"))s=step(s,"buy-plate");
        if(s.hp<=14&&legal(s,"medicine"))s=step(s,"medicine");
        s=step(s,"leave-market");break;
      case "settle":s=step(s,"commit");break;
      default:assert.fail(s.phase);
    }
  }
  assert.equal(rules.act(s,"commit"),s);
  return {...s.receipt,actions:counters,premarket,itemsTaken};
}
function regression(){
  let s=walk(rules.create(1),["order-ash","gear-hook","gather-ash"]);
  assert.equal(rules.act(s,"order-clasp"),s,"contracts lock");
  assert.equal(rules.act(s,"gather-ash"),s,"cannot farm a lamp");
  s=walk(s,["hunt-moth","guard","strike"]);
  assert.equal(s.items.ash,2);
  s=walk(s,["guard","strike"]);
  assert.equal(s.items.ash,2,"each moth has only one core");
  s=step(s,"take-loot");assert.equal(rules.act(s,"take-loot"),s);
  s=step(s,"onward");s=fight(s,"rush");s=step(s,"onward");
  s=step(s,"early-order");assert.equal(rules.act(s,"early-order"),s);
  assert.equal(s.fee,7);
  s=step(s,"buy-plate");assert.equal(rules.act(s,"buy-plate"),s);
  const end=walk(s,["retreat","commit"]);assert.equal(end.receipt.standing,"ash");
  assert.equal(rules.create(2,"ash").stock,1);
  assert.equal(rules.create(2,"clasp").stock,0);
  const baseline=walk(rules.create(2,"clasp"),["order-ash","gear-knife","rest","retreat","commit"]);
  assert.equal(baseline.receipt.paid,0);assert.equal(baseline.receipt.standing,"clasp");
  let loss=walk(rules.create(1),["order-clasp","gear-knife","gather-ash","hunt-moth"]);
  while(loss.phase==="fight")loss=step(loss,"guard");
  assert.equal(loss.hp,0);assert.equal(loss.phase,"settle");assert(step(loss,"commit").receipt);
  let swap=walk(rules.create(1),["order-free","gear-knife","gather-ash","hunt-moth","strike","strike"]);
  const offer=view(swap).offer;assert.equal(offer.id,"hook");
  swap=step(swap,"take-gear");assert.equal(swap.weapon,"hook");assert.equal(rules.act(swap,"take-gear"),swap);

  let full=walk(rules.create(1),["order-free","gear-hook","gather-ash","hunt-moth","guard","strike","strike","take-loot","onward"]);
  full=fight(full,"rush");
  full=walk(full,["take-loot","onward","sell-shell","buy-ash","leave-market","gather-ash","hunt-moth"]);
  assert.equal(view(full).used,view(full).capacity);
  full=walk(full,["guard","strike"]);assert(full.foe.core,"a full bag must not destroy an uncollected core");
  full=fight(full,"rush");assert(!legal(full,"take-loot"));full=step(full,"onward");
  assert.equal(full.leg,3);assert.equal(full.phase,"fight");assert.equal(view(full).used,5);
  assert.equal(walk(full,["retreat","commit"]).receipt.reason,"提前回铺");

  let chipped=walk(rules.create(1),["order-clasp","gear-knife","gather-ash","hunt-moth","strike","strike","take-loot","onward"]);
  assert.equal(chipped.foe.clasp,"缺了一角");chipped=walk(chipped,["strike","guard","strike","take-loot","onward"]);
  assert(!legal(chipped,"early-order"),"the lantern rack cannot supply a whole clasp at the bridge");
  let lamp=walk(rules.create(1),["order-clasp","gear-plate","gather-ash","hunt-rat","guard","strike","strike","take-loot","onward"]);
  lamp=walk(lamp,["strike","flare"]);assert.equal(lamp.foe.clasp,"完整收好");
  lamp=walk(lamp,["strike","take-loot","onward","early-order","leave-market","gather-ash","hunt-moth"]);
  lamp=fight(lamp,"rush");lamp=walk(lamp,["onward","strike","flare"]);
  assert.equal(lamp.foe.clasp,"完整收好");assert.equal(lamp.ashBurned,2);

  let lastLamp=walk(rules.create(1),["order-free","gear-hook","gather-ash","hunt-moth","flare"]);
  assert.equal(lastLamp.items.ash,0);assert.equal(rules.act(lastLamp,"flare"),lastLamp);
  lastLamp=step(lastLamp,"guard");
  assert(lastLamp.foe.primed);
}
regression();
const strategies=["rush","clasp","lamp"];
const examples=Object.fromEntries(strategies.map(id=>[id,run(1,id)]));
for(let seed=1;seed<=64;seed++){
  for(const id of strategies){const r=run(seed,id);assert(r.cleared===4&&r.hp>0&&r.fulfilled,"seed "+seed+" "+id+" "+JSON.stringify(r))}
}
for(const first of Object.values(examples)){
  for(const other of Object.values(examples)){
    if(first!==other)assert(!(other.hp>=first.hp&&other.cash>=first.cash),"one example dominates another");
  }
}
console.log(JSON.stringify(examples,null,2));
