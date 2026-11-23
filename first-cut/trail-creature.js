/* 墨蠹. Native artwork is posed in strips; its visible alpha supplies the pick mask. */
window.TrailCreature=(()=>{
  "use strict";
  const W=910,H=333,PAD=34;
  // Landmarks on the trimmed transparent drawing, in source pixels.
  const cheek={x:169,y:219},jaw={x:53,y:275},floorY=283;
  const frames=new Map(),tau=2*Math.PI;
  let picked=null;
  function smooth(a,b,x){const u=Math.min(1,Math.max(0,(x-a)/(b-a)));return u*u*(3-2*u)}
  function stance(right,zoom){
    const scale=309/W;
    const x=Math.min(378,right-(W-cheek.x+8)*scale-18-4/zoom);
    return {x,y:floorY-(323-cheek.y)*scale,scale,low:true};
  }
  function reach(scale,angle){
    const x=(jaw.x-cheek.x)*scale,y=(jaw.y-cheek.y)*scale,c=Math.cos(angle),s=Math.sin(angle);
    return {x:x*c-y*s,y:x*s+y*c};
  }
  function pose(s){
    if(s.reduced)return s.recoil>.22?18:s.striking>.12?24:0;
    if(s.recoil>.05)return 16+Math.min(4,Math.round(s.recoil*4));
    if(s.striking>.04)return 21+Math.min(6,Math.round(s.striking*6));
    return Math.floor(s.t*9)%16;
  }
  function frame(id){
    if(frames.has(id))return frames.get(id);
    const img=TowerSprites.get("book-louse");
    if(!img)return null;
    const cv=document.createElement("canvas");cv.width=W+PAD*2;cv.height=H+PAD*2;
    const g=cv.getContext("2d",{willReadFrequently:true});g.imageSmoothingEnabled=false;
    const phase=id<16?id*tau/16:id>=21?1.4+(id-21)*.48:.55;
    const recoil=id>=16&&id<=20?(id-16)/4:0,bite=id>=21?(id-21)/6:0;
    const breath=Math.sin(phase);
    function xAt(x){
      const u=x/W,wave=smooth(.19,.63,u);
      return PAD+x+wave*(3.8*Math.sin(phase-.8-u*4)-26*recoil-19*bite);
    }
    function yAt(x,y){
      const u=x/W,v=y/H,spine=smooth(.21,.47,u),tail=smooth(.56,.96,u);
      // The rigid cheek and feeding mandibles do not drift off their contact points.
      // The long abdomen coils before the head springs, and its three tail filaments
      // travel at different phases according to their height above the tail root.
      const arch=Math.sin(Math.PI*smooth(.19,.80,u));
      const roll=spine*(4.2*Math.sin(phase-u*8)-11*recoil*arch+14*bite*arch);
      const flick=tail*(10+8*tail)*Math.sin(phase*1.5-u*7+v*9)*(1+.35*bite);
      const toe=smooth(.77,.96,v)*(1-smooth(.34,.46,u))*smooth(.10,.14,u);
      const gait=toe*(-8*Math.max(0,Math.sin(phase*2+u*59))-11*bite);
      const whisker=(1-smooth(.34,.51,v))*(1-smooth(.27,.39,u));
      return PAD+y+roll+flick+gait+whisker*(4.5*breath-6*recoil);
    }
    for(let x=0;x<W;x+=12){
      const end=Math.min(x+12,W),dx=Math.round(xAt(x)),wide=Math.round(xAt(end))-dx;
      const cx=(x+end)/2;
      for(let y=0;y<H;y+=24){
        const bottom=Math.min(y+24,H),dy=Math.round(yAt(cx,y)),dh=Math.round(yAt(cx,bottom))-dy;
        g.drawImage(img,x,y,end-x,bottom-y,dx,dy,wide,dh);
      }
    }
    const {data}=g.getImageData(0,0,cv.width,cv.height),mask=new Uint8Array(Math.ceil(cv.width*cv.height/8));
    let left=cv.width,top=cv.height,right=0,bottom=0;
    for(let y=0,i=0;y<cv.height;y++)for(let x=0;x<cv.width;x++,i++){
      if(data[i*4+3]<48)continue;
      mask[i>>3]|=1<<(i&7);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    const f={cv,mask,left,right,top,bottom};
    frames.set(id,f);return f;
  }
  function draw(c,s){
    const f=frame(pose(s));picked=null;if(!f)return null;
    const scale=s.louseScale,angle=s.pitch||0,cos=Math.cos(angle),sin=Math.sin(angle);
    const ox=PAD+cheek.x,oy=PAD+cheek.y;
    c.save();c.translate(s.x,s.y);c.rotate(angle);c.scale(scale,scale);
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality="low";
    c.drawImage(f.cv,-ox,-oy);
    // One warm edge stays on the scale itself, preserving the spot at phone size.
    c.strokeStyle="#ec8968";c.lineWidth=3;c.beginPath();c.moveTo(-9,9);c.lineTo(-2,5);c.lineTo(3,-3);c.stroke();
    c.restore();
    if(c.globalAlpha>=.18)picked={f,x:s.x,y:s.y,scale,cos,sin,ox,oy};
    const midX=((f.right+f.left+1)*.5-ox)*scale,midY=((f.bottom+f.top+1)*.5-oy)*scale;
    const rx=(f.right-f.left+1)*scale*.5,ry=(f.bottom-f.top+1)*scale*.5;
    return {x:s.x+midX*cos-midY*sin,y:s.y+midX*sin+midY*cos,rx:rx*Math.abs(cos)+ry*Math.abs(sin),ry:rx*Math.abs(sin)+ry*Math.abs(cos)};
  }
  function hit(x,y){
    if(!picked)return false;
    const k=picked,dx=x-k.x,dy=y-k.y;
    const sx=Math.floor((dx*k.cos+dy*k.sin)/k.scale+k.ox),sy=Math.floor((-dx*k.sin+dy*k.cos)/k.scale+k.oy);
    if(sx<0||sy<0||sx>=k.f.cv.width||sy>=k.f.cv.height)return false;
    const bit=sy*k.f.cv.width+sx;return !!(k.f.mask[bit>>3]&(1<<(bit&7)));
  }
  function leaf(c,goal){
    const x=Math.round(goal.x-39),y=floorY-2;
    c.save();c.translate(x,y);c.fillStyle="#172428b0";c.beginPath();c.ellipse(-1,2,23,3,0,0,Math.PI*2);c.fill();
    const page=[[-24,1],[-13,-3],[17,-4],[13,-2],[18,-1],[12,0],[16,1],[5,2],[-9,3]];
    c.fillStyle="#baac82";c.beginPath();for(const [px,py] of page)c.lineTo(px,py);c.closePath();c.fill();
    c.fillStyle="#7a765f";for(let i=0;i<7;i++)c.fillRect(-12+i*3,-1-i%2,2,1);
    c.fillStyle="#e0d6ad";c.fillRect(-9,2,11,1);c.fillRect(13,-2,4,1);c.restore();
  }
  return {stance,reach,draw,hit,leaf};
})();
