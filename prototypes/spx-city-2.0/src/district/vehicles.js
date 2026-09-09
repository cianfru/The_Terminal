import {lightPoolMaterial} from './street-detail.js';
import {safeRoadRuns} from './land-surfaces.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function vehicleGeometry(type){
 const buckets=new Map(),put=(g,role)=>{if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}if(!buckets.has(role))buckets.set(role,[]);buckets.get(role).push(g);};
 const box=(x,y,z,w,h,d,role='paint',round=false)=>{const g=round?new RoundedBoxGeometry(w,h,d,1,Math.min(.025,h*.22)):new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);put(g,role);};
 const van=type==='van',suv=type==='suv',length=van?1.02:suv?.91:.85,width=van?.39:suv?.39:.35;
 box(0,.115,0,width*.86,.1,length*.94,'trim');
 box(0,.195,0,width,.15,length,'paint',true);
 // Glazed cabin, tapered to form the windshield and rear window.
 const ch=van?.23:suv?.2:.16,cw=width*.87,cd=van?.36:suv?.57:.45,cz=van?.25:-.035,cy=.27+ch/2;
 const cabin=new THREE.BoxGeometry(cw,ch,cd),p=cabin.attributes.position;
 for(let i=0;i<p.count;i++)if(p.getY(i)>0){p.setX(i,p.getX(i)*.85);p.setZ(i,p.getZ(i)*.72);}
 cabin.computeVertexNormals();cabin.translate(0,cy,cz);put(cabin,'glass');
 box(0,.27+ch+.006,cz,cw*.87,.025,cd*.74,'paint',true);
 for(const side of [-1,1]){box(side*cw*.47,cy,cz,.018,ch,.025);box(side*(width/2+.025),.275,cz+cd*.25,.045,.035,.065,'trim',true);box(side*(width/2+.003),.246,-.015,.008,.013,.07,'chrome');}
 if(van){box(0,.365,-.2,width*.96,.32,.59,'paint',true);box(0,.38,-length/2-.003,.018,.25,.008,'trim');box(0,.275,-.2,width+.008,.015,.58,'trim');}
 if(suv)for(const x of [-.105,.105])box(x,.49,-.06,.018,.022,.37,'chrome');
 if(type==='taxi'){box(0,.465,-.02,.13,.065,.11,'sign',true);for(const x of [-1,1])for(let k=0;k<5;k++)box(x*(width/2+.006),.211,(k-2)*.05,.008,.026,.024,k%2?'paint':'trim');}
 // Four separate tires, with inset metal hubs.
 for(const x of [-1,1])for(const z of [-length*.3,length*.3]){
  const tire=new THREE.CylinderGeometry(.088,.088,.047,10);tire.rotateZ(Math.PI/2);tire.translate(x*width*.48,.092,z);put(tire,'trim');
  const hub=new THREE.CylinderGeometry(.048,.048,.049,8);hub.rotateZ(Math.PI/2);hub.translate(x*width*.49,.092,z);put(hub,'chrome');
 }
 for(const x of [-width*.3,width*.3]){box(x,.21,length/2+.005,.082,.036,.015,'headlight');box(x,.21,-length/2-.005,.078,.032,.015,'tail');}
 box(0,.14,length/2+.007,width*.79,.027,.022,'chrome');box(0,.14,-length/2-.007,width*.79,.027,.022,'trim');box(0,.203,length/2+.009,.105,.035,.01,'trim');box(0,.17,-length/2-.02,.072,.025,.009,'sign');
 return [...buckets].map(([role,gs])=>{const geometry=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());return {role,geometry};});
}
export function trafficFleet(scene,layout,owned,materials,time){
 const material={paint:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.32,metalness:.35}),glass:new THREE.MeshStandardMaterial({color:0x263d48,roughness:.16,metalness:.5}),trim:new THREE.MeshStandardMaterial({color:0x23282b,roughness:.9}),chrome:new THREE.MeshStandardMaterial({color:0xa0a7a5,roughness:.25,metalness:.8}),sign:new THREE.MeshStandardMaterial({color:0xece3bf,roughness:.7}),headlight:new THREE.MeshStandardMaterial({color:0xe7f1eb,emissive:0xffedc5,emissiveIntensity:time==='day'?.25:2}),tail:new THREE.MeshStandardMaterial({color:0xa72f29,emissive:0xef3526,emissiveIntensity:time==='day'?.15:1})};materials.push(...Object.values(material));
 const types=['taxi','taxi','sedan','sedan','sedan','suv','suv','van'],fleet=Array.from({length:layout.originalGrid?288:72},(_,i)=>({id:i,type:types[i%8]})),meshes=new Map(),colors=[0xe0e2da,0x344b5e,0x687879,0x934b41,0xc5c4ba,0x3c4247];
 for(const type of ['taxi','sedan','suv','van']){const cars=fleet.filter(c=>c.type===type),parts=vehicleGeometry(type).map(({role,geometry})=>{owned.push(geometry);const mesh=new THREE.InstancedMesh(geometry,material[role],cars.length);mesh.frustumCulled=false;mesh.castShadow=role==='paint';mesh.receiveShadow=role==='paint';scene.add(mesh);if(role==='paint')cars.forEach((c,j)=>mesh.setColorAt(j,new THREE.Color(type==='taxi'?0xe9ad28:type==='van'?0xd5d2c3:colors[c.id%colors.length])));return mesh;});cars.forEach((c,j)=>c.index=j);meshes.set(type,parts);}
 const routes=layout.originalGrid?layout.streets.flatMap(r=>safeRoadRuns(layout,r)).filter(r=>Math.hypot(r.b.x-r.a.x,r.b.z-r.a.z)>14).map(r=>{const a=new THREE.Vector3(r.a.x,0,r.a.z),b=new THREE.Vector3(r.b.x,0,r.b.z),direction=b.clone().sub(a).normalize(),normal=new THREE.Vector3(-direction.z,0,direction.x),lane=r.width*.24;a.addScaledVector(direction,2);b.addScaledVector(direction,-2);const p=[a.clone().addScaledVector(normal,lane),b.clone().addScaledVector(normal,lane),b.clone().addScaledVector(normal,-lane),a.clone().addScaledVector(normal,-lane)],path=new THREE.CurvePath();path.add(new THREE.LineCurve3(p[0],p[1]));path.add(new THREE.QuadraticBezierCurve3(p[1],b.clone().addScaledVector(direction,lane),p[2]));path.add(new THREE.LineCurve3(p[2],p[3]));path.add(new THREE.QuadraticBezierCurve3(p[3],a.clone().addScaledVector(direction,-lane),p[0]));path.updateArcLengths();return {path,length:path.getLength(),avenue:Math.abs(direction.z)>Math.abs(direction.x)};}):(layout.originalGrid?layout.blocks.filter(b=>b.w>layout.blockW*.9&&b.d>layout.blockD*.9):[...layout.blocks,...layout.landmarkBlocks]).map(b=>{const hw=layout.cellW/2-.33,hd=layout.cellD/2-.33,corners=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,z])=>new THREE.Vector3(b.x+x,0,b.z+z)),path=new THREE.CurvePath(),r=.7;
 const entry=corners.map((p,i)=>p.clone().add(corners[(i+3)%4].clone().sub(p).normalize().multiplyScalar(r))),leave=corners.map((p,i)=>p.clone().add(corners[(i+1)%4].clone().sub(p).normalize().multiplyScalar(r)));
 for(let i=0;i<4;i++){path.add(new THREE.QuadraticBezierCurve3(entry[i],corners[i],leave[i]));path.add(new THREE.LineCurve3(leave[i],entry[(i+1)%4]));}path.updateArcLengths();return {path,length:path.getLength()};});
 const avenues=routes.filter(r=>r.avenue),crossStreets=routes.filter(r=>!r.avenue);
 const avenueCount=Math.round(fleet.length*.78);
 const routeFor=car=>{const avenue=car.id<avenueCount,pool=layout.originalGrid?(avenue?avenues:crossStreets):routes,available=pool.length?pool:routes,index=layout.originalGrid?(avenue?car.id:car.id-avenueCount):car.id,count=avenue?avenueCount:fleet.length-avenueCount;return available[layout.full?Math.floor((index+.5)*available.length/count)%available.length:index%available.length];};
 let beams=null;const beamDummy=new THREE.Object3D();
 if(time!=='day'){const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);owned.push(g);const m=lightPoolMaterial(time==='night'?1.7:.65);materials.push(m);beams=new THREE.InstancedMesh(g,m,fleet.length*2);beams.frustumCulled=false;scene.add(beams);}
 const dummy=new THREE.Object3D();return t=>{if(!routes.length)return;dummy.scale.setScalar(layout.originalGrid?2.2:1);for(const car of fleet){const {path,length}=routeFor(car),u=(t*(layout.originalGrid?3:.9)/length+car.id*.618)%1,p=path.getPointAt(u),v=path.getTangentAt(u);dummy.position.copy(p);dummy.position.y=layout.originalGrid?.07:.035;dummy.rotation.y=Math.atan2(v.x,v.z);dummy.updateMatrix();for(const mesh of meshes.get(car.type))mesh.setMatrixAt(car.index,dummy.matrix);
 if(beams){const scale=layout.originalGrid?2.2:1;for(const [j,side]of [-1,1].entries()){beamDummy.position.set(p.x+v.x*scale*1.85+v.z*side*.12*scale,.09,p.z+v.z*scale*1.85-v.x*side*.12*scale);beamDummy.rotation.y=dummy.rotation.y;beamDummy.scale.set(.72*scale,1,2.9*scale);beamDummy.updateMatrix();beams.setMatrixAt(car.id*2+j,beamDummy.matrix);}}}if(beams)beams.instanceMatrix.needsUpdate=true;for(const parts of meshes.values())for(const mesh of parts)mesh.instanceMatrix.needsUpdate=true;};
}
