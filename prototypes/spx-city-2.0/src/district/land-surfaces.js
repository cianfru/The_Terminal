import * as THREE from 'three';
import {pointInRing} from '../fullcity/city-map.js';
const cache=new WeakMap();
export const onLand=(layout,x,z)=>Object.values(layout.land).some(rings=>rings.some(r=>pointInRing(x,z,r)));
export function landTriangles(layout){if(cache.has(layout))return cache.get(layout);const result=[];for(const rings of Object.values(layout.land))for(const ring of rings){const vertices=ring.map(([x,z])=>new THREE.Vector2(x,z));for(const indices of THREE.ShapeUtils.triangulateShape(vertices,[])){const p=indices.map(i=>ring[i]);result.push({p,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1]))});}}cache.set(layout,result);return result;}
// Intersect land triangles with a convex surface footprint; no asphalt can extend into water.
export function clippedSurface(layout,outline,y){const positions=[],xs=outline.map(v=>v[0]),zs=outline.map(v=>v[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);let signed=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];signed+=a[0]*b[1]-b[0]*a[1];}if(Math.abs(signed)<1e-8){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([],3));return g;}const sign=Math.sign(signed);
 for(const tri of landTriangles(layout)){if(tri.maxX<minX||tri.minX>maxX||tri.maxZ<minZ||tri.minZ>maxZ)continue;let poly=tri.p;
  for(let i=0;i<outline.length&&poly.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],side=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),out=[];for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length],sp=side(p),sq=side(q);if(sp>=-1e-8)out.push(p);if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}poly=out;}
  for(let i=1;i<poly.length-1;i++){const a=poly[0],b=poly[i],c=poly[i+1],cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);for(const p of cross<0?[a,b,c]:[a,c,b])positions.push(p[0],y,p[1]);}
 }const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
export const rectangle=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
export function roadOutline(s,width=s.width){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len*width/2,nz=dx/len*width/2;return [[s.a.x+nx,s.a.z+nz],[s.a.x-nx,s.a.z-nz],[s.b.x-nx,s.b.z-nz],[s.b.x+nx,s.b.z+nz]];}
export function safeRoadRuns(layout,road){const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len,steps=Math.ceil(len/2),runs=[];let start=null;
 for(let i=0;i<=steps;i++){const t=i/steps,p={x:road.a.x+dx*t,z:road.a.z+dz*t},valid=[-1,0,1].every(side=>onLand(layout,p.x+nx*side*(road.width/2+.3),p.z+nz*side*(road.width/2+.3)));
 if(valid&&start===null)start=t;if((!valid||i===steps)&&start!==null){const end=valid?t:Math.max(start,(i-1)/steps);if((end-start)*len>8)runs.push({...road,a:{x:road.a.x+dx*start,z:road.a.z+dz*start},b:{x:road.a.x+dx*end,z:road.a.z+dz*end}});start=null;}}
 return runs;
}
