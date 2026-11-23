/* Follow accessible side events from actual builds, including full packs and an empty purse. */
"use strict";
const assert=require("node:assert/strict");
const Tower=require("../game.js");
function act(state,id){
  const next=Tower.act(state,id);assert.notEqual(next,state,id);return next;
}
function fight(state){
  for(let turn=0;state.phase==="fight";turn++){
    assert(turn<12);state=act(state,"strike");
  }
  return state;
}
function resolveFloor(state){
  const profile=Tower.view(state).profile;
  const before=JSON.stringify(profile.bag.items),carriedSeal=JSON.stringify(state.seals);
  for(const piece of profile.bag.pending){
    const next=Tower.arrange(state,{action:"discard",id:piece.id,instanceId:piece.instanceId});
    assert.notEqual(next,state);state=next;
  }
  assert.equal(JSON.stringify(Tower.view(state).profile.bag.items),before);
  assert.equal(JSON.stringify(state.seals),carriedSeal);
  return state;
}
let paths=0,overflows=0,lateOverflow=0;
for(const seed of [1,2,3,16,127,256]){
  for(const choice of ["keep","sell-1"]){
    let cabinet=Tower.start(seed,{marketTrial:true});
    cabinet=fight(act(cabinet,"sword"));
    for(const id of ["take-ash","guide",choice])cabinet=act(cabinet,id);
    for(const purchase of ["","buy-knot","buy-lining"]){
      const ready=purchase?act(cabinet,purchase):cabinet;
      for(const route of ["detour-ink","detour-haul","detour-wound"]){
        let encounter=act(ready,route);
        if(encounter.phase==="fight")encounter=fight(encounter);
        if(encounter.phase==="wound"){
          const exit=Tower.view(encounter).actions.find(a=>!a.disabled);
          encounter=act(encounter,exit.id);
        }
        assert.equal(encounter.phase,"blood");
        if(encounter.trial.pending.length)overflows++;
        encounter=resolveFloor(encounter);
        for(const deal of Tower.view(encounter).actions.filter(a=>!a.disabled)){
          let state=act(encounter,deal.id);
          state=fight(act(state,"gate"));
          if(state.phase==="lost"){paths++;continue}
          if(choice==="keep")state=act(state,"sell-1");
          if(state.trial.pending.length)lateOverflow++;
          state=resolveFloor(state);
          state=act(state,"settle");assert.equal(state.phase,"won");paths++;
        }
      }
    }
  }
}
assert(overflows>0&&lateOverflow>0);
console.log(JSON.stringify({paths,bloodEventsWithOverflow:overflows,finalMarketsWithOverflow:lateOverflow}));
