import * as THREE from 'three';
import test from 'node:test';import assert from 'node:assert/strict';
import {silhouetteParts} from '../src/district/silhouettes.js';import {detailedFacade} from '../src/district/facade-detail.js';
test('window geometry stays on near-vertical walls and leaves roof surfaces opaque',()=>{for(const id of [0,7,9,17,20,24,32,48]){const parts=detailedFacade(silhouetteParts(id,{height:12}),{height:12,seed:3});assert.ok(parts.some(p=>p.role==='roof'));const windows=parts.filter(p=>['window','litWindow'].includes(p.role));assert.ok(windows.length);for(const {geometry:g}of parts){assert.ok([...g.attributes.position.array].every(Number.isFinite));if(['window','litWindow'].includes(parts.find(p=>p.geometry===g).role)){const n=g.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(Math.abs(n.getY(i))<.081);g.computeBoundingBox();assert.ok(g.boundingBox.max.y<12);}g.dispose();}}});

test('novel-form windows follow actual supporting triangle planes rather than smoothed shading normals',()=>{for(const id of [1,6,7,8,9,10,13,48]){
 const source=silhouetteParts(id,{height:12}),triangles=[];
 for(const {geometry:g}of source){const flat=g.index?g.toNonIndexed():g,p=flat.attributes.position;for(let i=0;i<p.count;i+=3)triangles.push(new THREE.Triangle(...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k))));if(flat!==g)flat.dispose();}
 const detail=detailedFacade(source,{height:12,glass:true});let checked=0;
 for(const {geometry:g,role}of detail){if(['window','litWindow'].includes(role)){const p=g.attributes.position;for(let i=0;i<p.count;i+=3){const triangle=new THREE.Triangle(...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k))),center=triangle.getMidpoint(new THREE.Vector3()),normal=triangle.getNormal(new THREE.Vector3());let closest=Infinity;for(const support of triangles)if(support.getNormal(new THREE.Vector3()).dot(normal)>.999)closest=Math.min(closest,support.closestPointToPoint(center,new THREE.Vector3()).distanceTo(center));assert.ok(closest<.014,`family ${id}: panel floats ${closest}`);checked++;}}g.dispose();}assert.ok(checked>0);
}});
