const g=require("./core.js");
// 贪心玩家：优先拿能凑三的，其次篮里已有的色，否则随机
function play(lv,seedOff){
  const {tiles}=g.genLevel(lv); let slot=[]; let s=seedOff*9301+49297;
  const r=()=>((s=(s*9301+49297)%233280)/233280);
  while(true){
    const free=tiles.filter(t=>t.alive&&!g.isCovered(t,tiles));
    if(!free.length) return slot.length===0;
    const cnt={}; slot.forEach(c=>cnt[c]=(cnt[c]||0)+1);
    let pick=free.find(t=>cnt[t.color]===2)||(r()<.6&&free.find(t=>cnt[t.color]===1))||free[Math.floor(r()*free.length)];
    pick.alive=false; slot.push(pick.color);
    const c=slot.filter(x=>x===pick.color).length; if(c>=3){ let k=0; slot=slot.filter(x=>!(x===pick.color&&k++<3)); }
    if(slot.length>=g.SLOT_N) return false;
  }
}
for(let lv=1;lv<=10;lv++){ let w=0,N=400; for(let i=0;i<N;i++) if(play(lv,i)) w++; console.log("lv",lv,"贪心玩家通过率",(w/N*100).toFixed(0)+"%"); }
