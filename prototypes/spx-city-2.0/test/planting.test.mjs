import test from 'node:test';import assert from 'node:assert/strict';
import {segmentDistance,clearOfPath} from '../src/planting.js';
test('tree clearance checks the entire path, including gaps between samples',()=>{const path=[{x:0,z:0},{x:10,z:0}];assert.equal(clearOfPath([5,.1],path,.28),false);assert.equal(clearOfPath([5,.4],path,.28),true);assert.equal(segmentDistance(3,4,0,0,0,0),5);});
test('generated Central Park planting clears transverse roads and park edges',async()=>{
 const {buildPark}=await import('../src/park.js');const {parkFeatures,pointInRing}=await import('../src/source-map.js');const {NYC}=await import('../src/nyc-geo.js');
 const mats=Object.fromEntries(['stone','copper','steel','asphalt','paint','mortar','path','lake','lawn','trunk','iron'].map(k=>[k,k]));mats.leaves=['leaf1','leaf2','leaf3'];
 const {treeSites,treeCount}=buildPark({put:g=>g.dispose(),mats,rod:()=>{}});assert.ok(treeCount>700);
 for(const p of treeSites){for(const ring of parkFeatures().roads){assert.equal(pointInRing(...p,ring),false);for(let i=0;i<ring.length;i++)assert.ok(segmentDistance(...p,...ring[i],...ring[(i+1)%ring.length])>=.24);}assert.ok(pointInRing(...p,NYC.centralpark[0]));}
});
