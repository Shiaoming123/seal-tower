/* Offline and HTTP play through the original visible entrance with an empty browser profile. */
"use strict";
const { chromium }=require("playwright");
const assert=require("node:assert/strict");
const { createHash }=require("node:crypto");
const fs=require("node:fs/promises"),path=require("node:path"),http=require("node:http");
const { pathToFileURL }=require("node:url");
const { values }=require("node:util").parseArgs({options:{bundle:{type:"string"},out:{type:"string"}}});
const evidence=path.resolve(__dirname,"../evidence/猎妖供货");
const bundle=path.resolve(values.bundle||path.resolve(__dirname,"../evidence/一印两价/一印两价.html"));
const out=path.resolve(values.out||path.join(evidence,"实机"));
async function play(browser,url,mobile,hash){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile});
  try{
    const page=await ctx.newPage(),errors=[],requests=[],steps=[];
    const folder=path.join(out,mobile?"390离线":"桌面HTTP");await fs.mkdir(folder,{recursive:true});
    page.on("pageerror",err=>errors.push(err.message));
    page.on("request",req=>{if(req.url().startsWith("http"))requests.push(req.url())});
    const click=async l=>mobile?l.tap():l.click();
    const button=id=>page.locator('#hunt .hunt-commands [data-id="'+id+'"]');
    const phase=()=>page.locator("#hunt").getAttribute("data-phase");
    const active=id=>button(id).count().then(n=>n>0&&button(id).isEnabled());
    const shot=name=>page.screenshot({path:path.join(folder,name+".jpg"),quality:82});
    async function act(id){
      const b=button(id);await click(b);steps.push(id);
      if(["strike","guard","flare"].includes(id))await page.waitForFunction(()=>!document.querySelector('.hunt-commands [data-id="strike"]')?.disabled);
    }
    await page.goto(url+"?seed=1");
    await click(page.locator("#hunt-entry"));await click(page.getByRole("link",{name:"侧面机位试玩"}));await button("order-ash").waitFor();await shot("01-接单");
    await click(page.getByRole("button",{name:"人物志"}));await click(page.getByRole("button",{name:"绯绡",exact:true}));
    assert.match(await page.locator("dialog p").innerText(),/渡船/);await click(page.getByRole("button",{name:"合上",exact:true}));
    await act(mobile?"order-clasp":"order-ash");await act(mobile?"gear-buckler":"gear-hook");await act("gather-ash");
    const stock=await page.locator(".hunt-stock").innerText();await page.reload();await button("hunt-moth").waitFor();
    assert.equal(await page.locator(".hunt-stock").innerText(),stock);
    await act(mobile?"hunt-rat":"hunt-moth");
    await click(page.getByRole("button",{name:"货袋",exact:true}));await click(page.getByRole("button",{name:"合上",exact:true}));
    await act("retreat");await click(page.getByRole("button",{name:"继续这一趟",exact:true}));assert.equal(await phase(),"fight");
    await shot("02-首战");
    const caption=page.locator(".hunt-foe"),before=await caption.innerText(),canvas=page.locator(".hunt-stage > canvas");
    await canvas.click({position:{x:5,y:80}});assert.equal(await caption.innerText(),before);
    let fights=0;
    for(let n=0;n<65;n++){
      const next=await phase();
      if(next==="fight"){
        fights++;
        let guards=0;
        for(let turns=0;await phase()==="fight";turns++){
          assert(turns<14);
          const threat=await caption.innerText();
          let id="strike";
          if(mobile&&(/飞扑|伸爪掏灰/.test(threat)))id="guard";
          if(!mobile&&/纸灯蛾/.test(threat)&&!guards){id="guard";guards++}
          if(!mobile&&/飞扑/.test(threat)&&await active("flare")&&/引灯盘/.test(await page.locator(".hunt-stock").innerText()))id="flare";
          await act(id);
        }
      }else if(next==="loot"){
        if(await active("take-loot"))await act("take-loot");
        if(await active("recover-ash"))await act("recover-ash");
        await act("onward");
      }else if(next==="market"){
        await shot("03-桥驿");assert(await active("early-order"));await act("early-order");
        if(!mobile&&await active("buy-plate"))await act("buy-plate");
        if(await active("medicine"))await act("medicine");await act("leave-market");
      }else if(next==="gather"){await act("rest")}
      else if(next==="route"){await act(mobile?"hunt-rat":"hunt-moth")}
      else if(next==="settle"){await act("commit")}
      else if(next==="done")break;
      else assert.fail("Unexpected "+next);
    }
    assert.equal(await phase(),"done");assert.equal(fights,4);assert.deepEqual(errors,[]);
    await shot("04-交割");const ledger=await page.locator(".hunt-ledger").innerText();assert.match(ledger,/委托交清/);
    await page.reload();await button("repeat").waitFor();assert.equal(await page.locator(".hunt-ledger").innerText(),ledger);
    await act("next");assert.match(await page.locator(".hunt-stats").innerText(),/22\/22/);
    assert.match(await page.locator(".hunt-stock").innerText(),/0\/5/);
    if(mobile)assert.equal(requests.length,0,"file build contacted the network");
    await fs.writeFile(path.join(folder,"重放.json"),JSON.stringify({sha256:hash,seed:1,fights,steps,ledger,errors},null,2));
    console.log((mobile?"390 file":"desktop HTTP")+" · "+steps.length+" actions, "+fights+" encounters. "+ledger.split("\n").filter(x=>x.includes("石")).join(" / "));
  }finally{await ctx.close()}
}
(async()=>{
  const bytes=await fs.readFile(bundle),hash=createHash("sha256").update(bytes).digest("hex");
  const server=http.createServer((req,res)=>res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}).end(bytes));
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    const browser=await chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:"chrome"});
    try{await Promise.all([play(browser,"http://127.0.0.1:"+server.address().port+"/hunt.html",false,hash),
      play(browser,pathToFileURL(bundle).href,true,hash)])}finally{await browser.close()}
  }finally{server.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
