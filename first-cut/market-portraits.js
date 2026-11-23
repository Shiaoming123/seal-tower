/* Native-pixel registration of the guide and the player's divination-slip hit area. */
window.MarketPortraits=(()=>{
  function guide(c,t=0){
    const img=window.TowerSprites?.get("guide-oracle");
    if(!img)return null;
    const x=382,y=48+Math.sin(t*1.25)*1.25,scale=.93;
    c.save();c.imageSmoothingEnabled=false;
    c.drawImage(img,x,y,724*scale,543*scale);c.restore();
    // Click the divination slip itself, above the index finger that is holding it.
    return {x:x+58*scale,y:y+239*scale,rx:39,ry:47,hand:{x:x+66*scale,y:y+284*scale}};
  }
  return {guide};
})();
