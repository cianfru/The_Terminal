import test from 'node:test';import assert from 'node:assert/strict';import {buildPark} from '../src/park.js';import {NYC} from '../src/nyc-geo.js';import {pointInRing} from '../src/source-map.js';import {segmentDistance} from '../src/planting.js';
test('geographic park footpath ribbons remain inside the park and clear its perimeter drive',()=>{
 const mats=Object.fromEntries(['path','lake','lawn','trunk','stone','copper','iron'].map(k=>[k,{}]));mats.leaves=[{},{},{}];let count=0;
 buildPark({mats,rod:()=>{},treeVertical:6,edgeClearance:1,put:(g,m)=>{if(m===mats.path&&g.attributes.position.count===322){count++;const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);assert.ok(pointInRing(x,z,NYC.centralpark[0]));assert.ok(NYC.centralpark[0].every((a,j)=>segmentDistance(x,z,...a,...NYC.centralpark[0][(j+1)%NYC.centralpark[0].length])>.60));}}g.dispose();}});assert.equal(count,4);
});
