import {clearOfTerminal} from './harbor-infrastructure.js';
import polygonClipping from 'polygon-clipping';
import {roadEndSites} from './road-ends.js';
import {clippedSurface,roadOutline,rectangle,onLand} from './land-surfaces.js';
import {urbanGreens} from './urban-greens.js';
import {waterfrontPlan} from './waterfront.js';
import {parkStreetPlan,publicRealmSites,nearestOnSegment} from './public-realm.js';
import {bridgeConnections} from './geography.js';
import * as THREE from 'three';
import {cityLandscape} from '../fullcity/landscape.js';
import {AXIS_ANGLE} from '../fullcity/city-map.js';
export function geographicGround(layout,{put,box,mat,asphalt,grass,paving,time}){
 const land=mat(0x798c6b),edge=mat(0xb3ad99,.85,{side:THREE.DoubleSide});
 for(const rings of Object.values(layout.land))for(const ring of rings){const shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z))),g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,-.01,0);put(g,land);const skirt=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];skirt.push(a[0],-.44,a[1],b[0],-.44,b[1],a[0],-.011,a[1],a[0],-.011,a[1],b[0],-.44,b[1],b[0],-.011,b[1]);}const wall=new THREE.BufferGeometry();wall.setAttribute('position',new THREE.Float32BufferAttribute(skirt,3));wall.computeVertexNormals();put(wall,edge);}

 // A continuous lawn under the elevated park paths and lakes.
 for(const ring of layout.park){const shape=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z))),g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,.012,0);put(g,mat(0x527d46));}
 if(layout.originalGrid){
  const roads=[...layout.streets,...parkStreetPlan(layout).perimeter,...parkStreetPlan(layout).connections];
  // Draw continuous sidewalk margins first, then the carriageways, clipped to land.
  for(const road of roads)put(clippedSurface(layout,roadOutline(road,road.width+2.4),.023),paving);
  for(const road of roads)put(clippedSurface(layout,roadOutline(road),.042),asphalt);
  const marking=mat(0xe3dfc9);for(const c of layout.crossings){if(!layout.streets.some(r=>{const p={x:(c.a.x+c.b.x)/2,z:c.a.z},q=nearestOnSegment(p,r.a,r.b);return Math.hypot(p.x-q.x,p.z-q.z)<r.width/2+1;}))continue;const count=Math.max(7,Math.round(Math.abs(c.b.x-c.a.x)/.55));for(const side of [-1,1])for(let i=0;i<count;i++){const x=c.a.x+(c.b.x-c.a.x)*(i+.5)/count,z=c.a.z+side*(1.2*layout.geoScale/2+.3);if(rectangle(x,z,Math.abs(c.b.x-c.a.x)/count*.6,.75).every(([x,z])=>onLand(layout,x,z)))box(x,.063,z,Math.abs(c.b.x-c.a.x)/count*.6,.006,.75,marking);}}
 }
 for(const {start,end} of bridgeConnections(layout)){const dx=end.x-start.x,dz=end.z-start.z,len=Math.hypot(dx,dz),nx=-dz/len*1.4,nz=dx/len*1.4,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([start.x-nx,.30,start.z-nz,end.x-nx,.046,end.z-nz,start.x+nx,.30,start.z+nz,start.x+nx,.30,start.z+nz,end.x-nx,.046,end.z-nz,end.x+nx,.046,end.z+nz],3));g.computeVertexNormals();put(g,asphalt);}
 if(layout.originalGrid){
  const realm=publicRealmSites(layout),wood=mat(0x795f43),iron=mat(0x405451),leaves=mat(0x608152),trunk=mat(0x75624a),lamp=mat(0xffe3ad,.4,{emissive:0xffcb78,emissiveIntensity:time==='day'?.1:1.5});
  for(const p of realm.trees.filter(p=>clearOfTerminal(layout,p.x,p.z,2))){box(p.x,.13,p.z,1.25,.16,1.25,grass);box(p.x,.9,p.z,.08,1.5,.08,trunk);const crown=new THREE.IcosahedronGeometry(.65,1);crown.scale(1,1.3,1);crown.translate(p.x,1.65,p.z);put(crown,leaves);}
  const waterfront=waterfrontPlan(layout),lawn=mat(0x577d48),wall=mat(0x8b958c),walk=mat(0xb1b3a4);
  const strip=(s,width,height,y,m)=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,g=new THREE.BoxGeometry(width,height,Math.hypot(dx,dz)+.08);g.rotateY(Math.atan2(dx,dz));g.translate((s.a.x+s.b.x)/2,y,(s.a.z+s.b.z)/2);put(g,m);};
  const snap=ring=>ring.map(([x,z])=>[Math.round(x*1000)/1000,Math.round(z*1000)/1000]);
  const ribbons=waterfront.segments.map(s=>[snap(roadOutline(s,3.2))]);
  if(ribbons.length){const joined=polygonClipping.union(...ribbons),clipped=polygonClipping.intersection(joined,Object.values(layout.land).flatMap(rs=>rs.map(r=>[snap(r)])));
   for(const polygon of clipped){const shape=new THREE.Shape(polygon[0].map(([x,z])=>new THREE.Vector2(x,-z)));for(const hole of polygon.slice(1))shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,.235,0);put(g,walk);}
  }
  for(const [i,s]of waterfront.segments.entries()){
   const corners=roadOutline(s,3.6);if(!corners.every(([x,z])=>onLand(layout,x,z)))continue;
   // Furniture only on straight, generously separated reaches of the promenade.
   const nearCorner=layout.land[s.borough].some(r=>r.some(p=>Math.hypot(p[0]-s.a.x,p[1]-s.a.z)<6));if(nearCorner)continue;
   if(i%17===0){const x=s.a.x+s.nx,z=s.a.z+s.nz;box(x,1.1,z,.06,2.1,.06,iron);box(x,2.2,z,.3,.1,.3,lamp);}
  }
  for(const s of waterfront.connections)put(clippedSurface(layout,roadOutline(s,s.width),.237),walk);
  for(const p of waterfront.pockets){const dx=Math.sin(p.angle)*p.d/2,dz=Math.cos(p.angle)*p.d/2;put(clippedSurface(layout,roadOutline({a:{x:p.x-dx,z:p.z-dz},b:{x:p.x+dx,z:p.z+dz}},p.w),.24),lawn);}
  for(const site of roadEndSites(layout)){const {end,ux,uz,width}=site,nx=-uz,nz=ux;put(clippedSurface(layout,site.outline,.072),paving);
   // A transverse curb return, central accessible opening and paired bollards.
   for(const side of [-1,1]){const a={x:end.x+ux*.2+nx*side*.85,z:end.z+uz*.2+nz*side*.85},b={x:end.x+ux*.2+nx*side*(width/2+.6),z:end.z+uz*.2+nz*side*(width/2+.6)};strip({a,b},.18,.15,.15,wall);box(a.x,.42,a.z,.10,.7,.10,iron);}
   const a={x:end.x+ux*.3,z:end.z+uz*.3},b={x:end.x+ux*5,z:end.z+uz*5};if(roadOutline({a,b},1.5).every(([x,z])=>onLand(layout,x,z)))put(clippedSurface(layout,roadOutline({a,b},1.5),.073),paving);
  }
  for(const p of waterfront.trees.filter(p=>clearOfTerminal(layout,p.x,p.z,2))){box(p.x,.72,p.z,.09,1.3,.09,trunk);const g=new THREE.IcosahedronGeometry(.72,1);g.scale(1,1.25,1);g.translate(p.x,1.5,p.z);put(g,leaves);}
  // Keep reclaimed paths/planting off the retained network and bridge approaches.
  const reserved=polygonClipping.union(...layout.streets.map(r=>[snap(roadOutline(r,r.width+1.2))]),...bridgeConnections(layout).map(({start:a,end:b})=>[snap(roadOutline({a,b},4))]));
  const gardenLand=polygonClipping.union(...Object.values(layout.land).flatMap(rs=>rs.map(r=>[snap(r)])));
  const gardenSurface=(s,width,y,m)=>{
   if(Math.hypot(s.b.x-s.a.x,s.b.z-s.a.z)<.1)return;
   const area=polygonClipping.difference(polygonClipping.intersection([snap(roadOutline(s,width))],gardenLand),reserved);
   for(const poly of area){const shape=new THREE.Shape(poly[0].map(([x,z])=>new THREE.Vector2(x,-z)));for(const hole of poly.slice(1))shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,y,0);put(g,m);}
  };
  // Reclaimed carriageways: lawn, a narrow walk, shade trees and seating.
  for(const [index,s] of (layout.shoreGardens||[]).entries()){
   gardenSurface(s,s.width+2.4,.08,lawn);
   gardenSurface(s,1.25,.245,walk);
   const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
   for(let t=3;t<len-2;t+=6){const side=(Math.floor(t/6)+index)%2?1:-1,x=s.a.x+ux*t-uz*side*(s.width*.3),z=s.a.z+uz*t+ux*side*(s.width*.3);
    if(!rectangle(x,z,2.4,2.4).every(([x,z])=>onLand(layout,x,z))||!clearOfTerminal(layout,x,z,3)||layout.streets.some(r=>{const q=nearestOnSegment({x,z},r.a,r.b);return Math.hypot(q.x-x,q.z-z)<r.width/2+2;})||layout.homes.some(h=>Math.abs(x-h.x)<(h.width||h.identity.width)/2+1.5&&Math.abs(z-h.z)<(h.depth||h.identity.depth)/2+1.5))continue;
    box(x,1.1,z,.12,2,.12,trunk);const crown=new THREE.IcosahedronGeometry(.95,1);crown.scale(1,1.3+(index%3)*.2,1);crown.translate(x,2.4,z);put(crown,leaves);
    if(Math.floor(t/6)%3===0){box(x+ux*1.6,.45,z+uz*1.6,1.35,.12,.45,wood);box(x+ux*1.6,.24,z+uz*1.6,1.1,.4,.3,iron);}
   }
  }
  const greens=urbanGreens(layout,waterfront),meadow=mat(0x688852),flowers=mat(0x8e9870);
  for(const p of greens.seats.filter(p=>clearOfTerminal(layout,p.x,p.z,2))){box(p.x,.42,p.z,1.3,.10,.45,wood);box(p.x,.63,p.z+.19,1.3,.32,.06,wood);for(const dx of [-.45,.45])box(p.x+dx,.23,p.z,.07,.35,.38,iron);}
  for(const p of greens.beds.filter(p=>clearOfTerminal(layout,p.x,p.z,5)))put(clippedSurface(layout,rectangle(p.x,p.z,7,5),.215),meadow);
  for(const s of greens.paths.filter(s=>[0,.25,.5,.75,1].every(t=>clearOfTerminal(layout,s.a.x+(s.b.x-s.a.x)*t,s.a.z+(s.b.z-s.a.z)*t,1))))put(clippedSurface(layout,roadOutline(s,1.35),.22),walk);
  for(const [i,p]of greens.trees.filter(p=>clearOfTerminal(layout,p.x,p.z,2)).entries()){box(p.x,.85*p.scale,p.z,.11,1.6*p.scale,.11,trunk);for(let k=0;k<2;k++){const g=p.form===2?new THREE.ConeGeometry(.65*p.scale,1.6*p.scale,7):new THREE.IcosahedronGeometry(.8*p.scale,1);g.scale(p.form===0?1.25:.8,p.form===1?1.7:1.1,p.form===0?1.2:.85);g.translate(p.x+k*.22,1.85*p.scale+k*.4,p.z);put(g,i%4===0?lawn:leaves);}if(i%33===0){box(p.x+1,.45,p.z,1.2,.12,.4,wood);}}
  // Short planted medians leave junctions and pedestrian crossings open.
  for(const road of layout.streets){if(road.width<5.5)continue;const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,len=Math.hypot(dx,dz);for(let t=6;t<len-6;t+=9){const p={x:road.a.x+dx*t/len,z:road.a.z+dz*t/len};if(!onLand(layout,p.x,p.z)||layout.streets.some(other=>other!==road&&Math.hypot(nearestOnSegment(p,other.a,other.b).x-p.x,nearestOnSegment(p,other.a,other.b).z-p.z)<other.width/2+2))continue;const a={x:p.x-dx/len*2,z:p.z-dz/len*2},b={x:p.x+dx/len*2,z:p.z+dz/len*2};put(clippedSurface(layout,roadOutline({a,b},1.05),.13),wall);put(clippedSurface(layout,roadOutline({a,b},.78),.16),lawn);box(p.x,1.1,p.z,.11,2,.11,trunk);const g=new THREE.IcosahedronGeometry(.65,1);g.scale(1,1.45,1);g.translate(p.x,2.35,p.z);put(g,leaves);for(const sign of [-1,1]){const shrub=new THREE.IcosahedronGeometry(.34,1);shrub.scale(1,.7,1.4);shrub.translate(p.x+dx/len*1.35*sign,.4,p.z+dz/len*1.35*sign);put(shrub,lawn);}}}
  return;
 }
 const cells=[...layout.blocks,...layout.landmarkBlocks,...layout.gardens],paint=mat(0xe3dfc9),seen=new Set();
 for(const b of cells){box(b.x,.025,b.z,layout.cellW,.025,layout.cellD,asphalt);
  for(const sx of [-1,1])for(const sz of [-1,1]){const x=b.x+sx*layout.cellW/2,z=b.z+sz*layout.cellD/2,offset=layout.road/2+layout.sidewalk/2;
   for(const axis of ['x','z']){const cx=x+(axis==='z'?-sx*offset:0),cz=z+(axis==='x'?-sz*offset:0),key=`${cx.toFixed(4)}:${cz.toFixed(4)}:${axis}`;if(seen.has(key))continue;seen.add(key);
    for(let i=0;i<9;i++){const t=-layout.road/2+(i+.5)*layout.road/9;box(cx+(axis==='x'?t:0),.045,cz+(axis==='z'?t:0),axis==='x'?layout.road/9*.62:layout.sidewalk*.8,.005,axis==='z'?layout.road/9*.62:layout.sidewalk*.8,paint);}
   }
  }
 }
}
export function geographicLandscape(scene,layout,liberty,owned,materials,time='dusk'){
 const group=new THREE.Group();cityLandscape(group,1,liberty,owned,materials,{approachScale:layout.originalGrid?.45:1,bridgeRise:2.8,parkEdgeClearance:1,treeVertical:layout.geoScale/1.5,shapedIsland:true,monumentNight:time!=='day'});
 const origin=layout.project(0,0);group.position.set(origin.x,.05,origin.z);group.rotation.y=AXIS_ANGLE-Math.PI/2;group.scale.set(layout.geoScale,1.5,layout.geoScale);
 // Keep the imported statue proportional while the map expands horizontally.
 for(const child of [...group.children])if(child.isGroup){const wrapper=new THREE.Group();wrapper.position.copy(child.position);child.position.set(0,0,0);wrapper.scale.set(3/layout.geoScale,2,3/layout.geoScale);group.remove(child);wrapper.add(child);group.add(wrapper);}
 scene.add(group);group.updateMatrixWorld(true);for(const child of group.children)if(child.isGroup){const bounds=new THREE.Box3().setFromObject(child),center=bounds.getCenter(new THREE.Vector3()),target=new THREE.Vector3(layout.harbor.x,center.y,layout.harbor.z);const localTarget=group.worldToLocal(target),localCenter=group.worldToLocal(center);child.position.add(localTarget.sub(localCenter));group.updateMatrixWorld(true);const base=new THREE.Box3().setFromObject(child).min.y;child.position.y+=(.78-base)/1.5;}
 if(time!=='day'&&liberty){const target=new THREE.Object3D();target.position.set(layout.harbor.x,6,layout.harbor.z);scene.add(target);for(const [dx,dz]of [[10,8],[-8,-6]]){const light=new THREE.SpotLight(0xffe4b9,90,40,Math.PI/5,.65,1);light.position.set(layout.harbor.x+dx,3,layout.harbor.z+dz);light.target=target;light.castShadow=false;scene.add(light);}}
}
