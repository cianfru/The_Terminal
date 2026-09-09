import {onLand} from './land-surfaces.js';
import {nearestOnSegment} from './public-realm.js';
import {pointInRing} from '../fullcity/city-map.js';
export function urbanGreens(layout,waterfront=null){
 const cells=new Map(),size=20,insert=(item,x0,z0,x1,z1)=>{for(let x=Math.floor(x0/size);x<=Math.floor(x1/size);x++)for(let z=Math.floor(z0/size);z<=Math.floor(z1/size);z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(item);}};
 for(const h of layout.homes){const w=(h.width||h.identity.width)/2,d=(h.width||h.identity.depth)/2;insert({h,w,d},h.x-w-8,h.z-d-8,h.x+w+8,h.z+d+8);}
 for(const r of layout.streets)insert({r},Math.min(r.a.x,r.b.x)-r.width/2-8,Math.min(r.a.z,r.b.z)-r.width/2-8,Math.max(r.a.x,r.b.x)+r.width/2+8,Math.max(r.a.z,r.b.z)+r.width/2+8);
 const clear=(x,z,radius)=>onLand(layout,x,z)&&!layout.park.some(r=>pointInRing(x,z,r))&&!(cells.get(Math.floor(x/size)+','+Math.floor(z/size))||[]).some(o=>o.h?Math.abs(x-o.h.x)<o.w+radius&&Math.abs(z-o.h.z)<o.d+radius:Math.hypot(x-nearestOnSegment({x,z},o.r.a,o.r.b).x,z-nearestOnSegment({x,z},o.r.a,o.r.b).z)<o.r.width/2+radius);
 const trees=[],paths=[],beds=[],seats=[];
 // Complete garden loops with open centres and clustered edge planting.
 for(const [borough,rings]of Object.entries(layout.land))for(const ring of rings){let gardens=0;const gardenLoops=[];const minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
 for(let x=minX+18;x<maxX-15&&gardens<40;x+=36)for(let z=minZ+18;z<maxZ-15&&gardens<40;z+=36){if(!pointInRing(x,z,ring)||!clear(x,z,5))continue;const rx=9+Math.abs(Math.round(x*7+z*3))%4,rz=6+Math.abs(Math.round(x*3-z*5))%4,rotation=Math.sin(x*.13+z*.08)*.7;const loop=Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return {x:x+Math.cos(a)*rx*Math.cos(rotation)-Math.sin(a)*rz*Math.sin(rotation),z:z+Math.cos(a)*rx*Math.sin(rotation)+Math.sin(a)*rz*Math.cos(rotation)};});if(!loop.every(p=>clear(p.x,p.z,2)))continue;
 for(let i=0;i<loop.length;i++)paths.push({borough,a:loop[i],b:loop[(i+1)%loop.length]});
 const neighboring=gardenLoops.filter(g=>Math.hypot(g.x-x,g.z-z)<55).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));
 for(const previous of neighboring.slice(0,2)){let pair=null;for(const a of loop)for(const b of previous.loop){const distance=Math.hypot(a.x-b.x,a.z-b.z);if(!pair||distance<pair.distance)pair={a,b,distance};}const steps=Math.ceil(pair.distance);if(Array.from({length:steps+1},(_,i)=>({x:pair.a.x+(pair.b.x-pair.a.x)*i/Math.max(1,steps),z:pair.a.z+(pair.b.z-pair.a.z)*i/Math.max(1,steps)})).every(p=>clear(p.x,p.z,1)))paths.push({borough,a:pair.a,b:pair.b});}
 gardenLoops.push({x,z,loop});beds.push({borough,x,z});gardens++;
 for(const side of [-1,1])if(clear(x+side*7.5,z,1.3))seats.push({x:x+side*7.5,z,borough});
 if(waterfront){const connections=waterfront.segments.map(s=>nearestOnSegment({x,z},s.a,s.b)).filter(p=>Math.hypot(p.x-x,p.z-z)<45).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));for(const end of connections.slice(0,3)){const start=[...loop].sort((a,b)=>Math.hypot(a.x-end.x,a.z-end.z)-Math.hypot(b.x-end.x,b.z-end.z))[0];const steps=Math.ceil(Math.hypot(end.x-start.x,end.z-start.z));if(Array.from({length:steps+1},(_,i)=>({x:start.x+(end.x-start.x)*i/Math.max(1,steps),z:start.z+(end.z-start.z)*i/Math.max(1,steps)})).every(p=>clear(p.x,p.z,1))){paths.push({borough,a:start,b:end});break;}}}

 for(let i=0;i<12;i++){if(i%5===0)continue;const a=i/12*Math.PI*2,p={x:x+Math.cos(a)*(rx+3)*Math.cos(rotation)-Math.sin(a)*(rz+3)*Math.sin(rotation),z:z+Math.cos(a)*(rx+3)*Math.sin(rotation)+Math.sin(a)*(rz+3)*Math.cos(rotation)};if(clear(p.x,p.z,2))trees.push({...p,borough,scale:.85+(i%4)*.18,form:i%3});}
 }}return {trees,paths,beds,seats,clear};
}
