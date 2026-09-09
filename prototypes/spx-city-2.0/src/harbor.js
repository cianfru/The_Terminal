import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NYC} from './nyc-geo.js';
import {WATER} from './source-map.js';
import {SITES,siteAt,bridgeSpan} from './source-infra.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {buildBridge} from './bridge.js';
import {buildPark,PARK_SITES} from './park.js';
import {environment} from './textures.js';
export const HARBOR_ANCHORS={liberty:siteAt(SITES.monument),bridge:bridgeSpan()};
export function createHarbor(el,onStatus=()=>{}){
 let disposed=false;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;el.appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=.15;controls.maxDistance=360;
 const sky=environment('dusk'),pm=new THREE.PMREMGenerator(renderer),env=pm.fromEquirectangular(sky);pm.dispose();scene.environment=env.texture;scene.background=sky;scene.fog=new THREE.Fog(0xb4c6c8,180,540);
 scene.add(new THREE.HemisphereLight(0xd4e9f0,0x827157,1.6));const sun=new THREE.DirectionalLight(0xffe4b9,3);sun.position.set(-80,100,-130);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0001;scene.add(sun);scene.add(sun.target);
 const mats={stone:new THREE.MeshStandardMaterial({color:0xc5b89e,roughness:.88}),copper:new THREE.MeshStandardMaterial({color:0x559887,metalness:.38,roughness:.56}),gold:new THREE.MeshStandardMaterial({color:0xf4c55a,metalness:.7,roughness:.25}),flame:new THREE.MeshStandardMaterial({color:0xffd985,emissive:0xffb52e,emissiveIntensity:2}),steel:new THREE.MeshStandardMaterial({color:0x4d5550,metalness:.7,roughness:.4}),ground:new THREE.MeshStandardMaterial({color:0xa4a28d,roughness:1}),grass:new THREE.MeshStandardMaterial({color:0x7f936c,roughness:1}),water:new THREE.MeshStandardMaterial({color:0x537f88,metalness:.3,roughness:.36})};
 for(const [key,color]of Object.entries({asphalt:0x454e4c,paint:0xe5ddbd,mortar:0xa4947b,path:0xc6bda4,lake:0x4e8583,lawn:0x87a365,trunk:0x77664e,iron:0xe5ddc2})){mats[key]=new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide});}mats.leaves=[0x547448,0x6d8b54,0x76925d].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
 Object.values(mats).flat().forEach(m=>m.side=THREE.DoubleSide);
 mats.ground.side=THREE.DoubleSide;mats.grass.side=THREE.DoubleSide;mats.water.side=THREE.DoubleSide;
 const buckets=new Map(),put=(g,m)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);};
 const box=(x,y,z,w,h,d,m)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);put(g,m);};
 const rod=(a,b,r,m)=>{a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.add(b).multiplyScalar(.5));put(g,m);};
 const flat=(ring,y,m)=>{const sh=new THREE.Shape();ring.forEach(([x,z],i)=>i?sh.lineTo(x,z):sh.moveTo(x,z));sh.closePath();const g=new THREE.ShapeGeometry(sh);g.rotateX(Math.PI/2);g.translate(0,y,0);g.scale(1,1,1);put(g,m);};
 const sea=new THREE.PlaneGeometry(1600,1600);sea.rotateX(-Math.PI/2);sea.translate(0,-.3,0);put(sea,mats.water);
 for(const key of ['brooklyn','queens','bronx','jersey'])for(const ring of NYC[key]||[])flat(ring,-.15,mats.ground);
 for(const water of WATER)flat(water.ring,-.08,mats.water);
 for(const ring of NYC.manhattan)flat(ring,0,mats.ground);
 for(const ring of NYC.centralpark)flat(ring,.03,mats.grass);
 const mon=HARBOR_ANCHORS.liberty;
 // A licensed physical-model scan replaces the authored silhouette. Model height is 93 m.
 const island=new THREE.CylinderGeometry(.7,.72,.03,40);island.scale(1,1,1.35);island.translate(mon.x,0,mon.z);put(island,mats.grass);
 onStatus('Loading licensed Liberty scan…');
 new GLTFLoader().load(import.meta.env.BASE_URL+'models/liberty-optimized.glb',gltf=>{
  if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return;}
  const root=gltf.scene;root.rotateX(-Math.PI/2);/* Upright scan faces -Z (south); source map is +X east, +Z north. */root.rotateOnWorldAxis(new THREE.Vector3(0,1,0),-Math.PI/4);root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=.93/size.y;
  root.scale.multiplyScalar(scale);root.position.set(mon.x-center.x*scale,.025-bounds.min.y*scale,mon.z-center.z*scale);
  const scanMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:.12});mats.scan=scanMat;root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position,colors=new Float32Array(p.count*3),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const c=new THREE.Color(v.y<bounds.min.y+size.y*.3?0xb4aa91:0x4c907d);c.toArray(colors,i*3);}o.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));o.material?.dispose();o.material=scanMat;o.castShadow=true;o.receiveShadow=true;}});scene.add(root);onStatus('Licensed Liberty scan ready');
 },undefined,()=>onStatus('Liberty model could not load. Reload this view to retry.'));
 buildBridge(HARBOR_ANCHORS.bridge,{put,mats,rod});
 buildPark({put,mats,rod});
 for(const [m,gs]of buckets){const mesh=new THREE.Mesh(mergeGeometries(gs,false),m);mesh.castShadow=![mats.water,mats.ground,mats.grass,mats.lake,mats.path,mats.lawn].includes(m);mesh.receiveShadow=true;gs.forEach(g=>g.dispose());scene.add(mesh);}
 let raf;const ro=new ResizeObserver(()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();});ro.observe(el);
 const focus=key=>{const span=HARBOR_ANCHORS.bridge;const p=key==='liberty'?new THREE.Vector3(mon.x,.58,mon.z):key==='bridge'?new THREE.Vector3((span.ax+span.bx)/2,.2,(span.az+span.bz)/2):key==='park'?new THREE.Vector3(0,0,0):key==='bethesda'?new THREE.Vector3(PARK_SITES.bethesda[0],.12,PARK_SITES.bethesda[1]):new THREE.Vector3(-35,0,-55);const off=key==='liberty'?[1.6,.8,1.95]:key==='bridge'?[12,8,14]:key==='park'?[24,29,-32]:key==='bethesda'?[2,1.9,2.5]:[95,110,-135];controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(...off).multiplyScalar(['park','bridge','map'].includes(key)?Math.max(1,1.65/(el.clientWidth/el.clientHeight)):1));if(el.clientWidth<600)camera.position.copy(p).add(new THREE.Vector3(...off).multiplyScalar(Math.max(1.5,['park','bridge','map'].includes(key)?1.65/(el.clientWidth/el.clientHeight):1.5)));sun.target.position.copy(p);sun.position.copy(p).add(new THREE.Vector3(-30,50,25));const extent=key==='liberty'?1.5:key==='bethesda'?4:key==='bridge'?15:45;Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:150});sun.shadow.normalBias=extent*.0003;sun.shadow.camera.updateProjectionMatrix();controls.update();};focus('liberty');
 const tick=()=>{raf=requestAnimationFrame(tick);controls.update();renderer.render(scene,camera);};tick();
 return {focus,async capture(view){renderer.render(scene,camera);const cv=document.createElement('canvas');cv.width=renderer.domElement.width;cv.height=renderer.domElement.height;const ctx=cv.getContext('2d');ctx.drawImage(renderer.domElement,0,0);ctx.fillStyle='#1b302b';ctx.fillRect(0,cv.height-40,cv.width,40);ctx.fillStyle='#e5eadc';ctx.font='16px sans-serif';ctx.fillText('SPX6900 Rainbow · OpenStreetMap · Liberty scan: GoMeasure3D / CC BY 4.0 / recolored & simplified',18,cv.height-14);const data=cv.toDataURL('image/png');if(import.meta.env.DEV){const response=await fetch('/__harbor-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`spx-city-${view}.png`,base64:data.split(',')[1]})});if(!response.ok)throw Error('Export failed');}else{const a=document.createElement('a');a.href=data;a.download=`spx-city-${view}.png`;a.click();}},dispose(){disposed=true;cancelAnimationFrame(raf);ro.disconnect();controls.dispose();scene.traverse(o=>o.geometry?.dispose());Object.values(mats).flat().forEach(m=>m.dispose());sky.dispose();env.dispose();renderer.dispose();renderer.domElement.remove();}};
}
