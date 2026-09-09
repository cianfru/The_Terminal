import * as THREE from 'three';
import {landmarkWall,landmarkDetails} from './landmarks.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TIMES, FAMILIES, skyEnv, facadeTexture, facadeAlbedo, wallGeometry, roofGeometry, archetype, waterMaterials } from './production-render.js';
import { facade, environment } from './textures.js';
import { hash, newForm, PRESETS, walletSignal } from './model.js';

const GREEN=new THREE.Color(0x22c55e),RED=new THREE.Color(0xf43f5e);
const ageColor=t=>new THREE.Color(0xf2cf8a).lerp(new THREE.Color(0x22d3ee),t);
const signalColor=(w,maxFlow)=>{
 const ai=Math.min(5,Math.floor(w.ageT*6)),fi=Math.max(0,Math.min(4,Math.round(((w.d30||0)/maxFlow+1)*2)));
 const f=fi/2-1,age=ageColor((ai+.5)/6);
 return Math.abs(f)>.05?age.lerp(f>0?GREEN:RED,Math.min(1,.82+.18*Math.min(1,Math.abs(f)*1.6))):age;
};
function makeWorld(renderer,model,snapshot,proposed,time,signal){
 const scene=new THREE.Scene(),disposeSet=new Set(),buckets=new Map(),signalMats=[],accentMats=[];
 const keep=x=>(disposeSet.add(x),x);
 const mat=(color,roughness=.85,extra={})=>keep(new THREE.MeshStandardMaterial({color,roughness,...extra}));
 const put=(geometry,material)=>{if(geometry.index){const old=geometry;geometry=geometry.toNonIndexed();old.dispose();}if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(geometry);};
 const box=(x,y,z,w,h,d,m)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);put(g,m);};
 const cyl=(x,y,z,rt,rb,h,m,n=8)=>{const g=new THREE.CylinderGeometry(rt,rb,h,n);g.translate(x,y,z);put(g,m);};
 const rail=(a,b,r,m)=>{const v=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());put(g,m);};
 const tod=TIMES[time];
 if(proposed){
  const sky=keep(environment(time));const pmrem=new THREE.PMREMGenerator(renderer);const env=keep(pmrem.fromEquirectangular(sky));pmrem.dispose();scene.background=sky;scene.environment=env.texture;
  scene.fog=new THREE.Fog(time==='night'?0x263944:0xb8c7c8,65,190);
 }else{const {env,sky}=skyEnv(renderer,tod);keep(env);keep(sky);scene.environment=env;scene.background=sky;scene.fog=new THREE.Fog(new THREE.Color(tod.horizon),90,280);}
 const night=time==='night';
 scene.add(new THREE.HemisphereLight(proposed?(night?0x648398:0xc9e2ee):new THREE.Color(tod.top),proposed?0x7b6d59:new THREE.Color(tod.ground),proposed?(night?.7:.95):tod.hemi));
 scene.add(new THREE.AmbientLight(0xffffff,proposed?(night?.22:.38):tod.amb));
 const sun=new THREE.DirectionalLight(proposed?(night?0x9bbbd8:0xffe4b6):tod.sun,proposed?(night?1:2.6):tod.sunI);
 sun.position.set(-28,38,23);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:140});sun.shadow.bias=-.00018;sun.shadow.normalBias=.035;scene.add(sun);
 const base=mat(proposed?0x8d8d81:tod.land),asphalt=mat(proposed?0x555c59:tod.road),paving=mat(proposed?0xbeb7a4:tod.pave),kerb=mat(proposed?0xd0c9b7:0xacb5bd);
 const roof=mat(proposed?0x65675e:0x3b3f4a),metal=mat(proposed?0x596461:0x8a9099,.52,{metalness:.55}),wood=mat(proposed?0x665341:0x6b4a35);
 const trim=mat(0xc5bda5),dark=mat(0x273938,.45),bronze=mat(0x8a7a5b,.55,{metalness:.5}),chalk=mat(0xc8c5ad);
 box(0,-.29,-4,35,.5,29,base);box(0,-.025,-4,34.8,.065,28.8,asphalt);
 const groundTop=.12;
 box(0,.04,-16.15,34.7,.2,4.5,paving);
 for(const z of [-12,-5,2])for(const x of [-11.4,-3.8,3.8,11.4]){
  box(x,.01,z,6.65,.18,5.45,kerb);box(x,.105,z,6.5,.04,5.3,paving);
  if(proposed){for(let xx=-3;xx<=3;xx+=.5){box(x+xx,.128,z,0.013,.003,5.24,trim);}for(let zz=-2.5;zz<=2.5;zz+=.5)box(x,.128,z+zz,6.46,.003,.014,trim);}
 }
 for(const x of [-15.2,-7.6,0,7.6,15.2])for(let z=-15;z<7;z+=1.6)box(x,.015,z,.035,.004,.66,chalk);
 for(const z of [-8.5,-1.5,5.5])for(const x of [-15.2,-7.6,0,7.6,15.2])for(let k=-2;k<=2;k++)box(x+k*.15,.019,z+.66,.075,.007,.44,chalk);
 // The quayside is geographical context. It carries no holder or transaction data.
 box(0,.025,8.35,35,.27,3.9,paving);box(0,.04,10.25,35,.36,.25,kerb);
 if(proposed){
  for(let x=-17;x<17.5;x+=.75)box(x,.17,8.35,.014,.007,3.7,trim);
  for(let z=6.7;z<10;z+=.6)box(0,.17,z,34.8,.007,.016,trim);
  for(let x=-17;x<=17;x+=.7)cyl(x,.51,10.17,.025,.025,.63,metal,6);
  for(const y of [.35,.68])box(0,y,10.17,34,.028,.028,metal);
 }
 const wm=waterMaterials(tod);wm.textures.forEach(keep);keep(wm.over);const water=wm.base||wm.water||Object.values(wm).find(x=>x?.isMaterial);
 // waterMaterials returns a named pair; keep its maps through the final scene traversal.
 const waterMat=water||mat(0x548086,.4,{metalness:.15});
 if(proposed){waterMat.color.set(night?0x284852:0x628b90);waterMat.roughness=.36;waterMat.envMapIntensity=.72;}
 const wg=new THREE.PlaneGeometry(500,500);wg.rotateX(-Math.PI/2);wg.translate(0,-.31,0);const sea=new THREE.Mesh(keep(wg),keep(waterMat));scene.add(sea);
 box(0,-.09,-19.4,34,.36,8.3,base);box(0,.1,-19.4,33.5,.08,7.8,paving);
 const copper=mat(0x458a79,.45,{metalness:.45});
 const buildingMats=new Map(),textureCache=new Map(),accentCache=new Map();
 const accentFor=w=>{const profile=walletSignal(w,snapshot.maxFlow),key=profile.color;
  if(!accentCache.has(key)){const m=keep(new THREE.MeshBasicMaterial({color:key,toneMapped:false,visible:signal}));accentMats.push(m);accentCache.set(key,m);}return accentCache.get(key);};
 const texturesFor=(kind,variant)=>{const key=kind+variant;if(!textureCache.has(key)){const tx=proposed?facade(kind,variant):{map:facadeAlbedo(kind),emissiveMap:facadeTexture(kind)};Object.values(tx).forEach(keep);textureCache.set(key,tx);}return textureCache.get(key);};
 const getWall=(w,kind,variant)=>{
  const ai=Math.min(5,Math.floor(w.ageT*6)),fi=Math.max(0,Math.min(4,Math.round(((w.d30||0)/snapshot.maxFlow+1)*2))),key=`${kind}|${variant}|${ai}|${proposed?Math.sign(w.d30||0):fi}`;
  if(buildingMats.has(key))return buildingMats.get(key);
  let m;
  if(proposed){const tx=texturesFor(kind,variant);m=mat(0xffffff,kind==='glass'?.26:.86,{...tx,normalScale:new THREE.Vector2(.25,.25),metalness:kind==='glass'?.35:.015,envMapIntensity:kind==='glass'?1.2:.5,emissive:signal?new THREE.Color(walletSignal(w,snapshot.maxFlow).age):new THREE.Color(0xffd49c),emissiveIntensity:signal?(night?2.8:time==='day'?1.6:2.2):(night?1.5:.33)});}
  else {const F=FAMILIES[kind];m=mat(new THREE.Color(F.colour).lerp(ageColor((ai+.5)/6),.12),F.roughness,{...texturesFor(kind,0),metalness:F.metalness,emissive:signal?signalColor(w,snapshot.maxFlow):new THREE.Color(0xffd49c),emissiveIntensity:tod.win*(fi===2?1:1+.9*Math.min(1,Math.abs(fi/2-1)*1.6)),envMapIntensity:F.env});}
  buildingMats.set(key,m);signalMats.push({m,w});return m;
 };
 const picks=[];
 model.forEach(w=>{
  const original=archetype(w.h,w.seed,w.rank<=3?w.rank-1:-1),form=proposed?newForm(w):original;
  const variant=w.landmark?Math.floor(hash(w.a+'material')*(w.family==='masonry'?5:3)):w.identity.windows*1000+w.identity.typeId*10+w.identity.palette,wallMat=getWall(w,proposed?w.family:(w.h>=11?'glass':w.h>=6?'concrete':'masonry'),proposed?variant:0);
  let roofY=0,maxW=0,maxD=0;
  for(const q of form.parts){
   const custom=proposed&&w.landmark?landmarkWall(q,w):null;
   const g=custom||wallGeometry(q.w,q.d,q.h);g.translate(w.x+(q.x||0),q.y+groundTop,w.z+(q.z||0));put(g,wallMat);
   if(!custom){const lid=roofGeometry(q.w,q.d);lid.translate(w.x+(q.x||0),q.y+q.h/2+groundTop,w.z+(q.z||0));put(lid,roof);}
   roofY=Math.max(roofY,q.y+q.h/2);maxW=Math.max(maxW,q.w);maxD=Math.max(maxD,q.d);
   if(proposed&&!custom){
    const band=w.family==='glass'?metal:trim;
    const accent=accentFor(w);
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
   if(w.landmark)landmarkDetails(w,{put,box,cyl,rail,wall:wallMat,trim,metal,bronze:copper,accent:accentFor(w),ground:groundTop});
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
  if(proposed&&w.landmark){const ac=accentFor(w);for(const dz of [-maxD/2,maxD/2])box(w.x,.25,w.z+dz,maxW,.07,.045,ac);}
  // Exact production decision rule, using the full-population flow maximum.
  const f=(w.d30||0)/snapshot.maxFlow,mag=Math.min(1,Math.abs(f)*3);
  if(Math.abs(f)>.02 && mag>.12){
   const beamH=roofY*.35+3.5+9*mag;
   const bm=keep(new THREE.MeshBasicMaterial({color:f>0?0x22c55e:0xf43f5e,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
   const bg=keep(new THREE.CylinderGeometry(.10+.06*mag,.16+.10*mag,beamH,12,1,true));
   const beam=new THREE.Mesh(bg,bm);beam.position.set(w.x,groundTop+w.h+beamH/2+.6,w.z);scene.add(beam);
  }
  picks.push({w,width:maxW+(w.landmark==='leonard'?.6:0),depth:maxD+(w.landmark==='leonard'?.3:0)});
 });
 if(proposed){
  const foliage=[mat(0x56694c),mat(0x6c7a50),mat(0x79825c)],soil=mat(0x797666),trunk=mat(0x73634b);
  const tree=(x,z,r)=>{
   cyl(x,.6,z,.033,.065,1.03,trunk,7);
   for(let i=0;i<5;i++){const a=i*2.4,gg=new THREE.IcosahedronGeometry(.31+r*.13,1);gg.scale(1,1.2,1);gg.translate(x+Math.sin(a)*.2,1.28+Math.cos(a)*.17,z+Math.cos(a)*.19);put(gg,foliage[i%3]);}
   box(x,.19,z,.72,.12,.72,soil);
  };
  for(let x=-16;x<=16;x+=2.5){tree(x,7.1,hash(x));
   // Benches, lamp posts and railings establish human scale without invented transaction activity.
   box(x,.38,8.45,.8,.065,.27,wood);box(x,.55,8.56,.8,.26,.035,wood);
   for(const dx of [-.29,.29])box(x+dx,.26,8.45,.035,.24,.23,metal);
  }
  // Street centerlines stay clear; trees are planted on the quayside promenade.
  const light=mat(0xece2bd,.45,{emissive:0xffe0a0,emissiveIntensity:night?2:.6});
  for(let x=-16;x<=16;x+=4){cyl(x,1,9.1,.025,.045,1.75,metal);box(x+.12,1.88,9.1,.28,.055,.13,light);}
  // Low finger piers keep the river edge legible in all three camera views.
  for(const x of [-11.4,11.4]){
   box(x,-.03,13,2.1,.28,5.6,wood);for(let z=10.4;z<=15.7;z+=.18)box(x,.118,z,2.1,.005,.013,metal);
   for(const dx of [-.9,.9])for(const z of [10.7,13,15.2])cyl(x+dx,-.3,z,.08,.08,1.3,wood);
  }
 }
 for(const [m,geos]of buckets){const g=keep(mergeGeometries(geos,false));geos.forEach(x=>x.dispose());const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
 const pickMat=keep(new THREE.MeshBasicMaterial({visible:false}));const pickGeo=keep(new THREE.BoxGeometry(1,1,1));const pickMesh=new THREE.InstancedMesh(pickGeo,pickMat,picks.length),dummy=new THREE.Object3D();
 picks.forEach(({w,width,depth},i)=>{dummy.position.set(w.x,w.h/2+groundTop,w.z);dummy.scale.set(width,w.h,depth);dummy.updateMatrix();pickMesh.setMatrixAt(i,dummy.matrix);});scene.add(pickMesh);keep(pickMesh);
 const outlineMat=keep(new THREE.LineBasicMaterial({color:0xffe5b0,transparent:true,opacity:.9}));
 const outline=new THREE.LineSegments(keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1))),outlineMat);outline.visible=false;scene.add(outline);
 function select(address){const item=picks.find(p=>p.w.a===address);outline.visible=!!item;if(item){outline.position.set(item.w.x,item.w.h/2+groundTop,item.w.z);outline.scale.set(item.width+.08,item.w.h+.05,item.depth+.08);}}
 return {scene,pickMesh,picks,select,tick:wm.tick,exposure:proposed?(night?.8:1.04):tod.exposure,
  setSignal(on){for(const {m,w}of signalMats){m.emissive.copy(on?(proposed?new THREE.Color(walletSignal(w,snapshot.maxFlow).age):signalColor(w,snapshot.maxFlow)):new THREE.Color(0xffd49c));if(proposed)m.emissiveIntensity=on?(night?2.8:time==='day'?1.6:2.2):(night?1.5:.33);}accentMats.forEach(m=>m.visible=on);},
  dispose(){scene.traverse(o=>{if(o.geometry)disposeSet.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){disposeSet.add(m);for(const v of Object.values(m))if(v?.isTexture)disposeSet.add(v);}}});for(const d of disposeSet)d.dispose?.();},
 };
}

export function createCityStudy(el,model,snapshot,{onStats,onSelect,onReady,onError}){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(e){onError(e.message);return null;}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));el.appendChild(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(40,1,.1,700),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=3;controls.maxDistance=120;controls.maxPolarAngle=Math.PI*.48;controls.target.set(...PRESETS.skyline.target);camera.position.set(...PRESETS.skyline.position);
 controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
 let time='dusk',signal=true,mode='proposed',split=.5,worlds=[],running=true,flight=null,selected=null,w=1,h=1,raf,statsAt=0,frames=0,frameSum=0,last=0,needsResize=true,capturing=false;
 const build=()=>{const next=[makeWorld(renderer,model,snapshot,false,time,signal),makeWorld(renderer,model,snapshot,true,time,signal)];worlds.forEach(x=>x.dispose());worlds=next;if(selected)worlds.forEach(x=>x.select(selected));};
 build();
 const ro=new ResizeObserver(()=>{needsResize=true;});ro.observe(el);
 const pointer=new THREE.Vector2(),ray=new THREE.Raycaster();let down=null;
 const downFn=e=>{down=[e.clientX,e.clientY];flight=null;};
 const upFn=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const b=el.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);const world=worlds[mode==='production'?0:1];const hits=ray.intersectObject(world.pickMesh);const wallet=hits.length?world.picks[hits[0].instanceId].w:null;selected=wallet?.a;worlds.forEach(x=>x.select(selected));onSelect(wallet);};
 renderer.domElement.addEventListener('pointerdown',downFn);renderer.domElement.addEventListener('pointerup',upFn);
 const wheelFn=()=>{flight=null;};renderer.domElement.addEventListener('wheel',wheelFn,{passive:true});
 const contextLost=e=>{e.preventDefault();running=false;onError('The graphics context was interrupted. Reload the study to resume.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
 function render(){
  renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();
  if(mode==='compare'){
   renderer.setScissorTest(true);renderer.setScissor(0,0,Math.floor(w*split),h);renderer.toneMappingExposure=worlds[0].exposure;renderer.render(worlds[0].scene,camera);
   renderer.setScissor(Math.floor(w*split),0,w-Math.floor(w*split),h);renderer.toneMappingExposure=worlds[1].exposure;renderer.render(worlds[1].scene,camera);renderer.setScissorTest(false);
  }else{const world=worlds[mode==='production'?0:1];renderer.toneMappingExposure=world.exposure;renderer.render(world.scene,camera);}
 }
 const tick=now=>{
  if(!running)return;raf=requestAnimationFrame(tick);if(capturing)return;
  if(needsResize){w=Math.max(1,el.clientWidth);h=Math.max(1,el.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();needsResize=false;}
  if(flight){const t=Math.min(1,(now-flight.start)/1000),a=t*t*(3-2*t);camera.position.lerpVectors(flight.from,flight.to,a);controls.target.lerpVectors(flight.fromTarget,flight.toTarget,a);camera.fov=flight.fromFov+(flight.fov-flight.fromFov)*a;camera.updateProjectionMatrix();if(t===1)flight=null;}
  controls.update();worlds.forEach(x=>x.tick(now));renderer.info.reset();render();
  if(last){frameSum+=now-last;frames++;}last=now;
  if(now-statsAt>1100){onStats({fps:frames?Math.round(frames*1000/frameSum):0,frameMs:frames?+(frameSum/frames).toFixed(1):0,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),mode});statsAt=now;frames=0;frameSum=0;}
 };
 raf=requestAnimationFrame(tick);onReady();
 const setCamera=(key,instant=false)=>{const p=PRESETS[key];if(!p)return;const target=new THREE.Vector3(...p.target),pos=new THREE.Vector3(...p.position);if(key==='skyline'&&el.clientWidth/el.clientHeight<1)pos.multiplyScalar(1.75);if(instant||matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(pos);controls.target.copy(target);camera.fov=p.fov;camera.updateProjectionMatrix();flight=null;}else flight={start:performance.now(),from:camera.position.clone(),to:pos,fromTarget:controls.target.clone(),toTarget:target,fromFov:camera.fov,fov:p.fov};};
 setCamera('skyline',true);
 return {
  setPaused(v){capturing=v;},setMode(v){mode=v;},setSplit(v){split=v;},setCamera,
  setTime(v){time=v;build();},setSignal(v){signal=v;worlds.forEach(x=>x.setSignal(v));},
  select(address){selected=address;worlds.forEach(x=>x.select(address));},
  focus(wallet){selected=wallet.a;worlds.forEach(x=>x.select(selected));flight={start:performance.now(),from:camera.position.clone(),to:new THREE.Vector3(wallet.x+Math.max(4,wallet.h*.8),wallet.h*.75+2,wallet.z+Math.max(6,wallet.h*1.3)),fromTarget:controls.target.clone(),toTarget:new THREE.Vector3(wallet.x,wallet.h*.45,wallet.z),fromFov:camera.fov,fov:42};},
  async capture(){
   const saved={mode,position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov,pixelRatio:renderer.getPixelRatio(),width:w,height:h};
   capturing=true;flight=null;worlds.forEach(x=>x.select(null));
   try{
    w=1440;h=900;renderer.setPixelRatio(1);renderer.setSize(w,h,false);camera.aspect=w/h;
    const images=[];
    for(const [key,p] of Object.entries(PRESETS)){
     camera.position.set(...p.position);controls.target.set(...p.target);camera.fov=p.fov;camera.lookAt(controls.target);camera.updateProjectionMatrix();
     for(const treatment of ['production','proposed']){mode=treatment;render();const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);ctx.fillStyle='#172724dc';ctx.fillRect(0,h-32,w,32);ctx.fillStyle='#e4eadd';ctx.font='14px sans-serif';ctx.fillText('Source: SPX6900 Rainbow · https://spx6900rainbow.xyz',20,h-11);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Canvas capture failed');images.push({name:`spx-city-${key}-${treatment}.png`,blob});}
    }
    return images;
   }finally{
    mode=saved.mode;w=saved.width;h=saved.height;renderer.setPixelRatio(saved.pixelRatio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.copy(saved.position);controls.target.copy(saved.target);camera.fov=saved.fov;camera.lookAt(controls.target);camera.updateProjectionMatrix();worlds.forEach(x=>x.select(selected));last=0;capturing=false;
   }
  },
  dispose(){running=false;cancelAnimationFrame(raf);ro.disconnect();controls.dispose();worlds.forEach(x=>x.dispose());renderer.domElement.removeEventListener('pointerdown',downFn);renderer.domElement.removeEventListener('pointerup',upFn);renderer.domElement.removeEventListener('wheel',wheelFn);renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.dispose();renderer.domElement.remove();},
 };
}
