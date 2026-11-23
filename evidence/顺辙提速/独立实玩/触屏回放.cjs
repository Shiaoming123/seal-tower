const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{pathToFileURL}=require("node:url"),{chromium}=require("playwright"),assert=require("node:assert/strict");
const [bundle,mode,out]=process.argv.slice(2),phone=mode.includes("touch")||mode==="self",width=mode==="self"?392:phone?390:1280;
const first=mode==="self",branches=first||mode==="branches-touch"||mode.includes("opt-touch"),keep=mode.includes("keep"),sell=!keep;
const sh=crypto.createHash("sha256").update(fs.readFileSync(bundle)).digest("hex");
(async()=>{fs.mkdirSync(out,{recursive:true});const br=await chromium.launch({channel:"chrome",headless:true});const cx=await br.newContext({viewport:{width,height:phone?844:720},deviceScaleFactor:phone?2:1,hasTouch:phone,isMobile:phone,reducedMotion:"no-preference"});const page=await cx.newPage();page.setDefaultTimeout(9000);const start=Date.now(),t=()=>Date.now()-start,ev=[],err=[],notes=[];const $=s=>page.locator(s),id=s=>$("#"+s),act=s=>$('[data-escort-action="'+s+'"]'),root=id("escort-view");const summary={hash:sh,mode,width,events:ev,errors:err};page.on("pageerror",e=>err.push(e.message));
async function shot(n){await page.screenshot({path:path.join(out,mode+"-"+n+".jpg"),quality:86})}
async function press(l,record){const text=await l.getAttribute("aria-label")||await l.innerText();if(phone)await l.tap();else await l.click();if(record)ev.push({t:t(),action:record,text})}
async function tapPoint(pos){if(phone)await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y)}
const state=()=>id("game").evaluate(e=>({...e.dataset}));const wait=ph=>page.waitForFunction(ph=>document.querySelector("#game").dataset.phase===ph,ph);
async function go(control,ph){await press(id(control),control);if(ph)await wait(ph)}
async function fight(ph){let n=0;while((await state()).phase==="idle"&&n++<8){const k=(await state()).foe;await go("strike");await page.waitForFunction(k=>{const s=document.querySelector("#game").dataset;return s.phase!=="swing"&&(s.phase!=="idle"||k!==s.foe)},k)}await wait(ph)}
const current=()=>root.evaluate(e=>({d:{...e.dataset},h:e.querySelector(".escort-ledger h3").innerText,body:e.querySelector(".escort-desc").innerText,not:e.querySelector(".escort-notice").innerText,mile:e.querySelector(".escort-mile").innerText,stats:[...e.querySelectorAll(".escort-stat")].map(c=>c.innerText.replaceAll("\n"," ")),options:[...e.querySelectorAll(".escort-actions button")].map(x=>[x.dataset.escortAction,x.innerText,x.disabled]),receipt:e.querySelector(".escort-summary").innerText}));
function flush(){fs.writeFileSync(path.join(out,mode+".json"),JSON.stringify(summary,null,2))}
let number=0,actualNearSeal=0,emptySky=null,paceT=0;
const diagnostic=mode==="miss-touch"||mode==="normal-miss-touch";
const delta=st=>page.waitForFunction(p=>{const d=document.querySelector("#escort-view").dataset;return d.stage!==p.stage||d.marker!==p.marker||d.branchRoad!==p.branchRoad||d.leg!==p.leg},st.d,{timeout:18000});
async function road(mark,leg,branch){
 const st=await current();assert.equal(st.d.stage,"road");assert.equal(+st.d.marker,branch?6:mark);
 let choice=st.not.includes("横索")?"brace":st.not.includes("安全通过")?"coast":/可换左辙/.test(st.not)?"left":/可换右辙/.test(st.not)?"right":st.not.includes("已无托箱")?"coast":null;
 assert(choice,JSON.stringify(st));
 const c=$(".escort-world"),r=await c.boundingBox();let method="按钮";
 if(emptySky===null){
   const xy={x:r.x+r.width*.5,y:r.y+r.height*.1};await tapPoint(xy);const after=await current();
   emptySky=after.d.selected;summary.skyProbe={xy,before:st.d.selected,after:emptySky,changed:st.d.selected!==emptySky||st.d.marker!==after.d.marker};
 }
 if(choice==="brace"&&actualNearSeal<2){
    const dot=await c.evaluate(canvas=>{const w=canvas.width,h=canvas.height,im=canvas.getContext("2d").getImageData(0,0,w,h).data,spots=[];
      for(let yy=Math.floor(h*.62);yy<h*.94;yy++)for(let xx=1;xx<w-1;xx++){const i=(yy*w+xx)*4;if(im[i]===150&&im[i+1]===62&&im[i+2]===48)spots.push([xx,yy]);}
      if(spots.length){spots.sort((a,b)=>a[0]-b[0]);const pt=spots[Math.floor(spots.length*.5)];return {x:(pt[0]+.5)/w,y:(pt[1]+.5)/h,pixels:spots.length}}
      return null;});
    const xy=dot?{x:r.x+r.width*dot.x,y:r.y+r.height*dot.y}:null;
    if(!actualNearSeal)await shot("首标横索");
    if(xy){await tapPoint(xy);const after=await current();ev.push({t:t(),kind:"触摸实体车尾红签",xy,pixels:dot.pixels,observed:after.d.selected,mile:st.mile,notice:after.not});if(after.d.selected==="brace"){actualNearSeal++;method="点实物"}else await press(act("brace"))}else{await press(act("brace"));ev.push({kind:"红签像素样本不适用，已用可见按钮"})}
 }else if(choice==="coast"){
   method="无需操作";
 }else if(choice==="left"||choice==="right"){
   if(!branch&&leg===0&&mark===4)await shot("首程改道");
   await press(act(choice));
 }else await press(act(choice));
 if(choice!=="coast")number++;
 const after=await current();
 ev.push({t:t(),kind:"路面",leg,mark,branch,h:st.h,body:st.body,notice:st.not,preTrack:st.d.track,choice,method,roadAction:choice!=="coast",postTrack:after.d.track,feedback:after.not,mile:st.mile});
 await delta(st);
}
async function deal(a){const before=await current();const l=act(a);assert(await l.isEnabled(),a+" "+JSON.stringify(before));await press(l);const after=await current();ev.push({t:t(),kind:"驿务",a,from:before.h,before:before.stats,after:after.stats,cargo:after.receipt,notice:after.not});return after}
try {await page.addInitScript(()=>{
 
 // A passive observation of what the engine has already rendered. No clocks, controls or state are replaced.
 window.__independentSegments=[];
 let lastStamp="";
 function sampleRoad(){
   const root=document.querySelector("#escort-view");
   if(!root||root.hidden||!root.dataset.stage)return;
   const d=root.dataset;const text=(s)=>root.querySelector(s)?.innerText?.replace(/\s+/g," ").trim()||"";
   const h=text(".escort-ledger h3"),notice=text(".escort-notice"),selected=d.selected||"",track=d.track||"",branch=d.branchRoad==="true",pace=d.pace||"";
   const signature=[d.stage,d.leg,d.marker,branch,track,selected,h,notice,pace].join("|");
   if(signature===lastStamp)return;
   lastStamp=signature;
   const row={t:Math.round(performance.now()),stage:d.stage,leg:Number(d.leg),mark:Number(d.marker),branch,track,selected,h,notice,pace,body:text(".escort-desc"),speed:text(".escort-pace"),mile:text(".escort-mile"),stats:[...root.querySelectorAll(".escort-stat")].map(x=>x.innerText.replace(/\s+/g," ").trim())};
   window.__independentSegments.push(row);
 }
 new MutationObserver(sampleRoad).observe(document,{subtree:true,attributes:true,attributeFilter:["data-stage","data-leg","data-marker","data-selected","data-track","data-branch-road","data-pace","hidden"],childList:true,characterData:true});

 window.__independentTouches=[];
 document.addEventListener("pointerup",e=>{
  const root=document.querySelector("#escort-view"),node=e.target.closest("button")||e.target;
  window.__independentTouches.push({t:Math.round(performance.now()),phase:document.querySelector("#game")?.dataset.phase,
    ride:!!root&&!root.hidden,stage:root?.dataset.stage,leg:root?.dataset.leg,mark:root?.dataset.marker,fork:root?.dataset.fork,
    label:node.getAttribute("aria-label")||node.innerText?.trim()||node.className,job:node.dataset.escortAction||node.dataset.escortLane||node.dataset.escort||node.id||"world",x:e.clientX,y:e.clientY});
 },true);
 });let url=process.env.REVIEW_URL||pathToFileURL(path.resolve(bundle)).href;await page.goto(url);await wait("idle");await fight("drop");
 for(const [c,ph] of [["secondary","guide"],["primary","rumor"],["primary","stall"],["primary","quote"],[sell?"primary":"secondary","result"],["primary","counter"]])await go(c,ph);
 if(mode.startsWith("fast-")){await go("market-fourth","idle");await fight("finalStall");if(keep)for(const ph of ["finalQuote","finalSale","counter"])await go("primary",ph);else await go("primary","counter");await go("market-third","receipt");summary.final=await state();summary.ms=t();flush();return}
 await go("market-escort");await act("start").waitFor();summary.offer=await current();await shot("接单");summary.offerCash=+(await state()).gold;summary.contract=t();await press(act("start"));
 if(mode!=="normal-miss-touch"){await press($('[data-escort="pace"]'),"催马");paceT=t();}

 if(mode==="late-touch"){
   const first=await current();await page.waitForTimeout(2600);const before=await current();assert.equal(before.d.marker,first.d.marker,"等待期间横索已过");
   await press(act("brace"),"延迟护箱");const after=await current();assert.equal(after.d.selected,"brace");await delta(first);
   const safe=await current();const c=$(".escort-world"),r=await c.boundingBox(),cx=r.x+r.width*.52,cy=r.y+r.height*.43;const wire=await page.context().newCDPSession(page);
   const finger=(x)=>[{x,y:cy,radiusX:3,radiusY:3,force:.7,id:1}];
   await wire.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:finger(cx)});
   await delta(safe);const next=await current();await wire.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:finger(cx-75)});await wire.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   const cross=await current();assert.equal(cross.d.track,"right","跨路标松手导致误换辙");await delta(next);
   const laterBrake=await current();await press(act("brace"));await delta(laterBrake);const open=await current();
   await page.waitForTimeout(2200);await wire.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:finger(cx)});await wire.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:finger(cx-75)});await wire.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   const changed=await current();assert.equal(changed.d.track,"left","同路标左扫未换辙");await delta(open);const carried=await current();
   summary.delayed={first,before,after,safe,next,cross,open,changed,carried};summary.segments=await page.evaluate(()=>window.__independentSegments);summary.rawTouches=await page.evaluate(()=>window.__independentTouches);summary.ms=t();await shot("迟应后保全三箱");flush();return
 }

 if(diagnostic){
   const orig=await current();summary.firstIdle=orig;await shot("初见");
   await page.waitForFunction(()=>document.querySelector("#escort-view").dataset.stage==="turnoff",null,{timeout:70000});
   const fork=await current();summary.unattendedTurn=fork;const arrive=t();await shot("无操作驿口");
   await delta(fork);summary.autopassMs=t()-arrive;summary.nextRoad=await current();
   summary.segments=await page.evaluate(()=>window.__independentSegments);summary.rawTouches=await page.evaluate(()=>window.__independentTouches);summary.ms=t();flush();return
 }
 for(let leg=0;leg<4;leg++){
 for(let mark=0;mark<6;mark++){await road(mark,leg,false);if(!leg&&mark===1){summary.firstTwoDone=t()}}
 const landed=await current();ev.push({t:t(),kind:"到站",leg,landed});flush();
 if(leg===3)break;assert.equal(landed.d.stage,"turnoff");
 if(leg===0)await shot("首驿岔口");const entry=leg===0?$(".escort-road-sign"):$('[data-escort="enter-market"]');
 if(await entry.count()&&await entry.isVisible()){await press(entry,"进驿")}else await press($('[data-escort="enter-market"]'),"进驿");
 assert.equal((await current()).d.stage,"station");
 await deal("visit-branch");const travel=await current();assert.equal(travel.d.branchRoad,"true");await road(0,leg,true);const stop=await current();assert.equal(stop.d.stage,"branchMarket");await shot("支市"+leg);
 const chosen=leg===0?"branch-ash":leg===1?"branch-shell":"branch-sale";await deal(chosen);
 const deals=leg===0?["buy-ash","buy-ash"]:leg===1?["sell-ash","sell-ash"]:["sell-shell"];for(const a of deals)await deal(a);await deal("continue");
 }
 summary.driveInputs=number;summary.paceSwitchedMs=paceT;summary.physicalBrace=actualNearSeal;summary.due=await current();await shot("报酬");await deal("deliver");summary.paid=await current();await shot("镖账");await deal("return");await wait("counter");summary.returned=await state();await go("market-fourth","idle");await fight("finalStall");
 if(keep)for(const ph of ["finalQuote","finalSale","counter"])await go("primary",ph);else await go("primary","counter");await go("market-third","receipt");summary.final=await state();summary.settlement=await id("status").innerText();summary.ms=t();await shot("末市");summary.segments=await page.evaluate(()=>window.__independentSegments);summary.rawTouches=await page.evaluate(()=>window.__independentTouches);flush();console.log(JSON.stringify([mode,number,summary.ms,summary.paid.receipt,summary.final.gold,summary.physicalBrace,summary.skyProbe]));
 }catch(e){summary.failure=e.stack;summary.at=await current().catch(()=>null);summary.final=await state().catch(()=>null);flush();console.error(e);process.exitCode=1}finally{await br.close()}
})().catch(e=>{console.error(e);process.exitCode=1})