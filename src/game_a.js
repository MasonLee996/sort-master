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
  const top = CRATE.y + chh*0.10, bot = CRATE.y + chh*0.78;
  cell = cw*0.80; ox = CRATE.x + cw*0.10; oy = top;
  BASKET = {x:ox, y:top, w:cell, h:bot-top};
}
let BASKET = {x:0,y:0,w:1,h:1}, CRATE = {x:0,y:0,w:1,h:1};
const CRATE_AR = 339/560, CRATE_FRONT = 0.70;   // 贴图宽高比；前沿(前筐边+前壁)从贴图 70% 高处开始
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
  if(!cover(SPRITES.table, 0, top, W, H-top)){ ctx.fillStyle="#8a5a30"; ctx.fillRect(0,top,W,H-top); }
  const dg=ctx.createLinearGradient(0,top,0,H);
  dg.addColorStop(0,"rgba(40,20,6,.55)"); dg.addColorStop(1,"rgba(30,14,4,.6)");
  ctx.fillStyle=dg; ctx.fillRect(0,top,W,H-top);
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
