/* Small pixel alphabets and a cached, single-colour text raster for the game's HUD. */
window.CutInk = (() => {
  const cache = new Map();
  const glyphs = {
    "0":["01110","11011","11011","11011","11011","11011","01110"],
    "1":["00100","01100","00100","00100","00100","00100","01110"],
    "2":["01110","11011","00011","00110","01100","11000","11111"],
    "3":["11110","00011","00011","01110","00011","00011","11110"],
    "4":["00011","00111","01111","11011","11111","00011","00011"],
    "5":["11111","11000","11000","11110","00011","00011","11110"],
    "6":["01110","11000","11000","11110","11011","11011","01110"],
    "7":["11111","00011","00110","01100","01100","01100","01100"],
    "8":["01110","11011","11011","01110","11011","11011","01110"],
    "9":["01110","11011","11011","01111","00011","00011","01110"],
    "−":["00000","00000","00000","11111","00000","00000","00000"],
    "/":["00001","00001","00010","00100","01000","10000","10000"]
  };
  function digits(ctx,str,x,y,size,color){
    ctx.fillStyle=color; x=Math.round(x); y=Math.round(y);
    for (const ch of String(str)){
      const rows=glyphs[ch]; if(!rows)continue;
      rows.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==="1")ctx.fillRect(x+i*size,y+j*size,size,size)});
      x+=6*size;
    }
  }
  const script='"Tower Script","KaiTi","STKaiti",serif';
  const faces={
    title:'"Tower Brush",'+script,
    speech:script,
    price:'"Tower Ledger","Tower Script","Microsoft YaHei",sans-serif',
    label:script
  };
  const metrics=new Map();
  window.TowerFonts?.ready.then(()=>{cache.clear();metrics.clear()},()=>{});
  function textRun(value,size,color,bold,role){
    value=String(value);
    role=role||(size>=22?"title":size<=12?"price":bold?"label":"speech");
    const key=[value,size,color,role].join("|");
    if(cache.has(key))return cache.get(key);
    const k=3,font=size*k+"px "+(faces[role]||faces.label);
    const img=document.createElement("canvas"),pen=img.getContext("2d");
    pen.font=font;
    const m=pen.measureText(value);
    img.height=Math.ceil(size*1.4+2)*k;
    let baseline=metrics.get(font);
    if(baseline===undefined){
      const sample=pen.measureText("照影廊");
      baseline=Math.round((img.height+sample.actualBoundingBoxAscent-sample.actualBoundingBoxDescent)/2);
      metrics.set(font,baseline);
    }
    const start=Math.ceil(Math.max(k,m.actualBoundingBoxLeft));
    img.width=start+Math.ceil(Math.max(m.width,m.actualBoundingBoxRight))+k;
    pen.font=font;pen.fillStyle=color;pen.textBaseline="alphabetic";pen.fillText(value,start,baseline);
    const run={img,w:img.width/k,h:img.height/k,left:(start-m.actualBoundingBoxLeft)/k,
      centerY:(baseline+(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/2)/k,
      inkWidth:(m.actualBoundingBoxLeft+m.actualBoundingBoxRight)/k};
    cache.set(key,run);return run;
  }
  function paintRun(ctx,run,x,y){
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
    ctx.drawImage(run.img,x,y,run.w,run.h);ctx.restore();
  }
  function text(ctx,value,x,y,size,color,bold=false,role){
    const run=textRun(value,size,color,bold,role);
    paintRun(ctx,run,Math.round(x),Math.round(y));return run.w;
  }
  // Align actual ink, including the different side bearings of brush and ledger type.
  function textAtCenterY(ctx,value,left,center,size,color,bold=false,role){
    const run=textRun(value,size,color,bold,role);
    paintRun(ctx,run,left-run.left,center-run.centerY);return run.inkWidth;
  }
  function poly(c,coords,color){
    c.fillStyle=color;c.beginPath();
    coords.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));
    c.closePath();c.fill();
  }
  function line(c,x,y,xx,yy,col,thick=1) {
    x=Math.round(x);y=Math.round(y);xx=Math.round(xx);yy=Math.round(yy);
    const dx=Math.abs(xx-x),dy=-Math.abs(yy-y),sx=x<xx?1:-1,sy=y<yy?1:-1;
    let err=dx+dy;c.fillStyle=col;
    for(;;){c.fillRect(x,y,thick,thick);if(x===xx&&y===yy)break;const e=2*err;if(e>=dy){err+=dy;x+=sx}if(e<=dx){err+=dx;y+=sy}}
  }
  function diamond(c,x,y,r,color){
    for(let i=-r;i<=r;i++){const span=r-Math.abs(i);c.fillStyle=color;c.fillRect(Math.round(x)-span,Math.round(y)+i,span*2+1,1)}
  }
  return {digits,text,textAtCenterY,textRun,poly,line,diamond};
})();
