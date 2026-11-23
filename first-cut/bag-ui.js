/* The rule engine owns placements. A ghost position is a draft until a drop or 落位. */
window.BagSheet=(()=>{
  "use strict";
  const make=(tag,cls,text)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;if(text!==undefined)el.textContent=text;
    return el;
  };
  const art=id=>TowerSprites.get(id==="seal"?"lamp-seal":id==="grit"?"grit":"merch-"+id);
  function thumb(id){
    const sprite=art(id);
    const img=make("img","bag-thumb");
    img.alt="";if(sprite)img.src=sprite.src;return img;
  }
  const key=a=>a?.instanceId||a?.id;
  function mount(host,initial,commit){
    let s=initial,bag=Tower.view(s).profile.bag;
    let picked=key(bag.pending[0])||key(bag.items[0])||key(bag.equipped[0]),ghost=null,drag=null,swallow=false;
    const root=make("div","bag-work"),gridWrap=make("section","bag-tray"),shelf=make("section","bag-slot-list");
    root.dataset.rows=String(bag.height);
    const count=make("div","bag-tray-title"),board=make("div","bag-board");board.setAttribute("role","group");board.setAttribute("aria-label",bag.width+" 列 "+bag.height+" 行的行囊");
    const glyphs=make("div","bag-glyphs"),cells=[],tools=make("div","bag-actions"),detail=make("div","bag-detail");
    const notice=make("div","bag-notice");notice.setAttribute("role","status");
    board.style.aspectRatio=bag.width+" / "+bag.height;board.style.setProperty("--columns",bag.width);board.style.setProperty("--rows",bag.height);
    for(let y=0;y<bag.height;y++)for(let x=0;x<bag.width;x++){
      const cell=make("button","bag-cell");cell.type="button";cell.dataset.x=x;cell.dataset.y=y;board.append(cell);cells.push(cell);
    }
    board.append(glyphs);gridWrap.append(count,board);
    const pocket=make("div","bag-pocket");pocket.append(gridWrap,shelf);root.append(pocket,detail,tools,notice);host.replaceChildren(root);
    const item=()=>[...bag.items,...bag.equipped,...bag.pending].find(v=>key(v)===picked);
    const carried=id=>bag.items.find(v=>key(v)===id);
    const at=(x,y)=>bag.items.find(a=>a.cells.some(([dx,dy])=>x===a.x+dx&&y===a.y+dy));
    const coord=(x,y)=>"甲乙丙丁"[x]+(y+1);
    function opForDraft(){return {action:"move",id:item()?.id,instanceId:picked,...ghost}}
    const legal=op=>Tower.canArrange(s,{...op,id:item()?.id,instanceId:picked});
    function perform(op,actionText){
      op={...op,id:item()?.id,instanceId:picked};
      if(!legal(op)){notice.textContent="位置或栏位不合，原物仍在。";return false}
      const next=commit(op);if(next===s)return false;
      s=next;bag=Tower.view(s).profile.bag;ghost=null;
      if(!item())picked=key(bag.pending[0])||key(bag.items[0])||key(bag.equipped[0]);
      render();notice.textContent=actionText;return true;
    }
    function button(text,code,handler,disabled=false){
      const b=make("button","bag-tool",text);b.type="button";b.dataset.bagAction=code;b.disabled=disabled;b.onclick=handler;return b;
    }
    function choose(id){picked=id;ghost=null;notice.textContent="";render()}
    function begin(rot=0){
      const a=carried(picked);if(!a)return;ghost={x:a.x,y:a.y,rotation:(a.rotation+rot)%4};render();
      notice.textContent="点格选位置，落位后生效。";
    }
    function ground(){
      const a=carried(picked),proposed=ghost&&a?Tower.footprint(a.id,ghost.rotation):[];
      const valid=ghost&&legal(opForDraft());
      const equal=ghost&&a&&a.x===ghost.x&&a.y===ghost.y&&a.rotation===ghost.rotation;
      for(const b of cells){
        const x=Number(b.dataset.x),y=Number(b.dataset.y),occupant=at(x,y);
        b.dataset.instance=key(occupant)||"";b.dataset.kind=occupant?.type||"";b.dataset.owner=occupant?.id||"";
        b.classList.toggle("is-chosen",Boolean(occupant)&&key(occupant)===picked);
        const drawn=ghost&&proposed.some(([dx,dy])=>ghost.x+dx===x&&ghost.y+dy===y);
        b.dataset.ghost=drawn?(valid||equal?"ok":"bad"):"";
        b.setAttribute("aria-label",coord(x,y)+" "+(occupant?.name||"空格")+(drawn?(valid?" 可落位":equal?" 原位":" 不可落位"):""));
      }
      const original=[...glyphs.children].find(n=>n.dataset.instance===picked);
      if(original)original.style.opacity=ghost?".24":"1";
      let draft=glyphs.querySelector(".bag-draft");
      if(ghost&&a){
        if(!draft||draft.dataset.rotation!==String(ghost.rotation)||draft.dataset.instance!==picked){
          draft?.remove();
          draft=imageOnBoard({...a,...ghost,cells:proposed});
          draft.classList.add("bag-draft");draft.dataset.rotation=String(ghost.rotation);glyphs.append(draft);
        }
        draft.style.left=100*ghost.x/bag.width+"%";draft.style.top=100*ghost.y/bag.height+"%";
        draft.style.opacity=valid||equal?".95":".53";
      }else draft?.remove();
      const drop=tools.querySelector('[data-bag-action="place"]');
      if(drop)drop.disabled=!valid;
    }
    function imageOnBoard(a){
      // Each cell stays visibly occupied; the cutout is displayed once across its cluster.
      const shape=a.cells,sw=1+Math.max(...shape.map(v=>v[0])),sh=1+Math.max(...shape.map(v=>v[1]));
      const cv=make("canvas","bag-icon");cv.dataset.piece=a.id;cv.dataset.instance=key(a);cv.width=sw*96;cv.height=sh*96;
      Object.assign(cv.style,{left:100*a.x/bag.width+"%",top:100*a.y/bag.height+"%",width:100*sw/bag.width+"%",height:100*sh/bag.height+"%"});
      BagArt.draw(cv,a);
      if(a.maxStack>1){
        const [x,y]=a.cells.at(-1),ctx=cv.getContext("2d"),tx=(x+1)*96-33,ty=(y+1)*96-28;
        ctx.fillStyle="#273d36";ctx.fillRect(tx,ty,31,25);ctx.strokeStyle="#ddbc83";ctx.strokeRect(tx+.5,ty+.5,30,24);
        ctx.fillStyle="#ffe8af";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.font='bold 20px "Tower Ledger", sans-serif';ctx.fillText("×"+a.qty,tx+15,ty+13);
      }
      return cv;
    }
    function group(title,arr){
      if(!arr.length)return;
      shelf.append(make("h3","bag-subhead",title));
      const list=make("div","bag-picks");
      for(const a of arr){
        const b=make("button","bag-pick");b.type="button";b.dataset.piece=a.id;b.dataset.instance=key(a);b.setAttribute("aria-pressed",String(key(a)===picked));
        b.append(thumb(a.id),make("span","",a.name+(a.qty>1?" ×"+a.qty:"")));b.onclick=()=>choose(key(a));list.append(b);
      }shelf.append(list);
    }
    function render(){
      const a=item(),onBoard=carried(picked),active=bag.equipped.some(v=>key(v)===picked),waiting=bag.pending.some(v=>key(v)===picked);
      const used=bag.items.reduce((sum,v)=>sum+v.cells.length,0);
      count.replaceChildren(make("h3","bag-subhead","囊底"),make("span","",used+" / "+bag.width*bag.height+" 格"));
      glyphs.replaceChildren(...bag.items.map(imageOnBoard));shelf.replaceChildren();
      group("待收战利",bag.pending);group("身上佩戴",bag.equipped);
      detail.replaceChildren();tools.replaceChildren();
      if(a){
        const desc=make("div","bag-description"),title=make("h3","",a.name);
        desc.append(title,make("span","bag-meta",a.type+" · "+(waiting?"待入囊":active?a.slot:"囊中")+" · "+a.shape.length+" 格"+(a.maxStack>1?" · "+a.qty+"/"+a.maxStack+" 份":"")));
        detail.append(thumb(a.id),desc,make("p","",a.effect));
        if(ghost){
          tools.append(button("旋转","rotate",()=>{ghost.rotation=(ghost.rotation+1)%4;ground();notice.textContent="已转向，选格后落位。"}),
            button("落位","place",()=>perform(opForDraft(),a.name+"已落位。")),button("取消","cancel",()=>choose(key(a))));
        }else if(bag.editable){
          if(onBoard){
            tools.append(button("移位","move",()=>begin()),button("旋转","rotate",()=>begin(1)));
            if(bag.pending.length&&legal({action:"set-aside"}))tools.append(button("暂搁地上","set-aside",()=>perform({action:"set-aside"},"已暂搁，可重新收入。")));
            if(a.qty>1)tools.append(button("拆出一份","split",()=>perform({action:"split",qty:1},"已另放一叠。"),!legal({action:"split",qty:1})));
            if(["法宝栏","主手","饰品栏","药囊"].includes(a.slot))tools.append(button("装配","equip",()=>perform({action:"equip",id:a.id},"已装配"+a.name),!legal({action:"equip",id:a.id})));
          }else if(active&&a.slot!=="主手")tools.append(button("卸入囊中","stow",()=>perform({action:"stow",id:a.id},"已卸下"+a.name),!legal({action:"stow",id:a.id})));
          else if(waiting){
            tools.append(button("收入行囊","collect",()=>perform({action:"collect",id:a.id},"已收下"+a.name),!legal({action:"collect",id:a.id})));
            tools.append(button("放弃此物","discard",()=>{tools.replaceChildren(button("确认放弃","confirm-discard",()=>perform({action:"discard",id:a.id},"已放弃"+a.name)),button("取消","cancel",()=>choose(key(a))));notice.textContent="留下的战利无法取回。"}));
          }
        }
      }
      if(!bag.editable)notice.textContent="此刻只可翻看行装。";
      else if(waiting&&!legal({action:"collect",id:a.id}))notice.textContent="囊内无法放下。可移动物件、装配或放弃战利。";
      ground();
    }
    board.addEventListener("click",e=>{
      if(swallow){swallow=false;return}
      const b=e.target.closest(".bag-cell");if(!b)return;
      const x=+b.dataset.x,y=+b.dataset.y;
      if(ghost){ghost.x=x;ghost.y=y;ground();notice.textContent=legal(opForDraft())?"可落位。":"此处放不下，换一格或转向。";return}
      const a=at(x,y);if(a)choose(key(a));
    });
    board.addEventListener("pointerdown",e=>{
      const b=e.target.closest(".bag-cell");swallow=false;
      if(!b||!e.isPrimary||e.button!==0||!bag.editable||ghost)return;
      const x=+b.dataset.x,y=+b.dataset.y,a=at(x,y);if(!a)return;
      drag={id:e.pointerId,a,x:e.clientX,y:e.clientY,dx:x-a.x,dy:y-a.y,started:false};
    });
    function locate(e){
      const r=board.getBoundingClientRect(),col=Math.floor((e.clientX-r.left)*bag.width/r.width),row=Math.floor((e.clientY-r.top)*bag.height/r.height);
      return {x:col-drag.dx,y:row-drag.dy,rotation:drag.a.rotation};
    }
    board.addEventListener("pointermove",e=>{
      if(!drag||drag.id!==e.pointerId)return;
      if(!e.buttons){drag=null;return}
      if(!drag.started){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;drag.started=true;picked=key(drag.a);board.setPointerCapture(e.pointerId)}
      ghost=locate(e);ground();
    });
    board.addEventListener("pointerup",e=>{
      if(!drag||drag.id!==e.pointerId)return;
      if(drag.started){
        ghost=locate(e);swallow=true;const ok=perform(opForDraft(),"已移动。");
        if(!ok){ghost=null;render();notice.textContent="已放回原位。"}
      }drag=null;
    });
    board.addEventListener("pointercancel",()=>{drag=null;ghost=null;render()});
    render();
  }
  return {mount,thumb};
})();