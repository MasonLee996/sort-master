/* 真机运行时错误可见化：任何未捕获异常 / Promise 失败都显示在屏幕底部红条，便于定位（正常时不可见） */
(function(){
  function s(e){ try{ var d=document.getElementById('err'); if(d){ d.style.display='block'; d.textContent += '\n'+(e&&e.stack?e.stack.split('\n').slice(0,6).join('\n'):String(e)); } }catch(_){} }
  window.onerror = function(m,f,l,c,e){ s(e||(m+' @'+(l||'?')+':'+(c||'?'))); return false; };
  window.addEventListener('unhandledrejection', function(ev){ s('PROMISE '+(ev.reason&&ev.reason.message||ev.reason)); });
})();
/* ====== 渲染 & 交互 ====== */
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
let W=0, H=0, DPR=1, cell=0, ox=0, oy=0, slotY=0, slotW=0;
let tiles=[], P=null, slot=[], flying=[], fx=[], state="play", peekT=0, shakeT=0;
let tools={shake:1, back:1, peek:1}, revived=false, level=save.level;

/* ---------- 音效（WebAudio 合成） ---------- */
let AC=null;
function beep(f, d, type, vol, slide){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(), g=AC.createGain(), t=AC.currentTime;
    o.type=type||"sine"; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(slide, t+d);
    g.gain.setValueAtTime(vol||.15,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t+d);
  }catch(e){}
}
const SFX = {
  pick(){ beep(520,.08,"triangle",.12,780); },
  match(n){ beep(660+n*40,.12,"sine",.18); setTimeout(()=>beep(990+n*40,.18,"sine",.15),70); },
  warn(){ beep(140,.18,"square",.06); },
  lose(){ beep(400,.5,"sawtooth",.08,120); },
  win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.22,"triangle",.16),i*110)); },
  shake(){ beep(200,.3,"sawtooth",.05,600); }
};
function vibrate(ms){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

/* ---------- 布局 ---------- */
function showErr(e){ try{ var d=document.getElementById('err'); if(d){ d.style.display='block'; d.textContent += '\n'+(e&&e.stack?e.stack.split('\n').slice(0,6).join('\n'):String(e)); } }catch(_){} }
function layout(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  const r = cv.getBoundingClientRect();
  W = r.width || window.innerWidth || 360;
  // 确定性高度：直接用「视口高 − 上下固定栏高」计算，并强制写回 cv.style.height。
  // 不依赖 CSS flex/100% 在移动端 WebView 偶发塌缩（canvas 会退回内在默认 150px 高度，
  // 导致 getBoundingClientRect().height 返回 150 而非 0，普通兜底 if(H<2) 漏判 → 画面大片空白）。
  const topEl=document.querySelector('.top'), barEl=document.querySelector('.bar');
  const oh=(topEl?topEl.offsetHeight:0)+(barEl?barEl.offsetHeight:0);
  H = Math.max(160, (window.innerHeight||document.documentElement.clientHeight||640) - oh);
  try{ cv.style.width='100%'; cv.style.height=H+'px'; }catch(e){}
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0);
  if(!P) return;
  slotW = Math.min(W-24, 420);
  const slotH = slotW/SLOT_MAX;
  slotY = H - slotH - 12;
  // 柜台线：屏高 40%（效果图中立绘+柜台占上 1/3 强）
  COUNTER_H = Math.max(230, Math.min(330, Math.round(H*0.40)));
  // 藤筐容器：宽度略超屏、底贴搁板，筐顶后沿塞到柜台前脸下面（柜台后画，自然压住）
  const cw = W*1.06, chh = cw*CRATE_AR, cbot = slotY - 10;
  CRATE = {x:(W-cw)/2, y:cbot-chh, w:cw, h:chh};
  // 物件区 = 筐内底（贴图里内腔约 x 10%~90%、y 10%~78%）
  // ⚠ 物件区下边界必须收在筐前沿之上：前沿是实心木墙，被它盖住的物件玩家
  //   完全看不见也点不到（等于凭空消失）。前沿 70% 会吃掉 11.8% 的物件区高度，
  //   这里让物件区止于 76%，与前沿上沿齐平，物件不再被藏。
  const top = CRATE.y + chh*0.10, bot = CRATE.y + chh*0.755;
  cell = cw*0.80; ox = CRATE.x + cw*0.10; oy = top;
  BASKET = {x:ox, y:top, w:cell, h:bot-top};
}
let BASKET = {x:0,y:0,w:1,h:1}, CRATE = {x:0,y:0,w:1,h:1};
const CRATE_AR = 339/560, CRATE_FRONT = 0.755;   // 贴图宽高比；前沿(前筐边+前壁)从贴图 75.5% 高处开始
window.addEventListener("resize", layout);
if(window.visualViewport) window.visualViewport.addEventListener("resize", layout);
window.addEventListener("orientationchange", function(){ setTimeout(layout, 250); });

function tileRect(t){
  const s = t.r*2*BASKET.w*1.3;                     // 物件区收进筐内后放大补偿
  return {x:BASKET.x + t.x*BASKET.w - s/2, y:BASKET.y + t.y*BASKET.h - s/2 - t.z*2.5, s};
}
function slotRect(i){ const s=slotW/SLOT_MAX; return {x:(W-slotW)/2 + i*s, y:slotY, s}; }

/* ---------- 绘制线团 ---------- */
function drawYarn(x,y,s,col,dim,alpha){
  const C = COLORS[col], r = s*.42, cx=x+s/2, cy=y+s/2;
  ctx.save(); ctx.globalAlpha = alpha==null?1:alpha;
  // 底座方块（像抓大鹅的"格子物件"）
  ctx.fillStyle = dim ? "#cdbba4" : "#fff6e8";
  roundRect(x+s*.04,y+s*.04,s*.92,s*.92,s*.2); ctx.fill();
  ctx.strokeStyle = dim ? "#b09a80" : "#e0c7a6"; ctx.lineWidth=2; ctx.stroke();
  // 线团
  const g = ctx.createRadialGradient(cx-r*.35,cy-r*.35,r*.1,cx,cy,r);
  g.addColorStop(0, lighten(C.c,.35)); g.addColorStop(1, C.d);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = Math.max(1,s*.035);
  for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.ellipse(cx,cy,r*.95,r*(.3+Math.abs(k)*.12),k*.5,0,Math.PI); ctx.stroke(); }
  if(dim){ ctx.fillStyle="rgba(70,50,35,.45)"; roundRect(x+s*.04,y+s*.04,s*.92,s*.92,s*.2); ctx.fill(); }
  ctx.restore();
}
/* ---------- 贴图：build.py 把 src/assets/*.png 内联成 ASSETS ---------- */
const SPRITES = {};
(function loadSprites(){
  try{
    if(typeof ASSETS === "undefined" || typeof Image === "undefined") return;
    Object.keys(ASSETS).forEach(function(k){
      const im = new Image();
      im.onload = function(){ SPRITES[k] = im; };
      im.src = ASSETS[k];
    });
  }catch(e){}
})();

/* ---------- 点击命中掩膜：按贴图「真实不透明像素」判定，不再用圆圈猜 ----------
   问题：原命中判定是半径 0.55*s 的圆，但画面上是形状不规则、四周带透明边的贴图
   （剪刀不透明度仅 11%）。圆圈必然罩住旁边的物件 → 点 A 却拿走 B；
   反过来贴图边缘的可见像素又落在圆外 → 点了没反应。
   这里为每个物件贴图预生成二值掩膜（64x64，alpha>40 为实体），
   点击时把屏幕坐标反算回贴图局部坐标做查表，做到「点到哪就是哪」。
   a=精确档；aLoose=外扩 1 格（≈2px）的宽容档，只在精确档全不中时兜底，
   避免手指按偏；同时外扩不会造成「点缝隙却拿到别的物件」。 */
const MASK = {};          // key -> {w,h,a,aLoose}
const MASK_N = 64, MASK_ALPHA_TH = 40;
function buildMask(k){
  try{
    if(MASK[k]) return MASK[k];
    const sp = SPRITES[k];
    if(!sp || !sp.width) return null;              // 贴图未就绪：稍后重试
    const c = document.createElement("canvas");
    c.width = MASK_N; c.height = MASK_N;
    const g2 = c.getContext("2d");
    g2.drawImage(sp, 0, 0, MASK_N, MASK_N);
    const d = g2.getImageData(0, 0, MASK_N, MASK_N).data;
    const a = new Uint8Array(MASK_N*MASK_N);
    for(let i=0, j=3; i<a.length; i++, j+=4) a[i] = d[j] > MASK_ALPHA_TH ? 1 : 0;
    // 宽容档：3x3 最大值滤波（外扩 1 格）
    const lo = new Uint8Array(MASK_N*MASK_N);
    for(let y=0;y<MASK_N;y++) for(let x=0;x<MASK_N;x++){
      let m = 0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=MASK_N||ny>=MASK_N) continue;
        if(a[ny*MASK_N+nx]) m = 1;
      }
      lo[y*MASK_N+x] = m;
    }
    MASK[k] = {w:MASK_N, h:MASK_N, a, aLoose:lo};
    return MASK[k];
  }catch(e){ return null; }
}
/* 屏幕点是否落在该物件贴图的实体像素上（考虑旋转 rot 与缩放 d）
   loose=false 精确档；loose=true 宽容档（外扩约 2px） */
function hitMask(key, px, py, cx, cy, d, rot, loose){
  const m = buildMask(key);
  if(!m) return false;
  const dx = px-cx, dy = py-cy;
  const cs = Math.cos(-rot), sn = Math.sin(-rot);
  const lx = dx*cs - dy*sn, ly = dx*sn + dy*cs;
  const u = lx/d + 0.5, v = ly/d + 0.5;
  if(u<0 || u>=1 || v<0 || v>=1) return false;
  const arr = loose ? m.aLoose : m.a;
  return arr[((v*m.h)|0)*m.w + ((u*m.w)|0)] === 1;
}
/* 筐前沿（前筐边+前壁）画在物件之后，会遮住筐底部的物件。
   点在筐沿实体上不该穿透去拿被挡住的物件 —— 但筐是镂空藤编，
   缝隙处物件是透出来的，那里必须能点。
   ⚠ 不能用缩放到 64x64 的掩膜：筐图是 560x339 非等比，缩放后 y 方向
   采样点与实际绘制不对齐，会把「缝里露出来的物件」误判成被挡住
   （实测第10关 id2 可见度 0.78 却点不到）。这里按源图像素精确采样。 */
const CRATE_PIX = {};                       // key -> {w,h,data:Uint8Array(alpha)}
function crateAlpha(k){
  try{
    if(CRATE_PIX[k]) return CRATE_PIX[k];
    const sp = SPRITES[k];
    if(!sp || !sp.width) return null;
    const c = document.createElement("canvas");
    c.width = sp.width; c.height = sp.height;
    const g2 = c.getContext("2d");
    g2.drawImage(sp, 0, 0);
    const d = g2.getImageData(0, 0, sp.width, sp.height).data;
    const a = new Uint8Array(sp.width*sp.height);
    for(let i=0, j=3; i<a.length; i++, j+=4) a[i] = d[j];
    CRATE_PIX[k] = {w:sp.width, h:sp.height, a};
    return CRATE_PIX[k];
  }catch(e){ return null; }
}
function crateFrontHit(px, py){
  const C = CRATE, sp = SPRITES.crate;
  if(!sp || !sp.width || C.w < 2) return false;
  const p = crateAlpha("crate");
  if(!p) return false;
  // 与 drawBasketFront 完全一致：源图下 (1-CRATE_FRONT) 段 -> 筐下同比例段
  const u = (px - C.x)/C.w;
  const v = (py - (C.y + C.h*CRATE_FRONT))/(C.h*(1-CRATE_FRONT));
  if(u<0 || u>=1 || v<0 || v>=1) return false;
  const sx = Math.min(p.w-1, (u*p.w)|0);
  const sy = Math.min(p.h-1, ((CRATE_FRONT + v*(1-CRATE_FRONT))*p.h)|0);
  return p.a[sy*p.w + sx] > MASK_ALPHA_TH;
}

/* 找出真正压住 t 的物件（z 更高，且贴图像素上确实盖住它）——
   用来明确告诉玩家「先拿哪一个」，而不是笼统一句「先拿上面的」。 */
function findBlocker(t, list){
  const key = ITEM_KEYS[t.color];
  const m = buildMask(key);
  if(!m) return null;
  const r = tileRect(t), d = r.s*1.16, cx = r.x+r.s/2, cy = r.y+r.s/2, rot = t.rot||0;
  let best = null;
  for(const o of list){
    if(o===t || !o.alive || !drawnAbove(o,t)) continue;
    const ro = tileRect(o), od = ro.s*1.16;
    const ocx = ro.x+ro.s/2, ocy = ro.y+ro.s/2, orot = o.rot||0;
    let hit = false;
    for(let py=0; py<MASK_N && !hit; py+=2) for(let px=0; px<MASK_N && !hit; px+=2){
      if(!m.a[py*MASK_N+px]) continue;
      const u = (px+0.5)/MASK_N - 0.5, v = (py+0.5)/MASK_N - 0.5;
      const lx = u*d, ly = v*d, cs = Math.cos(rot), sn = Math.sin(rot);
      const wx = cx + lx*cs - ly*sn, wy = cy + lx*sn + ly*cs;
      if(hitMask(ITEM_KEYS[o.color], wx, wy, ocx, ocy, od, orot)) hit = true;
    }
    if(hit && (!best || drawnAbove(o, best))) best = o;
  }
  return best;
}
/* 该点是否被「更上层」的物件盖住 —— 像素级判定：
   玩家点的是一个具体像素，只有这个像素被压住才算「点不到」；
   物件别处被压住，不该妨碍玩家拿它露在外面的部分。 */
function pointCovered(t, list, px, py){
  const r = tileRect(t);
  const cx = r.x+r.s/2, cy = r.y+r.s/2;
  for(const o of list){
    if(o===t || !o.alive) continue;
    // 绘制顺序：z 升序 → y 升序，只有画在 t 之后的才真正盖住 t
    if(!drawnAbove(o,t)) continue;
    const ro = tileRect(o);
    if(hitMask(ITEM_KEYS[o.color], px, py, ro.x+ro.s/2, ro.y+ro.s/2, ro.s*1.16, o.rot||0))
      return o;
  }
  return null;
}
/* 该物件是否还有露在外面的实体像素（没被更上层的物件盖住）。
   与点击判定同源：visiblePoint=false 的物件，玩家在它身上点不到任何位置。
   ⚠ 每帧对每个物件做 O(n²) 采样会掉帧 —— 结果按「当前活着的物件集合」缓存，
   只在有物件被拿走时重算（VIS_KEY = 存活数+位置指纹）。 */
let VIS_CACHE = new Map(), VIS_KEY = "";
function visCacheKey(list){ return list.length + "|" + list.map(t=>t.id).join(","); }
function visiblePoint(t, list){
  const m = buildMask(ITEM_KEYS[t.color]);
  if(!m) return true;                          // 掩膜不可用时不压暗
  const key = visCacheKey(list);
  if(key !== VIS_KEY){ VIS_CACHE = new Map(); VIS_KEY = key; }
  const ck = t.id + "|" + key;
  if(VIS_CACHE.has(ck)) return VIS_CACHE.get(ck);
  const r = tileRect(t), d = r.s*1.16, cx = r.x+r.s/2, cy = r.y+r.s/2, rot = t.rot||0;
  let res = false;
  for(let py=0; py<MASK_N && !res; py+=2) for(let px=0; px<MASK_N && !res; px+=2){
    if(!m.a[py*MASK_N+px]) continue;
    const u = (px+0.5)/MASK_N - 0.5, v = (py+0.5)/MASK_N - 0.5;
    const lx = u*d, ly = v*d, cs = Math.cos(rot), sn = Math.sin(rot);
    const wx = cx + lx*cs - ly*sn, wy = cy + lx*sn + ly*cs;
    let covered = false;
    for(const o of list){
      if(o===t || !o.alive || !drawnAbove(o,t)) continue;
      const ro = tileRect(o);
      if(hitMask(ITEM_KEYS[o.color], wx, wy, ro.x+ro.s/2, ro.y+ro.s/2, ro.s*1.16, o.rot||0)){ covered=true; break; }
    }
    if(!covered) res = true;                   // 找到一个露在外面的点
  }
  VIS_CACHE.set(ck, res);
  return res;
}
/* 客人想要物件的「贴合金光」：把物件贴图剪影染成金色，与物件同形 —— 不再画浮空圆环 */
const GOLD = {};
function goldSprite(col){
  try{
    const k = ITEM_KEYS[col];
    if(GOLD[k]) return GOLD[k];
    const sp = SPRITES[k];
    if(!sp || !sp.width) return null;               // 贴图未就绪：不缓存，之后还能再试
    const c = document.createElement("canvas");
    c.width = sp.width; c.height = sp.height;
    const g2 = c.getContext("2d");
    g2.drawImage(sp, 0, 0);
    g2.globalCompositeOperation = "source-in";      // 只保留剪影，整体染金
    g2.fillStyle = "#ffd668";
    g2.fillRect(0, 0, c.width, c.height);
    GOLD[k] = c;
    return c;
  }catch(e){ return null; }
}

const DARK = {};
function darkSprite(col){
  try{
    const k = ITEM_KEYS[col]; if(DARK[k]) return DARK[k];
    const sp = SPRITES[k]; if(!sp || !sp.width) return null;
    const c = document.createElement("canvas"); c.width = sp.width; c.height = sp.height;
    const g2 = c.getContext("2d"); g2.drawImage(sp,0,0);
    g2.globalCompositeOperation = "source-atop"; g2.fillStyle = "rgba(45,24,10,.5)"; g2.fillRect(0,0,c.width,c.height);
    DARK[k] = c; return c;
  }catch(e){ return null; }
}
// 具体物件：优先用实物贴图（assets），加载失败/未就绪时回退到 emoji 底托
function drawItem(x,y,s,col,dim,rot){
  const C = COLORS[col], cx=x+s/2, cy=y+s/2, r=s*.5;
  const sp = SPRITES[ITEM_KEYS[col]];
  if(sp){
    const d = s*1.16;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot||0);
    if(dim){
      const ds = darkSprite(col) || sp;               // 被压：同形压暗，不再盖圆片
      ctx.drawImage(ds, -d/2, -d/2, d, d);
    } else {
      ctx.drawImage(sp, -d/2, -d/2, d, d);
    }
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot||0);
  ctx.fillStyle="rgba(60,35,15,.28)"; ctx.beginPath(); ctx.ellipse(r*.08,r*.16,r*.98,r*.9,0,0,7); ctx.fill();
  const g = ctx.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r);
  g.addColorStop(0, lighten(C.c,.55)); g.addColorStop(1, C.c);
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r*.96,0,7); ctx.fill();
  ctx.strokeStyle=C.d; ctx.lineWidth=Math.max(1.5,s*.05); ctx.stroke();
  ctx.font = `${Math.round(s*.62)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(ITEMS[col], 0, s*.04);
  if(dim){ ctx.fillStyle="rgba(55,35,20,.55)"; ctx.beginPath(); ctx.arc(0,0,r*.98,0,7); ctx.fill(); }
  ctx.restore();
}
// 场景：木桌 + 竹筐 + 黑猫
function cover(img, x, y, w, h){
  if(!img || !img.width) return false;
  const iw=img.width, ih=img.height, s=Math.max(w/iw, h/ih), dw=iw*s, dh=ih*s;
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();      // 必须裁切：否则贴图溢出到相邻区域（墙纹漏到筐区）
  ctx.drawImage(img, x+(w-dw)/2, y+(h-dh)/2, dw, dh);
  ctx.restore();
  return true;
}
function drawScene(now){
  const top=COUNTER_H;
  // ⚠ 桌子纹理只铺到筐底为止：512x512 的方图 cover 拉伸铺满整个下半屏时，
  //   底部木纹被纵向拉成条纹，在筐与线篮栏之间露出一片乱纹（看着像漏出的碎屑）。
  //   筐以下本就是柜体，用深色填充更干净。
  const tableBot = Math.min(H, CRATE.y + CRATE.h);
  if(!cover(SPRITES.table, 0, top, W, tableBot-top)){ ctx.fillStyle="#8a5a30"; ctx.fillRect(0,top,W,tableBot-top); }
  const dg=ctx.createLinearGradient(0,top,0,tableBot);
  dg.addColorStop(0,"rgba(40,20,6,.55)"); dg.addColorStop(1,"rgba(30,14,4,.6)");
  ctx.fillStyle=dg; ctx.fillRect(0,top,W,tableBot-top);
  // 筐以下：深色柜体
  if(tableBot < H){
    ctx.fillStyle="#2a1508"; ctx.fillRect(0,tableBot,W,H-tableBot);
    const cg=ctx.createLinearGradient(0,tableBot,0,H);
    cg.addColorStop(0,"rgba(20,8,2,.75)"); cg.addColorStop(1,"rgba(18,7,3,.9)");
    ctx.fillStyle=cg; ctx.fillRect(0,tableBot,W,H-tableBot);
  }
  const C=CRATE, sp=SPRITES.crate;
  ctx.fillStyle="rgba(20,8,2,.45)";                              // 筐底投影
  ctx.beginPath(); ctx.ellipse(C.x+C.w/2, C.y+C.h*.97, C.w*.42, 10, 0, 0, 7); ctx.fill();
  if(sp){ ctx.drawImage(sp, C.x, C.y, C.w, C.h); return; }
  // 回退：矢量筐
  ctx.fillStyle="#6b4420"; roundRect(C.x+C.w*.04, C.y, C.w*.92, C.h, 24); ctx.fill();
  ctx.fillStyle="#4a2c12"; roundRect(C.x+C.w*.12, C.y+C.h*.1, C.w*.76, C.h*.62, 16); ctx.fill();
}
/* 筐前沿（前筐边+前壁）：画在物件之后，物件"坐进"筐里 */
function drawBasketFront(){
  const C=CRATE, sp=SPRITES.crate;
  if(sp){
    const sy=sp.height*CRATE_FRONT;
    ctx.drawImage(sp, 0, sy, sp.width, sp.height-sy, C.x, C.y+C.h*CRATE_FRONT, C.w, C.h*(1-CRATE_FRONT));
  } else {
    ctx.fillStyle="#a8713c"; roundRect(C.x+C.w*.04, C.y+C.h*CRATE_FRONT, C.w*.92, C.h*(1-CRATE_FRONT), 18); ctx.fill();
  }
}
function drawCat(now){
  // 黑猫蹲在柜台右侧（贴图立绘，底部沉入台面；回退矢量猫）
  const bob = Math.sin(now/400)*2, shiver = (catMood==="lose"||catMood==="danger") ? Math.sin(now/60)*2 : 0;
  const ch = Math.max(64, COUNTER_H*0.42), cw = ch*0.8;
  const cx = W - cw*0.62, by = COUNTER_H + 14;
  const sp = SPRITES.cat;
  ctx.save(); ctx.translate(0, bob + shiver);
  if(sp){
    ctx.drawImage(sp, cx-cw/2, by-ch, cw, ch);
  } else {
    ctx.save(); ctx.translate(cx-33, by-58); ctx.scale(cw/66, ch/58);
    const cg=ctx.createLinearGradient(0,0,0,46); cg.addColorStop(0,"#3a2f2a"); cg.addColorStop(1,"#1e1714");
    ctx.fillStyle=cg;
    ctx.beginPath(); ctx.ellipse(30,40,22,18,0,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(30,22,15,0,7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(17,14); ctx.lineTo(19,0); ctx.lineTo(27,10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(43,14); ctx.lineTo(41,0); ctx.lineTo(33,10); ctx.fill();
    ctx.strokeStyle="#2b2320"; ctx.lineWidth=5; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(50,46); ctx.quadraticCurveTo(66,40,60,22); ctx.stroke();
    ctx.fillStyle="#f6d34a";
    if(catMood==="win"||catMood==="combo"){ ctx.beginPath(); ctx.arc(24,21,4.5,0,7); ctx.arc(36,21,4.5,0,7); ctx.fill(); ctx.fillStyle="#000"; ctx.beginPath(); ctx.arc(24,21,2,0,7); ctx.arc(36,21,2,0,7); ctx.fill(); }
    else { ctx.strokeStyle="#f6d34a"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(24,23,4,Math.PI*1.1,Math.PI*1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(36,23,4,Math.PI*1.1,Math.PI*1.9); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
  // 对白气泡
  if(catSay && now < catSayUntil){
    ctx.font="bold 14px sans-serif"; const tw=ctx.measureText(catSay).width+20;
    const bx=Math.max(8,W-tw-8), by2=Math.max(4, by-ch-32);
    ctx.fillStyle="#fff"; roundRect(bx,by2,tw,30,14); ctx.fill(); ctx.strokeStyle="#2b2320"; ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W-44,by2+2); ctx.lineTo(W-36,by2-8); ctx.lineTo(W-28,by2+2); ctx.fillStyle="#fff"; ctx.fill();
    ctx.fillStyle="#2b2320"; ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText(catSay,bx+10,by2+15);
  }
}
let catMood="start", catSay="", catSayUntil=0;
function cat(mood){ catMood=mood; const L=CAT_LINES[mood]; catSay=L[Math.floor(Math.random()*L.length)]; catSayUntil=performance.now()+2200; }
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function lighten(hex,a){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255; r=r+(255-r)*a|0; g=g+(255-g)*a|0; b=b+(255-b)*a|0; return `rgb(${r},${g},${b})`; }
