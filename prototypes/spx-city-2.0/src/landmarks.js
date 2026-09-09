import * as THREE from 'three';
// Stable snapshot assignment by balance rank, never a claim about the wallet owner's identity.
export const LANDMARKS=[
 ['empire','Empire State Building','concrete','Limestone setbacks · Art Deco mast'],
 ['chrysler','Chrysler Building','concrete','Silver sunburst crown · needle spire'],
 ['onewtc','One World Trade Center','glass','Faceted glass taper · illuminated mast'],
 ['woolworth','Woolworth Building','concrete','Gothic crown · copper pyramid'],
 ['rockefeller','30 Rockefeller Plaza','concrete','Layered limestone slab · stepped shoulders'],
 ['flatiron','Flatiron Building','concrete','Triangular prow · deep projecting cornice'],
 ['metlife','MetLife Tower','concrete','Clock faces · campanile crown'],
 ['40wall','40 Wall Street','concrete','Setback shoulders · emerald pyramid'],
 ['70pine','70 Pine Street','concrete','Slender Art Deco lantern · terraced crown'],
 ['432park','432 Park Avenue','glass','Square window grid · paired open mechanical bands'],
 ['hudson','30 Hudson Yards','glass','Angular glass crown · projecting observation deck'],
 ['leonard','56 Leonard Street','glass','Offset stacked volumes · cantilevered terraces'],
].map(([id,name,family,detail],i)=>({id,name,family,detail,balanceRank:i+1}));
export function landmarkForm(w){
 const parts=[],h=w.h,id=w.landmark;
 const add=(width,depth,lo,hi,x=0,z=0)=>parts.push({w:width,d:depth,h:(hi-lo)*h,y:(lo+hi)*h/2,x,z});
 if(id==='empire'){add(2.65,2.25,0,.12);add(2.35,1.95,.12,.24);add(1.85,1.6,.24,.63);add(1.46,1.3,.63,.74);add(1.05,1,.74,.83);add(.65,.65,.83,.89);}
 if(id==='chrysler'){add(2.45,2.1,0,.13);add(2.05,1.8,.13,.44);add(1.67,1.55,.44,.71);add(1.33,1.25,.71,.78);}
 if(id==='onewtc'){add(2.5,2.5,0,.13);add(2.24,2.24,.13,.84);}
 if(id==='woolworth'){add(2.6,2.05,0,.39);add(1.65,1.55,.39,.7);add(1.3,1.25,.7,.83);}
 if(id==='rockefeller'){add(2.7,2.1,0,.13);add(2.45,1.45,.13,.56);add(2.1,1.25,.56,.76);add(1.75,1.05,.76,.92);add(1.35,.88,.92,1);}
 if(id==='flatiron'){add(2.55,2.55,0,.91);add(2.7,2.7,.91,.98);}
 if(id==='metlife'){add(2.5,2.1,0,.23);add(1.55,1.55,.23,.69);add(1.75,1.75,.69,.8);add(1.25,1.25,.8,.87);}
 if(id==='40wall'){add(2.55,2.15,0,.19);add(2.1,1.8,.19,.4);add(1.7,1.45,.4,.66);add(1.25,1.12,.66,.82);}
 if(id==='70pine'){add(2.5,2.1,0,.19);add(2,1.7,.19,.45);add(1.6,1.4,.45,.66);add(1.15,1.05,.66,.79);add(.8,.75,.79,.9);}
 if(id==='432park'){add(1.65,1.65,0,.97);add(1.65,1.65,.97,1);}
 if(id==='hudson'){add(2.35,2,0,.15);add(2,1.7,.15,.79);}
 if(id==='leonard'){for(let i=0;i<11;i++)add(1.8+(i%3)*.2,1.65,i/11,(i+1)/11,(i%2?1:-1)*.3,(i%3-1)*.15);}
 return {parts,type:0};
}
export function landmarkWall(q,w){
 if(w.landmark==='flatiron'){
  const shape=new THREE.Shape();shape.moveTo(-q.w/2,-q.d/2);shape.lineTo(q.w/2,-q.d/2);shape.lineTo(0,q.d/2);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:q.h,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,-q.h/2,0);return g;
 }
 if(w.landmark==='onewtc'&&q.y>w.h*.2){const g=new THREE.CylinderGeometry(q.w*.49,q.w*.707,q.h,4,1);g.rotateY(Math.PI/4);return g;}
 return null;
}
export function landmarkDetails(w,{put,box,cyl,rail,wall,trim,metal,bronze,accent,ground}){
 const x=w.x,z=w.z,h=w.h,y=t=>ground+t*h;
 const pyramid=(lo,hi,r,m)=>{const g=new THREE.ConeGeometry(r,(hi-lo)*h,4);g.rotateY(Math.PI/4);g.translate(x,y((lo+hi)/2),z);put(g,m);};
 const mast=(lo,hi,r=.035)=>cyl(x,y((lo+hi)/2),z,r,r*1.7,(hi-lo)*h,metal,12);
 if(w.landmark==='empire'){cyl(x,y(.915),z,.2,.26,.05*h,trim,12);mast(.94,1);for(const dx of [-.55,.55])box(x+dx,y(.45),z+.81,.045,.35*h,.04,trim);}
 if(w.landmark==='chrysler'){
  for(let i=0;i<6;i++){const lo=.78+i*.025;const radius=.76-i*.09;const g=new THREE.CylinderGeometry(radius*.75,radius,h*.032,24,1,false,0,Math.PI*2);g.scale(1,1,.8);g.translate(x,y(lo+.016),z);put(g,metal);
   for(let j=0;j<5;j++){const a=Math.PI*(j/4);const gg=new THREE.ConeGeometry(.047,h*.012,3);gg.rotateZ(Math.PI);gg.translate(x+Math.cos(a)*radius*.72,y(lo+.009),z+Math.sin(a)*radius*.81);put(gg,accent);}}
  mast(.93,1,.023);for(const dx of [-.9,.9])box(x+dx,y(.72),z+.63,.45,.05,.2,metal);
 }
 if(w.landmark==='onewtc'){box(x,y(.858),z,1.54,.036*h,1.54,metal);mast(.88,1);}
 if(w.landmark==='woolworth'){pyramid(.83,.99,.92,bronze);for(const dx of [-.65,.65])for(const dz of [-.6,.6])cyl(x+dx,y(.85),z+dz,0,.11,.12*h,trim,4);}
 if(w.landmark==='40wall')pyramid(.82,1,.95,bronze);
 if(w.landmark==='metlife'){
  pyramid(.87,.98,.9,bronze);mast(.98,1);
  for(const side of [-1,1]){const g=new THREE.CircleGeometry(.46,32);g.rotateY(side<0?Math.PI:0);g.translate(x,y(.74),z+side*.882);put(g,trim);
   rail(new THREE.Vector3(x,y(.74),z+side*.892),new THREE.Vector3(x+.22,y(.74)+.12,z+side*.892),.022,metal);rail(new THREE.Vector3(x,y(.74),z+side*.892),new THREE.Vector3(x,y(.74)+.33,z+side*.892),.021,metal);}
 }
 if(w.landmark==='70pine'){pyramid(.9,.97,.44,trim);mast(.97,1,.022);}
 if(w.landmark==='432park')for(const t of [.25,.5,.75])box(x,y(t),z,1.67,.018*h,1.67,metal);
 if(w.landmark==='hudson'){
  // A full-depth, closed crown with a sloping roof; no repeated window texture.
  const crown=hudsonCrown(h);crown.translate(x,ground,z);put(crown,metal);
  box(x+1.15,y(.68),z,.7,.08,1.05,metal);
  box(x+1.49,y(.68)+.13,z,.035,.22,1.05,metal);
  for(const side of [-1,1])box(x+1.15,y(.68)+.13,z+side*.51,.7,.22,.035,metal);
 }
}

export function hudsonCrown(height){
 const low=.79*height,high=height,shoulder=.91*height;
 const vertices=[-.99,low,-.84,.99,low,-.84,.99,low,.84,-.99,low,.84,-.99,high,-.84,.99,shoulder,-.84,.99,shoulder,.84,-.99,high,.84];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setIndex([0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7,0,3,2,0,2,1]);
 const indices=g.index.array;for(let i=0;i<indices.length;i+=3){const b=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=b;}
 const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
