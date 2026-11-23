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
let number=0,actualNearSeal=0,emptySky=null,lastLane="left",paceT=0;
async function road(mark,leg,branch){
 for(let k=0;k<3;k++){
 const st=await current();assert.equal(+st.d.fork,k);assert.equal(st.d.stage,"road");
 let choice;const safe=k<2?(st.body.includes("左道的双车辙完整")?"left":st.body.includes("右道的双车辙完整")?"right":null):st.not.includes("稳住货封")?"brace":st.not.includes("靠左")?"left":st.not.includes("靠右")?"right":/压牢箱盖|抱住系箱/.test(st.body)?"brace":/左侧石面|左辙的白石/.test(st.body)?"left":/右辙仍宽|右侧木板/.test(st.body)?"right":null;assert(safe,JSON.stringify(st));
 choice=safe;
 if((first||mode.includes("opt-touch")||mode==="broken-touch")&&!branch&&leg===0&&mark<(mode==="broken-touch"?6:2)&&k===2)choice=safe==="left"?"right":"left";
 if(first&&number===0&&k===0)choice=safe==="left"?"right":"left";
 const method=k<2?"路下注记换道":"按钮应对";
 if(k<2){await press($('[data-escort-lane="'+choice+'"]'));lastLane=choice}
 else {
 const c=$(".escort-world"),r=await c.boundingBox();
 if(emptySky===null){
   const xy={x:r.x+r.width*.5,y:r.y+r.height*.10};await tapPoint(xy);await page.waitForTimeout(35);
   const after=await current();emptySky=after.d.selected||"none";summary.skyProbe={choice:emptySky,xy,fork:after.d.fork,mile:st.mile,changed:after.d.stage!==st.d.stage||after.d.marker!==st.d.marker};await shot("空白命中检查")
 }
 if(choice==="brace" && actualNearSeal<2 && mode!=="broken-touch"){
    // Let the wagon settle at the sign. Locate the painted red stamp independently
    // in the actual canvas raster and touch its screen position.
    await page.waitForFunction(()=>document.querySelector("#escort-view").dataset.waiting==="true",null,{timeout:12000});
    const dot=await c.evaluate(canvas=>{
      const w=canvas.width,h=canvas.height,im=canvas.getContext("2d").getImageData(0,0,w,h).data,spots=[];
      for(let yy=Math.floor(h*.62);yy<h*.91;yy++)for(let xx=1;xx<w-1;xx++){
        const i=(yy*w+xx)*4;if(im[i]===150&&im[i+1]===62&&im[i+2]===48)spots.push([xx,yy]);
      }
      if(spots.length){spots.sort((a,b)=>a[0]-b[0]);const pt=spots[Math.floor(spots.length*.5)];return {x:(pt[0]+.5)/w,y:(pt[1]+.5)/h,pixels:spots.length}}
      return null;
    });assert(dot,"在最终绘制中未找到实物红色车箱封签");
    const xy={x:r.x+r.width*dot.x,y:r.y+r.height*dot.y};await shot("点实物前"+actualNearSeal);await tapPoint(xy);
    const after=await current(),finished=after.d.selected==="brace"||after.d.fork!==st.d.fork||after.d.marker!==st.d.marker||after.d.stage!==st.d.stage;
    ev.push({t:t(),kind:"触摸实体车尾红签",xy,pixels:dot.pixels,observed:after.d.selected,finished,mile:st.mile,notice:after.not});
    if(!finished)await press(act(choice));else actualNearSeal++;
    await shot("车尾护封"+actualNearSeal)
 }else await press(act(choice)); }
 ev.push({t:t(),kind:"路面",leg,mark,branch,k,h:st.h,body:st.body,advertised:safe,pick:choice,method});number++;
 await page.waitForFunction(p=>{const d=document.querySelector("#escort-view").dataset;return d.stage!==p.stage||d.marker!==p.marker||d.fork!==p.fork||d.leg!==p.leg},st.d,{timeout:50000});
 }}
async function deal(a){const before=await current();const l=act(a);assert(await l.isEnabled(),a+" "+JSON.stringify(before));await press(l);const after=await current();ev.push({t:t(),kind:"驿务",a,from:before.h,before:before.stats,after:after.stats,cargo:after.receipt,notice:after.not});return after}
try {await page.addInitScript(()=>{
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
 if(!first){await press($('[data-escort="pace"]'),"催马");paceT=t()}
 for(let leg=0;leg<4;leg++){
 for(let mark=0;mark<6;mark++){
 if(first&&leg===0&&mark===2){await press($('[data-escort="pace"]'),"催马");paceT=t()}
 await road(mark,leg,false);if(leg===0&&mark===1){summary.firstTwoDone=t();await shot("首程损货")}
 }
 const landed=await current();ev.push({t:t(),kind:"到站",leg,landed});flush();
 if(leg===3)break;
 if(branches){await deal("visit-branch");const travel=await current();assert.equal(travel.d.branchRoad,"true");await road(0,leg,true);const stop=await current();assert.equal(stop.d.stage,"branchMarket");await shot("支市"+leg); const chosen=leg===0?"branch-ash":leg===1?"branch-shell":(first||mode==="mendopt-touch")?"branch-mend":"branch-sale";await deal(chosen)}
 const deals=leg===0?["buy-ash","buy-ash"]:leg===1?(branches?["sell-ash","sell-ash"]:["sell-ash","sell-ash","buy-shell"]):["sell-shell"];
 if(mode!=="broken-touch")for(const a of deals)await deal(a);if(leg===2&&mode==="mendopt-touch")await deal("sell-ash");
 await shot("驿站"+leg);await deal("continue");
 }
 summary.driveInputs=number;summary.paceSwitchedMs=paceT;summary.physicalBrace=actualNearSeal;summary.due=await current();await shot("报酬");await deal("deliver");summary.paid=await current();await shot("镖账");await deal("return");await wait("counter");summary.returned=await state();await go("market-fourth","idle");await fight("finalStall");
 if(keep)for(const ph of ["finalQuote","finalSale","counter"])await go("primary",ph);else await go("primary","counter");await go("market-third","receipt");summary.final=await state();summary.settlement=await id("status").innerText();summary.ms=t();await shot("末市");summary.rawTouches=await page.evaluate(()=>window.__independentTouches);flush();console.log(JSON.stringify([mode,number,summary.ms,summary.paid.receipt,summary.final.gold,summary.physicalBrace,summary.skyProbe]));
 }catch(e){summary.failure=e.stack;summary.at=await current().catch(()=>null);summary.final=await state().catch(()=>null);flush();console.error(e);process.exitCode=1}finally{await br.close()}
})().catch(e=>{console.error(e);process.exitCode=1})