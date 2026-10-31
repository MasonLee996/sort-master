/* ---------- 订单（浪漫餐厅式）：顾客排队点单 + 耐心值，三消收好的物件自动交付 ----------
   设计要点：筐总要清空，所以订单必须带"时效"才有决策 —— 每拿 1 件，所有客人耐心 -1；
   耐心耗尽客人生气离开（拿不到金币），换下一位。玩家要在"保命清篮"和"先做订单"间取舍。 */
const GUESTS = [
  {ico:"👵",n:"奶奶"},{ico:"👧",n:"小花"},{ico:"🧔",n:"木匠"},{ico:"👩‍🍳",n:"厨娘"},
  {ico:"🧙",n:"斗篷客"},{ico:"👮",n:"巡警"},{ico:"👴",n:"老邮差"}
];
let orders = [], orderDone = 0, orderLost = 0, coinsGot = 0, guestIdx = 0;

function remainCount(){ const h={}; tiles.forEach(t=>{ if(t.alive) h[t.color]=(h[t.color]||0)+1; }); slot.forEach(s=>h[s.color]=(h[s.color]||0)+1); return h; }
function newOrder(){
  const have = remainCount(), busyC = new Set(orders.filter(o=>!o.done&&!o.gone).flatMap(o=>o.need.map(x=>x.c)));
  const cols = Object.keys(have).map(Number).filter(c=>have[c]>=3 && !busyC.has(c)).sort(()=>Math.random()-.5);
  if(!cols.length) return null;
  const kinds = level<=2 ? 1 : (Math.random()<.45 && cols.length>1 ? 2 : 1);
  const need = cols.slice(0,kinds).map(c=>({c, want: Math.min(Math.floor(have[c]/3), Math.random()<.3?2:1), got:0}));
  const sets = need.reduce((s,x)=>s+x.want,0);
  const g = GUESTS[guestIdx++ % GUESTS.length];
  const pat = Math.round(sets*11 + 8 - Math.min(4, level*.4));  // 耐心 = 拿取次数（sim3 调参：11/8）
  return {g, need, done:false, gone:false, pat, max:pat, reward: 8 + sets*10};
}
function makeOrders(){
  orders=[]; orderDone=0; orderLost=0; coinsGot=0; guestIdx=level*2;
  const n = level===1 ? 1 : 2;
  for(let i=0;i<n;i++){ const o=newOrder(); if(o) orders.push(o); }
}
function refillOrders(){
  orders = orders.filter(o=>!o.done && !o.gone);
  const n = level===1 ? 1 : 2;
  while(orders.length < n){ const o=newOrder(); if(!o) break; orders.push(o); }
  renderOrders();
}
// 每拿一件：耐心 -1
function tickOrders(){
  let changed=false;
  for(const o of orders){ if(o.done||o.gone) continue; o.pat--; if(o.pat<=0){ o.gone=true; orderLost++; changed=true; toast(o.g.ico+" "+o.g.n+"等不及走了…"); beep(220,.25,"triangle",.1,150); } }
  renderOrders(); if(changed) setTimeout(refillOrders,700);
}
// 三消时：交给需要它的客人
function deliver(c){
  for(const o of orders){
    if(o.done||o.gone) continue;
    const n = o.need.find(x=>x.c==c && x.got<x.want); if(!n) continue;
    n.got++; beep(1046,.12,"triangle",.14);
    if(o.need.every(x=>x.got>=x.want)){
      o.done=true; orderDone++; coinsGot+=o.reward;
      [784,988,1318].forEach((f,k)=>setTimeout(()=>beep(f,.16,"triangle",.16),k*80));
      vibrate([15,30,15]);
      // 局内回报：每完成一单，线篮 +1 格（上限 SLOT_MAX）—— 让"做订单"从陷阱变成保命投资
      if(slotCap < SLOT_MAX){ slotCap++; slotFlash = performance.now()+1200; toast(o.g.ico+" "+o.g.n+"送你一格篮子！🧺+1 · 🪙+"+o.reward); }
      else toast(o.g.ico+" "+o.g.n+"：太谢谢啦！ 🪙+"+o.reward);
      setTimeout(refillOrders,700);
    }
    renderOrders(o); return true;
  }
  return false;
}
function renderOrders(hit){
  const el=document.getElementById("orders"); if(!el) return;
  el.innerHTML = orders.map(o=>{
    const p = Math.max(0,o.pat/o.max), col = p>.5?"#5fae6a":p>.25?"#f2b134":"#e85d5d";
    const face = o.done?"😊":o.gone?"😤":p<=.25?"😠":o.g.ico;
    return `<div class="ord${o.done?" done":""}${o.gone?" gone":""}${o===hit?" hit":""}">
      <span class="gst">${face}</span>
      <span class="body"><span class="need">${o.need.map(x=>`<span class="it">${ITEMS[x.c]}<b>${Math.min(x.got,x.want)*3}/${x.want*3}</b></span>`).join("")}</span>
      <span class="pat"><i style="width:${p*100}%;background:${col}"></i></span></span>
      <span class="rw">${o.done?"✅":o.gone?"❌":"🪙"+o.reward}</span></div>`; }).join("") || `<div class="ord done"><span class="gst">🌙</span><span class="body">今天没有客人了</span></div>`;
}
