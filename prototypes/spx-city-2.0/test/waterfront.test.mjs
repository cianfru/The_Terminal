import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {waterfrontPlan} from '../src/district/waterfront.js';
import {cohort} from '../src/district/model.js';
import {geographicLayout} from '../src/district/geography.js';
import {nearestOnSegment} from '../src/district/public-realm.js';
import {pointInRing} from '../src/fullcity/city-map.js';
test('waterfront planting avoids wallet parcels and carriageways; access paths stay on land',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('../src/fullcity/wallets.json',import.meta.url))),layout=geographicLayout(cohort(snapshot,true)),before=JSON.stringify(layout.homes),plan=waterfrontPlan(layout);
 assert.ok(plan.segments.some(s=>s.borough==='manhattan'));assert.ok(plan.segments.some(s=>s.borough==='bronx'));assert.ok(plan.connections.length>0);
 for(const p of plan.trees){assert.ok(!layout.homes.some(w=>Math.abs(p.x-w.x)<(w.width||w.identity.width)/2+1.7&&Math.abs(p.z-w.z)<(w.width||w.identity.depth)/2+1.7));for(const r of layout.streets){const q=nearestOnSegment(p,r.a,r.b);assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>=r.width/2+1.7-.001);}}
 for(const s of plan.connections)for(let j=0;j<=10;j++){const x=s.a.x+(s.b.x-s.a.x)*j/10,z=s.a.z+(s.b.z-s.a.z)*j/10;assert.ok(Object.keys(layout.land).some(b=>layout.land[b].some(r=>pointInRing(x,z,r))));}
 assert.equal(JSON.stringify(layout.homes),before);
});
