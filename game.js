/* 斩妖塔 · 同一塔签与动作序列总是得出同一结果。 */
(function () {
  "use strict";

  const MAX_HP = 24;
  const HEAVY = 6;
  const builds = {
    sword: { name: "照影剑", hint: "剑伤 6。妖血低于或等于剑伤时可先手封妖。", upgrade: "本局剑伤 +2" },
    disc: { name: "回声盘", hint: "剑伤 5，首充 1 次。提前一手布阵，截重击并回击 6。", upgrade: "法盘充能 +1" },
    shield: { name: "玄甲盾", hint: "剑伤 4，格挡 8。挡中重击，下一剑反震 +6。", upgrade: "本局格挡 +2" }
  };
  const demons = [
    { name: "纸灯蛾", hp: 9, moves: [["掠灯", 2], ["撞灯", 6], ["收翅", 0]], story: "灯芯断了。纸蛾抖开两扇薄翼，胸口的红火照亮了门槛。" },
    { name: "夜市狐", hp: 19, moves: [["探爪", 3], ["噬影", 8], ["虚晃", 0]], story: "空摊下伸出一只漆黑的爪。夜市狐伏在地上，死死盯住你的影子。" },
    { name: "负钟君", hp: 29, moves: [["牵链", 3], ["落钟", 12], ["收链", 0]], story: "旧铜钟从梁间落下半寸。负钟君松开一环铁链，等你先出手。" }
  ];
  const floors = ["照影廊", "狐灯市", "沉钟殿"];
  const marks = ["灯纹", "鸣纹"];
  const action = (id, label, detail, disabled = false) => ({id, label, detail, disabled});
  const entry = (label, value) => ({label, value: String(value)});

  function roll(seed, key, max) {
    let h = 2166136261;
    for (const ch of seed + "|" + key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    h ^= h >>> 16;
    return (h >>> 0) % max;
  }

  const inkMite = {name:"墨蠹", hp:10, moves:[["啮墨",3],["蜷甲",1],["扑灯",4]],
    story:"墨壳从破卷里拱起，两截灯须在滴水的石槽边打颤。"};
  const wares = {
    abacus: {id:"abacus",name:"听泉算盘",type:"法宝",slot:"法宝栏",duration:"入战记钱",effect:"以入战余款计，每 4 石使本战首剑增 1 伤，至多 2 伤。"},
    ash: {id:"ash",name:"灯灰",type:"通货",slot:"行囊",duration:"出售前",maxStack:3,effect:"一格最多叠 3 份。狐柜与末市每份收 1 石。"},
    silk: {id:"silk",name:"封蜡绢",type:"商货",slot:"行囊",duration:"运至末市",maxStack:3,effect:"每叠占两格。首柜每份 2 石，末市依路签验收。"},
    lining: {id:"lining",name:"锦囊衬布",type:"扩囊",slot:"缝入锦囊",duration:"仅本行",effect:"成交即缝入囊底。增开四格至 4×4，原物位置照旧。"},
    bell: {id:"bell",name:"旧铜铃",type:"法宝",slot:"法宝栏",duration:"随身生效",effect:"穿过血棘时少损 1 血。"},
    grit: {id:"grit",name:"砺锋砂",type:"剑材",slot:"附于剑锋",duration:"仅限夜市狐一战",effect:"狐关每剑伤害 +4。"},
    salve: {id:"salve",name:"续灯膏",type:"药物",slot:"药囊",duration:"触发一次",effect:"受妖伤后尚存气血且不高于半血，自动回 6 血。"},
    mirror: {id:"mirror",name:"护心镜",type:"法宝",slot:"法宝栏",duration:"每战重置",effect:"每战首次实际受伤减 4，最低降至 0。"},
    fang: {id:"fang",name:"螭牙坠",type:"法宝",slot:"法宝栏",duration:"随身生效",effect:"每剑伤害 +1，可与砺锋砂并用。"},
    sword: {id:"sword",name:"照影剑",type:"武器",slot:"主手",duration:"装备时",effect:"剑伤 6，格挡 4。"},
    hook: {id:"hook",name:"饮棘钩",type:"武器",slot:"主手",duration:"装备时",effect:"剑伤 5。血珀释血时再增 3 伤。"},
    "ward-blade": {id:"ward-blade",name:"守阙剑",type:"武器",slot:"主手",duration:"装备时",effect:"剑伤 6，格挡 6。挡住威力至少 3 的招式，下剑蓄势 +4。"},
    knot: {id:"knot",name:"血珀佩",type:"饰品",slot:"饰品栏",duration:"装备时",effect:"血棘、放血、每战首次受妖伤各蓄 1 珀，最多 2 层。出剑耗 1 层，增 3 伤并回 2 血。"},
    seal: {id:"seal",name:"灯纹印",type:"妖印",slot:"行囊",duration:"交割前",effect:"首柜收 4 石，留到末市收 7 石。"},
    "ink-shell": {id:"ink-shell",name:"墨蠹壳",type:"材料",slot:"行囊",duration:"出售前",effect:"墨蠹固定掉落。狐柜收 2 石。"},
    "fox-clasp": {id:"fox-clasp",name:"狐灯扣",type:"材料",slot:"行囊",duration:"出售前",effect:"夜市狐固定掉落。末市收 3 石。"},
    "order-ash": {id:"order-ash",name:"下局灯灰进货单",type:"寄单",slot:"下次入塔",duration:"下局到账",effect:"现在付 2 石，下局收到 3 份灯灰，占一格。可立即卖 3 石，也可运到驿站分售。"},
    "order-purse": {id:"order-purse",name:"开市本钱",type:"寄单",slot:"下次入塔",duration:"次局一次",effect:"付 4 石寄钱。下次从本单起行，开局由 3 石增至 6 石。"},
    "order-hook": {id:"order-hook",name:"寄锋契",type:"寄单",slot:"下次入塔",duration:"次局一次",effect:"付 7 石预订饮棘钩。下次从本单起行，钩已在手，原剑随身。"} 
  };
  const stockIds = ["grit","salve","mirror","fang","hook","ward-blade","knot"];
  const prices = {grit:4,salve:2,mirror:4,fang:5,hook:5,"ward-blade":5,knot:3,
    "ink-shell":2,"fox-clasp":3,"order-purse":4,"order-hook":7,"order-ash":2};
  const barterPrices = {mirror:1,fang:2};
  const cap = s => s.maxHp ?? MAX_HP;
  const hasRelic = (s,id) => s.trial?.relics.includes(id) ?? false;
  const encounter = (s,floor=s.floor) => s.foeKind === "ink-mite" && floor === s.floor ? inkMite : demons[floor-1];
  const bagWidth=4;
  const bagHeight=t=>t?.liningBought ? 4 : 3;
  const stackLimit=id=>wares[id]?.maxStack || 1;
  const quantity=piece=>piece.qty ?? 1;
  const instance=piece=>piece.instanceId ?? piece.id;
  const equippedSlots=new Set(["主手","饰品栏","法宝栏","药囊"]);
  const abacusPower=gold=>Math.min(2,Math.floor(gold/4));
  const silkPrice=s=>roll(s.seed,"绢市",2)===roll("1","绢市",2) ? 4 : 1;
  const quoteOwners=new WeakMap();
  // Each pose transforms the whole transparent sprite. Span is measured against its longest source edge in cells.
  // Rows reserve the same silhouette for packing, rendering, dragging and the pixel audit.
  function bagPiece(rows,sprite,degrees,span,cx,cy,minCell) {
    if (!rows.length || !rows[0].length || rows.some(row=>row.length!==rows[0].length || !/^[.x]+$/.test(row)) || !rows.some(row=>row.includes("x"))) {
      throw new Error("行囊格形必须是至少含一格的矩形字模："+sprite);
    }
    return Object.freeze({rows:Object.freeze(rows),sprite,degrees,span,cx,cy,minCell});
  }
  const bagLayout = Object.freeze({
    abacus:      bagPiece(["x"],"merch-abacus",0,.94,.5,.5,.13),
    ash:         bagPiece(["x"],"merch-ash",0,.94,.5,.5,.13),
    silk:        bagPiece(["x","x"],"merch-silk",0,1.82,.5,1,.10),
    sword:       bagPiece(["xxx"],"merch-sword",54,2.20,1.433,.587,.085),
    hook:        bagPiece(["xxx"],"merch-hook",50,2.25,1.513,.477,.13),
    "ward-blade":bagPiece(["xxx"],"merch-ward-blade",46,2.17,1.455,.499,.15),
    knot:        bagPiece([".x","xx"],"merch-knot",8,1.42,1.279,1.268,.065),
    "ink-shell": bagPiece([".x","xx"],"merch-ink-shell",2,1.92,.994,.997,.14),
    mirror:      bagPiece(["x","x"],"merch-mirror",0,1.30,.500,1,.13),
    bell:        bagPiece(["x"],"merch-bell",0,.94,.5,.5,.19),
    fang:        bagPiece(["x"],"merch-fang",0,.94,.5,.5,.19),
    salve:       bagPiece(["x"],"merch-salve",0,.93,.5,.5,.19),
    seal:        bagPiece(["x"],"lamp-seal",0,.93,.5,.5,.19),
    "fox-clasp": bagPiece(["x"],"merch-fox-clasp",0,.94,.5,.5,.19)
  });
  function footprint(id,rotation=0) {
    const glyph = bagLayout[id]?.rows;
    if (!glyph || !Number.isInteger(rotation)) return [];
    const turns=((rotation%4)+4)%4;
    let cells = glyph.flatMap((row,y)=>Array.from(row,(v,x)=>v==="x" ? [x,y] : null).filter(Boolean));
    for (let turn=0;turn<turns;turn++) {
      const bottom = Math.max(...cells.map(p=>p[1]));
      cells = cells.map(([x,y])=>[bottom-y,x]);
    }
    return cells;
  }
  function insideBag(items,id,x,y,rotation,height=3) {
    if (!Object.hasOwn(bagLayout,id)) return false;
    if (![x,y,rotation].every(Number.isInteger) || rotation<0 || rotation>3) return false;
    const taken = new Set(items.flatMap(i=>footprint(i.id,i.rotation).map(([dx,dy])=>(i.y+dy)*bagWidth+i.x+dx)));
    const occupied=footprint(id,rotation);
    return occupied.length>0 && occupied.every(([dx,dy])=>{
      const col=x+dx,row=y+dy;
      return col>=0 && col<bagWidth && row>=0 && row<height && !taken.has(row*bagWidth+col);
    });
  }
  function freePlace(items,id,height=3) {
    for (let rotation=0;rotation<4;rotation++) {
      for (let y=0;y<height;y++) for (let x=0;x<bagWidth;x++) {
        if (insideBag(items,id,x,y,rotation,height)) return {id,x,y,rotation};
      }
    }
    return null;
  }
  const cargoItem = (s,id) => s.trial.cargo.find(i=>i.id===id);
  function equipped(t) {
    return [t.weapon,t.accessory,...t.relics,...t.consumables].filter(Boolean);
  }
  function pendingList(t) {
    return t.pending.map(item=>typeof item==="string" ? {id:item,instanceId:item,qty:1} : item);
  }
  function newPiece(t,id,qty) {
    if(equippedSlots.has(wares[id].slot) || id==="seal") return {id,instanceId:id,qty:1};
    t.pieceSerial=(t.pieceSerial||0)+1;
    return {id,qty,instanceId:id+"-"+t.pieceSerial};
  }
  // A receiver owns a shallow trial copy. Replacing arrays and individual pieces keeps quotes and undo snapshots intact.
  function storePieces(t,id,count,spill,original=null) {
    const limit=stackLimit(id);
    t.cargo=t.cargo.map(piece=>{
      if(count<=0 || piece.id!==id || quantity(piece)>=limit)return piece;
      const added=Math.min(count,limit-quantity(piece));
      count-=added;
      return {...piece,qty:quantity(piece)+added};
    });
    let waiting=0;
    while(count>0){
      const n=Math.min(count,limit),pos=freePlace(t.cargo,id,bagHeight(t));
      if(!pos && !spill)return false;
      const piece=original ? {...original,qty:n} : newPiece(t,id,n);
      original=null;
      if(pos)t.cargo.push({...piece,...pos});
      else {t.pending=[...t.pending,piece];waiting+=n}
      count-=n;
    }
    return {waiting};
  }
  function resolveInstance(list,id,key) {
    const matches=list.filter(piece=>piece.id===id);
    if(key!==undefined)return matches.find(piece=>instance(piece)===key);
    return matches.length===1 ? matches[0] : null;
  }
  function canEditBag(s){
    return ["shop","route","reward","wound","blood"].includes(s.phase) || (s.phase==="escort"&&["station","branchMarket"].includes(s.trial?.escort.stage));
  }
  function loadout(s,op) {
    if(!s.trial || !op || !canEditBag(s))return null;
    const {id,action}=op;
    if(!Object.hasOwn(bagLayout,id))return null;
    const t={...s.trial},height=bagHeight(t);
    const carried=resolveInstance(t.cargo,id,op.instanceId);
    const clean=carried ? t.cargo.filter(i=>i!==carried) : t.cargo;
    if(action==="move" || action==="rotate"){
      if(!carried)return null;
      const x=op.x??carried.x,y=op.y??carried.y;
      const rotation=op.rotation??(action==="rotate" ? (carried.rotation+1)%4:carried.rotation);
      if(!insideBag(clean,id,x,y,rotation,height) || (x===carried.x&&y===carried.y&&rotation===carried.rotation))return null;
      t.cargo=t.cargo.map(p=>p===carried ? {...p,x,y,rotation}:p);
    }else if(action==="split"){
      const n=op.qty;
      if(!carried || !Number.isInteger(n) || n<1 || n>=quantity(carried))return null;
      const pos=freePlace(t.cargo,id,height);
      if(!pos)return null;
      t.cargo=t.cargo.map(p=>p===carried ? {...p,qty:quantity(p)-n} : p);
      t.cargo.push({...newPiece(t,id,n),...pos});
    }else if(action==="stow"){
      if(t.weapon===id || !equipped(t).includes(id) || (op.instanceId!==undefined&&op.instanceId!==id))return null;
      const pos=freePlace(t.cargo,id,height);
      if(!pos)return null;
      if(id===t.accessory)t.accessory=null;
      else if(t.relics.includes(id))t.relics=t.relics.filter(v=>v!==id);
      else t.consumables=t.consumables.filter(v=>v!==id);
      t.cargo=[...t.cargo,{...newPiece(t,id,1),...pos}];
    }else if(action==="equip"){
      if(!carried)return null;
      const slot=wares[id].slot;
      t.cargo=clean;
      if(slot==="主手"){
        const pos=freePlace(clean,t.weapon,height);
        if(!pos)return null;
        t.cargo=[...clean,{...newPiece(t,t.weapon,1),...pos}];t.weapon=id;
      }else if(slot==="法宝栏" && t.relics.length<t.relicLimit)t.relics=[...t.relics,id];
      else if(slot==="饰品栏" && !t.accessory)t.accessory=id;
      else if(slot==="药囊" && t.consumables.length<t.packLimit)t.consumables=[...t.consumables,id];
      else return null;
    }else if(action==="set-aside"){
      if(!carried || !t.pending.length || !["商货","通货","材料"].includes(wares[id].type))return null;
      t.cargo=clean;
      t.pending=[...pendingList(t),{id,instanceId:instance(carried),qty:quantity(carried)}];
    }else if(action==="collect" || action==="discard"){
      const waiting=pendingList(t),piece=resolveInstance(waiting,id,op.instanceId);
      if(!piece)return null;
      if(action==="collect" && !storePieces(t,id,quantity(piece),false,piece))return null;
      t.pending=waiting.filter(p=>p!==piece);
      if(action==="discard")t.discarded=(t.discarded||0)+quantity(piece);
    }else return null;
    return t;
  }
  function arrange(s,op) {
    const updated=loadout(s,op);
    return updated ? {...s,trial:{...updated,revision:(s.trial.revision||0)+1}} : s;
  }
  function bagItem(id,pos={id}) {
    return {...wares[id],...pos,instanceId:instance(pos),qty:quantity(pos),maxStack:stackLimit(id),
      shape:footprint(id),cells:footprint(id,pos.rotation??0)};
  }
  function inventoryView(s) {
    const t=s.trial;
    return {width:bagWidth,height:bagHeight(t),editable:canEditBag(s),
      items:t.cargo.map(p=>bagItem(p.id,p)),equipped:equipped(t).map(id=>bagItem(id)),
      pending:pendingList(t).map(p=>bagItem(p.id,p))};
  }
  function receiveDrop(s,id,count=1){
    const result=storePieces(s.trial,id,count,true);
    return wares[id].name+(count>1?" ×"+count:"")+(result.waiting?"，待收 "+result.waiting+" 份":"已入行囊");
  }
  function addBlood(s) {
    const t=s.trial;
    if (t.accessory!=="knot" || t.bloodCharge>=2) return false;
    t.bloodCharge++;
    return true;
  }
  function trialStart() {
    return {revision:0,pieceSerial:0,silkBought:0,silkSold:0,silkRevenue:0,ashSold:0,discarded:0,liningBought:false,tradeLedger:[],
      abacusReady:0,lastAbacusDamage:0,abacusEntryGold:0,gritBought:false, gritActive:false, gateTurns:0, gateStrikes:0, gateEntryHp:0,
      firstSale:0, finalSale:0, carried:false, relicLimit:1, relics:["bell"], stockTaken:[],
      weapon:"sword",accessory:null,cargo:[],pending:[],bloodCharge:0,spentBlood:0,drainedHp:0,order:"",packLimit:1, consumables:[], sideTaken:"", contract:"", sideCleared:false, mirrorReady:false};
  }
  function quote(id,label,detail,reason="") {
    return {...action(id,label,detail,Boolean(reason)),reason};
  }
  function materialOffers(s) {
    return ["ink-shell","fox-clasp","ash",...(s.floor===2?["silk"]:[])].filter(id=>cargoItem(s,id)).map(id=>{
      const item=wares[id],price=id==="silk"?silkPrice(s):id==="ash"?1:id==="fox-clasp"&&s.trial.cleanClasp?5:prices[id];
      const sellStacks=s.trial.cargo.filter(piece=>piece.id===id).map(piece=>({instanceId:instance(piece),qty:quantity(piece)}));
      return {...item,effect:id==="fox-clasp"&&s.trial.cleanClasp?"你挡住了重击，狐扣完整。末市每枚收 5 石。":item.effect,price,sellStacks,tradeKind:"sell",owned:true,actions:[quote("vend-"+id,"售一份 · "+price+" 石","交出"+item.name+"，收 "+price+" 石")]};
    });
  }
  function stockView(s) {
    const t=s.trial;
    let lots;
    if(s.floor===2){
      const orders=["order-purse","order-hook","order-ash"].map(id=>{
        const item=wares[id],price=prices[id];
        const reason=t.order?"此行已寄出一单":s.seals.length?"先交割原印":s.gold<price?"还缺 "+(price-s.gold)+" 石":"";
        return {...item,price,tradeKind:"order",owned:t.order===id,actions:[quote(id,"寄单付 "+price+" 石",item.effect,reason)]};
      });
      lots=[...materialOffers(s),...orders];
    }else{
      const gear=stockIds.map(id=>{
        const item=wares[id],cost=prices[id],barter=barterPrices[id];
        const occupied=item.slot==="法宝栏" && t.relics.length>=t.relicLimit;
        const fullPack=item.slot==="药囊" && t.consumables.length>=t.packLimit;
        const noStow=item.slot==="主手" && !freePlace(t.cargo,t.weapon,bagHeight(t));
        const soldOut=t.stockTaken.includes(id)||t.weapon===id?"此货已售罄":"";
        const reason=soldOut||(occupied?"法宝栏已满":fullPack?"药囊已满":noStow?"行囊放不下旧兵，请先整包":s.gold<cost?"还缺 "+(cost-s.gold)+" 石":"");
        const pay=id==="grit"||id==="salve"?id:"buy-"+id;
        const receive=item.slot==="主手"?"；旧兵归囊，立即换装":item.slot==="饰品栏"?"；立即佩戴":"";
        const actions=[quote(pay,"付 "+cost+" 石","付 "+cost+" 石，余 "+Math.max(0,s.gold-cost)+" 石"+receive,reason)];
        if(barter!==undefined){
          const why=soldOut||(!hasRelic(s,"bell")?"身上已无旧铜铃":s.gold<barter?"还缺 "+(barter-s.gold)+" 石":"");
          actions.push(quote("barter-"+id,"交铃添 "+barter+" 石","卸下旧铜铃，血棘护持消失。添 "+barter+" 石，原栏佩入"+item.name,why));
        }
        return {...item,price:cost,tradeKind:"buy",actions,owned:Boolean(soldOut)};
      });
      const swap={...wares.abacus,price:0,tradeKind:"buy",owned:t.stockTaken.includes("abacus"),
        actions:[quote("barter-abacus","旧铃换算盘","交旧铜铃，原栏佩入算盘。",!hasRelic(s,"bell")?"身上已无旧铜铃":"")]};
      const silk={...wares.silk,price:2,available:2-t.silkBought,tradeKind:"buy",owned:t.silkBought===2,
        actions:[quote("buy-silk","购一份 · 2 石","每份 2 石，共可购 2 份")]};
      const lining={...wares.lining,price:3,tradeKind:"buy",owned:t.liningBought,
        actions:[quote("buy-lining","缝囊 · 3 石","原位添四格，12 格至 16 格",t.liningBought?"本行已扩囊":s.gold<3?"还缺 "+(3-s.gold)+" 石":"")]};
      lots=[...gear,swap,silk,lining,...materialOffers(s)];
    }
    return lots.map(item=>({...item,actions:item.actions.map(a=>priceAction(s,item,a,1))}));
  }
  function priceAction(s,item,action,qty,instanceId) {
    const t=s.trial,id=action.id,sale=item.tradeKind==="sell",barter=id.startsWith("barter-");
    const unitPrice=barter?(barterPrices[item.id]??0):item.price;
    let reason=action.reason||"",piece=null;
    if(!Number.isSafeInteger(qty)||qty<1||qty>3)reason="份数无效";
    else if(sale){
      piece=item.sellStacks.find(p=>instanceId===undefined || p.instanceId===instanceId);
      if(!piece || qty>piece.qty)reason="所选货叠份数不足";
      if(item.id==="silk" && qty>2-t.silkSold)reason="末市订单已满";
    }else if(item.id==="silk"){
      if(qty>2-t.silkBought)reason="首柜余货不足";
      else if(s.gold<qty*unitPrice)reason="还缺 "+(qty*unitPrice-s.gold)+" 石";
      else if(!storePieces({...t},"silk",qty,false))reason="行囊放不下绢卷";
    }else if(qty!==1)reason="此货每次一件";
    const total=Number.isSafeInteger(qty)&&qty>0&&qty<=3?unitPrice*qty:0;
    const balanceAfter=reason?s.gold:s.gold+(sale?total:-total);
    const willHaveAbacus=hasRelic(s,"abacus")||(!reason && id==="barter-abacus");
    const bonusBefore=hasRelic(s,"abacus")?abacusPower(s.gold):0,bonusAfter=willHaveAbacus?abacusPower(Math.max(0,balanceAfter)):0;
    const detail=(sale||item.id==="silk")?("每份 "+unitPrice+" 石 × "+qty+"，合 "+total+" 石；余 "+balanceAfter+" 石。"):action.detail;
    const result={...action,qty,instanceId:piece?.instanceId,unitPrice,total,balanceAfter,bonusBefore,bonusAfter,reason,disabled:Boolean(reason),
      revision:t.revision||0,detail};
    quoteOwners.set(result,s);
    return Object.freeze(result);
  }
  function quoteTrade(s,request) {
    if(!s.trial||s.phase!=="shop"||!request)return null;
    for(const item of stockView(s)){
      const a=item.actions.find(q=>q.id===request.id);
      if(a){
        const qty=request.qty??1;
        if(qty===1 && request.instanceId===undefined)return a;
        // First-stack availability is independent of a different explicitly selected stack.
        const base=item.tradeKind==="sell"||item.id==="silk"?{...a,reason:"",disabled:false}:a;
        return priceAction(s,item,base,qty,request.instanceId);
      }
    }
    return null;
  }
  const escortLegs = [
    {road:"芦灯水道",station:"杉桥短市",marks:["引车上堤","朱栏急弯","撑住短桥","堤下碎石","芦苇夹径","守住桥头"]},
    {road:"朱窑古道",station:"砾潮水驿",marks:["出驿进山","窑口松砖","赤崖岔口","石坡浮灰","压稳石梁","避开落砾"]},
    {road:"悬铃峡",station:"挂铃栈",marks:["切入峡口","铜铃避风","跨越裂栈","急转飞廊","落叶遮道","封住风口"]},
    {road:"照影渡",station:"照影交割所",marks:["拾阶下坡","避过潮痕","托住轮轴","折入石埠","灯下窄巷","稳车进城"]}
  ];
  const escortBranches=[
    {name:"芦汀灰场",mark:"捡灯人浅渡",hint:"芦汀有捡灯人，可领一份灯灰。留囊格，下一驿能卖。"},
    {name:"旧窑偏栈",mark:"窑尾窄坡",hint:"窑工要一份灯灰，肯换一枚墨壳。墨壳要能装进锦囊。"},
    {name:"桥脚夜摊",mark:"桥脚下层",hint:"夜摊收一份灰给三石。也能请匠人补一箱，两者只取其一。"}
  ];
  function branchBarterFits(t){
    const preview={...t};
    return removeEscortUnit(preview,"ash") && !!storePieces(preview,"ink-shell",1,false);
  }
  const escortMoves=["left","right","brace"];
  const escortNames={left:"走左辙",right:"走右辙",brace:"护住车厢"};
  const escortHazards=["芦根浅滩","松动窑砖","断裂桥板","雨滑石砖"];
  const escortShops=[
    [{id:"buy-ash",type:"ash",price:1,limit:3,buy:true},{id:"sell-shell",type:"ink-shell",price:3,limit:1,buy:false}],
    [{id:"sell-ash",type:"ash",price:3,limit:2,buy:false},{id:"buy-shell",type:"ink-shell",price:2,limit:1,buy:true}],
    [{id:"sell-shell",type:"ink-shell",price:4,limit:1,buy:false},{id:"sell-ash",type:"ash",price:2,limit:2,buy:false},
      {id:"buy-ash",type:"ash",price:2,limit:1,buy:true}]
  ];
  const escortFrames=new WeakMap();
  let escortFrameSerial=0;
  function escortFrame(s) {
    if(!escortFrames.has(s))escortFrames.set(s,++escortFrameSerial);
    return escortFrames.get(s);
  }
  function escortCargo(t,id) {
    return t.cargo.reduce((sum,p)=>sum+(p.id===id?quantity(p):0),0);
  }
  function escortCue(s,e) {
    // Two neighboring hazards often share a safe rut. Keeping the reins steady clears both.
    const offset=roll(s.seed,"驿路"+e.leg,6),pattern=[0,2,1,1,2,0];
    return escortMoves[pattern[(e.marker+offset+(e.branchRoad?1:0))%pattern.length]];
  }
  function escortReceipt(e) {
    const remaining=e.crates.filter(crate=>crate.hp>0).length;
    const income=e.tallies.saleIncome,cost=e.tallies.buyCost,service=e.tallies.serviceCost;
    const roadFee=e.completed && !e.returned?2:0,cargoPay=e.completed&&!e.returned?remaining:0;
    return {roadFee,cargoPay,buyCost:cost,saleIncome:income,serviceCost:service,netCash:roadFee+cargoPay+income-cost-service,
      openingGoodsIncome:e.tallies.openingGoodsIncome||0,tradeCashFlow:income-cost,tradeProfit:e.tallies.tradeProfit,returned:e.returned,remaining,
      correct:e.correct,wrong:e.wrong,arrivals:e.arrivals,branchVisits:e.visited||0,expectedFee:e.returned?0:2,expectedCargo:e.returned?0:remaining};
  }
  function escortView(s) {
    if(!s?.trial || (s.phase!=="escort" && !(s.phase==="shop"&&s.floor===1)))return null;
    const t=s.trial,e=t.escort,stage=e?.stage||"offer",leg=e?.leg||0,marker=e?.marker||0;
    const header={revision:t.revision||0,leg,marker,stage,frame:escortFrame(s)};
    const opts=[];
    function offer(id,label,detail,reason="",extra={}) {
      opts.push({...header,id,label,detail,disabled:Boolean(reason),reason,...extra});
    }
    const crates=e?.crates||[],road=escortLegs[leg],branch=escortBranches[leg],sealed=crates.filter(c=>c.hp===2).length;
    const cargo={intact:crates.filter(c=>c.hp>0).length,sealed,max:3,crates:crates.map(c=>({...c})),
      ash:escortCargo(t,"ash"),shell:escortCargo(t,"ink-shell")};
    const v={...header,stage,road:road.road,station:road.station,title:"绯绡的押运单",description:"四段驿道，三处沿途市。带三箱托货前往照影渡。",
      hint:"押金 0 石 · 全程脚程 2 石 · 每箱尚存加 1 石",notice:e?.notice||"",cue:null,cash:s.gold,cargo,
      branchRoad:!!e?.branchRoad,branchName:branch?.name||"",condition:crates.reduce((sum,c)=>sum+c.hp,0),completedWaypoints:(e?.correct||0)+(e?.wrong||0),
      receipt:e?escortReceipt(e):null,options:opts};
    if(stage==="offer"){
      offer("start","接单起行","免费领三箱。自购货要用现钱和囊格。",t.pending.length?"先处理地上战利":!t.firstSale&&!t.carried?"先定原印去留":"");
    }else if(stage==="road"){
      v.title=e.branchRoad?branch.mark:road.marks[marker];v.cue=escortCue(s,e);
      const danger=v.cue==="left"?"右":"左",safe=v.cue==="left"?"左":"右";
      v.description=v.cue==="brace"?"前方横索架在两桩之间。点车厢压稳箱盖。":danger+"侧有"+escortHazards[leg]+"，"+safe+"侧双辙稳当。";v.hint="此处看准货封，错行损一层。";
      for(const id of escortMoves)offer(id,escortNames[id],id==="brace"?"稳住箱身，防止上下颠动。":id==="left"?"靠车道左侧行进。":"靠车道右侧行进。");
    }else if(stage==="station"){
      const advert=escortShops[leg][0];
      v.turnoff=road.station+(advert.buy?"售":"收")+wares[advert.type].name+"，每份 "+advert.price+" 石。"+["下驿收灰 3 石。","窑口墨壳卖 2 石，下驿收 4 石。","最后一驿；错过后照影渡只收托箱。"][leg];
      v.title=road.station;
      v.description=["桥头有便宜灯灰。下站水驿最多收两份，每份 3 石。","水驿要灯灰。此处墨壳 2 石，下站挂铃栈收一枚 4 石。","最后一次修车。交割所只验车货，剩下的自购货随你回柜。"][leg];
      v.hint="补货用自家灵石，货装进行囊；每个驿站限量。";
      for(const lot of escortShops[leg]){
        const key=leg+"/"+lot.id,left=lot.limit-(e.used[key]||0),name=wares[lot.type].name;
        let reason=left<1?"本站定额已尽":"";
        if(!reason&&lot.buy && s.gold<lot.price)reason="还缺 "+(lot.price-s.gold)+" 石";
        if(!reason&&lot.buy&&!storePieces({...t},lot.type,1,false))reason="囊中放不下";
        if(!reason&&!lot.buy&&!escortCargo(t,lot.type))reason="囊中无"+name;
        offer(lot.id,(lot.buy?"购":"卖")+name+" · "+lot.price+" 石","每次一份，本站余 "+left+" 份。",reason,
          {typeId:lot.type,available:left,unitPrice:lot.price,quantity:1,balanceAfter:reason?s.gold:s.gold+(lot.buy?-lot.price:lot.price)});
      }
      const loose=crates.some(c=>c.hp===1),lost=crates.some(c=>c.hp===0);
      offer("repair","补封 · 1 石","将一箱松封货由一层修回两层。",!loose?"无松封货箱":s.gold<1?"还缺 1 石":"");
      offer("patch","补箱 · 一份灯灰","把一份自家灯灰封作代货，补足一只空箱。",!lost?"无空箱":!cargo.ash?"缺一份灯灰":"");
      if(!e.used["branch-"+leg])offer("visit-branch","往"+branch.name+" · 支道一标",branch.hint);
      offer("continue","上路","前往"+escortLegs[leg+1].road+"。");
      offer("abort","卸契返柜","交回托货，自购物照原样带走。放弃脚程与送箱钱。");
    }else if(stage==="branchMarket"){
      v.title=branch.name;v.description=branch.hint;v.hint="只取一项，办完回本驿。";
      if(leg===0)offer("branch-ash","收一份灯灰","不花灵石，占一份灯灰的位置。",storePieces({...t},"ash",1,false)?"":"锦囊放不下");
      if(leg===1)offer("branch-shell","灯灰换墨壳","付一份灯灰，得一枚真壳；挂铃栈收 4 石。",!cargo.ash?"囊中缺灯灰":!branchBarterFits(t)?"墨壳在囊中放不下":"");
      if(leg===2){
        offer("branch-sale","卖一份灯灰 · 3 石","收现钱，付过的进货本钱在账上。",cargo.ash?"":"囊中缺灯灰");
        offer("branch-mend","请匠人补一箱","任取一箱松封或破损托货，免费修好。",crates.every(c=>c.hp===2)?"车上三箱完好":"");
      }
      offer("branch-back","原样回驿","这回先不出货。");
    }else if(stage==="delivery"){
      v.title="照影渡交割";v.description="渡口逐箱验封。自购灯灰和墨壳仍归你。";v.hint="脚程 2 石，余 "+cargo.intact+" 箱可交。";
      offer("deliver","验箱收款","本次收入 "+(2+cargo.intact)+" 石，脚程与箱钱分别入账。");
    }else{
      v.title=e.returned?"退契清账":"驿运清账";v.description=e.returned?"你在中途驿站退回车货。":"渡口已签收货，车脚与托货逐笔入账。";
      v.hint="私货留在囊中，原印仍照旧价验收。";
      if(s.phase==="escort")offer("return","回到狐柜","回首柜整备，依原路线守关与结算。");
    }
    return v;
  }
  function removeEscortUnit(t,id) {
    const piece=t.cargo.find(p=>p.id===id);
    if(!piece)return false;
    t.cargo=t.cargo.flatMap(p=>p!==piece?[p]:quantity(p)===1?[]:[{...p,qty:quantity(p)-1}]);
    return true;
  }
  function takeEscortBasis(e,type) {
    const index=e.purchases.findIndex(item=>item.type===type);
    return index<0?null:e.purchases.splice(index,1)[0].cost;
  }
  function escortAct(state,command) {
    if(!command || typeof command!=="object")return state;
    const v=escortView(state),a=v?.options.find(o=>o.id===command.id);
    if(!a || a.disabled || ["frame","revision","leg","marker","stage"].some(k=>a[k]!==command[k]))return state;
    const t={...state.trial,revision:(state.trial.revision||0)+1},s={...state,trial:t,log:state.log.slice()};
    if(a.id==="start"){
      t.escort={stage:"road",leg:0,marker:0,completed:false,returned:false,correct:0,wrong:0,arrivals:0,used:{},purchases:[],
        crates:[1,2,3].map(n=>({id:"驿箱"+n,hp:2})),notice:"三箱领齐，往芦灯水道行车。",tallies:{saleIncome:0,buyCost:0,serviceCost:0,tradeProfit:0}};
      s.phase="escort";log(s,t.escort.notice);return s;
    }
    const old=t.escort,e={...old,used:{...old.used},purchases:old.purchases.slice(),tallies:{...old.tallies},crates:old.crates.map(c=>({...c}))};
    t.escort=e;
    if(e.stage==="road"){
      const right=a.id===v.cue;
      if(right){e.correct++;e.notice=v.cargo.intact?escortNames[a.id]+"，车轮过标，箱封安稳。":"空车平稳过标。"}
      else{
        e.wrong++;
        const box=e.crates.find(c=>c.hp>0);
        if(box){box.hp--;e.notice=box.id+(box.hp?"松了一层封签。":"已破，托货遗失。")}
        else e.notice="空车颠过险标，私囊仍在身上。";
      }
      if(e.branchRoad){
        e.branchRoad=false;e.stage="branchMarket";e.visited=(e.visited||0)+1;
      }else{
        e.marker++;
        if(e.marker===6){e.stage=e.leg===3?"delivery":"station";e.arrivals++}
      }
    }else if(e.stage==="station"){
      const lot=escortShops[e.leg].find(item=>item.id===a.id);
      if(lot){
        const before=s.gold,key=e.leg+"/"+a.id;
        if(lot.buy){
          if(!storePieces(t,lot.type,1,false))return state;
          s.gold-=lot.price;e.tallies.buyCost+=lot.price;e.purchases.push({type:lot.type,cost:lot.price});
        }else{
          if(!removeEscortUnit(t,lot.type))return state;
          s.gold+=lot.price;e.tallies.saleIncome+=lot.price;
          const basis=takeEscortBasis(e,lot.type);if(basis!==null)e.tallies.tradeProfit+=lot.price-basis;
          else e.tallies.openingGoodsIncome=(e.tallies.openingGoodsIncome||0)+lot.price;
          if(lot.type==="ash")t.ashSold++;
        }
        e.used[key]=(e.used[key]||0)+1;
        e.notice=(lot.buy?"买入":"售出")+wares[lot.type].name+"一份，灵石 "+before+" → "+s.gold+"。";
        t.tradeLedger=[...t.tradeLedger,{action:"escort-"+a.id,venue:v.station,itemId:lot.type,qty:1,unitPrice:lot.price,total:lot.price,before,after:s.gold}];
      }else if(a.id==="visit-branch"){
        e.used["branch-"+e.leg]=1;e.stage="road";e.branchRoad=true;e.notice="拐入"+escortBranches[e.leg].name+"支道。";
      }else if(a.id==="repair"){
        e.crates.find(c=>c.hp===1).hp=2;s.gold--;e.tallies.serviceCost++;e.notice="付 1 石重缚箱绳，松封已修好。";
      }else if(a.id==="patch"){
        if(!removeEscortUnit(t,"ash"))return state;
        e.crates.find(c=>c.hp===0).hp=2;takeEscortBasis(e,"ash");e.notice="从囊中取一份灯灰补箱，重新上封。";
      }else if(a.id==="continue"){
        e.leg++;e.marker=0;e.stage="road";e.notice="辞过驿市，进入"+escortLegs[e.leg].road+"。";
      }else{
        e.returned=true;e.completed=true;e.stage="done";e.notice="已撤回押单；这一行不能再次接单。";
      }
    }else if(e.stage==="branchMarket"){
      if(a.id==="branch-ash"){
        if(!storePieces(t,"ash",1,false))return state;
        e.purchases.push({type:"ash",cost:0});
        e.notice="在芦汀收起一份灯灰，已放进锦囊。";
      }else if(a.id==="branch-shell"){
        if(!removeEscortUnit(t,"ash")||!storePieces(t,"ink-shell",1,false))return state;
        const basis=takeEscortBasis(e,"ash");
        e.purchases.push({type:"ink-shell",cost:basis});
        e.notice="留灰一份，带壳一枚回驿。";
      }else if(a.id==="branch-sale"){
        if(!removeEscortUnit(t,"ash"))return state;
        const basis=takeEscortBasis(e,"ash");
        s.gold+=3;t.ashSold++;e.tallies.saleIncome+=3;
        if(basis!==null)e.tallies.tradeProfit+=3-basis;
        else e.tallies.openingGoodsIncome=(e.tallies.openingGoodsIncome||0)+3;
        t.tradeLedger=[...t.tradeLedger,{action:"escort-branch-sale",venue:v.title,itemId:"ash",qty:1,unitPrice:3,total:3,before:state.gold,after:s.gold}];
        e.notice="夜摊收灰一份，三石入囊。";
      }else if(a.id==="branch-mend"){
        const box=e.crates.find(c=>c.hp===0)||e.crates.find(c=>c.hp===1);
        if(!box)return state;
        box.hp=2;e.notice=box.id+"已修好，免收修钱。";
      }else e.notice="空手回驿，继续赶路。";
      e.stage="station";
    }else if(e.stage==="delivery"){
      e.completed=true;e.stage="done";
      const q=escortReceipt(e);s.gold+=q.roadFee+q.cargoPay;
      e.notice="领脚程 "+q.roadFee+" 石，托货 "+q.cargoPay+" 石。";
    }else{
      s.phase="shop";e.notice="押运清账，重回绯绡的货柜。";
    }
    log(s,e.notice);return s;
  }

  function marketView(s) {
    const t=s.trial,price=silkPrice(s);
    return {hot:price===4,silkPrice:price,silkLimit:2,abacusBonus:hasRelic(s,"abacus")?abacusPower(s.gold):0,
      ledger:{silkBought:t.silkBought,silkSold:t.silkSold,silkCost:t.silkBought*2,silkRevenue:t.silkRevenue,
        silkProfit:t.silkRevenue-2*t.silkSold,ashSold:t.ashSold,escort:t.escort?escortReceipt(t.escort):null,trades:t.tradeLedger.slice()}};
  }
  function sideView(s) {
    const t = s.trial;
    const depth = roll(s.seed,"棘深",2);
    const toll = 3 + depth - Number(hasRelic(s,"bell"));
    const coins = 2 + depth;
    const done = Boolean(t.sideTaken), reason = done ? "此行已探过侧廊" : "";
    const kind = roll(s.seed,"岔门",2) ? "wound" : "ink-mite";
    const actions = [
      quote("detour-wound","入血棘廊","拾遗损 "+toll+" 血，得 "+coins+" 石，也可绕过",reason),
      quote("detour-ink","探墨蠹巢","墨蠹气血 "+inkMite.hp+"，得 3 石与墨蠹壳",reason),
      quote("detour-haul","抢收巢货","损 4 血封住余火，舍巢中 3 石。胜得三壳、十二份灯灰，囊满须当场取舍。",reason || (s.hp<=4?"至少留 1 血才能入巢":""))
    ];
    const tip = actions[kind === "wound" ? 0 : 1];
    return {kind,name:tip.label,detail:tip.detail,done,toll,coins,actions};
  }
  function bloodActions(s) {
    const newCap = cap(s)-4, nextHp = Math.min(newCap,s.hp);
    return [
      quote("blood-coins","放血换石","气血 "+s.hp+" 至 "+Math.max(0,s.hp-4)+"，灵石 "+s.gold+" 至 "+(s.gold+3),
        s.hp<=4 ? "至少留 1 血才能签契" : ""),
      quote("blood-slot","削命开栏","气血上限 "+cap(s)+" 至 "+newCap+"，当前 "+s.hp+" 至 "+nextHp+"，法宝栏增至 2",
        s.trial.relicLimit>=2 ? "法宝栏已开" : newCap<1 ? "气血上限不足" : ""),
      quote("skip-blood","合契回柜","保住气血与栏位，原路返回狐柜")
    ];
  }
  function trialProfile(s) {
    return {hp:s.hp,maxHp:cap(s),gold:s.gold,swordDamage:swordDamage(s),block:block(s),
      relicLimit:s.trial.relicLimit,relics:s.trial.relics.map(id=>({...wares[id]})),
      packLimit:s.trial.packLimit,consumables:s.trial.consumables.map(id=>({...wares[id]})),
      bag:inventoryView(s),weapon:{...wares[s.trial.weapon]},accessory:s.trial.accessory ? {...wares[s.trial.accessory]} : null,
      bloodCharge:s.trial.bloodCharge,bloodBonus:bloodBonus(s),bloodDamageTotal:s.trial.spentBlood,drainHealTotal:s.trial.drainedHp,
      counter:s.counter,baseSwordDamage:swordDamage(s)-s.counter-(s.trial.gritActive ? 4 : 0),order:s.trial.order ? {...wares[s.trial.order]} : null,arrivalOrder:s.trial.arrivalOrder ?? "",
      seals:s.seals.map(sealName),gritBought:s.trial.gritBought,gritActive:s.trial.gritActive};
  }

  function start(seed, { marketTrial = false } = {}) {
    return {
      seed: String(seed ?? Date.now()), phase: "start", floor: 1, build: null,
      ...(marketTrial ? {maxHp:MAX_HP, trial:trialStart()} : {}),
      hp: MAX_HP, gold: 3, upgrades: 0, charges: 0, seals: [], receipts: [],
      foeHp: 0, turn: 0, counter: 0, armed: false, mirror: false, mirrorReady: false,
      potionSold: false, marketIntel: false, bossIntel: false, parries: 0, echoes: 0,
      log: ["持家令入塔，随身灵石三枚。"]
    };
  }

  function log(s, message) {
    s.log.push(message);
    if (s.log.length > 8) s.log.shift();
  }
  function move(s, floor, turn) {
    const d = encounter(s,floor), moves = d.moves;
    if (d === inkMite) return moves[(turn+roll(s.seed,"蠹招",moves.length)) % moves.length];
    const offset = floor === 1 ? 0 : roll(s.seed, "招" + floor, moves.length);
    return moves[(turn + offset) % moves.length];
  }
  function markFor(s, floor) {
    return floor === 1 ? marks[0] : marks[roll(s.seed, "印" + floor, 2)];
  }
  function wanted(s, floor) {
    if (s.trial) return floor === 1 ? "鸣纹" : "灯纹";
    return marks[roll(s.seed, "求" + floor, 2)];
  }
  function price(s, seal, floor=s.floor) {
    return seal.mark === wanted(s, floor) ? 7 : 4;
  }
  function swordDamage(s) {
    const base = {sword:s.trial?.weapon==="hook" ? 5 : 6, disc:5, shield:4};
    return (base[s.build] ?? 0) + Number(hasRelic(s,"fang")) + (s.build === "sword" ? 2 * s.upgrades : 0) + s.counter + (s.trial?.gritActive ? 4 : 0);
  }
  function block(s) { return s.build === "shield" ? 8 + 2 * s.upgrades : s.trial?.weapon==="ward-blade" ? 6 : 4; }
  function bloodBonus(s) {
    return s.trial?.accessory==="knot" && s.trial.bloodCharge>0 ? (s.trial.weapon==="hook" ? 6 : 3) : 0;
  }
  function sealName(seal) { return seal.mark + "印"; }
  function inform(s) {
    if (s.floor === 1) return s.marketIntel ? "路签 · 末市以 7 石求" + wanted(s, 2) + "印"+(s.trial?"；封蜡绢每份 "+silkPrice(s)+" 石，限两份":"") : "下摊收购单未探明";
    if (s.bossIntel) {
      const [name, damage] = move(s, 3, 0);
      return "塔顶路签 · 负钟君起手「" + name + "」" + damage + " 伤";
    }
    return "塔顶前末市，离摊后灵石无法再花";
  }
  function beginFight(s) {
    s.phase = "fight";
    s.foeHp = encounter(s).hp;
    s.turn = 0;
    s.focusSpent = false;
    s.counter = 0;
    s.armed = false;
    s.mirrorReady = s.mirror;
    if (s.trial) {
      s.trial.mirrorReady = hasRelic(s,"mirror");
      s.trial.lastHit = 0;
      s.trial.lastHeal = 0;
      s.trial.lastPrevented = 0;
      s.trial.lastBloodDamage = 0;
      s.trial.lastDrainHeal = 0;
      s.trial.bloodHitSeen = false;
      s.trial.abacusEntryGold=s.gold;
      s.trial.abacusReady=hasRelic(s,"abacus")?abacusPower(s.gold):0;
      s.trial.lastAbacusDamage=0;
    }
    if (s.trial && s.floor === 2) {
      s.trial.gateEntryHp = s.hp;
      s.trial.gateDamageTaken=0;
      s.trial.gateRecovered=0;
      s.trial.gritActive = s.trial.gritBought;
    }
    log(s, "步入" + (s.foeKind === "ink-mite" ? "侧廊" : floors[s.floor - 1]) + "，遇见" + encounter(s).name + "。");
  }
  function moveText([name, damage]) {
    return name + " " + damage + " 伤" + (damage >= HEAVY ? "（重击）" : "");
  }
  function fightView(s, v) {
    const d = encounter(s);
    const now = move(s, s.floor, s.turn);
    const next = move(s, s.floor, s.turn + 1);
    v.title = d.name;
    v.description = d.story;
    v.intent = "本手 " + moveText(now) + " → 下手 " + moveText(next);
    v.enemy = {name: d.name, hp: s.foeHp, maxHp: d.hp, kind:s.foeKind};
    v.combat = {focusReady: !s.focusSpent, abacusBonus:s.trial?.abacusReady||0, swordDamage: swordDamage(s)+bloodBonus(s)+(s.trial?.abacusReady||0), bloodBonus:bloodBonus(s), now: now[1], next: next[1], heavy: now[1] >= HEAVY, nextHeavy: next[1] >= HEAVY};
    v.actions = [
      action("strike", "出剑", "先斩 " + v.combat.swordDamage + " 血" + (s.counter ? "，含蓄势 +" + s.counter : "，击杀可断招")),
      action("guard", s.build === "shield" ? "架盾" : "守势", s.trial?.weapon==="ward-blade" ? "挡 6 伤，接威力至少 3 的招，下剑 +4" : "挡 " + block(s) + " 伤，接重击下剑 +" + (s.build === "shield" ? 6 : 2))
    ];
    if (s.build === "disc") {
      v.actions.push(action("cast", s.armed ? "法盘已就位" : "布回声阵", s.armed ? "等重击触发，仍可出剑" : "耗 1 充，下手起截一次重击并回击 6", s.armed || s.charges < 1));
    }
  }
  function shopView(s, v) {
    const inventory = s.trial ? s.seals.filter(seal => seal.id === 1 && (s.floor === 2 || !s.trial.carried)) : s.seals;
    v.offers = inventory.map(seal => ({
      id: "sell-" + seal.id, mark: seal.mark, price: price(s, seal),
      later: s.floor === 1 && s.marketIntel ? price(s, seal, 2) : null
    }));
    v.title = s.floor === 2 ? "末市 · 狐商绯绡" : "狐商 · 绯绡";
    v.description = s.floor === 1 ? "绯绡用折扇拢住秤盘。“灯下的价，客人慢慢想。”" : "绯绡拨了拨金秤砣。“再往上，只有铜钟肯应你了。”";
    v.intent = "本摊求" + wanted(s, s.floor) + "印 7 石，其他印 4 石 · " + inform(s);
    v.actions = inventory.map(seal => {
      const payment = price(s, seal);
      return action("sell-" + seal.id, "售" + sealName(seal), "+" + payment + " 石，售后有 " + (s.gold + payment) + " 石");
    });
    if (s.trial) {
      if (s.floor === 1) {
        v.stock = stockView(s);
        v.side = sideView(s);
        if (inventory.length) v.actions.push(action("keep","留印赴末市","封入印袋，过关后以 7 石亲自交割"));
        v.actions.push(...v.stock.flatMap(item=>item.actions), ...v.side.actions);
        v.actions.push(quote("detour","探侧廊",v.side.detail,v.side.done ? "已走过侧廊" : ""));
        v.actions.push(action("gate", "闯夜市狐关", "携当前钱囊和余印入关"));
      } else {
        v.description = inventory.length ? "绯绡对上缺角，抬手邀你把照影廊的原印放上秤。" : "绯绡翻到首摊收货的那一页，示意你核账。";
        v.intent = inventory.length ? "末市收照影廊原印，路签价 7 石" : "首摊印账已清，可核对守关与结余";
        v.stock = stockView(s);
        v.actions.push(...v.stock.flatMap(item=>item.actions));
        const pending = s.trial.pending.length ? "先到行囊收起或放弃地上战利" : "";
        v.actions.push(quote("settle","合上印账","印价与守关结果入账",pending || (inventory.length ? "先交割原印" : "")));
      }
      return;
    }
    const healing = Math.min(7, MAX_HP - s.hp);
    v.actions.push(action("potion", "买回春丹", s.potionSold ? "本摊已售罄" : "5 石，回 " + healing + " 血" + (s.gold >= 5 ? "，余 " + (s.gold - 5) + " 石" : "，缺 " + (5 - s.gold) + " 石"), s.potionSold || s.gold < 5 || healing === 0));
    v.actions.push(action("mirror", "买护心镜", s.mirror ? "已佩戴" : "8 石，每战首次受伤减 6" + (s.gold >= 8 ? "，余 " + (s.gold - 8) + " 石" : "，缺 " + (8 - s.gold) + " 石"), s.mirror || s.gold < 8));
    v.actions.push(action("leave", "离摊整备", "携余印前往器台"));
  }
  function view(s) {
    const equipment = builds[s.build];
    const specialty = s.build === "disc" ? "充能 " + s.charges + (s.armed ? " · 阵已启" : "") :
      s.build === "shield" ? "格挡 " + block(s) + (s.counter ? " · 反震已蓄" : "") : "剑伤 " + swordDamage(s);
    const v = {
      floor: s.floor, phase: s.phase, seed: s.seed, build: s.build, title: "", description: "", intent: "",
      stats: [entry("气血", s.hp + "/" + cap(s)), entry("灵石", s.gold), entry("妖印", s.seals.length)],
      bag: [entry("佩器", equipment ? (s.trial ? wares[s.trial.weapon].name : equipment.name) + " · " + specialty : "待选"), entry("余印", s.seals.map(sealName).join("、") || "无")],
      actions: [], log: s.log.slice()
    };
    if (s.trial) {v.profile=trialProfile(s);v.market=marketView(s)}
    if (s.mirror) v.bag.push(entry("护心镜", s.phase === "fight" ? (s.mirrorReady ? "镜光未耗" : "本战已触发") : "已佩戴"));
    switch (s.phase) {
      case "start":
        v.title = "择一件家传佩器";
        v.description = "临行前，师父掀开旧木匣。你只能带走一件，陪你走完三层塔。";
        v.intent = "封住塔顶负钟君 · 开局气血 24，灵石 3";
        v.actions = Object.entries(builds).map(([id, gear]) => action(id, gear.name, gear.hint));
        if (s.trial) {
          v.title = "照影廊 · 一印两价";
          v.description = "持"+wares[s.trial.weapon].name+"入廊，寻末市的狐灯。";
          v.intent = "携剑问市 · 开局气血 "+s.hp+"，灵石 "+s.gold;
          v.actions = v.actions.filter(a => a.id === "sword");
        }
        break;
      case "fight": fightView(s, v); break;
      case "reward":
        v.title = "收取" + markFor(s, s.floor) + "印";
        v.description = "妖影散去，一枚温热的印留在阵心。先收进行囊，到妖市看过报价再作打算。";
        v.intent = s.trial ? "首摊现价 4 石，末市路签 7 石" : "印可售 4–7 石，也可嵌入" + equipment.name;
        v.actions = [action("take", "拾取妖印", "得 1 枚" + markFor(s, s.floor) + "印，前往岔路")];
        if(s.trial)v.actions.push(action("take-ash","连灰收起","得灯纹印与 1 份灯灰，灰可售 1 石"));
        break;
      case "route": {
        v.title = "石阶岔路";
        v.description = "左侧檐灯尚亮，右侧剑冢露出几点碎银。两条路都通向妖市。";
        const rest = s.floor === 2 && roll(s.seed, "路径", 2) === 0;
        const safe = rest ? action("rest", "檐下歇脚", "回 " + Math.min(3, MAX_HP - s.hp) + " 血，上限 24") :
          action("guide", "问道友", s.floor === 1 ? "免费打听末市高价收哪种印" : "免费打听塔顶妖物的起手");
        v.intent = "只走一条 · 下一站" + (s.floor === 2 ? "是塔顶前末市" : "是绯绡的摊位");
        v.actions = [safe, action("salvage", "入剑冢拾遗", "损 3 血，取 4 石" + (s.hp <= 3 ? "，气血不足" : ""), s.hp <= 3)];
        if (s.trial) {
          v.title = "阶边问路";
          v.description = "一位行脚道友坐在石阶边，手中捻着狐灯末市的路签。";
          v.intent = "问末市的印价";
          v.actions = [safe];
        }
        break;
      }
      case "shop": shopView(s, v); break;
      case "escort": {
        const e=escortView(s);v.title=e.title;v.description=e.description;v.intent=e.hint;
        break;
      }
      case "wound": {
        const side = sideView(s);
        v.side = side;
        v.title = "血棘挂钱";
        v.description = "三两枚旧钱挂在倒刺上。越过石槽，就能看见血客的小灯。";
        v.intent = hasRelic(s,"bell") ? "旧铜铃消去 1 点棘伤" : "血棘会割伤取钱的手";
        v.actions = [quote("scavenge","摘下棘钱","损 "+side.toll+" 血，得 "+side.coins+" 石",
          s.hp<=side.toll ? "至少留 1 血才能拾遗" : ""),quote("skirt","绕开血棘","保住气血，沿石槽去见血客")];
        break;
      }
      case "blood":
        v.title = "血契客";
        v.description = "契纸只容一枚指印。鲜血换现钱，折寿另开一栏。";
        v.intent = "只可签一笔，签毕回到狐柜";
        v.actions = bloodActions(s);
        if (s.trial.pending.length) v.actions = v.actions.map(a=>quote(a.id,a.label,a.detail,"先到行囊收起或放弃地上战利"));
        break;
      case "prep":
        v.title = "器台整备";
        v.description = s.seals.length ? "将印嵌进佩器，或留在囊中带走。每一枚印只能用一次。" : "印袋已空。佩器在手，下一层的门已开。";
        v.intent = equipment.name + " · " + equipment.upgrade + "／枚" + (s.floor === 1 ? " · " + inform(s) : s.bossIntel ? " · " + inform(s) : " · 下一站沉钟殿");
        v.actions = s.seals.map(seal => action("embed-" + seal.id, "嵌" + sealName(seal), "耗此印，" + equipment.upgrade));
        v.actions.push(action("climb", "登" + floors[s.floor], s.seals.length ? "带走 " + s.seals.length + " 枚余印" + (s.floor === 2 ? "，塔顶没有器台" : "") : "携当前佩器入关"));
        break;
      default:
        v.title = s.phase === "won" ? "钟歇，塔封" : "灯灭，留印";
        v.description = s.phase === "won" ? "铜钟沉回石座。你在封钉上按下家印，塔外天已泛白。" : "残灯落地。你留下的脚印，停在最后一块门槛石前。";
        v.intent = (equipment ? equipment.name : "") + " · " + (s.parries ? "接重击 " + s.parries + " 次 · " : "") + (s.echoes ? "法盘截招 " + s.echoes + " 次 · " : "") + "余石 " + s.gold;
        if (s.receipts.length) v.bag.push(entry("印账", s.receipts.join("；")));
        if (s.trial) {
          v.title = s.phase === "won" ? "末市印账" : "灯影止步";
          v.description = s.phase === "won" ? "关已过，绯绡收起铜秤。" : "灯火暗去，此行止于" + floors[s.floor - 1] + "。";
          v.intent = "守关出剑 " + s.trial.gateStrikes + " 次 · 余石 " + s.gold;
        }
    }
    return v;
  }

  function resolveFight(s, id) {
    if (s.trial) {
      s.trial.lastHit = 0;
      s.trial.lastHeal = 0;
      s.trial.lastPrevented = 0;
      s.trial.lastBloodDamage = 0;
      s.trial.lastDrainHeal = 0;
    }
    if(s.trial)s.trial.lastAbacusDamage=0;
    const [moveName, incoming] = move(s, s.floor, s.turn);
    const triggers = s.armed && incoming >= HEAVY;
    let absorbed = 0;
    let damage = 0;
    let line;
    if (id === "strike" || id === "focus-strike") {
      const focused = id === "focus-strike";
      const blood = bloodBonus(s);
      const coinBonus=s.trial?.abacusReady||0;
      damage = swordDamage(s) + blood + coinBonus + (focused ? 2 : 0);
      if(s.trial){s.trial.abacusReady=0;s.trial.lastAbacusDamage=coinBonus}
      if (blood) {
        s.trial.bloodCharge--;
        s.trial.lastBloodDamage = blood;
        s.trial.lastDrainHeal = Math.min(2,cap(s)-s.hp);
        s.hp += s.trial.lastDrainHeal;
        s.trial.spentBlood += blood;
        s.trial.drainedHp += s.trial.lastDrainHeal;
      }
      if (focused) s.focusSpent = true;
      line = (focused ? "合锋 " : "出剑 ") + damage + " 伤" + (s.counter ? "（含蓄势 " + s.counter + "）" : "");
      if(coinBonus)line += "，算盘首击增 "+coinBonus+" 伤";
      if (blood) line += "，血珀增 "+blood+" 伤，回 "+s.trial.lastDrainHeal+" 血";
      s.counter = 0;
    } else if (id === "guard") {
      absorbed = Math.min(block(s), incoming);
      line = "守势挡 " + (triggers ? 0 : absorbed) + " 伤";
      if(s.trial&&s.floor===1&&s.foeKind!=="ink-mite"&&absorbed>=incoming&&!s.trial.sweptAsh){
        s.trial.sweptAsh=true;line+="，接住翅上的灯灰。连灰拾取时多得 1 份";
      }
      if(s.trial&&s.foeKind==="gate-fox"&&incoming>=HEAVY){
        s.trial.cleanClasp=true;line+="，护住完整狐扣，末市收 5 石";
      }
    } else {
      s.charges--;
      s.armed = true;
      line = "布下回声盘，下手生效";
    }
    s.turn++;
    const gate = s.trial && s.floor === 2;
    if (gate) {
      s.trial.gateTurns = s.turn;
      if (id === "strike" || id === "focus-strike") s.trial.gateStrikes++;
    }
    s.foeHp = Math.max(0, s.foeHp - damage);
    if (s.foeHp > 0) {
      if (triggers) {
        s.armed = false;
        s.echoes++;
        s.foeHp = Math.max(0, s.foeHp - 6);
        line += "，回声盘截下" + moveName + "，回击 6";
      } else {
        const ward = s.trial?.weapon==="ward-blade";
        if (absorbed && incoming >= (ward ? 3 : HEAVY)) {
          s.counter = ward ? 4 : s.build === "shield" ? 6 : 2;
          s.parries++;
          line += "，下剑 +" + s.counter;
        }
        let hurt = incoming - absorbed;
        if (hurt > 0 && s.mirrorReady) {
          const prevented = Math.min(6, hurt);
          hurt -= prevented;
          s.mirrorReady = false;
          line += "，护心镜挡 " + prevented;
        }
        if (hurt>0 && s.trial?.mirrorReady) {
          const prevented = Math.min(4,hurt);
          hurt -= prevented;
          s.trial.mirrorReady = false;
          s.trial.lastPrevented = prevented;
          line += "，护心镜抵去 "+prevented+" 伤";
        }
        s.hp = Math.max(0, s.hp - hurt);
        if (s.trial) {
          s.trial.lastHit = hurt;
          if (hurt>0 && s.hp>0 && s.trial.accessory==="knot" && !s.trial.bloodHitSeen) {
            if (addBlood(s)) line += "，血珀蓄能 "+s.trial.bloodCharge;
            s.trial.bloodHitSeen = true;
          }
        }
        line += "，" + moveName + "造成 " + hurt + " 伤";
        if (hurt>0 && s.hp>0 && s.hp*2<=cap(s) && s.trial?.consumables.includes("salve")) {
          const restored = Math.min(6,cap(s)-s.hp);
          s.trial.consumables = s.trial.consumables.filter(id=>id!=="salve");
          s.hp += restored;
          s.trial.lastHeal = restored;
          line += "，续灯膏回 "+restored+" 血";
        }
      }
    }
    if(gate){
      s.trial.gateDamageTaken+=s.trial.lastHit;
      s.trial.gateRecovered+=s.trial.lastHeal+s.trial.lastDrainHeal;
    }
    if (!s.foeHp) {
      s.armed = false;
      s.counter = 0;
      s.phase = gate ? "shop" : s.floor === 3 ? "won" : "reward";
      line += "，封住" + encounter(s).name;
      if (s.foeKind==="ink-mite") {
        s.trial.sideCleared = true;
        s.phase = "blood";
        if(s.trial.sideTaken==="haul"){
          line+="，抢收巢货："+receiveDrop(s,"ink-shell",3)+"，"+receiveDrop(s,"ash",12);
        }else{
          s.gold+=3;
          line+="，取回 3 石，"+receiveDrop(s,"ink-shell");
        }
      } else if (gate) {
        line += "，"+receiveDrop(s,"fox-clasp");
      }
    } else if (!s.hp) {
      s.phase = "lost";
    }
    if (gate && s.phase !== "fight") s.trial.gritActive = false;
    log(s, line + "。");
  }

  function tradeStock(s,id,stock,typedQuote) {
    const item=stock.find(lot=>lot.actions.some(a=>a.id===id));
    if(!item)return false;
    const q=typedQuote||item.actions.find(a=>a.id===id),t=s.trial,before=s.gold;
    if(q.disabled)return false;
    s.gold=q.balanceAfter;
    if(item.tradeKind==="sell"){
      t.cargo=t.cargo.flatMap(p=>{
        if(instance(p)!==q.instanceId||p.id!==item.id)return [p];
        return quantity(p)>q.qty?[{...p,qty:quantity(p)-q.qty}]:[];
      });
      if(item.id==="ash")t.ashSold+=q.qty;
      if(item.id==="silk"){t.silkSold+=q.qty;t.silkRevenue+=q.total}
      log(s,"售 "+item.name+" ×"+q.qty+"，收 "+q.total+" 石。");
    }else if(item.tradeKind==="order"){
      t.order=item.id;
      log(s,"寄单付 "+q.total+" 石，"+item.name+"留待下局领用。");
    }else if(item.id==="silk"){
      storePieces(t,item.id,q.qty,false);t.silkBought+=q.qty;
      log(s,"进绢 "+q.qty+" 份，付 "+q.total+" 石。");
    }else if(item.id==="lining"){
      t.liningBought=true;log(s,"付 3 石缝入衬布，行囊添四格。");
    }else{
      if(id.startsWith("barter-"))t.relics=t.relics.filter(relic=>relic!=="bell");
      t.stockTaken=[...t.stockTaken,item.id];
      if(item.id==="grit")t.gritBought=true;
      else if(item.id==="salve")t.consumables=[...t.consumables,item.id];
      else if(item.slot==="主手"){
        const pos=freePlace(t.cargo,t.weapon,bagHeight(t));
        t.cargo=[...t.cargo,{...newPiece(t,t.weapon,1),...pos}];t.weapon=item.id;
      }else if(item.slot==="饰品栏")t.accessory=item.id;
      else t.relics=[...t.relics,item.id];
      log(s,(id.startsWith("barter-")?"卸下旧铜铃，添 ":"付 ")+q.total+" 石，取得"+item.name+"。");
    }
    t.tradeLedger=[...t.tradeLedger,{action:id,itemId:item.id,instanceId:q.instanceId||null,qty:q.qty,
      unitPrice:q.unitPrice,total:q.total,before,after:s.gold,bonusBefore:q.bonusBefore,bonusAfter:q.bonusAfter}];
    return true;
  }
  function trialAction(s,id,v,typedQuote) {
    const t=s.trial;
    if(s.phase==="shop" && tradeStock(s,id,v.stock,typedQuote))return true;
    if (s.phase==="shop" && s.floor===1) {
      if (id==="keep") {
        t.carried = true;
        log(s,"收起灯纹印。末市仍认这枚原印。");
        return true;
      }
      if (id==="detour" || id==="detour-wound" || id==="detour-ink" || id==="detour-haul") {
        t.sideTaken = id==="detour" ? v.side.kind : id==="detour-wound" ? "wound" : id==="detour-haul" ? "haul" : "ink-mite";
        if (t.sideTaken==="ink-mite" || t.sideTaken==="haul") {
          if(t.sideTaken==="haul"){s.hp-=4;log(s,"压住巢火，损 4 血；取壳灰而舍灵石。")}
          s.foeKind = "ink-mite";
          beginFight(s);
        } else {
          s.phase = "wound";
          log(s,"侧身入廊，血棘上缠着几枚灵石。");
        }
        return true;
      }
    }
    if (s.phase==="wound") {
      if (id==="scavenge") {
        const {toll,coins} = sideView(s);
        s.hp -= toll;
        s.gold += coins;
        if (addBlood(s)) log(s,"血棘染珀，血珀蓄能 "+t.bloodCharge+"。");
        log(s,"取棘钱，损 "+toll+" 血，得 "+coins+" 石。");
      } else log(s,"绕过血棘。");
      t.sideCleared = true;
      s.phase = "blood";
      return true;
    }
    if (s.phase==="blood") {
      if (id==="blood-coins") {
        s.hp -= 4;
        s.gold += 3;
        if (addBlood(s)) log(s,"血契染珀，血珀蓄能 "+t.bloodCharge+"。");
        log(s,"放血付契，损 4 血，得 3 石。");
      } else if (id==="blood-slot") {
        s.maxHp = cap(s)-4;
        s.hp = Math.min(s.maxHp,s.hp);
        t.relicLimit = 2;
        log(s,"折去 4 点气血上限，法宝栏开至 2 格。");
      } else log(s,"推回血契。");
      t.contract = id;
      s.phase = "shop";
      delete s.foeKind;
      return true;
    }
    return false;
  }

  function act(state, command) {
    let typedQuote=null,id=command;
    if(command && typeof command==="object"){
      // The displayed lot is valid for exactly one immutable state, including its inventory revision.
      if(quoteOwners.get(command)!==state || command.disabled)return state;
      typedQuote=quoteTrade(state,command);
      if(!typedQuote||typedQuote.disabled)return state;
      id=command.id;
    }
    const current = view(state);
    const focused = id === "focus-strike";
    if (focused && !current.combat?.focusReady) return state;
    const choice = current.actions.find(a => a.id === (focused ? "strike" : id));
    if (!choice || (!typedQuote && choice.disabled)) return state;
    const s = {...state, seals: state.seals.slice(), receipts: state.receipts.slice(), log: state.log.slice()};
    if (state.trial) {
      s.trial = {...state.trial,revision:(state.trial.revision||0)+1};
      if (trialAction(s,id,current,typedQuote)) return s;
    }
    switch (s.phase) {
      case "start":
        s.build = id;
        s.charges = id === "disc" ? 1 : 0;
        beginFight(s);
        break;
      case "fight": resolveFight(s, id); break;
      case "reward":
        s.seals.push({id: s.floor, mark: markFor(s, s.floor)});
        if (s.trial){receiveDrop(s,"seal");if(id==="take-ash")receiveDrop(s,"ash",s.trial.sweptAsh?2:1)}
        log(s, "收下" + markFor(s, s.floor) + "印。");
        s.phase = "route";
        break;
      case "route":
        if (id === "guide") {
          if (s.floor === 1) s.marketIntel = true; else s.bossIntel = true;
          log(s, inform(s) + "。");
        } else if (id === "rest") {
          s.hp = Math.min(MAX_HP, s.hp + 3);
          log(s, "歇脚，气血恢复至 " + s.hp + "。");
        } else {
          s.hp -= 3;
          s.gold += 4;
          log(s, "拾遗：损 3 血，得 4 石。");
        }
        s.phase = "shop";
        s.potionSold = false;
        break;
      case "shop":
        if (id.startsWith("sell-")) {
          const seal = s.seals.find(item => id === "sell-" + item.id);
          const coins = price(s, seal);
          s.gold += coins;
          if (s.trial) {
            s.trial[s.floor === 1 ? "firstSale" : "finalSale"] = coins;
            s.trial.cargo = s.trial.cargo.filter(p=>p.id!=="seal");
          }
          s.seals = s.seals.filter(item => item.id !== seal.id);
          const receipt = floors[seal.id - 1] + "的" + sealName(seal) + "售 " + coins + " 石";
          s.receipts.push(receipt);
          log(s, receipt + "。");
        } else if (id === "gate") {
          s.floor = 2;
          s.foeKind = "gate-fox";
          beginFight(s);
        } else if (id === "settle") {
          s.phase = "won";
          log(s, "守关已过，末市印账结清。");
        } else if (id === "potion") {
          const heal = Math.min(7, MAX_HP - s.hp);
          s.gold -= 5;
          s.hp += heal;
          s.potionSold = true;
          log(s, "用 5 石服丹，回 " + heal + " 血。");
        } else if (id === "mirror") {
          s.gold -= 8;
          s.mirror = true;
          log(s, "用 8 石系上护心镜。");
        } else {
          s.phase = "prep";
          log(s, "离开秤台，余 " + s.gold + " 石。");
        }
        break;
      case "prep":
        if (id === "climb") {
          s.floor++;
          beginFight(s);
        } else {
          const seal = s.seals.find(item => id === "embed-" + item.id);
          s.seals = s.seals.filter(item => item.id !== seal.id);
          if (s.build === "disc") s.charges++; else s.upgrades++;
          const receipt = floors[seal.id - 1] + "的" + sealName(seal) + "嵌入" + builds[s.build].name;
          s.receipts.push(receipt);
          log(s, receipt + "，" + builds[s.build].upgrade + "。");
        }
        break;
    }
    return s;
  }
  function redeemOrder(order,seed) {
    const fresh = start(seed,{marketTrial:true});
    if (order!=="order-purse" && order!=="order-hook" && order!=="order-ash") return fresh;
    const t=fresh.trial;
    t.arrivalOrder=order;
    if (order==="order-purse") fresh.gold+=3;
    if (order==="order-ash") receiveDrop(fresh,"ash",3);
    if (order==="order-hook") {
      t.cargo=[{...newPiece(t,t.weapon,1),...freePlace([],t.weapon)}];
      t.weapon="hook";
      t.stockTaken=["hook"];
    }
    log(fresh,"领取上一行的"+wares[order].name+"。");
    return fresh;
  }
  function nextRun(previous,seed=previous.seed) {
    return redeemOrder(previous.phase==="won" ? previous.trial?.order : null,seed);
  }
  const bagItemIds=Object.freeze(Object.values(wares).filter(item=>item.slot!=="附于剑锋" && item.slot!=="下次入塔" && item.slot!=="缝入锦囊").map(item=>item.id));
  globalThis.Tower = {start,view,act,quoteTrade,escortView,escortAct,bagLayout,bagItemIds,footprint,arrange,canArrange:(s,op)=>Boolean(loadout(s,op)),nextRun,redeemOrder};
  if (typeof module !== "undefined" && module.exports) module.exports = globalThis.Tower;
})();
