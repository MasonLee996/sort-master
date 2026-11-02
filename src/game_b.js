/* ---------- 主循环绘制 ---------- */
function draw(now){
  ctx.clearRect(0,0,W,H);
  drawScene(now);
  drawCounter(now);
  let sx=0, sy=0;
  if(shakeT>0){ sx=(Math.random()-.5)*10*shakeT; sy=(Math.random()-.5)*6*shakeT; shakeT=Math.max(0,shakeT-.04); }
  ctx.save(); ctx.translate(sx,sy);
  // 堆叠
  const alive = tiles.filter(t=>t.alive).sort((a,b)=>a.z-b.z || a.y-b.y), WANT = wantedSet();
  for(const t of alive){
    const r = tileRect(t), cov = isCovered(t,tiles);
    // 客人要的、且现在能拿的：贴合金光呼吸 —— 染金剪影垫在物件底下，与物件同形，不再画浮空圆环
    if(WANT[t.color] && !cov){
      const p = .5 + .5*Math.sin(now/200);
      const gs = goldSprite(t.color);
      if(gs){
        const gd = r.s*1.32;
        ctx.save(); ctx.globalAlpha = .5 + .35*p;
        ctx.drawImage(gs, r.x+(r.s-gd)/2, r.y+(r.s-gd)/2, gd, gd);
        ctx.restore();
      } else {
        const gx=r.x+r.s/2, gy=r.y+r.s/2;
        const g=ctx.createRadialGradient(gx,gy,r.s*.15,gx,gy,r.s*.6);
        g.addColorStop(0,`rgba(255,214,110,${.45+.3*p})`);
        g.addColorStop(1,"rgba(255,190,70,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx,gy,r.s*.6,0,7); ctx.fill();
      }
    }
    drawItem(r.x,r.y,r.s,t.color, cov && peekT<=0, t.rot);
  }
  ctx.restore();
  drawBasketFront();                                        // 前筐沿盖住堆底物件（筐=容器）
  // 线篮
  const danger = slot.length >= slotCap-2;
  const s0 = slotRect(0);
  const tg = ctx.createLinearGradient(0, slotY-8, 0, slotY+s0.s+8);
  tg.addColorStop(0, danger ? "#7a4a2e" : "#5e3a20"); tg.addColorStop(1, danger ? "#54290f" : "#3a2210");
  ctx.fillStyle = tg; roundRect(s0.x-8, slotY-8, slotW+16, s0.s+16, 18); ctx.fill();
  ctx.strokeStyle = danger ? "#e8604a" : "#c8912f"; ctx.lineWidth=3; ctx.stroke();
  for(let i=0;i<SLOT_MAX;i++){ const r=slotRect(i);
    if(i<slotCap){ ctx.fillStyle = (i===slotCap-1 && slotFlash>now) ? "#ffe08a" : "#fbf1e2"; roundRect(r.x+3,r.y+3,r.s-6,r.s-6,10); ctx.fill();
      ctx.strokeStyle="#d8b06a"; ctx.lineWidth=1.5; ctx.stroke(); }
    else { ctx.fillStyle="rgba(120,90,60,.18)"; roundRect(r.x+3,r.y+3,r.s-6,r.s-6,10); ctx.fill();
      ctx.font=(r.s*.36)+"px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.globalAlpha=.55; ctx.fillText("🔒",r.x+r.s/2,r.y+r.s/2); ctx.globalAlpha=1; } }
  slot.forEach((it,i)=>{ const r=slotRect(i); it.dx += (r.x-it.dx)*.35; drawItem(it.dx+3,r.y+3,r.s-6,it.color,false,0); });
  // 飞行中
  for(let i=flying.length-1;i>=0;i--){
    const f=flying[i]; f.t=Math.min(1,f.t+.12);
    const e = 1-Math.pow(1-f.t,3), x=f.x0+(f.x1-f.x0)*e, y=f.y0+(f.y1-f.y0)*e - Math.sin(e*Math.PI)*40;
    const s=f.s0+(f.s1-f.s0)*e; drawItem(x,y,s,f.color,false,f.rot*(1-e));
    if(f.t>=1){ flying.splice(i,1); f.done(); }
  }
  // 交付：收好的物件飞向客人
  for(let i=deliverFx.length-1;i>=0;i--){ const d=deliverFx[i], e=(now-d.t0)/450; if(e<0) continue;
    if(e>=1){ deliverFx.splice(i,1); burst(d.x1,d.y1,COLORS[d.c].c); continue; }
    const k=1-Math.pow(1-e,2), x=d.x0+(d.x1-d.x0)*k, y=d.y0+(d.y1-d.y0)*k - Math.sin(e*Math.PI)*60;
    drawItem(x-14,y-14,28*(1-e*.3),d.c,false,e*6); }
  for(let i=floats.length-1;i>=0;i--){ const f=floats[i], e=(now-f.t0)/1400; if(e>=1){ floats.splice(i,1); continue; }
    ctx.globalAlpha=1-e; ctx.font="bold 15px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.lineWidth=4; ctx.strokeStyle="#fff"; ctx.strokeText(f.s,Math.min(W-80,Math.max(80,f.x)),f.y+40-e*30);
    ctx.fillStyle="#c0582a"; ctx.fillText(f.s,Math.min(W-80,Math.max(80,f.x)),f.y+40-e*30); ctx.globalAlpha=1; }
  // 特效粒子
  for(let i=fx.length-1;i>=0;i--){ const p=fx[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=.25; p.life-=.03;
    ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); ctx.globalAlpha=1; if(p.life<=0) fx.splice(i,1); }
  // 最后一击预警：篮将满 → 全屏红脉冲边框（输不再突兀）
  if(slot.length >= slotCap-1){
    const a = .14 + .14*Math.abs(Math.sin(now/170));
    ctx.save(); ctx.strokeStyle=`rgba(217,83,79,${a})`; ctx.lineWidth=12; ctx.strokeRect(6,6,W-12,H-12);
    const vg=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.75); vg.addColorStop(0,"rgba(217,83,79,0)"); vg.addColorStop(1,`rgba(217,83,79,${a*.7})`);
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  if(peekT>0) peekT--;
  requestAnimationFrame(draw);
}

/* ---------- 交互 ---------- */
let busy=false;
cv.addEventListener("pointerdown", e=>{
  if(state!=="play" || busy) return;
  const b=cv.getBoundingClientRect(), x=e.clientX-b.left, y=e.clientY-b.top;
  const cand = tiles.filter(t=>t.alive).sort((a,b)=>b.z-a.z);
  let blocked=null;
  for(const t of cand){
    const r=tileRect(t), rad=r.s*.55;                // 命中半径对齐视觉（贴图 d=1.16s，内容占 88%）
    const dx=x-(r.x+r.s/2), dy=y-(r.y+r.s/2);
    if(dx*dx+dy*dy > rad*rad) continue;
    if(isCovered(t,tiles)){ blocked=t; continue; }   // 被压住：先跳过，同点位可能有看得见、能拿的
    pick(t,r); return;
  }
  if(blocked){ toast("被压住了，先拿上面的"); cat("start"); beep(180,.08,"square",.05); }
});
function pick(t,r){
  if(slot.length + flying.length >= slotCap) return;
  t.alive=false; SFX.pick(); vibrate(8); tickOrders();
  // 同色插到同色后面（抓大鹅式归堆）
  let idx = slot.length; for(let i=slot.length-1;i>=0;i--) if(slot[i].color===t.color){ idx=i+1; break; }
  const target = slotRect(idx);
  busy=true;
  flying.push({x0:r.x,y0:r.y,s0:r.s,x1:target.x+3,y1:target.y+3,s1:target.s-6,color:t.color,rot:t.rot,t:0,done(){
    slot.splice(idx,0,{color:t.color, dx:target.x});
    busy=false; resolve();
  }});
  updateHUD();
}
function resolve(){
  // 三消
  const cnt={}; slot.forEach(s=>cnt[s.color]=(cnt[s.color]||0)+1);
  for(const c in cnt){ if(cnt[c]>=3){
    let removed=0; const rs=[];
    slot = slot.filter((s,i)=>{ if(s.color==c && removed<3){ removed++; rs.push(slotRect(i)); return false; } return true; });
    rs.forEach(r=>burst(r.x+r.s/2,r.y+r.s/2,COLORS[c].c));
    deliver(c, rs);
    combo++; SFX.match(combo); vibrate(20); if(combo>=2) cat("combo");
    if(combo>=2) toast(["","","连消 ×2！","手感火热 ×3！","停不下来 ×4！","织神附体 ×"+combo+"！"][Math.min(combo,5)]);
  }}
  if(!tiles.some(t=>t.alive) && !slot.length){ return setTimeout(win,350); }
  if(slot.length>=slotCap){ return setTimeout(lose,250); }
  const dangerN = slotCap - slot.length;                       // 剩余空格
  if(dangerN<=2){ SFX.warn(); vibrate(30); cat("danger"); }
  if(dangerN===1){ toast("⚠️ 篮只剩 1 格！用「退回」或「抖篮」挪一挪"); shakeT=Math.max(shakeT,.5); }  // 最后一击预警
  if(!Object.values(cnt).some(v=>v>=3)) combo=0;
  updateHUD();
}
let combo=0, slotCap=SLOT_N, slotFlash=0;
function burst(x,y,c){ for(let i=0;i<14;i++){ const a=Math.random()*7, v=2+Math.random()*4; fx.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-3,r:2+Math.random()*3,c,life:1}); } }

/* ---------- 道具 ---------- */
function useTool(k, fn){
  if(state!=="play" || busy) return;
  if(tools[k]>0){ tools[k]--; fn(); }
  else adPrompt("看个短视频，再拿 1 次「"+({shake:"抖篮",back:"退回",peek:"透视"}[k])+"」？", ()=>{ fn(); });
  updateHUD();
}
document.getElementById("tShake").onclick = ()=>useTool("shake", ()=>{
  const live = tiles.filter(t=>t.alive), cols = shuffle(live.map(t=>t.color)); live.forEach((t,i)=>t.color=cols[i]);
  shakeT=1; SFX.shake(); vibrate([30,40,30]); toast("哗啦——整筐抖了一遍！");
});
document.getElementById("tBack").onclick = ()=>useTool("back", ()=>{
  if(!slot.length){ tools.back++; return toast("篮子是空的"); }
  const take = slot.splice(0,Math.min(3,slot.length)); pushBack(tiles, take.map(s=>s.color));
  toast("退回 "+take.length+" 个线团到顶上"); beep(500,.12,"sine",.12,300);
});
document.getElementById("tPeek").onclick = ()=>useTool("peek", ()=>{ peekT=180; toast("透视 3 秒！"); beep(880,.2,"sine",.1,1200); });
document.getElementById("tShop").onclick = ()=>openShop();

function updateHUD(){
  document.getElementById("lvTxt").textContent = "第 "+level+" 关" + (level===2?" · 难":"") + (level===10?" · Boss":"");
  document.getElementById("leftTxt").textContent = "剩 "+tiles.filter(t=>t.alive).length;
  document.getElementById("starTxt").textContent = save.stars;
  const ce=document.getElementById("coinTxt"); if(ce) ce.textContent = save.coins;
  [["tShake","shake"],["tBack","back"],["tPeek","peek"]].forEach(([id,k])=>{ const el=document.getElementById(id); el.classList.toggle("ad",tools[k]<=0); el.querySelector("i").textContent = tools[k]>0?tools[k]:"▶"; });
}
let toastT=0;
function toast(s){ const el=document.getElementById("toast"); el.textContent=s; el.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("on"),1300); }

/* ---------- 道具按钮图标（贴图，来自 ASSETS） ---------- */
(function bindToolIcons(){
  try{
    if(typeof ASSETS === "undefined") return;
    const map = {iShake:"basket", iBack:"arrow", iPeek:"eye", iShop:"house"};
    Object.keys(map).forEach(function(id){
      const el = document.getElementById(id);
      if(el && ASSETS[map[id]]) el.src = ASSETS[map[id]];
    });
  }catch(e){}
})();
