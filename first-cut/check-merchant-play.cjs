/* Replay public controls on the local candidate. --video also records the real browser tab and game sound. */
"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { parseArgs } = require("node:util");
const { performance } = require("node:perf_hooks");

const root = path.resolve(__dirname, "..");
const { values } = parseArgs({options:{
  bundle:{type:"string"}, out:{type:"string"}, device:{type:"string", default:"all"},
  route:{type:"string", default:"all"}, video:{type:"boolean"}, help:{type:"boolean"}
}});
const bundle = path.resolve(values.bundle || path.join(root, "evidence/一印两价/一印两价.html"));
const out = path.resolve(values.out || path.join(root, "evidence/参赛短局/实操"));
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const devices = ["desk","mobile"], routes = ["0","1","2","cold","small","large","rescue"];

async function localServer(bytes) {
  const pathname = "/" + encodeURIComponent(path.basename(bundle));
  const server = http.createServer((req,res)=>{
    if (req.url === "/favicon.ico") return res.writeHead(204).end();
    if (new URL(req.url,"http://localhost").pathname !== pathname) return res.writeHead(404).end();
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}).end(bytes);
  });
  await new Promise((ok,bad)=>{server.once("error",bad);server.listen(0,"127.0.0.1",ok)});
  return {url:"http://127.0.0.1:"+server.address().port+pathname,
    close:()=>new Promise(resolve=>server.close(resolve))};
}

async function launchBrowser() {
  const { chromium } = require("playwright");
  const options = values.video ? {ignoreDefaultArgs:["--mute-audio"],args:[
    "--auto-accept-this-tab-capture","--enable-usermedia-screen-capturing",
    "--auto-select-tab-capture-source-by-title=照影廊 · 一印两价｜斩妖塔"
  ]} : {};
  if (process.env.BROWSER_EXECUTABLE) return chromium.launch({...options,executablePath:process.env.BROWSER_EXECUTABLE});
  const failures = [];
  for (const channel of ["chrome",undefined,"msedge"]) {
    try {return await chromium.launch({...options,channel})} catch (err) {failures.push(err)}
  }
  throw new AggregateError(failures,"A local Chromium browser is required.");
}

async function startCapture(page) {
  return page.evaluate(async ()=>{
    const stream = await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},preferCurrentTab:true,
      audio:{autoGainControl:false,echoCancellation:false,noiseSuppression:false,restrictOwnAudio:false,suppressLocalAudioPlayback:false}});
    const video = stream.getVideoTracks()[0]?.getSettings();
    if (video?.displaySurface !== "browser" || stream.getAudioTracks().length !== 1) {
      stream.getTracks().forEach(track=>track.stop());throw Error("Expected only the game tab with audio");
    }
    const recorder = new MediaRecorder(stream,{mimeType:"video/webm;codecs=vp8,opus",videoBitsPerSecond:7500000});
    const chunks=[];
    recorder.ondataavailable = event=>{if(event.data.size)chunks.push(event.data)};
    window.finishMerchantCapture = ()=>new Promise(resolve=>{
      recorder.onstop = ()=>{
        const reader=new FileReader();
        reader.onload=()=>{stream.getTracks().forEach(track=>track.stop());resolve(reader.result.split(",")[1])};
        reader.readAsDataURL(new Blob(chunks,{type:"video/webm"}));
      };
      recorder.stop();
    });
    recorder.start(1000);
    return {width:video.width,height:video.height,frameRate:video.frameRate,displaySurface:video.displaySurface,audioTracks:1};
  });
}
function srtTime(ms) {
  const t=Math.floor(Math.max(0,ms));
  const pad=(v,n=2)=>String(v).padStart(n,"0");
  return pad(Math.floor(t/3600000))+":"+pad(Math.floor(t/60000)%60)+":"+pad(Math.floor(t/1000)%60)+","+pad(t%1000,3);
}
function ffmpeg(args,cwd) {
  return execFileSync(process.env.FFMPEG || "ffmpeg",["-hide_banner","-loglevel","error","-y",...args],
    {cwd,encoding:"utf8",windowsHide:true,maxBuffer:16*1024*1024});
}
function probe(file) {
  return JSON.parse(execFileSync(process.env.FFPROBE || "ffprobe",["-v","error","-show_entries",
    "format=duration,size:stream=codec_name,codec_type,width,height,avg_frame_rate","-of","json",file],
    {encoding:"utf8",windowsHide:true}));
}
async function finishClip(page, directory, route, cues, start) {
  const end = performance.now()-start;
  const buffer = await page.evaluate(()=>window.finishMerchantCapture());
  const base="route-"+route;
  await fs.writeFile(path.join(directory,base+".webm"),Buffer.from(buffer,"base64"));
  const captions=cues.map((cue,i)=>[i+1,srtTime(cue.ms)+" --> "+srtTime(cues[i+1]?.ms??end),cue.text,""].join("\n")).join("\n");
  await fs.writeFile(path.join(directory,base+".srt"),captions,"utf8");
  const vf="fps=30,scale=1280:720,pad=1280:810:0:0:0x162123,subtitles="+base+
    ".srt:force_style='FontName=Microsoft YaHei,FontSize=16,Outline=0,Shadow=0,PrimaryColour=&H00DCECEF,Alignment=2,MarginV=9'";
  ffmpeg(["-i",base+".webm","-vf",vf,"-c:v","libx264","-pix_fmt","yuv420p","-preset","veryfast","-crf","20",
    "-c:a","aac","-b:a","128k","-movflags","+faststart",base+".mp4"],directory);
  return {base,durationMs:Math.round(end),cues};
}

async function play(browser, url, hash, device, route, recordingDir) {
  const phone=device==="mobile", film=values.video && !phone && ["0","1","2"].includes(route);
  const capacity=["small","large"].includes(route),cold=route==="cold",quantity=capacity?null:cold?1:Number(route);
  const seed=cold?"2":"1",resale=cold?1:4;
  const prefix=route==="rescue"?(phone?"手机":"桌面")+"-留印零石":(phone?"手机离线":"桌面HTTP")+"-"+(capacity?(route==="large"?"扩囊":"原囊"):(cold?"常市":"")+quantity+"份绢");
  const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:720},
    deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone,offline:phone,reducedMotion:film?"no-preference":"reduce"});
  const page=await context.newPage(), errors=[],events=[],captures=[],cues=[];
  const started=performance.now();
  let videoStart=null,media=null,clip=null;
  page.setDefaultTimeout(10000);
  page.on("pageerror",error=>errors.push(error.message));
  page.on("requestfailed",req=>errors.push(req.url()+" "+req.failure()?.errorText));
  page.on("response",res=>{if(res.status()>=400)errors.push(res.url()+" "+res.status())});
  const $=selector=>page.locator(selector),id=name=>$("#"+name);
  const state=()=>id("game").evaluate(node=>({...node.dataset}));
  const status=()=>id("status").innerText();
  const wait=phase=>page.waitForFunction(phase=>document.querySelector("#game").dataset.phase===phase,phase);
  const press=target=>phone?target.tap():target.click();
  const ms=()=>Math.round(performance.now()-started);
  const record=(action,extra={})=>events.push({ms:ms(),action,...extra});
  const hold=async t=>{if(film)await page.waitForTimeout(t)};
  async function say(message,pause=0) {
    if(videoStart!==null)cues.push({ms:Math.max(0,Math.round(performance.now()-videoStart)),text:message});
    await hold(pause);
  }
  async function click(name,next) {
    const button=id(name);
    const label=await button.getAttribute("aria-label"),command=await button.getAttribute("data-command");
    await press(button);
    if(next)await wait(next);
    record(name,{label,command,phase:(await state()).phase});
  }
  async function shot(label) {
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const file=prefix+"-"+label+".jpg";
    await page.screenshot({path:path.join(out,file),quality:90});captures.push(file);
  }
  async function lot(name,tab="cargo") {
    const button=$('button.hitbox[data-lot="'+name+'"]');
    if(!await button.isVisible())await click("market-"+tab);
    await button.waitFor();
    await page.waitForFunction(name=>{const el=document.querySelector('.hitbox[data-lot="'+name+'"]');return el && !el.hidden && !el.disabled},name);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const box=await button.boundingBox();
    // On the painted price plaque the entire rectangle is an intentional target.
    const x=box.x+box.width/2, y=box.y+box.height-8;
    if(phone)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
    await page.waitForFunction(name=>document.querySelector("#game").dataset.lot===name,name);
    record("验货",{name,quote:await status()});
  }
  async function hit() {
    const before=await state();await click("strike");
    await page.waitForFunction(previous=>{
      const game=document.querySelector("#game").dataset;
      return game.phase!=="swing"&&(game.phase!=="idle"||game.foe!==previous);
    },before.foe);
    const after=await state();
    record("出剑结算",{foeBefore:+before.foe,foeAfter:+after.foe,hp:+after.hp});
    return after;
  }
  async function combat(next) {
    let n=0;
    while((await state()).phase==="idle" && n<12) {await hit();n++}
    await wait(next);return n;
  }
  async function buySell(expectedGold,next) {
    const before=+(await state()).gold;
    await click("primary",next);
    await page.waitForFunction(gold=>+document.querySelector("#game").dataset.gold===gold,expectedGold);
    record("成交",{before,after:expectedGold,receipt:await status()});
  }
  async function openBag() {
    await click("profile-open");
    await click("folio-bag-tab");
  }
  const bagText=()=>id("folio-body").innerText();
  const bagAction=action=>$('button[data-bag-action="'+action+'"]');
  async function tradeRoute() {
    await lot("abacus");
    await say("用旧铜铃交换算盘。每带 4 石进战，第一剑多 1 伤。",1050);
    await click("primary");assert.equal(+(await state()).gold,7);
    const entry=7-2*quantity;
    if(quantity){
      await lot("silk");
      if(quantity===2)await click("market-quantity");
      const offer=await status();
      assert(offer.includes("每份 2 石 × "+quantity) && offer.includes("合 "+(quantity*2)+" 石") && offer.includes("余 "+entry+" 石"),offer);
      assert.equal(+(await state()).gold,7,"验货不能提前扣款");
      record("首柜完整报价",{quantity,offer});
      await shot("首柜验价");
      await say("同一张旺市签  ·  "+quantity+" 份绢花 "+(quantity*2)+" 石，留 "+entry+" 石上路。",1800);
      await buySell(entry);
    }
    if(!quantity){
      await lot("silk");
      await shot("看价留钱");await say("这一局看价后留下全部 7 石，空手过关。",1300);
    }
    await hold(750);
    await click("market-fourth","idle");
    let gateStart=await state();
    assert.equal(+gateStart.gold,entry);assert.equal(+gateStart.foe,19);
    const bonus=Math.min(2,Math.floor(entry/4));
    await say("夜市狐有 19 血。入战持 "+entry+" 石，算盘首击加 "+bonus+" 伤。",1000);
    const first=await hit();assert.equal(+first.foe,19-6-bonus);
    await shot("首剑后");
    await hold(650);
    const hits=1+await combat("finalStall");
    assert.equal(hits,quantity===2?4:3);
    await say("这一关实际出了 "+hits+" 剑。现在去末市兑现货价。",1250);
    await click("primary","counter");
    if(quantity){
      await lot("silk");
      // Sell a single unit on each click to verify both partial settlement and the remaining stack.
      for(let i=0;i<quantity;i++){
        if(i)await lot("silk");
        const ask=await status();
        assert(ask.includes("每份 "+resale+" 石 × 1") && ask.includes("合 "+resale+" 石") && ask.includes("余 "+(entry+resale*(i+1))+" 石"),ask);
        record("末市详细估价",{ask,before:entry+resale*i});
        if(i===0){await shot("末市未付");await hold(800)}
        await buySell(entry+(i+1)*resale);
      }
    }
    await click("market-third","receipt");
    const ended=await state(),profit=+ended.gold-7, receipt=await status();
    assert.equal(profit,(resale-2)*quantity);
    assert(receipt.includes("绢利 "+profit+" 石") && receipt.includes("绢销 "+quantity+" 份"),receipt);
    await say("实收 "+(resale*quantity)+" 石，扣去进价净赚 "+profit+" 石。守关用 "+hits+" 剑。",2300);
    await shot("结账");record("末市账本",{gateStart,first,ended,hits,profit,receipt});
    return {quantity,gateEntryGold:entry,gateEntryHP:+gateStart.hp,firstDamage:19-(+first.foe),hits,
      hpAfter:+ended.hp,silkCost:2*quantity,silkRevenue:resale*quantity,realizedProfit:profit,receipt};
  }
  async function rescueRoute(){
    await lot("knot","gear");await buySell(0);
    await click("market-third","crossroads");await click("market-third","idle");await combat("blood");
    const before=await state();assert.equal(before.gold,"0");assert.equal(before.seals,"1");
    await shot("有余货的血客");assert.match(await status(),/处理地上战利品/);
    await click("secondary");await click("primary");assert.match(await status(),/处理地上战利品/);
    await click("primary");await page.locator("#profile[open]").waitFor();
    const grid=()=>page.locator(".bag-board").boundingBox();
    const box=await grid();
    for(const btn of await page.locator(".bag-pick").all()){
      await press(btn);assert.deepEqual(await grid(),box);
    }
    await shot("零石满囊");await click("folio-close");
    await click("secondary");await click("secondary");
    assert.match(await status(),/放血换石/);assert.equal((await state()).seals,"1");
    await click("market-third","bloodReceipt");await click("primary","counter");await click("market-fourth","idle");
    const hits=await combat("finalStall");
    for(const next of ["finalQuote","finalSale","counter"])await click("primary",next);
    await lot("order-ash","gear");await buySell(5);
    if(await id("market-third").getAttribute("data-command")==="open-loot"){
      await click("market-third");await page.locator("#profile[open]").waitFor();
      const collect=page.locator('[data-bag-action="collect"]');
      if(await collect.isEnabled())await press(collect);
      else{await press(page.locator('[data-bag-action="discard"]'));await press(page.locator('[data-bag-action="confirm-discard"]'))}
      await click("folio-close");
    }
    await click("market-third","receipt");const hpAfter=+(await state()).hp;
    await click("secondary","idle");await openBag();
    const nextBag=await bagText();
    const stack=page.locator('.bag-cell[data-owner="ash"]').first();await press(stack);
    assert.match(await bagText(),/3\s*\/\s*3 份/);await click("folio-close");
    await page.reload();await wait("idle");await openBag();assert.equal(await page.locator('.bag-cell[data-owner="ash"]').count(),0);
    return {hpAfter,blockedScene:before,preservedSeal:true,orderedAsh:3,claimedOnce:true,hits};
  }
  async function capacityRoute() {
    // The haul is the optional, higher-yield side path announced at the crossroads.
    // Keep both routes identical except the lining and the items physical room allows.
    const expanded=route==="large";
    await lot("ash");await buySell(8);
    await lot("hook","gear");await buySell(3);
    if(expanded){await lot("lining");await buySell(0)}
    await click("market-third","crossroads");
    await shot("搬仓预告");
    await click("market-third","idle");
    await combat("blood");
    if(expanded)await openBag();
    else{
      assert.match(await status(),/处理地上战利品/);
      await click("primary");await page.locator("#profile[open]").waitFor();
    }
    const before=await bagText(),cells=$("button.bag-cell");
    assert.equal(await cells.count(),expanded?16:12);
    record("仓货待拾",{expanded,bag:before});
    await shot("搬仓入囊");
    const floorItems=name=>$('button.bag-pick[data-piece="'+name+'"]');
    const carried=name=>$('canvas.bag-icon[data-piece="'+name+'"]');
    const initialShells=await carried("ink-shell").count(),initialAshStacks=await carried("ash").count();
    assert.equal(initialShells,expanded?3:2);
    assert.equal(initialAshStacks,expanded?4:3);
    assert.equal(await floorItems("ink-shell").count(),expanded?0:1);
    assert.equal(await floorItems("ash").count(),expanded?0:1);
    assert.equal(await $('button.bag-cell:not([data-owner=""])').count(),expanded?16:12);
    for(const name of ["ink-shell","ash"]){
      if(expanded)break;
      const picker=floorItems(name);
      await press(picker);
      assert.equal(await bagAction("collect").isEnabled(),false);
      await press(bagAction("discard"));await press(bagAction("cancel"));
      assert.equal(await picker.count(),1,"取消放弃应保留待收物");
      await press(bagAction("discard"));await press(bagAction("confirm-discard"));
      record("放弃放不下的巢货",{name});
    }
    await click("folio-close");await click("market-third","bloodReceipt");await click("primary","counter");
    const startGold=+(await state()).gold;
    await lot("ink-shell","gear");await buySell(startGold+2);
    await openBag();
    const ashCell=$('button.bag-cell[data-owner="ash"]').first();
    await press(ashCell);const originalStack=await ashCell.getAttribute("data-instance");
    const previously=await carried("ash").evaluateAll(items=>items.map(i=>i.dataset.instance));
    assert(await bagAction("split").isEnabled());await press(bagAction("split"));
    const afterSplit=await carried("ash").evaluateAll(items=>items.map(i=>i.dataset.instance));
    const newStack=afterSplit.find(x=>!previously.includes(x));
    assert(newStack && afterSplit.length===previously.length+1);
    const stackCell=instance=>$('button.bag-cell[data-instance="'+instance+'"]').first();
    const frameBox=()=>page.locator(".bag-board").boundingBox();
    const beforeSwitch=await frameBox();
    await press(stackCell(originalStack));assert.deepEqual(await frameBox(),beforeSwitch);
    assert.match(await bagText(),/2\s*\/\s*3 份/);
    await press(stackCell(newStack));assert.match(await bagText(),/1\s*\/\s*3 份/);
    await shot("拆出一份");record("拆叠",{originalStack,newStack});
    await click("folio-close");await lot("ash");
    const choose=id("market-stack");
    assert.match(await choose.getAttribute("aria-label"),/第 1 叠/);
    await click("market-stack");
    assert.match(await choose.getAttribute("aria-label"),/第 2 叠/);
    const targetStack=afterSplit[1];
    await buySell(startGold+3);const saleNotice=await status();
    await openBag();
    const observed={};
    for(const key of afterSplit){
      await press(stackCell(key));
      const detail=await $(".bag-detail .bag-meta").innerText();
      const count=detail.match(/(\d+)\s*\/\s*3 份/);
      assert(count,detail);observed[key]=+count[1];
      const beforeCount=key===newStack?1:key===originalStack?2:3;
      assert.equal(observed[key],beforeCount-(key===targetStack?1:0),"按份出售只能改变选中货叠");
    }
    record("按份售灰",{targetStack,observed,notice:saleNotice});
    await click("folio-close");
    // Sell each remaining unit to verify that the quote refreshes on the actual UI.
    for(let k=1;k<initialShells;k++){
      await lot("ink-shell","gear");await buySell(+(await state()).gold+2);
    }
    const ashQuantity=initialAshStacks*3;
    for(let k=1;k<ashQuantity;k++){await lot("ash");await buySell(+(await state()).gold+1)}
    const afterSale=+(await state()).gold;
    assert.equal(afterSale,expanded?18:16);
    await shot("巢货变现");
    await click("market-fourth","idle");
    const gateStart=await state();assert.equal(+gateStart.hp,15);
    const hits=await combat("finalStall");
    await click("primary","counter");await click("market-third","receipt");
    const ended=await state();
    assert.equal(+ended.hp,4);assert.equal(+ended.gold,afterSale);
    await shot("结账");
    return {expanded,capacity:expanded?16:12,holdings:{shells:initialShells,ash:ashQuantity},
      discarded:{shells:expanded?0:1,ash:expanded?0:3},liningCost:expanded?3:0,
      haulResale:2*initialShells+ashQuantity,afterSale,gateStartHP:+gateStart.hp,hpAfter:+ended.hp,hits,receipt:await status()};
  }

  const actualURL=new URL(phone?pathToFileURL(bundle):url);
  actualURL.searchParams.set("seed",seed);
  try {
    const response=await page.goto(actualURL.href);
    if(!phone)assert.equal(digest(await response.body()),hash);
    await wait("idle");assert.equal(+(await state()).gold,3);
    await combat("drop");
    await click(capacity||route==="rescue"?"secondary":"primary","guide");
    await click("primary","rumor");
    const rumor=await status();assert.match(rumor,/封蜡绢|绢/);assert(rumor.includes("每份收 "+resale+" 石") && rumor.includes(cold?"常市":"旺市"),rumor);
    record("道友开市前报价",{rumor});
    if(film){
      media=await startCapture(page);
      videoStart=performance.now();
      await say("第 "+(quantity+1)+" 局  ·  "+(quantity===0?"留钱":"购绢 "+quantity+" 份")+"。同一张塔签，道友预告末市每份收 4 石。",1700);
    }
    if(route==="0")await shot("道友预告");
    for(const stage of ["stall","quote","result","counter"])await click(route==="rescue"&&stage==="result"?"secondary":"primary",stage);
    assert.equal(+(await state()).gold,route==="rescue"?3:7);
    const result=route==="rescue"?await rescueRoute():capacity?await capacityRoute():await tradeRoute();
    const settlement=events.find(e=>e.phase==="receipt");
    assert(settlement,"结账动作未留时间戳");
    const entranceToSettlementMs=settlement.ms,totalAutomationMs=ms();
    if(!film && ["1","cold","0"].includes(route)){
      // Open the same file again; the merchant guild should recognise a settled hot delivery only.
      await page.reload();await wait("idle");
      const restarted=await state();assert.equal(+restarted.gold,3);assert.equal(+restarted.hp,24);
      await click("profile-open");const journal=await page.locator("#folio-body").innerText();
      const joined=route==="1";assert(journal.includes(joined?"已入客籍":"初来行商"),journal);
      await click("folio-close");
      await combat("drop");for(const step of ["guide","rumor","stall"])await click("primary",step);
      const welcome=await status();assert.equal(welcome.includes("你的客印"),joined,welcome);
      result.guildAfterReload={joined,cash:+restarted.gold,hp:+restarted.hp,welcome};
    }
    if(film)clip=await finishClip(page,recordingDir,route,cues,videoStart);
    assert.deepEqual(errors,[]);
    const report={url:actualURL.href,seed,device,flow:route,bundleSHA256:hash,viewport:page.viewportSize(),
      browser:browser.version(),input:phone?"Chromium 390 CSS px 触屏模拟，离线 file":"Chromium 鼠标，环回 HTTP",
      automated:true,entranceToSettlementMs,totalAutomationMs,videoReadingPauses:Boolean(film),media,clip,result,events,captures,errors};
    await fs.writeFile(path.join(out,prefix+".json"),JSON.stringify(report,null,2)+"\n");
    console.log("PASS",prefix,hash,Math.round(entranceToSettlementMs/100)/10+"s",JSON.stringify(result));
    return report;
  } catch(err) {
    const failure={bundleSHA256:hash,error:err.stack,state:await state().catch(()=>null),status:await status().catch(()=>null),
      buttons:await $("button:visible").evaluateAll(bs=>bs.map(b=>({id:b.id,label:b.getAttribute("aria-label")||b.innerText,
        lot:b.dataset.lot,command:b.dataset.command,action:b.dataset.bagAction,disabled:b.disabled}))).catch(()=>[]),events,errors};
    await fs.writeFile(path.join(out,prefix+"-failed.json"),JSON.stringify(failure,null,2));
    await page.screenshot({path:path.join(out,prefix+"-failed.jpg"),quality:85}).catch(()=>{});
    throw err;
  } finally {await context.close()}
}

async function makeMovie(reports,directory) {
  const clips=reports.flatMap(r=>r.clip?[r.clip]:[]);
  assert.equal(clips.length,3);
  await fs.writeFile(path.join(directory,"clips.txt"),clips.map(c=>"file '"+c.base+".mp4'").join("\n")+"\n");
  const target=path.join(directory,"candidate.mp4");
  ffmpeg(["-f","concat","-safe","0","-i","clips.txt","-c","copy","-movflags","+faststart",target],directory);
  const result=probe(target);
  assert.deepEqual(result.streams.map(s=>s.codec_type).sort(),["audio","video"]);
  ffmpeg(["-xerror","-i",target,"-f","null","-"],directory);
  const rms=execFileSync(process.env.FFMPEG||"ffmpeg",["-hide_banner","-v","error","-i",target,"-vn",
    "-af","astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-","-f","null","-"],
    {encoding:"utf8",windowsHide:true,maxBuffer:4000000});
  const levels=[...rms.matchAll(/Peak_level=([-\d.]+)/g)].map(m=>Number(m[1])).filter(Number.isFinite);
  assert(levels.length>0 && Math.max(...levels)>-50,"The captured game soundtrack is silent");
  const videoSHA256=digest(await fs.readFile(target));
  await fs.rename(target,path.join(out,"一印三笔生意.mp4"));
  await fs.writeFile(path.join(out,"实录信息.json"),JSON.stringify({hash:reports[0].bundleSHA256,
    videoSHA256,videoPeakDB:Math.max(...levels),...result,clips},null,2)+"\n");
  for(const {base} of clips)for(const ext of [".mp4",".webm",".srt"])await fs.unlink(path.join(directory,base+ext));
  await fs.unlink(path.join(directory,"clips.txt"));await fs.rmdir(directory);
}

async function writeComparison(reports) {
  const text=["# 短局真实操作对照","",
    "同一 HTML 的 SHA-256 为 `"+reports[0].bundleSHA256+"`。每局独立创建浏览器存储。桌面使用环回 HTTP 和鼠标，手机使用断网 file 页面与 390 × 844 Chromium 触屏模拟。",
    "","| 入口 | 路线 | 过关手数 | 末市气血 | 交易结果 | 从打开至账本 |","| --- | --- | ---: | ---: | --- | ---: |"];
  for(const run of reports) {
    const r=run.result,device=run.device==="desk"?"桌面":"手机";
    const label=r.blockedScene?"留印零石 · 血客返店":r.quantity===undefined?(r.expanded?"16格搬仓":"12格搬仓"):(run.seed==="2"?"常市":"旺市")+r.quantity+"份绢";
    const result=r.blockedScene?"原印卖 7 石，下单 2 石，下局实领 3 灰":r.quantity===undefined?"货卖 "+r.haulResale+" 石，余 "+r.afterSale+" 石":
      "收 "+r.silkRevenue+" 石，绢利 "+r.realizedProfit+" 石";
    text.push("| "+[device,label,r.hits,r.hpAfter,result,(run.entranceToSettlementMs/1000).toFixed(1)+" 秒"].join(" | ")+" |");
  }
  text.push("","耗时从自动打开游戏到读出账本。桌面旺市的录屏路线含字幕阅读停留，其余使用自动点按与游戏自身动画。这里记录自动操作耗时。初玩者的阅读、取舍和实体手机手感仍待观察。",
    "","两条搬仓路线都用首柜 8 石买钩。12 格线路主动确认放弃 1 壳和 3 灰；16 格线路花 3 石扩容，实际多收货值 5 石，结余多 2 石。两端都测试满包取消放弃、拆叠、指定第二叠售一份，并再次打开行囊确认其余货叠数量。",
    "","[桌面旺市两份绢账本](桌面HTTP-2份绢-结账.jpg) · [手机常市亏 1 石](手机离线-常市1份绢-结账.jpg) · [手机扩囊后的巢货](手机离线-扩囊-搬仓入囊.jpg)");
  if(values.video)text.push("","[三条旺市路线连续实录，含游戏原声](一印三笔生意.mp4) · [音视频流、字幕时码及指纹](实录信息.json)");
  await fs.writeFile(path.join(out,"实操对照.md"),text.join("\n")+"\n");
}

async function main() {
  if(values.help){
    console.log("node first-cut/check-merchant-play.cjs [--bundle FILE] [--out DIR] [--device all|desk|mobile] [--route all|0|1|2|cold|small|large|rescue] [--video]");
    console.log("--video captures all three desktop trades with Web Audio and Chinese captions. Requires ffmpeg and ffprobe.");
    return;
  }
  const selectedDevices=values.device==="all"?devices:[values.device],selectedRoutes=values.route==="all"?routes:[values.route];
  assert(selectedDevices.every(x=>devices.includes(x)) && selectedRoutes.every(x=>routes.includes(x)),"invalid route or device");
  assert(!values.video || (selectedDevices.includes("desk") && selectedRoutes.includes("0") && selectedRoutes.includes("1") && selectedRoutes.includes("2")),
    "--video needs all three desktop trades");
  const bytes=await fs.readFile(bundle),hash=digest(bytes);
  await fs.mkdir(out,{recursive:true});
  const recordingDir=values.video?await fs.mkdtemp(path.join(out,".录屏-")):null;
  const server=selectedDevices.includes("desk")?await localServer(bytes):null;
  const reports=[];
  try{
    const browser=await launchBrowser();
    try{
      for(const device of selectedDevices)for(const route of selectedRoutes)
        reports.push(await play(browser,server?.url,hash,device,route,recordingDir));
    }finally{await browser.close()}
    if(values.video)await makeMovie(reports,recordingDir);
    if(selectedDevices.length===devices.length && selectedRoutes.length===routes.length)await writeComparison(reports);
  }finally{if(server)await server.close()}
}
main().catch(err=>{console.error(err);process.exitCode=1});
