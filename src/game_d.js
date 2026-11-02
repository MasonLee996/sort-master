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

/* ---------- 柜台 + 客人绘制（大立绘构图，对齐效果图） ----------
   墙(0..COUNTER_H) → 客人大立绘站在柜台后 → 黑猫 → 台面沿口+前脸 → 订单簇(物件+圆点+赏金+耐心条) → 对白气泡 */
let COUNTER_H = 292;                                   // 柜台台面线（layout() 按屏高 40% 重算）
function counterFaceH(){ return Math.max(62, Math.round(H*0.086)); }
function seatX(i){ const n=SEATS(); return n===1 ? W*0.46 : W*(0.30+0.38*i); }
function guestPos(o){ return {x:seatX(o.seat), y:COUNTER_H - COUNTER_H*0.24}; }   // 交付飞行目标：胸口

function drawCounter(now){
  // 1) 墙（贴图，回退渐变；随修复进度变暖）
  if(!cover(SPRITES.wall, 0, 0, W, COUNTER_H)){
    const prog = (save.bought?save.bought.length:0)/SHOP.length;
    const wg = ctx.createLinearGradient(0,0,0,COUNTER_H); wg.addColorStop(0, prog>.5?"#fff0d6":"#f3e2c7"); wg.addColorStop(1, prog>0?"#f0dcb8":"#e8d0ad");
    ctx.fillStyle = wg; ctx.fillRect(0,0,W,COUNTER_H);
  }
  // 2) 修复成果摆上墙（元叙事：铺子随修复变好看）
  const owns = save.bought||[];
  if(owns.length){
    ctx.save(); ctx.globalAlpha=.92;
    ctx.font='17px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign="center"; ctx.textBaseline="middle";
    owns.forEach((idx,i)=>{ const it=SHOP[idx]; if(it) ctx.fillText(it.ico, 48+i*24, 22); });
    ctx.restore();
  }
  // 3) 客人大立绘（底部沉入台面，被沿口遮住）+ 黑猫
  for(const o of orders) drawGuestBust(o, now);
  drawCat(now);
  // 4) 台面沿口 + 前脸（横板木纹，避免"栅栏"感）
  const fh = counterFaceH();
  const eg = ctx.createLinearGradient(0,COUNTER_H-8,0,COUNTER_H+12);
  eg.addColorStop(0,"#eec488"); eg.addColorStop(.5,"#c08a4e"); eg.addColorStop(1,"#8a5a30");
  ctx.fillStyle=eg; ctx.fillRect(0,COUNTER_H-8,W,20);
  ctx.fillStyle="rgba(255,235,200,.5)"; ctx.fillRect(0,COUNTER_H-8,W,3);
  const fg = ctx.createLinearGradient(0,COUNTER_H+12,0,COUNTER_H+fh);
  fg.addColorStop(0,"#9a6435"); fg.addColorStop(1,"#5e3a1c");
  ctx.fillStyle=fg; ctx.fillRect(0,COUNTER_H+12,W,fh-12);
  const midY = COUNTER_H + (12+fh)/2;
  ctx.strokeStyle="rgba(40,20,8,.20)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,midY); ctx.lineTo(W,midY); ctx.stroke();
  ctx.lineWidth=1.5;
  for(let x=44;x<W;x+=96){ ctx.beginPath(); ctx.moveTo(x,COUNTER_H+14); ctx.lineTo(x,midY-2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+48,midY+2); ctx.lineTo(x+48,COUNTER_H+fh-2); ctx.stroke(); }
  ctx.fillStyle="rgba(30,15,5,.35)"; ctx.fillRect(0,COUNTER_H+fh-3,W,3);
  // 5) 订单簇（画在前脸上：物件 + 圆点 + 赏金 + 耐心条，无卡片）
  for(const o of orders) drawOrderFace(o, now);
  // 6) 对白气泡（最上层）
  for(const o of orders) drawBubble(o, now);
}

function drawGuestBust(o, now){
  const G = guestPos(o);
  let x=G.x, alpha=1, dy=0, shx=0;
  const ein = Math.min(1,(now-o.enter)/500), pop = 1-Math.pow(1-ein,3);
  alpha = pop;
  if((o.done||o.gone) && o.leaveAt && now > o.leaveAt){
    const e = Math.min(1,(now-o.leaveAt)/700); alpha = 1-e;
    if(o.done) dy = -e*44; else { shx = Math.sin(now/30)*4*(1-e); }
  }
  if(alpha<=0) return;
  const angry = !o.done && !o.gone && o.pat/o.max <= .3, bounce = Math.max(0,o.bump-now)/300;
  if(angry) shx += Math.sin(now/45)*2;
  const bh = COUNTER_H*0.90*(1+bounce*.05)*pop;        // 立绘高（头顶留出气泡带）
  const bw = bh*0.88;
  const bx = x + shx - bw/2, by = COUNTER_H + 14 - bh + dy;
  ctx.save(); ctx.globalAlpha = alpha;
  // 落地影
  ctx.fillStyle="rgba(40,20,8,.22)"; ctx.beginPath(); ctx.ellipse(x+shx, COUNTER_H+8, bw*.38, 7, 0, 0, 7); ctx.fill();
  const sp = SPRITES[o.g.img];
  if(sp){
    ctx.drawImage(sp, bx, by, bw, bh);
  } else {                                             // 回退：奶白圆 + emoji
    ctx.fillStyle="#fff8ee"; ctx.strokeStyle="#d8bf9c"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(x+shx, COUNTER_H-bh*0.35, bh*0.3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.font = Math.round(bh*0.34)+"px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(o.g.ico, x+shx, COUNTER_H-bh*0.35);
  }
  // 状态徽章（完成✓ / 离开、生气 !）—— 放在立绘外侧，避免挤进相邻立绘
  const side = (o.seat===0 && SEATS()>1) ? -1 : 1;
  const bR = Math.max(11, bw*0.13), bxx = x+shx + side*bw*0.42, byy = by+bh*0.10;
  if(o.done || o.gone || angry){
    ctx.fillStyle = o.done ? "#4e9e5c" : "#d9534f";
    ctx.beginPath(); ctx.arc(bxx,byy,bR,0,7); ctx.fill();
    ctx.strokeStyle="#fff6e0"; ctx.lineWidth=2; ctx.stroke();
    ctx.strokeStyle="#fff"; ctx.lineWidth=Math.max(2,bR*0.22); ctx.lineCap="round";
    if(o.done){ ctx.beginPath(); ctx.moveTo(bxx-bR*.45,byy); ctx.lineTo(bxx-bR*.1,byy+bR*.38); ctx.lineTo(bxx+bR*.5,byy-bR*.35); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(bxx,byy-bR*.5); ctx.lineTo(bxx,byy+bR*.12); ctx.stroke();
      ctx.beginPath(); ctx.arc(bxx,byy+bR*.48,bR*.13,0,7); ctx.stroke(); }
  }
  if(o.kind==="vip" && !o.done && !o.gone){            // VIP 皇冠
    ctx.font=Math.round(bw*0.2)+"px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="alphabetic";
    ctx.fillText("👑", x+shx, by-bw*0.02);
  }
  ctx.restore();
}

function drawOrderFace(o, now){
  if(o.gone) return;
  const fh = counterFaceH(), y0 = COUNTER_H + 10;
  const items = o.need, n = items.length;
  const one = n===1;                                    // 尺寸按"单/双需求"两档，保证都装进前脸
  const objS = one?34:27, dotR = one?4.8:3.5, gap = one?13:9.5;
  let cw = 6;
  items.forEach(it=>{ cw += objS + 12 + it.want*3*gap + (one?20:12); });
  cw = Math.min(cw, W-12);
  const x0 = Math.max(6, Math.min(W-cw-6, guestPos(o).x - cw/2));
  // 行1：物件（带落地影，不悬空）+ 进度圆点（与物件垂直居中）
  let cx = x0+3;
  items.forEach(it=>{
    const oy = y0;
    ctx.fillStyle="rgba(25,12,4,.32)"; ctx.beginPath(); ctx.ellipse(cx+objS/2, y0+objS+4, objS*.44, objS*.13, 0, 0, 7); ctx.fill();
    drawItem(cx, oy, objS, it.c, false, 0);
    const dx0 = cx+objS+12, dy0 = oy+objS*.5;
    for(let d=0; d<it.want*3; d++){
      const px=dx0+d*gap, filled = d < it.got*3;
      ctx.beginPath(); ctx.arc(px,dy0,dotR,0,7);
      if(filled){ ctx.fillStyle="#fff6e0"; ctx.fill(); ctx.strokeStyle="rgba(30,15,5,.55)"; ctx.lineWidth=1.6; ctx.stroke(); }
      else { ctx.strokeStyle="rgba(30,15,5,.5)"; ctx.lineWidth=2.6; ctx.stroke(); ctx.strokeStyle="rgba(255,246,224,.85)"; ctx.lineWidth=1.5; ctx.stroke(); }
    }
    cx += objS + 12 + it.want*3*gap + (one?20:12);
  });
  // 行2：耐心条（占簇左 60%）+ 赏金币与数字（同一行右端，贴成一组）
  const y2 = y0 + objS + 5, barH = one?8:7, bw2 = cw*0.6, p = Math.max(0, o.pat/o.max);
  ctx.fillStyle="rgba(20,10,4,.5)"; roundRect(x0+2, y2, bw2, barH, 4); ctx.fill();
  if(!o.done && !o.gone && p>0){
    ctx.fillStyle = p>.5 ? "#7ec96a" : p>.3 ? "#f2b134" : "#e85d5d";
    roundRect(x0+2, y2, Math.max(6,bw2*p), barH, 4); ctx.fill();
  }
  const cyy = y2 + barH/2, cxx = x0 + cw - 12;
  if(o.kind==="imposter"){
    ctx.fillStyle="#c0392b"; ctx.beginPath(); ctx.arc(cxx,cyy,7,0,7); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="bold 10px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("?",cxx,cyy+1);
  } else {
    ctx.fillStyle="#f2b134"; ctx.beginPath(); ctx.arc(cxx,cyy,6.5,0,7); ctx.fill();
    ctx.strokeStyle="#a86a12"; ctx.lineWidth=1.6; ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(cxx,cyy,3.6,0,7); ctx.stroke();
    ctx.font="bold 13px sans-serif"; ctx.textAlign="right"; ctx.textBaseline="middle";
    ctx.lineWidth=3; ctx.strokeStyle="rgba(30,15,5,.65)"; ctx.strokeText(String(o.reward), cxx-11, cyy+1);
    ctx.fillStyle = o.kind==="vip" ? "#ffd98a" : "#fff6e0"; ctx.fillText(String(o.reward), cxx-11, cyy+1);
  }
}

function drawBubble(o, now){
  if(!(o.say && now < o.sayUntil)) return;
  const sL = Math.max(6, seatX(o.seat)-W*0.21), sR = Math.min(W-6, seatX(o.seat)+W*0.21);
  let fs = 12; ctx.font="bold "+fs+"px sans-serif"; let tw = ctx.measureText(o.say).width+16;
  while(tw > sR-sL && fs > 9){ fs--; ctx.font="bold "+fs+"px sans-serif"; tw = ctx.measureText(o.say).width+14; }
  const x = seatX(o.seat);
  const bx = Math.max(sL, Math.min(sR-tw, x-tw/2)), by = 2;
  ctx.fillStyle = o.gone?"#ffe3e3":"#fff"; roundRect(bx,by,tw,22,11); ctx.fill();
  ctx.strokeStyle="#6b4428"; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle="#4a3426"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(o.say, bx+tw/2, by+11);
}
