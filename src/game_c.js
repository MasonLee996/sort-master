/* ---------- 流程：开局 / 胜 / 负 / 复活 / 广告占位 ---------- */
const mask=document.getElementById("mask"), card=document.getElementById("card");
function modal(html){ card.innerHTML=html; mask.classList.add("on"); }
function closeModal(){ mask.classList.remove("on"); }

function startLevel(lv){
  level = lv; const g = genLevel(lv); tiles = g.tiles; P = g.P;
  slot=[]; flying=[]; fx=[]; combo=0; slotCap=SLOT_N; slotFlash=0; revived=false; busy=false;
  tools = {shake:1, back:1, peek:1}; state="play";
  layout(); makeOrders(); renderOrders(); updateHUD(); closeModal();
  const T = TALES[(lv-1)%TALES.length];
  const hasVip = orders.some(o=>o.kind==="vip"), hasImp = orders.some(o=>o.kind==="imposter");
  const special = hasVip&&hasImp ? "🧙 斗篷客是贵客：赏金×3、耐心短，值得抢！😼 神秘客是黑猫假扮——别喂它，会偷 1 格篮子！"
    : hasVip ? "🧙 斗篷客是贵客：赏金×3、耐心短，值得抢！"
    : hasImp ? "😼 神秘客是黑猫假扮的——喂它订单会被偷走 1 格篮子，别上当！" : "";
  const xh = orders.some(o=>o.regular) ? "🌸 小花又来啦——帮她完成订单，故事会一点点连起来（已 "+(save.xiaohua||0)+"/"+4+"）。" : "";
  state="pause";
  modal(`<h2>📜 ${T.t}</h2><p>${T.s}</p>${lv===1?'<p style="font-size:13px">点最上面的东西放进篮子，<b>3 个一样的</b>就收好了。<br>篮子 7 格，<b>装满就输</b>。</p>':''}<div class="story">🔔 叮铃——${orders.map(o=>o.g.ico+' <b>'+o.g.n+'</b>：「'+ITEM_WHY[o.need[0].c]+'，要 '+o.need.map(x=>ITEMS[x.c]+'×'+(x.want*3)).join(' ')+'」').join('<br>')}<br><small>⏳ 每拿一件客人就更急一点；筐里<b style="color:#d99a1a">金圈</b>是客人要的。<b>交一单 = 篮子 +1 格</b>（最多 9 格）+ 金币！</small>${special?`<br><small style="color:#b8860b">${special}</small>`:''}${xh?`<br><small style="color:#c0582a">${xh}</small>`:''}</div><button class="btn" id="bGo">${lv===2?"⚠️ 我偏要试试":"开始收拾"}</button>`);
  document.getElementById("bGo").onclick = ()=>{ closeModal(); state="play"; cat("start"); };
}

function lose(){
  state="lose"; SFX.lose(); vibrate([60,40,60]); cat("lose");
  const left = tiles.filter(t=>t.alive).length;
  const coinCost = 40;
  modal(`<h2>😼 黑猫：${catSay}</h2><p>篮子满了……筐里只剩 <b>${left}</b> 件！</p>
    ${revived?"":`<button class="btn blue" id="bRev">▶ 看视频 · 清出 3 格继续</button>
    <button class="btn" id="bCoin">💰 花 ${coinCost} 金币 · 清出 3 格继续（有 ${save.coins}）</button>`}
    <button class="btn" id="bRetry">重新开始</button>
    <button class="btn gray" id="bShareL">喊朋友来帮我过</button>`);
  if(!revived){
    document.getElementById("bRev").onclick = ()=>fakeAd(()=>{ revived=true; state="play";
      const take=slot.splice(0,3); pushBack(tiles, take.map(s=>s.color));
      closeModal(); updateHUD(); toast("复活！再小心点～"); });
    document.getElementById("bCoin").onclick = ()=>{
      if(save.coins<coinCost) return toast("金币不够，多做订单或看视频吧");
      save.coins-=coinCost; revived=true; state="play"; persist();
      const take=slot.splice(0,3); pushBack(tiles, take.map(s=>s.color));
      closeModal(); updateHUD(); toast("💰 花 "+coinCost+" 金币续命！"); };
  }
  document.getElementById("bRetry").onclick = ()=>startLevel(level);
  document.getElementById("bShareL").onclick = ()=>share(`黑猫把我的筐弄乱了，《拾线铺》第${level}关只剩${left}件没收完！你能过吗？`);
}

function win(){
  state="win"; SFX.win(); vibrate([20,30,20,30,80]); cat("win");
  const gain = level===2 ? 3 : level===10 ? 4 : 1;
  const allOrd = orderLost===0 && orderDone>0;
  const bonus = allOrd ? 1 : 0;
  save.coins += coinsGot;
  save.stars += gain + bonus; const isNew = save.level===level; if(isNew) save.level = Math.min(LEVELS.length, level+1);
  persist(); updateHUD();
  for(let i=0;i<5;i++) setTimeout(()=>burst(W*(.2+Math.random()*.6), H*.3, COLORS[i%9].c), i*120);
  const brag = level===2 ? `<p>🏆 你超过了 <b>77%</b> 的织匠！</p>` : "";
  modal(`<h2>🎉 收拾完啦！</h2><p>😾 黑猫：${catSay}</p>${brag}<p>获得 ⭐ × ${gain+bonus}${level===10?"（Boss 奖励）":""}${bonus?"（零差评 +1）":""}</p><p>📋 完成订单 ${orderDone} 单${orderLost?` · 气走 ${orderLost} 位`:''} · 💰 +${coinsGot}</p>
    <button class="btn blue" id="bDbl">▶ 看视频 · 星星翻倍</button>
    <button class="btn" id="bShop">去线铺修东西 🏠</button>
    ${level<LEVELS.length?`<button class="btn gray" id="bNext">下一关</button>`:`<p>Demo 共 10 关，感谢试玩！</p>`}
    ${level===2?`<button class="btn gray" id="bShareW">炫耀一下</button>`:""}`);
  document.getElementById("bDbl").onclick = function(){ fakeAd(()=>{ save.stars+=gain; persist(); updateHUD(); this.remove(); toast("⭐ +"+gain); }); };
  document.getElementById("bShop").onclick = ()=>openShop();
  const n=document.getElementById("bNext"); if(n) n.onclick = ()=>startLevel(level+1);
  const sw=document.getElementById("bShareW"); if(sw) sw.onclick = ()=>share("《拾线铺》第2关只有23%的人能过，我过了！你来试试？");
}

// 广告占位：模拟 1.5 秒激励视频（接微信 wx.createRewardedVideoAd 时替换此函数）
function fakeAd(onReward){
  modal(`<h2>📺 广告播放中…</h2><p>（Demo 占位，1.5 秒后发放奖励）</p>`);
  setTimeout(()=>{ closeModal(); onReward(); }, 1500);
}
function adPrompt(text, onReward){
  const prev = state; state="pause";
  modal(`<h2>🎁 道具用完啦</h2><p>${text}</p><button class="btn blue" id="bAd">▶ 看视频领取</button><button class="btn" id="bCoin">💰 30 金币买 1 次（有 ${save.coins}）</button><button class="btn gray" id="bNo">算了</button>`);
  document.getElementById("bCoin").onclick = ()=>{ if(save.coins<30) return toast("金币不够，多做订单吧"); save.coins-=30; persist(); state=prev; closeModal(); onReward(); updateHUD(); };
  document.getElementById("bAd").onclick = ()=>fakeAd(()=>{ state=prev; onReward(); updateHUD(); });
  document.getElementById("bNo").onclick = ()=>{ state=prev; closeModal(); };
}
function share(text){
  const url = location.protocol.startsWith("http") ? location.href : "https://example.com/";
  try{ if(navigator.share){ navigator.share({title:"拾线铺", text, url}); return; } }catch(e){}
  try{ navigator.clipboard.writeText(text+" "+url); toast("已复制，去粘贴给朋友吧"); }catch(e){ toast(text); }
}

/* ---------- 线铺：修复 + 剧情（浪漫餐厅式元层） ---------- */
function openShop(){
  const prev = state; if(state==="play") state="pause";
  const nBought = save.bought.length;
  const next = SHOP.find((s,i)=>!save.bought.includes(i));
  const grid = SHOP.map((s,i)=>`<div class="${save.bought.includes(i)?"on":""}" title="${s.n}">${s.ico}</div>`).join("");
  const storyIdx = Math.floor(nBought/2) - 1;
  const story = storyIdx>=0 ? `<div class="story">${STORY[Math.min(storyIdx,STORY.length-1)]}</div>` : `<div class="story"><b>奶奶：</b>灰雾过后，铺子全褪了色。拿星星来，一件件修回来吧。</div>`;
  modal(`<h2>🏠 拾光线铺 <small style="font-size:13px">${nBought}/${SHOP.length}</small></h2>
    <div id="shop">${grid}</div>${story}
    ${next?`<button class="btn" id="bBuy">修复「${next.n}」 ⭐${next.cost}（有 ${save.stars}）</button>`:`<p>第一章全部修好啦！第二章敬请期待</p>`}
    <button class="btn gray" id="bBack">${prev==="win"?"下一关":"返回"}</button>`);
  const bb=document.getElementById("bBuy");
  if(bb) bb.onclick = ()=>{
    const i = SHOP.indexOf(next);
    if(save.stars < next.cost) return toast("星星不够，去过关吧～");
    save.stars -= next.cost; save.bought.push(i); persist(); updateHUD();
    [659,784,988].forEach((f,k)=>setTimeout(()=>beep(f,.15,"triangle",.14),k*90));
    const newStory = save.bought.length%2===0;
    openShop(); if(newStory) toast("📖 解锁新剧情！");
  };
  document.getElementById("bBack").onclick = ()=>{
    if(prev==="win" && level<LEVELS.length) return startLevel(level+1);
    if(prev==="win") return closeModal();
    state = prev==="pause"?"play":prev; closeModal();
  };
}

/* ---------- 每日签到（留存钩子） ---------- */
function dayKey(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function maybeCheckIn(cb){
  const today = dayKey();
  if(save.lastDay === today) return cb();                 // 今天已签到
  const y = new Date(); y.setDate(y.getDate()-1);
  const yk = y.getFullYear()+"-"+(y.getMonth()+1)+"-"+y.getDate();
  save.streak = (save.lastDay===yk) ? (save.streak||0)+1 : 1;   // 连续天数
  save.lastDay = today;
  const reward = 20 + save.streak*5;                     // 连签越多越多
  save.coins += reward; persist(); updateHUD();
  modal(`<h2>📅 每日签到 · 第 ${save.streak} 天</h2><p>连续来铺子，灰雾都散得快些～</p><p>领取 💰 +${reward} 金币！${save.streak>=3?"<br><small style='color:#c0582a'>连签奖励已解锁，明天更多！</small>":""}</p><button class="btn" id="bCi">收下，开工</button>`);
  document.getElementById("bCi").onclick = ()=>{ closeModal(); cb(); };
}

/* ---------- 启动 ---------- */
window.addEventListener("load", ()=>{
  try{ layout(); }catch(e){ showErr(e); }
  maybeCheckIn(()=>{
    try{ startLevel(save.level); }catch(e){ showErr(e); }
    requestAnimationFrame(draw);
  });
});
