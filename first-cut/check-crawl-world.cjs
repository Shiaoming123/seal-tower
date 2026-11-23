"use strict";
const assert=require("node:assert/strict"),world=require("./crawl-world.js");
const move=(s,id)=>{const v=world.view(s);assert(v.actions.some(a=>a.id===id&&!a.disabled),v.phase+" "+id);return world.act(s,id)};
function go(s,target){
  const delta=[[0,-1],[1,0],[0,1],[-1,0]],v=world.view(s),n=v.nav,dest=n.markers.find(m=>m.id===target);
  assert(dest,"missing waypoint "+target);
  const queue=[[n.x,n.y,n.dir,[]]],visited=new Set();
  while(queue.length){
    const [x,y,d,path]=queue.shift(),k=[x,y,d].join();if(visited.has(k))continue;visited.add(k);
    if(x===dest.x&&y===dest.y){return path}
    const [dx,dy]=delta[d],nx=x+dx,ny=y+dy;
    if(n.rows[ny]?.[nx]!=="#"&&!n.markers.some(m=>m.id!==target&&m.x===nx&&m.y===ny))
      queue.push([nx,ny,d,[...path,"step"]]);
    queue.push([x,y,(d+3)%4,[...path,"turn-left"]],[x,y,(d+1)%4,[...path,"turn-right"]]);
  }
  throw new Error("Unreachable "+target);
}
function replay(s,ids){return ids.reduce(move,s)}
for(let seed=1;seed<=16;seed++){
  const initial=replay(world.create(seed),["order-clasp","gear-buckler"]);
  assert.equal(world.view(initial).phase,"walk");
  const wall=move(initial,"turn-right");assert.equal(world.act(wall,"step"),wall);
  const circle=replay(initial,Array(4).fill("turn-right"));
  assert.deepEqual(world.view(initial),world.view(circle));
  let fork=replay(initial,go(initial,"lamp"));
  assert.equal(world.view(fork).phase,"gather");fork=move(fork,"gather-ash");
  assert.equal(world.act(fork,"gather-ash"),fork);
  for(const id of ["moth","rat"]){
    let s=replay(fork,go(fork,id)),v=world.view(s);
    assert.equal(v.phase,"fight");assert.equal(v.foe.id,id);
    assert.equal(world.act(s,"turn-right"),s);
    assert.deepEqual(world.view(JSON.parse(JSON.stringify(s))),v);
    // Reveal and walk the inter-encounter gate through genuine card plays.
    for(let i=0;world.view(s).phase==="fight";i++){
      assert(i<55);
      const hand=world.view(s).actions.filter(a=>!a.disabled&&a.fx==="strike");
      const a=hand.sort((l,r)=>r.power-l.power)[0];
      s=move(s,a?.id||"end-turn");
    }
    assert.equal(world.view(s).phase,"loot");s=move(s,"onward");
    assert.equal(world.view(s).phase,"walk");assert.equal(world.view(s).foe,null);
    s=replay(s,go(s,"fox"));v=world.view(s);assert.equal(v.foe.id,"fox");
    assert.equal(v.foe.clasp,id==="rat"?"挂在颈下":"缺了一角");
    s=replay(s,["retreat","commit"]);assert.equal(world.view(s).phase,"done");
  }
}
console.log("16 signs × both routes: rotation, collision, lamp once, branch encounter, fight freeze, gate, retreat and receipts passed.");