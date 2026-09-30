
"use strict";
/* ============================================================
   收纳大师 Sort Puzzle —— 纯AI生成 · 零美术依赖 · 程序化关卡
   逻辑可直接平移至 Cocos Creator / 微信小游戏
   ============================================================ */

const CAP = 4;                 // 每管容量
const TUBE_ADD_MAX = 3;        // 单关最多可通过广告加管次数(死局出口，防无限加管破坏体验与步数基准)
const MAX_ADD_TUBES = 3;       // 死局加管次数上限(防无限制加管破坏步数基准)
const PALETTE = ["#ff5b6e","#3b7bff","#16c784","#ffb020","#a259ff",
                 "#00c2c7","#ff7a45","#7c8cff","#e84393","#2dce89"];

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const stage = document.getElementById("stage");

let DPR = 1, W = 0, H = 0;
let tubes = [];               // 每管 = 颜色索引数组(底->顶)
let tubeRects = [];           // 绘制矩形(逻辑坐标)
let selected = -1;
let hintTarget = -1;   // 提示态：建议倒入的目标管索引(-1=无)，与 selected(源管) 配合高亮
let hintPair = null;   // 提示态：[源管, 目标管]，非 null 即提示进行中
let level = 1, moves = 0, coins = 0;
let bestStars = {};           // level->stars
let moveLimit = 0;            // 0=无限
let history = [];             // 撤销栈
let usedUndo = false, usedHint = false; // 本关是否用过撤销/提示(影响评级)
let tubesAdded = 0;                     // 本关通过广告加管次数(上限 TUBE_ADD_MAX，同样影响三星评级)
let noAds = false;
let muted = false;
let sawHelp = false;   // 是否已看过过关说明(首次进入自动弹一次)
// 每日签到(连续签到, localStorage 持久化)
let loginDate = "";        // 上次登录日期(本地 YYYY-M-D)
let signStreak = 0;        // 连续签到天数(1..7 循环)
let signClaimedDate = "";  // 已领取奖励的日期
let pendingSign = false;   // 今日是否待领取
let todayReward = 0;       // 今日签到奖励额
const SIGN_REWARDS = [0,20,25,30,40,50,60,100]; // 第 1..7 天奖励(超 7 循环回 1)
let anim = null;        // 倒球动画状态 {from,to,color,cnt,t,dur,last}
let animating = false;  // 动画期间锁定输入，保证可回滚且不串状态
let RAIL_PAD = 48;      // 左右活动入口侧栏占位宽度(0=不占位，供后续收起功能使用)
// 每日谜题(按日期定种子，全服同一题面)
let mode = "normal";       // 当前模式："normal"=线性闯关 / "daily"=每日谜题
let dailyDate = "";        // 当前正在玩的每日题面日期
let dailyDoneDate = "";    // 每日谜题已通关的日期(每天只发一次首通奖励)
let dailyMoves = 0;        // 每日谜题首通步数
// 分享(GitHub Pages 托管)
let shareClaimedDate = ""; // 每日首次分享奖励的领取日期
const SHARE_BONUS = 30;                                              // 每日首次分享奖励金币
const GH_PAGES_URL = "https://masonlee996.github.io/sort-master/";   // 线上地址(file:// 或本地预览时使用)

/* ---------- 存档 ---------- */
const SAVE_KEY = "sort_ai_save_v1";
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    level = s.level || 1; coins = s.coins || 0;
    bestStars = s.bestStars || {}; noAds = !!s.noAds; muted = !!s.muted; sawHelp = !!s.sawHelp;
    loginDate = s.loginDate||""; signStreak = s.signStreak||0; signClaimedDate = s.signClaimedDate||"";
    dailyDoneDate = s.dailyDoneDate||""; dailyMoves = s.dailyMoves||0;
    shareClaimedDate = s.shareClaimedDate||"";
  }catch(e){}
}
function save(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify({level,coins,bestStars,noAds,muted,sawHelp,loginDate,signStreak,signClaimedDate,dailyDoneDate,dailyMoves,shareClaimedDate})); }catch(e){}
}

/* ---------- 每日签到(连续签到, 7 天阶梯) ---------- */
function dateStr(d){ d=d||new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function parseDate(s){ const p=(""+s).split("-"); return new Date(+p[0], (+p[1]||1)-1, +p[2]||1); }
function dayDiff(a,b){ return Math.round((parseDate(b)-parseDate(a))/86400000); }
function detectSign(){
  const today = dateStr();
  if(signClaimedDate === today) return;                 // 今天已领
  if(loginDate === today){ pendingSign = true; todayReward = SIGN_REWARDS[Math.min(signStreak,7)]; return; }
  const gap = loginDate ? dayDiff(loginDate, today) : 999;
  signStreak = (gap===1) ? (signStreak>=7?1:signStreak+1) : 1; // 连续+1(第7后循环)；断签/首次=1
  todayReward = SIGN_REWARDS[Math.min(signStreak,7)];
  pendingSign = true; loginDate = today; save();
}
function closeSign(){ document.getElementById("signOverlay").style.display = "none"; }
// 按钮随领取态切换：未领=「领取」主按钮，已领=「关闭」次级按钮 —— 保证任何状态都能关掉弹窗
function syncSignBtn(){
  const claimed = (signClaimedDate === dateStr());
  const btn = document.getElementById("btnSignClaim");
  if(btn){
    btn.textContent = claimed ? "关闭" : "领取";
    btn.className = claimed ? "act" : "act primary";
  }
}
function showSign(){
  document.getElementById("signStreak").textContent = signStreak;
  document.getElementById("signReward").textContent = "+"+todayReward;
  const claimed = (signClaimedDate === dateStr());
  const grid = document.getElementById("signGrid");
  if(grid){
    grid.textContent = "";
    for(let d=1; d<=7; d++){
      const c = document.createElement("div");
      c.style.cssText = "border-radius:8px;padding:6px 0;font-size:11px;text-align:center;line-height:1.4;white-space:pre-line;";
      c.textContent = "第"+d+"天\n+"+SIGN_REWARDS[d];
      if(d < signStreak || (d===signStreak && claimed)) c.style.background="rgba(22,199,132,.18)";
      else if(d===signStreak && pendingSign) c.style.background="rgba(59,123,255,.20)";
      else c.style.background="#eef1f6";
      grid.appendChild(c);
    }
  }
  syncSignBtn();
  document.getElementById("signOverlay").style.display = "flex";
}
function claimSign(){
  if(!pendingSign){ closeSign(); return; }   // 已领取：此时按钮是「关闭」
  coins += todayReward; save();
  signClaimedDate = dateStr(); pendingSign = false; save();
  closeSign(); syncSignBtn();
  refreshRail();
  render(); toast("签到 +"+todayReward+" 金币");
}

/* ---------- 每日谜题：入口弹窗 + 进入/退出 ---------- */
const DAILY_FIRST_BONUS = 60; // 每日首通额外金币
function showDaily(){
  const ds = dateStr();
  const done = (dailyDoneDate === ds);
  const c = dailyColors(ds);
  document.getElementById("dailyDate").textContent = "题面日期：" + ds + "（全服同一关）";
  document.getElementById("dailyInfo").textContent = "今日题面：" + c + " 色 " + (c + 2) + " 管 · 不限步";
  document.getElementById("dailyStatus").textContent = done
    ? ("✅ 今日已通关（" + dailyMoves + " 步）· 首通奖励已领取，明天再来")
    : ("首次通关奖励 +" + DAILY_FIRST_BONUS + " 金币 · 每天 0 点换题");
  document.getElementById("btnDailyStart").textContent = done ? "再玩一次" : "开始挑战";
  // 已在每日模式时才显示"退出"入口，避免误导
  document.getElementById("dailyExitRow").style.display = (mode==="daily") ? "flex" : "none";
  document.getElementById("dailyOverlay").style.display = "flex";
}
function startDaily(){
  const ds = dateStr();
  dailyDate = ds;
  mode = "daily";
  const my = ++genToken;
  showGenMask("每日谜题 " + ds);
  setTimeout(()=>{
    if(my !== genToken) return;
    tubes = genDaily(ds);
    clearHint(true);
    selected=-1; moves=0; history=[];
    usedUndo=false; usedHint=false; tubesAdded=0;
    moveLimit = 0;                 // 每日谜题不限步：鼓励反复尝试与分享
    hideDeadlock(); hideGenMask();
    layout(); render();
    toast("每日谜题 · " + ds);
  }, 0);
}

/* ---------- 分享界面：GitHub Pages 链接 + 程序化海报(零素材) ---------- */
// 线上取当前地址(GitHub Pages 域名)，本地/离线时回落到已发布的 Pages 地址
function shareUrl(){
  try{
    if(/^https?:/.test(location.protocol)) return location.href.split("#")[0].split("?")[0];
  }catch(e){}
  return GH_PAGES_URL;
}
function fbCopy(t){   // 无剪贴板权限时的兜底(document.execCommand)
  try{
    const ta = document.createElement("textarea");
    ta.value = t; ta.style.position="fixed"; ta.style.top="-1000px"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){ return false; }
}
function copyText(t){
  return new Promise(res=>{
    try{
      if(navigator && navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(t).then(()=>res(true)).catch(()=>res(fbCopy(t)));
        return;
      }
    }catch(e){}
    res(fbCopy(t));
  });
}
function rewardShare(){   // 每日首次分享发金币(纯活跃激励，非数值售卖)
  if(shareClaimedDate === dateStr()) return;
  shareClaimedDate = dateStr(); coins += SHARE_BONUS; save();
  refreshShareText(); render();
  toast("分享成功 +" + SHARE_BONUS + " 金币");
}
function refreshShareText(){
  const el = document.getElementById("shareReward");
  if(!el) return;
  el.textContent = (shareClaimedDate === dateStr())
    ? ("✅ 今日分享奖励已领取（+" + SHARE_BONUS + " 金币，明日再来）")
    : ("每日首次分享 +" + SHARE_BONUS + " 金币");
}
function showShare(){
  document.getElementById("shareLinkBox").textContent = shareUrl();
  document.getElementById("sharePosterRow").style.display = "none";
  document.getElementById("shareSaveRow").style.display = "none";
  refreshShareText();
  document.getElementById("shareOverlay").style.display = "flex";
  // 小游戏端：wx.shareAppMessage({ title:"收纳大师", imageUrl: 海报 }) —— 接入 SDK 后替换
}
// 海报：纯程序化绘制(渐变底 + 关卡示意 + 链接)，零图片素材
function rrect(g,x,y,w,h,r){
  g.beginPath(); g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
function makePoster(){
  const CW = 480, CH = 720, D = 2;
  const c = document.createElement("canvas");
  c.width = CW*D; c.height = CH*D;
  const g = c.getContext("2d");
  g.setTransform(D,0,0,D,0,0);
  const FONT = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
  // 背景渐变
  const bg = g.createLinearGradient(0,0,CW,CH);
  bg.addColorStop(0,"#3b7bff"); bg.addColorStop(1,"#16c784");
  g.fillStyle = bg; g.fillRect(0,0,CW,CH);
  // 白卡
  rrect(g,24,24,CW-48,CH-48,26); g.fillStyle="rgba(255,255,255,.97)"; g.fill();
  // 标题
  g.textAlign="center"; g.fillStyle="#1f2733";
  g.font="bold 40px "+FONT;  g.fillText("收纳大师", CW/2, 112);
  g.font="15px "+FONT; g.fillStyle="#6b7686";
  g.fillText("纯 AI 生成的 H5 小游戏 · 点开即玩，无需下载", CW/2, 142);
  // 关卡示意：3 根管子(与游戏中同款绘制)
  const tubeW=74, tubeH=200, gap=26, ty=182;
  const x0 = (CW - (tubeW*3 + gap*2))/2;
  const demo = [[0,0,1,2],[1,2,2,0],[1,1,2,0]];
  for(let i=0;i<3;i++){
    const x = x0 + i*(tubeW+gap);
    rrect(g, x, ty, tubeW, tubeH, 18);
    g.fillStyle="#fff"; g.fill();
    g.strokeStyle="#cdd5e0"; g.lineWidth=3; g.stroke();
    const ballR = Math.min((tubeW-14)/2, (tubeH-14)/(CAP*2));
    for(let k=0;k<demo[i].length;k++){
      const cx = x + tubeW/2;
      const cy = ty + tubeH - 8 - ballR - k*(ballR*2+1);
      g.beginPath(); g.fillStyle = PALETTE[demo[i][k]]; g.arc(cx,cy,ballR-1,0,Math.PI*2); g.fill();
      g.beginPath(); g.fillStyle = "rgba(255,255,255,.35)"; g.arc(cx-ballR*0.3, cy-ballR*0.3, ballR*0.35, 0, Math.PI*2); g.fill();
    }
  }
  // 玩法一句话
  g.fillStyle="#1f2733"; g.font="bold 17px "+FONT;
  g.fillText("点选管子搬运同色，每管只剩一种颜色即过关", CW/2, 428);
  // 操作指引
  g.font="14px "+FONT; g.fillStyle="#6b7686";
  g.fillText("① 复制下方链接发给好友   ② 好友打开链接即可开玩", CW/2, 462);
  // 链接框
  let fs = 14, u = shareUrl();
  do { g.font = "bold "+fs+"px "+FONT; fs--; } while(fs > 8 && g.measureText(u).width > CW-48-92-24);
  g.font = "bold "+(fs+1)+"px "+FONT;
  rrect(g, 48, 488, CW-96, 62, 12);
  g.fillStyle="#f5f8ff"; g.fill();
  g.setLineDash([7,6]); g.strokeStyle="#3b7bff"; g.lineWidth=2; g.stroke(); g.setLineDash([]);
  g.fillStyle="#3b7bff"; g.fillText(u, CW/2, 526);
  // 底部
  g.fillStyle="#9aa4b2"; g.font="12px "+FONT;
  g.fillText("GitHub Pages 托管 · 每日谜题全服同题 · 连续签到领金币", CW/2, 596);
  g.fillText("生成于 " + dateStr(), CW/2, 620);
  g.textAlign="left";
  return c.toDataURL("image/png");
}

/* ---------- 音效(程序化合成, 零素材) ---------- */
let actx = null;
function beep(freq, dur=0.08, type="sine", vol=0.06){
  if(muted) return;
  try{
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol; o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime;
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur);
  }catch(e){}
}

/* ---------- 触觉反馈(零依赖，移动端震动；桌面端/不支持时静默降级) ---------- */
// 仅在支持 Vibration API 的设备触发，桌面浏览器 navigator.vibrate 多为 undefined 或被忽略，安全无副作用
function haptic(p){
  try{ if(navigator && navigator.vibrate) navigator.vibrate(p); }catch(e){}
}

/* ---------- 关卡生成(随机填充 + 求解器校验保证可解) ---------- */
function clone(s){ return s.map(t=>t.slice()); }
function isWin(s){
  return s.every(t => t.length===0 || t.every(c=>c===t[0]));
}
function canPour(s,i,j){
  if(i===j) return false;
  const a=s[i], b=s[j];
  if(a.length===0) return false;
  if(b.length>=CAP) return false;
  if(b.length>0 && b[b.length-1]!==a[a.length-1]) return false;
  return true;
}
function pour(s,i,j){
  const a=s[i], b=s[j];
  const color=a[a.length-1];
  let k=a.length-1;
  while(k>=0 && a[k]===color && b.length<CAP) { b.push(a.pop()); k--; }
}
// 计算本次可倒入的数量与颜色(不改状态)，供动画使用
function moveCount(s,i,j){
  const a=s[i], b=s[j];
  const color=a[a.length-1];
  let cnt=0, k=a.length-1;
  while(k>=0 && a[k]===color && b.length+cnt<CAP) { cnt++; k--; }
  return {color, cnt};
}
function key(s){ return s.map(t=>t.join(",")).sort().join("|"); }
// 是否还存在任意合法移动(用于死局检测)
function hasAnyMove(s){
  for(let i=0;i<s.length;i++){
    if(s[i].length===0) continue;
    for(let j=0;j<s.length;j++){
      if(canPour(s,i,j)) return true;
    }
  }
  return false;
}

// DFS 求解器：返回 [步数, 首步] 或 null。复用为 Hint。
function solve(start, capNodes=200000){
  const visited = new Set();
  let nodes = 0;
  let bestFirst = null;
  function dfs(s, depth){
    if(nodes++ > capNodes) return false;
    if(isWin(s)) return true;
    const k = key(s);
    if(visited.has(k)) return false;
    visited.add(k);
    for(let i=0;i<s.length;i++){
      if(s[i].length===0) continue;
      for(let j=0;j<s.length;j++){
        if(canPour(s,i,j)){
          const ns = clone(s); pour(ns,i,j);
          if(dfs(ns, depth+1)){
            // 只记录「根节点」这一步：递归是从最深层往上返回的，
            // 若不限定 depth===0，bestFirst 会被最深层（最后一步）抢先写入，
            // 导致提示给出的是终局前的最后一步，对当前局面往往是非法的。
            if(depth===0 && bestFirst===null) bestFirst=[i,j];
            return true;
          }
        }
      }
    }
    return false;
  }
  const ok = dfs(clone(start),0);
  return ok ? {first:bestFirst} : null;
}

function randomFill(colors, empties, rnd){
  rnd = rnd || Math.random;   // 可注入随机源：每日谜题用日期种子，保证全服同一题面
  const total = colors + empties;
  let s = [];
  for(let i=0;i<colors;i++) s.push([]);
  for(let i=0;i<empties;i++) s.push([]);
  const balls = [];
  for(let c=0;c<colors;c++) for(let n=0;n<CAP;n++) balls.push(c);
  // 洗牌
  for(let i=balls.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; [balls[i],balls[j]]=[balls[j],balls[i]]; }
  let bi=0;
  for(const b of balls){
    // 随机放进未满管
    let tries=0;
    while(tries++<50){
      const t=(rnd()*total)|0;
      if(s[t].length<CAP){ s[t].push(b); bi++; break; }
    }
  }
  return s;
}

function genLevel(lv){
  let colors = Math.min(2 + Math.floor((lv-1)/2), PALETTE.length);
  let empties = lv>10 ? 1 : 2;
  for(let attempt=0; attempt<400; attempt++){
    let s = randomFill(colors, empties);
    const r = solve(s);
    if(r && r.first){
      return {tubes:s};
    }
    if(attempt===200 && empties<3){ empties++; } // 兜底：加空管保证可解
  }
  // 极端兜底：直接给已解状态(理论不会到这)
  let s=[]; for(let c=0;c<colors;c++){ s.push(Array(CAP).fill(c)); } for(let e=0;e<empties;e++) s.push([]);
  return {tubes:s};
}
function colorCount(s){
  const set = new Set();
  s.forEach(t=>t.forEach(c=>set.add(c)));
  return set.size;
}

/* ---------- 每日谜题：按日期定种子 → 全服同一题面(可 PK / 可分享) ---------- */
// FNV-1a 字符串散列 + mulberry32 PRNG：零依赖、同日期必得同一序列
function hashSeed(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAILY_SALT = "SORT-DAILY-";
function dailyColors(ds){ return 5 + Math.floor(mulberry32(hashSeed(DAILY_SALT+ds))() * 3); } // 5~7 色
function genDaily(ds){
  const rnd = mulberry32(hashSeed(DAILY_SALT+ds));
  const colors = 5 + Math.floor(rnd()*3);   // 与 dailyColors 同源，保证"预告=实际"
  let empties = 2;
  for(let attempt=0; attempt<400; attempt++){
    const s = randomFill(colors, empties, rnd);
    const r = solve(s);
    if(r && r.first) return s;              // 与普通关卡同标准：必须可解
    if(attempt===200 && empties<3) empties++; // 兜底加空管
  }
  let s=[]; for(let c=0;c<colors;c++) s.push(Array(CAP).fill(c)); for(let e=0;e<empties;e++) s.push([]);
  return s;
}

/* ---------- 布局与绘制 ---------- */
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  const r = stage.getBoundingClientRect();
  const vw = window.innerWidth || 360, vh = window.innerHeight || 640;
  W = Math.max(200, Math.round(r.width) || vw);
  H = Math.max(240, Math.round(r.height) || (vh - 130));
  cv.width = Math.max(1, W*DPR); cv.height = Math.max(1, H*DPR);
  cv.style.width = W+"px"; cv.style.height = H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
  layout();
  render();
}
function showFatal(msg){
  try{
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle="#ff5b6e"; ctx.font="16px sans-serif";
    ctx.fillText("运行错误: "+msg, 14, 34);
  }catch(e){}
}
window.addEventListener("error", e=>{ showFatal((e&&e.message)||"unknown"); });
function layout(){
  const n = tubes.length;
  const marginX = 16 + RAIL_PAD, marginTop = 18, marginBot = 36; // 预留左右活动入口栏安全区，保证管子不被压住
  const availW = W - marginX*2;
  const availH = H - marginTop - marginBot;
  let perRow = Math.ceil(Math.sqrt(n* (availW/availH) ));
  perRow = Math.max(1, Math.min(perRow, n));
  let rows = Math.ceil(n/perRow);
  // 管尺寸
  let tw = (availW - (perRow-1)*12)/perRow;
  tw = Math.min(tw, 78); tw = Math.max(tw, 36);
  // 高度自适应：优先让整块塞进可用高度，避免被最小高度挤出屏幕
  let th = (availH - (rows-1)*14)/rows;
  th = Math.min(th, 200, CAP*30 + 14);
  th = Math.max(th, 40);
  const rowH = th+14;
  const blockH = rows*rowH - 14;
  let startY = marginTop + Math.max(0, (availH-blockH)/2);
  const blockW = perRow*tw + (perRow-1)*12;
  let startX = (W-blockW)/2;
  tubeRects = [];
  for(let i=0;i<n;i++){
    const r = Math.floor(i/perRow), c = i%perRow;
    const x = startX + c*(tw+12);
    const y = startY + r*rowH;
    tubeRects.push({x,y,w:tw,h:th});
  }
}
function drawTube(i){
  const r = tubeRects[i];
  const t = tubes[i];
  // 选中态：呼吸光晕(背景)
  if(selected===i){
    const pa = pulseAlpha();
    ctx.fillStyle = "rgba(59,123,255,"+(0.10+0.18*pa).toFixed(3)+")";
    roundRect(r.x-6,r.y-6,r.w+12,r.h+12,16); ctx.fill();
  }
  // 管身
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = selected===i ? "#3b7bff" : "#cdd5e0";
  ctx.lineWidth = 3;
  // 圆角底，顶部开口
  const rad = 14;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y);
  ctx.lineTo(r.x, r.y+r.h-rad);
  ctx.quadraticCurveTo(r.x, r.y+r.h, r.x+rad, r.y+r.h);
  ctx.lineTo(r.x+r.w-rad, r.y+r.h);
  ctx.quadraticCurveTo(r.x+r.w, r.y+r.h, r.x+r.w, r.y+r.h-rad);
  ctx.lineTo(r.x+r.w, r.y);
  ctx.stroke();
  // 球
  const skip = (anim && anim.to===i) ? anim.cnt : 0; // 飞行中的球由动画层绘制，此处隐藏
  for(let k=0;k<t.length;k++){
    if(k >= t.length - skip) continue;
    const {cx, cy, ballR} = ballPos(r, k);
    drawBall(cx, cy, ballR, t[k]);
  }
  // 选中态：管底上指箭头(呼吸)，明确"当前拿的是哪根"
  if(selected===i){
    const pa = pulseAlpha();
    const ax = r.x + r.w/2;
    const ay = r.y + r.h + 9;
    ctx.fillStyle = "rgba(59,123,255,"+(0.55+0.35*pa).toFixed(3)+")";
    ctx.beginPath();
    ctx.moveTo(ax, ay-7); ctx.lineTo(ax-6, ay+3); ctx.lineTo(ax+7, ay+3);
    ctx.closePath(); ctx.fill();
  }
  // 提示态：目标管加琥珀色虚线呼吸框 + 管口下指箭头（源管已由 selected 的蓝光晕标示）
  if(hintTarget===i){
    const pa = pulseAlpha();
    ctx.save();
    ctx.setLineDash([7,5]);
    ctx.strokeStyle = "rgba(255,138,0,"+(0.55+0.40*pa).toFixed(3)+")";
    ctx.lineWidth = 3;
    roundRect(r.x-5, r.y-5, r.w+10, r.h+10, 16);
    ctx.stroke();
    ctx.restore();
    const tx = r.x + r.w/2, ty = r.y - 10;
    ctx.fillStyle = "rgba(255,138,0,"+(0.65+0.35*pa).toFixed(3)+")";
    ctx.beginPath();
    ctx.moveTo(tx, ty+7); ctx.lineTo(tx-6, ty-3); ctx.lineTo(tx+7, ty-3);
    ctx.closePath(); ctx.fill();
  }
  // 限步关提示：满管锁标
}
/* ---------- 选中态呼吸光(持续轻量 rAF) ---------- */
let pulseOn = false, pulseT0 = 0;
function nowMs(){ return (typeof performance!=="undefined" && performance.now) ? performance.now() : Date.now(); }
function pulseAlpha(){ const t=(nowMs()-pulseT0)/1000; return 0.5+0.5*Math.sin(t*5); }
function startPulse(){
  if(pulseOn) return;
  pulseOn = true; pulseT0 = nowMs();
  requestAnimationFrame(pulseTick);
}
function pulseTick(){
  // 选中态或提示态任一存在都要继续脉动；两者都消失才停 rAF
  if(selected<0 && hintTarget<0){ pulseOn=false; render(); return; }
  render();
  requestAnimationFrame(pulseTick);
}
// 提示态统一出口。quiet=true 用于切关等"马上要重排 layout"的场合，避免用旧 tubeRects 多画一帧
function clearHint(quiet){
  clearTimeout(clearHint._t);
  if(hintTarget<0 && !hintPair) return;
  hintTarget = -1; hintPair = null;
  if(!quiet) render();
}
// 计算单球在管内的屏幕圆心与半径
function ballPos(r, idx){
  const pad=5;
  const innerW = r.w - pad*2;
  const ballR = Math.min(innerW/2, (r.h-pad*2)/(CAP*2));
  const cx = r.x + r.w/2;
  const cy = r.y + r.h - pad - ballR - idx*(ballR*2 + 1);
  return {cx, cy, ballR};
}
function drawBall(cx, cy, ballR, color){
  ctx.beginPath();
  ctx.fillStyle = PALETTE[color];
  ctx.arc(cx, cy, ballR-1, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.arc(cx-ballR*0.3, cy-ballR*0.3, ballR*0.35, 0, Math.PI*2); ctx.fill();
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function render(){
  ctx.clearRect(0,0,W,H);
  for(let i=0;i<tubes.length;i++) drawTube(i);
  drawFlyingBalls();
  // 常驻过关提示
  ctx.fillStyle="#9aa4b2"; ctx.font="12px sans-serif"; ctx.textAlign="center";
  ctx.fillText("点选管子搬运同色 · 每管只剩一种颜色即过关", W/2, H-8);
  ctx.textAlign="left";
  document.getElementById("hudLevel").textContent = mode==="daily" ? "每日" : level;
  document.getElementById("hudMoves").textContent = moveLimit>0 ? (moves+"/"+moveLimit) : moves;
  document.getElementById("hudCoins").textContent = coins;
  document.getElementById("hudStars").textContent = mode==="daily"
    ? (dailyDoneDate===dateStr() ? "★" : "☆")
    : (bestStars[level] ? "★".repeat(bestStars[level]) : "☆");
}

/* ---------- 交互 ---------- */
function hitTube(px,py){
  for(let i=0;i<tubeRects.length;i++){
    const r=tubeRects[i];
    if(px>=r.x-4 && px<=r.x+r.w+4 && py>=r.y-4 && py<=r.y+r.h+4) return i;
  }
  return -1;
}
function toast(msg){
  const el=document.getElementById("toast");
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),1200);
}
function pushHistory(){ history.push(clone(tubes)); if(history.length>50) history.shift(); }

// 动画播放中再次输入 = 跳过动画（立即落定）。逻辑态在 pour() 时就已更新，
// 动画只负责表现，所以跳过是安全的，不会丢步/回滚。
function skipAnim(){
  if(!anim) return false;
  anim = null; animating = false;
  render(); afterMove();
  return true;
}
// 跳过瞬间可能弹出胜利/死局/广告/生成层，此时本次点按不再透传，避免误触
function anyModalOpen(){
  const ids = ["winOverlay","deadOverlay","adOverlay","genOverlay"];
  for(let i=0;i<ids.length;i++){
    const el = document.getElementById(ids[i]);
    if(el && el.style.display === "flex") return true;
  }
  return false;
}
function onTap(px,py){
  if(animating){
    skipAnim();                  // 动画中快速点按：先跳过动画
    if(anyModalOpen()) return;   // 刚弹了胜负/死局层，本次点按到此为止
  }
  clearHint();                   // 玩家一旦自己操作，提示高亮立即退场
  const i = hitTube(px,py);
  if(i<0) return;
  const t = tubes[i];
  if(selected<0){
    if(t.length===0){ toast("空管"); return; }
    selected=i; beep(520,0.05,"sine",0.05); startPulse(); render(); return;
  }
  if(selected===i){ selected=-1; render(); return; }
  // 尝试倒
  if(canPour(tubes,selected,i)){
    pushHistory();
    const from = selected;
    const mv = moveCount(tubes, from, i);
    pour(tubes, from, i);   // 逻辑态立即更新，动画只负责表现
    moves++;
    beep(660,0.07,"triangle",0.06);
    selected=-1;
    startPourAnim(from, i, mv.color, mv.cnt);
    return;
  } else {
    // 不能倒：改选
    if(t.length>0){ selected=i; beep(520,0.05); }
    else { selected=-1; }
    render();
  }
}
cv.addEventListener("pointerdown", e=>{
  const rect = cv.getBoundingClientRect();
  onTap(e.clientX-rect.left, e.clientY-rect.top);
});

/* ---------- 倒球动画(平滑飞入，看清倒了几颗) ---------- */
function startPourAnim(from, to, color, cnt){
  anim = {from, to, color, cnt, t:0, dur: Math.max(280, 130*cnt), last:0};
  animating = true;
  requestAnimationFrame(animStep);
}
function animStep(ts){
  if(!anim){ animating=false; return; }
  if(!anim.last) anim.last = ts;
  anim.t += ts - anim.last;
  anim.last = ts;
  render();
  if(anim.t >= anim.dur){
    anim = null; animating=false; render();
    afterMove();   // 动画结束后统一判定胜负/步数
  } else {
    requestAnimationFrame(animStep);
  }
}
// 飞行中的球：沿二次贝塞尔从源管口弧线飞入目标管对应槽位
function drawFlyingBalls(){
  if(!anim) return;
  const rFrom = tubeRects[anim.from];
  const rTo = tubeRects[anim.to];
  if(!rFrom || !rTo) return;
  const mouth = {x: rFrom.x + rFrom.w/2, y: rFrom.y + 8};
  const targetLen = tubes[anim.to].length;
  const perBall = anim.dur*0.8;
  const delaySpan = anim.dur*0.2;
  for(let k=0;k<anim.cnt;k++){
    const idx = targetLen - anim.cnt + k;
    const slot = ballPos(rTo, idx);
    let lp = (anim.t - (k/anim.cnt)*delaySpan) / perBall;
    if(lp<=0) continue;
    if(lp>1) lp=1;
    const e = lp*lp*(3-2*lp); // smoothstep
    const sx=mouth.x, sy=mouth.y, ex=slot.cx, ey=slot.cy;
    const peak = Math.min(sy, ey) - 28;
    const mx=(sx+ex)/2;
    const x=(1-e)*(1-e)*sx + 2*(1-e)*e*mx + e*e*ex;
    const y=(1-e)*(1-e)*sy + 2*(1-e)*e*peak + e*e*ey;
    drawBall(x, y, slot.ballR, anim.color);
  }
}
function afterMove(){
  if(isWin(tubes)){ win(); return; }
  if(!hasAnyMove(tubes)){ showDeadlock(); return; } // 死局：无路可走
  if(moveLimit>0 && moves>=moveLimit && !isWin(tubes)){
    toast("步数用尽，点 +5步/广告");
  }
}
// 死局出口：撤销 / 看广告加管(加一根空管后必有新合法步)
function showDeadlock(){ document.getElementById("deadOverlay").style.display="flex"; }
function hideDeadlock(){ document.getElementById("deadOverlay").style.display="none"; }
function addTube(){
  tubes.push([]);
  clearHint(true);   // 加管后索引变化，旧提示可能指向已错位的管子
  layout(); render();
}

/* ---------- 胜负与奖励 ---------- */
function calcStars(){
  const par = colorCount(tubes) * 8;   // 合理步数基准
  if(!usedUndo && !usedHint) return 3;  // 零辅助 = 满星
  if(moves <= par) return 2;
  return 1;
}
function win(){
  beep(880,0.12,"sine",0.07); setTimeout(()=>beep(1175,0.14,"sine",0.07),120);
  haptic([22,40,22]);   // 过关：双段震动正反馈（桌面端静默降级）
  const st = calcStars();
  let reward = 10 + st*5;
  let extra = "";
  if(mode==="daily"){
    if(dailyDoneDate !== dailyDate){   // 每日谜题：每天只发一次首通奖励
      dailyDoneDate = dailyDate; dailyMoves = moves;
      reward += DAILY_FIRST_BONUS; extra = "（每日谜题首通）";
    }
  } else {
    bestStars[level] = Math.max(bestStars[level]||0, st);
  }
  coins += reward;
  save();
  // 每日模式：按钮改文案（再玩一次 / 回到闯关），避免误以为能"下一关"
  document.getElementById("btnReplay").textContent = mode==="daily" ? "再玩一次" : "重玩";
  document.getElementById("btnNext").textContent   = mode==="daily" ? "回到闯关" : "下一关";
  document.getElementById("winStars").textContent = "★".repeat(st)+"☆".repeat(3-st);
  document.getElementById("winReward").textContent = "+"+reward+" 金币"+extra;
  document.getElementById("winOverlay").style.display="flex";
  refreshRail();
  render();
}

/* ---------- 按钮 ---------- */
function doUndo(){
  if(animating){ skipAnim(); if(anyModalOpen()) return; }  // 动画中撤销：先跳过动画再回退
  clearHint();
  if(history.length===0){ toast("无可撤销"); return; }
  tubes = history.pop(); moves=Math.max(0,moves-1); selected=-1;
  usedUndo=true; beep(440,0.05); hideDeadlock(); render();
}
document.getElementById("btnUndo").onclick=doUndo;
document.getElementById("btnHint").onclick=()=>{
  if(animating){ skipAnim(); if(anyModalOpen()) return; }  // 动画中提示：先跳过动画再给建议
  const r = solve(clone(tubes));
  if(r && r.first){
    usedHint=true;
    flashHint(r.first);
  } else toast("无可用提示");
};
function flashHint(pair){
  hintPair=pair;
  // 源管用既有蓝光晕(selected)，目标管用琥珀虚线框(hintTarget)：一眼看清"从哪倒到哪"
  selected=pair[0];
  hintTarget=pair[1];
  startPulse(); render();
  clearTimeout(flashHint._t);
  flashHint._t = setTimeout(()=>{
    hintTarget=-1; hintPair=null;
    if(selected===pair[0]) selected=-1;   // 玩家若已自己点选，别抢他的选中态
    render();
  }, 1200);
  toast("建议：蓝框管 → 琥珀框管");
}
document.getElementById("btnRestart").onclick=()=>{ if(mode==="daily") startDaily(); else startLevel(level); };
document.getElementById("btnAd").onclick=()=>{
  if(noAds){ toast("已去广告"); return; }
  showAd(()=>{
    if(moveLimit>0){ moveLimit += 5; toast("+5 步已发放"); }
    else { coins += 10; save(); toast("+10 金币(广告)"); }
    render();
  });
};
// 去广告内购：底部独立按钮已移除(与右侧活动栏入口重复)，统一由右侧「🚫去广告」入口调用
function buyNoAds(){
  if(noAds){ toast("已拥有去广告卡"); return; }
  // 模拟米大师/应用内购
  showPurchase(()=>{ noAds=true; save(); toast("去广告卡 购买成功"); });
}
document.getElementById("btnMute").onclick=()=>{
  muted=!muted; save();
  document.getElementById("btnMute").textContent = muted?"🔇 静音":"🔊 音效";
};
function showHelp(){ document.getElementById("helpOverlay").style.display="flex"; }
document.getElementById("btnHelp").onclick=showHelp;
document.getElementById("btnHelpClose").onclick=()=>{
  document.getElementById("helpOverlay").style.display="none";
  if(pendingSign) showSign();
};
document.getElementById("helpOverlay").addEventListener("click", ev=>{
  if(ev.target.id==="helpOverlay") document.getElementById("helpOverlay").style.display="none";
});
document.getElementById("entryOverlay").addEventListener("click", ev=>{
  if(ev.target.id==="entryOverlay") document.getElementById("entryOverlay").style.display="none";
});
document.getElementById("signOverlay").addEventListener("click", ev=>{
  if(ev.target.id==="signOverlay") closeSign();   // 点遮罩也能关，杜绝「进得去出不来」
});
document.getElementById("btnReplay").onclick=()=>{
  document.getElementById("winOverlay").style.display="none";
  if(mode==="daily") startDaily(); else startLevel(level);   // 每日模式：重开同一道每日题面
};
document.getElementById("btnNext").onclick=()=>{
  document.getElementById("winOverlay").style.display="none";
  if(mode==="daily"){ mode="normal"; startLevel(level); }     // 每日模式：退出每日回到闯关
  else { level++; save(); startLevel(level); }
};
/* 每日谜题入口的三个按钮 */
document.getElementById("btnDailyStart").onclick=()=>{
  document.getElementById("dailyOverlay").style.display="none";
  startDaily();
};
document.getElementById("btnDailyClose").onclick=()=>{
  document.getElementById("dailyOverlay").style.display="none";
};
document.getElementById("btnDailyExit").onclick=()=>{
  document.getElementById("dailyOverlay").style.display="none";
  mode="normal"; startLevel(level); toast("已回到闯关");
};
document.getElementById("dailyOverlay").addEventListener("click", ev=>{
  if(ev.target.id==="dailyOverlay") document.getElementById("dailyOverlay").style.display="none";
});
/* 分享界面按钮 */
document.getElementById("btnShareCopy").onclick=()=>{
  copyText(shareUrl()).then(ok=>{
    toast(ok ? "链接已复制，去粘贴给好友吧" : "复制失败，请长按上方链接手动复制");
    if(ok) rewardShare();
  });
};
document.getElementById("btnSharePoster").onclick=()=>{
  try{
    document.getElementById("sharePoster").src = makePoster();
    document.getElementById("sharePosterRow").style.display = "block";
    document.getElementById("shareSaveRow").style.display = "flex";
    rewardShare();
    toast("海报已生成，保存后发给好友");
  }catch(e){ toast("海报生成失败，可直接复制链接分享"); }
};
document.getElementById("btnShareSave").onclick=()=>{
  try{
    const a = document.createElement("a");
    a.href = document.getElementById("sharePoster").src;
    a.download = "收纳大师-分享海报.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast("已保存海报（手机可长按图片保存）");
  }catch(e){ toast("保存失败，可长按海报图片保存"); }
};
document.getElementById("shareLinkBox").onclick=()=>{ document.getElementById("btnShareCopy").click(); };
document.getElementById("btnShareClose").onclick=()=>{
  document.getElementById("shareOverlay").style.display="none";
};
document.getElementById("shareOverlay").addEventListener("click", ev=>{
  if(ev.target.id==="shareOverlay") document.getElementById("shareOverlay").style.display="none";
});
document.getElementById("btnDeadUndo").onclick=doUndo;
document.getElementById("btnDeadAd").onclick=()=>{
  if(noAds){ addTube(); hideDeadlock(); toast("已加一根空管"); return; }
  hideDeadlock(); // 先让出顶层，避免遮挡广告层
  showAd(()=>{ addTube(); });
};
document.getElementById("btnDeadRestart").onclick=()=>{ hideDeadlock(); startLevel(level); };
document.getElementById("btnSignClaim").onclick=claimSign;

/* ---------- 活动入口侧栏：留存/活跃(左) + 促销/变现(右) 常驻入口，可滑动，点哪个开哪个 ----------
   新增一个活动 = 在 RAIL_ITEMS 里加一条 {id,ico,name}，再在 openEntry 里决定打开哪个界面。
   侧栏 z-index(10) 低于弹窗(50)，弹窗期间被遮罩覆盖，不会误触。                                    */
const RAIL_ITEMS = {
  left: [
    {id:"sign",  ico:"📅", name:"签到", hot:true},
    {id:"daily", ico:"🧩", name:"每日"},
    {id:"share", ico:"📤", name:"分享"},
    {id:"rank",  ico:"🏆", name:"排行"}
  ],
  right: [
    {id:"shop",  ico:"🛒", name:"商城"},
    {id:"first", ico:"🎁", name:"首充"},
    {id:"card",  ico:"💳", name:"月卡"},
    {id:"noads", ico:"🚫", name:"去广告"}
  ]
};
// 各入口的文案元数据(已实现入口也留一份，便于"入口=说明"统一)
const ENTRY_META = {
  daily:{ico:"🧩", n:"每日谜题", d:"每天一道固定题面(按日期定种子)，全服同一关，不限步，首通 +60 金币。"},
  share:{ico:"📤", n:"分享给好友", d:"复制 GitHub Pages 链接或生成分享海报，好友点开即玩；每日首次分享 +30 金币。"},
  rank: {ico:"🏆", n:"好友排行", d:"按通关数与星级排行，接入小游戏开放数据域后开启。"},
  shop: {ico:"🛒", n:"道具商城", d:"用金币兑换提示 / 撤销 / 加步等便利道具，不售卖任何数值。"},
  first:{ico:"🎁", n:"首充礼包", d:"首次充值额外赠送永久去广告卡(安卓走米大师，iOS 端隐藏)。"},
  card: {ico:"💳", n:"每日月卡", d:"连续 30 天每天领金币(安卓走米大师，iOS 端隐藏)。"},
  noads:{ico:"🚫", n:"去广告卡", d:"一次性内购，永久移除全部广告位。"}
};
const railBtns = {}, railDots = {};
function buildRail(){
  ["left","right"].forEach(function(side){
    const box = document.getElementById(side==="left" ? "railL" : "railR");
    if(!box) return;
    box.textContent = "";
    RAIL_ITEMS[side].forEach(function(it){
      const b = document.createElement("button");
      b.type = "button";
      b.className = it.hot ? "hot" : "";
      b.setAttribute("data-entry", it.id);
      const ic = document.createElement("span"); ic.className="ico"; ic.textContent = it.ico;
      const nm = document.createElement("span"); nm.className="nm"; nm.textContent = it.name;
      const dt = document.createElement("span"); dt.className="dot";
      b.appendChild(ic); b.appendChild(nm); b.appendChild(dt);
      b.addEventListener("click", function(){ openEntry(it.id); });
      box.appendChild(b);
      railBtns[it.id] = b; railDots[it.id] = dt;
    });
  });
  refreshRail();
}
// 角标刷新：签到待领取(红点) + 每日谜题今天还没通关(红点)，促进活跃
function refreshRail(){
  const s = railDots.sign;
  if(s) s.style.display = pendingSign ? "block" : "none";
  const d = railDots.daily;
  if(d) d.style.display = (dailyDoneDate !== dateStr()) ? "block" : "none";
}
// 通用「功能预告」弹窗(未实现活动的统一出口)
function showEntry(id){
  const m = ENTRY_META[id] || {ico:"✨", n:"敬请期待", d:"该功能正在开发中。"};
  document.getElementById("entryIco").textContent = m.ico;
  document.getElementById("entryTitle").textContent = m.n;
  document.getElementById("entryDesc").textContent = m.d;
  document.getElementById("entryOverlay").style.display = "flex";
}
// 入口路由：已实现的直达对应界面，未实现的展示预告弹窗 —— "点哪个开哪个"
function openEntry(id){
  if(id==="sign"){ showSign(); return; }                                 // 每日签到(已实现)
  if(id==="daily"){ showDaily(); return; }                                // 每日谜题(已实现)
  if(id==="share"){ showShare(); return; }                                // 分享给好友(已实现)
  if(id==="noads"){ buyNoAds(); return; }                                 // 去广告内购(已实现)
  showEntry(id);                                                          // 其余：预告
}
buildRail();
document.getElementById("btnEntryClose").onclick=()=>{
  document.getElementById("entryOverlay").style.display="none";
};

/* ---------- 广告/内购 占位(真实环境替换为小游戏SDK) ---------- */
function showAd(done){
  const ov=document.getElementById("adOverlay");
  document.getElementById("adTitle").textContent="激励视频";
  ov.style.display="flex";
  setTimeout(()=>{ ov.style.display="none"; done&&done(); }, 1500);
}
function showPurchase(done){
  const ov=document.getElementById("adOverlay");
  document.getElementById("adTitle").textContent="内购：永久去广告卡 ¥6";
  document.getElementById("adHint").textContent="（Demo 模拟，真实环境替换为 wx.requestMidasPayment）";
  ov.style.display="flex";
  setTimeout(()=>{ ov.style.display="none"; done&&done(); }, 1200);
}

/* ---------- 启动 ---------- */
let genToken = 0; // 防止快速切关时旧生成覆盖新关卡
function showGenMask(lv){
  const ov = document.getElementById("genOverlay");
  if(lv) document.getElementById("genLv").textContent = lv;
  ov.style.display = "flex";
}
function hideGenMask(){ document.getElementById("genOverlay").style.display = "none"; }
function startLevel(lv){
  mode = "normal";              // 线性闯关模式(每日谜题走 startDaily)
  const my = ++genToken;
  showGenMask("第 " + lv + " 关");
  // 让出主线程先绘制遮罩，避免高阶关卡生成耗时导致白屏/卡顿
  setTimeout(()=>{
    if(my !== genToken) return; // 已被更新的关卡取代
    const g = genLevel(lv);
    tubes = g.tubes;
    clearHint(true);
    selected=-1; moves=0; history=[];
    usedUndo=false; usedHint=false;
    const colors = colorCount(tubes);
    moveLimit = lv>6 ? colors*8 : 0; // 后期加入限步挑战(颜色数*8)
    hideDeadlock(); hideGenMask();
    layout(); render();
  }, 0);
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", ()=>setTimeout(resize,120));
window.addEventListener("load", ()=>setTimeout(resize, 0));
load();
document.getElementById("btnMute").textContent = muted?"🔇 静音":"🔊 音效";
try{
  startLevel(level);
  resize();
}catch(err){ showFatal((err&&err.message)||String(err)); }
// 首次进入自动弹一次过关说明(sawHelp 存档，避免每次都弹)
detectSign();
refreshRail();  // 签到待领取时点亮侧栏红点
if(!sawHelp){
  document.getElementById("helpOverlay").style.display = "flex";
  sawHelp = true; save();
  // 首次：说明关闭后再弹签到(避免两个弹窗同时压屏)
} else if(pendingSign){
  showSign();
}
if(window.ResizeObserver){ try{ new ResizeObserver(()=>resize()).observe(stage); }catch(e){} }
// 首帧尺寸可能未就绪：轮询兜底直至拿到有效尺寸
let __bootTries = 0;
(function bootSize(){
  if((W < 10 || H < 10 || cv.width < 10) && __bootTries++ < 120){
    resize();
    requestAnimationFrame(bootSize);
  }
})();
