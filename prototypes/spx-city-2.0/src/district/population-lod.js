import * as THREE from 'three';
import {windowSignal} from './window-signal.js';
import {silhouetteParts} from './silhouettes.js';
import {studyArchitecture} from '../fullcity/study-architecture.js';
import {facade} from '../textures.js';

// The overview shares geometry; only a bounded set of nearby wallets owns a detailed facade.
export function detailCandidates(homes,camera,limit){
 return homes.filter(w=>!w.landmark).map(w=>({w,d:(w.x-camera.x)**2+(w.z-camera.z)**2+(w.h*.5-camera.y)**2})).filter(x=>x.d<55**2).sort((a,b)=>a.d-b.d).slice(0,limit).map(x=>x.w);
}
export function populationArchitecture(scene,layout,time,owned,materials){
 const groups=new Map(),slots=new Map(),details=new Map(),dummy=new THREE.Object3D(),cache=new Map();
 const roof=new THREE.MeshStandardMaterial({color:0x65675e,roughness:.85});materials.push(roof);
 for(const w of (layout.ordinaryHomes||layout.homes.slice(12))){const key=w.identity.family+'|'+w.identity.silhouette+'|'+w.identity.palette%3;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(w);}
 for(const homes of groups.values()){
  const first=homes[0],id=first.identity,parts=silhouetteParts(id.silhouette,{width:2.3,depth:2.5,height:12,variant:id.palette%3}),walls=[],tops=[];
  for(const {geometry}of parts){const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();const p=g.attributes.position,n=g.attributes.normal;
   for(let i=0;i<p.count;i+=3){const dest=Math.abs(n.getY(i))>.35?tops:walls;for(let j=i;j<i+3;j++)dest.push(p.getX(j),p.getY(j),p.getZ(j));}g.dispose();}
  const mk=values=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,uv=[];for(let i=0;i<p.count;i++)uv.push((Math.abs(n.getX(i))>Math.abs(n.getZ(i))?p.getZ(i):p.getX(i))/3.68,p.getY(i)/3.36);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));owned.push(g);return g;};
  const key=id.family+'|'+id.palette%3;if(!cache.has(key)){const tx=facade(id.family,id.palette%3);owned.push(...Object.values(tx));const m=new THREE.MeshStandardMaterial({...tx,color:0xffffff,roughness:.7,emissive:0xffffff,emissiveIntensity:windowSignal(first,layout.flowMax,time).intensity});m.onBeforeCompile=shader=>{shader.vertexShader='attribute vec3 walletEmission; varying vec3 vWalletEmission;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.y *= instanceMatrix[1][1];\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv.y *= instanceMatrix[1][1];\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv.y *= instanceMatrix[1][1];\n#endif');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWalletEmission = walletEmission;');shader.fragmentShader='varying vec3 vWalletEmission;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','\n#ifdef USE_EMISSIVEMAP\nfloat walletMask = clamp(texture2D(emissiveMap, vEmissiveMapUv).r * 3.0, 0.0, 1.0);\nwalletMask = pow(walletMask, 0.65);\ntotalEmissiveRadiance *= vWalletEmission * walletMask;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vWalletEmission, walletMask * 0.55);\n#endif\n');};m.customProgramCacheKey=()=> 'wallet-emission-v2';materials.push(m);cache.set(key,m);}
  const meshes=[[walls,cache.get(key)],[tops,roof]].filter(([v])=>v.length).map(([v,m])=>{const geometry=mk(v),signals=[];for(const w of homes){const color=new THREE.Color(windowSignal(w,layout.flowMax,time).color);signals.push(color.r,color.g,color.b);}geometry.setAttribute('walletEmission',new THREE.InstancedBufferAttribute(new Float32Array(signals),3));const mesh=new THREE.InstancedMesh(geometry,m,homes.length);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;});
  homes.forEach((w,i)=>{dummy.position.set(w.x,.17,w.z);dummy.rotation.set(0,0,0);dummy.scale.set(w.identity.width/2.3,w.h/12,w.identity.depth/2.5);dummy.updateMatrix();for(const mesh of meshes)mesh.setMatrixAt(i,dummy.matrix);slots.set(w.a,{meshes,index:i,matrix:dummy.matrix.clone()});});
  for(const mesh of meshes){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 const setOverview=(w,visible)=>{const slot=slots.get(w.a),matrix=visible?slot.matrix:new THREE.Matrix4().makeScale(0,0,0);for(const mesh of slot.meshes){mesh.setMatrixAt(slot.index,matrix);mesh.instanceMatrix.needsUpdate=true;}};
 function remove(address){const d=details.get(address);scene.remove(d.group);d.owned.forEach(x=>x.dispose());d.materials.forEach(x=>x.dispose());setOverview(d.w,true);details.delete(address);}
 let previous=0;
 return {update(camera,now,limit=24){if(now-previous<100)return;previous=now;const wanted=detailCandidates(layout.homes,camera,limit),keep=new Set(wanted.map(w=>w.a));for(const a of details.keys())if(!keep.has(a))remove(a);
   // At most one new facade per update, avoiding an entire neighborhood build in one frame.
   const w=wanted.find(w=>!details.has(w.a));if(w){const group=new THREE.Group(),resources=[],mats=[],builder=studyArchitecture(group,time,resources,mats);builder.emit(w,12,w.h,w.x,w.z,99,{natural:true,rotation:0,manhattan:true,flowMax:layout.flowMax});builder.finish();scene.add(group);details.set(w.a,{w,group,owned:resources,materials:mats});setOverview(w,false);}
  },get count(){return details.size;},dispose(){for(const a of [...details.keys()])remove(a);}};
}
