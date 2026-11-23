/* The seal and both interaction methods use the actual projected scale pan. */
window.WeighGesture=(()=>{
  const game=document.getElementById("game"),grip=document.getElementById("seal-grip"),art=document.getElementById("market-art"),scaleButton=document.getElementById("object");
  let pan=null,home=null,drag=null,returning=null,manualPhase="";
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const repaint=()=>window.dispatchEvent(new Event("tower:repaint"));
  const active=()=>game.dataset.phase==="stall"||(game.dataset.phase==="finalStall"&&+game.dataset.seals>0);
  const point=e=>{const r=art.getBoundingClientRect();return {x:(e.clientX-r.left)*960/r.width,y:(e.clientY-r.top)*540/r.height}};
  const overPan=(dx,dy)=>(dx/34)**2+((dy-4)/12)**2<=1;
  const near=p=>pan&&overPan(p.x-pan.x,p.y-pan.y);
  const overSeal=p=>home&&NightMarket.sealHit(p.x-home.x,p.y-home.y,.63,-.24);
  const sameView=()=>drag&&drag.phase===game.dataset.phase&&drag.width===game.clientWidth&&drag.height===game.clientHeight;
  function clear(){
    grip.hidden=true;drag=null;returning=null;pan=null;home=null;
    if(game.dataset.phase!==manualPhase)manualPhase="";
  }
  new MutationObserver(()=>{if(!active())clear();else manualPhase=""}).observe(game,{attributes:true,attributeFilter:["data-phase"]});
  function commit(manual){
    if(!active()||scaleButton.disabled)return;
    if(manual)manualPhase=game.dataset.phase==="stall"?"quote":"finalQuote";
    scaleButton.click();repaint();
  }
  grip.addEventListener("pointerdown",e=>{
    if(!e.isPrimary||e.button!==0||!active()||scaleButton.disabled||!pan)return;
    const start=point(e);
    if(!overSeal(start)||document.elementFromPoint(e.clientX,e.clientY)!==grip){e.preventDefault();return}
    returning=null;drag={id:e.pointerId,start,point:start,moved:false,
      phase:game.dataset.phase,width:game.clientWidth,height:game.clientHeight};
    grip.setPointerCapture(e.pointerId);repaint();e.preventDefault();
  });
  grip.addEventListener("pointermove",e=>{
    if(drag?.id!==e.pointerId)return;
    drag.point=point(e);
    if(Math.hypot(drag.point.x-drag.start.x,drag.point.y-drag.start.y)>7)drag.moved=true;
    repaint();
  });
  function putBack(p){
    if(!reduced.matches&&home)returning={from:p,start:performance.now()};
    repaint();
  }
  grip.addEventListener("pointerup",e=>{
    if(drag?.id!==e.pointerId)return;
    const dropped=point(e),moved=drag.moved||Math.hypot(dropped.x-drag.start.x,dropped.y-drag.start.y)>7;
    const valid=sameView()&&document.elementFromPoint(e.clientX,e.clientY)===(moved?scaleButton:grip)&&
      (moved?near(dropped):overSeal(dropped));
    drag=null;
    if(valid)commit(moved);else putBack(dropped);
    e.preventDefault();
  });
  function cancel(e){if(drag?.id===e.pointerId){const from=drag.point;drag=null;putBack(from)}}
  grip.addEventListener("pointercancel",cancel);grip.addEventListener("lostpointercapture",cancel);
  grip.addEventListener("click",e=>{if(e.detail===0&&!e.pointerType)commit(false);else e.preventDefault()});
  function render(c,s,bounds,origin,drawSeal){
    pan=bounds;home=origin;
    const a=art.getBoundingClientRect(),g=game.getBoundingClientRect(),z=a.width/960;
    const w=Math.max(48,78*z),h=Math.max(48,75*z);
    Object.assign(grip.style,{left:(a.left-g.left+home.x*z-w/2)+"px",top:(a.top-g.top+home.y*z-h/2)+"px",width:w+"px",height:h+"px",cursor:drag?"grabbing":"grab"});
    grip.hidden=false;grip.disabled=scaleButton.disabled;
    let pos=home;
    if(drag?.moved){
      pos=drag.point;
      c.save();c.strokeStyle=near(pos)?"#ffdf8a":"#d6baa1";c.lineWidth=near(pos)?2:1;c.setLineDash([5,4]);
      c.beginPath();c.ellipse(pan.x,pan.y,36,11,0,0,Math.PI*2);c.stroke();c.restore();
    }else if(returning){
      const f=Math.min(1,(performance.now()-returning.start)/200),u=1-(1-f)**3;
      pos={x:returning.from.x+(home.x-returning.from.x)*u,y:returning.from.y+(home.y-returning.from.y)*u};
      if(f===1)returning=null;else requestAnimationFrame(repaint);
    }
    c.save();c.fillStyle="#0e141c80";c.beginPath();c.ellipse(home.x,home.y+12,25,5,0,0,Math.PI*2);c.fill();c.restore();
    drawSeal(c,pos.x,pos.y,drag?.moved ? .72 : .63,drag?.moved?-.08:-.24);
  }
  return {render,overPan,cancel:clear,get placed(){return manualPhase===game.dataset.phase&&!!manualPhase}};
})();
