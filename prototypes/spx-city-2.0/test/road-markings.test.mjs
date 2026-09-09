import test from 'node:test';import assert from 'node:assert/strict';
import {roadMarkings} from '../src/district/road-markings.js';
test('interior junction has four curb-aligned crossings and no conflicting lane dashes',()=>{const l={cols:3,rows:3,cellW:15.7,cellD:16.9,road:2.8,sidewalk:.85}, {crossings,markings}=roadMarkings(l),x=-l.cols*l.cellW/2+l.cellW,z=l.cellD,near=crossings.filter(c=>Math.abs(c.x-x)<3&&Math.abs(c.z-z)<3);assert.equal(near.length,4);for(const c of crossings){const varying=c.axis==='x'?'x':'z',width=c.axis==='x'?'w':'d',first=c.stripes[0],last=c.stripes.at(-1);assert.ok(last[varying]+last[width]/2-first[varying]+first[width]/2>l.road*.9);for(const stripe of c.stripes)for(const lane of markings.filter(m=>m.type==='lane'))assert.ok(Math.abs(stripe.x-lane.x)>=(stripe.w+lane.w)/2||Math.abs(stripe.z-lane.z)>=(stripe.d+lane.d)/2);}
 for(const m of markings)assert.ok(Math.abs(m.x-x)-m.w/2>=l.road/2||Math.abs(m.z-z)-m.d/2>=l.road/2);
});
