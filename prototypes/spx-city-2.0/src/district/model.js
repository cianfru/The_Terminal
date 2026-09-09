import {cityTowers} from '../fullcity/activity.js';
import {LANDMARKS} from '../landmarks.js';
import {manhattanIdentity} from './manhattan.js';
import {buildingIdentity} from '../identity.js';
// A fixed cohort and two design layouts. This does not modify production placement or scoring.
export const DESIGNS={compact:{name:'8 towers / block',cols:6,perBlock:8,companions:4,lotCols:4,lotRows:2,lotX:2.8,lotZ:6.2,sidewalk:.85,road:2.8},garden:{name:'16 towers / block',cols:6,perBlock:16,companions:8,lotCols:4,lotRows:4,lotX:2.8,lotZ:3.1,sidewalk:.85,road:2.8}};
export const LANDMARK_SIZE=[[22.159,6.3],[15.945,4.5],[27.066,4.5],[13,4.1],[11,5.1],[6.4,4.4],[11.2,3.8],[15,4.2],[15.5,4.0],[21,3.5],[20,4.5],[13,4.8]];
export function cohort(snapshot,full=false){const all=cityTowers(snapshot,30).sort((a,b)=>b.score-a.score);const chosen=[...all.slice(0,12)];for(let i=0;i<372;i++)chosen.push(all[12+Math.floor(i*(all.length-13)/371)]);const slimAddresses=new Set(chosen.slice(12,108).map(w=>w.a));if(full)chosen.splice(0,chosen.length,...all);const lo=Math.log(all.at(-1).score),hi=Math.log(all[12].score);return chosen.map((w,i)=>({...w,identity:i<12?buildingIdentity(w.a):manhattanIdentity(buildingIdentity(w.a),slimAddresses.has(w.a)),landmark:i<12?LANDMARKS[i].id:null,h:i<12?LANDMARK_SIZE[i][0]:7+12*Math.pow(Math.max(0,(Math.log(w.score)-lo)/(hi-lo)),.75),width:i<12?LANDMARK_SIZE[i][1]:null}));}
// Landmark sites are woven into the same street grid as the homes. Two adjacent
// sites form a skyline cluster; the others act as neighborhood focal points.
export function districtLayout(wallets,key){
 const full=wallets.length>500,d={...DESIGNS[key],...(full?{cols:Math.ceil(Math.sqrt(wallets.length/DESIGNS[key].perBlock))}:{})},blockW=d.lotCols*d.lotX+d.sidewalk*2,blockD=d.lotRows*d.lotZ+d.sidewalk*2,cellW=blockW+d.road,cellD=blockD+d.road;
 const housingStart=12+12*d.companions,n=Math.ceil((wallets.length-housingStart)/d.perBlock),rows=Math.ceil((n+12)/d.cols);
 const landmarkCells=full?Array.from({length:12},(_,i)=>Math.floor((i+.5)*rows/12)*d.cols+Math.min(d.cols-1,Math.floor(d.cols*(.25+(i%3)*.25)))):key==='compact'?[8,9,28,1,22,42,5,25,45,12,3,53]:[8,9,22,1,16,24,5,19,27,12,3,29];
 const cell=i=>({cell:i,x:(i%d.cols-(d.cols-1)/2)*cellW,z:Math.floor(i/d.cols)*cellD+cellD/2,w:blockW,d:blockD});
 const available=Array.from({length:rows*d.cols},(_,i)=>i).filter(i=>!landmarkCells.includes(i));
 const blocks=available.slice(0,n).map((i,id)=>({...cell(i),id}));
 const landmarkBlocks=landmarkCells.map((i,id)=>({...cell(i),id:'landmark-'+id}));
 const gardens=available.slice(n).map(cell);
 const homes=wallets.map((w,i)=>{if(i<12){const b=landmarkBlocks[i];return {...w,x:b.x,z:b.z,block:b.id};}if(i<housingStart){const j=i-12,b=landmarkBlocks[Math.floor(j/d.companions)],slot=j%d.companions,sideCount=d.companions/2;return {...w,x:b.x+(slot<sideCount?-1:1)*4.5,z:b.z+((slot%sideCount)-(sideCount-1)/2)*(d.companions===4?5.6:2.8),block:b.id};}const j=i-housingStart,b=blocks[Math.floor(j/d.perBlock)],slot=j%d.perBlock,col=slot%d.lotCols,row=Math.floor(slot/d.lotCols);return {...w,x:b.x+(col-(d.lotCols-1)/2)*d.lotX,z:b.z+(row-(d.lotRows-1)/2)*d.lotZ,block:b.id};});
 const width=d.cols*cellW+8,minZ=-5,maxZ=rows*cellD+8,depth=maxZ-minZ;
 return {key,full,...d,housingStart,blockW,blockD,cellW,cellD,blocks,landmarkBlocks,gardens,rows,homes,width,depth,minZ,maxZ,area:width*depth,treeSites:blocks.flatMap(b=>[-1,1].flatMap(a=>[-1,1].map(c=>({x:b.x+a*(b.w/2-.43),z:b.z+c*(b.d/2-1.53),block:b.id}))))};}
