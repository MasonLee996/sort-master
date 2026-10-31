// 调参模拟 v3：env REWARD=none|tool|slot  PATK PATB  CHASE=0..4(篮内<=CHASE 才追单)
const g=require("./core.js");
const E=process.env, REWARD=E.REWARD||"none", PATK=+(E.PATK||9), PATB=+(E.PATB||6), CHASE=+(E.CHASE||4), N=+(E.N||300), MAXSLOT=+(E.MAXSLOT||9);
function run(lv, seedOff, orderAware, useTools){
  const {tiles}=g.genLevel(lv); let s=seedOff*9301+49297+lv; const r=()=>((s=(s*9301+49297)%233280)/233280);
  let SL=g.SLOT_N, slot=[], tools={shake:1,back:1}, revived=false, orders=[], done=0, lost=0, coins=0;
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
    // 两派共同底线：能凑三先凑三（订单色优先）
    pick=(orderAware&&free.find(t=>W[t.color]&&cnt[t.color]===2))||free.find(t=>cnt[t.color]===2);
    if(!pick&&orderAware&&slot.length<=CHASE) pick=free.find(t=>W[t.color]&&cnt[t.color]===1)||free.find(t=>W[t.color]);
    if(!pick) pick=(r()<.6&&free.find(t=>cnt[t.color]===1))||free[Math.floor(r()*free.length)];
    pick.alive=false; slot.push(pick.color);
    orders.forEach(o=>{if(!o.done&&!o.gone&&--o.pat<=0){o.gone=true;lost++}});
    if(slot.filter(x=>x===pick.color).length>=3){let k=0;slot=slot.filter(x=>!(x===pick.color&&k++<3));
      for(const o of orders){if(o.done||o.gone)continue;const n=o.need.find(x=>x.c==pick.color&&x.got<x.want);if(n){n.got++;if(o.need.every(x=>x.got>=x.want)){o.done=true;done++;coins+=o.reward;
        if(REWARD==="tool"){tools[['back','shake'][done%2]]++}
        if(REWARD==="slot"&&SL<MAXSLOT)SL++;
      }break}}}
    fill();
    if(slot.length>=SL-1 && useTools){
      if(tools.back){tools.back--;g.pushBack(tiles,slot.splice(0,3));continue}
      if(tools.shake){tools.shake--;const live=tiles.filter(t=>t.alive),cs=live.map(t=>t.color).sort(()=>r()-.5);live.forEach((t,i)=>t.color=cs[i]);continue}
    }
    if(slot.length>=SL){ if(useTools&&!revived){revived=true;g.pushBack(tiles,slot.splice(0,3));continue} return {win:false,done,lost,coins}; }
  }
  return {win:false,done,lost,coins};
}
const lvs=E.LV?E.LV.split(",").map(Number):[1,2,3,4,5,6,7,8,9,10];
const agg=(lv,oa,ut)=>{let w=0,d=0,l=0,c=0;for(let i=0;i<N;i++){const x=run(lv,i,oa,ut);w+=x.win;d+=x.done;l+=x.lost;c+=x.coins}return{w:Math.round(w/N*100),d:(d/N).toFixed(1),l:(l/N).toFixed(1),c:Math.round(c/N)}};
module.exports={agg};
if(require.main===module){
console.log(`REWARD=${REWARD} PATK=${PATK} PATB=${PATB} CHASE=${CHASE}`);
console.log("lv|裸玩|生存派(道具) 过/单/走/币|订单派(道具) 过/单/走/币");
for(const lv of lvs){const a=agg(lv,false,false),S=agg(lv,false,true),O=agg(lv,true,true);
  console.log(lv,"|",a.w+"%","|",S.w+"% "+S.d+"/"+S.l+"/"+S.c,"|",O.w+"% "+O.d+"/"+O.l+"/"+O.c);}
}
