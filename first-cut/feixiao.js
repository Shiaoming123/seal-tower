/* Each hand, handle and sleeve is drawn intact in its own authored key pose.
   Registration is measured in the 1448 × 1086 source drawings. */
window.FoxArt=(()=>{
  const WIDTH=1448,HEIGHT=1086,scale=.337;
  const poses={
    offer:{
      key:"fox-offer",eyelet:[149,620],
      sleeve:new Path2D("M0 385 H329 Q372 513 422 528 Q485 471 544 473 Q632 477 681 574 Q647 627 629 694 Q595 748 556 799 Q535 865 488 899 Q446 934 460 966 Q503 1028 470 1086 H0 Z")
    },
    fold:{
      key:"fox-fold",eyelet:[273,725],
      sleeve:new Path2D("M0 467 H329 Q371 534 426 512 Q491 469 545 474 Q619 475 671 572 Q630 634 617 692 Q584 760 537 833 Q510 896 460 937 Q452 973 489 990 L470 1086 H0 Z")
    },
    return:{
      key:"fox-return",eyelet:[459,775],
      sleeve:new Path2D("M0 505 H345 Q409 530 474 499 Q521 454 571 483 Q633 496 677 594 Q643 653 615 708 L579 763 Q554 832 528 887 Q519 960 485 1044 L463 1086 H0 Z")
    },
    settle:{
      key:"fox-settle",eyelet:[569,807],
      sleeve:new Path2D("M0 540 H340 Q403 552 469 510 Q501 468 568 500 Q620 513 667 575 Q655 646 653 685 L665 741 L663 804 Q627 824 597 854 Q573 939 544 995 L535 1086 H0 Z")
    }
  };
  const tailBands=[1032,1064,1096,1128,1160,1192,1224,1256,1288,1320,1352,1384,1416,1448];
  const atCounter=new Set(["whet","sharpened","receipt","bazaar"]);
  const counterPose={key:"fox-counter"};
  function eased(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)}
  function between(a,b,u){
    const pose=u<.5?a:b;
    const dx=a.eyelet[0]+u*(b.eyelet[0]-a.eyelet[0])-pose.eyelet[0];
    const dy=a.eyelet[1]+u*(b.eyelet[1]-a.eyelet[1])-pose.eyelet[1];
    return {pose,dx,dy};
  }
  function poseFor(mode,kind,deal,hasOriginal){
    if(atCounter.has(mode)||(mode==="finalStall"&&hasOriginal===false)){
      return {pose:counterPose,dx:0,dy:0};
    }
    if(kind==="sell"&&deal>=.6)return between(poses.return,poses.settle,eased((deal-.6)/.33));
    if(kind==="sell"||kind==="keep"){
      const u=eased((deal-.06)/.54);
      if(u<.43)return between(poses.offer,poses.fold,u/.43);
      return between(poses.fold,poses.return,(u-.43)/.57);
    }
    return {pose:mode==="failed"?poses.return:poses.offer,dx:0,dy:0};
  }
  function tailOffset(x,t,reduced){
    if(reduced)return 0;
    const weight=Math.max(0,(x-tailBands[0])/(WIDTH-tailBands[0]));
    return weight*weight*13*Math.sin(t*1.38-weight*1.42);
  }
  // The moving area ends below the painted hair and shoulder contour. A vertex
  // has a displacement weight, with full weight on the hand and its copper grip.
  const meshes={
    "fox-offer":[[346,220,325,0],[426,254,340,1],[543,257,350,1],[610,271,402,1],[677,315,538,1],[825,331,644,.93],[1012,322,626,.65],[1086,312,626,0]],
    "fox-fold":[[479,245,325,0],[548,294,410,1],[602,345,459,1],[665,361,522,1],[790,360,629,1],[970,340,603,.81],[1086,310,580,0]],
    "fox-return":[[557,344,456,0],[580,417,492,0],[625,495,589,1],[682,533,637,1],[782,550,686,1],[896,478,658,1],[1004,419,627,.69],[1086,399,621,0]],
    "fox-settle":[[569,350,459,0],[617,472,635,0],[670,608,716,1],[811,650,765,1],[910,547,718,.96],[1007,472,651,.68],[1086,432,641,0]]
  };
  const atlas=document.createElement("canvas"),warp=atlas.getContext("2d");
  let previousFrame=null,previousDX=0,previousDY=0;
  function triangle(a,b,c){
    const bx=b.x-a.x,by=b.y-a.y,cx=c.x-a.x,cy=c.y-a.y,det=bx*cy-cx*by;
    const gwx=((b.w-a.w)*cy-(c.w-a.w)*by)/det,gwy=(bx*(c.w-a.w)-cx*(b.w-a.w))/det;
    const origin=a.w-gwx*a.x-gwy*a.y,path=new Path2D(),points=[a,b,c];
    const mx=(a.x+b.x+c.x)/3,my=(a.y+b.y+c.y)/3;
    // A small coverage overlap avoids antialias gaps between adjoining blits.
    points.forEach((p,i)=>{
      const vx=p.x-mx,vy=p.y-my,length=Math.hypot(vx,vy)||1;
      const xx=p.x+vx*1.9/length,yy=p.y+vy*1.9/length;
      if(i)path.lineTo(xx,yy);else path.moveTo(xx,yy);
    });path.closePath();
    const x=Math.max(0,Math.min(a.x,b.x,c.x)-2),y=Math.max(0,Math.min(a.y,b.y,c.y)-2);
    return {gwx,gwy,origin,path,x,y,w:Math.min(WIDTH,Math.max(a.x,b.x,c.x)+2)-x,h:Math.min(HEIGHT,Math.max(a.y,b.y,c.y)+2)-y};
  }
  function prepareMesh(rows){
    const strips=rows.map(([y,near,far,w])=>[{x:0,y,w},{x:near,y,w},{x:far,y,w:0}]);
    const boundary=new Path2D();boundary.moveTo(0,rows[0][0]);
    for(const row of rows)boundary.lineTo(row[2],row[0]);
    boundary.lineTo(0,rows[rows.length-1][0]);boundary.closePath();
    const tiles=[];
    for(let j=1;j<strips.length;j++){
      const top=strips[j-1],bottom=strips[j];
      for(let i=0;i<2;i++){
        tiles.push(triangle(top[i],top[i+1],bottom[i]),triangle(bottom[i+1],bottom[i],top[i+1]));
      }
    }
    return {boundary,tiles};
  }
  for(const [name,rows] of Object.entries(meshes))meshes[name]=prepareMesh(rows);
  function posedImage(frame,pose,dx,dy){
    if(!dx&&!dy)return frame;
    if(previousFrame===frame&&previousDX===dx&&previousDY===dy)return atlas;
    previousFrame=frame;previousDX=dx;previousDY=dy;
    if(atlas.width!==frame.width||atlas.height!==frame.height){atlas.width=frame.width;atlas.height=frame.height}
    const r=frame.width/WIDTH,mesh=meshes[pose.key];
    warp.setTransform(1,0,0,1,0,0);warp.clearRect(0,0,atlas.width,atlas.height);warp.drawImage(frame,0,0);
    warp.setTransform(r,0,0,r,0,0);warp.save();warp.clip(mesh.boundary);warp.clearRect(0,0,WIDTH,HEIGHT);warp.restore();
    warp.imageSmoothingEnabled=false;
    for(const m of mesh.tiles){
      warp.save();warp.transform(1+dx*m.gwx,dy*m.gwx,dx*m.gwy,1+dy*m.gwy,dx*m.origin,dy*m.origin);
      warp.clip(m.path);
      warp.drawImage(frame,m.x*r,m.y*r,m.w*r,m.h*r,m.x,m.y,m.w,m.h);warp.restore();
    }
    return atlas;
  }

  function draw(c,{t=0,give=0,deal=0,kind="",mode="",hasOriginal,reduced=false,frontArmOnly=false}={}){
    const {pose,dx,dy}=poseFor(mode,kind,deal,hasOriginal);
    const frame=window.TowerSprites?.get(pose.key);
    if(!frame)return null;
    const reach=Math.max(0,Math.min(1,give));
    // The whole figure can lean forward. The scale eyelet travels with the same rigid transform.
    // The standing clerk steps back from the edge so her crossed hands are visible above the counter.
    const poseScale=pose===counterPose?scale*.82:scale;
    const x=371+(scale-poseScale)*725-4*reach,y=61+(reduced?0:Math.sin(t*1.27)*.82)-reach;
    const hand=pose.eyelet?{x:x+poseScale*(pose.eyelet[0]+dx),y:y+poseScale*(pose.eyelet[1]+dy)}:null;
    if(frontArmOnly&&!hand)return {hand,handle:null,pose:pose.key};
    const image=posedImage(frame,pose,dx,dy);
    c.save();c.translate(x,y);c.scale(poseScale,poseScale);c.imageSmoothingEnabled=false;
    if(frontArmOnly){
      // Only the counter can occlude this lower part of the sleeve.
      c.beginPath();c.rect(0,693,WIDTH,HEIGHT-693);c.clip();c.clip(pose.sleeve);
      c.drawImage(image,0,0,WIDTH,HEIGHT);
    }else{
      const factor=image.width/WIDTH,rigidEnd=tailBands[0];
      function drawStrip(left,width,destX){
        const hem=pose===counterPose?950:HEIGHT;
        c.drawImage(image,left*factor,0,width*factor,hem*factor,destX,0,width,hem);
        if(hem<HEIGHT){
          // Continue the painted hem and hanging hair down behind the lower corner of the table.
          c.drawImage(image,left*factor,hem*factor,width*factor,image.height-hem*factor,destX,hem-.5,width,HEIGHT-hem+102);
        }
      }
      drawStrip(0,rigidEnd+.45,0);
      for(let i=0;i<tailBands.length-1;i++){
        const a=tailBands[i],b=tailBands[i+1],w=b-a;
        const left=tailOffset(a,t,reduced),right=tailOffset(b,t,reduced);
        const cover=Math.min(w+.6,WIDTH-a);
        c.save();c.transform(1,(right-left)/w,0,1,a,left);
        drawStrip(a,cover,0);
        c.restore();
      }
    }

    c.restore();return {hand,handle:hand,pose:pose.key};
  }
  return {draw};
})();
