import {MANHATTAN_FAMILIES,SILHOUETTES} from './silhouettes.js';
// Address-seeded high-rise vocabulary for the Manhattan design study.
// These are visual traits; no wallet rank or eligibility rules are changed.
export function manhattanIdentity(identity,slim=false){
 let seed=2166136261;for(const c of `silhouette-v1|${identity.address}`){seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;}
 const rare=new Set([7,8,48]),ordinary=MANHATTAN_FAMILIES.filter(id=>!rare.has(id));
 const silhouette=seed%25===0?[7,8,48][Math.floor(seed/25)%3]:ordinary[Math.floor(seed/25)%ordinary.length],family=[5,6,7,8,9,10,13,14,17,19,40,41,42,43,48].includes(silhouette)?'glass':'concrete';
 return {...identity,name:SILHOUETTES[silhouette].name,silhouette,family,roof:0,awnings:0,balconies:0,width:slim?1.65:2.05+(identity.palette%4)*.1,depth:slim?2.3:2.5,slim};
}
export function manhattanForm(w){
 const {width:a,depth:b,typeId}=w.identity,h=w.h,parts=[];
 const add=(width,depth,lo,hi,x=0,z=0)=>parts.push({w:width,d:depth,h:h*(hi-lo),y:h*(lo+hi)/2,x,z});
 add(a,b,0,.14);
 switch(typeId%5){
 case 0:add(a*.87,b*.9,.14,.96);add(a*.65,b*.7,.96,1);break;
 case 1:add(a,b,.14,.56);add(a*.82,b*.83,.56,.82);add(a*.61,b*.64,.82,1);break;
 case 2:add(a*.95,b*.94,.14,.94);add(a,b,.94,.97);add(a*.7,b*.72,.97,1);break;
 case 3:add(a,b,.14,.68);add(a*.82,b*.8,.68,.87);add(a*.58,b*.6,.87,1);break;
 default:add(a*.94,b*.94,.14,.48);add(a*.8,b*.8,.48,.73,-a*.07);add(a*.64,b*.65,.73,1,-a*.15);break;
 }
 return {parts};
}
