import {buildingIdentity,neighborhoodForm} from './identity.js';
import { LANDMARKS,landmarkForm } from './landmarks.js';
import { heightOf } from './production-render.js';
export const hash = s => { let h=2166136261; for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296; };
export function walletSignal(w,maxFlow){
 const flow=w.d30||0;
 const ageColors=[0xffb52e,0xffcd67,0x88b9ef,0x52c7f1,0x25daff,0x18e9ff];
 const age=ageColors[Math.min(5,Math.max(0,Math.floor(w.ageT*6)))];
 return {direction:flow>0?'adding':flow<0?'reducing':'steady',age,
  color:flow>0?0x25ef78:flow<0?0xff375b:age,
  strength:flow?Math.min(1,Math.log1p(Math.abs(flow))/Math.log1p(Math.max(1,maxFlow))):0};
}
export function buildModel(snapshot){
 return snapshot.wallets.map(w=>({...w,h:heightOf(w.score,snapshot.minScore,snapshot.maxScore,1,21),seed:hash(w.a),identity:buildingIdentity(w.a),family:LANDMARKS.find(l=>l.id===w.landmark)?.family||buildingIdentity(w.a).family}));
}
// Every part, including crowns and rooftop equipment, fits within the same measured envelope.
// Parcel positions are a staged design sample, not a proposed migration of production addresses.
export function newForm(w){
 if(w.landmark)return landmarkForm(w);
 return neighborhoodForm(w);
}

export const PRESETS={
 skyline:{position:[35,24,43],target:[0,6,-5],fov:40,label:'Skyline'},
 neighborhood:{position:[22,16,23],target:[0,2,-2],fov:43,label:'Neighborhood'},
 building:{position:[8,5,12],target:[3.1,2.3,3.025],fov:42,label:'Building'},
};
