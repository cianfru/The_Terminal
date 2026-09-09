import {waterfrontEnvelope} from '../src/district/shore-repair.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {cohort} from '../src/district/model.js';import {geographicLayout} from '../src/district/geography.js';import {onLand,rectangle} from '../src/district/land-surfaces.js';import {roadEndSites} from '../src/district/road-ends.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/fullcity/wallets.json',import.meta.url))),wallets=cohort(data,true),layout=geographicLayout(wallets);
test('every occupied Jersey building has dry supporting ground while Liberty remains offshore',()=>{for(const w of layout.homes.filter(w=>w.borough==='jersey'))for(const [x,z]of rectangle(w.x,w.z,w.width||w.identity.width,w.width||w.identity.depth))assert.ok(onLand(layout,x,z),w.a);assert.equal(onLand(layout,layout.harbor.x,layout.harbor.z),false);assert.equal(layout.homes.length,wallets.length);assert.deepEqual(layout.homes.map(w=>w.a).sort(),wallets.map(w=>w.a).sort());});
test('road forecourts remain on land and sites are unique',()=>{const sites=roadEndSites(layout);assert.ok(sites.length>0);assert.equal(new Set(sites.map(s=>s.end.x+','+s.end.z)).size,sites.length);for(const s of sites)for(const [x,z]of s.outline)assert.ok(onLand(layout,x,z));});
test('full shoreline surface assembly handles coincident promenade joins',async()=>{const THREE=await import('three'),{geographicGround}=await import('../src/district/geographic-world.js'),m=new THREE.MeshStandardMaterial();let geometries=0;geographicGround(layout,{put:g=>{geometries++;g.dispose();},box:()=>{},mat:()=>m,asphalt:m,grass:m,paving:m,time:'dusk'});assert.ok(geometries>0);m.dispose();});

test('all boroughs support the full waterfront facade and entrance envelope',()=>{
 for(const h of layout.homes){const ring=waterfrontEnvelope(h,2.95);for(let i=0;i<ring.length;i++)for(let j=0;j<=8;j++){const a=ring[i],b=ring[(i+1)%ring.length],t=j/8;assert.ok(onLand(layout,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),`${h.borough} ${h.a}: unsupported frontage`);}}
});
