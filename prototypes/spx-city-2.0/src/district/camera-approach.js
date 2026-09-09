import * as THREE from 'three';
import {nearestOnSegment} from './public-realm.js';
export function cameraApproach(layout,home,street=false){
 const target=new THREE.Vector3(home.x,street?1.3:home.h*.42,home.z),candidates=[];
 for(const road of layout.streets){const p=nearestOnSegment({x:home.x,z:home.z},road.a,road.b);if(Math.hypot(p.x-home.x,p.z-home.z)>30)continue;const a=new THREE.Vector3(road.a.x,0,road.a.z),b=new THREE.Vector3(road.b.x,0,road.b.z),dir=b.clone().sub(a).normalize(),length=a.distanceTo(b),along=new THREE.Vector3(p.x,0,p.z).sub(a).dot(dir);
 for(const step of [-24,-12,12,24]){const position=a.clone().addScaledVector(dir,THREE.MathUtils.clamp(along+step,3,length-3));position.y=street?5:Math.max(10,home.h*.8);const distance=position.distanceTo(target);if(distance<10||distance>70)continue;const ray=new THREE.Ray(position,target.clone().sub(position).normalize());let hits=0;
 for(const w of layout.homes){if(w.a===home.a||Math.hypot(w.x-home.x,w.z-home.z)>75)continue;const box=new THREE.Box3(new THREE.Vector3(w.x-w.identity.width/2,0,w.z-w.identity.depth/2),new THREE.Vector3(w.x+w.identity.width/2,w.h,w.z+w.identity.depth/2)),hit=ray.intersectBox(box,new THREE.Vector3());if(hit&&hit.distanceTo(position)<distance-.5)hits++;}
 candidates.push({position,target,score:hits*1000+Math.abs(distance-(street?20:home.h*1.8))});}}
 return candidates.sort((a,b)=>a.score-b.score)[0]||{target,position:target.clone().add(new THREE.Vector3(25,20,30))};
}
