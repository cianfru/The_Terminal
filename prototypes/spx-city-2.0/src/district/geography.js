import {coastalStreetPlan} from './coastal-streets.js';
import {neighborhoodIdentity} from './neighborhood-character.js';
import {repairCoastalParcels} from './shore-repair.js';
import {NYC} from '../fullcity/nyc-geo.js';
import {toAxis,fromAxis,CITY_LENGTH,pointInRing,placeCity,cityScale,NEIGHBOURHOODS,BRIDGE_LINE,fromLatLon,hoodGrid,boroughGrid,streetGrid,boroughStreets,GRID,ROAD_W,crosswalks} from '../fullcity/city-map.js';
import {DESIGNS} from './model.js';
import {SILHOUETTES} from './silhouettes.js';
// Harbor-facing shores are illustrative shoreline traces, not water-inclusive borough boundaries.
const coastline=id=>{const rings=NYC[id].map(r=>r.map(p=>[...p]));
 if(id==='jersey'){const r=rings[0];rings[0]=[...r.slice(0,4),[-103,-136],[-93,-127],[-86,-117],[-80,-110],[-75,-103],[-71,-96],[-68,-88],[-60,-82],[-55,-73],[-49,-65],...r.slice(6)];}
 if(id==='brooklyn'){const r=rings[0],i=r.findIndex(p=>p[0]===-24.86);rings[0]=[[-48,-170],...r.slice(1,i+1),[-30,-91],[-32,-96],[-35,-101],[-38,-106],[-44,-112],[-47,-119],[-46,-130],[-47,-140],[-47,-154]];}
 return rings;
};
const boroughs=['manhattan','brooklyn','queens','bronx','jersey'];
const hoodId=w=>w.hood.id??w.hood;
export function geographicLayout(wallets,key='compact'){
 const scale=4.75,k=cityScale(wallets.length),placed=placeCity(wallets,k);
 const project=(x,z)=>{const a=toAxis(x,z);return {x:-a.u*scale,z:a.t*CITY_LENGTH*scale};};
 let land=Object.fromEntries(boroughs.map(id=>[id,coastline(id).map(r=>r.map(([x,z])=>{const p=project(x,z);return [p.x,p.z];}))]));
 const park=NYC.centralpark.map(r=>r.map(([x,z])=>{const p=project(x,z);return [p.x,p.z];}));
 const sourceBlocks=[...NEIGHBOURHOODS.flatMap(h=>hoodGrid(h,k).blocks.map(b=>({...b,hood:h.id,borough:'manhattan'}))),...boroughGrid(k).blocks.map(b=>({...b,borough:'outer'}))];
 const blocks=sourceBlocks.map((b,i)=>({...b,...project(b.x/k,b.z/k),w:b.w/k*scale+.35,d:b.d/k*scale+.35,id:'original-'+i,cell:'original-'+i,homes:[]}));
 const outerIds=['brooklyn','queens','bronx','jersey'];
 const homes=placed.map((w,i)=>{const p=project(w.x/k,w.z/k),hood=hoodId(w),borough=outerIds.includes(hood)?hood:'manhattan';
  const b=blocks.filter(b=>borough==='manhattan'?b.hood===hood:(b.borough==='outer'||b.borough===borough)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  b.homes.push(w.a);if(b.borough==='outer')b.borough=borough;
  let identity=w.identity,h=w.h;
  if(i>=12&&borough!=='manhattan'){const ids=[31,32,33,34,35,36,37,38,39],silhouette=ids[(identity.typeId+identity.palette)%ids.length];identity={...identity,silhouette,name:SILHOUETTES[silhouette].name,family:'masonry',width:2.35+(identity.palette%4)*.10,depth:2.1+(identity.typeId%3)*.1};h=4+(w.h-7)*.48;}
  else if(i>=12&&['tribeca','village'].includes(hood)){const silhouette=[33,35,37][identity.palette%3];identity={...identity,silhouette,name:SILHOUETTES[silhouette].name,family:'masonry'};h=w.h*.65;}
  if(i>=12)identity=neighborhoodIdentity(identity,{address:w.a,borough,hood,x:p.x,z:p.z});
  if(i>=12)identity={...identity,width:identity.width*scale/2.8,depth:identity.depth*scale/2.8};
  return {...w,...p,identity,h,block:b.id,borough,hood};
 });
 land=repairCoastalParcels(land,blocks,homes);
 const occupied=blocks.filter(b=>b.homes.length),landmarkBlocks=homes.slice(0,12).map(w=>occupied.find(b=>b.id===w.block));
 const sourceStreets=[...streetGrid(k),...boroughStreets(k)].map(s=>{const a=project(s.x1/k,s.z1/k),b=project(s.x2/k,s.z2/k);return {a,b,width:(s.kind==='avenue'?ROAD_W.avenue:ROAD_W.street)*scale/k};});
 const {streets,shoreGardens}=coastalStreetPlan({land},sourceStreets);
 const crossings=crosswalks(k).map(s=>({a:project(s.x1/k,s.z1/k),b:project(s.x2/k,s.z2/k)}));
 const minX=Math.min(...occupied.map(b=>b.x-b.w/2))-5,maxX=Math.max(...occupied.map(b=>b.x+b.w/2))+5,minZ=Math.min(...occupied.map(b=>b.z-b.d/2))-5,maxZ=Math.max(...occupied.map(b=>b.z+b.d/2))+5,mon=fromLatLon(40.6892,-74.0445);
 return {key,...DESIGNS[key],perBlock:10,full:true,geographic:true,originalGrid:true,geoScale:scale,project,land,park,streets,shoreGardens,crossings,blocks:occupied,landmarkBlocks,gardens:[],homes,harbor:project(mon.x,mon.z),bridge:project(fromLatLon(40.706,-73.997).x,fromLatLon(40.706,-73.997).z),housingStart:12,cellW:(GRID.blkU*GRID.lotU+GRID.avenue)*scale,cellD:(GRID.blkT*GRID.lotT+GRID.street)*scale,blockW:GRID.blkU*GRID.lotU*scale,blockD:GRID.blkT*GRID.lotT*scale,width:maxX-minX,depth:maxZ-minZ,minX,maxX,minZ,maxZ,centerX:(minX+maxX)/2,rows:Math.ceil((maxZ-minZ)/((GRID.blkT*GRID.lotT+GRID.street)*scale)),area:(maxX-minX)*(maxZ-minZ),treeSites:[]};
}

export function bridgeConnections(layout){
 const a=fromLatLon(...BRIDGE_LINE.from),b=fromLatLon(...BRIDGE_LINE.to),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),half=layout.originalGrid?8.5+(6016*.3048/100/2+2.3-8.5)*.45:6016*.3048/100/2+2.3,cells=[...layout.blocks,...layout.landmarkBlocks,...layout.gardens];
 return [-1,1].map(sign=>{const start=layout.project((a.x+b.x)/2+sign*dx/len*half,(a.z+b.z)/2+sign*dz/len*half),nodes=layout.originalGrid?layout.streets.map(s=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=Math.max(0,Math.min(1,((start.x-s.a.x)*dx+(start.z-s.a.z)*dz)/(dx*dx+dz*dz||1)));return {x:s.a.x+t*dx,z:s.a.z+t*dz};}):cells.flatMap(b=>[-1,1].flatMap(sx=>[-1,1].map(sz=>({x:b.x+sx*layout.cellW/2,z:b.z+sz*layout.cellD/2}))));
  nodes.sort((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z));
  const end=nodes.find(end=>Array.from({length:41},(_,i)=>({x:start.x+(end.x-start.x)*i/40,z:start.z+(end.z-start.z)*i/40})).every(p=>Object.values(layout.land).some(rings=>rings.some(r=>pointInRing(p.x,p.z,r)))&&!(layout.originalGrid?layout.homes.some(w=>Math.abs(p.x-w.x)<(w.width||w.identity.width)/2+.2&&Math.abs(p.z-w.z)<(w.width||w.identity.depth)/2+.2):cells.some(b=>Math.abs(p.x-b.x)<b.w/2+.4&&Math.abs(p.z-b.z)<b.d/2+.4))));
  return end?{start,end}:null;
 }).filter(Boolean);
}
