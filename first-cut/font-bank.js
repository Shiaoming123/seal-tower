/* These WOFF2 files and their three OFL notices ship with the game. */
window.TowerFonts=(()=>{
  const sources=/* font sources */ {
    "Tower Brush":"type/tower-brush.woff2",
    "Tower Script":"type/tower-script.woff2",
    "Tower Ledger":"type/tower-ledger.woff2"
  } /* end font sources */;
  const ready=Promise.all(Object.entries(sources).map(async ([name,url])=>{
    const face=new FontFace(name,'url("'+url+'") format("woff2")');
    await face.load();document.fonts.add(face);
  }));
  ready.catch(()=>{});
  return {ready};
})();
