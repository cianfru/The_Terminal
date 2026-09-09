import {pointInRing} from '../fullcity/city-map.js';
export function nearestOnSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return {x:a.x+t*dx,z:a.z+t*dz};}
export function parkStreetPlan(layout){
 const ring=layout.park[0],cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
 const inset=ring.map(([x,z])=>{const dx=cx-x,dz=cz-z,len=Math.hypot(dx,dz);return {x:x+dx/len*2.2,z:z+dz/len*2.2};});
 const perimeter=inset.map((a,i)=>({a,b:inset[(i+1)%inset.length],width:2.5,parkDrive:true})),connections=[],seen=new Set();
 for(const road of layout.streets)for(const p of [road.a,road.b]){const ends=perimeter.map(s=>nearestOnSegment(p,s.a,s.b)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)),q=ends[0],distance=Math.hypot(q.x-p.x,q.z-p.z);if(distance>11||distance<.1)continue;const key=p.x.toFixed(2)+':'+p.z.toFixed(2);if(seen.has(key))continue;seen.add(key);connections.push({a:p,b:q,width:Math.min(road.width,3.5),parkDrive:true});}
 return {perimeter,connections};
}
export function publicRealmSites(layout){
 const roads=[...layout.streets,...parkStreetPlan(layout).perimeter,...parkStreetPlan(layout).connections];
 const clear=(p,r=1)=>!layout.homes.some(w=>Math.abs(p.x-w.x)<(w.width||w.identity.width)/2+r&&Math.abs(p.z-w.z)<(w.width||w.identity.depth)/2+r)&&!roads.some(s=>{const q=nearestOnSegment(p,s.a,s.b);return Math.hypot(p.x-q.x,p.z-q.z)<s.width/2+r;});
 const shore=[],trees=[];
 // Sample the actual shore on its landward side; keep paths and furniture off roads and parcels.
 for(const [borough,rings] of Object.entries(layout.land))for(const ring of rings){if(borough!=='manhattan'&&borough!=='jersey')continue;let previous=null;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;const steps=Math.max(1,Math.ceil(len/3));for(let k=0;k<steps;k++){const x=a[0]+dx*k/steps,z=a[1]+dz*k/steps;let p;for(const side of [-1,1]){const q={x:x-dz/len*side*1.5,z:z+dx/len*side*1.5};if(pointInRing(q.x,q.z,ring)){p=q;break;}}if(!p||!clear(p,.8)){previous=null;continue;}if(previous&&Math.hypot(previous.x-p.x,previous.z-p.z)<6)shore.push({a:previous,b:p});previous=p;if((i+k)%5===0){const q={x:p.x-dz/len*2,z:p.z+dx/len*2};if(pointInRing(q.x,q.z,ring)&&clear(q,1.1))trees.push(q);}}}
 }
 // Small planted pockets between houses, rather than large unoccupied plazas.
 for(const b of layout.blocks){const p={x:b.x,z:b.z};if(clear(p,.8))trees.push(p);}
 return {shore,trees:trees.slice(0,700)};
}
