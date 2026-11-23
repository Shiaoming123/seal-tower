/* Independent coordinate oracle for the public packing rules. Run with Node. */
"use strict";
const assert=require("node:assert/strict");
const Tower=require("../game.js");

const ids=Object.keys(Tower.bagLayout);
assert.deepEqual([...Tower.bagItemIds].sort(),[...ids].sort(),"missing or orphaned physical item");
for(const p of Object.values(Tower.bagLayout)){
  assert(Number.isFinite(p.minCell)&&p.minCell>=.06&&p.minCell<=1,"declare a material coverage floor");
  assert([p.degrees,p.cx,p.cy,p.span].every(Number.isFinite)&&p.span>0,"pose must be finite");
}
const at=(x,y)=>x+","+y;
function offset(rows,q){
  const w=rows[0].length,h=rows.length,result=[];
  rows.forEach((row,y)=>Array.from(row).forEach((v,x)=>{
    if(v!=="x")return;
    result.push([[x,y],[h-1-y,x],[w-1-x,h-1-y],[y,w-1-x]][q]);
  }));
  return result;
}
function checkShape(rows){
  assert(rows.length&&rows[0].length&&rows.every(r=>r.length===rows[0].length&&/^[x.]+$/.test(r)));
  const f=offset(rows,0),all=new Set(f.map(v=>at(...v))),seen=new Set(),todo=[f[0]];
  while(todo.length){
    const [x,y]=todo.pop(),key=at(x,y);if(seen.has(key)||!all.has(key))continue;seen.add(key);
    todo.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  assert.equal(seen.size,all.size,"each object must be connected");
  assert(rows[0].includes("x")&&rows.at(-1).includes("x")&&rows.some(r=>r[0]==="x")&&rows.some(r=>r.at(-1)==="x"),"trim empty perimeter cells");
}
function testPositions(base,W,H){
  let accepted=0,denied=0;
  for(const id of ids){
    const rows=Tower.bagLayout[id].rows;checkShape(rows);
    for(let q=0;q<4;q++){
      const spec=offset(rows,q),live=Tower.footprint(id,q);
      assert.deepEqual(live.map(v=>at(...v)).sort(),spec.map(v=>at(...v)).sort(),id+" orientation "+q);
      const blocks=[null,[W-1,0],[W-1,H-1],[0,H-1]];
      for(const block of blocks){
        // Start from a legitimate placement, disjoint from the planted single-cell blocker.
        const collider=id==="bell"?"seal":"bell",bkey=block?at(...block):null;
        const spawn=[];
        for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(spec.every(([u,v])=>x+u<W&&y+v<H&&at(x+u,y+v)!==bkey))spawn.push([x,y]);
        if(!spawn.length)continue;
        const [sx,sy]=spawn[0],cargo=[{id,x:sx,y:sy,rotation:q}];
        if(block)cargo.push({id:collider,x:block[0],y:block[1],rotation:0});
        const s={...base,trial:{...base.trial,cargo}},snapshot=JSON.stringify(cargo);
        for(let r=0;r<4;r++){
          const shape=offset(rows,r);
          for(let y=-1;y<=H;y++)for(let x=-1;x<=W;x++){
            const ok=shape.every(([u,v])=>x+u>=0&&y+v>=0&&x+u<W&&y+v<H&&at(x+u,y+v)!==bkey)
              &&(sx!==x||sy!==y||q!==r);
            const op={action:"move",id,x,y,rotation:r},label=[id,x,y,r,bkey].join(" ");
            assert.equal(Tower.canArrange(s,op),ok,label);
            const out=Tower.arrange(s,op);assert.equal(out!==s,ok,label);
            if(ok){
              accepted++;
              const piece=out.trial.cargo.find(i=>i.id===id);
              assert.deepEqual([piece.id,piece.x,piece.y,piece.rotation],[id,x,y,r]);
              assert.equal(out.gold,s.gold);assert.equal(out.turn,s.turn);
            }
            else denied++;
          }
        }
        assert.equal(JSON.stringify(s.trial.cargo),snapshot,"source state mutated");
      }
    }
  }
  return {accepted,denied};
}

// Quantify the cost of each silhouette at equal free area. Count unique free-cell masks,
// without moving existing cargo. They are geometric arrangements, not sampled player runs.
function capacityReport(W,H){
  const totalCells=W*H;
  assert(totalCells<=16,"exhaustive capacity audit is scoped to a small starter pack");
  const report={width:W,height:H,freePatterns:Array(totalCells+1).fill(0),items:{}};
  for(const id of ids){
    const placements=new Set();
    for(let q=0;q<4;q++){
      const shape=offset(Tower.bagLayout[id].rows,q);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(!shape.every(([dx,dy])=>x+dx<W&&y+dy<H))continue;
        let mask=0;
        for(const [dx,dy] of shape)mask|=1<<((y+dy)*W+x+dx);
        placements.add(mask);
      }
    }
    report.items[id]={distinctPlacements:placements.size,fitsByFreeCount:Array(totalCells+1).fill(0)};
    const item=report.items[id],masks=[...placements];
    for(let free=0;free<2**totalCells;free++){
      let count=0;
      for(let bits=free;bits;bits&=bits-1)count++;
      if(id===ids[0])report.freePatterns[count]++;
      if(masks.some(mask=>(free&mask)===mask))item.fitsByFreeCount[count]++;
    }
    assert.equal(item.fitsByFreeCount[totalCells],1,"cannot fit in an empty bag: "+id);
  }
  return report;
}
function shopStart(){
  let s=Tower.start("1",{marketTrial:true});
  for(const action of ["sword","strike","strike","take","guide","sell-1"]){
    const next=Tower.act(s,action);
    assert.notEqual(next,s,"could not reach first counter via "+action);
    s=next;
  }
  return s;
}
const starter=shopStart();
const expanded=Tower.act(starter,"buy-lining");
assert.notEqual(expanded,starter,"lining purchase must expand the pack");
const reports=[];
for(const [run,expectedHeight] of [[starter,3],[expanded,4]]){
  const {width,height}=Tower.view(run).profile.bag;
  assert.deepEqual([width,height],[4,expectedHeight]);
  const positions=testPositions(run,width,height);
  const capacity=capacityReport(width,height);
  capacity.positions=positions;
  const count=capacity.freePatterns.reduce((a,b)=>a+b,0);
  assert.equal(count,2**(width*height));
  console.log(width+"×"+height+": "+ids.length+" types; "+positions.accepted+" accepted, "+positions.denied+" rejected; "+count+" free-space patterns per type.");
  reports.push(capacity);
}
const flag=process.argv.indexOf("--out");
if(flag>=0){
  const fs=require("node:fs"),path=require("node:path"),folder=process.argv[flag+1];
  if(!folder)throw Error("--out requires a directory");
  fs.mkdirSync(folder,{recursive:true});
  for(const [i,report] of reports.entries()){
    const name=i?"bag-capacity-expanded.json":"bag-capacity.json";
    fs.writeFileSync(path.join(folder,name),JSON.stringify(report,null,2)+"\n");
  }
}
