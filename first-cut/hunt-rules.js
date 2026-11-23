/* An independent lantern shop commission. No UI, storage or wall clock enters the rules. */
(() => {
  "use strict";
  const weapons = {
    knife: {name:"短铁刀", power:5, block:2, info:"出刀快，每刀 5 伤，能挡 2 伤。"},
    hook: {name:"竹柄钩", power:4, block:3, info:"每击 4 伤，挡 3 伤。守住蛾翅，下一击能挑下一份灯灰。"},
    buckler: {name:"木挡板", power:3, block:5, info:"每击 3 伤，挡 5 伤。接下一招后，下次反击多打 3 伤。"}
  };
  const goods = {ash:"灯灰",clasp:"完整狐扣",shell:"碎壳"};
  const spot = {ash:1,clasp:4,shell:2};
  const buyers = {ash:{name:"镇灯匠",qty:2,pay:7},clasp:{name:"绯绡",qty:1,pay:9}};
  const beasts = {
    moth: {name:"纸灯蛾",health:[7,10],moves:[["扑向灯芯",3],["扫翅",4],["收翅",1]]},
    rat: {name:"窃芯鼠",health:[8,10],moves:[["伸爪掏灰",1],["扑咬",5],["拖壳回窝",2]]},
    fox: {name:"镜狐",health:[10,14],moves:[["探爪",2],["飞扑",7],["收势",1]]}
  };
  function seedNumber(seed){
    const text=String(seed);
    if(/^\d{1,12}$/.test(text))return Number(text)>>>0;
    let value=2166136261;
    for(const char of text)value=Math.imul(value^char.charCodeAt(0),16777619);
    return value>>>0;
  }
  function create(seed=1,standing=""){
    const sign=seedNumber(seed);
    return {seed:String(seed),sign,standing:Object.hasOwn(buyers,standing)?standing:"",
      phase:"contract",leg:1,hp:22,maxHp:22,cash:3,weapon:"knife",plate:false,capacity:5,
      contract:"free",fulfilled:false,items:{ash:0,clasp:0,shell:0},expenses:0,sales:0,fee:0,
      stock:(sign%3===2?0:1)+(standing==="ash"?1:0),medicine:1,foe:null,loot:null,
      ashBurned:0,turns:0,cleared:0,notice:"",exitReason:"",receipt:null};
  }
  function used(s){return s.items.ash+s.items.clasp+s.items.shell}
  function free(s){return s.capacity-used(s)}
  function orderReady(s){
    return !s.fulfilled&&s.contract!=="free"&&s.items[s.contract]>=buyers[s.contract].qty;
  }
  function dropGear(s,id){
    if(id==="fox")return null;
    const rolls=id==="rat"?["buckler","knife","hook"]:["hook","knife","buckler"];
    return rolls[(s.sign+s.leg-2+3)%3];
  }
  function makeFoe(s,id){
    const index=s.leg===1?0:1;
    return {id,hp:beasts[id].health[index],maxHp:beasts[id].health[index],turn:0,
      core:id==="moth",primed:false,counter:false,lit:false,clasp:id==="fox"?"挂在颈下":"",
      theft:0};
  }
  function move(s){
    const f=s.foe;
    const offset=f.id==="rat"&&s.leg===2?s.sign%2:f.id==="fox"&&s.leg===3&&s.sign%2===0?1:0;
    const [name,damage]=beasts[f.id].moves[(f.turn+offset)%3];
    return {name,damage:damage+(s.leg>1&&name==="飞扑"?1:0),pounce:name==="飞扑",steal:name==="伸爪掏灰"};
  }
  function add(s,id,qty){const n=Math.min(free(s),qty);s.items[id]+=n;return n}
  function newFight(s,id){
    s.foe=makeFoe(s,id);s.loot=null;s.phase="fight";
  }
  function marketHint(s){
    return s.stock?"驿柜备有 "+s.stock+" 份灰，每份 2 石。":"驿柜本趟缺灰。";
  }
  function addSale(s,id,qty){
    const amount=qty*spot[id];s.cash+=amount;s.sales+=amount;s.items[id]-=qty;return amount;
  }
  function pay(s,cost){s.cash-=cost;s.expenses+=cost}
  function deliver(s){
    const b=buyers[s.contract];s.items[s.contract]-=b.qty;s.cash+=b.pay;s.fee=b.pay;s.fulfilled=true;
  }
  function closeBooks(s){
    Object.keys(goods).forEach(id=>addSale(s,id,s.items[id]));
    const b=buyers[s.contract];
    s.receipt={fulfilled:s.fulfilled,buyer:b?.name||"散客",paid:s.fee,expenses:s.expenses,
      sales:s.sales,openingCash:3,cash:s.cash,hp:s.hp,reason:s.exitReason||"走完三关",
      standing:s.fulfilled?s.contract:s.standing,ashBurned:s.ashBurned,turns:s.turns,cleared:s.cleared};
    s.phase="done";
  }
  function finishFight(s){
    const f=s.foe;
    const id=f.id==="fox"&&f.clasp==="完整收好"?"clasp":f.id==="moth"?"ash":"shell";
    s.loot={enemy:f.id,id,qty:1,gear:dropGear(s,f.id),stolen:f.theft};
    s.cleared++;s.phase="loot";s.foe=null;
  }
  function resolveTurn(s,action){
    const f=s.foe,enemy=move(s),w=weapons[s.weapon];
    const guard=action==="guard",flare=action==="flare",strike=action==="strike";
    let hit=0, incoming=enemy.damage;
    const notes=[];
    if(strike){
      hit=w.power+(f.counter?3:0)+(f.lit?4:0);
      f.counter=false;f.lit=false;
      if(f.primed&&f.core){
        if(free(s)){add(s,"ash",1);f.core=false;notes.push("挑出灯芯，收灰 1 份")}
        else notes.push("货袋已满，没能收芯");
        f.primed=false;
      }
      if(enemy.pounce&&(f.clasp==="挂在颈下"||f.clasp==="缺了一角")){
        hit+=3;f.clasp="已断";notes.push("斩断狐扣，多打 3 伤");
      }
    }else if(flare){
      s.items.ash--;s.ashBurned++;f.lit=true;
      notes.push("用去 1 灰，下刀多打 4 伤");
      if(s.plate){incoming=0;notes.push("引灯盘截住这一招")}
    }else{
      incoming=Math.max(0,incoming-w.block);
      if(s.weapon==="hook"&&f.core&&enemy.damage>=3){f.primed=true;notes.push("灯芯露出，下一击可挑芯")}
      if(s.weapon==="buckler"){f.counter=true;notes.push("架稳挡板，下击多打 3 伤")}
    }
    if(enemy.pounce&&f.clasp==="挂在颈下"&&(guard||flare&&s.plate)){
      f.clasp="完整收好";notes.push("接住飞扑，保住狐扣");
    }
    s.turns++;f.turn++;f.hp=Math.max(0,f.hp-hit);
    if(hit)notes.unshift("击中 "+hit+" 伤");
    if(f.hp===0){notes.push("敌人倒下");finishFight(s)}
    else{
      if(enemy.steal&&!guard&&!(flare&&s.plate)&&s.items.ash){
        s.items.ash--;f.theft++;notes.push("鼠爪抢走 1 灰，打赢可夺回");
      }
      s.hp=Math.max(0,s.hp-incoming);
      notes.push(incoming?"受 "+incoming+" 伤":"未受伤");
      if(!s.hp){
        s.exitReason="受伤撤回";s.foe=null;s.phase="settle";notes.push("道友送你和随身货回铺");
      }
    }
    s.notice=notes.join("，")+"。";
  }
  function afterLoot(s){
    const enemy=s.loot.enemy;s.loot=null;
    if(s.leg===3){s.phase="settle";return}
    if(enemy==="fox"){s.leg=2;s.phase="market";return}
    if(s.leg===2)s.leg=3;
    newFight(s,"fox");
    if(s.leg===1&&enemy==="moth")s.foe.clasp="缺了一角";
  }
  function gearOffer(s){
    return s.loot?.gear?{id:s.loot.gear,name:weapons[s.loot.gear].name}:null;
  }
  function view(s){
    const b=buyers[s.contract],actions=[];
    const v={phase:s.phase,leg:s.leg,place:["灯廊","桥驿","镜门"][s.leg-1],title:"",description:"",
      notice:s.notice,objective:b?s.fulfilled?"已向"+b.name+"交货":b.name+"收 "+b.qty+" 份"+goods[s.contract]+"，付 "+b.pay+" 石":"自由散卖",
      actions,hp:s.hp,maxHp:s.maxHp,cash:s.cash,seed:s.seed,weapon:s.weapon,plate:s.plate,items:{...s.items},
      used:used(s),capacity:s.capacity,contract:s.contract,foe:null,offer:gearOffer(s),
      loot:s.loot?{...s.loot}:null,receipt:s.receipt?{...s.receipt}:null,standing:s.standing};
    const option=(id,label,detail,disabled=false)=>actions.push({id,label,detail,disabled});
    switch(s.phase){
      case "contract":
        v.place="镇灯铺";v.title="今天替谁进塔？";
        v.description="父亲伤了腿，今天轮到你进塔给街灯找材料。选一位买主，货不齐也能按散价卖。"+marketHint(s);
        option("order-ash","给灯匠送灰","两份灰共 7 石。散卖每份 1 石。");
        option("order-clasp","替绯绡取扣","一枚完整狐扣 9 石。散卖每枚 4 石。");
        option("order-free","只做现货","货归自己，不必保留指定货品。");break;
      case "gear":
        v.place="铺后工具架";v.title="拿一件趁手的";
        v.description="手上只有一个武器位。路上捡到其他工具，可以当场换用。";
        option("gear-knife","带短铁刀","免费。"+weapons.knife.info);
        option("gear-hook","买竹柄钩 · 2 石",weapons.hook.info,s.cash<2);
        option("gear-buckler","买木挡板 · 1 石",weapons.buckler.info,s.cash<1);
        option("gear-plate","带刀配盘 · 3 石","留下短铁刀。花光 3 石换引灯盘，扬灰时就能截招。",s.cash<3);break;
      case "gather":
        v.title=s.leg===1?"清理廊口旧灯":"驿后换灯";v.description="铺里常年替这里换灯。每次经过，可以收一份灯灰，也可以坐下包扎伤口。";
        option("gather-ash","收灯灰 1 份",free(s)?"收进货袋。":"货袋已满。",!free(s));
        option("rest","歇脚包扎","恢复最多 3 点气血，留下灯灰。");break;
      case "route":{
        v.title="挑一条猎路";
        v.description=(s.leg===1?"过道尽头有镜狐挡路。":s.sign%2===0?"镜门那只狐已伏低身子，一见人就会飞扑。":"镜门那只狐先探爪，随后才飞扑。")+
          (s.leg===1?marketHint(s):"过了镜门就回铺交货。");
        for(const id of (s.sign+s.leg)%2?["rat","moth"]:["moth","rat"]){
          const gear=weapons[dropGear(s,id)].name;
          option("hunt-"+id,id==="moth"?"走灯架，猎纸灯蛾":"下桥洞，追窃芯鼠",
            (id==="moth"?"蛾掉灰，钩可多取一份。":"鼠掉碎壳，会偷灰。")+(s.leg===1?(id==="moth"?"前方镜狐的扣缺角。":"前方镜狐的扣完整。"):"")+"可拾"+gear+"。");
        }break;}
      case "fight":{
        const f=s.foe,m=move(s);
        const part=f.id==="fox"?"颈扣"+f.clasp:f.id==="moth"?(f.core?"胸前还有灯芯":"灯芯已取"):"鼠窝有碎壳";
        v.title=beasts[f.id].name;v.foe={id:f.id,name:v.title,hp:f.hp,maxHp:f.maxHp,intent:m.name,damage:m.damage,part,
          core:f.core,clasp:f.clasp,theft:f.theft,lit:f.lit,counter:f.counter,primed:f.primed};
        v.description=m.name+"将造成 "+m.damage+" 伤。"+(m.pounce&&f.clasp==="挂在颈下"?"现在打会砸断狐扣。架住这一下能留下完整的扣。":f.clasp==="缺了一角"?"这枚扣缺了角，只能卖碎壳。"+(m.pounce?"现在击碎可多打 3 伤。":""):m.steal?"守住鼠爪能防它偷灰。":part+"。");
        option("strike",{knife:"出刀",hook:"挥钩",buckler:"盾击"}[s.weapon],"打 "+(weapons[s.weapon].power+(f.lit?4:0)+(f.counter?3:0)+(m.pounce&&(f.clasp==="挂在颈下"||f.clasp==="缺了一角")?3:0))+" 伤。"+(f.primed?"同时挑芯。":""));
        option("guard","守势","挡 "+weapons[s.weapon].block+" 伤。"+(f.core&&s.weapon==="hook"&&m.damage>=3?"露出灯芯。":s.weapon==="buckler"?"准备反击。":""));
        option("flare","扬灰照影","耗 1 灰，下次攻击多打 4 伤。"+(s.plate?"盘会截住当前敌招。":"当前敌招仍会落下。"),!s.items.ash);break;}
      case "loot":{
        const l=s.loot;
        v.title="检查掉落";v.description="这一战留下"+goods[l.id]+"。"+
          (l.id==="shell"&&l.enemy==="fox"?"这枚扣只能拆料。":"")+(l.gear?"路边还有一件"+weapons[l.gear].name+"。":"");
        if(l.qty)option("take-loot","收"+goods[l.id],free(s)?"占 1 份货位。":"袋满了，可留在原地。",!free(s));
        if(l.stolen)option("recover-ash","取回被偷的灰","现有 "+l.stolen+" 份待取，每按一次取一份。",!free(s));
        if(l.gear)option("take-gear","换上"+weapons[l.gear].name,weapons[l.gear].info+" 换下的工具留在原地。",l.gear===s.weapon);
        option("onward","继续赶路","留在原地的东西不会随行。");break;}
      case "market":{
        v.title="桥头补给";v.description=marketHint(s)+" 碎壳每份收 2 石。包扎 2 石可回 5 血。";
        if(s.stock)option("buy-ash","补灰 · 2 石","余 "+s.stock+" 份。",s.cash<2||!free(s));
        if(!s.plate){const cost=s.standing==="clasp"?2:3;option("buy-plate","引灯盘 · "+cost+" 石","扬灰时截住敌招，可保住飞扑中的狐扣。",s.cash<cost)}
        if(s.medicine)option("medicine","包扎 · 2 石","本驿可恢复最多 5 血。",s.cash<2||s.hp===s.maxHp);
        for(const id of Object.keys(goods))if(s.items[id])option("sell-"+id,"卖一份"+goods[id],"收 "+spot[id]+" 石。");
        if(b&&!s.fulfilled)option("early-order","提前交货","交清这单，此后可自由用货。",!orderReady(s));
        option("leave-market","进第二层","去驿后灯台取材，再选要追的妖。");break;}
      case "settle":
        v.place="镇灯铺";v.title=s.exitReason||"镜门已开";
        v.description=(s.fulfilled?"委托已在桥驿交清。":orderReady(s)?"货齐了，交账时按约付钱。":b?"货没凑齐，按散价卖出。":"自己带回的货全部按散价出售。")+
          " 灯灰 1 石，碎壳 2 石，完整狐扣 4 石。";
        option("commit",orderReady(s)?"按约交货并结账":"清点现货并结账","结账后开始下一趟。");break;
      case "done":
        v.place="镇灯铺";v.title="本趟账本";
        v.description=(s.fulfilled?"委托交清。":"已按散价收货。")+"本趟花 "+s.expenses+" 石，散卖收 "+s.sales+" 石，委托收 "+s.fee+" 石。"+(s.fulfilled?(s.contract==="ash"?"下趟灯匠会让桥驿多备 1 份灰。":"下趟去桥驿买引灯盘，绯绡会少收 1 石。"):"");break;
    }
    if(["gather","route","fight","market"].includes(s.phase))
      option("retreat","带货回铺","结束本趟；已到手的货仍能交割。");
    return v;
  }
  function act(state,id){
    const choice=view(state).actions.find(a=>a.id===id);
    if(!choice||choice.disabled)return state;
    const s={...state,items:{...state.items},foe:state.foe?{...state.foe}:null,loot:state.loot?{...state.loot}:null,notice:""};
    if(id==="retreat"){s.phase="settle";s.exitReason="提前回铺";s.foe=null;return s}
    if(s.phase==="contract"){s.contract=id.slice(6);s.phase="gear";return s}
    if(s.phase==="gear"){
      const gear=id.slice(5);
      if(gear==="plate")s.plate=true;else s.weapon=gear;
      pay(s,{knife:0,hook:2,buckler:1,plate:3}[gear]);s.phase="gather";return s;
    }
    if(s.phase==="gather"){
      if(id==="gather-ash"){add(s,"ash",1);s.notice="灯灰已收好。"}
      else{s.hp=Math.min(s.hp+3,s.maxHp);s.notice="包扎完毕。"}
      s.phase="route";return s;
    }
    if(s.phase==="route"){newFight(s,id.slice(5));return s}
    if(s.phase==="fight"){resolveTurn(s,id);return s}
    if(s.phase==="loot"){
      if(id==="take-loot"){add(s,s.loot.id,1);s.loot.qty=0;s.notice="已经装好"+goods[s.loot.id]+"。"}
      if(id==="recover-ash"){add(s,"ash",1);s.loot.stolen--}
      if(id==="take-gear"){s.weapon=s.loot.gear;s.loot.gear=null;s.notice="换上"+weapons[s.weapon].name+"。"}
      if(id==="onward")afterLoot(s);
      return s;
    }
    if(s.phase==="market"){
      if(id==="buy-ash"){pay(s,2);add(s,"ash",1);s.stock--;s.notice="补入一份灯灰。"}
      if(id==="buy-plate"){pay(s,s.standing==="clasp"?2:3);s.plate=true;s.notice="已挂好引灯盘。"}
      if(id==="medicine"){pay(s,2);s.hp=Math.min(s.maxHp,s.hp+5);s.medicine--}
      if(id==="early-order"){deliver(s);s.notice="买主按约付了 "+s.fee+" 石。"}
      if(id.startsWith("sell-")){const key=id.slice(5);s.notice=goods[key]+"售得 "+addSale(s,key,1)+" 石。"}
      if(id==="leave-market")s.phase="gather";
      return s;
    }
    if(s.phase==="settle"){if(orderReady(s))deliver(s);closeBooks(s)}
    return s;
  }
  // The card encounter has its own turn clock and shares the existing intent and reward rules.
  const encounter=Object.freeze({move,finishFight,add});
  const api=Object.freeze({create,view,act,encounter});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(typeof window!=="undefined")window.HuntRules=api;
})();
