import {SILHOUETTES} from './silhouettes.js';
const hash=s=>[...s].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
const profiles={
 masonry:{name:'Masonry skyline',forms:[2,0,23,44,16,22],palettes:[1,2,0],family:'concrete'},
 office:{name:'Glass office district',forms:[40,41,44,0,6,29],palettes:[0,2,3],family:'glass'},
 residential:{name:'Residential towers',forms:[46,45,16,22,47,0],palettes:[2,1,0],family:'concrete'},
 brick:{name:'Brick and stoops',forms:[33,34,33,37,32],palettes:[0,3,0],family:'masonry'},
 loft:{name:'Warehouse and cast iron',forms:[35,36,35,37,33],palettes:[3,0,1],family:'masonry'},
 courtyard:{name:'Courtyard neighborhood',forms:[31,32,33,32,37],palettes:[1,2,0],family:'masonry'},
 infill:{name:'Contemporary infill',forms:[33,38,39,35],palettes:[2,1,3],family:'masonry'}
};
export function neighborhoodIdentity(identity,{address,borough,hood,x,z}){
 const zone=hash(`${borough}|${Math.floor(x/85)}|${Math.floor(z/85)}`),seed=hash(address),outer=borough!=='manhattan';
 const pool=outer?(borough==='jersey'?['brick','loft','courtyard','brick','infill']:borough==='brooklyn'?['brick','brick','loft','courtyard']:['courtyard','brick','courtyard','infill']):hood==='tribeca'?['loft']:hood==='village'?['brick']:hood==='midtown'?['office','office','masonry','residential']:['masonry','residential','residential','office'];
 const profile=profiles[pool[zone%pool.length]],silhouette=!outer&&!['tribeca','village'].includes(hood)&&seed%10===0?identity.silhouette:profile.forms[seed%profile.forms.length];
 return {...identity,silhouette,name:SILHOUETTES[silhouette].name,family:profile.family,palette:profile.palettes[seed%5===0?2:seed%2],character:profile.name};
}
