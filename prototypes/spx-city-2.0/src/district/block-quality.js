import {entranceFrontage} from './entrance-frontage.js';
import {onLand,rectangle} from './land-surfaces.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {silhouetteParts} from './silhouettes.js';

export function qualityBlock(layout){return layout.geographic?layout.blocks.find(b=>b.hood==='midtown'&&b.homes.length>=10):null;}
export function blockQuality(scene,layout,time,owned,materials,{rollout=false}={}){
 const block=qualityBlock(layout),group=new THREE.Group();group.visible=false;scene.add(group);if(!block)return {group,block};
 const buckets=new Map(),instances=new Map(),dummy=new THREE.Object3D(),roofCache=new Map(),detailMeshes=[],instanceBatches=[],peersByKey=new Map(),homesByBlock=new Map();
 for(const w of layout.homes.slice(12)){const k=[w.identity.family,w.identity.silhouette,w.identity.palette%4].join('|');if(!peersByKey.has(k))peersByKey.set(k,[]);peersByKey.get(k).push(w);if(!homesByBlock.has(w.block))homesByBlock.set(w.block,[]);homesByBlock.get(w.block).push(w);}
 for(const peers of peersByKey.values())peers.sort((a,b)=>a.h-b.h);
 const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.76,...extra});materials.push(m);return m;};
 const stone=mat(0xa69880),trim=mat(0xd0c3a7),dark=mat(0x303a3c),glass=mat(0x294952,{roughness:.22,metalness:.48,emissive:0xe0a762,emissiveIntensity:time==='night'?.09:time==='dusk'?.035:0}),bronze=mat(0x78654b,{metalness:.5}),wood=mat(0x806046),green=mat(0x385e42),soil=mat(0x494633),cream=mat(0xd2c39a),light=mat(0xf6d898,{emissive:0xffcf85,emissiveIntensity:time==='day'?.08:.65}),red=mat(0xb45849),blue=mat(0x42667c);
 const put=(g,m)=>{const a=g.index?g.toNonIndexed():g;if(a!==g)g.dispose();a.computeBoundingBox();const c=a.boundingBox.getCenter(new THREE.Vector3()),tile=[Math.floor(c.x/80),Math.floor(c.z/80)],key=m.uuid+'|'+tile.join(',');if(!buckets.has(key))buckets.set(key,{m,tile,gs:[]});buckets.get(key).gs.push(a);};
 const box=(x,y,z,w,h,d,m,rotation=0)=>{if(y-h/2<.3&&!rectangle(x,z,w,d).every(([x,z])=>onLand(layout,x,z)))return;dummy.position.set(x,y,z);dummy.rotation.set(0,rotation,0);dummy.scale.set(w,h,d);dummy.updateMatrix();if(!instances.has(m))instances.set(m,[]);instances.get(m).push(dummy.matrix.clone());};
 const strip=(a,b,y,width,height,m)=>box((a.x+b.x)/2,y,(a.z+b.z)/2,width,height,a.distanceTo(b),m,Math.atan2(b.x-a.x,b.z-a.z));
 const selectedBlocks=rollout?layout.blocks.filter(b=>homesByBlock.has(b.id)):[block];
 for(const block of selectedBlocks){
 const homes=homesByBlock.get(block.id)||[],low=block.borough!=='manhattan'||['tribeca','village'].includes(block.hood);
 for(const [i,w] of homes.entries()){
  const id=w.identity,side=w.z>block.z?1:-1,front=w.z+side*(id.depth/2+.055),bw=id.width;
  // Match the exact population mesh dimensions before extracting roof boundaries.
  const cacheKey=[id.family,id.silhouette,id.palette%4].join('|'),peers=peersByKey.get(cacheKey),rep=peers[Math.floor(peers.length/2)],ri=rep.identity;
  if(!roofCache.has(cacheKey)){const parts=silhouetteParts(id.silhouette,{width:ri.width,depth:ri.depth,height:rep.h,variant:ri.palette%4}),bounds=new THREE.Box3();for(const p of parts){p.geometry.computeBoundingBox();bounds.union(p.geometry.boundingBox);}const center=bounds.getCenter(new THREE.Vector3()),triangles=[],walls=[];
   for(const {geometry}of parts){const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position;for(let j=0;j<p.count;j+=3){const vs=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,j+k).sub(new THREE.Vector3(center.x,0,center.z)));walls.push(vs);if(new THREE.Triangle(...vs).getNormal(new THREE.Vector3()).y>.999&&vs[0].y>2)triangles.push(vs);}if(g!==geometry)g.dispose();geometry.dispose();}roofCache.set(cacheKey,{roofs:triangles,walls});}
  const facadeTriangles=low?roofCache.get(cacheKey).walls.map(raw=>new THREE.Triangle(...raw.map(v=>v.clone().multiply(new THREE.Vector3(id.width/ri.width,w.h/rep.h,id.depth/ri.depth)).add(new THREE.Vector3(w.x,.17,w.z))))):[];
  if(!low){
  // A legible retail/lobby base: real recessed glass behind projecting stone piers.
  box(w.x,.81,w.z,bw*1.015,1.28,id.depth*1.015,stone);
  box(w.x,1.48,w.z,bw*1.04,.12,id.depth*1.04,trim);
  const bays=Math.max(3,Math.floor(bw/.8)),bay=bw/bays;
  for(let k=0;k<bays;k++){const x=w.x-bw/2+(k+.5)*bay;box(x,.84,front,bay-.10,.98,.04,glass);box(x-bay/2,.84,front+side*.045,.09,1.06,.10,trim);box(x,.84,front+side*.06,.022,.96,.035,bronze);if((k+i)%3===0){box(x+bay*.18,.79,front+side*.035,bay*.28,.52,.025,light);box(x,.39,front+side*.035,bay-.18,.10,.025,wood);}}
  box(w.x,.38,front+side*.075,.028,.52,.06,bronze);
  box(w.x,1.26,front+side*.34,Math.min(1.5,bw*.65),.10,.72,i%3===0?green:dark);
  box(w.x,1.17,front+side*.56,Math.min(1.15,bw*.5),.025,.09,light);
  }else{
   // Low-rise character: modest doors, masonry lintels, stoops and occasional shops.
   const frontage=entranceFrontage(facadeTriangles,side,w.x+(i%2?-.18:.18)*bw);
   if(frontage){const entry=frontage.x,front=frontage.z+side*.022;
   box(entry,.75,front,.50,.95,.07,i%3===0?blue:dark);
   box(entry,1.28,front,.68,.10,.12,trim);
   for(const sideX of [-1,1])box(entry+sideX*.30,.76,front,.085,1.02,.10,stone);
   const reach=Math.max(0,Math.abs(block.z+side*block.d/2-front)-.48);
   if(reach>.55){for(let step=0;step<3;step++)box(entry,.24+(2-step)*.075,front+side*(.12+step*.15),.72,.10,.20,stone);}
   const shopWall=i%4===0?entranceFrontage(facadeTriangles,side,w.x+(entry>w.x?-.23:.23)*bw,1.08):null;
   if(shopWall&&Math.abs(shopWall.x-entry)>1){const shop=shopWall.x,front=shopWall.z+side*.022;box(shop,.77,front,.82,.75,.07,glass);box(shop,1.2,front+side*.14,1,.07,.38,i%2?red:green);box(shop,1.10,front+side*.06,.30,.34,.03,light);}

   if(reach>.9&&i%3===1){box(entry+.7,.27,front+side*.40,.45,.15,.48,stone);const plant=new THREE.IcosahedronGeometry(.23,1);plant.translate(entry+.7,.57,front+side*.40);put(plant,green);}
   }
  }
  const edges=new Map(),roofs=[];
  for(const raw of roofCache.get(cacheKey).roofs){const vs=raw.map(v=>v.clone().multiply(new THREE.Vector3(id.width/ri.width,w.h/rep.h,id.depth/ri.depth)).add(new THREE.Vector3(w.x,.17,w.z))),tri=new THREE.Triangle(...vs);roofs.push(tri);for(let e=0;e<3;e++){const a=vs[e],b=vs[(e+1)%3],key=[a,b].map(v=>v.toArray().map(n=>n.toFixed(3)).join(',')).sort().join('|');if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}}
  for(const {a,b,count}of edges.values())if(count===1&&a.distanceTo(b)>.25)strip(a,b,a.y+.10,.085,.20,trim);
  const roof=roofs.sort((a,b)=>b.getArea()-a.getArea())[0];if(roof&&roof.getArea()>.7){const p=roof.getMidpoint(new THREE.Vector3()),size=Math.min(low?.38:.65,Math.sqrt(roof.getArea())*.32);box(p.x,p.y+.20,p.z,size,.38,size,dark);box(p.x,p.y+.41,p.z,size+.06,.05,size+.06,bronze);for(let j=-1;j<=1;j++)box(p.x,p.y+.44,p.z+j*size*.25,size*.8,.025,.035,trim);}
 }
 if(block.w<5||block.d<3||!rectangle(block.x,block.z,block.w,block.d).every(([x,z])=>onLand(layout,x,z)))continue;
 if(low&&block.w>10){for(const sign of [-1,1]){const x=block.x+sign*block.w*.22,z=block.z;if(homes.some(w=>Math.abs(w.x-x)<w.identity.width/2+1.2&&Math.abs(w.z-z)<w.identity.depth/2+1))continue;if(!rectangle(x,z,1.6,1.2).every(([x,z])=>onLand(layout,x,z)))continue;box(x,.24,z,1.6,.12,1.2,stone);box(x,.32,z,1.42,.06,1.02,soil);for(const dx of [-.42,0,.42]){const shrub=new THREE.IcosahedronGeometry(.28,1);shrub.translate(x+dx,.56,z);put(shrub,green);}box(x,.47,z+.7,1.1,.07,.25,wood);}}
 // Furnish the continuous public sidewalk, with a clear walking line.
 const z=block.z+block.d/2-.36;
 for(const side of [-1,1]){const pz=block.z+side*(block.d/2-.38);box(block.x,.213,pz,block.w-.15,.014,.66,stone);for(let x=block.x-block.w/2+.6;x<block.x+block.w/2-.3;x+=.85)box(x,.223,pz,.018,.007,.64,trim);}
 for(const side of [-1,1]){const x=block.x+side*(block.w/2-.40);box(x,.228,z,.55,.025,.55,cream);for(let k=-1;k<=1;k++)box(x+k*.13,.25,z,.035,.015,.40,bronze);}
 const planterCount=low?2:Math.min(6,Math.floor(block.w/3));
 for(let i=0;i<planterCount;i++){const x=block.x-block.w/2+1.5+i*(block.w-3)/Math.max(1,planterCount-1);
  box(x,.25,z,1.1,.12,.47,trim);box(x,.34,z,.96,.12,.36,soil);
  for(const dx of [-.3,0,.3]){const g=new THREE.IcosahedronGeometry(.23,1);g.scale(1,1.15,.8);g.translate(x+dx,.56,z);put(g,green);}
  if(i%2===0){box(x+.75,.52,z,.58,.08,.3,wood);for(const dx of [-.2,.2])box(x+.75+dx,.34,z,.045,.32,.24,dark);}
 }
 // Compact bus shelter sits on the sidewalk, not inside the vehicle lanes.
 if(!low&&Number(block.id.split('-').at(-1))%4===0){
 const sx=block.x+block.w/2-.40,sz=block.z;
 for(const dz of [-.9,.9])box(sx,1.02,sz+dz,.065,1.6,.065,dark);
 box(sx,1.87,sz,.9,.10,2.1,dark);box(sx-.13,.88,sz,.04,1.35,1.78,glass);box(sx+.18,.57,sz,.28,.08,1.4,wood);box(sx,1.74,sz+.92,.65,.16,.04,light);
 }
 // Human scale at storefronts and crossings; no synthetic wallet buildings.
 for(let i=0;i<(low?3:8);i++){const x=block.x-block.w/2+1+(i*.731%1)*(block.w-2),pz=z-.12+(i%2)*.20;
  box(x,.59,pz,.13,.34,.14,[blue,red,dark,cream][i%4]);for(const dx of [-.045,.045])box(x+dx,.33,pz,.045,.22,.06,dark);const head=new THREE.SphereGeometry(.075,6,4);head.translate(x,.84,pz);put(head,cream);}
 // Paired signal poles mark the adjoining avenue intersection, behind the curb.
 if(!low)for(const sign of [-1,1]){const x=block.x+sign*(block.w/2-.23),pz=block.z+block.d/2-.24;box(x,1.35,pz,.065,2.3,.065,dark);box(x,2.38,pz,.20,.46,.17,dark);box(x,2.43,pz+.095,.09,.09,.02,red);box(x,2.26,pz+.095,.09,.09,.02,green);}
 }
 const unit=new THREE.BoxGeometry(1,1,1);owned.push(unit);
 for(const [m,transforms]of instances){const mesh=new THREE.InstancedMesh(unit,m,transforms.length),cells=new Map();transforms.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix);const e=matrix.elements,key=[Math.floor(e[12]/80),Math.floor(e[14]/80)].join(',');if(!cells.has(key))cells.set(key,[]);cells.get(key).push(...e);});mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);instanceBatches.push({mesh,cells:[...cells].map(([key,values])=>({tile:key.split(',').map(Number),data:new Float32Array(values)}))});}
 for(const {m,tile,gs}of buckets.values()){const geometry=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());owned.push(geometry);const mesh=new THREE.Mesh(geometry,m);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);detailMeshes.push({mesh,tile});}
 let lastUpdate=-Infinity;
 const update=(camera,now=0,radius=180,force=false)=>{if(!force&&now-lastUpdate<250)return;lastUpdate=now;const near=tile=>Math.hypot((tile[0]+.5)*80-camera.x,(tile[1]+.5)*80-camera.z,Math.max(0,camera.y-15))<radius+57;
 for(const {mesh,cells}of instanceBatches){let offset=0;for(const cell of cells)if(near(cell.tile)){mesh.instanceMatrix.array.set(cell.data,offset);offset+=cell.data.length;}mesh.count=offset/16;mesh.instanceMatrix.needsUpdate=true;}
 for(const {mesh,tile}of detailMeshes)mesh.visible=near(tile);
 };
 return {group,block,update,buildingCount:selectedBlocks.reduce((n,b)=>n+(homesByBlock.get(b.id)?.length||0),0)};
}
