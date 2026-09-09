// Presentation only: eligibility and scoring mirror SpxCity.jsx.
export function cityTowers(snapshot, win=30) {
 const pool=snapshot.wallets.filter(w=>w.res!==false);
 const maxDays=Math.max(...pool.map(w=>w.days),1),maxBal=Math.max(...pool.map(w=>w.bal),1);
 return pool.map(w=>({...w,score:(w.bal/maxBal)*(.45+.55*w.days/maxDays),ageT:w.days/maxDays,flow:w[`d${win}`]??0}));
}
export function activityStrength(flow,maxFlow) {
 return maxFlow>0 ? Math.log1p(Math.abs(flow))/Math.log1p(maxFlow) : 0;
}
export function summarizeActivity(placed) {
 const rows=new Map();
 for(const t of placed){const id=t.hood?.id??t.hood;const r=rows.get(id)??{id,count:0,active:0,adding:0,reducing:0};r.count++;r.active+=t.flow!==0?1:0;r.adding+=Math.max(0,t.flow);r.reducing+=Math.max(0,-t.flow);rows.set(id,r);}
 return [...rows.values()].sort((a,b)=>(b.adding+b.reducing)-(a.adding+a.reducing));
}
