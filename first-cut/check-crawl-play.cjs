/* Both screen sizes drive the visible game, including the fork and all four encounters. */
const assert=require("node:assert/strict"),{chromium}=require("playwright");
const fs=require("node:fs/promises"),path=require("node:path"),http=require("node:http");
const {pathToFileURL}=require("node:url"),{createHash}=require("node:crypto");
const {values}=require("node:util").parseArgs({options:{bundle:{type:"string"},out:{type:"string"}}});
const root=path.resolve(__dirname,".."),bundle=path.resolve(values.bundle||path.join(root,"evidence/一印两价/一印两价.html"));
const out=path.resolve(values.out||path.join(root,"evidence/猎妖供货/第一人称实机"));
async function tryRoute(browser,url,mobile,sha){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile});
  try{
    const page=await context.newPage(),log=[],errors=[],httpRequests=[];
    const dir=path.join(out,mobile?"390离线":"桌面HTTP");await fs.mkdir(dir,{recursive:true});
    page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(/^https?:/.test(r.url()))httpRequests.push(r.url())});
    const q=s=>page.locator(s),push=l=>mobile?l.tap():l.click(),actButton=id=>q('.hunt-commands [data-id="'+id+'"]');
    const phase=()=>q("#hunt").getAttribute("data-phase");
    const shot=name=>page.screenshot({path:path.join(dir,name+".jpg"),quality:85});
    async function act(id){
      await push(actButton(id));log.push(id);
      await page.waitForFunction(()=>!Array.from(document.querySelectorAll(".hunt-commands button")).every(b=>b.disabled));
    }
    await page.goto(url+"?seed=1");await push(q("#hunt-entry"));await actButton("order-ash").waitFor();
    assert.match(page.url(),/play=crawl/);await act(mobile?"order-clasp":"order-ash");await act(mobile?"gear-buckler":"gear-hook");
    await push(page.getByRole("button",{name:"展开路线图"}));await page.getByRole("dialog").waitFor();await shot("俯视舆图");await push(page.getByRole("button",{name:"回到塔内"}));
    await act("turn-right");assert(await actButton("step").isDisabled());await act("turn-left");
    let forks=0,fights=0,combo=false,cashed=false,guarded=false,bartered=false;
    const go=async(...ids)=>{for(const id of ids)await act(id)};
    for(let i=0;i<190;i++){
      const p=await phase(),title=await q(".hunt-text h1").innerText();
      if(!mobile){const b=await q("#hunt").boundingBox();assert.equal(b.x,0);assert.equal(b.width,1280)}
      if(p==="walk"){
        if(title==="走到灯台"){await act("step")}
        else if(title==="在岔口选猎路"){
          forks++;const west=(await q(".hunt-text p").innerText()).includes(mobile?"西边鼠洞":"西边灯架");
          if(forks===1){await page.reload();await actButton("step").waitFor();await shot("01-走廊")}
          await go("step","step",west?"turn-left":"turn-right","step","step");
        }else{
          const label=await q(".crawl-map canvas").getAttribute("aria-label");
          await go("step","step",label.includes("第 3 列")?"turn-right":"turn-left","step","step");
        }
      }else if(p==="gather"){if(forks===0)await act("gather-ash");else await act(mobile&&await actButton("gather-ash").isEnabled()?"gather-ash":"rest")}
      else if(p==="fight"){
        const foe=q(".hunt-foe"),start=await foe.innerText();fights++;guarded=false;
        await shot("战斗"+fights);
        if(fights===1){
          const card=q(".crawl-card:not(:disabled)").first();
          const before=await q(".crawl-hand").innerText();
          if(mobile){
            const cdp=await context.newCDPSession(page),b=await card.boundingBox();
            const point={x:b.x+b.width/2,y:b.y+b.height/2};
            await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
            await q(".crawl-preview").waitFor({state:"visible"});
            await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await cdp.detach();
            await page.waitForFunction(()=>!document.querySelector('.hunt-commands [data-id="end-turn"]')?.disabled);
          }else{await card.hover();await q(".crawl-preview").waitFor({state:"visible"});await shot("读牌");await page.mouse.move(0,0)}
          assert.equal(await q(".crawl-hand").innerText(),before);
        }
        const canvas=q(".hunt-stage > canvas");await canvas.click({position:{x:35,y:85}});assert.equal(await foe.innerText(),start);
        for(let j=0;await phase()==="fight";j++){
          assert(j<55);
          const foeText=await foe.innerText(),threat=await q(".hunt-text p").innerText();
          const isFox=foeText.includes("镜狐"),keep=mobile&&isFox&&!guarded;
          const cards=await q(".crawl-card:not(:disabled)").evaluateAll(els=>els.map(b=>({id:b.dataset.id,fx:b.dataset.fx,
            cost:Number(b.querySelector(".crawl-cost").textContent),text:b.querySelector("small").textContent})));
          const canGuard=cards.filter(c=>c.fx==="guard"),canHit=cards.filter(c=>c.fx==="strike");
          const last=await q(".hunt-readout").innerText();if(/保住完整狐扣/.test(last))guarded=true;
          const block=Number((await q(".hunt-stock").innerText()).match(/格挡\s*(\d+)/)?.[1]||0);
          const enemyHp=Number(foeText.match(/(\d+)\//)[1]);let pick;
          if(mobile&&foeText.includes("掀货筐")){
            if(block<5)pick=canGuard.sort((a,b)=>Number(b.text.match(/加 (\d+)/)?.[1])-Number(a.text.match(/加 (\d+)/)?.[1]))[0];
            if(!pick)pick=canHit[0];
          }else if(keep&&foeText.includes("飞扑")){if(!block)pick=canGuard.sort((a,b)=>b.cost-a.cost)[0]}
          else{
            const strike=canHit.filter(c=>!keep||Number(c.text.match(/打 (\d+)/)?.[1]||0)<enemyHp);
            const current=Number((await q(".hunt-text h1").innerText()).match(/连招 (\d)/)?.[1]||0);
            const incoming=Number(threat.match(/预计受 (\d+)/)?.[1]||0);
            const free=cards.filter(c=>c.cost===0&&(!keep||c.fx!=="strike"||strike.includes(c)));
            pick=current===0?free[0]:null;
            if(!pick&&incoming>=3)pick=canGuard.find(c=>c.cost===1)||canGuard[0];
            if(!pick)pick=strike.sort((a,b)=>Number(b.text.match(/打 (\d+)/)?.[1])-Number(a.text.match(/打 (\d+)/)?.[1]))[0];
            if(!pick&&!block)pick=canGuard[0];
          }
          if(pick&&pick.text.includes("连招加成"))combo=true;
          await act(pick?.id||"end-turn");
          if((await q(".hunt-readout").innerText()).includes("保住完整狐扣"))guarded=true;
        }
      }else if(p==="loot"){
        if(mobile&&fights===3){
          const b=actButton("trade-freight");assert(await b.isEnabled());await shot("护筐换扣");
          const prior=await q(".hunt-stock").innerText();
          await act("trade-freight");bartered=true;assert.equal(await b.count(),0);
          assert.notEqual(await q(".hunt-stock").innerText(),prior);await page.reload();await actButton("onward").waitFor();
          assert.equal(await b.count(),0);
        }
        const b=actButton("take-loot");if(await b.count()&&await b.isEnabled())await act("take-loot");
        await act("onward");
      }else if(p==="market"){
        await shot("桥驿");assert(await actButton("early-order").isEnabled());await act("early-order");cashed=true;
        if(await actButton("medicine").isEnabled())await act("medicine");await act("leave-market");
      }else if(p==="settle"){await act("commit")}
      else if(p==="done")break;
      else assert.fail("unexpected "+p);
    }
    const ledger=await q(".hunt-ledger").innerText();assert.equal(await phase(),"done");assert(cashed);assert.equal(bartered,mobile);assert.equal(fights,4);assert.match(ledger,/走完三关/);
    assert.match(ledger,/委托交清/);await shot("交割");await page.reload();await actButton("repeat").waitFor();assert.equal(await q(".hunt-ledger").innerText(),ledger);
    await act("repeat");assert.match(await q(".hunt-stock").innerText(),/0\/5/);assert.deepEqual(errors,[]);
    if(mobile)assert.equal(httpRequests.length,0);
    await fs.writeFile(path.join(dir,"重放.json"),JSON.stringify({sha,seed:1,steps:log,ledger,combo,bartered,forks,fights,errors},null,2));
    console.log((mobile?"390 OFFLINE":"1280 HTTP")+": "+fights+" fights, combo="+combo+" "+ledger.replace(/\n+/g," "));
  }finally{await context.close()}
}
(async()=>{
  const bytes=await fs.readFile(bundle),sha=createHash("sha256").update(bytes).digest("hex");
  const server=http.createServer((_q,r)=>r.writeHead(200,{"content-type":"text/html;charset=utf-8"}).end(bytes));await new Promise(r=>server.listen(0,"127.0.0.1",r));
  try{
    const b=await chromium.launch({channel:"chrome"}).catch(()=>chromium.launch());
    try{await Promise.all([
      tryRoute(b,"http://127.0.0.1:"+server.address().port+"/game.html",false,sha),tryRoute(b,pathToFileURL(bundle).href,true,sha)])}finally{await b.close()}
  }finally{server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
