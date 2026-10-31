// 对单关试参数：node sweep.js  colors,triples,layers,mix ...
process.env.REWARD="slot";process.env.MAXSLOT="9";process.env.CHASE="3";process.env.PATK="11";process.env.PATB="8";
const g=require("./core.js"); const N=200;
const s3=require("./sim3.js"); 
const slotLv=+process.argv[2];
for(const a of process.argv.slice(3)){const [c,t,l,m]=a.split(",").map(Number);Object.assign(g.LEVELS[slotLv-1],{colors:c,triples:t,layers:l,mix:m});
  try{const R=s3.agg(slotLv,false,false),O=s3.agg(slotLv,true,true);console.log(a,"| 裸",R.w+"% | 订单派+道具",O.w+"%  单",O.d,"走",O.l,"币",O.c);}catch(e){console.log(a,"生成失败")}}
