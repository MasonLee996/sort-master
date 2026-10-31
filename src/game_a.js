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
function layout(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  const r = cv.getBoundingClientRect(); W=r.width; H=r.height;
  cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  if(!P) return;
  slotW = Math.min(W-24, 420);
  const slotH = slotW/SLOT_MAX;
  slotY = H - slotH - 14;
  // 筐（场景主体）：顶部留 70px 给黑猫与对白
  const top = 70, bot = slotY - 18;
  cell = Math.min(W - 16, (bot - top) * 1.15);          // 筐的宽度
  ox = (W - cell)/2; oy = top;
  BASKET = {x:ox, y:top, w:cell, h:bot-top};
}
let BASKET = {x:0,y:0,w:1,h:1};
window.addEventListener("resize", layout);

function tileRect(t){
  const s = t.r*2*BASKET.w;
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
// 具体物件：彩色底托 + emoji 物件（按"形状"认，色弱也能玩），带旋转
function drawItem(x,y,s,col,dim,rot){
  const C = COLORS[col], cx=x+s/2, cy=y+s/2, r=s*.5;
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
function drawScene(now){
  const B=BASKET;
  // 木桌
  const tg=ctx.createLinearGradient(0,B.y+B.h*.3,0,H); tg.addColorStop(0,"#c99766"); tg.addColorStop(1,"#a8743f");
  ctx.fillStyle=tg; ctx.fillRect(0,B.y+B.h*.35,W,H);
  ctx.strokeStyle="rgba(90,50,20,.18)"; ctx.lineWidth=2;
  for(let i=0;i<6;i++){ const y=B.y+B.h*.4+i*28; ctx.beginPath(); ctx.moveTo(0,y); ctx.bezierCurveTo(W*.3,y+6,W*.7,y-6,W,y); ctx.stroke(); }
  // 竹筐（椭圆底 + 编织纹 + 前沿）
  const cx=B.x+B.w/2, cy=B.y+B.h*.55, rx=B.w*.52, ry=B.h*.5;
  ctx.fillStyle="#8a5a2c"; ctx.beginPath(); ctx.ellipse(cx,cy+8,rx+6,ry+8,0,0,7); ctx.fill();
  ctx.fillStyle="#d9a866"; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,7); ctx.clip();
  ctx.strokeStyle="rgba(120,75,30,.35)"; ctx.lineWidth=3;
  for(let i=-12;i<=12;i++){ ctx.beginPath(); ctx.moveTo(cx+i*18,cy-ry); ctx.lineTo(cx+i*18+30,cy+ry); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx+i*18,cy-ry); ctx.lineTo(cx+i*18-30,cy+ry); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle="#7a4c22"; ctx.lineWidth=7; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,7); ctx.stroke();
}
function drawCat(now){
  const x=W-62, y=8+Math.sin(now/400)*2, s=1;
  ctx.save(); ctx.translate(x,y);
  if(catMood==="lose"||catMood==="danger"){ ctx.translate(0,Math.sin(now/60)*2); }
  ctx.fillStyle="#2b2320";
  ctx.beginPath(); ctx.ellipse(30,40,22,18,0,0,7); ctx.fill();               // 身体
  ctx.beginPath(); ctx.arc(30,22,15,0,7); ctx.fill();                          // 头
  ctx.beginPath(); ctx.moveTo(17,14); ctx.lineTo(19,0); ctx.lineTo(27,10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(43,14); ctx.lineTo(41,0); ctx.lineTo(33,10); ctx.fill();
  ctx.strokeStyle="#2b2320"; ctx.lineWidth=5; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(50,46); ctx.quadraticCurveTo(66,40+Math.sin(now/200)*8,60,22); ctx.stroke();
  // 眼睛：得意眯眼 / 惊讶圆眼
  ctx.fillStyle="#f6d34a";
  if(catMood==="win"||catMood==="combo"){ ctx.beginPath(); ctx.arc(24,21,4.5,0,7); ctx.arc(36,21,4.5,0,7); ctx.fill(); ctx.fillStyle="#000"; ctx.beginPath(); ctx.arc(24,21,2,0,7); ctx.arc(36,21,2,0,7); ctx.fill(); }
  else { ctx.strokeStyle="#f6d34a"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(24,23,4,Math.PI*1.1,Math.PI*1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(36,23,4,Math.PI*1.1,Math.PI*1.9); ctx.stroke(); }
  ctx.restore();
  // 对白气泡
  if(catSay && now < catSayUntil){
    ctx.font="bold 14px sans-serif"; const tw=ctx.measureText(catSay).width+20;
    const bx=Math.max(8,x-tw-4), by=14;
    ctx.fillStyle="#fff"; roundRect(bx,by,tw,30,14); ctx.fill(); ctx.strokeStyle="#2b2320"; ctx.lineWidth=2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx+tw-2,by+12); ctx.lineTo(bx+tw+10,by+18); ctx.lineTo(bx+tw-2,by+22); ctx.fillStyle="#fff"; ctx.fill();
    ctx.fillStyle="#2b2320"; ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.fillText(catSay,bx+10,by+15);
  }
  // 关卡标题（左上）
  ctx.fillStyle="#6b4428"; ctx.font="bold 15px sans-serif"; ctx.textAlign="left"; ctx.textBaseline="top";
  ctx.fillText("📜 "+TALES[(level-1)%TALES.length].t, 10, 16);
}
let catMood="start", catSay="", catSayUntil=0;
function cat(mood){ catMood=mood; const L=CAT_LINES[mood]; catSay=L[Math.floor(Math.random()*L.length)]; catSayUntil=performance.now()+2200; }
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function lighten(hex,a){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255; r=r+(255-r)*a|0; g=g+(255-g)*a|0; b=b+(255-b)*a|0; return `rgb(${r},${g},${b})`; }
