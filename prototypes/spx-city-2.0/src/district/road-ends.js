import {onLand,roadOutline} from './land-surfaces.js';
import {nearestOnSegment} from './public-realm.js';
export function roadEndSites(layout){const sites=[],seen=new Set();for(const road of layout.streets)for(const [end,other]of [[road.a,road.b],[road.b,road.a]]){
 const key=end.x.toFixed(2)+','+end.z.toFixed(2);if(seen.has(key))continue;
 if(layout.streets.some(s=>s!==road&&Math.hypot(nearestOnSegment(end,s.a,s.b).x-end.x,nearestOnSegment(end,s.a,s.b).z-end.z)<s.width/2+.6))continue;
 const length=Math.hypot(end.x-other.x,end.z-other.z),ux=(end.x-other.x)/length,uz=(end.z-other.z)/length,a={x:end.x-ux*.5,z:end.z-uz*.5},b={x:end.x+ux*2,z:end.z+uz*2},outline=roadOutline({a,b},road.width+2.4);
 if(!outline.every(([x,z])=>onLand(layout,x,z)))continue;
 if(outline.some(([x,z])=>layout.homes.some(w=>Math.abs(x-w.x)<(w.width||w.identity.width)/2+.6&&Math.abs(z-w.z)<(w.width||w.identity.depth)/2+.6)))continue;
 seen.add(key);sites.push({end,ux,uz,width:road.width,outline});
 }return sites;}
