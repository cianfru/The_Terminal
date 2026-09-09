import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildModel,newForm,walletSignal} from '../src/model.js';
import {heightOf} from '../src/production-render.js';
const sample=JSON.parse(readFileSync(new URL('../src/sample.json',import.meta.url)));
const model=buildModel(sample);
test('the fixed sample has 96 distinct real-address residents and covers every height tier',()=>{
 assert.equal(model.length,96);assert.equal(new Set(model.map(w=>w.a)).size,96);
 // Production uses the snapshot's res flag, not a new client-side balance threshold.
 assert.ok(model.every(w=>/^0x[0-9a-f]{40}$/i.test(w.a)&&w.bal>0&&w.days>=90));
 assert.deepEqual([model.filter(w=>w.h>=11).length,model.filter(w=>w.h>=6&&w.h<11).length,model.filter(w=>w.h>=3.5&&w.h<6).length,model.filter(w=>w.h<3.5).length],[12,16,32,36]);
});
test('heights use the production population bounds, never sample normalization',()=>{
 for(const w of model){assert.equal(w.h,heightOf(w.score,sample.minScore,sample.maxScore,1,21));assert.ok(Math.abs(w.h-sample.wallets.find(x=>x.a===w.a).h)<1e-8);}
 for(let i=1;i<model.length;i++)assert.ok(model[i-1].h>=model[i].h);
});
test('architectural form stays inside the data height envelope',()=>{
 for(const w of model){const form=newForm(w);for(const p of form.parts){assert.ok(p.w>0&&p.d>0&&p.h>0);assert.ok(p.y-p.h/2>=-1e-8);assert.ok(p.y+p.h/2<=w.h+1e-8);}}
});
test('proposed building footprints do not intersect neighboring wallets',()=>{
 const boxes=model.map(w=>{const p=newForm(w).parts;return {...w,width:Math.max(...p.map(p=>p.w)),depth:Math.max(...p.map(p=>p.d))};});
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.z-b.z)>=(a.depth+b.depth)/2,`Overlapping lots: ${a.a}, ${b.a}`);}
});
test('architectural identity is deterministic and does not mutate wallet data',()=>{
 const copy=structuredClone(model);for(const w of model)assert.deepEqual(newForm(w),newForm({...w}));assert.deepEqual(model,copy);
});
test('small flows never disappear into a neutral magnitude bin',()=>{
 for(const flow of [.0001,.1,1,100000]){
  assert.equal(walletSignal({d30:flow,ageT:.4},1e7).direction,'adding');
  assert.equal(walletSignal({d30:-flow,ageT:.4},1e7).direction,'reducing');
 }
 assert.equal(walletSignal({d30:0,ageT:.4},1e7).direction,'steady');
});
test('age remains independently visible for buying and selling wallets',()=>{
 const a=walletSignal({d30:100,ageT:.1},1000),b=walletSignal({d30:100,ageT:.9},1000);
 assert.equal(a.color,b.color);assert.notEqual(a.age,b.age);
 assert.equal(walletSignal({d30:-100,ageT:.1},1000).age,a.age);
});

test('12 unique landmarks belong to the 12 largest balances in the sample',()=>{const ranked=[...model].sort((a,b)=>b.bal-a.bal||a.a.localeCompare(b.a));assert.equal(new Set(ranked.slice(0,12).map(w=>w.landmark)).size,12);ranked.slice(0,12).forEach((w,i)=>assert.equal(w.balanceRank,i+1));assert.ok(ranked.slice(12).every(w=>!w.landmark));});

import {BUILDING_TYPES,buildingIdentity} from '../src/identity.js';
import {BRIDGE_DIMENSIONS,bridgeRoadHeight} from '../src/bridge.js';
test('50 named architectural types have stable, address-only traits',()=>{
 assert.equal(BUILDING_TYPES.length,50);assert.equal(new Set(BUILDING_TYPES.map(t=>t.name)).size,50);
 for(const w of model){assert.deepEqual(buildingIdentity(w.a),buildingIdentity(w.a.toUpperCase()));assert.deepEqual(w.identity,buildingIdentity(w.a));}
 const changed=buildModel({...sample,wallets:sample.wallets.map(w=>({...w,bal:w.bal*2,d30:999,days:1}))});
 changed.forEach((w,i)=>assert.deepEqual(w.identity,model[i].identity));
 assert.ok(new Set(model.filter(w=>!w.landmark).map(w=>w.identity.typeId)).size>=40);
});
test('bridge uses a measured main span with continuous approaches to ground level',()=>{
 assert.ok(Math.abs(BRIDGE_DIMENSIONS.mainSpan-4.863084)<.001);
 assert.ok(Math.abs(BRIDGE_DIMENSIONS.length-18.336768)<.001);
 assert.equal(bridgeRoadHeight(0),BRIDGE_DIMENSIONS.clearance);
 for(const sign of [-1,1])assert.ok(Math.abs(bridgeRoadHeight(sign*BRIDGE_DIMENSIONS.length/2)-.025)<1e-9);
 assert.ok(Math.abs(bridgeRoadHeight(5.26-1e-6)-bridgeRoadHeight(5.26+1e-6))<1e-6);
});
