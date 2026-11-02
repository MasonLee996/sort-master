/* ---------- 订单 v3：客人"站进"场景 ----------
   客人站在筐上方的柜台前，头顶气泡点单 + 耐心环；收好的物件会真的飞到客人手里；
   客人会催、会道谢、会摔门走，黑猫会幸灾乐祸。筐里客人要的东西带金圈提示。
   规则不变：每拿 1 件耐心 -1；交单 → 线篮 +1 格（上限 SLOT_MAX）+ 金币。 */
// 普通客人（循环出场）
const GUESTS = [
  {ico:"👵",n:"奶奶",img:"granny"},{ico:"👧",n:"小花",img:"girl"},{ico:"🧔",n:"木匠",img:"carpenter"},{ico:"👩‍🍳",n:"厨娘",img:"cook"},
  {ico:"👮",n:"巡警",img:"police"},{ico:"👴",n:"老邮差",img:"postman"}
];
// 特殊客人：VIP（斗篷客，重赏短耐心）/ 黑猫假扮（陷阱，喂它就偷格子）
const VIP_GUEST = {ico:"🧙",n:"斗篷客",kind:"vip",img:"cloak"};
const CAT_GUEST  = {ico:"😼",n:"神秘客",kind:"imposter",img:"cat"};
const IMPOSTOR_SAY = ["喵（咳）…我是来买东西的！","快给我，别问那么多","嘻…这颜色归我了","别老盯着我的尾巴看"];
// 剧情串联：小花是跨关回访的常客，在 3/5/7/9 关必出现，完成她订单→故事+1、额外金币
const XH_LEVELS = [3,5,7,9];
const XH_LINES = [
  "小花：上次那团线，我织成围巾啦！",
  "小花：奶奶说你手艺越来越好了～",
  "小花：镇上的灰雾，好像淡了一点点。",
  "小花：等我长大，也要来帮你守铺子！"
];
let orders = [], orderDone = 0, orderLost = 0, coinsGot = 0, guestIdx = 0, deliverFx = [];
const SEATS = ()=> level===1 ? 1 : 2;
const pick1 = a => a[Math.floor(Math.random()*a.length)];

function remainCount(){ const h={}; tiles.forEach(t=>{ if(t.alive) h[t.color]=(h[t.color]||0)+1; }); slot.forEach(s=>h[s.color]=(h[s.color]||0)+1); return h; }
function guestSay(o, txt, ms){ o.say = txt; o.sayUntil = performance.now() + (ms||1800); }
// 特殊客人是"风险/收益"旋钮：VIP 给高价值短耐心，黑猫假扮是陷阱
function rollKind(){
  if(level>=4 && Math.random()<0.18) return "imposter";
  if(level>=3 && Math.random()<0.28) return "vip";
  return "normal";
}
function newOrder(seat){
  const have = remainCount(), busyC = new Set(orders.filter(o=>!o.done&&!o.gone).flatMap(o=>o.need.map(x=>x.c)));
  const cols = Object.keys(have).map(Number).filter(c=>have[c]>=3 && !busyC.has(c)).sort(()=>Math.random()-.5);
  if(!cols.length) return null;
  const kinds = level<=2 ? 1 : (Math.random()<.45 && cols.length>1 ? 2 : 1);
  const need = cols.slice(0,kinds).map(c=>({c, want: Math.min(Math.floor(have[c]/3), Math.random()<.3?2:1), got:0}));
  const sets = need.reduce((s,x)=>s+x.want,0);
  // 小花（常客）在剧情关必出现在座位0；否则按风险/收益掷特殊客人
  let g, kind="normal";
  if(seat===0 && XH_LEVELS.includes(level) && !orders.some(o=>o.regular)){ g = GUESTS[1]; kind="regular"; }
  else { const rk = rollKind(); kind = rk;
    g = rk==="vip" ? VIP_GUEST : rk==="imposter" ? CAT_GUEST : GUESTS[guestIdx++ % GUESTS.length]; }
  let pat = Math.round(sets*11 + 8 - Math.min(4, level*.4));   // 耐心 = 拿取次数（sim3 调参：11/8）
  let reward = 8 + sets*10;
  if(g.kind==="vip"){ pat = Math.max(4, Math.round(pat*0.5)); reward = reward*3; }   // VIP：赏金×3、耐心减半
  const o = {g, kind:g.kind||kind, regular: kind==="regular", need, seat, done:false, gone:false, pat, max:pat, reward,
             enter: performance.now(), leaveAt: 0, bump: 0, urged:false, say:"", sayUntil:0};
  guestSay(o, g.kind==="imposter" ? pick1(IMPOSTOR_SAY) : ITEM_WHY[need[0].c] + "，要" + ITEM_NAMES[need[0].c] + "！", 2600);
  return o;
}
function freeSeat(){ const used = new Set(orders.map(o=>o.seat)); for(let i=0;i<SEATS();i++) if(!used.has(i)) return i; return -1; }
function makeOrders(){
  orders=[]; deliverFx=[]; orderDone=0; orderLost=0; coinsGot=0; guestIdx=level*2;
  for(let i=0;i<SEATS();i++){ const o=newOrder(i); if(o) orders.push(o); }
}
function refillOrders(){
  orders = orders.filter(o=>!o.done && !o.gone);
  let s; while((s=freeSeat())>=0){ const o=newOrder(s); if(!o) break; orders.push(o); }
}
function renderOrders(){}   // 兼容旧调用：订单已改为画布内绘制

// 客人想要、且还没凑齐的物件颜色（用于筐内金圈提示）
function wantedSet(){ const w={}; orders.forEach(o=>{ if(!o.done&&!o.gone) o.need.forEach(x=>{ if(x.got<x.want) w[x.c]=1; }); }); return w; }

// 每拿一件：耐心 -1；快没耐心时催一句；耗尽就摔门走
function tickOrders(){
  let changed=false;
  for(const o of orders){
    if(o.done||o.gone) continue;
    o.pat--;
    if(!o.urged && o.pat/o.max <= .3){ o.urged=true; guestSay(o, pick1(GUEST_LINES.urgent), 1600); beep(330,.1,"square",.06); }
    if(o.pat<=0){
      o.gone=true; o.leaveAt=performance.now(); orderLost++; changed=true;
      guestSay(o, pick1(GUEST_LINES.leave), 1400); cat("guestGone");
      beep(220,.25,"triangle",.1,150); vibrate(40);
    }
  }
  if(changed) setTimeout(refillOrders,1000);
}
// 三消时：物件真的飞到客人手里
function deliver(c, fromRects){
  for(const o of orders){
    if(o.done||o.gone) continue;
    const n = o.need.find(x=>x.c==c && x.got<x.want); if(!n) continue;
    n.got++; o.bump = performance.now()+300;
    const G = guestPos(o), now = performance.now();
    (fromRects||[]).forEach((r,k)=>deliverFx.push({x0:r.x+r.s/2, y0:r.y+r.s/2, x1:G.x, y1:G.y, c, t0: now + k*70, o}));
    if(o.need.every(x=>x.got>=x.want)){
      o.done=true; o.leaveAt=now+450; orderDone++;
      if(o.kind==="imposter"){ imposterReveal(o); setTimeout(refillOrders,1300); return true; }   // 黑猫假扮：喂它就是上当
      coinsGot+=o.reward;
      if(o.regular){ save.xiaohua=(save.xiaohua||0)+1; persist(); const b=8; coinsGot+=b; floatTxt(G.x,G.y-30,"🌸 小花 +"+b); toast("🌸 小花的故事 +1（"+(save.xiaohua)+"/"+XH_LEVELS.length+"）"); }
      const grow = slotCap < SLOT_MAX; if(grow) slotCap++;
      setTimeout(()=>{
        const thx = o.regular ? (XH_LINES[Math.min((save.xiaohua||1)-1, XH_LINES.length-1)]||"小花：又见面啦～") : pick1(GUEST_LINES.thanks);
        guestSay(o, thx, 1600);
        [784,988,1318].forEach((f,k)=>setTimeout(()=>beep(f,.16,"triangle",.16),k*80));
        vibrate([15,30,15]);
        // 局内回报：每完成一单，线篮 +1 格（上限 SLOT_MAX）—— 让"做订单"从陷阱变成保命投资
        let gift = "";
        if(grow){ slotFlash = performance.now()+1400; gift = "  🧺 篮子+1格"; }
        floatTxt(G.x, G.y-30, "💰+"+o.reward + (o.kind==="vip"?" ×3":"") + (o.regular?"  🌸":gift));
        if(Math.random()<.5) cat("guestDone");
      }, 420);
      setTimeout(refillOrders,1300);
    } else beep(1046,.12,"triangle",.14);
    return true;
  }
  return false;
}
// 黑猫假扮客人被"喂"了：现原形，偷走 1 格篮子（下限 SLOT_N），并嘲讽
function imposterReveal(o){
  const G = guestPos(o), stole = slotCap > SLOT_N;
  if(stole) slotCap = Math.max(SLOT_N, slotCap-1);
  cat("imposter");
  beep(160,.3,"sawtooth",.12,300);
  floatTxt(G.x, G.y-30, "😼 喵哈哈！");
  shakeT = Math.max(shakeT, .6);
  toast("😼 黑猫现原形！" + (stole ? "偷走了 1 格篮子！" : "（篮子已最小）"));
}
let floats=[];
function floatTxt(x,y,s){ floats.push({x,y,s,t0:performance.now()}); }

/* ---------- 柜台 + 客人绘制（画布顶部 COUNTER_H 区域） ---------- */
const COUNTER_H = 118;
function guestPos(o){
  // 区间 [48, W-78]：左边是门，右边是黑猫；每个座位 = 客人头像 + 右侧需求牌
  const n = SEATS(), L = 48, span = (W - 78 - L)/n;
  return {x: L + span*o.seat + 30, y: 62};
}
function drawCounter(now){
  // 墙 + 柜台台面（墙用贴图，回退渐变）
  if(!cover(SPRITES.wall, 0, 0, W, COUNTER_H)){
    const prog = (save.bought?save.bought.length:0)/SHOP.length;
    const wg = ctx.createLinearGradient(0,0,0,COUNTER_H); wg.addColorStop(0, prog>.5?"#fff0d6":"#f3e2c7"); wg.addColorStop(1, prog>0?"#f0dcb8":"#e8d0ad");
    ctx.fillStyle = wg; ctx.fillRect(0,0,W,COUNTER_H);
  }
  ctx.fillStyle = "#b07a46"; ctx.fillRect(0,COUNTER_H-22,W,22);
  ctx.fillStyle = "#8a5a2c"; ctx.fillRect(0,COUNTER_H-6,W,6);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(0,COUNTER_H-22,W,3);
  // 元叙事：修好的物件摆上柜台前脸，铺子随修复「变好看」
  const owns = save.bought||[];
  if(owns.length){
    const step = (W-44)/owns.length, sy = COUNTER_H-11;
    ctx.font='20px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign="center"; ctx.textBaseline="middle";
    owns.forEach((idx,i)=>{ const it=SHOP[idx]; if(!it) return; ctx.fillText(it.ico, 30+step*(i+.5), sy); });
  }
  // 门（客人从这里进出）
  ctx.fillStyle="#9c6b3d"; roundRect(8,8,34,COUNTER_H-30,6); ctx.fill();
  ctx.fillStyle="#f2b134"; ctx.beginPath(); ctx.arc(36,COUNTER_H/2-4,2.5,0,7); ctx.fill();
  for(const o of orders) drawGuest(o, now);
}
function drawGuest(o, now){
  const G = guestPos(o), p = Math.max(0, o.pat/o.max);
  // 入场：从门口走进来；离场：完成=开心跳走，气走=抖一下后走
  let x = G.x, y = G.y, alpha = 1;
  const ein = Math.min(1, (now - o.enter)/500); x = 30 + (G.x-30)*(1-Math.pow(1-ein,3));
  if((o.done||o.gone) && o.leaveAt && now > o.leaveAt){
    const e = Math.min(1,(now-o.leaveAt)/700); alpha = 1-e;
    if(o.done) y -= e*30; else x += Math.sin(now/30)*4*(1-e) - e*40;
  }
  if(alpha<=0) return;
  const angry = !o.done && !o.gone && p<=.3, bounce = Math.max(0, o.bump-now)/300;
  ctx.save(); ctx.globalAlpha = alpha;
  if(angry) x += Math.sin(now/45)*2;
  // 耐心环
  const R = 25;
  ctx.lineWidth = 5; ctx.strokeStyle="rgba(120,90,60,.2)"; ctx.beginPath(); ctx.arc(x,y,R,0,7); ctx.stroke();
  if(!o.done && !o.gone){
    ctx.strokeStyle = o.kind==="vip" ? "#e0a93a" : p>.5?"#5fae6a":p>.3?"#f2b134":"#e85d5d";
    ctx.beginPath(); ctx.arc(x,y,R,-Math.PI/2,-Math.PI/2+Math.PI*2*p); ctx.stroke();
  }
  if(o.kind==="vip"){ ctx.fillStyle="rgba(224,169,58,.18)"; ctx.beginPath(); ctx.arc(x,y,R+5,0,7); ctx.fill(); }  // VIP 金光
  const sp = SPRITES[o.g.img];
  if(sp){
    const ps = 54 * (1 + bounce*.25);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y+3, R-2, 0, 7); ctx.clip();
    ctx.drawImage(sp, x-ps/2, y+3-ps*0.45, ps, ps);
    ctx.restore();
    if(o.done){ ctx.fillStyle="rgba(90,180,90,.5)"; ctx.beginPath(); ctx.arc(x,y+3,R-2,0,7); ctx.fill(); }
    else if(o.gone){ ctx.fillStyle="rgba(180,80,80,.5)"; ctx.beginPath(); ctx.arc(x,y+3,R-2,0,7); ctx.fill(); }
  } else {
    ctx.fillStyle = o.done?"#e6f4e2":o.gone?"#f6dede":"#fff8ee"; ctx.beginPath(); ctx.arc(x,y,R-3,0,7); ctx.fill();
    const face = o.done?"😊":o.gone?"😤":angry?"😠":o.g.ico;
    ctx.font = `${Math.round(30*(1+bounce*.25))}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(face, x, y+2);
  }
  ctx.font="bold 11px sans-serif"; ctx.fillStyle="#6b4428"; ctx.fillText(o.g.n, x, y+R+9);
  if(o.kind==="vip"){ ctx.font="20px sans-serif"; ctx.fillText("👑", x, y-R-13); }   // VIP 皇冠
  // 需求牌：物件 + 进度（挂在客人左侧）
  if(!o.gone){
    const items = o.need, bw = 34*items.length+8, bx = x + R + 4, by = y-20;
    ctx.fillStyle = o.done?"#e6f4e2":"#fff"; roundRect(bx,by,bw,40,10); ctx.fill();
    if(o.kind==="imposter"){ ctx.setLineDash([4,3]); ctx.strokeStyle="#c0392b"; ctx.lineWidth=2; ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.strokeStyle = angry?"#e85d5d":"#d8bf9c"; ctx.lineWidth=2; ctx.stroke(); }
    items.forEach((it,k)=>{
      const ix = bx+4+k*34;
      drawItem(ix, by+3, 24, it.c, false, 0);
      const ok = it.got>=it.want;
      ctx.font="bold 11px sans-serif"; ctx.fillStyle= ok?"#3d8549":"#8a6a50"; ctx.textAlign="left";
      ctx.textAlign="center"; ctx.fillText(ok?"✓":(it.got*3)+"/"+(it.want*3), ix+15, by+33);
    });
    if(!o.done){ const cx0 = bx+bw/2-10, cy0 = by-8;            // 画布自绘金币（不依赖 💰 字形）
      if(o.kind==="imposter"){ ctx.fillStyle="#c0392b"; ctx.beginPath(); ctx.arc(cx0,cy0,6,0,7); ctx.fill(); ctx.fillStyle="#fff"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("?",cx0,cy0+1); }
      else { ctx.fillStyle="#f2b134"; ctx.beginPath(); ctx.arc(cx0,cy0,5,0,7); ctx.fill(); ctx.strokeStyle="#c4861a"; ctx.lineWidth=1.5; ctx.stroke();
        ctx.font="bold 11px sans-serif"; ctx.fillStyle="#c0812a"; ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText(o.reward, cx0+8, cy0+1); } }
  }
  // 对白气泡（在客人上方）
  if(o.say && now < o.sayUntil){
    // 气泡限定在本座位区间内，字太长就缩字号 —— 两位客人的气泡不会互相压
    const n = SEATS(), L = 46, span = (W - 78 - L)/n, sL = L + span*o.seat, sR = sL + span - 4;
    let fs = 12; ctx.font="bold "+fs+"px sans-serif"; let tw = ctx.measureText(o.say).width+16;
    while(tw > sR-sL && fs > 9){ fs--; ctx.font="bold "+fs+"px sans-serif"; tw = ctx.measureText(o.say).width+14; }
    const bx = Math.max(sL, Math.min(sR-tw, x-tw/2)), by = 2;
    ctx.fillStyle = o.gone?"#ffe3e3":"#fff"; roundRect(bx,by,tw,22,11); ctx.fill();
    ctx.strokeStyle="#6b4428"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#4a3426"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(o.say, bx+tw/2, by+11);
  }
  ctx.restore();
}
