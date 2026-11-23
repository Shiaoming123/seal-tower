/* Fit the actual alpha sprite into its physical pose, then turn the entire occupied cluster. */
window.BagArt=(()=>{
  "use strict";
  function draw(canvas,item) {
    const p=Tower.bagLayout[item.id],source=p && TowerSprites.get(p.sprite);
    if (!source) throw new Error("行囊素材未登记或未载入："+item.id);
    const w=p.rows[0].length,h=p.rows.length,q=((item.rotation??0)%4+4)%4;
    const col=q%2?h:w,row=q%2?w:h;
    const ctx=canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.scale(canvas.width/col,canvas.height/row);
    if (q===1) ctx.translate(h,0);
    if (q===2) ctx.translate(w,h);
    if (q===3) ctx.translate(0,w);
    ctx.rotate(q*Math.PI/2);
    ctx.translate(p.cx,p.cy);
    ctx.rotate(p.degrees*Math.PI/180);
    const pixel=p.span/Math.max(source.naturalWidth,source.naturalHeight);
    ctx.scale(pixel,pixel);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.drawImage(source,-source.naturalWidth/2,-source.naturalHeight/2);
    ctx.restore();
  }
  return {draw};
})();
