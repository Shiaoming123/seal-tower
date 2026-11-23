/* Run from any directory with node first-cut/economy-balance.cjs. */
"use strict";
const assert = require("node:assert/strict");
const Tower = require("../game.js");

function step(s,id) {
  const next = Tower.act(s,id);
  assert.notEqual(next,s,`rejected ${id} in ${s.phase}, seed ${s.seed}`);
  assert.ok(next.hp >= 0 && next.hp <= next.maxHp && next.gold >= 0);
  assert.ok(next.trial.relics.length <= next.trial.relicLimit);
  assert.ok(next.trial.consumables.length <= next.trial.packLimit);
  return next;
}
const walk = (s,ids) => ids.reduce(step,s);
function stall(seed) {
  return walk(Tower.start(seed,{marketTrial:true}),["sword","strike","strike","take","guide"]);
}
const deny = (s,id) => assert.equal(Tower.act(s,id),s,`unexpected ${id}`);
const options = s => Tower.view(s).actions;
function fight(s) {
  let turns = 0;
  assert.equal(s.phase,"fight");
  while (s.phase === "fight") {
    s = step(s,"strike");
    assert.ok(++turns<12);
  }
  return s;
}
function finishGate(s) {
  s = fight(step(s,"gate"));
  assert.equal(s.phase,"shop");
  if (s.seals.length) {
    deny(s,"settle");
    assert.equal(Tower.view(s).offers[0].price,7);
    s = step(s,"sell-1");
    deny(s,"sell-1");
  }
  return step(s,"settle");
}
const original = stall(1), snapshot = JSON.stringify(original);
const offers = Tower.view(original).stock;
assert.deepEqual(offers.map(i=>i.id),["grit","salve","mirror","fang","hook","ward-blade","knot","abacus","silk","lining"]);
assert.ok(offers.every(i=>i.slot && i.type && i.duration && i.effect));
const held = step(original,"keep");
deny(held,"sell-1");
assert.deepEqual(held.seals,original.seals);
const sold = step(original,"sell-1");
deny(sold,"sell-1");
assert.equal(sold.gold,7);
assert.equal(original.gold,3);
assert.equal(Tower.view(sold).stock.find(i=>i.id==="mirror").actions[0].reason,"法宝栏已满");
deny(sold,"buy-mirror");
deny({...sold,gold:0},"barter-mirror");
const swapped = step(sold,"barter-mirror");
assert.deepEqual(swapped.trial.relics,["mirror"]);
assert.equal(swapped.gold,6);
deny(swapped,"barter-mirror");
deny(swapped,"barter-fang");
assert.equal(Tower.view(swapped).side.toll,Tower.view(sold).side.toll+1);
const blood = (() => {
  const injured = step(held,"detour-wound");
  deny(injured,"detour-ink");
  const side = Tower.view(held).side;
  deny({...injured,hp:side.toll},"scavenge");
  const next = step(injured,"scavenge");
  assert.equal(next.hp,held.hp-side.toll);
  assert.equal(next.gold,held.gold+side.coins);
  assert.equal(next.phase,"blood");
  return next;
})();
deny({...blood,hp:4},"blood-coins");
const signed = step(blood,"blood-coins");
assert.equal(signed.hp,blood.hp-4);
assert.equal(signed.gold,blood.gold+3);
assert.equal(signed.maxHp,24);
for (const id of ["blood-coins","blood-slot","detour","detour-wound","detour-ink","sell-1"]) deny(signed,id);
const secondSlot = step({...blood,hp:23},"blood-slot");
assert.equal(secondSlot.maxHp,20);
assert.equal(secondSlot.hp,20);
const belowCap = step({...blood,hp:9},"blood-slot");
assert.equal(belowCap.hp,9);
assert.equal(belowCap.trial.relicLimit,2);
const both = walk({...secondSlot,gold:10},["buy-mirror","barter-fang"]);
assert.deepEqual(both.trial.relics,["mirror","fang"]);
assert.equal(both.gold,4);
assert.equal(Tower.view(both).profile.swordDamage,7);
const dualFight = step(both,"gate");
assert.equal(dualFight.trial.mirrorReady,true);
let combat = dualFight;
while (combat.trial.mirrorReady && combat.phase==="fight") {
  const before = combat;
  combat = step(combat,"strike");
  const prevented = combat.trial.lastPrevented;
  if (prevented) {
    assert.equal(prevented,Math.min(4,Tower.view(before).combat.now));
    assert.equal(before.hp-combat.hp,combat.trial.lastHit);
  }
}
assert.equal(combat.trial.mirrorReady,false);
combat = step(combat,"strike");
assert.equal(combat.trial.lastPrevented,0);
const salved = step(sold,"salve");
assert.deepEqual(salved.trial.consumables,["salve"]);
deny(salved,"salve");
let clawTurn = step(salved,"gate");
while (Tower.view(clawTurn).combat.now!==3) clawTurn = step(clawTurn,"guard");
const hurt = step({...clawTurn,hp:12},"strike");
assert.equal(hurt.trial.lastHit,3);
assert.equal(hurt.trial.lastHeal,6);
assert.equal(hurt.hp,15);
assert.deepEqual(hurt.trial.consumables,[]);
const fallen = step({...clawTurn,hp:1},"strike");
assert.equal(fallen.phase,"lost");
assert.equal(fallen.trial.lastHeal,0);
assert.equal(fallen.hp,0);
const noTrigger = step({...clawTurn,hp:12},"guard");
assert.equal(noTrigger.trial.lastHeal,0);
assert.deepEqual(noTrigger.trial.consumables,["salve"]);
const grit = step(sold,"grit");
assert.equal(Tower.view(grit).profile.swordDamage,6);
const inDen = step(grit,"detour-ink");
assert.equal(Tower.view(inDen).enemy.name,"墨蠹");
assert.equal(Tower.view(inDen).combat.swordDamage,6);
const postMite = fight(inDen);
assert.equal(postMite.phase,"blood");
assert.equal(postMite.gold,grit.gold+3);
assert.equal(postMite.trial.gateStrikes,0);
const inGate = walk(postMite,["skip-blood","gate"]);
assert.equal(Tower.view(inGate).combat.swordDamage,10);
const clear = fight(inGate);
assert.equal(clear.trial.gritActive,false);
assert.equal(Tower.view(clear).profile.swordDamage,6);
assert.equal(JSON.stringify(original),snapshot);
assert.deepEqual(original,stall(1));
console.log("PASS explicit 4/7 disposition, slot limits, payment atomicity, insured original, barter removal, two relics, life costs/clamping, damage/healing order, replenishment bounds, side-fight accounting, reusable quote snapshot.");

const plans = {
  "现卖带钱": s=>step(s,"sell-1"),
  "现卖磨剑": s=>walk(s,["sell-1","grit"]),
  "留印直过": s=>step(s,"keep"),
  "留印换牙": s=>walk(s,["keep","barter-fang"]),
  "留印换膏": s=>walk(s,["keep","salve"]),
  "棘钱换血再磨剑": s=>walk(s,["keep","detour-wound","scavenge","blood-coins","grit"]),
  "侧战开栏双法宝": s=>walk(fight(walk(s,["keep","barter-mirror","detour-ink"])),["blood-slot","buy-fang"]),
};
const results = {};
for (const [name,prepare] of Object.entries(plans)) {
  const samples = [];
  for (let seed=0;seed<256;seed++) {
    const s = finishGate(prepare(stall(seed)));
    assert.equal(s.phase,"won");
    samples.push([s.hp,s.maxHp,s.gold,s.trial.gateTurns]);
  }
  const ranges = [0,1,2,3].map(i=>{
    const data = samples.map(row=>row[i]);
    const avg = Number((data.reduce((sum,v)=>sum+v,0)/data.length).toFixed(2));
    return {min:Math.min(...data),max:Math.max(...data),avg};
  });
  results[name] = {seed1:samples[1],ranges};
}
assert.deepEqual(results["现卖磨剑"].seed1,[22,24,3,2]);
assert.deepEqual(results["留印直过"].seed1,[11,24,10,4]);
for (const [name,{seed1,ranges}] of Object.entries(results)) {
  console.log(name, "seed1 [血/上限/石/守关手数]",seed1.join("/"),"256签平均",ranges.map(r=>r.avg).join("/"),"各签血量",ranges[0].min+"–"+ranges[0].max);
}

// Match equipment, cargo geometry, pending loot and order redemption to the same state.
function bag(s) { return Tower.view(s).profile.bag; }
function arrange(s,op) {
  assert.ok(Tower.canArrange(s,op),JSON.stringify(op));
  const next=Tower.arrange(s,op);
  assert.notEqual(next,s);
  const placed=new Set();
  for (const item of bag(next).items) for (const [dx,dy] of item.cells) {
    const x=item.x+dx,y=item.y+dy,key=x+","+y;
    assert.ok(x>=0 && x<bag(next).width && y>=0 && y<bag(next).height && !placed.has(key));
    placed.add(key);
  }
  return next;
}
function cannotArrange(s,op) {
  assert.equal(Tower.canArrange(s,op),false);
  assert.equal(Tower.arrange(s,op),s);
}
const withBlade=step(sold,"buy-ward-blade");
assert.equal(withBlade.gold,2);
assert.equal(Tower.view(withBlade).profile.weapon.id,"ward-blade");
assert.equal(Tower.view(withBlade).profile.block,6);
const packed=arrange(withBlade,{action:"stow",id:"bell"});
const firstSword=bag(packed).items.find(i=>i.id==="sword");
assert.equal(firstSword.cells.length,3);
cannotArrange(packed,{action:"move",id:"sword",x:-1,y:0});
cannotArrange(packed,{action:"move",id:"sword",x:1,y:0});
assert.equal(packed.trial.relics.length,0);
let rotated=arrange(packed,{action:"rotate",id:"sword"});
assert.equal(bag(rotated).items.find(i=>i.id==="sword").rotation,1);
rotated=arrange(rotated,{action:"move",id:"sword",x:1,y:0});
rotated=arrange(rotated,{action:"equip",id:"sword"});
assert.equal(rotated.trial.weapon,"sword");
assert.ok(bag(rotated).items.some(i=>i.id==="ward-blade" && i.cells.length===3));
rotated=arrange(rotated,{action:"equip",id:"bell"});
assert.equal(rotated.trial.relics.length,1);
cannotArrange(step(rotated,"gate"),{action:"stow",id:"bell"});
const combo = s=>walk(s,["keep","buy-knot","detour-wound","scavenge","blood-coins","buy-hook"]);
const primed=combo(original);
assert.equal(primed.trial.bloodCharge,2);
assert.equal(primed.trial.weapon,"hook");
assert.equal(primed.trial.accessory,"knot");
const unprimed=arrange(primed,{action:"stow",id:"knot"});
assert.equal(Tower.view(step(unprimed,"gate")).combat.swordDamage,5);
const active=step(primed,"gate");
assert.equal(Tower.view(active).combat.swordDamage,11);
const drained=step(active,"strike");
assert.equal(drained.trial.lastBloodDamage,6);
assert.equal(drained.trial.lastDrainHeal,2);
assert.equal(drained.foeHp,8);
assert.equal(drained.hp,active.hp+2);
const chargedWin=step(drained,"strike");
assert.equal(chargedWin.phase,"shop");
assert.equal(chargedWin.hp,active.hp+4);
assert.ok(bag(chargedWin).items.some(i=>i.id==="fox-clasp"));
const manualSale=step(chargedWin,"sell-1");
const claspSale=step(manualSale,"vend-fox-clasp");
assert.equal(claspSale.gold,manualSale.gold+3);
assert.ok(!bag(claspSale).items.some(i=>i.id==="fox-clasp"));
deny(claspSale,"vend-fox-clasp");
deny(chargedWin,"order-purse");
let signedPurse=step(claspSale,"order-purse");
assert.equal(signedPurse.gold,claspSale.gold-4);
deny(signedPurse,"order-hook");
signedPurse=step(signedPurse,"settle");
const inherited=Tower.nextRun(signedPurse,"new"),filedHook=step(step(claspSale,"order-hook"),"settle");
assert.equal(inherited.gold,6);
assert.equal(inherited.trial.order,"");
assert.equal(Tower.nextRun(Tower.nextRun(filedHook)).trial.weapon,"sword");
assert.equal(Tower.nextRun(filedHook).trial.weapon,"hook");
assert.equal(Tower.nextRun(filedHook).trial.cargo[0].id,"sword");
assert.equal(Tower.nextRun(step(claspSale,"settle")).gold,3);
const shelled=walk(postMite,["skip-blood"]);
const soldShell=step(shelled,"vend-ink-shell");
assert.equal(soldShell.gold,shelled.gold+2);
deny(soldShell,"vend-ink-shell");
assert.equal(JSON.stringify(original),snapshot);
// A valid full grid before the blood event, with the original seal and no previously collected monster material.
const crowded={...held,gold:7,trial:{...held.trial,weapon:"sword",relics:[],
  stockTaken:["ward-blade","knot","mirror","fang","salve"],
  cargo:[{id:"ward-blade",x:0,y:0,rotation:0},{id:"knot",x:2,y:0,rotation:0},
    {id:"mirror",x:0,y:1,rotation:0},{id:"fang",x:1,y:1,rotation:0},
    {id:"bell",x:1,y:2,rotation:0},{id:"salve",x:2,y:2,rotation:0},{id:"seal",x:3,y:2,rotation:0}]}};
for(const piece of bag(crowded).items) assert.equal(piece.cells.length,piece.shape.length);
const occupiedCells=bag(crowded).items.flatMap(i=>i.cells.map(([x,y])=>[x+i.x,y+i.y].join(",")));
assert.equal(new Set(occupiedCells).size,12);
assert.equal(Tower.view(crowded).stock.find(i=>i.id==="hook").actions[0].reason,"行囊放不下旧兵，请先整包");
deny(crowded,"buy-hook");
const pendingState={...blood,trial:{...crowded.trial,pending:["fox-clasp"]}};
cannotArrange(pendingState,{action:"collect",id:"fox-clasp"});
deny(pendingState,"blood-coins");
const abandoned=arrange(pendingState,{action:"discard",id:"fox-clasp"});
assert.equal(abandoned.trial.pending.length,0);
step(abandoned,"blood-coins");
const unpacked=arrange(pendingState,{action:"equip",id:"mirror"});
const retrieved=arrange(unpacked,{action:"collect",id:"fox-clasp"});
assert.equal(retrieved.trial.pending.length,0);
assert.ok(retrieved.trial.cargo.some(i=>i.id==="fox-clasp"));
console.log("PASS true grid rotation, swaps and packing, full bag sale rejection, waiting loot, fixed material prices, order-only rollover and blood build strike/heal.");

function fourStyles(seed,name) {
  const counterStyle = name.includes("守势");
  let s=stall(seed);
  if (name==="佩钩放血") s=combo(s);
  else if (name==="单佩放血") s=walk(s,["keep","buy-knot","detour-wound","scavenge","blood-coins"]);
  else if (name==="单钩直斩") s=walk(s,["sell-1","buy-hook"]);
  else if (name==="阙剑守势") s=walk(s,["sell-1","buy-ward-blade"]);
  else s=step(s,"sell-1");
  s=step(s,"gate");
  while (s.phase==="fight") {
    const v=Tower.view(s),worthy=counterStyle && v.combat.now>=6 && s.foeHp>v.combat.swordDamage;
    s=step(s,worthy?"guard":"strike");
    assert.ok(s.turn<10 && s.hp>0);
  }
  if (s.seals.length) s=step(s,"sell-1");
  return step(s,"settle");
}
for (const name of ["佩钩放血","单佩放血","单钩直斩","阙剑守势","旧剑守势"]) {
  const runs=Array.from({length:256},(_,seed)=>fourStyles(seed,name));
  const avg=key=>(runs.reduce((total,s)=>total+key(s),0)/runs.length).toFixed(2);
  const one=runs[1];
  console.log(name,"seed1 血/上限/石/守关手数", [one.hp,one.maxHp,one.gold,one.trial.gateTurns].join("/"),
    "256签平均 血/石/手数", [avg(s=>s.hp),avg(s=>s.gold),avg(s=>s.trial.gateTurns)].join("/"));
}

const enroute=fight(step(crowded,"detour-ink"));
assert.deepEqual(bag(enroute).pending.map(p=>p.id),["ink-shell"]);
assert.equal(enroute.gold,crowded.gold+3);
deny(enroute,"skip-blood");
const escaped=step(arrange(enroute,{action:"discard",id:"ink-shell"}),"skip-blood");
const delayedClasp=fight(step(escaped,"gate"));
assert.deepEqual(bag(delayedClasp).pending.map(p=>p.id),["fox-clasp"]);
deny(delayedClasp,"settle");
const unpackedClasp=arrange(delayedClasp,{action:"equip",id:"mirror"});
const soldClasp=step(arrange(unpackedClasp,{action:"collect",id:"fox-clasp"}),"vend-fox-clasp");
assert.equal(soldClasp.gold,delayedClasp.gold+3);
step(step(soldClasp,"sell-1"),"settle");
for (const id of ["bogus","__proto__",5,null]) assert.deepEqual(Tower.redeemOrder(id,"1"),Tower.start("1",{marketTrial:true}));
assert.deepEqual(Tower.redeemOrder("order-hook","counterfoil"),Tower.nextRun(filedHook,"counterfoil"));
assert.equal(Tower.view(chargedWin).profile.bloodDamageTotal,12);
assert.equal(Tower.view(chargedWin).profile.drainHealTotal,4);
console.log("PASS full-pack real battles retain the actual drop until collection/discard, order redemption whitelist, blood damage and healing tallies.");
