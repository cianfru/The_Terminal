import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {cohort} from '../src/district/model.js';
import {geographicLayout} from '../src/district/geography.js';
import {qualityBlock,blockQuality} from '../src/district/block-quality.js';
test('quality proof selects a populated Manhattan block and leaves wallet geometry rules untouched',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('../src/fullcity/wallets.json',import.meta.url))),layout=geographicLayout(cohort(snapshot,true)),before=JSON.stringify(layout.homes),block=qualityBlock(layout);
 assert.ok(block);assert.equal(block.hood,'midtown');assert.equal(block.homes.length,10);
 const owned=[],materials=[],scene=new THREE.Scene(),proof=blockQuality(scene,layout,'day',owned,materials);
 assert.ok(proof.group.children.length>0&&proof.group.children.length<=24);assert.equal(proof.group.visible,false);
 for(const mesh of proof.group.children){assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));assert.ok(new THREE.Box3().setFromObject(mesh).min.y>=0);}
 proof.group.visible=true;assert.equal(JSON.stringify(layout.homes),before);
 owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});

test('citywide details cover every ordinary wallet with bounded shared geometry',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('../src/fullcity/wallets.json',import.meta.url))),layout=geographicLayout(cohort(snapshot,true)),before=JSON.stringify(layout.homes),owned=[],materials=[],scene=new THREE.Scene(),proof=blockQuality(scene,layout,'day',owned,materials,{rollout:true});
 assert.equal(proof.buildingCount,layout.homes.length-12);assert.ok(proof.group.children.filter(m=>m.isInstancedMesh).length<=12);
 const boxes=proof.group.children.filter(m=>m.isInstancedMesh);assert.ok(boxes.length>0);assert.equal(new Set(boxes.map(m=>m.geometry.uuid)).size,1);
 for(const m of boxes)assert.ok([...m.instanceMatrix.array].every(Number.isFinite));assert.equal(JSON.stringify(layout.homes),before);
 const total=boxes.reduce((n,m)=>n+m.count,0);proof.update(new THREE.Vector3(proof.block.x,35,proof.block.z),1000,110);const local=boxes.reduce((n,m)=>n+m.count,0);assert.ok(local>0&&local<total*.5);proof.update(new THREE.Vector3(10000,10000,10000),2000,110);assert.equal(boxes.reduce((n,m)=>n+m.count,0),0);console.log('City detail instances:',total,'local:',local);
 owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
});
