import test from 'node:test';import assert from 'node:assert/strict';
import {neighborhoodIdentity} from '../src/district/neighborhood-character.js';
import {cameraApproach} from '../src/district/camera-approach.js';
test('neighborhood identity is deterministic, varied and preserves the dimensional envelope',()=>{
 const input={width:4,depth:5,silhouette:0,family:'glass',palette:0},forms=new Set(),characters=new Set();
 for(let i=0;i<100;i++){const args={address:String(i),borough:'jersey',hood:'jersey',x:30,z:30},a=neighborhoodIdentity(input,args);assert.deepEqual(a,neighborhoodIdentity(input,args));assert.equal(a.width,4);assert.equal(a.depth,5);assert.ok(a.silhouette>=31&&a.silhouette<=39);forms.add(a.silhouette);characters.add(a.character);}
 assert.ok(forms.size>=3);assert.equal(characters.size,1);assert.equal(input.family,'glass');
});
test('street approach chooses a road position rather than the building interior',()=>{
 const home={a:'a',x:0,z:0,h:15,identity:{width:4,depth:4}},layout={homes:[home],streets:[{a:{x:5,z:-40},b:{x:5,z:40},width:4}]},shot=cameraApproach(layout,home,true);assert.equal(shot.position.x,5);assert.equal(shot.position.y,5);assert.ok(shot.position.distanceTo(shot.target)>=10);assert.equal(shot.score<1000,true);
});
