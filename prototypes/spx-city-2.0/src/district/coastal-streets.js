import {onLand} from './land-surfaces.js';
import polygonClipping from 'polygon-clipping';

const length=s=>Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z);
const point=(s,t)=>({x:s.a.x+(s.b.x-s.a.x)*t,z:s.a.z+(s.b.z-s.a.z)*t});
export function shoreDistance(layout){
 // Union first: Jersey's supporting parcels have internal seams, not coastlines.
 const polygons=polygonClipping.union(...Object.values(layout.land).flatMap(rs=>rs.map(r=>[r])));
 const edges=polygons.flatMap(p=>p.flatMap(r=>r.slice(0,-1).map((a,i)=>({a,b:r[i+1]}))));
 return p=>{let best=Infinity;for(const {a,b}of edges){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(p.x-a[0]-dx*t,p.z-a[1]-dz*t));}return best;};
}
function junctions(s,roads){
 const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,result=[];
 for(const r of roads){if(r===s)continue;const ox=r.b.x-r.a.x,oz=r.b.z-r.a.z,det=dx*oz-dz*ox;if(Math.abs(det)<1e-6)continue;const ax=r.a.x-s.a.x,az=r.a.z-s.a.z,t=(ax*oz-az*ox)/det,u=(ax*dz-az*dx)/det;if(t>=0&&t<=1&&u>=0&&u<=1)result.push({t,width:r.width});}
 return result.sort((a,b)=>a.t-b.t);
}
// Asphalt, markings, landscaping and vehicles share this final street network.
export function coastalStreetPlan(layout,source){
 let streets=[];const shoreGardens=[],distance=shoreDistance(layout);
 for(const road of source){
  const len=length(road);if(!len)continue;
  const steps=Math.ceil(len),ranges=[];let start=0,last;
  for(let i=0;i<steps;i++){
   const p=point(road,(i+.5)/steps),dry=onLand(layout,p.x,p.z)&&distance(p)>road.width/2+8.5;
   if(i&&dry!==last){ranges.push({start,end:i/steps,dry:last});start=i/steps;}last=dry;
  }
  ranges.push({start,end:1,dry:last});
  for(const range of ranges){const s={...road,a:point(road,range.start),b:point(road,range.end)};
   // Reject shoreline slivers even if the entire original road technically lies on land.
   const coastalSliver=length(s)<85&&[.15,.35,.5,.65,.85].every(t=>distance(point(s,t))<road.width/2+23);
   if(range.dry&&!coastalSliver)streets.push(s);else if(length(s)>.6)shoreGardens.push(s);
  }
 }
 // Reclaim blind tails at the water, up to the last usable street intersection.
 // Repeat because removing one coastal spur can expose the next dangling end.
 for(let pass=0;pass<3;pass++){
  const next=[];
  for(const s of streets){const len=length(s),js=junctions(s,streets),nearA=distance(s.a)<38,nearB=distance(s.b)<38;let lo=0,hi=1;
   if(!js.length&&len<110&&[0,.25,.5,.75,1].every(t=>distance(point(s,t))<38)){shoreGardens.push(s);continue;}
   if(js.length){if(nearA)lo=Math.max(0,js[0].t-(js[0].width/2+.6)/len);if(nearB)hi=Math.min(1,js.at(-1).t+(js.at(-1).width/2+.6)/len);}
   if(lo*len>.1)shoreGardens.push({...s,b:point(s,lo)});
   if((1-hi)*len>.1)shoreGardens.push({...s,a:point(s,hi)});
   if((hi-lo)*len>.1)next.push({...s,a:point(s,lo),b:point(s,hi)});
  }
  streets=next;
 }
 return {streets,shoreGardens};
}
