import {windowSignal} from '../district/window-signal.js';
import {detailedFacade} from '../district/facade-detail.js';
import {silhouetteParts} from '../district/silhouettes.js';
import {manhattanForm} from '../district/manhattan.js';
import {chryslerCrown} from '../district/chrysler.js';
// Study 03 architectural geometry, fitted to production wallet envelopes.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {landmarkWall,landmarkDetails,LANDMARKS} from '../landmarks.js';
import {buildingIdentity} from '../identity.js';
import {hash,newForm,walletSignal} from '../model.js';
import {archetype,wallGeometry,roofGeometry} from '../production-render.js';
import {facade} from '../textures.js';
import {AXIS_ANGLE} from './city-map.js';
export function studyArchitecture(scene,time,disposables,ownMats){
 const buckets=new Map(),textures=new Map(),materials=new Map(),accents=new Map();
 let local=[];
 const keep=x=>{(x.isMaterial?ownMats:disposables).push(x);return x;};
 const mat=(color,roughness=.85,extra={})=>keep(new THREE.MeshStandardMaterial({color,roughness,...extra}));
 const roof=mat(0x65675e),metal=mat(0x596461,.52,{metalness:.55}),wood=mat(0x665341),trim=mat(0xc5bda5),dark=mat(0x273938,.45),bronze=mat(0x8a7a5b,.55,{metalness:.5}),copper=mat(0x458a79,.45,{metalness:.45});
 const silver=mat(0xcbd3d3,.27,{metalness:.65});
 const proposed=true,groundTop=0,night=time==='night',signal=true;
 const put=(geometry,material)=>{
  if(material.map && geometry.attributes.normal){const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2);for(let j=0;j<p.count;j++){uv[j*2]=(Math.abs(n.getX(j))>Math.abs(n.getZ(j))?p.getZ(j):p.getX(j))/(.46*8);uv[j*2+1]=p.getY(j)/(.42*8);}geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
  local.push({geometry,material});
 };
 const box=(x,y,z,w,h,d,m)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);put(g,m);};
 const cyl=(x,y,z,rt,rb,h,m,n=8)=>{const g=new THREE.CylinderGeometry(rt,rb,h,n);g.translate(x,y,z);put(g,m);};
 const rail=(a,b,r,m)=>{const v=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());put(g,m);};

 const accentFor=w=>{const key=walletSignal(w,1).color;if(!accents.has(key))accents.set(key,keep(new THREE.MeshBasicMaterial({color:key,toneMapped:false})));return accents.get(key);};
 const getWall=(w,kind,variant)=>{
  const age=Math.min(5,Math.floor(w.ageT*6)),key=`${kind}|${variant}|${age}`;
  if(materials.has(key))return materials.get(key);
  const tk=kind+'|'+variant;if(!textures.has(tk)){const tx=facade(kind,variant);Object.values(tx).forEach(keep);textures.set(tk,tx);}
  const m=mat(0xffffff,kind==='glass'?.26:.86,{...textures.get(tk),normalScale:new THREE.Vector2(.25,.25),metalness:kind==='glass'?.35:.015,envMapIntensity:kind==='glass'?1.2:.5,emissive:walletSignal(w,1).age,emissiveIntensity:night?1.8:time==='day'?.25:.55});materials.set(key,m);return m;
 };
 function emit(t,i,height,x,z,envelope,options={}){
  const identity=options.manhattan?t.identity:buildingIdentity(t.a),landmark=i<12?LANDMARKS[i].id:null;
  const w={...t,d30:t.flow,h:height,x:0,z:0,rank:i+1,seed:hash(t.a),identity,landmark,family:landmark?LANDMARKS[i].family:identity.family};
  local=[];
  if(options.manhattan&&!landmark){
   const visualSignal=windowSignal(w,options.flowMax,time),signalClass=visualSignal.direction;
   const palette=w.identity.palette%4,key=`detail|${w.family}|${palette}|${Math.floor(w.ageT*6)}|${signalClass}|${!!options.refined}`;
   if(!materials.has(key)){
    const color=w.family==='glass'?[0x5c7070,0x697b7c,0x596a72,0x79827d][palette]:(options.refined?[0xa17d65,0xb6a48b,0xc0b59f,0x8f7968]:[0xc7c0af,0xb3aea1,0xd0cbbb,0xa4aaa3])[palette];
    const f=w.flow/(options.flowMax||1),active=Math.abs(f)>.04;
    const signal=visualSignal.color,glow=options.refined?(time==='day'?.12:time==='night'?.95:.42):visualSignal.intensity;
    materials.set(key,{wall:mat(color,.8),roof,structure:trim,recess:mat(0x273938,.8,{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),window:mat(options.refined?0x3e5358:signal,.24,{emissive:signal,emissiveIntensity:options.refined?.025:visualSignal.intensity*.32,metalness:.4,envMapIntensity:1.1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),litWindow:mat(options.refined?0x788780:signal,.3,{metalness:.2,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,emissive:signal,emissiveIntensity:glow}),garden:copper});
   }
   const finishes=materials.get(key);
   for(const k of ['window','litWindow','recess'])finishes[k].userData.facadeOverlay=true;
   for(const {geometry,role}of detailedFacade(silhouetteParts(w.identity.silhouette,{width:w.identity.width,depth:w.identity.depth,height:w.h,variant:w.identity.palette}),{height:w.h,glass:w.family==='glass',seed:w.identity.palette,litCount:options.refined?2:4}))put(geometry,finishes[role]||trim);
   flush(x,z,envelope,w,options);return;
  }

  const original=archetype(w.h,w.seed,w.rank<=3?w.rank-1:-1),form=options.manhattan&&!landmark?manhattanForm(w):proposed?newForm(w):original;
  const variant=w.landmark?Math.floor(hash(w.a+'material')*(w.family==='masonry'?5:3)):w.identity.windows*1000+w.identity.palette%5,wallMat=getWall(w,proposed?w.family:(w.h>=11?'glass':w.h>=6?'concrete':'masonry'),proposed?variant:0);
  let roofY=0,maxW=0,maxD=0;
  for(const q of form.parts){
   const custom=proposed&&w.landmark?landmarkWall(q,w):null;
   const g=custom||wallGeometry(q.w,q.d,q.h);g.translate(w.x+(q.x||0),q.y+groundTop,w.z+(q.z||0));put(g,wallMat);
   if(!custom){const lid=roofGeometry(q.w,q.d);lid.translate(w.x+(q.x||0),q.y+q.h/2+groundTop,w.z+(q.z||0));put(lid,roof);}
   roofY=Math.max(roofY,q.y+q.h/2);maxW=Math.max(maxW,q.w);maxD=Math.max(maxD,q.d);
   if(proposed&&!custom){
    const band=w.family==='glass'?metal:trim;
    const accent=options.manhattan?metal:accentFor(w);
    const ay=q.y+q.h/2+groundTop-.032;
    for(const dz of [-q.d/2-.023,q.d/2+.023])box((w.x+(q.x||0)),ay,(w.z+(q.z||0))+dz,q.w+.04,.065,.024,accent);
    for(const dx of [-q.w/2-.023,q.w/2+.023])box((w.x+(q.x||0))+dx,ay,(w.z+(q.z||0)),.024,.065,q.d+.04,accent);
    const by=q.y+q.h/2+groundTop-.025;
    for(const dz of [-q.d/2,q.d/2])box((w.x+(q.x||0)),by,(w.z+(q.z||0))+dz,q.w,.05,.045,band);
    for(const dx of [-q.w/2,q.w/2])box((w.x+(q.x||0))+dx,by,(w.z+(q.z||0)),.045,.05,q.d,band);
    if(w.family==='glass'){
     for(let xx=-q.w/2;xx<=q.w/2+.01;xx+=q.w/4){box((w.x+(q.x||0))+xx,q.y+groundTop,(w.z+(q.z||0))+q.d/2,.018,q.h,.022,bronze);box((w.x+(q.x||0))+xx,q.y+groundTop,(w.z+(q.z||0))-q.d/2,.018,q.h,.022,bronze);}
    }else{
     for(const dx of [-q.w/2+.07,q.w/2-.07]){box((w.x+(q.x||0))+dx,q.y+groundTop,(w.z+(q.z||0))+q.d/2+.016,.045,q.h,.037,trim);}
    }
   }
  }
  if(!proposed&&original.spire>0)cyl(w.x,groundTop+roofY+original.spire/2,w.z,.035,.075,original.spire,metal,6);
  const top=form.parts.at(-1);
  if(proposed){
   if(options.natural && w.landmark==='chrysler')chryslerCrown(w,{put,box,cyl,metal:silver,dark,ground:groundTop});else if(w.landmark)landmarkDetails(w,{put,box,cyl,rail,wall:wallMat,trim,metal,bronze:copper,accent:options.manhattan?metal:accentFor(w),ground:groundTop});
   const remain=(w.landmark||w.identity)?0:w.h-roofY;
   if(remain>.13){
    const tankH=Math.min(.44,remain*.62),tower=w.family==='masonry'&&w.seed>.38;
    if(tower){cyl(w.x+.22,groundTop+roofY+tankH*.5,w.z-.22,.12,.12,tankH,wood,12);cyl(w.x+.22,groundTop+roofY+tankH*1.13,w.z-.22,0,.15,tankH*.26,metal,12);}
    else box(w.x,groundTop+roofY+remain*.3,w.z,.35,remain*.6,.55,metal);
   }
   if(!w.landmark){
    const id=w.identity,roofH=Math.min(w.h*.11,.65),baseY=groundTop+roofY,rw=top.w,rd=top.d,rx=w.x+(top.x||0),rz=w.z+(top.z||0);
    const roofMat=id.facade===3?bronze:roof;
    if(id.roof===1){const g=new THREE.CylinderGeometry(rw*.32,rw*.68,roofH,4);g.rotateY(Math.PI/4);g.scale(1,1,rd/rw);g.translate(rx,baseY+roofH/2,rz);put(g,roofMat);}
    else if(id.roof===2||id.roof===4){const n=id.roof===4?3:1;for(let i=0;i<n;i++){
     const d=rd/n,c=rz-rd/2+d*(i+.5),v=[-rw/2,0,-d/2,rw/2,0,-d/2,0,roofH,-d/2,-rw/2,0,d/2,rw/2,0,d/2,0,roofH,d/2];
     const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1,0,1,4,0,4,3]);g.computeVertexNormals();g.translate(rx,baseY,c);put(g,roofMat);
    }}else if(id.roofGarden){box(rx,baseY+.02,rz,rw*.6,.04,rd*.6,wood);for(const dx of [-.2,.2])cyl(rx+dx,baseY+.075,rz,.09,.09,.1,bronze,8);}
    const front=w.z+maxD/2+.02;
    if(id.entrance===1){for(let i=0;i<3;i++)box(w.x-.15,groundTop+.02+i*.025,front+.04+i*.03,.33,.04,.17-i*.035,trim);}
    if(id.awnings>0)box(w.x,groundTop+Math.min(.7,w.h*.3),front+.07,maxW*.7,.035,.18,id.awnings===1?bronze:id.awnings===2?dark:trim);
    if(id.balconies&&w.h>2){for(let y=1.1;y<Math.min(w.h*.72,5);y+=.75){const side=id.balconies===1?-.22:.22;box(w.x+side,groundTop+y,front+.025,.35,.025,.08,metal);box(w.x+side,groundTop+y+.09,front+.06,.35,.012,.012,metal);for(const dx of [-.15,0,.15])box(w.x+side+dx,groundTop+y+.045,front+.06,.009,.09,.009,metal);}}
   }
   // Continuous street frontage, with a recessed entrance and lintel belonging to this wallet.
   const doorH=Math.min(.64,w.h*.32),front=w.z+maxD/2+.02;
   box(w.x,groundTop+doorH/2,front,!w.landmark&&w.identity.entrance===3?.65:!w.landmark&&w.identity.entrance===2?.4:.26,doorH,.035,dark);box(w.x,groundTop+doorH+.035,front+.05,.48,.05,.19,trim);
   box(w.x,groundTop+.035,front+.10,.48,.07,.23,trim);
   if(w.family==='masonry'&&w.h>2.8&&w.seed>.58&&w.x<-12.8){
    for(let y=1;y<Math.min(roofY-.2,5);y+=.64){box(w.x-maxW/2-.04,y,w.z,.19,.03,.54,metal);rail(new THREE.Vector3(w.x-maxW/2-.13,y,w.z-.21),new THREE.Vector3(w.x-maxW/2-.13,y+.61,w.z+.21),.008,metal);}
   }
  }else if(w.family==='masonry'&&w.seed>.25){
   const tx=w.x+top.w*.2,tz=w.z-top.w*.15;
   cyl(tx,groundTop+roofY+.36,tz,.17,.17,.42,wood);cyl(tx,groundTop+roofY+.66,tz,0,.2,.18,wood);
   for(const dx of [-.1,.1])for(const dz of [-.1,.1])box(tx+dx,groundTop+roofY+.08,tz+dz,.03,.16,.03,wood);
  }else if(w.h>1.2){box(w.x,groundTop+roofY+.15,w.z,top.w*.3,.3,top.w*.3,metal);}
  if(proposed&&w.landmark){const ac=options.manhattan?metal:accentFor(w);for(const dz of [-maxD/2,maxD/2])box(w.x,.25,w.z+dz,maxW,.07,.045,ac);}

  flush(x,z,envelope,w,options);
 }
 function flush(x,z,envelope,w,options){
  const bounds=new THREE.Box3();for(const {geometry}of local){geometry.computeBoundingBox();bounds.union(geometry.boundingBox);}
  const size=bounds.getSize(new THREE.Vector3()),scale=options.natural?(w.landmark?envelope/Math.max(size.x,size.z):1):Math.min(1,envelope/size.x,envelope/size.z),center=bounds.getCenter(new THREE.Vector3());
  for(let {geometry:g,material:m}of local){
   if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
   if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   // Keep the facade window pitch consistent after fitting the horizontal envelope.
   const uv=g.attributes.uv;for(let j=0;j<uv.count;j++)uv.setX(j,uv.getX(j)*scale);
   g.translate(-center.x,0,-center.z);g.scale(scale,1,scale);g.rotateY(options.rotation??-AXIS_ANGLE);g.translate(x,.17,z);
   if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);
  }
 }
 function finish(){for(const [material,geos]of buckets){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!merged)continue;disposables.push(merged);const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=!material.userData.facadeOverlay;scene.add(mesh);}buckets.clear();}
 return {emit,finish};
}
