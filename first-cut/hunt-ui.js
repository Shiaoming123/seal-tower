window.HuntUI=(()=>{
  "use strict";
  const names={knife:"短铁刀",hook:"竹柄钩",buckler:"木挡板",plate:"引灯盘",ash:"灯灰",shell:"碎壳",clasp:"完整狐扣"};
  const merchandiseArt={ash:"merch-ash",shell:"merch-ink-shell",clasp:"merch-fox-clasp",salve:"merch-salve"};
  const people=[
    ["斩妖人","你家三代替塔下的街坊守夜。今年父亲伤了腿，你接过了他的铺子。天黑前带回材料，让守夜人有灯可用，也让铺子有钱开门。"],
    ["绯绡","绯绡以前替渡船送信，认得每一段夜路。她在桥头开了货摊，收镜狐身上自然结出的铜扣，缝在船夫的灯罩上。断了的扣只能拆料。"],
    ["镇灯匠","隔壁的灯匠每天都要给街灯换芯。他肯为准时送到的两份灰多付些钱。交过货，他下趟会替你多备一份灰。"],
    ["纸灯蛾","它把旧灯纸卷成翅，胸前藏着一枚灯芯。它扑向火光时会把芯露出来。架住翅膀，再用钩子取，能多收一份灰。"],
    ["窃芯鼠","桥洞里的鼠怕冷，会把人袋里的灯灰拖回窝。看见它伸爪就能挡；被抢走的灰，打赢后还找得到。"],
    ["镜狐","镜狐喜欢跟着水里的倒影跑，颈下的铜扣会敲响石板。它飞扑时扣子甩到身前。迎面砍会打断扣，架住这一下能留下完整的。"]
  ];
  const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
  function store(type,op,key,value){
    try{const s=window[type];if(op==="get")return s.getItem(key);s.setItem(key,value)}catch{return null}
  }
  async function open(crawl=false){
    const rules=crawl?CrawlWorld:HuntRules;
    const old=document.querySelector("#game"),url=new URL(location.href);
    let seed=(url.searchParams.get("seed")||"1").slice(0,64);
    try{await Promise.all([TowerSprites.ready,TowerFonts.ready])}
    catch{document.querySelector("#loading").textContent="画卷未载入。请重新打开本页。";return}
    document.title="镇灯铺 · 猎妖供货｜照影廊";
    const base="seal-tower."+(crawl?"crawl":"hunt")+".v1:"+location.pathname,account=base+":customer";
    const saveKey=()=>base+":run:"+seed;
    let state,view,busy=false,timer=0;
    function fresh(){return rules.create(seed,store("localStorage","get",account))}
    try{
      const rec=JSON.parse(store("sessionStorage","get",saveKey()));
      if(rec?.version===1&&rec.state?.seed===seed&&Array.isArray(rules.view(rec.state).actions)&&rec.state.phase)state=rec.state;
    }catch{}
    if(!state)state=fresh();
    const save=()=>store("sessionStorage","set",saveKey(),JSON.stringify({version:1,state}));
    const main=element("main",crawl?"hunt crawling":"hunt");main.id="hunt";main.setAttribute("aria-label","镇灯铺猎妖供货");
    main.innerHTML=`<header class="hunt-head"><strong>镇灯铺</strong><span class="hunt-leg"></span><nav class="hunt-toggles"><button type="button" data-menu="pouch">货袋</button><button type="button" data-menu="story">人物志</button><button type="button" data-menu="sound">声音</button></nav></header>
      <section class="hunt-stage"><canvas aria-label="猎妖场景"></canvas><div class="hunt-stats"></div><div class="hunt-foe"></div></section>
      <div class="hunt-stock"></div><section class="hunt-ledger"><div class="hunt-text"><small></small><h1></h1><p></p><div class="hunt-readout" aria-live="polite"></div></div><div class="hunt-commands" aria-label="当前事件的行动"></div></section>
      <dialog class="hunt-dialog" aria-labelledby="hunt-dialog-title"></dialog>`;
    document.body.classList.add("hunting");old.hidden=true;document.body.append(main);
    const q=s=>main.querySelector(s),stage=q(".hunt-stage canvas"),dialog=q("dialog");
    const veil=element("div","crawl-threshold");veil.hidden=true;veil.setAttribute("aria-hidden","true");main.append(veil);
    const scene=crawl?CrawlScene.install(stage,()=>{}):HuntScene.install(stage,()=>apply("strike"));
    const atlas=element("button","crawl-map");atlas.type="button";atlas.setAttribute("aria-label","展开路线图");atlas.hidden=true;atlas.onclick=()=>showDialog("atlas");const map=element("canvas"),direction=element("span");atlas.append(map,direction);q(".hunt-stage").append(atlas);
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    const cmds=q(".hunt-commands"),preview=element("aside","crawl-preview");
    let hold=0,heldButton=null;
    preview.hidden=true;preview.setAttribute("aria-hidden","true");main.append(preview);
    function hidePreview(){clearTimeout(hold);preview.hidden=true}
    function inspectCard(b,card){
      const art=itemCanvas(card.art);
      preview.replaceChildren(element("small","",card.cost+" 点行动"),element("strong","",card.label),art,element("span","",card.detail));
      preview.hidden=false;
      const box=b.getBoundingClientRect(),w=preview.offsetWidth,h=preview.offsetHeight;
      preview.style.left=Math.max(8,Math.min(innerWidth-w-8,box.left+(box.width-w)/2))+"px";
      preview.style.top=Math.max(6,box.top-h-5)+"px";
    }
    if(crawl){
      window.addEventListener("resize",hidePreview);
      window.addEventListener("scroll",hidePreview,{passive:true});
      document.addEventListener("visibilitychange",hidePreview);
    }
    function metric(label,value){
      const x=element("span","",label+" ");x.append(element("b","",value));return x;
    }
    function iconFor(id){
      if(id==="take-gear")return view.offer?.id;
      if(id==="take-loot")return view.loot?.id;
      if(id==="strike")return view.weapon;
      if(id==="flare"||id==="recover-ash")return "ash";
      const last=id.split("-").pop();return Object.hasOwn(names,last)?last:null;
    }
    function itemCanvas(id){
      const art=element("canvas");
      art.width=art.height=144;
      art.setAttribute("aria-hidden","true");
      const ctx=art.getContext("2d"),image=TowerSprites.get(merchandiseArt[id]);
      if(id==="footwork"){
        ctx.scale(4,4);
        for(const [x,y] of [[12,19],[19,12]]){
          ctx.fillStyle="#192e30";ctx.fillRect(x-2,y-4,6,9);
          ctx.fillStyle="#d7bc83";ctx.fillRect(x-1,y-4,4,6);ctx.fillRect(x-1,y+3,3,2);
          ctx.fillStyle="#87988a";ctx.fillRect(x-1,y,4,2);
        }
        ctx.fillStyle="#e6c784";ctx.fillRect(17,28,10,1);ctx.fillRect(25,26,2,5);ctx.fillRect(27,27,2,3);
      }else if(image){
        const scale=128/Math.max(image.naturalWidth,image.naturalHeight);
        const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
        ctx.drawImage(image,(144-width)/2,(144-height)/2,width,height);
      }else HuntArt.drawItem(ctx,id,72,72,136);
      return art;
    }
    function itemSpec(action){
      const {id}=action;
      if(id==="trade-freight")return {art:"clasp",verb:"换取"};
      if(id==="medicine")return {art:"salve",verb:"补给"};
      if(id.startsWith("buy-"))return {art:iconFor(id),verb:"买入"};
      if(id.startsWith("sell-"))return {art:iconFor(id),verb:"卖出"};
      if(id==="take-gear")return {art:iconFor(id),verb:"装备"};
      if(id==="take-loot"||id==="recover-ash")return {art:iconFor(id),verb:"拾取"};
      return null;
    }
    function fitCounter(actions){
      const shelf=element("div","crawl-counter"),follow=element("div","crawl-counter-follow");
      shelf.setAttribute("role","group");
      shelf.setAttribute("aria-label",view.phase==="market"?"桥驿买卖":"战后收货");
      const buttons=Array.from(cmds.children);
      actions.forEach((action,i)=>{
        const b=buttons[i],spec=itemSpec(action);
        if(!spec?.art){follow.append(b);return}
        const old=b.querySelector("canvas");if(old)old.remove();
        b.classList.remove("with-icon");
        b.classList.add("crawl-counter-action");
        const tray=element("span","crawl-tray"),tag=element("span","crawl-tray-tag",spec.verb);
        tag.setAttribute("aria-hidden","true");
        tray.append(itemCanvas(spec.art),tag);
        b.prepend(tray);
        shelf.append(b);
      });
      if(view.freight==="traded"){
        const tray=element("div","crawl-tray crawl-tray-receipt");
        tray.append(itemCanvas("clasp"),element("strong","","完整狐扣"),element("small","","已装袋"));
        shelf.prepend(tray);
      }
      shelf.dataset.count=String(shelf.childElementCount);
      cmds.replaceChildren(...(shelf.childElementCount?[shelf,follow]:[follow]));
    }
    function choice(id,label,detail,disabled,fn,card){
      const b=element("button","hunt-act");b.type="button";b.dataset.id=id;b.disabled=!!disabled;
      const key=card?.art||iconFor(id);
      if(card?.cost!=null){b.classList.add("crawl-card");b.dataset.fx=card.fx;b.append(element("span","crawl-cost",String(card.cost)));b.setAttribute("aria-label",label+"，"+card.cost+" 行动力。"+detail)}
      if(key){
        if(crawl&&card)b.append(itemCanvas(key));
        else{
          const cv=element("canvas");cv.width=cv.height=72;cv.setAttribute("aria-hidden","true");
          HuntArt.drawItem(cv.getContext("2d"),key,36,36,68);b.append(cv);
        }
        b.classList.add("with-icon");
      }
      b.append(element("strong","",label));if(detail)b.append(element("small","",detail));if(crawl&&card?.cost!=null){
        b.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"&&!busy&&preview.hidden)inspectCard(b,card)});
        b.addEventListener("pointerleave",hidePreview);
        b.addEventListener("pointerdown",e=>{
          heldButton=null;
          if(e.pointerType!=="mouse"){hidePreview();hold=setTimeout(()=>{heldButton=b;inspectCard(b,card)},360)}
        });
        const release=()=>{clearTimeout(hold);if(heldButton===b)preview.hidden=true};
        b.addEventListener("pointerup",release);b.addEventListener("pointercancel",hidePreview);
        b.addEventListener("contextmenu",e=>e.preventDefault());
        b.onclick=()=>{hidePreview();if(heldButton===b){heldButton=null;return}fn()};
      }else b.onclick=fn;
      return b;
    }
    function drawMap(nav,canvas=map){
      const z=7;canvas.width=nav.rows[0].length*z;canvas.height=nav.rows.length*z;
      const c=canvas.getContext("2d");
      nav.rows.forEach((r,y)=>Array.from(r).forEach((tile,x)=>{
        c.fillStyle=tile==="#"?"#17201d":"#86744e";c.fillRect(x*z,y*z,z-1,z-1);
      }));
      for(const p of nav.markers){c.fillStyle=p.id==="rat"?"#e3a48a":p.id==="moth"?"#9fd6d9":"#eabb70";c.fillRect(p.x*z+1,p.y*z+1,z-3,z-3)}
      c.translate((nav.x+.5)*z,(nav.y+.5)*z);c.rotate(nav.dir*Math.PI/2);
      c.fillStyle="#fff3b1";c.beginPath();c.moveTo(0,-4);c.lineTo(3,3);c.lineTo(-3,3);c.closePath();c.fill();
      direction.textContent="面朝"+["北","东","南","西"][nav.dir]+" · 看图";
      canvas.setAttribute("role","img");canvas.setAttribute("aria-label","塔内路线图，你在第 "+(nav.x+1)+" 列、第 "+(nav.y+1)+" 行。"+nav.markers.map(m=>m.label+"在第 "+(m.x+1)+" 列、第 "+(m.y+1)+" 行").join("。"));
    }
    function render(focusId){
      hidePreview();view=rules.view(state);main.dataset.phase=view.phase;main.dataset.leg=view.leg;main.dataset.seed=view.seed;
      scene.show(view);
      atlas.hidden=!(crawl&&view.phase==="walk");if(!atlas.hidden)drawMap(view.nav);
      q(".hunt-leg").textContent=["contract","done","settle"].includes(view.phase)?"塔下 · "+view.place:"第 "+view.leg+" 关 · "+view.place;
      q(".hunt-stats").replaceChildren(metric("气血",view.hp+"/"+view.maxHp),metric("灵石",view.cash));
      const foe=q(".hunt-foe");foe.hidden=!view.foe;
      if(view.foe)foe.replaceChildren(element("b","",view.foe.name+"  "+view.foe.hp+"/"+view.foe.maxHp),element("span","","将出 "+view.foe.intent+" · "+view.foe.damage+" 伤"));
      const stock=q(".hunt-stock"),order=element("span","hunt-order",view.phase==="contract"?"尚未接单":view.objective);
      stock.replaceChildren(metric("手持",names[view.weapon]),metric("货袋",view.used+"/"+view.capacity),metric("灯灰",view.items.ash),order);
      if(view.plate)stock.firstChild.after(metric("法宝","引灯盘"));
      const categories={walk:"探路",contract:"柜台接单",gear:"出发备货",gather:"沿路取材",route:"道友探路",fight:"交锋",loot:"战后收货",market:"桥头生意",settle:"回铺验货",done:"交割完毕"};
      q(".hunt-text small").textContent=categories[view.phase]+"　·　路签 "+view.seed;
      q(".hunt-text h1").textContent=view.title;q(".hunt-text p").textContent=view.description;
      q(".hunt-readout").textContent=view.notice||"";
      if(crawl&&view.cards&&view.phase==="fight"){
        const hand=view.cards;
        stock.append(metric("行动",hand.energy+"/3"),metric("格挡",hand.block||0));
        q(".hunt-text small").textContent="第 "+hand.round+" 回合　·　抽牌 "+hand.draw+"　弃牌 "+hand.discard;
        q(".hunt-text p").append(hand.round===1?" 按 0、1、2 点依次出牌，末牌加 2。":hand.combo===2?" 现在出 2 点牌，效果加 2。":"");
        q(".hunt-text h1").textContent=hand.combo>0?"连招 "+hand.combo+"/3":"你来出牌";
      }
      stage.setAttribute("aria-label",crawl?(view.foe?"第一人称交锋，使用下方手牌":view.title):view.foe?"点"+view.foe.name+"使用手中武器，或使用下方行动。":view.title);
      cmds.replaceChildren(...view.actions.map(a=>choice(a.id,a.label,a.detail,a.disabled,()=>apply(a.id),a)));
      if(crawl&&view.leg===2&&(view.phase==="market"||view.phase==="loot")){
        fitCounter(view.actions);
        if(view.phase==="market"){
          const intro=q(".hunt-text p"),split=view.description.indexOf(" 鼠首招");
          if(split>=0){
            intro.replaceChildren(element("span","crawl-quote",view.description.slice(0,split)),
              element("span","crawl-quote-detail",view.description.slice(split).trim()));
          }
        }
      }
      if(crawl&&view.phase==="fight"){
        const hand=element("div","crawl-hand"),controls=element("div","crawl-controls");
        for(const b of Array.from(cmds.children))(b.classList.contains("crawl-card")?hand:controls).append(b);
        cmds.replaceChildren(hand,controls);
      }
      if(view.phase==="done"){
        const r=view.receipt;
        q(".hunt-readout").textContent=r.reason+" · 入塔 "+r.openingCash+" 石，回铺 "+r.cash+" 石，余 "+r.hp+" 血";
        cmds.append(choice("repeat","再走这张签","沿用相同货源与路况",false,()=>restart(false)),choice("next","换签出发","新一趟从镇灯铺起行",false,()=>restart(true)));
      }
      if(view.phase==="done"||view.phase==="contract"){
        const link=element("a","hunt-act","回照影廊试剑");const dest=new URL(location.href);dest.searchParams.delete("play");link.href=dest.href;cmds.append(link);
        const compare=element("a","hunt-act",crawl?"侧面机位试玩":"第一人称走塔");dest.searchParams.set("play",crawl?"hunt":"crawl");compare.href=dest.href;cmds.append(compare);
      }
      if(busy)cmds.querySelectorAll("button").forEach(b=>b.disabled=true);
      if(focusId)cmds.querySelector('[data-id="'+focusId+'"]:not(:disabled)')?.focus({preventScroll:true});
    }
    function restart(change){
      if(change){const parsed=Number(seed);seed=Number.isSafeInteger(parsed)&&parsed<1e8?String(parsed+1):"1"}
      state=fresh();save();url.searchParams.set("seed",seed);try{history.replaceState(null,"",url)}catch{}
      CutVoice.play("paper");render();
    }
    function apply(id,confirmed=false){
      if(busy||dialog.open)return;
      const a=view.actions.find(x=>x.id===id);if(!a||a.disabled)return;
      if(id==="retreat"&&!confirmed){showDialog("leave");return}
      CutVoice.unlock();const prior=view,next=rules.act(state,id);if(next===state)return;
      const wasKey=document.activeElement?.dataset.id===id;
      state=next;save();
      if(id==="commit"&&state.receipt?.fulfilled)store("localStorage","set",account,state.receipt.standing);
      if(crawl&&id==="leave-market"&&prior.leg===2&&prior.phase==="market"&&!reduced.matches){
        busy=true;cmds.querySelectorAll("button").forEach(b=>b.disabled=true);
        const out=veil.animate([{opacity:0},{opacity:1}],{duration:145,fill:"forwards",easing:"ease-in"});
        veil.hidden=false;CutVoice.play("paper");
        out.finished.then(()=>{
          window.scrollTo(0,0);
          render();
          const open=veil.animate([{opacity:1},{opacity:0}],{duration:220,fill:"forwards",easing:"ease-out"});
          return open.finished;
        }).catch(e=>{
          if(e.name!=="AbortError")throw e;
        }).finally(()=>{
          veil.getAnimations().forEach(a=>a.cancel());veil.hidden=true;busy=false;render();
        });
        return;
      }
      if(crawl&&prior.phase==="walk"&&id!=="retreat"){
        const after=rules.view(next);
        if(prior.leg===2){
          const duration=scene.walk(prior,after,id);
          if(!duration){render(wasKey?id:null);return}
          busy=true;cmds.querySelectorAll("button").forEach(b=>b.disabled=true);
          setTimeout(()=>{busy=false;render(wasKey?id:null)},duration);return;
        }
        busy=true;scene.show({...prior,nav:after.nav});cmds.querySelectorAll("button").forEach(b=>b.disabled=true);
        setTimeout(()=>{busy=false;render(wasKey?id:null)},reduced.matches?30:165);return;
      }
      if(prior.phase==="fight"&&id!=="retreat"){
        const effect=crawl?(a.fx||(id==="end-turn"?"enemy":"guard")):id;
        const duration=reduced.matches?110:crawl?300:575,after=rules.view(next);busy=true;
        cmds.querySelectorAll("button").forEach(b=>b.disabled=true);
        CutVoice.play(effect==="guard"?"guard":effect==="flare"?"abacus":effect==="enemy"?"hit":"slash");
        scene.show(prior,{id:effect,after,start:performance.now(),duration});
        if(effect==="strike")timer=setTimeout(()=>CutVoice.play("hit"),duration*.40);
        setTimeout(()=>{clearTimeout(timer);busy=false;render(wasKey?id:null)},duration);return;
      }
      if(crawl&&id==="leave-market"&&prior.leg===2)window.scrollTo(0,0);
      CutVoice.play(id==="commit"||id==="early-order"?"stamp":id.startsWith("take-")?"take":"paper");render(wasKey?id:null);
    }
    function showDialog(mode){
      if(busy||dialog.open)return;
      hidePreview();scene.pause(true);dialog.replaceChildren();
      const title=element("h2","",mode==="atlas"?"塔内路线":mode==="story"?"塔下的人和妖":mode==="leave"?"这就回铺？":"随身货袋");title.id="hunt-dialog-title";dialog.append(title);
      if(mode==="atlas"){
        const enlarged=element("canvas","crawl-atlas");drawMap(view.nav,enlarged);
        dialog.append(enlarged,element("p","",view.description),element("p","","金色箭头是你，图上方是北。"));
        const here=view.nav;
        for(const point of here.markers){
          const dx=point.x-here.x,dy=point.y-here.y;
          const offset=[dy?(dy<0?"北":"南")+Math.abs(dy)+" 格":"",dx?(dx<0?"西":"东")+Math.abs(dx)+" 格":""].filter(Boolean).join("、");
          dialog.append(element("p","",point.label+"在你"+(offset?"的"+offset:"脚下")+"。"));
        }
      }else if(mode==="story"){
        const nav=element("div","hunt-nav"),body=element("p");
        const show=i=>{body.textContent=people[i][1];Array.from(nav.children).forEach((b,n)=>b.setAttribute("aria-pressed",String(i===n)))};
        people.forEach(([name],i)=>{const b=element("button","",name);b.onclick=()=>show(i);nav.append(b)});dialog.append(nav,body);
        show(view.foe?({moth:3,rat:4,fox:5})[view.foe.id]:view.phase==="contract"?0:1);
      }else if(mode==="leave"){
        dialog.append(element("p","","带已收好的货回镇灯铺，放弃后面的猎路。回铺后可以查看交货价格，再亲手结账。"));
      }else{
        dialog.append(element("p","",view.objective),element("h3","","随身工具"),element("p","",names[view.weapon]+(view.plate?"　引灯盘":"")));
        dialog.append(element("h3","","货袋 "+view.used+" / "+view.capacity+" 份"));
        if(crawl){
          const stock=element("div","crawl-pouch-trays");
          for(const id of ["ash","shell","clasp"]){
            const tray=element("div","crawl-tray"),count=view.items[id];
            tray.dataset.empty=String(!count);
            tray.append(itemCanvas(id),element("strong","",names[id]),element("small","",count+(id==="clasp"?" 枚":" 份")));
            stock.append(tray);
          }
          dialog.append(stock);
        }else dialog.append(element("p","","灯灰 "+view.items.ash+" 份　碎壳 "+view.items.shell+" 份　完整狐扣 "+view.items.clasp+" 枚"));
        dialog.append(element("p","","灯灰可以卖，也能扬向敌人。货位满时可以留下新掉落，已装好的货继续随身。"));
      }
      const footer=element("footer"),close=element("button","",mode==="atlas"?"回到塔内":mode==="leave"?"继续这一趟":"合上");close.onclick=()=>dialog.close();footer.append(close);
      if(mode==="leave"){const yes=element("button","","带货回铺");yes.onclick=()=>{dialog.close();apply("retreat",true)};footer.append(yes)}
      dialog.append(footer);dialog.showModal();close.focus();
    }
    dialog.addEventListener("close",()=>{
      scene.pause(false);
      if(dialog.querySelector(".crawl-atlas")&&!reduced.matches)
        stage.animate([{opacity:.55,transform:"scale(1.045)"},{opacity:1,transform:"scale(1)"}],{duration:190,easing:"ease-out"});
    });
    q('[data-menu="pouch"]').onclick=()=>showDialog("pouch");
    q('[data-menu="story"]').onclick=()=>showDialog("story");
    const audio=q('[data-menu="sound"]');
    function sound(){audio.textContent=CutVoice.enabled?"静音":"开声音";audio.setAttribute("aria-label",CutVoice.enabled?"关闭声音":"打开声音")}
    audio.onclick=()=>{CutVoice.toggle();sound()};sound();
    if(crawl)document.addEventListener("keydown",e=>{
      if(e.repeat||busy||dialog.open||e.metaKey||e.ctrlKey||e.altKey)return;
      const navKeys={ArrowLeft:"turn-left",a:"turn-left",ArrowRight:"turn-right",d:"turn-right",ArrowUp:"step",w:"step"};
      let id=view.phase==="walk"?navKeys[e.key]:null;
      if(view.phase==="fight"){if(/^[1-5]$/.test(e.key))id=view.actions.filter(a=>a.cost!=null)[Number(e.key)-1]?.id;else if(e.key==="e")id="end-turn"}
      if(id){e.preventDefault();apply(id)}
    });
    render();
  }
  return {open};
})();
