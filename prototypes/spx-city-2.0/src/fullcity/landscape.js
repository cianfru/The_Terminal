import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {buildPark} from '../park.js';
import {buildBridge} from '../bridge.js';
import {siteAt,SITES,bridgeSpan} from './city-infra.js';
export function cityLandscape(scene,K,liberty,disposables,ownMats,{approachScale=1,bridgeRise=1,parkEdgeClearance=.3,shapedIsland=false,monumentNight=false,treeVertical=1}={}){
 const mats={};for(const [key,color]of Object.entries({stone:0xc5b89e,copper:0x559887,steel:0x4d5550,asphalt:0x454e4c,paint:0xe5ddbd,mortar:0xa4947b,path:0xc6bda4,lake:0x4e8583,lawn:0x87a365,trunk:0x77664e,iron:0xe5ddc2})){mats[key]=new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide});ownMats.push(mats[key]);}mats.leaves=[0x547448,0x6d8b54,0x76925d].map(color=>{const m=new THREE.MeshStandardMaterial({color,roughness:1});ownMats.push(m);return m;});
 const buckets=new Map();
 const put=(g,m)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);};
 const rod=(a,b,r,m)=>{a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.add(b).multiplyScalar(.5));put(g,m);};
 buildPark({put,mats,rod,edgeClearance:parkEdgeClearance,treeVertical});
 const span=bridgeSpan();
 // Preserve geographic endpoints; widen the deck and raise towers for the wallet-city scale.
 const dx=span.bx-span.ax,dz=span.bz-span.az,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,cx=(span.ax+span.bx)/2,cz=(span.az+span.bz)/2;
 const bridgePut=(g,m)=>{const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i)-cx,z=p.getZ(i)-cz,rawAlong=x*ux+z*uz,along=Math.abs(rawAlong)>8.5?Math.sign(rawAlong)*(8.5+(Math.abs(rawAlong)-8.5)*approachScale):rawAlong,across=x*uz-z*ux;p.setXYZ(i,cx+along*ux+across*uz*3,(p.getY(i)<=.04?p.getY(i):.04+(p.getY(i)-.04)*bridgeRise)*3,cz+along*uz-across*ux*3);}g.computeVertexNormals();put(g,m);};
 const bridgeRod=(a,b,r,m)=>{a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.add(b).multiplyScalar(.5));bridgePut(g,m);};
 buildBridge(span,{put:bridgePut,mats,rod:bridgeRod});
 const mon=siteAt(SITES.monument);if(shapedIsland){
 // Stylized Liberty Island outline and eleven-point Fort Wood, following NPS site references.
 const outline=[[-1.9,-2.2],[-1.3,-3.1],[-.3,-3.3],[.8,-2.9],[1.35,-2],[1.65,-.6],[1.6,.7],[1,1.5],[.15,1.9],[-.8,1.65],[-1.45,.8],[-1.7,-.5]];
 const shape=(points,y,depth,m)=>{const sh=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(mon.x+x,-mon.z-z))),g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y,0);put(g,m);};
 shape(outline,-.13,.25,mats.stone);shape(outline.map(([x,z])=>[x*.94,z*.94]),.125,.012,mats.path);
 shape(outline.map(([x,z])=>[x*.82,z*.82]),.14,.012,mats.lawn);
 const star=Array.from({length:22},(_,i)=>{const a=i*Math.PI/11,r=i%2?.79:1.12;return [Math.cos(a)*r,Math.sin(a)*r];});shape(star,.16,.17,mats.stone);
 const mall=new THREE.BoxGeometry(.38,.025,1.75);mall.translate(mon.x,.17,mon.z-1.9);put(mall,mats.path);
 for(const side of [-1,1])for(let i=0;i<5;i++){const x=mon.x+side*.6,z=mon.z-1.3-i*.31,g=new THREE.IcosahedronGeometry(.12,1);g.scale(1,3.2,1);g.translate(x,.49,z);put(g,mats.leaves[i%3]);}
 const dock=new THREE.BoxGeometry(.9,.08,.23);dock.translate(mon.x-2,.1,mon.z-.6);put(dock,mats.path);
 }else{const island=new THREE.CylinderGeometry(1.6,1.7,.2,32);island.translate(mon.x,.05,mon.z);put(island,mats.lawn);}
 for(const [m,geos]of buckets){const g=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());g.scale(K,K,K);g.translate(0,.12,0);disposables.push(g);const mesh=new THREE.Mesh(g,m);mesh.castShadow=![mats.lake,mats.lawn,mats.path].includes(m);mesh.receiveShadow=true;scene.add(mesh);}
 if(liberty){const root=liberty.clone(true);root.rotateX(-Math.PI/2);/* Upright scan faces -Z (south); source map is +X east, +Z north. */root.rotateOnWorldAxis(new THREE.Vector3(0,1,0),-Math.PI/4);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=4.65*K/size.y;
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:.12,emissive:0x6d9b81,emissiveIntensity:monumentNight?.28:0});ownMats.push(material);root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone(),p=g.attributes.position,colors=new Float32Array(p.count*3),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);new THREE.Color(v.y<box.min.y+size.y*.3?0xb4aa91:0x4c907d).toArray(colors,i*3);}g.setAttribute('color',new THREE.BufferAttribute(colors,3));o.geometry=g;o.material=material;o.castShadow=o.receiveShadow=true;disposables.push(g);});root.scale.multiplyScalar(scale);root.position.set(mon.x*K-center.x*scale,.28-box.min.y*scale,mon.z*K-center.z*scale);scene.add(root);}
}
