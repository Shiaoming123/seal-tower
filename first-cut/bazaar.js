/* Counter stock and side rooms share the same 960×540 projected stage as the fox market. */
window.Bazaar=(()=>{
  "use strict";
  const paths=new Map();
  function paint(c,d,fill,stroke,width=1){
    let path=paths.get(d);if(!path){path=new Path2D(d);paths.set(d,path)}
    if(fill){c.fillStyle=fill;c.fill(path)}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke(path)}
  }
  function ellipse(c,x,y,rx,ry,fill,stroke,w=1){
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke()}
  }
  function grad(c,x,y,xx,yy,...colors){const g=c.createLinearGradient(x,y,xx,yy);colors.forEach((col,i)=>g.addColorStop(i/(colors.length-1),col));return g}
  function ray(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,"transparent");c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r)}
  function stoneSign(c,x,y,word,scale,angle){
    const im=TowerSprites.get(word==="血棘"?"stele-thorn":"stele-ink");
    if(!im)return;
    const height=119,width=height*im.width/im.height;
    c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(angle);
    ellipse(c,2,1,width*.51,6,"#13191d8c");
    c.drawImage(im,-width/2,-height,width,height);
    for(let i=0;i<word.length;i++){
      const color=word==="血棘"?"#5a2f25":"#263e43";
      const run=CutInk.textRun(word[i],23,color,true,"title");
      CutInk.textAtCenterY(c,word[i],-run.inkWidth/2,-height*.66+i*27,23,color,true,"title");
    }
    c.restore();
  }
  function thorn(c,x,y,t,coins){
    c.save();c.translate(x,y);
    paint(c,"M-119 44 Q-93 34 -79 40 Q-62 46 -37 48 M-114 43 Q-78 36 -58 35",null,"#24282a83",4);
    paint(c,"M-124 42 Q-84 22 -60 11 Q-13 -23 23 -37 Q78 -53 113 -88 M-61 12 Q-54 -24 -78 -49 M24 -38 Q28 -68 20 -81",null,"#271f29",7);
    paint(c,"M-124 40 Q-75 18 -53 3 Q-12 -25 24 -39 Q78 -55 112 -89 M-59 9 Q-58 -25 -78 -48 M24 -39 Q30 -67 20 -81",null,"#815147",3);
    paint(c,"M-79 19 Q-83 -3 -98 -5 M-29 -10 Q-15 -26 -21 -48 M60 -56 Q74 -60 84 -47 M99 -77 Q101 -93 96 -101",null,"#635048",2);
    for(let k=0;k<12;k++){
      const xx=-98+k*16,yy=27-k*8+Math.sin(k*.8)*2;
      c.save();c.translate(xx,yy);c.rotate(k%2?-.15:2.1);paint(c,"M-5 2 Q2 -9 0 -23 Q10 -12 7 -3Z","#665047","#3b3032",1);paint(c,"M1 -19 L5 -8",null,"#b2876a",1);c.restore();
    }
    const hanging=coins===3?[[-57,-3,12],[3,-27,15],[55,-56,12]]:[[-42,-9,14],[41,-45,14]];
    for(const [cx,cy,sz] of hanging){
      c.save();c.translate(cx,cy);c.rotate(.09*Math.sin(t*1.1+cx));
      paint(c,"M-2 0 L-3 16 L2 18 L1 2",null,"#a55d48",1.8);
      ellipse(c,1,27,sz,sz,"#605b43","#2e3e37",1.2);ellipse(c,0,25,sz,sz,"#b39d62","#695b41",1.2);
      ellipse(c,0,25,sz-3,sz-3,null,"#dfc389",.9);
      paint(c,"M-3 22 L3 22 L3 28 L-3 28Z","#393b32","#806e48",1);
      paint(c,"M-7 24 L-6 21 M5 20 L8 23 M-7 28 L-6 31 M4 30 L7 29",null,"#735f42",1.1);c.restore();
    }c.restore();
  }
  function sideRoom(c,kind,t,look,coins){
    const im=TowerSprites.get("gate");if(im)c.drawImage(im,-17-look*3,-9,992,558);else{c.fillStyle="#243232";c.fillRect(0,0,960,540)}
    c.fillStyle=grad(c,0,0,960,380,"#1e222a99","#25363660","#1c2731bc");c.fillRect(0,0,960,540);
    c.fillStyle=grad(c,0,430,0,540,"#16212500","#1a242c88");c.fillRect(0,430,960,110);
    if(kind!=="blood"){
      if(kind==="wound")thorn(c,676-look*11,398,t,coins);
      stoneSign(c,556-look*11,438,"血棘",1.07,-.045);
      stoneSign(c,793-look*9,388,"墨巢",.78,.045);
    }
    for(let i=0;i<15;i++){
      const x=398+(i*87+Math.sin(t*.6+i)*9)%535,y=(i*33-t*9+544)%520;
      c.fillStyle=i%3?"#c8c6a944":"#e5b96d80";c.fillRect(x,y,2,2);
    }
  }
  function blood(c,t,look){
    const im=TowerSprites.get("blood-broker");
    if(!im)return;
    const k=Math.min(614/im.naturalWidth,527/im.naturalHeight);
    const w=im.naturalWidth*k,h=im.naturalHeight*k,cx=665-look*10;
    const rise=Math.sin(t*1.6)*1.1;
    ray(c,cx-108,423,156,"#b267382d");
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";
    c.drawImage(im,cx-w/2,547-h+rise,w,h);c.restore();
  }
  function draw(c,{scene,t,look,coins}){
    sideRoom(c,scene,t,look,coins);
    if(scene==="blood")blood(c,t,look);
  }
  return {draw};
})();
