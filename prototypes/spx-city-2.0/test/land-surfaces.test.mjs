import test from 'node:test';import assert from 'node:assert/strict';
import {clippedSurface,rectangle,safeRoadRuns,onLand} from '../src/district/land-surfaces.js';
const layout={land:{test:[[[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]]]}};
test('surface clipping respects concave land boundaries and keeps upward normals',()=>{const g=clippedSurface(layout,rectangle(5,5,14,14),.2),p=g.attributes.position;let area=0;for(let i=0;i<p.count;i+=3){const ax=p.getX(i),az=p.getZ(i),bx=p.getX(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cz=p.getZ(i+2);area+=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))/2;assert.ok(onLand(layout,(ax+bx+cx)/3,(az+bz+cz)/3));assert.ok(g.attributes.normal.getY(i)>.99);}assert.ok(Math.abs(area-64)<.001);g.dispose();});
test('traffic road runs exclude the water beyond a coastline',()=>{const l={land:{island:[[[0,0],[50,0],[50,20],[0,20]]]}},runs=safeRoadRuns(l,{a:{x:-20,z:10},b:{x:70,z:10},width:4});assert.equal(runs.length,1);assert.ok(runs[0].a.x>=0&&runs[0].b.x<=50);});
test('zero-area road remnants never paint the entire island',()=>{const g=clippedSurface(layout,[[2,2],[2,2],[2,2],[2,2]],.2);assert.equal(g.attributes.position.count,0);g.dispose();});
