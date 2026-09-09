import * as THREE from 'three';
import snapshot from '../fullcity/infrastructure.json' with {type:'json'};
import {infraFrom,siteAt,SITES} from '../fullcity/city-infra.js';
export const harborSupply=infraFrom(snapshot);
// One aggregate terminal, attached to the Red Hook shoreline; dimensions are visual, not supply-scaled.
export function exchangeBerthPlan(){const origin={x:-45,z:-115.75};return {origin,length:5.5,sites:[{name:'All exchanges',tokens:harborSupply.cex,x:-45,z:-113,length:5.5,wide:2.5,tall:1.6,share:1}]};}
export function harborSites(layout){const lp=siteAt(SITES.lp),p=exchangeBerthPlan();return {uniswap:layout.project(lp.x,lp.z),exchanges:layout.project(p.sites[0].x,p.sites[0].z)};}
export function clearOfTerminal(layout,x,z,pad=0){const p=exchangeBerthPlan(),a=layout.project(p.origin.x,p.origin.z),b=layout.project(p.origin.x,p.origin.z+p.length),dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)>2.8*layout.geoScale+pad;}
export function harborInfrastructure(scene,layout,time,owned,materials,{put,mat}){
 if(!layout.originalGrid)return;
 const stone=mat(0xa3a89f),shed=mat(0xb1bdb6),steel=mat(0xbfa168,.5,{metalness:.4}),roof=mat(0x556568),glass=mat(0x35494b),brick=mat(0x9a6b51),grass=mat(0x68884f),pink=mat(0xcc73ab,.6,{emissive:0x93346d,emissiveIntensity:time==='day'?.1:.6}),wood=mat(0x957c5a),containers=[mat(0x727f81),mat(0x99734f),mat(0x6b8071)];
 const add=(g,m)=>{const p=g.attributes.position;for(let i=0;i<p.count;i++){const q=layout.project(p.getX(i),p.getZ(i));p.setXYZ(i,q.x,p.getY(i)*1.5+.05,q.z);}g.computeVertexNormals();put(g,m);};
 const box=(x,y,z,w,h,d,m)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m);};
 // A compact terminal on a single pier, with its landward edge at Red Hook.
 const terminal=exchangeBerthPlan().sites[0],x=terminal.x,z=terminal.z;
 box(x,.05,z,4,.4,5.5,stone);
 box(x+.4,1.1,z+.25,2.4,1.6,3.1,shed);box(x+.4,1.95,z+.25,2.55,.15,3.3,roof);
 for(let i=0;i<5;i++){box(x-.815,1.0,z-.8+i*.5,.025,.6,.32,glass);box(x+.4,2.08,z-.8+i*.5,1.9,.11,.16,shed);}
 for(const dz of [-1.7,1.7]){for(const dx of [-1.6,1.6])box(x+dx,1.5,z+dz,.10,2.8,.12,steel);box(x-.25,2.95,z+dz,4.7,.13,.15,steel);box(x-2.5,2.1,z+dz,.025,1.6,.025,glass);}
 for(let i=0;i<6;i++)box(x+1.6,.55,z-2.1+i*.7,.45,.6,.55,containers[i%3]);
 // Loading apron joins the mainland end, leaving the harbor-side end as a finished seawall.
 box(x,.27,z-2.0,3.6,.025,1.15,roof);for(let i=0;i<4;i++)box(x-1.2+i*.8,.29,z-2,.05,.015,.6,stone);
 const lp=siteAt(SITES.lp);
 // An illustrative tapered island, with a continuous seawall and garden walk.
 const outline=[[-3.1,-5],[-1.8,-6.2],[.6,-6.5],[2.6,-4.5],[3.3,-1],[2.7,2.8],[1,4],[-1.4,3.8],[-3.2,1.5]];
 const surface=(scale,y,depth,m)=>{const sh=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(lp.x+x*scale,-lp.z-z*scale)));const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,m);};
 surface(1,-.16,.40,stone);surface(.94,.25,.025,wood);surface(.82,.28,.025,grass);
 box(lp.x,.31,lp.z-.7,.28,.025,8,stone);box(lp.x,.32,lp.z,4.8,.025,.24,stone);
 // Castle Williams-inspired masonry ring: open courtyard, separate window openings and coping.
 const cx=lp.x-1.1,cz=lp.z+1.5;
 const ring=new THREE.Shape();ring.absarc(0,0,1.18,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,.85,0,Math.PI*2,true);ring.holes.push(hole);const fort=new THREE.ExtrudeGeometry(ring,{depth:1.35,bevelEnabled:false,curveSegments:32});fort.rotateX(-Math.PI/2);fort.translate(cx,.32,cz);add(fort,brick);
 for(let j=0;j<32;j++){const a=j/32*Math.PI*2;for(const y of [.72,1.22]){const g=new THREE.BoxGeometry(.13,.19,.035);g.rotateY(Math.PI/2-a);g.translate(cx+Math.cos(a)*1.185,y,cz+Math.sin(a)*1.185);add(g,glass);}const g=new THREE.BoxGeometry(.25,.12,.34);g.rotateY(Math.PI/2-a);g.translate(cx+Math.cos(a)*1.015,1.71,cz+Math.sin(a)*1.015);add(g,stone);}
 const n=Math.max(3,Math.round(harborSupply.lp/2.2e6));for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=lp.x+Math.cos(a)*1.4,z=lp.z-2.3+Math.sin(a)*1.4;box(x,.65,z,.55,.7,.55,shed);box(x,1.01,z,.57,.035,.57,pink);box(x,1.06,z,.58,.06,.58,roof);}
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,x=lp.x+Math.cos(a)*2.3,z=lp.z-1+Math.sin(a)*3.4;box(x,.6,z,.05,.6,.05,wood);const g=new THREE.IcosahedronGeometry(.27,1);g.scale(1,1.5,1);g.translate(x,1,z);add(g,grass);}
 box(lp.x+3.6,.18,lp.z+1,1.8,.18,.5,wood);
}
