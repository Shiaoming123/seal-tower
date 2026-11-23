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
 let final;
 try{
 await shot("开场");for(const cmd of input.split(",").filter(Boolean)){
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