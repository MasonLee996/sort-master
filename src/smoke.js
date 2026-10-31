const fs=require("fs"),vm=require("vm");
const html=fs.readFileSync(__dirname+"/../index.html","utf8"); const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
const els={}; const mkEl=id=>els[id]||(els[id]={id,textContent:"",innerHTML:"",style:{},onclick:null,classList:{add(){},remove(){},toggle(){}},querySelector(){return mkEl(id+"_i")},remove(){},addEventListener(t,f){this["on_"+t]=f},getBoundingClientRect(){return{left:0,top:0,width:390,height:600}},getContext(){return new Proxy({},{get:(t,k)=>(k==="createRadialGradient"||k==="createLinearGradient")?()=>({addColorStop(){}}):k==="measureText"?()=>({width:50}):()=>{}})}});
const timers=[]; const ctx={console,Math,JSON,Object,Array,Number,parseInt,Error,
  document:{getElementById:mkEl},window:{addEventListener(t,f){if(t==="load")ctx._load=f},devicePixelRatio:2},
  localStorage:{getItem(){return null},setItem(){}},navigator:{},location:{protocol:"file:",href:""},
  setTimeout:(f)=>{timers.push(f);return 1},clearTimeout(){},Set,requestAnimationFrame(){}, performance:{now:()=>0} };
ctx.globalThis=ctx; vm.createContext(ctx); vm.runInContext(js+";this.__api={go:()=>{state='play'},startLevel,pick,tiles:()=>tiles,slot:()=>slot,flying:()=>flying,state:()=>state,orders:()=>orders,od:()=>[orderDone,orderLost,coinsGot],isCovered,tileRect,save,draw};",ctx);
const flush=()=>{while(timers.length) timers.shift()();};
ctx._load(); const A=ctx.__api; let fails=0;
function step(){ // 让飞行动画完成：反复调用 draw 直至 flying 清空
  for(let k=0;k<20&&A.flying().length;k++) A.draw(0); flush(); }
for(let lv=1;lv<=10;lv++){
  A.startLevel(lv); A.go(); let guard=0;
  while(A.state()==="play" && guard++<500){
    const ts=A.tiles(); const free=ts.filter(t=>t.alive&&!A.isCovered(t,ts)); if(!free.length) break;
    const cnt={}; A.slot().forEach(s=>cnt[s.color]=(cnt[s.color]||0)+1);
    const t=free.find(t=>cnt[t.color]===2)||free.find(t=>cnt[t.color]===1)||free[0];
    A.pick(t,A.tileRect(t)); step();
  }
  console.log("lv",lv,"订单(完成,气走,金币)",A.od().join(","),"结局",A.state(),"剩余",A.tiles().filter(t=>t.alive).length,"篮",A.slot().length);
}
console.log("stars",A.save.stars,"level",A.save.level);
