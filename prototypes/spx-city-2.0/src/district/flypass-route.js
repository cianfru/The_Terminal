import * as THREE from 'three';
import {harborSites} from './harbor-infrastructure.js';
import {fromLatLon} from '../fullcity/city-map.js';
export const FLYPASS_DURATION=84;
const routes=new WeakMap();
const smooth=u=>u*u*(3-2*u);
function route(layout){if(routes.has(layout))return routes.get(layout);
 const sites=harborSites(layout),liberty=layout.harbor,park=layout.park[0],pz0=Math.min(...park.map(p=>p[1])),pz1=Math.max(...park.map(p=>p[1])),pcx=park.reduce((s,p)=>s+p[0],0)/park.length;
 const raw=fromLatLon(40.7645,-73.973),fifth=layout.project(raw.x,raw.z),avenues=layout.streets.filter(r=>Math.abs(r.b.z-r.a.z)>Math.abs(r.b.x-r.a.x)&&Math.max(r.a.z,r.b.z)>pz0-60&&Math.min(r.a.z,r.b.z)<pz0);
 const road=avenues.sort((a,b)=>Math.abs(a.a.x-fifth.x)-Math.abs(b.a.x-fifth.x))[0],ax=road?road.a.x+road.width*.24:fifth.x,d=sites.exchanges;
 const points=[
 [liberty.x+24,14,liberty.z+10],[liberty.x+21,17,liberty.z+23],
 [d.x+22,27,d.z+25],[d.x+10,23,d.z+15],[d.x-12,33,d.z-14],
 [ax-55,78,pz0-190],[ax,63,pz0-150],[ax,25,pz0-115],[ax,20,pz0-85],
 [ax,58,pz0-64],[ax+23,65,pz0-49],[ax+28,62,pz0-29],
 [ax+12,50,pz0-10],[pcx+5,26,pz0+17],
 [pcx+3,24,pz0+(pz1-pz0)*.24],[pcx+15,52,pz0+(pz1-pz0)*.43],[pcx+30,100,pz0+(pz1-pz0)*.65]
 ].map(p=>new THREE.Vector3(...p));
 const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');curve.arcLengthDivisions=1500;curve.updateArcLengths();
 // Raise a continuous altitude envelope before any building, including spline turn overshoot.
 const samples=Array.from({length:841},(_,i)=>curve.getPointAt(i/840));
 for(let i=0;i<samples.length;i++){const p=samples[i];let clearance=p.y;for(const w of layout.homes)if(Math.abs(p.x-w.x)<(w.width||w.identity.width)/2+4&&Math.abs(p.z-w.z)<(w.width||w.identity.depth)/2+4)clearance=Math.max(clearance,w.h+7);if(clearance>p.y){const delta=clearance-p.y;for(let j=Math.max(0,i-22);j<=Math.min(samples.length-1,i+22);j++){const weight=(1+Math.cos((j-i)/23*Math.PI))/2;samples[j].y=Math.max(samples[j].y,curve.getPointAt(j/840).y+delta*weight);}}}
 const data={samples,liberty,d,ax,pz0};routes.set(layout,data);return data;
}
export function flypassRoute(layout,t){const r=route(layout),u=THREE.MathUtils.clamp(t/FLYPASS_DURATION,0,1),s=u*.82+smooth(u)*.18;
 const at=q=>{const f=THREE.MathUtils.clamp(q,0,1)*840,i=Math.min(839,Math.floor(f));return r.samples[i].clone().lerp(r.samples[i+1],f-i);};
 const position=at(s),ahead=at(Math.min(1,s+.015)),direction=ahead.clone().sub(position).setY(0).normalize(),target=position.clone().addScaledVector(direction,45);target.y=Math.max(2,position.y*.48);
 const intro=1-smooth(Math.min(1,t/9));target.lerp(new THREE.Vector3(r.liberty.x,7,r.liberty.z),intro);
 if(u>.88)target.lerp(new THREE.Vector3(r.ax,3,r.pz0+90),smooth((u-.88)/.12)*.65);
 const before=at(Math.max(0,s-.008)),after=at(Math.min(1,s+.023)),v1=position.clone().sub(before).normalize(),v2=after.clone().sub(position).normalize(),roll=THREE.MathUtils.clamp((v1.x*v2.z-v1.z*v2.x)*.7,-.075,.075);
 const chapter=t<15?'LIBERTY ISLAND':t<31?'THE WORKING HARBOR':position.z<r.pz0?'FIFTH AVENUE':'CENTRAL PARK';
 return {position,target,roll,chapter,local:t,length:FLYPASS_DURATION};
}
