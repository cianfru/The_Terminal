import * as THREE from 'three';
// Build recessed window bays on planar wall faces. Roofs and sloped crowns are
// separate opaque surfaces; glazing never runs continuously over the whole mass.
export function detailedFacade(parts,{height,glass=false,seed=0,litCount=4}){
 const out=[],buffers=new Map(),add=(role,values)=>{if(!buffers.has(role))buffers.set(role,[]);buffers.get(role).push(...values);};
 for(const {geometry,role}of parts){
  if(role!=='wall'){out.push({geometry,role});continue;}
  const flat=geometry.index?geometry.toNonIndexed():geometry,p=flat.attributes.position,n=flat.attributes.normal,faces=new Map();let roofUnit=false;
  for(let i=0;i<p.count;i+=3){const vs=[0,1,2].map(k=>new THREE.Vector3(p.getX(i+k),p.getY(i+k),p.getZ(i+k))),normal=new THREE.Triangle(...vs).getNormal(new THREE.Vector3());
   add(Math.abs(normal.y)>.35?'roof':'wall',vs.flatMap(v=>v.toArray()));
   if(!roofUnit&&normal.y>.99&&vs.every(v=>v.y>height-.02)&&new THREE.Triangle(...vs).getArea()>.18){
    const c=vs[0].clone().add(vs[1]).add(vs[2]).multiplyScalar(1/3),unit=new THREE.BoxGeometry(.2,.11,.23);unit.translate(c.x,c.y+.055,c.z);out.push({geometry:unit,role:'roof'});roofUnit=true;
   }

   if(Math.abs(normal.y)>.08)continue;
   // Exact plane grouping joins the two triangles of a wall, but keeps setbacks separate.
   const d=normal.dot(vs[0]),key=[normal.x,normal.y,normal.z,d].map(x=>x.toFixed(4)).join('|');
   if(!faces.has(key)){const u=new THREE.Vector3(normal.z,0,-normal.x).normalize(),v=new THREE.Vector3().crossVectors(normal,u).normalize();faces.set(key,{normal,d,triangles:[],u,v});}
   const face=faces.get(key);face.triangles.push(vs.map(v=>[v.dot(face.u),v.dot(face.v)]));
  }
  for(const f of faces.values()){
   const pts=f.triangles.flat(),minU=Math.min(...pts.map(p=>p[0])),maxU=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
   const inside=(u,y)=>f.triangles.some(t=>{const [a,b,c]=t,sign=(p,q)=>(u-q[0])*(p[1]-q[1])-(p[0]-q[0])*(y-q[1]),s=[sign(a,b),sign(b,c),sign(c,a)];return !s.some(v=>v<-.00001)||!s.some(v=>v>.00001);});
   const world=(u,y,offset=0)=>f.u.clone().multiplyScalar(u).addScaledVector(f.v,y).addScaledVector(f.normal,f.d+offset).toArray();
   const rect=(l,b,r,t,role,offset)=>{const a=world(l,b,offset),c=world(r,t,offset),v=world(r,b,offset),d=world(l,t,offset);add(role,[...a,...v,...c,...a,...c,...d]);};
   const faceWidth=maxU-minU,columns=Math.max(1,Math.round(faceWidth/.46)),bay=faceWidth/columns,frame=Math.min(.035,bay*.07),lip=Math.min(.018,bay*.035);
   if(faceWidth<.09||maxY-minY<.28)continue;
   for(let row=Math.ceil(Math.max(.82,minY+.13)/.45);row*.45+.32<maxY-.12;row++)for(let col=0;col<columns;col++){
    const center=minU+(col+.5)*bay,half=bay*(glass?.38:.32),bottom=row*.45,top=bottom+(glass?.34:.29),left=center-half,right=center+half;
    if(![[left-frame,bottom-.038],[left-frame,top+.018],[right+frame,bottom-.038],[right+frame,top+.018]].every(([u,y])=>inside(u,y)))continue;
    rect(left-lip,bottom-.018,right+lip,top+.018,'recess',.005);
    const lit=((row*17+col*13+seed)%11)<litCount;rect(left,bottom,right,top,lit?'litWindow':'window',.009);
    if(!glass){rect(left-frame,bottom-.038,right+frame,bottom-.01,'structure',.035);rect(center-.009,bottom,center+.009,top,'structure',.016);}
   }
   // Taller street-level glazing under an opaque lintel, bounded to this face.
   if(minY<.1&&maxY>.8&&faceWidth>.6){for(let c=0;c<columns;c++){const center=minU+(c+.5)*bay,l=center-bay*.37,r=center+bay*.37;if([[l,.18],[l,.7],[r,.18],[r,.7]].every(([u,y])=>inside(u,y)))rect(l,.18,r,.7,'window',.012);}if([[minU+.04,.73],[minU+.04,.79],[maxU-.04,.73],[maxU-.04,.79]].every(([u,y])=>inside(u,y)))rect(minU+.04,.73,maxU-.04,.79,'structure',.025);}
  }
  if(flat!==geometry)flat.dispose();geometry.dispose();
 }
 for(const [role,positions]of buffers){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();out.push({geometry:g,role});}
 return out;
}
