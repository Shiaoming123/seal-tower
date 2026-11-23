/* Four real road legs on the candidate HTML. Every game action uses a live, visible control. */
"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs/promises");
const http=require("node:http");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {performance}=require("node:perf_hooks");
const {parseArgs}=require("node:util");
const {pathToFileURL}=require("node:url");

const {values}=parseArgs({options:{
  bundle:{type:"string"},out:{type:"string"},flow:{type:"string",default:"all"},
  video:{type:"boolean"},quick:{type:"boolean"},index:{type:"boolean"},checkPace:{type:"boolean"},help:{type:"boolean"}
}});
const root=path.resolve(__dirname,"..");
const bundle=path.resolve(values.bundle||path.join(root,"evidence/一印两价/一印两价.html"));
const out=path.resolve(values.out||path.join(root,"evidence/参赛短局/押运实操"));
const flows=["normal","express","broken","abort","caravan","mend","coast"];
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

async function startServer(bytes){
  const route="/"+encodeURIComponent(path.basename(bundle));
  const server=http.createServer((req,res)=>{
    if(req.url==="/favicon.ico")return res.writeHead(204).end();
    if(new URL(req.url,"http://localhost").pathname!==route)return res.writeHead(404).end();
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}).end(bytes);
  });
  await new Promise((ok,bad)=>{server.once("error",bad);server.listen(0,"127.0.0.1",ok)});
  return {url:"http://127.0.0.1:"+server.address().port+route,close:()=>new Promise(resolve=>server.close(resolve))};
}
async function launch(record){
  const {chromium}=require("playwright");
  const options=record?{ignoreDefaultArgs:["--mute-audio"],args:[
    "--auto-accept-this-tab-capture","--enable-usermedia-screen-capturing",
    "--auto-select-tab-capture-source-by-title=照影廊 · 一印两价｜斩妖塔"]}:{};
  if(process.env.BROWSER_EXECUTABLE)return chromium.launch({...options,executablePath:process.env.BROWSER_EXECUTABLE});
  const errors=[];
  for(const channel of ["chrome",undefined,"msedge"]){
    try{return await chromium.launch({...options,channel})}catch(err){errors.push(err)}
  }
  throw new AggregateError(errors,"Chromium, Chrome or Edge is required.");
}
async function recorder(page,directory){
  const file=path.join(directory,"normal.webm"),handle=await fs.open(file,"wx");
  let queue=Promise.resolve();
  await page.exposeBinding("appendEscortFrame",(_,base64)=>{
    const bytes=Buffer.from(base64,"base64");
    if(!bytes.length)return;
    queue=queue.then(()=>handle.writeFile(bytes));return queue;
  });
  try{
    const settings=await page.evaluate(async()=>{
      const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:{echoCancellation:false,
        noiseSuppression:false,autoGainControl:false,restrictOwnAudio:false},preferCurrentTab:true});
      const video=stream.getVideoTracks()[0]?.getSettings();
      if(video?.displaySurface!=="browser"||stream.getAudioTracks().length!==1){
        stream.getTracks().forEach(t=>t.stop());throw Error("Expected this game tab and tab audio");
      }
      const media=new MediaRecorder(stream,{mimeType:"video/webm;codecs=vp8,opus",videoBitsPerSecond:3200000});
      const chunks=[];
      let pending=Promise.resolve(),written=0;
      const flush=async()=>{
        while(written<chunks.length){
          const blob=chunks[written];
          const b64=await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=()=>resolve(reader.result.slice(reader.result.lastIndexOf(",")+1));
            reader.onerror=()=>reject(reader.error);
            reader.readAsDataURL(blob.slice(0,blob.size,"application/octet-stream"));
          });
          await window.appendEscortFrame(b64);
          chunks[written++]=null;
        }
      };
      media.ondataavailable=event=>{
        if(event.data.size)chunks.push(event.data);
        pending=pending.catch(()=>{}).then(flush);
      };
      window.finishEscortFilm=()=>new Promise((resolve,reject)=>{
        media.onstop=()=>{stream.getTracks().forEach(track=>track.stop());pending.then(flush,flush).then(resolve,reject)};
        media.onerror=event=>reject(event.error);
        media.stop();
      });
      media.start(1500);
      return {width:video.width,height:video.height,fps:video.frameRate,audioTracks:1,displaySurface:video.displaySurface};
    });
    return {file,settings,stop:async()=>{try{await page.evaluate(()=>window.finishEscortFilm());await queue}finally{await handle.close()}}};
  }catch(e){await handle.close();throw e}
}
const num=(a,d=1)=>Number(a.toFixed(d));
const srt=t=>{const m=Math.max(0,Math.floor(t*1000)),pad=(v,n=2)=>String(v).padStart(n,"0");
  return pad(Math.floor(m/3600000))+":"+pad(Math.floor(m/60000)%60)+":"+pad(Math.floor(m/1000)%60)+","+pad(m%1000,3)};
const execute=(tool,args,dir)=>execFileSync(process.env[tool.toUpperCase()]||tool,args,
  {encoding:"utf8",windowsHide:true,cwd:dir,maxBuffer:3000000});
async function editFilm(directory,report,rawOrigin){
  const secs=t=>(t-rawOrigin)/1000, windows=[];
  for(const leg of report.legs){
    const last=leg.sightings.at(-1),exit=secs(leg.endMs);
    // The end of every road and its actual station are captured on either side of the cut.
    const branch=report.branches?.find(b=>b.index===leg.index);
    windows.push({start:Math.max(0,exit-(report.branches?.length?10.5:15.5)),end:exit+1,
      caption:"第 "+leg.index+" 段 · 第 "+(leg.index*6)+" 处正线路标，"+last.label,
      stop:branch?"进驿后转道岔市。":report.stops[leg.index-1]?.tradeText||"到镇交货"});
    if(branch){
      const descriptions=["领一份灰，准备往水驿周转。","拿自有灯灰换一件墨蠹壳。","卖出一份灯灰，现收 3 石。"];
      const end=secs(branch.endMs);
      windows.push({start:Math.max(exit+1,end-6.5),end:end+.7,
        caption:"第 "+leg.index+" 处岔市 · "+descriptions[leg.index-1],
        stop:report.stops[leg.index-1].tradeText});
      windows.push({still:report.flow+"-驿"+leg.index+"-交易.jpg",duration:2.5,caption:"到站成交画面停帧 · "+report.stops[leg.index-1].tradeText,stop:""});
    }
  }
  windows.push({start:Math.max(windows.filter(w=>w.end!=null).at(-1).end,secs(report.handInMs)-1),end:secs(report.settlementMs),
    caption:"四段交货，回狐柜整备，过关后亲手结清末市账。",stop:""});
  windows.push({still:report.flow+"-末市总账.jpg",duration:3,caption:"末市合账画面停帧 · 守关 "+report.hits+" 手，结余 "+report.final.gold+" 石。",stop:""});
  // The MediaRecorder WebM may have no keyframe index until remuxed.
  execute("ffmpeg",["-hide_banner","-loglevel","error","-y","-i","normal.webm","-c","copy","seekable.mkv"],directory);
  const clips=[];let elapsed=0;
  for(let i=0;i<windows.length;i++){
    const window=windows[i],duration=window.duration||Math.max(0,window.end-window.start);
    if(duration<.25)continue;
    const name="part-"+i;
    const cut=window.stop?Math.max(1,duration-3):duration;
    const cues=["1",srt(0)+" --> "+srt(cut),window.caption,""];
    if(window.stop)cues.push("2",srt(cut)+" --> "+srt(duration),window.stop,"");
    await fs.writeFile(path.join(directory,name+".srt"),cues.join("\n"),"utf8");
    const vf="fps=30,scale=1280:720,pad=1280:810:0:0:0x162123,subtitles="+name+
      ".srt:force_style='FontName=Microsoft YaHei,FontSize=15,Outline=0,Shadow=0,PrimaryColour=&H00E3EDF1,Alignment=2,MarginV=9'";
    const input=window.still?["-loop","1","-framerate","30","-i",path.join(out,window.still),
      "-f","lavfi","-i","anullsrc=r=48000:cl=stereo"]:["-ss",String(num(window.start,3)),"-i","seekable.mkv"];
    execute("ffmpeg",["-hide_banner","-loglevel","error","-y",...input,
      "-t",String(num(duration,3)),"-vf",vf,"-c:v","libx264","-pix_fmt","yuv420p","-crf","21","-preset","veryfast",
      "-c:a","aac","-b:a","128k","-movflags","+faststart",name+".mp4"],directory);
    clips.push(name);elapsed+=duration;
  }
  assert(elapsed>=60 && elapsed<=90,"edited movie must be 60–90 seconds");
  await fs.writeFile(path.join(directory,"list.txt"),clips.map(c=>"file '"+c+".mp4'").join("\n")+"\n");
  execute("ffmpeg",["-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i","list.txt",
    "-c","copy","-movflags","+faststart","escort.mp4"],directory);
  const info=JSON.parse(execute("ffprobe",["-v","error","-show_entries","format=duration,size:stream=codec_name,codec_type,width,height","-of","json","escort.mp4"],directory));
  assert.equal(info.streams.filter(s=>s.codec_type==="audio").length,1);
  assert.equal(info.streams.filter(s=>s.codec_type==="video").length,1);
  assert(+info.format.duration>=60&&+info.format.duration<=90);
  execute("ffmpeg",["-v","error","-xerror","-i","escort.mp4","-f","null","-"],directory);
  const levels=execute("ffmpeg",["-v","error","-i","escort.mp4","-vn","-af","astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-","-f","null","-"],directory);
  const peak=Math.max(...[...levels.matchAll(/Peak_level=([-\d.]+)/g)].map(m=>Number(m[1])).filter(Number.isFinite));
  assert(peak>-55,"recorded audio is silent");
  const file=path.join(out,"四段押运实录.mp4");await fs.rename(path.join(directory,"escort.mp4"),file);
  await fs.writeFile(path.join(out,"视频信息.json"),JSON.stringify({bundleSHA256:report.bundleSHA256,videoSHA256:hash(await fs.readFile(file)),
    normalJourneyMs:report.totalWallMs,fullRunMs:report.fullRunMs,videoPeakDB:peak,windows,streams:info.streams,format:info.format},null,2)+"\n");
  for(const c of clips)for(const ext of [".mp4",".srt"])await fs.unlink(path.join(directory,c+ext));
  for(const f of ["list.txt","normal.webm","seekable.mkv"])await fs.unlink(path.join(directory,f));
  await fs.rmdir(directory);
}

async function run(flow,server,urlHash,target){
  const coast=flow==="coast",caravan=flow==="caravan",mend=flow==="mend",phone=["express","broken","mend"].includes(flow)||(caravan && values.quick);
  const keep=["express","broken","mend"].includes(flow),normal=flow==="normal"||(caravan && !values.quick),damaged=["broken","abort","mend"].includes(flow);
  const recording=normal&&values.video&&(values.flow!=="all"||caravan);
  const browser=await launch(recording);
  const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:720},deviceScaleFactor:phone?2:1,
    hasTouch:phone,isMobile:phone,offline:phone,reducedMotion:"no-preference"});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const actions=[],legs=[],branches=[],stops=[],turnoffs=[],errors=[],snapshots=[],readable=[],pauses=[];
  let media=null,directory=null,rawOrigin=null,closedFilm=false;
  const began=performance.now(),ms=()=>Math.round(performance.now()-began);
  const $=selector=>page.locator(selector),gate=$("#game"),overlay=$("#escort-view");
  const state=()=>gate.evaluate(g=>({...g.dataset}));
  const routeState=()=>overlay.evaluate(root=>({
    ...root.dataset,visible:document.visibilityState==="visible",
    title:root.querySelector(".escort-ledger h3")?.innerText,
    desc:root.querySelector(".escort-desc")?.innerText,
    notice:root.querySelector(".escort-notice")?.innerText,
    milestone:root.querySelector(".escort-mile")?.innerText,
    entries:Object.fromEntries([...root.querySelectorAll(".escort-entry")].map(n=>[n.firstElementChild.innerText,n.lastElementChild.innerText])),
    stats:Object.fromEntries([...root.querySelectorAll(".escort-stat")].map(n=>[n.firstElementChild.innerText,n.lastElementChild.innerText])),
    manifest:root.querySelector(".escort-manifest")?.innerText
  }));
  const press=loc=>phone?loc.tap():loc.click();
  const until=stage=>page.waitForFunction(expected=>document.querySelector("#game").dataset.phase===expected,stage);
  const option=name=>$('button[data-escort-action="'+name+'"]');
  const firstNumber=v=>Number(String(v).match(/[-+]?\d+/)?.[0]);
  async function command(control,type,next){
    const label=await control.getAttribute("aria-label")||await control.innerText();
    await press(control);actions.push({ms:ms(),id:type,label});
    if(next)await until(next);
  }
  const play=(id,next)=>command($("#"+id),id,next);
  const escort=id=>command(option(id),id);
  async function shot(name){
    const file=flow+"-"+name+".jpg";await page.screenshot({path:path.join(out,file),quality:89});
    snapshots.push(file);
  }
  async function fight(next){
    let count=0;
    while((await state()).phase==="idle" && count<10){
      const before=await state();await play("strike");
      await page.waitForFunction(prev=>{const s=document.querySelector("#game").dataset;
        return s.phase!=="swing"&&(s.phase!=="idle"||s.foe!==prev)},before.foe);
      count++;
    }
    await until(next);return count;
  }
  async function changed(before){
    await page.waitForFunction(prev=>{
      const d=document.querySelector("#escort-view").dataset;
      return d.stage!==prev.stage||d.leg!==prev.leg||d.marker!==prev.marker||d.fork!==prev.fork;
    },{stage:before.stage,leg:before.leg,marker:before.marker,fork:before.fork},{timeout:60000});
  }
  async function inspectPack(){
    const begin=ms();
    await command($('button[data-escort="pack"]'),"打开手札");await $("#profile[open]").waitFor();
    const sample=()=>overlay.evaluate(el=>[el.dataset.fork,el.dataset.marker,el.querySelector(".escort-rail-fill").style.transform]);
    const paused=await sample();
    await play("folio-bag-tab");await press($('button.bag-cell[data-owner="seal"]').first());
    assert((await $("#folio-body").innerText()).includes("灯纹印"),"托运的原印应可从手札查到");
    await shot("停驶查囊");assert.deepEqual(await sample(),paused,"手札中车辆仍在行驶");
    await play("folio-close");assert((await routeState()).notice.includes("横索"),"合起行囊后要恢复当前险情提示");pauses.push({type:"手札",ms:ms()-begin,position:paused});
  }
  async function driveMark(index,mark,branch){
    const detail={mark,decisions:[],beginMs:ms()};
    const start=await routeState();
    if(start.driving==="continuous"){
      assert.equal(start.stage,"road");assert.equal(start.waiting,"false");assert.equal(+start.leg,index-1);
      if(branch)assert.equal(start.branchRoad,"true");else assert.equal(+start.marker,mark-1);
      if(flow==="express"&&index===1&&mark===1&&!branch)await inspectPack();
      const bad=damaged&&index===1&&!branch;
      const choice=bad?(start.cue==="right"?"left":"right"):start.cue;
      if(!coast&&choice!==start.selected){
        await command(option(choice),"应对/"+choice);
        detail.decisions.push({cue:start.cue,choice,ms:ms(),title:start.title,label:actions.at(-1).label});
      }
      if(branch)await shot("岔道"+index);
      else if(mark===3)await shot("第"+index+"程");
      detail.label=detail.decisions.at(-1)?.label.split(/[，。]/)[0]||"沿本辙驶过";
      detail.track=start.track;detail.cue=start.cue;
      detail.boxes=firstNumber(start.stats["在车"]);
      await changed(start);detail.endMs=ms();return detail;
    }
    for(let f=0;f<3;f++){
      const before=await routeState();
      assert(before.visible,"游戏标签页不可见");
      assert.equal(before.stage,"road");assert.equal(+before.leg,index-1);
      if(branch)assert.equal(before.branchRoad,"true");
      else assert.equal(+before.marker,mark-1);
      assert.equal(+before.fork,f,"每个路标需依次择岔两次、处理货箱一次");
      if(flow==="express" && index===1 && mark===1 && f===0){
        await inspectPack();
      }
      const cue=f<2?before.laneCue:before.cue;
      const permitted=f<2?["left","right"]:["left","right","brace"];
      assert(permitted.includes(cue),"路牌给出的引导必须有对应按钮");
      const wrong=damaged && index===1;
      const choice=wrong?permitted.find(c=>c!==cue):cue;
      const control=f<2?$('button[data-escort-lane="'+choice+'"]'):option(choice);
      await command(control,(f<2?"择岔/":"应对/")+choice);
      detail.decisions.push({fork:f,cue,choice,ms:ms(),title:before.title,milestone:before.milestone,label:actions.at(-1).label});
      if(branch && f===1)await shot("岔道"+index);
      if(!branch && mark===3 && f===1)await shot("第"+index+"程");
      await changed(before);
      if(f===2)detail.label=actions.at(-1).label.split(/[，。]/)[0];
    }
    detail.endMs=ms();return detail;
  }
  async function station(index){
    const enter=ms(),approach=await routeState(),trades=[];
    if(approach.stage==="turnoff"){
      assert(approach.desc.includes("石"),"拐市前需看到价格");
      if(coast){
        await changed(approach);const passed=await routeState();
        assert.equal(+passed.leg,index);assert.equal(passed.stage,"road");
        turnoffs.push({index,entered:false,ms:ms()-enter,advert:approach.desc,cash:passed.stats["灵石"]});return;
      }
      await shot("驿"+index+"-路牌");
      await command($('button[data-escort="enter-market"]'),"拐入驿市");
    }
    const before=await routeState();assert.equal(before.stage,"station");
    const atMarket=ms();
    if(approach.stage==="turnoff")turnoffs.push({index,entered:true,ms:atMarket-enter,advert:approach.desc,cash:before.stats["灵石"]});
    async function trade(id){
      const prev=await routeState();await escort(id);const after=await routeState();
      trades.push({id,label:actions.at(-1).label,before:prev.stats,after:after.stats,notice:after.notice,manifest:after.manifest});
      return after;
    }
    let tradeText;
    if(caravan||mend&&index===3){
      const startMs=ms();await escort("visit-branch");
      const start=await routeState();assert.equal(start.branchRoad,"true");
      const detail=await driveMark(index,1,true),endMs=ms();
      const arrival=await routeState();assert.equal(arrival.stage,"branchMarket");
      await shot("岔市"+index);
      const id=mend?"branch-mend":["branch-ash","branch-shell","branch-sale"][index-1];
      const settled=await trade(id);
      assert.equal(settled.stage,"station");assert.equal(+settled.leg,index-1);
      branches.push({index,startMs,endMs,roadWallMs:endMs-startMs,arrived:arrival,selected:id,settled,sighting:detail});
    }
    if(damaged){
      if(flow==="abort"){
        assert.equal(firstNumber(before.stats["在车"]??before.stats["完封"]),0);
        await trade("patch");await trade("buy-ash");
        tradeText="受损后用一份灰补封，购货后中止押运。";
      }else tradeText=mend&&index===3?"在桥脚夜摊免费补好一箱。":"保留原印，本驿暂缓修补与交易。";
    }else{
      const planned=[["buy-ash","buy-ash"],["sell-ash","sell-ash","buy-shell"],["sell-shell"]][index-1];
      for(const id of planned)await trade(id);
      tradeText=["杉桥买入两份灯灰，付 2 石。","水驿卖两份灯灰，收 6 石；进一壳，付 2 石。","挂铃栈卖墨蠹壳，收 4 石。"][index-1];
    }
    const settled=await routeState();
    await shot("驿"+index+"-交易");
    await escort(flow==="abort"?"abort":"continue");
    const result={index,enterMs:atMarket,exitMs:ms(),before:before.stats,after:settled.stats,
      manifest:settled.manifest,tradeText,trades,notice:settled.notice};
    stops.push(result);
  }
  try{
    const startURL=phone?pathToFileURL(target):new URL(server);
    startURL.searchParams.set("seed","1");
    page.on("pageerror",err=>errors.push(err.message));
    page.on("requestfailed",r=>errors.push(r.url()+" "+r.failure()?.errorText));
    page.on("response",r=>{if(r.status()>=400)errors.push(r.url()+" "+r.status())});
    const response=await page.goto(startURL.href);
    if(!phone)assert.equal(hash(await response.body()),urlHash);
    await until("idle");const firstSwordStartMs=ms();await fight("drop");
    for(const [id,stage] of [["secondary","guide"],["primary","rumor"],["primary","stall"],["primary","quote"],
      [keep?"secondary":"primary","result"],["primary","counter"]])await play(id,stage);
    const initial=await state();assert.equal(+initial.gold,keep?3:7);
    await play("market-escort");await option("start").waitFor();
    const offer=await routeState();assert.equal(offer.stage,"offer");readable.push({phase:"offer",view:offer});
    if(recording){
      directory=await fs.mkdtemp(path.join(out,".录制-"));media=await recorder(page,directory);rawOrigin=ms();
    }
    await shot("接单");
    // Observe the same rendered distance bar players see. This is independent of the route clock.
    await page.evaluate(()=>{
      let prev=null,frame=0;
      const clock={movingMs:0,waitingAtForkMs:0,journalMs:0,otherStationaryRoadMs:0,roadFrames:0};
      const step=time=>{
        const root=document.querySelector("#escort-view"),road=!root.hidden && root.dataset.stage==="road";
        const entry={time,road,leg:root.dataset.leg,waiting:root.dataset.waiting==="true",
          journal:!!document.querySelector("#profile[open]"),position:root.querySelector(".escort-rail-fill")?.style.transform};
        if(prev?.road && road && entry.leg===prev.leg){
          const dt=time-prev.time;
          if(entry.journal||prev.journal)clock.journalMs+=dt;
          else if(entry.position!==prev.position)clock.movingMs+=dt;
          else if(entry.waiting||prev.waiting)clock.waitingAtForkMs+=dt;
          else clock.otherStationaryRoadMs+=dt;
          clock.roadFrames++;
        }
        prev=entry;frame=requestAnimationFrame(step);
      };
      frame=requestAnimationFrame(step);
      window.readEscortRoadClock=()=>{cancelAnimationFrame(frame);return clock};
    });
    const contracted=ms();
    await escort("start");
    if(!normal)await command($('button[data-escort="pace"]'),"催马");
    for(let index=1;index<=4;index++){
      const startMs=ms(),sightings=[];
      for(let mark=1;mark<=6;mark++){
        sightings.push(await driveMark(index,mark,false));
      }
      const endMs=ms(),landed=await routeState();
      legs.push({index,startMs,endMs,roadWallMs:endMs-startMs,atArrival:landed.stats,sightings});
      console.log(flow,"第"+index+"程",num((endMs-startMs)/1000)+"s",landed.stage,landed.stats);
      if(index<4){
        await station(index);
        if(flow==="abort")break;
      }else assert.equal(landed.stage,"delivery");
    }
    let delivery;
    if(flow!=="abort"){
      delivery=await routeState();await shot("交货前");await escort("deliver");
    }
    const paid=await routeState(),handInMs=ms();
    assert.equal(paid.stage,"done");
    if(flow!=="abort"){
      assert.equal(firstNumber(paid.entries["实收脚程"]??paid.entries["脚程"]),2);
      assert.equal(firstNumber(paid.entries["实收箱钱"]??paid.entries["交货"]),mend?1:(damaged||coast)?0:3);
    }
    readable.push({phase:"done",view:paid});await shot("镖账");
    await escort("return");await until("counter");
    const returned=await state();
    assert.equal(+returned.gold,coast?9:caravan?21:mend?6:flow==="normal"?18:flow==="express"?14:flow==="broken"?5:6);
    assert.equal(+returned.seals,keep?1:0);
    await play("market-fourth","idle");
    const hits=await fight("finalStall");
    if(keep){
      for(const next of ["finalQuote","finalSale","counter"])await play("primary",next);
    }else await play("primary","counter");
    await play("market-third","receipt");const settlementMs=ms(),final=await state();
    assert.equal(+final.gold,+returned.gold+(keep?7:0));
    await shot("末市总账");
    const receipt=await $("#status").innerText();assert.deepEqual(errors,[]);
    const branchRoadMs=branches.reduce((sum,b)=>sum+b.roadWallMs,0);
    const roadMs=legs.reduce((sum,l)=>sum+l.roadWallMs,branchRoadMs);
    const stationaryMs=stops.reduce((sum,s)=>sum+s.exitMs-s.enterMs,0)-branchRoadMs;
    const report={flow,seed:"1",bundleSHA256:urlHash,url:startURL.href,browser:browser.version(),viewport:page.viewportSize(),
      mode:phone?"离线 file · 390宽触屏模拟":"环回 HTTP · 桌面鼠标",speed:normal?"常速":"催马",
      automated:true,firstSwordStartMs,fullRunMs:settlementMs-firstSwordStartMs,contractedMs:contracted,handInMs,settlementMs,totalWallMs:settlementMs-contracted,
      observedRoadClock:await page.evaluate(()=>window.readEscortRoadClock()),
      roadMs,stationaryMs,journalPausedMs:pauses.reduce((sum,p)=>sum+p.ms,0),pauses,otherMs:settlementMs-contracted-roadMs-stationaryMs,
      initial,delivery,paid,returned,final,hits,receipt,legs,branches,branchRoadMs,stops,turnoffs,actions,readable,snapshots,errors,media:media?.settings};
    const sightings=[...legs.flatMap(l=>l.sightings),...branches.map(b=>b.sighting)];
    report.landmarks=sightings.length;report.drivingInputs=sightings.flatMap(s=>s.decisions).length;
    assert.equal(report.landmarks,caravan?27:mend?25:flow==="abort"?6:24);
    if(offer.driving==="continuous"){
      assert(report.drivingInputs<=report.landmarks,"每标只需一次选择");
      if(coast){assert.equal(report.drivingInputs,0,"沿原辙无需按键");assert.equal(turnoffs.filter(t=>!t.entered).length,3)}
      else assert(report.drivingInputs<report.landmarks,"沿当前安全车辙不应重复点");
    }else assert.equal(report.drivingInputs,caravan?81:mend?75:flow==="abort"?18:72);
    if(values.checkPace){
      const clear=[],hazards=[];
      for(const mark of sightings){
        const times=mark.boxes&&mark.cue!==mark.track?hazards:clear;
        times.push(mark.endMs-mark.beginMs);
      }
      assert(clear.length&&hazards.length);
      const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
      // Wall time includes rendering. Allow scheduling jitter while separating both driving speeds.
      assert(median(clear)<2100,"无人操作时，安全路标应自动快行");
      assert(Math.min(...hazards)>3000,"即使催马，每个未处理的险标也要给足反应时间");
      assert(turnoffs.every(t=>t.ms>7000),"快行不能缩短报价的阅读时间");
      report.paceCheck={clearMs:clear,hazardMs:hazards,quoteMs:turnoffs.map(t=>t.ms)};
    }
    if(media){report.media.originMs=rawOrigin;await media.stop();closedFilm=true}
    await fs.writeFile(path.join(out,flow+".json"),JSON.stringify(report,null,2)+"\n");
    if(media)await editFilm(directory,report,rawOrigin);
    console.log("PASS",flow,"接单到结账",num(report.totalWallMs/1000)+"s",urlHash);
    return report;
  }catch(e){
    const failure={flow,urlHash,error:e.stack,actions,legs,stops,errors,route:await routeState().catch(()=>null),game:await state().catch(()=>null)};
    await fs.writeFile(path.join(out,flow+"-failure.json"),JSON.stringify(failure,null,2));
    await page.screenshot({path:path.join(out,flow+"-failure.jpg"),quality:84}).catch(()=>{});
    throw e;
  }finally{
    if(media&&!closedFilm)await media.stop().catch(()=>{});
    await context.close();await browser.close();
  }
}

async function buildIndex(bundleSHA256){
  const found=[];
  async function visit(directory){
    for(const entry of await fs.readdir(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      if(entry.isDirectory() && !entry.name.startsWith(".")){await visit(file);continue}
      if(!entry.isFile()||!(/^(normal|caravan|express|broken|abort|mend|coast)\.json$/.test(entry.name)))continue;
      const r=JSON.parse(await fs.readFile(file,"utf8"));
      if(r.bundleSHA256===bundleSHA256)found.push({...r,file:path.relative(out,file).split(path.sep).join("/")});
    }
  }
  await visit(out);
  const full=found.find(r=>r.flow==="caravan" && r.speed==="常速");
  assert(full,"缺少当前候选包的三岔常速合账");
  assert.deepEqual(full.errors,[]);
  const media=JSON.parse(await fs.readFile(path.join(out,"视频信息.json"),"utf8"));
  assert.equal(media.bundleSHA256,bundleSHA256);assert.equal(media.videoSHA256,hash(await fs.readFile(path.join(out,"四段押运实录.mp4"))));
  const round=ms=>(ms/1000).toFixed(2);
  const names={coast:"沿原辙越驿",normal:"正路直运",caravan:"三个岔市",express:"保印直运",broken:"保印坏货",abort:"修补后退契",mend:"保印、夜摊补箱"};
  found.sort((a,b)=>Number(b===full)-Number(a===full)||a.file.localeCompare(b.file));
  const lines=["# 狐灯押运试玩实测","",
    "从第一剑开始，常速走完三个岔市，守关后在末市合账，用时 **"+round(full.fullRunMs)+" 秒**。用鼠标或触点点击画面中可见的游戏控件。游戏计时采用浏览器原始时钟。","",
    "| 路线 | 输入和车速 | 路标 / 驾驶操作 | 实际驶动 | 驿站与岔摊停留 | 接单至合账 | 首剑至合账 | 末市余款 |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for(const r of found){
    assert.deepEqual(r.errors,[]);
    const browserLabel=r.file.includes("Edge")?"Edge ":"";
    const device=browserLabel+(r.mode.includes("触屏")?"390 宽触屏":"桌面鼠标");
    lines.push("| ["+names[r.flow]+"]("+r.file+") | "+device+" · "+r.speed+" | "+r.landmarks+" / "+r.drivingInputs+" | "+
      round(r.observedRoadClock.movingMs)+" 秒 | "+round(r.stationaryMs)+" 秒 | "+round(r.totalWallMs)+" 秒 | "+round(r.fullRunMs)+" 秒 | "+r.final.gold+" 石 |");
  }
  lines.push("","首剑时点取第一场战斗允许出剑的第一帧。签单时点取按下接运按钮前，终点取末市账本打开。实际驶动逐帧观察画面里的里程条；道路段其余时间含路标等待、首帧切换或查看行囊。三站与岔摊停留扣除了支道行车。每条路均从新档、行情签 1 的正常入口起步。触屏结果来自断网的 Chromium 模拟视口。真人首次游玩时间、理解与偏好仍待实测。","",
    "## 三站如何结清","","| 站次 | 进站 | 支道选择 | 驿站买卖 | 离站 |","| --- | ---: | --- | --- | ---: |");
  for(const s of full.stops){
    const b=full.branches.find(b=>b.index===s.index);
    lines.push("| "+s.index+" | "+s.before["灵石"]+" 石 | "+b.arrived.title+" · "+b.settled.notice+" | "+s.tradeText+" | "+s.after["灵石"]+" 石 |");
  }
  lines.push("","交割账显示"+Object.entries(full.paid.entries).map(([key,value])=>"「"+key+" "+value+"」").join("、")+"。最后一个驿站的私货为「"+full.stops.at(-1).manifest+"」。守关 "+full.hits+" 手，结账气血 "+full.final.hp+"。","",
    "## 影像与复核","","[四段押运实录](四段押运实录.mp4) 长 "+Number(media.format.duration).toFixed(2)+" 秒。实录从上述常速一局剪出，取四段主路、三处岔道、守关和末市。每张成交或结算停帧均在字幕标注；声音来自当次游戏标签页。逐段剪辑窗口、编码及散列保存在[视频信息](视频信息.json)。","",
    "游戏 HTML 的 SHA-256 为 `"+bundleSHA256+"`。");
  for(const baselineFile of ["直运前版对照.json","首版常速基准.json"]){
    const bytes=await fs.readFile(path.join(out,baselineFile),"utf8").catch(e=>{if(e.code!=="ENOENT")throw e});
    if(!bytes)continue;
    const r=JSON.parse(bytes);
    const whole=r.fullRunMs?"，首剑至合账 "+round(r.fullRunMs)+" 秒":"";
    lines.push("","[较早候选的常速正路对照]("+baselineFile+") 走 24 个正线路标、三个驿站，未走岔市，签单至末市 "+round(r.totalWallMs)+" 秒"+whole+"，结余 "+r.final.gold+" 石。该次候选的 SHA-256 为 `"+r.bundleSHA256+"`。");
  }
  await fs.writeFile(path.join(out,"押运实操对照.md"),lines.join("\n")+"\n");
}
async function main(){
  if(values.help){
    console.log("node first-cut/check-escort-play.cjs [--bundle FILE] [--out DIR] [--flow all|normal|express|broken|abort|caravan|mend|coast] [--quick] [--video] [--index] [--checkPace]");
    console.log("The normal route uses the actual travel clock and can take several minutes. --video captures and edits that tab.");
    return;
  }
  assert(values.flow==="all"||flows.includes(values.flow),"unknown route");
  assert(!values.checkPace||values.flow==="coast","--checkPace measures unattended travel, use --flow coast");
  assert(!values.video||["normal","all","caravan"].includes(values.flow)&&!values.quick,"--video requires normal travel");
  assert(!values.quick||values.flow==="caravan","--quick is for additional touch caravan validation");
  const bytes=await fs.readFile(bundle),urlHash=hash(bytes);
  if(values.index){await buildIndex(urlHash);return}
  const server=await startServer(bytes);
  await fs.mkdir(out,{recursive:true});
  try{
    if(values.flow==="all"){
      // Separate browser processes keep the normal foreground road active during touch replay.
      const results=await Promise.allSettled([
        run("normal",server.url,urlHash,bundle),
        (async()=>{const batch=[];for(const flow of ["express","broken","abort","mend"])batch.push(await run(flow,server.url,urlHash,bundle));return batch})(),
        run("caravan",server.url,urlHash,bundle)
      ]);
      if(results.some(r=>r.status==="rejected"))throw new AggregateError(results.filter(r=>r.status==="rejected").map(r=>r.reason),"route validation failed");
      const reports=[results[0].value,...results[1].value,results[2].value];
      const txt=["# 押运实操对照","","候选 HTML 的 SHA-256 为 `"+urlHash+"`。每局各用全新的浏览器状态。","",
        "| 路线 | 输入 | 路标 / 驿站 | 道路段实耗 | 实际驶动 | 驿站停留 | 接单至末市合账 | 首剑至末市合账 | 交货后余额 | 末市结余 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"];
      const names={coast:"沿原辙越驿",normal:"常速完整三箱",express:"催马、保印、三箱",broken:"催马、保印、坏货",abort:"催马、补封、中止",caravan:"常速、三岔市行商",mend:"催马、保印、支摊补箱"};
      for(const r of reports)txt.push("| "+[names[r.flow],r.mode,r.landmarks+" / "+r.stops.length,
        num(r.roadMs/1000)+" 秒",num(r.observedRoadClock.movingMs/1000)+" 秒",num(r.stationaryMs/1000)+" 秒",
        num(r.totalWallMs/1000)+" 秒",num(r.fullRunMs/1000)+" 秒",r.returned.gold,r.final.gold].join(" | ")+" |");
      txt.push("","接单后持续操作真实路牌与按钮。道路实耗按真实浏览器时钟记录。实际驶动从玩家可见的里程条逐帧采样。每局 JSON 同时记录手札暂停、岔口停车和其余静止帧。停站由到站到继续／中止计时。接单至合账还包括回柜、守关战斗和末市交易。没有为延长旅程而安排停留。该时长来自自动操作，真实首玩者的阅读、难度感和重玩意愿另待观察。");
      if(values.video)txt.push("","[常速押运实录节选](四段押运实录.mp4) · [剪辑来源时间与音视频指标](视频信息.json)");
      await fs.writeFile(path.join(out,"押运实操对照.md"),txt.join("\n")+"\n");
    }else await run(values.flow,server.url,urlHash,bundle);
  }finally{await server.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
