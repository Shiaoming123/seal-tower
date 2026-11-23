const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),{pathToFileURL}=require("node:url"),{chromium}=require("playwright");
const [source,output,profile,input]=process.argv.slice(2),phone=profile.includes("touch");
const url=source.startsWith("http")?source:pathToFileURL(path.resolve(source)).href+"?seed=1";
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const br=await chromium.launch({headless:true,channel:"chrome"});
 const context=await br.newContext({viewport:{width:phone?390:1280,height:phone?844:720},hasTouch:phone,isMobile:phone,deviceScaleFactor:phone?2:1});
 const page=await context.newPage(),errors=[],events=[],screens=[];
 page.on("pageerror",error=>errors.push(error.message));await page.goto(url); const entry=page.locator("#hunt-entry");if(!url.includes("play=crawl")){await entry.waitFor();if(phone)await entry.tap();else await entry.click()}const main=page.locator("#hunt");try{await main.waitFor({timeout:6000})}catch(err){console.error(page.url(), await page.title(), await page.locator("body").innerText(), errors);await br.close();throw err}
 const snap=()=>main.evaluate(m=>{
 const read=s=>{const n=m.querySelector(s);return n&&!n.closest("[hidden]")&&n.getClientRects().length?n.innerText.trim():""};
 return {phase:m.dataset.phase,leg:m.dataset.leg,direction:read(".crawl-map span"),more:read(".hunt-text small"),title:read(".hunt-text h1"),text:read(".hunt-text p"),status:read(".hunt-stats"),foe:read(".hunt-foe"),stock:read(".hunt-stock"),readout:read(".hunt-readout"),options:[...m.querySelectorAll(".hunt-commands button")].map(b=>({id:b.dataset.id||"",label:b.innerText,aria:b.getAttribute("aria-label"),fx:b.dataset.fx,disabled:b.disabled})),dialog:m.querySelector("dialog[open]")?.innerText||""};
 });
 const shot=async name=>{const file=name+".jpg";await page.screenshot({path:path.join(output,file),quality:85});screens.push(file)};
 const press=async locator=>{await locator.waitFor();if(phone)await locator.tap();else await locator.click()};
 const take=async id=>{
   const st=await snap();const btn=main.locator('.hunt-commands button[data-id="'+id+'"]');
   assert(!st.options.find(o=>o.id===id)?.disabled&&await btn.count(),JSON.stringify(st));
   await press(btn);if((st.phase==="fight"||st.phase==="walk")&&id!=="retreat")await page.waitForFunction(()=>Array.from(document.querySelectorAll("#hunt .hunt-commands button")).some(b=>!b.disabled),null,{timeout:8000});
   await page.waitForTimeout(45);const after=await snap();events.push({op:id,before:st,after});return after
 };

 async function tour(kind){
   const ash=kind==="灰单",seen=new Set(),shop=new Set();let count=0,completedCombos=0;
   const once=async(name)=>{if(!seen.has(name)){seen.add(name);await shot(name)}};
   const pickCard=v=>{
     const ready=v.options.filter(o=>o.fx&&!o.disabled).map(o=>{
       const [fee,label,...copy]=o.label.split("\n"),num=t=>+(String(t).match(/(?:打 |加 )(\d+)/)||[])[1]||0;
       return {...o,fee:+fee,name:label,copy:copy.join(""),p:num(copy.join(""))};
     });
     const danger=+/预计受 (\d+) 伤/.exec(v.text)?.[1]||0,en=+/行动 (\d+)/.exec(v.stock)?.[1]||0,block=+/格挡 (\d+)/.exec(v.stock)?.[1]||0;
     const keep=v.text.includes("出刀会断扣"),steal=v.foe.includes("伸爪掏灰")&&ash;
     const stop=ready.filter(c=>c.fx==="flare"&&c.copy.includes("本轮截住敌招"));
     if(keep){
       if(danger>0&&!ash&&stop.length)return stop.sort((a,b)=>a.fee-b.fee)[0].id;
       if(!block&&danger>0){const g=ready.filter(c=>c.fx==="guard").sort((a,b)=>b.p-a.p);if(g.length)return g[0].id}
       return "end-turn";
     }
     if(steal&&!block&&danger>0){
       const g=ready.filter(c=>c.fx==="guard").sort((a,b)=>a.fee-b.fee);if(g.length)return g[0].id
     }
     const combo=+(v.title.match(/连招 (\d+)/)||[])[1]||0;
     const sorted=ready.filter(c=>c.fx!=="flare").sort((a,b)=>Number(b.fx==="strike")-Number(a.fx==="strike")||b.p-a.p);
     const freq=fee=>sorted.some(c=>c.fee===fee);
     if(en===3&&!combo&&freq(0)&&freq(1)&&freq(2))return sorted.find(c=>!c.fee).id;
     if(combo===1&&freq(1)&&freq(2)&&en>=3)return sorted.find(c=>c.fee===1).id;
     if(combo===2&&freq(2))return sorted.find(c=>c.fee===2).id;
     const zero=sorted.find(c=>c.fee===0);if(zero)return zero.id;
     const attacks=sorted.filter(c=>c.fx==="strike");if(attacks.length)return attacks.sort((a,b)=>b.p-a.p)[0].id;
     if(danger>0&&sorted.length)return sorted[0].id;
     return "end-turn";
   };
   while(count++<240){
     const v=await snap(),ok=id=>v.options.some(o=>o.id===id&&!o.disabled);
     if(v.phase==="done"){await once(kind+"-回铺");events.push({op:"连招实测次数",count:completedCombos});return}
     if(v.phase==="walk"){
       if(v.title.includes("岔口"))await once(kind+"-廊道实景");const atlas=main.locator(".crawl-map");await press(atlas);const m=await snap();
       events.push({op:"地图",title:v.title,body:m.dialog});
       if(v.title.includes("岔口"))await once(kind+"-岔路图");
       await press(main.getByRole("dialog").getByRole("button",{name:"回到塔内"}));
       const lines=m.dialog.split("\n").filter(s=>s.includes("在你"));const want=v.title.includes("灯台")?"旧灯台":v.title.includes("镜门")?"镜门":(ash?(v.leg==="1"?"灯架":"鼠洞"):(v.leg==="1"?"鼠洞":"灯架"));
       const dest=lines.find(x=>x.includes(want));assert(dest,"地图中没有"+want+" "+m.dialog);
       const heading=["北","东","南","西"];const distances={};for(const s of dest.matchAll(/([北东西南])\s*(\d+)\s*格/g))distances[s[1]]=Number(s[2]);
       let dir=heading.indexOf(v.direction.match(/面朝(.)/)[1]);let travel=[];
       for(const desired of ["北","南","西","东"]){
         const dist=distances[desired]||0;if(!dist)continue;
         const goal=heading.indexOf(desired),diff=(goal-dir+4)%4;
         if(diff===3)travel.push("turn-left");else for(let n=0;n<diff;n++)travel.push("turn-right");
         for(let n=0;n<dist;n++)travel.push("step");dir=goal;
       }
       assert(travel.length,"未找到前进动作 "+dest);
       for(const a of travel){const d=await snap();if(d.phase!=="walk")break;assert(d.options.some(o=>o.id===a&&!o.disabled),JSON.stringify(d));await take(a)}
       continue;
     }
     let id;
     if(v.phase==="contract")id=ash?"order-ash":"order-clasp";
     if(v.phase==="gear")id=ash?"gear-hook":"gear-plate";
     if(v.phase==="gather")id="gather-ash";
     if(v.phase==="fight"){await once(kind+"-首手");id=pickCard(v);if(v.text.includes("挡下飞扑"))await once(kind+"-飞扑");}
     if(v.phase==="loot"){id=ok("recover-ash")?"recover-ash":ok("take-loot")?"take-loot":ok("take-gear")?"take-gear":"onward"}
     if(v.phase==="market"){
       await once(kind+"-驿柜");
       if(ok("early-order"))id="early-order";
       else if(ok("medicine")&&!shop.has("medicine")){id="medicine";shop.add(id)}
       else if(ash&&ok("buy-plate"))id="buy-plate";
       else if(ok("sell-shell"))id="sell-shell";
       else id="leave-market";
     }
     if(v.phase==="settle")id="commit";
     assert(id&&ok(id),JSON.stringify(v));const n=await take(id);
     if(n.readout.includes("连招，多得")&&id.startsWith("card-")){completedCombos++;await once(kind+"-连招命中")}
     if(n.readout.includes("保住完整狐扣"))await once(kind+"-护扣结果");
   }
   throw Error("输入上限");
 }

 let final;
 try{
 await shot("开场");for(const cmd of input.split(",").filter(Boolean)){
    if(cmd.startsWith("!")){await tour(cmd.slice(1));continue}
    if(cmd.startsWith("@")){await shot(cmd.slice(1));continue}
    if(cmd==="?地图"){await press(main.locator(".crawl-map"));const info=await snap();events.push({op:"地图",body:info.dialog});console.log(JSON.stringify(info));await shot("展开地图");await press(main.getByRole("dialog").getByRole("button",{name:"回到塔内"}));continue}
    if(cmd.startsWith("?")){const menu=cmd.slice(1);await press(main.locator('[data-menu="'+menu+'"]'));const st=await snap();events.push({op:"查"+menu,body:st.dialog});await press(main.getByRole("dialog").getByRole("button",{name:"合上"}));continue}
    if(cmd.startsWith("+")){await press(main.getByRole("dialog").getByRole("button",{name:cmd.slice(1)}));continue}
    await take(cmd);
 }
 final=await snap();console.log(JSON.stringify(final));
 }catch(err){errors.push(err.stack);console.error(err.stack);process.exitCode=1}
 finally{const end=await snap();fs.writeFileSync(path.join(output,"轨迹.json"),JSON.stringify({url,bundle:source.startsWith("http")?null:crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),width:phone?390:1280,profile,events,screens,end,errors},null,2));await br.close()}
})().catch(e=>{console.error(e);process.exitCode=1});