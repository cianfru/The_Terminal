import {pointInRing} from '../fullcity/city-map.js';
import {nearestOnSegment} from './public-realm.js';
// Waterfront remains public space: no invented wallet buildings or relocated parcels.
export function waterfrontPlan(layout){
 const segments=[],trees=[],connections=[],pockets=[];
 const homeClear=(p,r)=>!layout.homes.some(w=>Math.abs(p.x-w.x)<(w.width||w.identity.width)/2+r&&Math.abs(p.z-w.z)<(w.width||w.identity.depth)/2+r);
 const roadClear=(p,r)=>!layout.streets.some(s=>{const q=nearestOnSegment(p,s.a,s.b);return Math.hypot(p.x-q.x,p.z-q.z)<s.width/2+r;});
 for(const borough of ['manhattan','bronx','jersey','brooklyn','queens'])for(const ring of layout.land[borough]||[]){
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.1)continue;
   const mid={x:(a[0]+b[0])/2,z:(a[1]+b[1])/2};let nx=-dz/len,nz=dx/len;if(!pointInRing(mid.x+nx,mid.z+nz,ring)){nx=-nx;nz=-nz;}
   const n=Math.ceil(len/3);for(let k=0;k<n;k++){
    const p={x:a[0]+dx*(k+.5)/n,z:a[1]+dz*(k+.5)/n},inland=d=>({x:p.x+nx*d,z:p.z+nz*d}),path=inland(2.8);
    if(!pointInRing(path.x,path.z,ring)||!homeClear(path,2))continue;
    const half=len/n/2,s={a:{x:path.x-dx/len*half,z:path.z-dz/len*half},b:{x:path.x+dx/len*half,z:path.z+dz/len*half},nx,nz,borough};
    // Pedestrian links may meet road ends; planted areas remain strictly off carriageways.
    if(roadClear(path,.2))segments.push(s);
    const planting=inland(6.1);if(pointInRing(planting.x,planting.z,ring)&&homeClear(planting,1.7)&&roadClear(planting,1.7)){
     pockets.push({...planting,w:3,d:len/n,angle:Math.atan2(dx,dz)});
     if(k%2===0)trees.push(planting);
    }
    for(const d of (borough==='bronx'?[10,15]:[10])){const q=inland(d);if(k%3===0&&pointInRing(q.x,q.z,ring)&&homeClear(q,2)&&roadClear(q,2))trees.push(q);}
   }
  }
 }
 const seen=new Set();
 for(const road of layout.streets)for(const end of [road.a,road.b]){
  if(layout.streets.some(s=>s!==road&&Math.hypot(nearestOnSegment(end,s.a,s.b).x-end.x,nearestOnSegment(end,s.a,s.b).z-end.z)<.5))continue;
  const candidates=segments.map(s=>({s,q:nearestOnSegment(end,s.a,s.b)})).sort((a,b)=>Math.hypot(a.q.x-end.x,a.q.z-end.z)-Math.hypot(b.q.x-end.x,b.q.z-end.z));
  const c=candidates[0];if(!c)continue;const distance=Math.hypot(c.q.x-end.x,c.q.z-end.z);if(distance<.5||distance>20)continue;
  const ring=layout.land[c.s.borough][0];let safe=true;for(let j=0;j<=10;j++){const p={x:end.x+(c.q.x-end.x)*j/10,z:end.z+(c.q.z-end.z)*j/10};if(!pointInRing(p.x,p.z,ring)||!homeClear(p,1.1)){safe=false;break;}}
  const key=end.x.toFixed(2)+','+end.z.toFixed(2);if(safe&&!seen.has(key)){seen.add(key);connections.push({a:end,b:c.q,width:2.2});}
 }
 return {segments,trees,pockets,connections};
}
