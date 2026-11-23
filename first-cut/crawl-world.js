/* Camera, collision and encounter triggers share one grid. The supply rules own all goods. */
(() => {
  "use strict";
  const cards=typeof module!=="undefined"&&module.exports?require("./crawl-cards.js"):window.CrawlCards;
  const rows=["#########","##.....##","##.###.##","#.......#","####.####","###...###","####.####","#########"];
  const delta=[[0,-1],[1,0],[0,1],[-1,0]],compass=["北","东","南","西"];
  function passage(s){return (s.sign+s.leg)%2===1}
  function sites(s){
    const left=passage(s)?"rat":"moth",right=left==="rat"?"moth":"rat";
    return [{id:"lamp",label:"旧灯台",x:4,y:5},{id:left,label:left==="rat"?"鼠洞":"灯架",x:2,y:3},
      {id:right,label:right==="rat"?"鼠洞":"灯架",x:6,y:3},{id:"fox",label:"镜门",x:4,y:1}];
  }
  function start(){return {x:4,y:6,dir:0,walking:true,seen:[]}}
  function create(seed,standing){return {...cards.create(seed,standing),navState:start()}}
  function markers(s){
    const markers=sites(s);
    if(s.phase==="gather")return markers.slice(0,1);
    if(s.phase==="route")return markers.slice(1,3);
    if(s.phase==="fight"&&s.foe.id==="fox")return markers.slice(3);
    return [];
  }
  const eventFor={lamp:"gather",moth:"hunt-moth",rat:"hunt-rat",fox:"fight"};
  function bearing(n,goal){
    const queue=[{x:n.x,y:n.y,steps:[]}],visited=new Set([n.x+","+n.y]);
    for(let i=0;i<queue.length;i++){
      const tile=queue[i];
      if(tile.x===goal.x&&tile.y===goal.y){
        const steps=tile.steps,d=steps[0];if(d==null)return "";
        const turn=(d-n.dir+4)%4,changed=steps.findIndex(step=>step!==d);
        return ["向前","先右转，再向前","先转身，再向前","先左转，再向前"][turn]+
          (changed<0?steps.length:changed)+" 格（向"+compass[d]+"）。";
      }
      delta.forEach(([dx,dy],dir)=>{
        const x=tile.x+dx,y=tile.y+dy,key=x+","+y;
        if(!rows[y]||rows[y][x]!=="."||visited.has(key))return;
        visited.add(key);queue.push({x,y,steps:[...tile.steps,dir]});
      });
    }
    return "";
  }
  function view(s){
    const v=cards.view(s),n=s.navState||start(),points=markers(s);
    v.nav={rows,x:n.x,y:n.y,dir:n.dir,markers:points,theme:s.leg,seen:n.seen};
    if(!n.walking||!points.length)return v;
    const [dx,dy]=delta[n.dir],ahead=rows[n.y+dy]?.[n.x+dx],blocked=!ahead||ahead==="#";
    const goal=s.phase==="gather"?"走到灯台":s.phase==="route"?"在岔口选猎路":"去镜门";
    v.phase="walk";v.foe=null;v.title=goal;v.place=s.leg===3?"镜门":s.leg===2?"桥驿后廊":"灯廊";
    const left=sites(s)[1].id==="moth"?"西边灯架，东边鼠洞。":"东边灯架，西边鼠洞。";
    v.description=s.phase==="route"?left+(s.leg===1?"猎蛾得灰，但那条路的狐扣缺角；追鼠能遇上带完扣的狐。":"灯架收灰，竹柄钩可多取一份。鼠洞先护筐，战后 "+v.freightPrice+" 灰换完扣。首招要挡 5 伤。"):
      s.phase==="gather"?"灯台在北面。向前走一格，收灰或包扎。":"沿通道走向北面的镜门。到门前就会遇见镜狐。";
    if(s.phase==="route"&&n.y>3)v.description="先到岔路的木牌前。"+bearing(n,{x:4,y:3})+v.description;
    if(s.phase==="fight")v.description="去镜门。"+bearing(n,points[0])+"到门前会遇到镜狐。";
    if(s.phase==="gather")v.description="旧灯台可以收灰或包扎。"+bearing(n,points[0])+(s.leg===2?"鼠洞换扣要 "+v.freightPrice+" 灰，你有 "+s.items.ash+" 灰。":"");
    v.notice="";
    v.actions=[{id:"turn-left",label:"左转",detail:"转向"+compass[(n.dir+3)%4]},
      {id:"step",label:"向前走",detail:blocked?"前方是墙":"朝"+compass[n.dir]+"走一格",disabled:blocked},
      {id:"turn-right",label:"右转",detail:"转向"+compass[(n.dir+1)%4]},
      {id:"retreat",label:"带货回铺",detail:"放弃后续猎路"}];
    return v;
  }
  function act(s,id){
    const n=s.navState||start(),v=view(s);
    if(!v.actions.some(a=>a.id===id&&!a.disabled))return s;
    if(v.phase==="walk"&&id!=="retreat"){
      if(id!=="step")return {...s,navState:{...n,dir:(n.dir+(id==="turn-left"?3:1))%4}};
      const [dx,dy]=delta[n.dir],x=n.x+dx,y=n.y+dy,key=x+","+y,target=markers(s).find(p=>p.x===x&&p.y===y);
      const navState={...n,x,y,walking:!target,seen:n.seen.includes(key)?n.seen:[...n.seen,key]};
      if(target&&(target.id==="rat"||target.id==="moth"))return {...cards.act(s,eventFor[target.id]),navState:{...navState,dir:0}};
      return {...s,navState};
    }
    const next=cards.act(s,id);if(next===s)return s;
    let navState=n;
    if(next.phase==="gather"&&s.phase!=="gather")navState=start();
    else if(next.phase==="route"&&s.phase!=="route")navState={...n,walking:true};
    else if(next.phase==="fight"&&s.phase==="loot")navState={...n,dir:0,walking:true};
    else if(v.phase==="walk"&&id==="retreat")navState={...n,walking:false};
    return {...next,navState};
  }
  const api={create,view,act};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(typeof window!=="undefined")window.CrawlWorld=api;
})();