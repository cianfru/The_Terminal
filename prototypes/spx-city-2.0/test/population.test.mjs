import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cohort,districtLayout} from '../src/district/model.js';
import {cityTowers} from '../src/fullcity/activity.js';
import {detailCandidates} from '../src/district/population-lod.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../src/fullcity/wallets.json',import.meta.url))),all=cohort(snapshot,true);
test('full population preserves every eligible wallet and the approved cohort dimensions',()=>{
 assert.equal(all.length,cityTowers(snapshot).length);assert.equal(new Set(all.map(w=>w.a)).size,all.length);
 const byAddress=new Map(all.map(w=>[w.a,w]));for(const w of cohort(snapshot)){const full=byAddress.get(w.a);assert.equal(full.h,w.h);assert.deepEqual(full.identity,w.identity);assert.equal(full.score,w.score);assert.equal(full.flow,w.flow);}
});
test('both full population layouts place each wallet inside a unique parcel and retain landmark scale',()=>{
 for(const key of ['compact','garden']){const l=districtLayout(all,key),cells=new Set([...l.blocks,...l.landmarkBlocks,...l.gardens].map(b=>b.cell));assert.equal(cells.size,l.rows*l.cols);assert.equal(l.homes.length,all.length);assert.equal(new Set(l.homes.map(w=>`${w.x}|${w.z}`)).size,all.length);for(const w of l.homes){assert.ok(Number.isFinite(w.x)&&Number.isFinite(w.z));assert.ok(Math.abs(w.x)<l.width/2&&w.z>l.minZ&&w.z<l.maxZ);}assert.equal(l.homes[0].width,all[0].width);}
});
test('detail budget stays bounded and follows the camera without loading distant wallets',()=>{
 const l=districtLayout(all,'compact'),w=l.homes[200],camera={x:w.x,y:10,z:w.z};const near=detailCandidates(l.homes,camera,24);assert.ok(near.length>0&&near.length<=24);assert.ok(near.some(x=>x.a===w.a));assert.equal(detailCandidates(l.homes,{x:0,y:1000,z:0},24).length,0);assert.ok(detailCandidates(l.homes,camera,12).length<=12);
});
