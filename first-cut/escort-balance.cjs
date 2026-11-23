/* Independent gate, cash-flow and inventory checks for the four-leg escort. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Tower=require("../game");
const ev=Tower.escortView;
const action=(s,id)=>{
  const n=Tower.act(s,id);assert.notEqual(n,s,"rejected market action "+id);return n;
};
const run=(s,ids)=>ids.reduce(action,s);
const pack=s=>Tower.view(s).profile.bag;
const amount=(s,id)=>pack(s).items.filter(p=>p.id===id).reduce((n,p)=>n+p.qty,0);
function input(s,id,extra={}){
  const v=ev(s),q=v.options.find(o=>o.id===id);
  assert(q&&!q.disabled,`${v.stage}/${v.leg}/${v.marker}: ${id} ${q?.reason||"absent"}`);
  const n=Tower.escortAct(s,{...q,...extra});
  assert.notEqual(n,s,id);
  assert.equal(Tower.escortAct(n,q),n,"accepted repeated tap: "+id);
  return n;
}
function deny(s,id){
  const q=ev(s).options.find(o=>o.id===id);
  assert(!q||q.disabled,id+" unexpectedly active");
  assert.equal(Tower.escortAct(s,q||{id}),s);
}
function atCabinet(seed,keep=false){
  return run(Tower.start(seed,{marketTrial:true}),["sword","strike","strike","take-ash","guide",keep?"keep":"sell-1"]);
}
function advance(s,bad=0,extra={}){
  const start=ev(s).leg,visits=ev(s).receipt.branchVisits;
  assert.equal(ev(s).marker,0);
  for(let i=0;i<6;i++){
    const v=ev(s);
    assert.equal(v.leg,start);assert.equal(v.marker,i);assert.equal(v.completedWaypoints,start*6+visits+i);
    const id=i<bad?v.options.find(o=>o.id!==v.cue).id:v.cue;
    s=input(s,id,extra);
    assert.equal(ev(s).completedWaypoints,start*6+visits+i+1);
  }
  assert.equal(ev(s).stage,start===3?"delivery":"station");
  return s;
}
function counterTrade(s,id,expectedGold,item,delta){
  const cash=s.gold,qty=amount(s,item);
  const n=input(s,id);
  assert.equal(n.gold-cash,expectedGold);assert.equal(amount(n,item)-qty,delta);
  return n;
}
function finish(s){
  assert.equal(ev(s).stage,"delivery");
  const before=s.gold,r=ev(s).receipt,origin=s.trial.escort;
  const n=input(s,"deliver"),q=ev(n).receipt;
  assert.equal(n.gold-before,q.roadFee+q.cargoPay);assert.equal(q.roadFee,2);
  assert.equal(q.cargoPay,r.remaining);assert.equal(q.correct+q.wrong,24+q.branchVisits);
  assert.equal(origin.completed,false,"old state mutated");assert.equal(n.trial.escort.completed,true);
  assert.equal(ev(n).stage,"done");deny(n,"deliver");deny(n,"start");
  const out=input(n,"return");assert.equal(out.phase,"shop");assert.equal(out.floor,1);deny(out,"start");deny(out,"return");
  return out;
}
function commercial(seed,speed=1){
  let s=atCabinet(seed),cash=s.gold;
  const originalSilk=Tower.view(s).market.ledger.silkSold;
  s=input(s,"start");s=advance(s,0,{speed});
  s=counterTrade(s,"buy-ash",-1,"ash",1);s=counterTrade(s,"buy-ash",-1,"ash",1);
  s=input(s,"continue");s=advance(s,0,{speed});
  s=counterTrade(s,"sell-ash",3,"ash",-1);s=counterTrade(s,"sell-ash",3,"ash",-1);deny(s,"sell-ash");
  s=counterTrade(s,"buy-shell",-2,"ink-shell",1);deny(s,"buy-shell");
  s=input(s,"continue");s=advance(s,0,{speed});
  s=counterTrade(s,"sell-shell",4,"ink-shell",-1);deny(s,"sell-shell");
  s=input(s,"continue");s=advance(s,0,{speed});s=finish(s);
  const r=ev(s).receipt;
  assert.equal(s.gold,cash+11);assert.equal(r.tradeProfit,6);assert.equal(r.tradeCashFlow,6);
  assert.equal(r.buyCost,4);assert.equal(r.saleIncome,10);assert.equal(r.netCash,11);
  assert.equal(r.roadFee,2);assert.equal(r.cargoPay,3);assert.equal(r.wrong,0);
  assert.equal(originalSilk,Tower.view(s).market.ledger.silkSold);
  assert.equal(amount(s,"ash"),1);assert.equal(amount(s,"ink-shell"),0);
  return s;
}
function baseRoute(seed,bad,refill){
  let s=run(atCabinet(seed,true),["buy-knot"]); // retains the seal, spends all three starting stones.
  assert.equal(s.gold,0);const seal=pack(s).items.find(p=>p.id==="seal"),oldWeapon=s.trial.weapon;
  s=input(s,"start");s=advance(s,bad);
  if(refill){
    const before=amount(s,"ash");s=input(s,"patch");assert.equal(amount(s,"ash"),before-1);deny(s,"patch");
  }else deny(s,"buy-ash");
  s=input(s,"continue");s=advance(s);s=input(s,"continue");s=advance(s);s=input(s,"continue");s=advance(s);
  s=finish(s);
  assert.deepEqual(pack(s).items.find(p=>p.id==="seal"),seal);assert.equal(s.trial.weapon,oldWeapon);
  assert.equal(s.gold,2+3-Math.floor(bad/2)+Number(refill));
  const receipt=ev(s).receipt;
  s=action(s,"gate");while(s.phase==="fight")s=action(s,"strike");
  assert.equal(s.phase,"shop");s=action(s,"sell-1");assert.equal(s.trial.finalSale,7);s=action(s,"settle");
  return {cash:s.gold,receipt};
}
function retreat(seed){
  let s=atCabinet(seed);s=input(s,"start");s=advance(s,1);
  assert.equal(ev(s).condition,5);
  s=input(s,"repair");assert.equal(ev(s).condition,6);deny(s,"repair");
  s=counterTrade(s,"buy-ash",-1,"ash",1);
  s=input(s,"abort");const r=ev(s).receipt;
  assert.equal(r.roadFee,0);assert.equal(r.cargoPay,0);assert.equal(r.serviceCost,1);assert.equal(r.netCash,-2);
  assert.equal(r.returned,true);s=input(s,"return");assert.equal(s.gold,5);assert.equal(amount(s,"ash"),2);deny(s,"start");
  return r;
}

let s=atCabinet(1);const origin=JSON.stringify(s),accepted=ev(s).options[0];
assert.equal(Tower.escortAct(s,"start"),s);
assert.equal(Tower.escortAct(s,{...accepted,revision:42}),s);
assert.equal(Tower.escortAct(s,{...accepted,leg:1}),s);
const other=atCabinet(1);assert.equal(Tower.escortAct(other,accepted),other,"quote from a different run accepted");
s=input(s,"start");assert.equal(Tower.act(s,"gate"),s);
assert.equal(Tower.canArrange(s,{action:"stow",id:"bell"}),false,"road event allowed baggage editing");
const old=s;const oldCue=ev(old).options[0];s=advance(s);
assert.equal(Tower.canArrange(s,{action:"stow",id:"bell"}),true,"station should allow reorganising cargo");
assert.equal(Tower.escortAct(s,oldCue),s);assert.equal(old.trial.escort.marker,0);
assert.equal(origin,JSON.stringify(atCabinet(1)));
const unordered=run(Tower.start(1,{marketTrial:true}),["sword","strike","strike","take","guide"]);
deny(unordered,"start");
const complete=commercial(1);
assert.deepEqual(complete,commercial(1,2),"movement speed changed the route economics");

let loaded=run(atCabinet(1),["vend-ash","buy-hook","buy-lining","detour-haul"]);
while(loaded.phase==="fight")loaded=action(loaded,"strike");
loaded=action(loaded,"skip-blood");assert.equal(pack(loaded).items.reduce((n,p)=>n+p.cells.length,0),16);
loaded=input(loaded,"start");loaded=advance(loaded);
loaded=input(loaded,"sell-shell"); // pocket money from a real shell; cannot create goods with a UI receipt.
assert.equal(loaded.gold,3);
const fullSnapshot=run(atCabinet(1),["vend-ash","buy-hook","buy-lining","detour-haul"]);
let full=fullSnapshot;
while(full.phase==="fight")full=action(full,"strike");
full=action(full,"blood-coins");assert.equal(full.gold,3);
full=input(full,"start");full=advance(full);deny(full,"buy-ash");
const freed=input(full,"sell-shell");assert(ev(freed).options.some(o=>o.id==="buy-ash"&&!o.disabled));

function visit(s,deal){
  const leg=ev(s).leg,checkpoint=ev(s).completedWaypoints;
  const road=input(s,"visit-branch");assert.equal(ev(road).branchRoad,true);
  s=input(road,ev(road).cue);assert.equal(ev(s).stage,"branchMarket");
  assert.equal(ev(s).completedWaypoints,checkpoint+1);
  s=input(s,deal);assert.equal(ev(s).stage,"station");
  assert.equal(ev(s).leg,leg);deny(s,"visit-branch");return s;
}
function fullTrade(seed){
  let s=input(atCabinet(seed),"start");s=advance(s);
  s=visit(s,"branch-ash");assert.equal(amount(s,"ash"),2);
  s=counterTrade(s,"buy-ash",-1,"ash",1);
  s=advance(input(s,"continue"));s=visit(s,"branch-shell");
  assert.equal(amount(s,"ink-shell"),1);assert.equal(amount(s,"ash"),2);
  s=counterTrade(s,"sell-ash",3,"ash",-1);
  s=advance(input(s,"continue"));s=visit(s,"branch-sale");
  s=counterTrade(s,"sell-shell",4,"ink-shell",-1);assert.equal(amount(s,"ash"),0);
  s=finish(advance(input(s,"continue")));
  const q=ev(s).receipt;
  assert.equal(q.branchVisits,3);assert.equal(q.correct,27);assert.equal(s.gold,21);
  assert.equal(q.saleIncome,10);assert.equal(q.buyCost,1);assert.equal(q.netCash,14);
  return q;
}
const series=[];
for(let seed=1;seed<=256;seed++){
  const optimal=commercial(seed);
  const base=baseRoute(seed,0,false),damaged=baseRoute(seed,3,false),empty=baseRoute(seed,6,false),rescued=baseRoute(seed,6,true);
  const returned=retreat(seed);
  assert.equal(empty.receipt.remaining,0);assert.equal(damaged.receipt.remaining,2);assert.equal(rescued.receipt.remaining,1);
  series.push({seed,fullTrade:fullTrade(seed),commercial:ev(optimal).receipt,base:base.receipt,damaged:damaged.receipt,empty:empty.receipt,rescued:rescued.receipt,returned});
}
const flag=process.argv.indexOf("--out");
if(flag>=0){
  const file=process.argv[flag+1];assert(file,"--out requires a JSON path");
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({seeds:series.length,series},null,2)+"\n");
}
const r=series[0];
console.log("PASS 256 seeds × 7 routes: three alternative roadside markets, 27 or 24 ordered marks, 3 limited stations, real cargo and purse, single delivery, damaged/empty/replaced crates, abort and no repeat.");
console.log("Seed 1 commercial: road +"+r.commercial.roadFee+", delivered +"+r.commercial.cargoPay+", sold "+r.commercial.saleIncome+" minus purchases "+r.commercial.buyCost+", net +"+r.commercial.netCash+".");
console.log("Seed 1 zero-cash arrivals, intact / damaged / lost / replaced. Cash settlements "+[r.base,r.damaged,r.empty,r.rescued].map(s=>s.netCash).join(" / ")+"; mid-route retreat paid 1 servicing + 1 ash.");
