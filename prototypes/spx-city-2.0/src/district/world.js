import {harborInfrastructure} from './harbor-infrastructure.js';
import {streetDetail} from './street-detail.js';
import {blockQuality} from './block-quality.js';
import {clippedSurface,rectangle,onLand} from './land-surfaces.js';
import {waterNormalTexture} from '../fullcity/city-render.js';
import {geographicGround,geographicLandscape} from './geographic-world.js';
import {refinedPopulation} from './refined-population.js';
import {trafficFleet} from './vehicles.js';
import {roadMarkings} from './road-markings.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {studyArchitecture} from '../fullcity/study-architecture.js';
import {empireInstance} from '../fullcity/visual-layer.js';
import {AXIS_ANGLE} from '../fullcity/city-map.js';
import {environment,facade} from '../textures.js';
export function districtWorld(renderer,layout,time,asset,imported=false,liberty=null){
 const scene=new THREE.Scene(),owned=[],materials=[],buckets=new Map(),night=time==='night',dusk=time==='dusk';
 const mat=(color,roughness=.85,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness,...extra});materials.push(m);return m;};
 const put=(g,m)=>{if(g.index){const a=g;g=g.toNonIndexed();a.dispose();}if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);};
 const box=(x,y,z,w,h,d,m)=>{if(layout.geographic&&y>=0&&y+h/2<.32&&!rectangle(x,z,w,d).every(([x,z])=>onLand(layout,x,z))){put(clippedSurface(layout,rectangle(x,z,w,d),y+h/2),m);return;}const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);put(g,m);};
 const cyl=(x,y,z,r,h,m,n=8)=>{const g=new THREE.CylinderGeometry(r,r*1.08,h,n);g.translate(x,y,z);put(g,m);};
 const sky=environment(time),pm=new THREE.PMREMGenerator(renderer),env=pm.fromEquirectangular(sky);pm.dispose();scene.background=sky;scene.environment=env.texture;scene.environmentIntensity=dusk?.6:1;owned.push(sky,env);scene.fog=new THREE.Fog(night?0x1c3039:dusk?0xc2a593:0xb9c8c7,Math.max(170,layout.depth*(dusk?1.65:2)),Math.max(420,layout.depth*(dusk?3.5:4)));
 scene.add(new THREE.HemisphereLight(night?0x648398:dusk?0x94a7c6:0xc9e2ee,dusk?0x8c8065:0x7b6d59,night?.7:dusk?.9:.95));scene.add(new THREE.AmbientLight(0xffffff,night?.2:dusk?.22:.32));
 const sun=new THREE.DirectionalLight(night?0x9bbbd8:dusk?0xffc994:0xfff2da,night?1:dusk?2.6:2.8);sun.position.set(-70,95,65);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:250});sun.shadow.bias=-.00012;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
 const asphalt=mat(0x515957),paving=mat(0xbeb7a4),curb=mat(0xd2cbb8),stone=mat(0xa49f8d),seam=mat(0xaaa594),grass=mat(0x82966c),wood=mat(0x725d46),metal=mat(0x53605b,.5,{metalness:.5}),paint=mat(0xe3dfc9),trunk=mat(0x75614b),leaves=[mat(0x5a7748),mat(0x76915b),mat(0x67854e)],lamp=mat(0xffedbe,.35,{emissive:0xffd289,emissiveIntensity:night?3:dusk?1.1:.4});
 const mid=(layout.minZ+layout.maxZ)/2;
 const water=mat(night?0x284852:dusk?0x587b80:0x628b90,.32,{metalness:.2,envMapIntensity:.8});const ripple=layout.geographic?waterNormalTexture():null;if(ripple){ripple.repeat.set(100,100);owned.push(ripple);water.normalMap=ripple;water.normalScale=new THREE.Vector2(.5,.5);water.roughness=.48;}const sea=new THREE.PlaneGeometry(layout.full?5000:1200,layout.full?5000:1200);sea.rotateX(-Math.PI/2);sea.translate(0,-.45,0);put(sea,water);
 if(layout.geographic)geographicGround(layout,{put,box,mat,asphalt,grass,paving,time});else {box(0,-.27,mid,layout.width,.5,layout.depth,stone);box(0,.002,mid,layout.width-.2,.04,layout.depth-.2,asphalt);}
 const plant=(x,z,scale=1)=>{if(layout.geographic&&!rectangle(x,z,1.3,1.3).every(([x,z])=>onLand(layout,x,z)))return;box(x,.18,z,.65,.18,.65,curb);box(x,.28,z,.54,.035,.54,grass);cyl(x,.78,z,.055,1.1*scale,trunk);for(let k=0;k<3;k++){const g=new THREE.IcosahedronGeometry(.38*scale,1);g.scale(1,1.4,1);g.translate(x+Math.sin(k*2.3)*.1*scale,1.22*scale+k*.12,z+Math.cos(k*2.3)*.1*scale);put(g,leaves[k]);}};
 const bench=(x,z)=>{if(layout.geographic&&!rectangle(x,z,1.2,.8).every(([x,z])=>onLand(layout,x,z)))return;box(x,.44,z,.85,.08,.28,wood);box(x,.65,z+.13,.85,.3,.04,wood);for(const dx of [-.29,.29])box(x+dx,.25,z,.035,.3,.25,metal);};
 const homesByAddress=new Map(layout.homes.map(w=>[w.a,w]));
 for(const b of layout.blocks){const residential=layout.originalGrid&&b.borough!=='manhattan';if(layout.geographic){put(clippedSurface(layout,rectangle(b.x,b.z,b.w,b.d),.18),curb);put(clippedSurface(layout,rectangle(b.x,b.z,b.w-.12,b.d-.12),.198),residential?grass:paving);}else{box(b.x,.09,b.z,b.w,.18,b.d,curb);box(b.x,.185,b.z,b.w-.12,.025,b.d-.12,residential?grass:paving);}
  if(residential){for(const side of [-1,1]){box(b.x,.205,b.z+side*(b.d/2-.3),b.w-.2,.02,.5,paving);box(b.x+side*(b.w/2-.3),.205,b.z,.5,.02,b.d-.2,paving);}for(const address of b.homes){const w=homesByAddress.get(address),side=w.z>b.z?1:-1,z1=w.z+side*w.identity.depth/2,z2=b.z+side*(b.d/2-.3);box(w.x,.215,(z1+z2)/2,.65,.025,Math.abs(z2-z1)+.12,paving);}}
  for(let x=-b.w/2+.6;x<b.w/2;x+=.8){box(b.x+x,.201,b.z-b.d/2+.45,.012,.006,.75,seam);box(b.x+x,.201,b.z+b.d/2-.45,.012,.006,.75,seam);}
  if(layout.perBlock===8){box(b.x,.22,b.z,b.w-2,.035,2.2,grass);box(b.x,.25,b.z,b.w-2,.03,.7,paving);for(const dx of [-3,0,3]){plant(b.x+dx,b.z+.8,.8);bench(b.x+dx,b.z-.75);}}
  if(layout.originalGrid){for(const sx of [-1,1])plant(b.x+sx*(b.w/2-.3),b.z,.65);}else for(const sx of [-1,1])for(const sz of [-1,1]){const x=b.x+sx*(b.w/2-.43),z=b.z+sz*(b.d/2-1.53);plant(x,z,.85);cyl(x-sx*.7,.96,z,.023,1.6,metal);box(x-sx*.7,1.78,z,.25,.08,.19,lamp);}
  bench(b.x,b.z+b.d/2-.43);
 }
 // Unoccupied cells become a public garden, never invented wallet buildings.
 for(const b of layout.gardens){const {x,z,w,d}=b;box(x,.13,z,w,.2,d,paving);box(x,.24,z,w-1,.025,d-1,grass);
  // A cross-path, central fountain and seating give each garden a destination.
  box(x,.27,z,1.2,.035,d-.8,paving);box(x,.27,z,w-.8,.035,1.2,paving);
  cyl(x,.36,z,1.05,.24,stone,24);cyl(x,.49,z,.88,.035,water,24);cyl(x,.66,z,.2,.35,stone,16);
  for(const dx of [-1,1])for(const dz of [-1,1]){plant(x+dx*(w/2-1.7),z+dz*(d/2-1.7),1.4);plant(x+dx*(w/2-3),z+dz*(d/2-1.6),1);bench(x+dx*2,z+dz*1.8);}
 }
 for(let slot=layout.geographic?Infinity:layout.homes.length-layout.housingStart;slot<layout.blocks.length*layout.perBlock;slot++){const b=layout.blocks[Math.floor(slot/layout.perBlock)],j=slot%layout.perBlock,x=b.x+(j%layout.lotCols-(layout.lotCols-1)/2)*layout.lotX,z=b.z+(Math.floor(j/layout.lotCols)-(layout.lotRows-1)/2)*layout.lotZ;box(x,.23,z,layout.lotX-.3,.04,layout.lotZ-.3,grass);plant(x,z,.8);}
 // Twelve generous landmark parcels, each with its own entrance apron and planting.
 if(!layout.originalGrid)layout.homes.slice(0,12).forEach((w,i)=>{const b=layout.landmarkBlocks[i];box(w.x,.09,w.z,b.w,.18,b.d,curb);box(w.x,.185,w.z,b.w-.15,.025,b.d-.15,paving);
  for(const dx of [-1,1])for(const dz of [-1,1]){plant(w.x+dx*(b.w/2-.65),w.z+dz*(b.d/2-1.85),1.1);bench(w.x+dx*1.5,w.z+dz*(b.d/2-.65));}
  for(let k=-Math.floor(b.w/2)+1;k<b.w/2;k++)box(w.x+k,.202,w.z,.012,.006,b.d-.25,seam);
 });
 // Full-width crossings at sidewalk approaches, with clear junction centers.
 for(const m of (layout.geographic?[]:roadMarkings(layout).markings))box(m.x,.032,m.z,m.w,.006,m.d,paint);
 // A generous public waterfront, sized independently from wallet parcels.
 if(!layout.geographic){box(0,.1,layout.maxZ-2,layout.width-.2,.24,5.5,paving);
 for(let x=-layout.width/2+2;x<layout.width/2-1;x+=3.3){plant(x,layout.maxZ-2.4);bench(x+1.2,layout.maxZ-1.4);}
 for(let x=-layout.width/2+.4;x<layout.width/2;x+=.8)cyl(x,.57,layout.maxZ+.5,.022,.72,metal,6);
 for(const y of [.38,.79])box(0,y,layout.maxZ+.5,layout.width-.6,.025,.025,metal);
 for(const x of [-layout.width*.28,layout.width*.28]){box(x,-.02,layout.maxZ+4.5,3.4,.28,8,wood);for(let z=layout.maxZ+.7;z<layout.maxZ+8.3;z+=.24)box(x,.125,z,3.35,.007,.014,metal);}
 }
 if(layout.geographic)geographicLandscape(scene,layout,liberty,owned,materials,time);
 // Study 03 details are used at their natural house widths; landmarks set the larger scale.
 const architecture=studyArchitecture(scene,time,owned,materials),picks=[];
 layout.homes.forEach((w,i)=>{
  if(layout.full && i>=12){picks.push(w);return;}
  if(i===0 && asset && imported){const tx=facade('concrete',1);owned.push(...Object.values(tx));const m=mat(0xffffff,.82,{...tx,metalness:.05,emissive:0xffd19a,emissiveIntensity:night?1.3:.18});const g=empireInstance(asset,{x:w.x,z:w.z,height:w.h,width:999,material:m,disposables:owned});g.rotation.y=0;scene.add(g);}
  else {architecture.emit(w,i,w.h,w.x,w.z,w.width||99,{natural:true,rotation:0,manhattan:true,refined:true,flowMax:layout.flowMax});}
  picks.push(w);
 });
 architecture.finish();
 const lod=layout.full?refinedPopulation(scene,layout,time,owned,materials):null;
 // Undo the production grid bearing: this district has its own straight street plan.
 // Merged architectural geometry was rotated locally, so reverse around each parcel below via emit option.
 const flowMax=layout.flowMax||Math.max(...layout.homes.map(w=>Math.abs(w.flow)),1),beamMats=[new THREE.MeshBasicMaterial({color:0x22c55e,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),new THREE.MeshBasicMaterial({color:0xf43f5e,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide})];materials.push(...beamMats);
 for(const w of layout.homes){const f=w.flow/flowMax,mag=Math.min(1,Math.abs(f)*3);if(Math.abs(f)>.02&&mag>.12){const h=3.5+9*mag+w.h*.35,g=new THREE.CylinderGeometry(.1,.18,h,10,1,true);g.translate(w.x,w.h+h/2+.6,w.z);put(g,beamMats[f>0?0:1]);}}
 streetDetail(scene,layout,time,owned,materials,{put,mat});
 harborInfrastructure(scene,layout,time,owned,materials,{put,mat});
 for(const [m,gs]of buckets){const g=mergeGeometries(gs,false);gs.forEach(x=>x.dispose());owned.push(g);const mesh=new THREE.Mesh(g,m);mesh.castShadow=![water,asphalt,paving,paint,beamMats[0],beamMats[1]].includes(m);mesh.receiveShadow=true;scene.add(mesh);}
 // Release construction buffers after merging; retain only renderable geometry.
 buckets.clear();
 const pickG=new THREE.BoxGeometry(1,1,1),pickM=new THREE.MeshBasicMaterial({visible:false}),pickMesh=new THREE.InstancedMesh(pickG,pickM,picks.length),dummy=new THREE.Object3D();owned.push(pickG);materials.push(pickM);picks.forEach((w,i)=>{dummy.position.set(w.x,w.h/2+.17,w.z);dummy.scale.set(w.width||w.identity.width,w.h,w.width||w.identity.depth);dummy.updateMatrix();pickMesh.setMatrixAt(i,dummy.matrix);});scene.add(pickMesh);
 const quality=blockQuality(scene,layout,time,owned,materials,{rollout:true});
 const traffic=trafficFleet(scene,layout,owned,materials,time);
 return {quality,waterMotion:now=>{if(ripple)ripple.offset.set(now*.000004,now*.000002);},lod,scene,fog:scene.fog,pickMesh,picks,traffic,sun,sunOffset:new THREE.Vector3(-55,dusk?32:85,45),dispose(){lod?.dispose();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.clear();owned.length=0;materials.length=0;buckets.clear();}};
}
