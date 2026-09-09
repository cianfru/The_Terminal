import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {vehicleGeometry,trafficFleet} from '../src/district/vehicles.js';
test('vehicle models fit a street lane and include glazing, wheels and light materials',()=>{for(const type of ['taxi','sedan','suv','van']){const parts=vehicleGeometry(type),b=new THREE.Box3();for(const {geometry:g}of parts){g.computeBoundingBox();b.union(g.boundingBox);assert.ok([...g.attributes.position.array].every(Number.isFinite));g.dispose();}assert.ok(b.max.x-b.min.x<.5);assert.ok(b.max.z-b.min.z<1.1);assert.ok(b.min.y>=0);for(const role of ['paint','glass','trim','chrome','headlight','tail'])assert.ok(parts.some(p=>p.role===role));}});
test('72 vehicles use shared instances and move continuously through rounded corners',()=>{const scene=new THREE.Scene(),owned=[],materials=[],animate=trafficFleet(scene,{blocks:[{x:0,z:0}],landmarkBlocks:[],cellW:15.7,cellD:16.9},owned,materials,'dusk');assert.ok(scene.children.length<=29);const pools=scene.children.filter(m=>m.material.isShaderMaterial);assert.equal(pools.length,1);assert.equal(pools[0].count,144);const paint=scene.children.filter(m=>m.castShadow);assert.equal(paint.reduce((n,m)=>n+m.count,0),72);for(let t=0;t<80;t+=.5){animate(t);const previous=paint.map(m=>Array.from(m.instanceMatrix.array));animate(t+.01);assert.ok([...pools[0].instanceMatrix.array].every(Number.isFinite));paint.forEach((m,k)=>{assert.ok([...m.instanceMatrix.array].every(Number.isFinite));for(let i=0;i<m.count;i++){const a=previous[k],b=m.instanceMatrix.array,j=i*16;assert.ok(Math.hypot(a[j+12]-b[j+12],a[j+14]-b[j+14])<.03);}});}owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());});
test('geographic fleet gives avenues most of the cars despite many more cross streets',()=>{
 const scene=new THREE.Scene(),owned=[],materials=[];
 const streets=Array.from({length:20},(_,i)=>({a:{x:-90,z:-80+i*8},b:{x:90,z:-80+i*8},width:6}));streets.push({a:{x:0,z:-90},b:{x:0,z:90},width:6});
 const animate=trafficFleet(scene,{originalGrid:true,full:true,streets,land:{test:[[[-100,-100],[100,-100],[100,100],[-100,100]]]}},owned,materials,'day');animate(0);
 const paint=scene.children.filter(m=>m.castShadow);let avenue=0,total=0;
 for(const m of paint)for(let i=0;i<m.count;i++){const a=m.instanceMatrix.array,j=i*16;total++;if(Math.abs(a[j+8])<.001)avenue++;}
 assert.equal(total,288);assert.ok(avenue>=210&&avenue<=230,`avenue cars: ${avenue}`);
 owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});
