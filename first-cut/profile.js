/* The field journal reads a single live rules snapshot whenever the player opens it. */
window.FieldJournal=(()=>{
  const dialog=document.getElementById("profile"), trigger=document.getElementById("profile-open");
  const el=(tag,cls,value)=>{
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(value!==undefined)n.textContent=value;
    return n;
  };
  function stat(label,value){
    const group=el("div","folio-stat");
    group.append(el("dt","",label),el("dd","",value));
    return group;
  }
  function section(label,tally){
    const panel=el("section","folio-section"),head=el("header","");
    head.append(el("h3","",label),el("span","folio-tally",tally));
    panel.append(head);
    return panel;
  }
  function line(label,detail){
    const row=el("div","folio-line");
    row.append(el("strong","",label),el("span","",detail));
    return row;
  }
  let state=null,apply=null,page="stats";
  const statsTab=document.getElementById("folio-stats-tab"),bagTab=document.getElementById("folio-bag-tab");
  function render(s){
    const p=Tower.view(s).profile, body=document.getElementById("folio-body");
    if(!p)return;
    const statList=el("dl","folio-stats");
    statList.append(stat("气血",p.hp+" / "+p.maxHp),stat("剑伤",p.swordDamage),stat("格挡",p.block),stat("灵石",p.gold));
    // The field portrait keeps the face and shoulder in frame for every loadout.
    const portrait=document.getElementById("folio-figure");
    if(!portrait.dataset.painted){
      const hero=TowerSprites.get("hero-ready");
      if(hero?.naturalWidth){
        const ctx=portrait.getContext("2d");
        ctx.drawImage(hero,154,5,216,216,0,0,portrait.width,portrait.height);
        portrait.dataset.painted="true";
      }
    }
    document.querySelector(".folio-artist").textContent=p.weapon.name;
    document.getElementById("folio-location").textContent=(s.phase==="escort"?Tower.escortView(s).road:MarketPlay.place)||(s.foeKind==="ink-mite"?"侧廊 · 蠹巢":s.floor===2?"狐灯关":"照影廊");
    dialog.dataset.page=page;
    statsTab.setAttribute("aria-pressed",String(page==="stats"));bagTab.setAttribute("aria-pressed",String(page==="bag"));
    if(page==="bag"){BagSheet.mount(body,s,op=>{state=apply(op);return state});return}
    const gear=section("兵刃与饰物",p.accessory?"饰品已佩":"饰品空位");
    gear.append(line(p.weapon.name,p.weapon.effect));
    if(p.accessory){
      gear.append(line(p.accessory.name,p.accessory.effect));
      gear.append(line("血珀 "+p.bloodCharge+" / 2","下剑追加 "+p.bloodBonus+" 伤，本行已追加 "+p.bloodDamageTotal+" 伤、回 "+p.drainHealTotal+" 血。"));
    }
    if(p.relics.some(r=>r.id==="abacus")){
      const v=Tower.view(s),bonus=v.combat?.abacusBonus??v.market.abacusBonus;
      gear.append(line("算盘首击","当前加 "+bonus+" 伤，入战每持有 4 石添 1 伤，上限 2。"));
    }
    if(p.counter)gear.append(line("蓄势","下剑追加 "+p.counter+" 伤"));
    const relics=section("随身法宝",p.relics.length+" / "+p.relicLimit+" 格");
    for(const item of p.relics)relics.append(line(item.name,item.effect));
    for(let i=p.relics.length;i<p.relicLimit;i++)relics.append(line("空法宝位","可佩一件法宝"));
    if(p.relicLimit===1)relics.append(line("次位未开",s.trial.contract?"本行血契已定":"侧廊血客可扩栏"));
    const pack=section("行药与妖印",p.consumables.length+" / "+p.packLimit+" 药格");
    if(p.consumables.length)for(const item of p.consumables)pack.append(line(item.name,item.effect));
    else pack.append(line("药格空置","狐商处可购行药"));
    pack.append(line("妖印",p.seals.length?p.seals.join("、"):"无"));
    if(p.gritBought)pack.append(line("砺锋砂",p.gritActive?"狐关本战剑伤已计入":s.trial.gateTurns||s.phase==="won"?"已经用尽":"入狐关时剑伤加四"));
    pack.append(line("狐灯商号",MarketOrder.hasGuildSeal()?"已入客籍 · 绯绡记得你的旺市交货。":"初来行商 · 旺市亲售封蜡绢并结账，可入客籍。"));
    if(p.order)pack.append(line("下行寄单",p.order.name));
    body.replaceChildren(statList,gear,relics,pack);
  }
  function select(next){
    page=next;render(state);
  }
  statsTab.onclick=()=>select("stats");bagTab.onclick=()=>select("bag");
  function open(s,onChange){
    if(dialog.open)return;
    state=s;apply=onChange;select(Tower.view(s).profile.bag.pending.length?"bag":"stats");
    trigger.setAttribute("aria-expanded","true");
    dialog.showModal();dialog.scrollTop=0;
    document.getElementById("folio-close").focus({preventScroll:true});
  }
  function close(){if(dialog.open)dialog.close()}
  document.getElementById("folio-close").addEventListener("click",close);
  dialog.addEventListener("close",()=>{trigger.setAttribute("aria-expanded","false");trigger.focus({preventScroll:true});window.dispatchEvent(new Event("tower:repaint"))});
  return {open,close,showBag:()=>select("bag"),get active(){return dialog.open}};
})();