"use strict";
/* ====== 拾线铺 Demo：堆叠拾取 + 7 格线篮三消 + 线铺修复/剧情 ====== */
const COLORS = [
  {c:"#e85d5d",d:"#b83b3b",n:"红"},{c:"#4a90d9",d:"#2f6aa8",n:"蓝"},{c:"#f2b134",d:"#c4861a",n:"黄"},
  {c:"#5fae6a",d:"#3d8549",n:"绿"},{c:"#9b6fd0",d:"#7349a8",n:"紫"},{c:"#f08cb4",d:"#c9638c",n:"粉"},
  {c:"#3fbfbf",d:"#258f8f",n:"青"},{c:"#8a5a3c",d:"#603a22",n:"棕"},{c:"#ff8a3d",d:"#cc6420",n:"橙"},
  {c:"#7d8a99",d:"#55606d",n:"灰"}
];
// 关卡表：colors 颜色数, triples 组数(每组3个), layers 层数, mix 交错度(越大越难), cols/rows 网格
const LEVELS = [
  {colors:3, triples:4,  layers:2, mix:0, cols:4, rows:4},   // 1 教学必过
  {colors:9, triples:27, layers:6, mix:6, cols:6, rows:7},   // 2 卡点关（抓大鹅式）裸玩≈29%
  {colors:4, triples:8,  layers:3, mix:1, cols:5, rows:5},
  {colors:5, triples:11, layers:3, mix:2, cols:5, rows:6},
  {colors:6, triples:15, layers:4, mix:3, cols:6, rows:6},
  {colors:5, triples:12, layers:3, mix:2, cols:5, rows:6},
  {colors:7, triples:18, layers:4, mix:2, cols:6, rows:7},   // 7  ≈66%
  {colors:7, triples:20, layers:4, mix:4, cols:6, rows:7},   // 8  ≈80%（喘口气，体量更大）
  {colors:7, triples:21, layers:5, mix:4, cols:6, rows:7},   // 9  ≈53%
  {colors:9, triples:25, layers:6, mix:5, cols:6, rows:7}    // 10 章末 Boss ≈13%
];
const SLOT_N = 7;      // 开局线篮格数（生成器按 7 格保证有解）
const SLOT_MAX = 9;    // 完成订单每单 +1 格，上限 9
const SHOP = [
  {ico:"🪧",n:"招牌",cost:1},{ico:"🪑",n:"木椅",cost:1},{ico:"🧶",n:"线团架",cost:2},{ico:"🪟",n:"窗帘",cost:2},
  {ico:"🕯️",n:"烛台",cost:2},{ico:"🧵",n:"织机",cost:3},{ico:"🐈‍⬛",n:"猫窝",cost:3},{ico:"🖼️",n:"挂毯",cost:4}
];
const STORY = [
  "<b>奶奶：</b>孩子，灰雾把镇上的颜色都拆成了线……这间线铺，就交给你了。",
  "<b>奶奶：</b>织机还能转！只是……昨晚好像有只黑猫叼走了一团红线。",
  "<b>神秘客人：</b>（推门，斗篷上沾着灰雾）\"我要一条能挡住灰雾的围巾。三天后来取。\"",
  "<b>奶奶：</b>黑猫的窝里……怎么会有你爷爷当年的织针？<br><i>—— 第一章完 · 未完待续 ——</i>"
];

/* ---------- 存档（try/catch 防无痕模式） ---------- */
const SAVE_KEY = "shixianpu_demo_v1";
let save = {level:1, stars:0, coins:0, bought:[], xiaohua:0, lastDay:"", streak:0};
try{ const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if(s) save = Object.assign(save, s); }catch(e){}
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }

/* ---------- 随机源 ---------- */
let seed = 1;
function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- 情境：具体物件（按形状认，不靠颜色）+ 每关一个"事故现场" ---------- */
const ITEMS = ["🧶","🧦","🧤","🧣","🎀","🧸","✂️","🧵","🧷","👒"];
// 与 COLORS 一一对应的贴图键 / 中文名（颜色=物件，见 ITEM_KEYS 顺序）
const ITEM_KEYS  = ["yarn","sock","glove","scarf","bow","teddy","scissors","spool","pin","hat"];
const ITEM_NAMES = ["线团","袜子","手套","围巾","蝴蝶结","小熊","剪刀","线轴","别针","帽子"];
const TALES = [
  {t:"黑猫打翻了针线筐", s:"奶奶刚出门，黑猫就把筐掀了……趁她回来前收拾好！"},
  {t:"赶集日大混乱", s:"客人把整筐货翻得乱七八糟，全镇只有 23% 的人收拾完过。"},
  {t:"晾线绳断了", s:"一阵风，刚晾好的线全掉进了筐里。"},
  {t:"奶奶的嫁妆箱", s:"翻出了几十年前的老物件，小心别弄坏。"},
  {t:"神秘客人的订单", s:"斗篷客要的东西全混在这一筐里了。"},
  {t:"雨夜漏水", s:"屋顶漏雨，赶紧把筐里的东西抢救出来！"},
  {t:"黑猫又来了", s:"它好像在筐底藏了什么东西……"},
  {t:"灰雾压境", s:"灰雾飘进铺子，东西都在褪色，快！"},
  {t:"织机大扫除", s:"织机底下扫出了一整筐零碎。"},
  {t:"黑猫的老巢", s:"终于找到黑猫的窝了，满满一筐偷来的东西！"}
];
// 每种物件的"来由"：客人为什么要它（订单 = 情境里的一个人、一件事）
const ITEM_WHY = ["想织条围巾","脚冻僵啦","明天要下雪","送给心上人","女儿过生日","孩子哭着要","裁件新衣裳","补渔网用","别在礼服上","赶集要戴"];
const GUEST_LINES = { urgent:["快点呀…","我赶时间！","还要多久？"], thanks:["太好啦！","就是这个！","谢谢小织匠！"], leave:["算了，不等了！","这家店真慢…","哼，走了！"] };
const CAT_LINES = {
  start:["喵～这筐是我弄乱的","你收拾不完的喵","嘿嘿，慢慢找吧"],
  danger:["喵嘿嘿，要满咯！","快不行了吧～","再拿错一个试试？"],
  combo:["喵？！","运气好而已喵","哼……"],
  lose:["喵哈哈哈哈！","就这？","明天再来吧喵～"],
  win:["喵！？不可能！","下次没这么简单！","哼，算你厉害"],
  guestGone:["客人被你气跑咯～","喵哈，生意黄了","慢吞吞的织匠喵"],
  guestDone:["切，运气好","哼，我也会收拾","喵…有两下子"],
  imposter:["喵哈哈！被我骗了吧！","嘿嘿，篮子归我咯～","你居然真给我了喵！","上当咯上当咯～"]
};

/* ---------- 遮挡判定：自由散落，圆形重叠 + 高层压低层 ---------- */
// tile: x,y ∈ [0,1]（筐内归一化坐标），r 归一化半径，rot 旋转，z 层
function overlap(a,b){ const dx=a.x-b.x, dy=a.y-b.y, k=(a.r+b.r)*.82; return dx*dx+dy*dy < k*k; }
function isCovered(t, list){ for(const o of list){ if(o!==t && o.alive && o.z>t.z && overlap(o,t)) return true; } return false; }
// 退回 / 复活：把物件撒回筐顶
function pushBack(list, colors){
  const top = list.reduce((m,t)=>Math.max(m,t.z),0)+1, r = list[0] ? list[0].r : .08;
  colors.forEach((c,i)=>list.push({x:.3+i*.2, y:.18+(i%2)*.05, r, rot:(i-1)*.4, z:top, alive:true, color:c, id:list.length}));
}

/* ---------- 生成：先摆位置 → 模拟一条"合法拾取序列" → 按序列分配颜色（保证有解） ---------- */
function genLevel(lv){
  const P = LEVELS[Math.min(lv, LEVELS.length) - 1];
  const total = P.triples * 3;
  for(let attempt=0; attempt<200; attempt++){
    seed = lv*7919 + attempt*104729 + 13;
    // 1) 自由散落成"一座小山"：中心高、边缘低，随机旋转 —— 像真的倒了一筐东西
    const tiles = [];
    const r0 = .095 - Math.min(.035, total*.0005);
    for(let i=0;i<total;i++){
      const z = Math.floor(i * P.layers / total);           // 层号（越后越高）
      const spread = .46 - z/P.layers*.22;                   // 高层更集中在中间 → 堆成小山
      const a = rnd()*Math.PI*2, d = Math.sqrt(rnd())*spread;
      tiles.push({x:.5+Math.cos(a)*d, y:.52+Math.sin(a)*d*.78, r:r0*(.9+rnd()*.25), rot:(rnd()-.5)*1.4, z, alive:true, color:-1, id:i});
    }
    if(tiles.length !== total){ if(typeof DBG!=="undefined") DBG.layout++; continue; }
    // 2) 模拟拾取顺序：每步从"当前未被遮挡"的格子里随机取一个
    const order = [];
    while(order.length < total){
      const free = tiles.filter(t => t.alive && !isCovered(t, tiles));
      if(!free.length) break;
      const t = free[Math.floor(rnd()*free.length)];
      t.alive = false; order.push(t);
    }
    if(order.length !== total) continue;
    // 3) 颜色序列：triples 组按色循环，再做窗口内交错（mix 越大越乱）
    // 构造式颜色序列：模拟线篮，保证"按 order 拾取"时篮内峰值 ≤ LIMIT（必有解）
    const LIMIT = SLOT_N - 1;
    const remain = []; for(let i=0;i<P.triples;i++){ const col=i%P.colors; remain[col]=(remain[col]||0)+3; }
    const seq = []; const open = {}; let inSlot = 0, peak = 0, ok = true;
    for(let k=0;k<total;k++){
      const openCols = Object.keys(open).map(Number).filter(c=>open[c]>0);
      const fresh = remain.map((v,c)=>c).filter(c=>remain[c]>0 && !(open[c]>0));
      // mix 越大，越倾向开新色（篮子越挤）；篮满前强制补齐已开色
      const canOpen = fresh.length && inSlot + 3 <= LIMIT; // 开新色后最坏再补 2 个即可凑齐
      const pOpen = openCols.length ? Math.min(.85, .15 + P.mix*.14) : 1;
      let col;
      if(canOpen && (rnd() < pOpen || !openCols.length)) col = fresh[Math.floor(rnd()*fresh.length)];
      else if(openCols.length){ openCols.sort((a,b)=>open[b]-open[a]); col = (inSlot + 2 > LIMIT || rnd()<.5) ? openCols[0] : openCols[Math.floor(rnd()*openCols.length)]; }
      else { ok=false; break; }
      seq.push(col); remain[col]--; open[col]=(open[col]||0)+1; inSlot++;
      peak = Math.max(peak, inSlot);
      if(open[col]===3){ open[col]=0; inSlot-=3; }
    }
    if(!ok || peak > LIMIT){ if(typeof DBG!=="undefined") DBG.color++; continue; }
    order.forEach((t,i)=>{ t.color = seq[i]; });
    tiles.forEach(t => t.alive = true);
    return {tiles, P, attempt, peak};
  }
  throw new Error("genLevel failed " + lv);
}
if(typeof module !== "undefined") module.exports = {genLevel, isCovered, pushBack, LEVELS, SLOT_N, SLOT_MAX, ITEMS};
