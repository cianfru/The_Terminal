import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cityTowers,activityStrength,summarizeActivity} from '../src/fullcity/activity.js';
import {placeCity,cityScale} from '../src/fullcity/city-map.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../src/fullcity/wallets.json',import.meta.url)));
test('activity windows preserve production eligibility, scoring and placement',()=>{
 const a=cityTowers(snapshot,1).sort((a,b)=>b.score-a.score),b=cityTowers(snapshot,30).sort((a,b)=>b.score-a.score);
 assert.equal(a.length,snapshot.wallets.filter(w=>w.res!==false).length);
 assert.deepEqual(a.map(t=>[t.a,t.score,t.ageT]),b.map(t=>[t.a,t.score,t.ageT]));
 const K=cityScale(a.length),positions=x=>placeCity(x,K).map(t=>[t.a,t.x,t.z,t.hood]);
 assert.deepEqual(positions(a),positions(b));assert.ok(a.some((t,i)=>t.flow!==b[i].flow));
});
test('brightness is sign symmetric, zero safe and monotonic',()=>{assert.equal(activityStrength(0,0),0);assert.equal(activityStrength(100,100),1);assert.equal(activityStrength(-5,100),activityStrength(5,100));assert.ok(activityStrength(5,100)<activityStrength(50,100));});
test('opposing wallets retain separate adding and reducing totals',()=>{const [r]=summarizeActivity([{hood:'midtown',flow:50},{hood:'midtown',flow:-50},{hood:'midtown',flow:0}]);assert.deepEqual(r,{id:'midtown',count:3,active:2,adding:50,reducing:50});});
test('north-up display keeps parcel picking mapped to its wallet',async()=>{
 const THREE=await import('three');const {activityParcels}=await import('../src/fullcity/visual-layer.js');
 const scene=new THREE.Scene(),gs=[],ms=[];const wallets=[{a:'one',flow:10},{a:'two',flow:-20}];
 activityParcels(scene,wallets,[{x:2,z:3},{x:8,z:9}],20,gs,ms);scene.scale.z=-1;scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(8,10,-9),new THREE.Vector3(0,-1,0));const [hit]=ray.intersectObjects(scene.children);
 assert.equal(wallets[hit.instanceId].a,'two');gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());
});
