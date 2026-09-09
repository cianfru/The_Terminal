import * as THREE from 'three';

// Locate a door-sized rectangle supported by the actual, street-visible wall.
// Ray checks at its corners and centre reject courtyard gaps and split wings.
export function entranceFrontage(triangles,side,preferredX,width=.78){
 const bounds=new THREE.Box3();for(const t of triangles)for(const v of [t.a,t.b,t.c])bounds.expandByPoint(v);
 const originZ=side>0?bounds.max.z+2:bounds.min.z-2,ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,0,-side)),hit=new THREE.Vector3();
 const candidates=[preferredX,...triangles.filter(t=>t.getNormal(new THREE.Vector3()).z*side>.99).map(t=>(Math.min(t.a.x,t.b.x,t.c.x)+Math.max(t.a.x,t.b.x,t.c.x))/2)];
 const unique=[...new Set(candidates.map(x=>x.toFixed(4)))].map(Number).sort((a,b)=>Math.abs(a-preferredX)-Math.abs(b-preferredX));
 for(const x of unique){const zs=[];let valid=true;
  for(const dx of [-width/2,0,width/2])for(const y of [.27,.8,1.48]){ray.origin.set(x+dx,y,originZ);let nearest=Infinity,z=null;
   for(const t of triangles){if(!ray.intersectTriangle(t.a,t.b,t.c,false,hit))continue;const d=Math.abs(originZ-hit.z);if(d<nearest){nearest=d;z=t.getNormal(new THREE.Vector3()).z*side>.99?hit.z:null;}}
   if(z===null)valid=false;else zs.push(z);
  }
  if(valid&&Math.max(...zs)-Math.min(...zs)<.006)return {x,z:zs.reduce((a,b)=>a+b,0)/zs.length,width};
 }
 return null;
}
