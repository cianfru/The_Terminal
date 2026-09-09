import {clearOfPath,segmentDistance} from './planting.js';
import * as THREE from 'three';
import {fromLatLon,pointInRing,parkFeatures} from './source-map.js';
import {NYC} from './nyc-geo.js';
const ll=(lat,lon)=>{const p=fromLatLon(lat,lon);return [p.x,p.z];};
export const PARK_SITES={bethesda:ll(40.7744,-73.9709),bow:ll(40.7757,-73.9718),reservoir:ll(40.7856,-73.9637),mall:ll(40.7726,-73.9717)};
export function buildPark({put,mats,rod,edgeClearance=.3,treeVertical=1}){
 const roadRings=parkFeatures().roads;
 const ring=NYC.centralpark[0],angle=-.51,ca=Math.cos(angle),sa=Math.sin(angle);
 const ellipses=[{p:PARK_SITES.reservoir,rx:3.1,rz:4.4},{p:ll(40.7764,-73.9728),rx:1.9,rz:1.85},{p:ll(40.7676,-73.9736),rx:.9,rz:.45}];
 const coord=(p,x,z)=>[p[0]+x*ca-z*sa,p[1]+x*sa+z*ca];
 const ellipse=(p,rx,rz,y,m)=>{const sh=new THREE.Shape();for(let i=0;i<=64;i++){const t=i/64*Math.PI*2,[x,z]=coord(p,Math.cos(t)*rx*(m===mats.lake||m===mats.path?1+.07*Math.sin(t*3)+.04*Math.cos(t*5):1),Math.sin(t)*rz*(m===mats.lake||m===mats.path?1+.07*Math.sin(t*3)+.04*Math.cos(t*5):1));i?sh.lineTo(x,z):sh.moveTo(x,z);}const g=new THREE.ShapeGeometry(sh);g.rotateX(Math.PI/2);g.translate(0,y,0);put(g,m);};
 const bowSite=PARK_SITES.bow,lakeRing=[[-2.8,-.7],[-2.3,-1.2],[-1.4,-1],[-.5,-.2],[0,-.22],[.45,-.5],[.9,-.35],[1.05,.2],[.7,.6],[.25,.35],[0,.22],[-.7,.3],[-1,1.6],[-2,2],[-2.7,1.2]].map(([x,z])=>[bowSite[0]+x,bowSite[1]+z]);
 const lakeShape=(scale,y,m)=>{const sh=new THREE.Shape();lakeRing.forEach(([x,z],i)=>{x=bowSite[0]+(x-bowSite[0])*scale;z=bowSite[1]+(z-bowSite[1])*scale;i?sh.lineTo(x,z):sh.moveTo(x,z);});sh.closePath();const g=new THREE.ShapeGeometry(sh);g.rotateX(Math.PI/2);g.translate(0,y,0);put(g,m);};
 ellipses.forEach((e,i)=>{if(i===1){lakeShape(1.035,.048,mats.path);lakeShape(1,.055,mats.lake);}else{ellipse(e.p,e.rx+.09,e.rz+.09,.048,mats.path);ellipse(e.p,e.rx,e.rz,.055,mats.lake);}});
 const paths=[];
 const path=(pts,width=.045,m=mats.path,y=.065)=>{const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0],y,p[1])));const ps=curve.getPoints(160),v=[],ix=[];
 // Keep the entire ribbon on the garden side of the perimeter drive.
 const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
 if(treeVertical>1)for(const p of ps){let tries=0;while(tries++<160&&(!pointInRing(p.x,p.z,ring)||ring.some((a,j)=>segmentDistance(p.x,p.z,...a,...ring[(j+1)%ring.length])<.65+width))){const d=Math.hypot(cx-p.x,cz-p.z);p.x+=(cx-p.x)/d*.06;p.z+=(cz-p.z)/d*.06;}}
for(let i=0;i<ps.length;i++){const tangent=ps[Math.min(i+1,ps.length-1)].clone().sub(ps[Math.max(0,i-1)]).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x);for(const side of [-1,1])v.push(...ps[i].clone().addScaledVector(normal,width*side));if(i<ps.length-1){const n=i*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();put(g,m);paths.push(ps);};
 const mall=PARK_SITES.mall,b=PARK_SITES.bethesda;
 path([ll(40.7695,-73.974),mall,b],.11);
 path([ll(40.768,-73.978),ll(40.773,-73.977),ll(40.776,-73.9757),ll(40.7788,-73.9742),ll(40.7825,-73.9708),ll(40.788,-73.9663),ll(40.7947,-73.9605)],.065);
 path([ll(40.7682,-73.972),ll(40.773,-73.968),ll(40.7798,-73.9659),ll(40.784,-73.9585),ll(40.79,-73.956),ll(40.796,-73.9507)],.065);
 path([PARK_SITES.bow,b,ll(40.7749,-73.9677)],.055);
 const lawns=[{p:ll(40.7718,-73.9746),rx:1.05,rz:1.3},{p:ll(40.7812,-73.9667),rx:1.35,rz:1.7}];for(const l of lawns)ellipse(l.p,l.rx,l.rz,.05,mats.lawn);
 const inEllipse=(p,e,pad=0)=>{const dx=p[0]-e.p[0],dz=p[1]-e.p[1],x=dx*ca+dz*sa,z=-dx*sa+dz*ca;return x*x/(e.rx+pad)**2+z*z/(e.rz+pad)**2<1;};
 const treePut=(g,m)=>{const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.05+(p.getY(i)-.05)*treeVertical);g.computeVertexNormals();put(g,m);};
 const tree=(x,z,s)=>{const kind=treeVertical>1?Math.abs(Math.round(x*31+z*19))%3:0;const trunk=new THREE.CylinderGeometry(.018,.025,s*.6,5);trunk.translate(x,.05+s*.3,z);treePut(trunk,mats.trunk);for(let i=0;i<(kind===2?2:3);i++){const g=kind===2?new THREE.ConeGeometry(s*(.32-i*.07),s*.65,7):new THREE.IcosahedronGeometry(s*(kind===1?.30:.38),1);g.scale(kind===0?1.2:1,kind===1?1.7:1.15,kind===0?1.15:1);g.translate(x+Math.sin(i*2.4)*s*.14,.05+s*.6+i*s*.05,z+Math.cos(i*2.4)*s*.14);treePut(g,mats.leaves[i%3]);}};
 const treeSites=[];
 let seed=7927,count=0;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
 for(let i=0;i<7000&&count<(treeVertical>1?700:1000);i++){const p=[xmin+rand()*(xmax-xmin),zmin+rand()*(zmax-zmin)];if(!pointInRing(...p,ring)||(ellipses.some(e=>inEllipse(p,e,.25))||pointInRing(...p,lakeRing))||lawns.some(e=>inEllipse(p,e))||Math.hypot(p[0]-b[0],p[1]-b[1])<.8||paths.some(points=>!clearOfPath(p,points,.28))||roadRings.some(r=>pointInRing(...p,r)||r.some((v,j)=>segmentDistance(...p,...v,...r[(j+1)%r.length])<.24))||ring.some((v,j)=>segmentDistance(...p,...v,...ring[(j+1)%ring.length])<edgeClearance))continue;if(treeVertical>1&&treeSites.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.28))continue;tree(...p,treeVertical>1?.20+rand()*.24:.18+rand()*.2);treeSites.push(p);count++;}
 // Bethesda Terrace: plaza, two stair flights, balustrades, tiered fountain and winged figure.
 ellipse(b,.7,.55,.075,mats.stone);
 const cylinder=(r1,r2,h,y,m,x=b[0],z=b[1])=>{const g=new THREE.CylinderGeometry(r1,r2,h,32);g.translate(x,y,z);put(g,m);};
 cylinder(.22,.25,.045,.1,mats.stone);cylinder(.207,.207,.01,.13,mats.lake);cylinder(.025,.04,.17,.2,mats.stone);cylinder(.12,.04,.04,.27,mats.stone);cylinder(.017,.025,.13,.34,mats.copper);cylinder(.025,.025,.035,.42,mats.copper);
 for(const sign of [-1,1])rod([b[0],.38,b[1]],[b[0]+sign*.075,.415,b[1]],.009,mats.copper);
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(b[0]+Math.cos(a)*.04,.29,b[1]+Math.sin(a)*.04),new THREE.Vector3(b[0]+Math.cos(a)*.16,.29,b[1]+Math.sin(a)*.16),new THREE.Vector3(b[0]+Math.cos(a)*.18,.14,b[1]+Math.sin(a)*.18));put(new THREE.TubeGeometry(curve,12,.002,4),mats.lake);}
 for(const sign of [-1,1])for(let i=0;i<6;i++){const g=new THREE.BoxGeometry(.2,.025+i*.012,.075);g.translate(b[0]+sign*.45,.075+i*.006,b[1]-.2-i*.07);put(g,mats.stone);}
 const terrace=new THREE.BoxGeometry(1.2,.09,.3);terrace.translate(b[0],.1,b[1]-.64);put(terrace,mats.stone);for(let i=0;i<20;i++){const g=new THREE.BoxGeometry(.018,.055,.018);g.translate(b[0]-.57+i*.06,.173,b[1]-.78);put(g,mats.stone);}
 // Bow Bridge: shallow cast-iron arch with continuous deck and pierced railings.
 const bow=PARK_SITES.bow;for(let i=0;i<24;i++){const a=-.3+i*.025,z=-.3+(i+1)*.025,yy=t=>.1+.1*(1-(t/.3)**2);const g=new THREE.BoxGeometry(.09,.014,.03);g.translate(bow[0],yy((a+z)/2),bow[1]+(a+z)/2);put(g,mats.iron);for(const side of [-1,1]){rod([bow[0]+side*.049,yy(a)+.065,bow[1]+a],[bow[0]+side*.049,yy(z)+.065,bow[1]+z],.004,mats.iron);rod([bow[0]+side*.049,yy(a),bow[1]+a],[bow[0]+side*.049,yy(a)+.065,bow[1]+a],.002,mats.iron);}}
 return {treeCount:count,treeSites};
}
