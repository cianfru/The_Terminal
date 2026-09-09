export const IDENTITY_VERSION='spx-architecture-v1';
const seed=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const FAMILIES=[['Brownstone','masonry'],['Limestone townhouse','concrete'],['Cast-iron loft','concrete'],['Painted townhouse','masonry'],['Warehouse conversion','masonry'],['Art Deco residence','concrete'],['Modern infill','glass'],['Garden residence','masonry'],['Terracotta apartment','masonry'],['Corner shop house','masonry']];
const ROOFS=['Parapet','Mansard','Gabled','Terraced','Sawtooth'];
export const BUILDING_TYPES=FAMILIES.flatMap(([name,family],i)=>ROOFS.map((roof,j)=>({id:i*5+j,name:`${name} / ${roof.toLowerCase()}`,family,roof:j,facade:i})));
export function buildingIdentity(address){const a=address.toLowerCase(),pick=(k,n)=>seed(`${IDENTITY_VERSION}|${a}|${k}`)%n,type=BUILDING_TYPES[pick('type',50)];return {version:IDENTITY_VERSION,address:a,typeId:type.id,name:type.name,family:type.family,roof:type.roof,facade:type.facade,palette:pick('palette',10),windows:pick('windows',5),entrance:pick('entrance',4),balconies:pick('balconies',3),roofGarden:pick('garden',2)===1,awnings:pick('awnings',4),width:.99+pick('width',7)*.05,depth:1.45+pick('depth',6)*.055,signature:`${IDENTITY_VERSION}:${a}`};}
export function neighborhoodForm(w){const id=w.identity||buildingIdentity(w.a),h=w.h,parts=[],width=id.width,depth=id.depth;const add=(ww,dd,lo,hi,x=0,z=0)=>parts.push({w:ww,d:dd,h:h*(hi-lo),y:h*(lo+hi)/2,x,z});
 if(id.roof===3){add(width,depth,0,.58);add(width*.84,depth*.82,.58,.77,-width*.07,-depth*.08);add(width*.62,depth*.58,.77,.89,-width*.15,-depth*.16);}
 else if(id.facade===6){add(width,depth,0,.16);add(width*.88,depth*.91,.16,.84);add(width,depth*.94,.84,.88);}
 else if(id.facade===5){add(width,depth,0,.65);add(width*.82,depth*.84,.65,.86);}
 else{add(width,depth,0,.83);if(id.roof===0)add(width+.025,depth+.025,.83,.89);}
 return {parts,type:id.typeId,identity:id};
}
