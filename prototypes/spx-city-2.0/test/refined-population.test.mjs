import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {facadeSurface,refinedPopulation} from '../src/district/refined-population.js';
import {silhouetteParts} from '../src/district/silhouettes.js';

test('all silhouette facade coordinates are bounded to wall planes; roofs stay opaque',()=>{
 for(let silhouette=0;silhouette<50;silhouette++){
  const parts=facadeSurface(silhouetteParts(silhouette,{width:4,depth:4.5,height:15,variant:1}));
  for(const {geometry:g,role} of parts){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.facadeCoord,range=g.attributes.facadeRange;
   for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));if(role==='wall'){assert.ok(Math.abs(n.getY(i))<=.081);assert.ok(uv.getX(i)>=range.getX(i)-.001&&uv.getX(i)<=range.getY(i)+.001);assert.ok(uv.getY(i)>=range.getZ(i)-.001&&uv.getY(i)<=range.getW(i)+.001);}}
   g.dispose();
  }
 }
});
test('persistent facade instances preserve wallet positions and do not rebuild on camera movement',()=>{
 const identity={family:'glass',silhouette:0,palette:1,width:4,depth:5};
 const homes=Array.from({length:20},(_,i)=>({a:String(i),x:i*8,z:i*3,h:8+i,flow:i-10,ageT:.5,identity}));
 homes[12].borough='brooklyn';homes[13].borough='manhattan';
 const scene=new THREE.Scene(),owned=[],materials=[],population=refinedPopulation(scene,{homes,flowMax:10,geographic:true,blocks:[]},'dusk',owned,materials),ids=scene.children.map(m=>m.uuid);
 assert.ok(scene.children.length>0);for(const m of scene.children){assert.equal(m.count,8);assert.ok(Object.keys(m.geometry.attributes).length+4<=16,'facades fit the 16-attribute WebGL limit, including the instance matrix');assert.equal(m.geometry.attributes.proofHome.getX(0),2);assert.equal(m.geometry.attributes.proofHome.getX(1),1);for(let i=0;i<8;i++){const matrix=new THREE.Matrix4();m.getMatrixAt(i,matrix);assert.equal(matrix.elements[12],homes[i+12].x);assert.equal(matrix.elements[14],homes[i+12].z);}}
 population.update(new THREE.Vector3(0,0,0),100);population.update(new THREE.Vector3(500,500,500),200);assert.deepEqual(scene.children.map(m=>m.uuid),ids);owned.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());
});
