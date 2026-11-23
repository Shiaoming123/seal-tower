/* A paid market order is a one-use voucher. Only its type and receipt are kept. */
window.MarketOrder=(()=>{
  const key="seal-tower.market-order.v1:"+location.pathname;
  let owned=null,memoryOnly=null;
  function read(){if(memoryOnly)return memoryOnly;try{return JSON.parse(localStorage.getItem(key))}catch{return null}}
  function remove(){try{localStorage.removeItem(key)}catch{}memoryOnly=null}
  function issue(order){
    const record={id:crypto.randomUUID?.()||String(Date.now())+"-"+Math.random(),order};
    owned=record.id;
    try{localStorage.setItem(key,JSON.stringify(record))}catch{memoryOnly=record}
  }
  function cancel(){
    if(owned&&read()?.id===owned)remove();
    owned=null;
  }
  async function claim(onSite=false){
    const work=()=>{
      const record=read();
      if(!record||(onSite&&record.id!==owned))return "";
      remove();owned=null;
      return record.order==="order-purse"||record.order==="order-hook"||record.order==="order-ash"?record.order:"";
    };
    if(navigator.locks){try{return await navigator.locks.request(key,work)}catch{}}
    return work();
  }
  // The guild remembers only its seal. Cash, health and cargo belong to the active run.
  const guildKey="seal-tower.guild.v1:"+location.pathname;
  let guildSeal=false;
  function hasGuildSeal(){
    if(guildSeal)return true;
    try{return localStorage.getItem(guildKey)==="fox-market"}catch{return false}
  }
  function recordSettlement(state){
    if(state.phase!=="won" || !state.trial || !Tower.view(state).market.hot || state.trial.silkSold<1)return;
    guildSeal=true;
    try{localStorage.setItem(guildKey,"fox-market")}catch{}
  }
  return {issue,cancel,claim,hasGuildSeal,recordSettlement};
})();