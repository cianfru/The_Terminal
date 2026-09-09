import test from 'node:test';
import assert from 'node:assert/strict';
import {coastalStreetPlan} from '../src/district/coastal-streets.js';
const layout={land:{test:[[[0,0],[120,0],[120,120],[0,120]]]}};
test('roads approaching water leave a planted buffer and keep their inland section',()=>{
 const {streets,shoreGardens}=coastalStreetPlan(layout,[{a:{x:30,z:60},b:{x:140,z:60},width:6}]);
 assert.equal(streets.length,1);assert.ok(streets[0].b.x<=113.5);assert.ok(shoreGardens.length);assert.equal(shoreGardens[0].a.x,streets[0].b.x);
});
test('short shoreline loops are entirely reclaimed; inland roads remain',()=>{
 const coast={a:{x:6,z:20},b:{x:6,z:50},width:6},inland={a:{x:50,z:20},b:{x:50,z:100},width:6};
 const {streets,shoreGardens}=coastalStreetPlan(layout,[coast,inland]);
 assert.deepEqual(streets,[inland]);assert.deepEqual(shoreGardens,[coast]);
});
test('a dry but pointless avenue parallel to the coast becomes a garden',()=>{
 const road={a:{x:20,z:25},b:{x:20,z:80},width:6};
 const p=coastalStreetPlan(layout,[road]);assert.equal(p.streets.length,0);assert.ok(p.shoreGardens.length>0);
});
test('coastal dead ends stop at their final connected junction',()=>{
 const main={a:{x:40,z:60},b:{x:119,z:60},width:6},cross={a:{x:80,z:20},b:{x:80,z:100},width:6};
 const p=coastalStreetPlan(layout,[main,cross]),r=p.streets.find(r=>r.a.z===60&&r.b.z===60);
 assert.ok(r);assert.ok(r.b.x<85);assert.ok(p.shoreGardens.some(s=>s.a.x>=80&&s.b.x>100));
});
