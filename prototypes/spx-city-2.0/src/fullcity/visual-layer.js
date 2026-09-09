import * as THREE from 'three';
import {AXIS_ANGLE,streetGrid} from './city-map.js';
import {activityStrength} from './activity.js';
export function activityParcels(scene,towers,pts,maxFlow,disposables,ownMats){
 const geo=new THREE.PlaneGeometry(.95,.95);geo.rotateX(-Math.PI/2);geo.rotateY(-AXIS_ANGLE);
 const mat=new THREE.MeshBasicMaterial({toneMapped:false});
 const mesh=new THREE.InstancedMesh(geo,mat,towers.length),matrix=new THREE.Matrix4(),color=new THREE.Color();
 towers.forEach((t,i)=>{matrix.makeTranslation(pts[i].x,.19,pts[i].z);mesh.setMatrixAt(i,matrix);const s=activityStrength(t.flow,maxFlow);color.set(t.flow>0?'#36ff9b':t.flow<0?'#ff4269':'#182832');if(t.flow)color.multiplyScalar(.3+1.7*s);mesh.setColorAt(i,color);});
 scene.add(mesh);disposables.push(geo);ownMats.push(mat);
}
export function empireInstance(asset,{x,z,height,width,material,disposables}){
 const root=asset.clone(true);root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 // Fit within the existing landmark envelope, adapting its horizontal footprint to the data-driven city scale.
 const scaleY=height/size.y,scaleXZ=Math.min(scaleY,width/Math.max(size.x,size.z));
 const group=new THREE.Group();
 root.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(o.matrixWorld);geo.translate(-center.x,-box.min.y,-center.z);geo.scale(scaleXZ,scaleY,scaleXZ);geo.computeVertexNormals();
 const pos=geo.attributes.position,normal=geo.attributes.normal,uv=new Float32Array(pos.count*2);
 for(let i=0;i<pos.count;i++){uv[i*2]=(Math.abs(normal.getX(i))>Math.abs(normal.getZ(i))?pos.getZ(i):pos.getX(i))/(.46*8);uv[i*2+1]=pos.getY(i)/(.42*8);}
 geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));const m=new THREE.Mesh(geo,material);m.castShadow=m.receiveShadow=true;group.add(m);disposables.push(geo);});
 group.position.set(x,0,z);group.rotation.y=-AXIS_ANGLE;return group;
}
export function ambientTraffic(scene,K,disposables,ownMats){
 const roads=streetGrid(K).filter(s=>Math.hypot(s.x2-s.x1,s.z2-s.z1)>8).filter((_,i)=>i%7===0).slice(0,36);
 const geo=new THREE.BoxGeometry(.18,.11,.38),mat=new THREE.MeshStandardMaterial({color:0xe9b64a,roughness:.5});
 const mesh=new THREE.InstancedMesh(geo,mat,roads.length),dummy=new THREE.Object3D();scene.add(mesh);disposables.push(geo);ownMats.push(mat);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,start=performance.now();
 return ()=>{const t=reduced?0:(performance.now()-start)/1000;roads.forEach((s,i)=>{const len=Math.hypot(s.x2-s.x1,s.z2-s.z1),p=(i*.618+t*.5/len)%1;dummy.position.set(s.x1+(s.x2-s.x1)*p,.18,s.z1+(s.z2-s.z1)*p);dummy.rotation.y=Math.atan2(s.x2-s.x1,s.z2-s.z1);dummy.scale.setScalar(Math.min(1,p*20,(1-p)*20));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;};
}
