/* Run node first-cut/check-bag-art.cjs --out <evidence-dir>. Requires Playwright and Chrome/Chromium. */
"use strict";
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const {chromium} = require("playwright");
const root = path.resolve(__dirname,"..");
const flag = process.argv.indexOf("--out");
const out = flag >= 0 ? process.argv[flag+1] : null;
if (flag>=0 && !out) throw new Error("--out requires a directory");

async function browserAudit() {
  await TowerSprites.ready;
  const cell=96, gutter=2*cell, alphaEdge=32;
  const limits={maxOffBoardAlpha:.002,maxNotchAlpha:.002,minReferenceRecall:.993,
    maxVisibleOutsidePixels:0,minEdgePixels:4,minMaterialCoverage:.06,minWeaponReach:2.67,maxColorError:.025,edgeAlpha:alphaEdge};
  const canvas=(w,h)=>{
    const el=document.createElement("canvas");el.width=w;el.height=h;return el;
  };
  const ctx=c=>c.getContext("2d",{willReadFrequently:true});
  const pixels=c=>ctx(c).getImageData(0,0,c.width,c.height).data;
  const close=n=>Number(n.toFixed(5));
  const dims=(p,q)=>q%2 ? [p.rows.length,p.rows[0].length] : [p.rows[0].length,p.rows.length];
  // Independent transform on an oversize canvas. No clip, mask, filtering or rule-grid operations here.
  // Derive the final centre directly from the registration point instead of using BagArt's transform chain.
  function reference(p,q,w,h) {
    const im=TowerSprites.get(p.sprite), pad=canvas(w+2*gutter,h+2*gutter),c=ctx(pad);
    const W=p.rows[0].length,H=p.rows.length,centres=[[p.cx,p.cy],[H-p.cy,p.cx],[W-p.cx,H-p.cy],[p.cy,W-p.cx]];
    const [cx,cy]=centres[q],ang=(p.degrees+q*90)*Math.PI/180;
    const scale=cell*p.span/Math.max(im.naturalWidth,im.naturalHeight);
    const a=scale*Math.cos(ang),b=scale*Math.sin(ang);
    c.setTransform(a,b,-b,a,gutter+cx*cell,gutter+cy*cell);
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";
    c.drawImage(im,-im.naturalWidth/2,-im.naturalHeight/2);
    return pad;
  }
  function inspect(id,q,actual,pad) {
    const p=Tower.bagLayout[id],shape=Tower.footprint(id,q);
    const allowed=new Map(shape.map(([x,y])=>[x+","+y,0])),raw=pixels(pad),normal=pixels(actual);
    const w=actual.width,h=actual.height,pw=pad.width,cols=w/cell,rows=h/cell;
    // Read every cell before consulting its declared ownership.
    const rawMass=Array(cols*rows).fill(0),drawnMass=Array(cols*rows).fill(0);
    let mass=0,off=0,hole=0,missing=0,colorError=0,visibleOutside=0,minX=w,maxX=-1,minY=h,maxY=-1;
    for(let py=0;py<pad.height;py++)for(let px=0;px<pw;px++){
      const x=px-gutter,y=py-gutter,r=raw[(py*pw+px)*4+3];mass+=r;
      if(x<0||y<0||x>=w||y>=h){off+=r;if(r>=alphaEdge)visibleOutside++;continue}
      const n=normal[(y*w+x)*4+3],key=Math.floor(x/cell)+","+Math.floor(y/cell);
      const index=Math.floor(y/cell)*cols+Math.floor(x/cell);
      rawMass[index]+=r;drawnMass[index]+=n;
      if(!allowed.has(key)){hole+=Math.max(r,n);if(Math.max(r,n)>=alphaEdge)visibleOutside++}
      else allowed.set(key,allowed.get(key)+n);
      missing+=Math.max(0,r-n);
      const sourceIndex=(py*pw+px)*4,targetIndex=(y*w+x)*4;
      for(let channel=0;channel<3;channel++)colorError+=Math.abs(raw[sourceIndex+channel]*r-normal[targetIndex+channel]*n);
      if(n>=alphaEdge){minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY)}
    }
    const coverage=Object.fromEntries([...allowed].map(([k,v])=>[k,close(v/(255*cell*cell))]));
    const reach=close(Math.max(maxX-minX+1,maxY-minY+1)/cell);
    const crossed=[];
    for(const [x,y] of shape)for(const [dx,dy] of [[1,0],[0,1]]){
      if(!allowed.has((x+dx)+","+(y+dy)))continue;
      let count=0;
      for(let j=0;j<cell;j++) {
        const xx=x*cell+(dx ? cell-1:j),yy=y*cell+(dy ? cell-1:j);
        if(Math.min(normal[(yy*w+xx)*4+3],normal[((yy+dy)*w+xx+dx)*4+3])>=alphaEdge)count++;
      }
      crossed.push({from:[x,y],to:[x+dx,y+dy],visiblePixels:count});
    }
    const ratios={offBoard:close(off/mass),notch:close(hole/mass),recall:close(1-(missing+off)/mass),colorError:close(colorError/(3*255*mass))};
    function readShape(mass){
      return Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>
        mass[y*cols+x]/(255*cell*cell)>=limits.minMaterialCoverage ? "x":".").join(""));
    }
    const declared=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>allowed.has(x+","+y)?"x":".").join(""));
    const detected={declared,source:readShape(rawMass),rendered:readShape(drawnMass)};
    const faults=[];
    if(detected.source.join("/")!==declared.join("/")||detected.rendered.join("/")!==declared.join("/"))faults.push("measured grid differs from declaration");
    if(!mass||!Object.values(ratios).every(Number.isFinite))faults.push("missing reference silhouette");
    if(Math.min(...Object.values(coverage))<p.minCell)faults.push("occupied-cell coverage");
    if(ratios.colorError>limits.maxColorError)faults.push("original sprite colour mismatch");
    if(ratios.offBoard>limits.maxOffBoardAlpha)faults.push("cropped outside footprint");
    if(ratios.notch>limits.maxNotchAlpha)faults.push("leaked into reserved notch");
    if(ratios.recall<limits.minReferenceRecall)faults.push("missing original sprite pixels");
    if(visibleOutside>limits.maxVisibleOutsidePixels)faults.push("visible outside declared cells");
    if(crossed.some(edge=>edge.visiblePixels<limits.minEdgePixels))faults.push("disconnected across grid boundary");
    if(["sword","hook","ward-blade"].includes(id) && reach<limits.minWeaponReach)faults.push("short weapon");
    return {turn:q,detected,coverage,reach,crossed,visibleOutside,ratios,faults};
  }
  const names=Object.keys(Tower.bagLayout);
  const declared=[...Tower.bagItemIds].sort().join(",");
  if([...names].sort().join(",")!==declared)throw Error("Inventory catalogue/registration mismatch: "+declared);
  function tile(id,q) {
    const p=Tower.bagLayout[id],[w,h]=dims(p,q),c=canvas(w*cell,h*cell);
    BagArt.draw(c,{id,shape:Tower.footprint(id),cells:Tower.footprint(id,q),rotation:q});
    return c;
  }
  function ground(c,x,y,w,h,unit){
    c.fillStyle="#25383a";c.fillRect(x,y,w*unit,h*unit);
    for(let row=0;row<h;row++)for(let col=0;col<w;col++){
      c.fillStyle=(row+col)%2?"#334742":"#2b3e3c";c.fillRect(x+col*unit+1,y+row*unit+1,unit-2,unit-2);
    }
  }
  const report={cellPixels:cell,limits,items:{},negative:{},nesting:{}}, failures=[];
  const pane=154,line=165,atlas=canvas(130+4*pane,43+line*names.length),c=ctx(atlas);
  c.fillStyle="#172526";c.fillRect(0,0,atlas.width,atlas.height);c.fillStyle="#edd9aa";c.font="17px sans-serif";
  c.fillText("行囊 · 四向实物占格",16,27);
  for(let i=0;i<4;i++)c.fillText(i*90+"°",130+i*pane+52,28);
  for(const [row,id] of names.entries()) {
    const p=Tower.bagLayout[id],first=tile(id,0),roundTrip=canvas(first.width,first.height);
    BagArt.draw(roundTrip,{id,rotation:4});
    const initial=pixels(first),last=pixels(roundTrip);
    const identical=initial.every((v,i)=>v===last[i]);
    if(!identical || JSON.stringify(Tower.footprint(id,0))!==JSON.stringify(Tower.footprint(id,4))) failures.push(id+" rotation loop");
    const turns=[];
    c.fillStyle="#f2dca4";c.font="15px sans-serif";c.fillText(id,12,42+row*line+line/2);
    for(let q=0;q<4;q++) {
      const pic=tile(id,q),r=inspect(id,q,pic,reference(p,q,pic.width,pic.height));
      if(r.faults.length)failures.push(id+"/"+q+": "+r.faults.join(", "));
      turns.push(r);
      const u=42,[w,h]=dims(p,q),x=130+q*pane+(pane-w*u)/2,y=42+row*line+(line-h*u)/2;
      ground(c,x,y,w,h,u);
      c.drawImage(pic,x,y,w*u,h*u);
    }
    report.items[id]={registration:p,rotationLoop:identical,turns};
  }
  function act(s,id){const n=Tower.act(s,id);if(n===s)throw Error("Route rejected: "+id);return n}
  let s=Tower.start("1",{marketTrial:true});
  for(const id of ["sword","strike","strike","take","guide","sell-1","buy-ward-blade","detour-ink"])s=act(s,id);
  while(s.phase==="fight")s=act(s,"strike");
  s=act(s,"skip-blood");
  s=Tower.arrange(s,{id:"ink-shell",action:"move",x:1,y:1,rotation:0});
  s=Tower.arrange(s,{id:"bell",action:"stow"});
  const shell=Tower.view(s).profile.bag.items.find(i=>i.id==="ink-shell");
  // Posting the two pieces is done via the same legal moves as the player, after the ordinary combat drop.
  if(!shell || shell.rotation!==0)throw Error("No matching natural shell placement");
  s=Tower.arrange(s,{id:"bell",action:"move",x:shell.x,y:shell.y,rotation:0});
  const bag=Tower.view(s).profile.bag,bell=bag.items.find(i=>i.id==="bell");
  const legalBell=bell && bell.x===shell.x && bell.y===shell.y;
  const denied=Tower.arrange(s,{id:"bell",action:"move",x:shell.x+1,y:shell.y,rotation:0})===s;
  const nested=canvas(4*cell,3*cell),nc=ctx(nested);ground(nc,0,0,4,3,cell);
  const claimed=new Set(),inked=new Set();let physicalOverlap=0,ruleOverlap=false;
  for(const item of bag.items) {
    for(const [dx,dy] of item.cells) {
      const key=(item.x+dx)+","+(item.y+dy);
      if(claimed.has(key))ruleOverlap=true;claimed.add(key);
    }
    const pic=tile(item.id,item.rotation),raw=pixels(pic);
    for(let y=0;y<pic.height;y++)for(let x=0;x<pic.width;x++){
      if(raw[(y*pic.width+x)*4+3]<alphaEdge)continue;
      const pos=(item.y*cell+y)*nested.width+(item.x*cell+x);
      if(inked.has(pos))physicalOverlap++;inked.add(pos);
    }
    nc.drawImage(pic,item.x*cell,item.y*cell);
  }
  report.nesting={items:bag.items.map(({id,x,y,rotation})=>({id,x,y,rotation})),legalBell,denied,physicalOverlap,ruleOverlap};
  if(!legalBell || !denied || ruleOverlap || physicalOverlap)failures.push("dense nesting");
  // Negative controls use deliberately broken production-sized drawings; run the same audit and require rejection.
  const bad=canvas(440,175),bc=ctx(bad);bc.fillStyle="#24292b";bc.fillRect(0,0,bad.width,bad.height);
  for(const [i,id] of ["sword","ink-shell"].entries()){
    const source=tile(id,0),wrong=canvas(source.width,source.height),d=ctx(wrong);
    if(i===0)d.drawImage(source,cell,cell/3,source.width/3,source.height/3);
    else d.drawImage(source,-cell*.35,-cell*.28);
    const r=inspect(id,0,wrong,reference(Tower.bagLayout[id],0,wrong.width,wrong.height));
    report.negative[id]=r.faults;
    const expected=i===0 ? ["measured grid differs from declaration","occupied-cell coverage","short weapon","disconnected across grid boundary"]
      : ["leaked into reserved notch","visible outside declared cells"];
    for(const fault of expected)if(!r.faults.includes(fault))failures.push("negative control "+id+" failed to detect "+fault);
    const x=16+i*220,y=54,u=53,[w,h]=dims(Tower.bagLayout[id],0);ground(bc,x,y,w,h,u);bc.drawImage(wrong,x,y,w*u,h*u);
    bc.fillStyle="#ffd0b0";bc.font="15px sans-serif";bc.fillText("×  "+(i?"偏移越格":"长剑缩成一格"),x,32);
  }
  report.failures=failures;
  return {report,atlas:atlas.toDataURL(),nesting:nested.toDataURL(),rejected:bad.toDataURL()};
}
async function main() {
  const allowed=new Map([["/game.js",path.join(root,"game.js")],["/bag-art.js",path.join(__dirname,"bag-art.js")],["/sprite-bank.js",path.join(__dirname,"sprite-bank.js")]]);
  const server=http.createServer(async(req,res)=>{
    try{
      if(req.url==="/"){res.setHeader("content-type","text/html");res.end('<script src="/game.js"></script><script src="/sprite-bank.js"></script><script src="/bag-art.js"></script>');return}
      const sprite=/^\/sprites\/([a-z0-9-]+\.webp)$/.exec(req.url);
      const f=allowed.get(req.url) || (sprite && path.join(__dirname,"sprites",sprite[1]));
      if(!f){res.writeHead(404).end();return}
      res.setHeader("content-type",sprite?"image/webp":"text/javascript");
      res.end(await fs.readFile(f));
    }catch{res.writeHead(404).end()}
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  let browser;
  try{
    try{browser=await chromium.launch({channel:"chrome",headless:true})}
    catch{browser=await chromium.launch({headless:true})}
    const page=await browser.newPage();await page.goto("http://127.0.0.1:"+server.address().port+"/");
    const {report,atlas,nesting,rejected}=await page.evaluate(browserAudit);
    report.chrome=browser.version();
    for(const row of Object.values(report.items)){
      const bytes=await fs.readFile(path.join(__dirname,"sprites",row.registration.sprite+".webp"));
      row.sourceSha256=crypto.createHash("sha256").update(bytes).digest("hex");
    }
    if(out){
      await fs.mkdir(out,{recursive:true});
      for(const [name,url] of [["bag-orientations",atlas],["bag-nesting",nesting],["bag-rejected",rejected]])await fs.writeFile(path.join(out,name+".png"),Buffer.from(url.split(",")[1],"base64"));
      await fs.writeFile(path.join(out,"bag-metrics.json"),JSON.stringify(report,null,2)+"\n");
    }
    if(report.failures.length)throw Error(report.failures.join("\n"));
    console.log("PASS",Object.keys(report.items).length,"registered transparent bag sprites × 4 turns, expanded-source alpha checks, pixel roundtrips, dense real run and rejected negative controls.");
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(err=>{console.error(err.message);process.exitCode=1});
