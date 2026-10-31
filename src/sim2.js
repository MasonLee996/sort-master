// 玩法调参模拟：两种玩家（只顾生存 / 兼顾订单）× 是否用道具+复活
const g=require("./core.js");
const LV=+process.argv[2]||0, N=+process.argv[3]||300, PATK=+(process.argv[4]||9), PATB=+(process.argv[5]||6);
function run(lv, seedOff, orderAware, useTools){
  const {tiles}=g.genLevel(lv); let s=seedOff*9301+49297; const r=()=>((s=(s*9301+49297)%233280)/233280);
  let slot=[], tools={shake:1,back:1,peek:1}, revived=false, orders=[], done=0, lost=0, coins=0, gi=0;
  const remain=()=>{const h={};tiles.forEach(t=>{if(t.alive)h[t.color]=(h[t.color]||0)+1});slot.forEach(c=>h[c]=(h[c]||0)+1);return h};
  const newO=()=>{const h=remain(),busy=new Set(orders.flatMap(o=>o.need.map(x=>x.c)));const cs=Object.keys(h).map(Number).filter(c=>h[c]>=3&&!busy.has(c));if(!cs.length)return null;
    const k=lv<=2?1:(r()<.45&&cs.length>1?2:1);cs.sort(()=>r()-.5);const need=cs.slice(0,k).map(c=>({c,want:Math.min(Math.floor(h[c]/3),r()<.3?2:1),got:0}));
    const sets=need.reduce((a,x)=>a+x.want,0);const p=Math.round(sets*PATK+PATB-Math.min(4,lv*.4));return{need,pat:p,reward:8+sets*10}};
  const fill=()=>{orders=orders.filter(o=>!o.done&&!o.gone);const n=lv===1?1:2;while(orders.length<n){const o=newO();if(!o)break;orders.push(o)}};
  fill();
  const wanted=()=>{const w={};orders.forEach(o=>o.need.forEach(x=>{if(x.got<x.want)w[x.c]=1}));return w};
  for(let step=0;step<2000;step++){
    const free=tiles.filter(t=>t.alive&&!g.isCovered(t,tiles));
    if(!free.length) return {win:slot.length===0,done,lost,coins};
    const cnt={};slot.forEach(c=>cnt[c]=(cnt[c]||0)+1); const W=wanted();
    let pick;
    const danger=slot.length>=5;
    if(orderAware && !danger) pick=free.find(t=>W[t.color]&&cnt[t.color]===2)||free.find(t=>cnt[t.color]===2)||free.find(t=>W[t.color]&&cnt[t.color]===1)||free.find(t=>W[t.color]);
    if(!pick) pick=free.find(t=>cnt[t.color]===2)||(r()<.6&&free.find(t=>cnt[t.color]===1))||free[Math.floor(r()*free.length)];
    pick.alive=false; slot.push(pick.color);
    orders.forEach(o=>{if(!o.done&&!o.gone&&--o.pat<=0){o.gone=true;lost++}});
    if(slot.filter(x=>x===pick.color).length>=3){let k=0;slot=slot.filter(x=>!(x===pick.color&&k++<3));
      for(const o of orders){if(o.done||o.gone)continue;const n=o.need.find(x=>x.c==pick.color&&x.got<x.want);if(n){n.got++;if(o.need.every(x=>x.got>=x.want)){o.done=true;done++;coins+=o.reward; if(process.env.GIFT){ const k=['back','shake'][done%2]; tools[k]++; }}break}}}
    fill();
    if(slot.length>=g.SLOT_N-1 && useTools){
      if(tools.back){tools.back=0;g.pushBack(tiles,slot.splice(0,3));continue}
      if(tools.shake){tools.shake=0;const live=tiles.filter(t=>t.alive),cs=live.map(t=>t.color).sort(()=>r()-.5);live.forEach((t,i)=>t.color=cs[i]);continue}
    }
    if(slot.length>=g.SLOT_N){ if(useTools&&!revived){revived=true;g.pushBack(tiles,slot.splice(0,3));continue} return {win:false,done,lost,coins}; }
  }
  return {win:false,done,lost,coins};
}
const lvs=LV?[LV]:[1,2,3,4,5,6,7,8,9,10];
console.log("lv | 裸玩通过 | +道具复活 | 生存派 单/气走/币 | 订单派 单/气走/币 | 订单派通过");
for(const lv of lvs){
  const agg=(oa,ut)=>{let w=0,d=0,l=0,c=0;for(let i=0;i<N;i++){const x=run(lv,i,oa,ut);w+=x.win;d+=x.done;l+=x.lost;c+=x.coins}return{w:(w/N*100).toFixed(0)+"%",d:(d/N).toFixed(1),l:(l/N).toFixed(1),c:(c/N).toFixed(0)}};
  const a=agg(false,false),b=agg(false,true),cS=agg(false,true),cO=agg(true,true);
  console.log(lv,"|",a.w,"|",b.w,"|",cS.d+"/"+cS.l+"/"+cS.c,"|",cO.d+"/"+cO.l+"/"+cO.c,"|",cO.w);
}
