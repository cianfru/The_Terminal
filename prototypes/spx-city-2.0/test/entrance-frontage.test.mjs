import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {entranceFrontage} from '../src/district/entrance-frontage.js';
import {silhouetteParts} from '../src/district/silhouettes.js';
const triangles=parts=>{const result=[];for(const {geometry}of parts){const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position;for(let i=0;i<p.count;i+=3)result.push(new THREE.Triangle(...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k))));if(g!==geometry)g.dispose();geometry.dispose();}return result;};
test('entrances select a supported wing instead of spanning an open gap',()=>{
 const gs=[-1.2,1.2].map(x=>{const geometry=new THREE.BoxGeometry(1,4,2);geometry.translate(x,2,0);return {geometry};}),ts=triangles(gs);
 for(const side of [-1,1]){const f=entranceFrontage(ts,side,0);assert.ok(f);assert.ok(Math.abs(f.x)>=1);assert.ok(Math.abs(f.z-side)<.001);}
});
test('a recessed front is followed and a narrow unsupported face is rejected',()=>{
 const geometry=new THREE.BoxGeometry(2,4,1);geometry.translate(0,2,-1);const f=entranceFrontage(triangles([{geometry}]),1,0);assert.equal(f.z,-.5);
 const narrow=new THREE.BoxGeometry(.4,4,1);narrow.translate(0,2,0);assert.equal(entranceFrontage(triangles([{geometry:narrow}]),1,0),null);
});
test('low-rise silhouette doors lie flush against the rendered mesh on both street sides',()=>{
 let found=0;for(let id=31;id<=39;id++){const ts=triangles(silhouetteParts(id,{width:4,depth:4,height:7,variant:1}));for(const side of [-1,1]){const f=entranceFrontage(ts,side,.72);if(!f)continue;found++;const ray=new THREE.Ray(new THREE.Vector3(f.x,.8,f.z+side*.03),new THREE.Vector3(0,0,-side));assert.ok(ts.some(t=>{const hit=ray.intersectTriangle(t.a,t.b,t.c,false,new THREE.Vector3());return hit&&Math.abs(hit.z-f.z)<.005;}));}}
 assert.ok(found>=12,`supported frontages: ${found}`);
});
