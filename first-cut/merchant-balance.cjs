/* Paired normal-action runs. An optional --out FILE records per-seed results. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Tower=require("../game.js");
const view=Tower.view;
const bag=s=>view(s).profile.bag;

function step(s,command){
  const n=Tower.act(s,command);
  assert.notEqual(n,s,"blocked "+(command.id||command)+" at "+s.phase+", seed "+s.seed);
  assert(n.gold>=0 && n.hp>=0 && n.hp<=n.maxHp);
  return n;
}
function arrange(s,op){
  const n=Tower.arrange(s,op);assert.notEqual(n,s,JSON.stringify(op));return n;
}
function buy(s,id,qty=1,instanceId){
  const q=Tower.quoteTrade(s,{id,qty,instanceId});
  assert(q && !q.disabled,q?.reason||id);
  const n=step(s,q);assert.equal(n.gold,q.balanceAfter);
  assert.equal(Tower.act(n,q),n,"old quote was accepted twice");
  return n;
}
const walk=(s,commands)=>commands.reduce(step,s);
function atStall(seed,withAsh=false){
  return walk(Tower.start(seed,{marketTrial:true}),["sword","strike","strike",withAsh?"take-ash":"take","guide"]);
}
function combat(s){
  assert.equal(s.phase,"fight");
  let n=0;
  while(s.phase==="fight"){
    s=step(s,"strike");assert(++n<=12);
  }
  return s;
}
function sellAll(s,id){
  for(;;){
    const item=view(s).stock.find(lot=>lot.id===id);
    if(!item?.sellStacks?.length)return s;
    const p=item.sellStacks[0];
    s=buy(s,item.actions[0].id,p.qty,p.instanceId);
  }
}
function capture(s){
  const ledger=view(s).market.ledger;
  return {won:s.phase==="won",hp:s.hp,gold:s.gold,turns:s.trial.gateTurns,
    gateNetHpLoss:s.trial.gateEntryHp-s.hp,gateDamageTaken:s.trial.gateDamageTaken,gateRecovered:s.trial.gateRecovered,ashSold:ledger.ashSold,silkProfit:ledger.silkProfit,
    discarded:s.trial.discarded,lining:s.trial.liningBought};
}
function tradeRoute(seed,qty){
  let s=walk(atStall(seed),["sell-1","barter-abacus"]);
  if(qty)s=buy(s,"buy-silk",qty);
  const gold=s.gold,price=view(s).market.silkPrice;
  assert.equal(gold,7-2*qty);
  s=step(s,"gate");
  assert.equal(s.trial.abacusEntryGold,gold);
  const first=view(s).combat.swordDamage;
  assert.equal(first,6+Math.min(2,Math.floor(gold/4)));
  s=step(s,"strike");
  assert.equal(s.trial.lastAbacusDamage,first-6);assert.equal(s.foeHp,19-first);
  assert.equal(view(s).combat.abacusBonus,0);
  s=combat(s);assert.equal(s.phase,"shop");
  assert.equal(s.trial.gateStrikes,qty===2?4:3);
  s=sellAll(s,"silk");assert.equal(s.gold,gold+qty*price);
  const ledger=view(s).market.ledger;
  assert.equal(ledger.silkBought,qty);assert.equal(ledger.silkSold,qty);assert.equal(ledger.silkProfit,qty ? qty*(price-2) : 0);
  return {...capture(step(s,"settle")),first,entryGold:gold,hot:price===4};
}
function reachCache(seed,expanded,weapon="hook"){
  let s=walk(atStall(seed,true),["sell-1","vend-ash"]);
  if(weapon)s=step(s,"buy-"+weapon);
  if(expanded){
    const original=s.trial.cargo;
    s=step(s,"buy-lining");
    assert.deepEqual(s.trial.cargo,original);assert.equal(bag(s).height,4);
    assert.equal(Tower.act(s,"buy-lining"),s);
  }
  s=step(s,"detour-haul");
  return combat(s);
}
function haulRoute(seed,expanded){
  let s=reachCache(seed,expanded);assert.equal(s.phase,"blood");
  const before=bag(s);
  assert.equal(before.items.reduce((a,p)=>a+p.cells.length,0),expanded?16:12);
  assert.equal(new Set([...before.items,...before.pending].map(p=>p.instanceId)).size,before.items.length+before.pending.length);
  const pending=before.pending.map(p=>[p.id,p.qty]);
  assert.deepEqual(pending,expanded?[]:[["ink-shell",1],["ash",3]]);
  if(pending.length)assert.equal(Tower.act(s,"skip-blood"),s);
  for(const p of before.pending)s=arrange(s,{action:"discard",id:p.id,instanceId:p.instanceId});
  s=step(s,"skip-blood");const gateHp=s.hp;
  s=sellAll(sellAll(s,"ink-shell"),"ash");
  assert.equal(s.gold,expanded?18:16);
  s=combat(step(s,"gate"));
  if(s.phase==="shop")s=step(s,"settle");
  return {...capture(s),gateHp,freightSale:expanded?18:13};
}
function originalRoute(seed,kind){
  let s=atStall(seed);
  if(kind==="grit")s=walk(s,["sell-1","grit"]);
  else s=walk(s,["keep","buy-knot","detour-wound","scavenge","blood-coins","buy-hook"]);
  s=combat(step(s,"gate"));
  if(s.phase==="shop"){
    if(s.seals.length)s=step(s,"sell-1");
    s=step(s,"settle");
  }
  return capture(s);
}

const normal=atStall(1,true),sold=step(normal,"sell-1");
assert.equal(view(sold).market.silkPrice,4);
assert.equal(view(atStall(2)).market.silkPrice,1);
const bad=Tower.quoteTrade(sold,{id:"buy-silk",qty:3});
assert(bad.disabled);assert.equal(Tower.act(sold,bad),sold);
const quote=Tower.quoteTrade(sold,{id:"buy-silk",qty:2}),snap=JSON.stringify(sold);
assert.equal(Tower.act(sold,{...quote}),sold,"unbound quote accepted");
assert.equal(JSON.stringify(sold),snap);
const changed=buy(sold,"barter-abacus");
assert.equal(Tower.act(changed,quote),changed,"pre-barter quote accepted");
const stocked=buy(changed,"buy-silk",2),silk=bag(stocked).items.find(p=>p.id==="silk");
assert.equal(silk.qty,2);assert.equal(silk.cells.length,2);
assert.equal(Tower.act(stocked,"buy-silk"),stocked);
const divided=arrange(stocked,{action:"split",id:"silk",instanceId:silk.instanceId,qty:1});
const pieces=bag(divided).items.filter(p=>p.id==="silk");
assert.equal(pieces.length,2);assert.notEqual(pieces[0].instanceId,pieces[1].instanceId);
assert.equal(Tower.canArrange(divided,{action:"move",id:"silk",x:0,y:1}),false);
assert.equal(Tower.canArrange(stocked,{action:"split",id:"silk",instanceId:silk.instanceId,qty:2}),false);
const gate=step(divided,"gate"),guarded=step(gate,"guard");
assert.equal(guarded.trial.abacusReady,gate.trial.abacusReady,"guard spent first hit");
let end=combat(guarded);
if(end.phase==="shop"){
  const one=buy(end,"vend-silk",1,pieces[1].instanceId);
  assert(bag(one).items.some(p=>p.instanceId===pieces[0].instanceId));
  assert(!bag(one).items.some(p=>p.instanceId===pieces[1].instanceId));
  assert(Tower.quoteTrade(one,{id:"vend-silk",qty:1,instanceId:pieces[1].instanceId}).disabled);
}
const full=reachCache(1,false),dropped=bag(full).pending.find(p=>p.id==="ash");
const shell=bag(full).items.find(p=>p.id==="ink-shell"),opened=arrange(full,{action:"set-aside",id:shell.id,instanceId:shell.instanceId});
const savedAsh=arrange(opened,{action:"collect",id:dropped.id,instanceId:dropped.instanceId});
assert.equal(bag(savedAsh).items.filter(p=>p.id==="ash").reduce((sum,p)=>sum+p.qty,0),12);
assert(bag(savedAsh).pending.some(p=>p.instanceId===shell.instanceId));
const source=buy(atStall(1),"buy-lining"),fresh=Tower.nextRun(source,2);
assert.equal(bag(fresh).height,3);assert.equal(fresh.gold,3);assert.equal(view(fresh).market.ledger.trades.length,0);
// An initial 2-unit purchase and two single-unit purchases must lead to the same cash and same first stack.
const each=buy(buy(changed,"buy-silk"),"buy-silk");
assert.equal(each.gold,stocked.gold);assert.deepEqual(bag(each).items,bag(stocked).items);
for(const gold of [0,3,4,7,8,12]){
  const s=step({...changed,gold},"gate");
  assert.equal(s.trial.abacusReady,Math.min(2,Math.floor(gold/4)));
  const parry=step(s,"guard");assert.equal(parry.trial.abacusReady,s.trial.abacusReady);
  const hit=step(parry,"strike");assert.equal(hit.trial.lastAbacusDamage,s.trial.abacusReady);
  assert.equal(hit.trial.abacusReady,0);
}
const records={};
const strategies={hold:s=>tradeRoute(s,0),one:s=>tradeRoute(s,1),two:s=>tradeRoute(s,2),
  bag12:s=>haulRoute(s,false),bag16:s=>haulRoute(s,true),grit:s=>originalRoute(s,"grit"),blood:s=>originalRoute(s,"blood")};
for(const [strategy,play] of Object.entries(strategies)){
  const runs=[];
  for(let seed=1;seed<=256;seed++)runs.push({seed,...play(seed)});
  records[strategy]=runs;
  const wins=runs.filter(r=>r.won).length,avg=k=>(runs.reduce((sum,r)=>sum+r[k],0)/runs.length).toFixed(2);
  console.log(strategy,"wins",wins+"/256","mean gold/HP/gate turns",avg("gold"),avg("hp"),avg("turns"),"seed1",JSON.stringify(runs[0]));
}
assert.deepEqual([records.hold[0],records.one[0],records.two[0]].map(r=>[r.entryGold,r.turns,r.silkProfit]),[[7,3,0],[5,3,2],[3,4,4]]);
assert.equal(records.two[1].silkProfit,-2);
// Packing cheaply is a competing strategy: lift a bulky shell so the player can elect
// to keep a denser stack of ash. Compare the same market both with and without a spare blade.
function freightControl(weapon,lined){
  let s=reachCache(1,lined,weapon);
  if(bag(s).pending.some(p=>p.id==="ash")){
    const shell=bag(s).items.find(p=>p.id==="ink-shell");
    s=arrange(s,{action:"set-aside",id:shell.id,instanceId:shell.instanceId});
    for(const ash of bag(s).pending.filter(p=>p.id==="ash")){
      s=arrange(s,{action:"collect",id:ash.id,instanceId:ash.instanceId});
    }
  }
  for(const p of bag(s).pending)s=arrange(s,{action:"discard",id:p.id,instanceId:p.instanceId});
  s=step(s,"skip-blood");
  const cashBeforeSales=s.gold,entryHp=s.hp;
  s=sellAll(sellAll(s,"ash"),"ink-shell");
  return {weapon:weapon||"sword",lined,entryHp,cashBeforeSales,sales:s.gold-cashBeforeSales,exitGold:s.gold};
}
const freightControls=[
  freightControl("ward-blade",false),freightControl("ward-blade",true),
  freightControl("",false),freightControl("",true)
];
assert.deepEqual(freightControls.map(r=>r.exitGold),[17,18,24,23]);
console.log("Freight same-seed cash after selling: guarded spare 17/18, starter's light load 24/23 (12/16 cells).");
// Same tower sign, real combat actions and the price offered for actual drops.
for(let seed=1;seed<=256;seed++){
  let safe=step(Tower.start(seed,{marketTrial:true}),"sword");
  while(view(safe).combat.now>view(safe).profile.block)safe=step(safe,"guard");
  safe=step(safe,"guard");safe=step(safe,"guard");
  safe=walk(combat(safe),["take-ash","guide"]);
  assert.equal(bag(safe).items.find(p=>p.id==="ash").qty,2);
  let fox=walk(atStall(seed),["sell-1","gate"]);
  const rushed=combat(fox);
  assert.equal(view(rushed).stock.find(p=>p.id==="fox-clasp").price,3);
  while(!view(fox).combat.heavy)fox=step(fox,"guard");
  fox=combat(step(fox,"guard"));
  const silver=fox.gold;
  fox=sellAll(fox,"fox-clasp");assert.equal(fox.gold,silver+5);
  if(seed===1)console.log("Seed 1: guard and gather 2 ash; guarded fox sold for +5; direct finish +3.");
}
const flag=process.argv.indexOf("--out");
if(flag>=0){
  const file=process.argv[flag+1];if(!file)throw Error("--out requires a JSON filename");
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({seeds:256,records,freightControls},null,2)+"\n");
}
console.log("PASS paired market quotes, guarded first hit, 4/7 seal, cash-flow limits, partial sales, stacking, full-bag choice and real 12/16 freight.");
