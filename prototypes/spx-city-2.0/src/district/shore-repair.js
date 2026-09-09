import polygonClipping from 'polygon-clipping';
import {pointInRing} from '../fullcity/city-map.js';
import {rectangle} from './land-surfaces.js';

// Include the plinth, facade trim and entrance apron, not just the wallet centre.
export function waterfrontEnvelope(home,padding=3){
 const width=Math.max(home.width||0,home.identity.width||0)*1.08;
 const depth=Math.max(home.depth||home.width||0,home.identity.depth||0)*1.08;
 return rectangle(home.x,home.z,width+padding*2,depth+padding*2);
}
export function repairCoastalParcels(land,blocks,homes){
 const result={...land};
 for(const [borough,rings] of Object.entries(land)){
  const supports=[];
  for(const block of blocks.filter(b=>b.borough===borough&&b.homes.length)){
   const residents=homes.filter(h=>h.block===block.id),envelopes=residents.flatMap(h=>waterfrontEnvelope(h));
   if(!envelopes.some(([x,z])=>!rings.some(r=>pointInRing(x,z,r))))continue;
   // Support the whole occupied frontage so the embankment does not zigzag per building.
   const points=[...rectangle(block.x,block.z,block.w+6,block.d+6),...envelopes];
   const x0=Math.min(...points.map(p=>p[0])),x1=Math.max(...points.map(p=>p[0])),z0=Math.min(...points.map(p=>p[1])),z1=Math.max(...points.map(p=>p[1]));
   supports.push([[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(p=>p.map(v=>Math.round(v*1000)/1000))]);
  }
  if(supports.length){const union=polygonClipping.union(rings.map(r=>[r]),...supports);result[borough]=union.map(p=>p[0].slice(0,-1));}
 }
 return result;
}
