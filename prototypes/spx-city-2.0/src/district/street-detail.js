import * as THREE from 'three';
import {safeRoadRuns,onLand} from './land-surfaces.js';
import {nearestOnSegment} from './public-realm.js';

// Soft surface illumination: two triangles per pool, no per-lamp shadow maps.
export function lightPoolMaterial(strength=1){
 return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 uniforms:{strength:{value:strength}},vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*${'\n#ifdef USE_INSTANCING\ninstanceMatrix*\n#endif\n'}vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv; uniform float strength; void main(){vec2 p=(vUv-.5)*2.; float a=pow(max(0.,1.-dot(p,p)),2.); gl_FragColor=vec4(1.,.79,.48,a*.28*strength);}`});
}
export function streetDetail(scene,layout,time,owned,materials,{put,mat}){
 if(!layout.originalGrid)return;
 const white=mat(0xe3e0cc),yellow=mat(0xc9af63),iron=mat(0x36454b),roof=mat(0x4e6568),glass=mat(0x759798,.4),red=mat(0xad4237),lamp=mat(0xffe8ba,.5,{emissive:0xffdba1,emissiveIntensity:time==='day'?.15:2});
 const label=(text,bg)=>{const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,128,128);ctx.fillStyle='#fff7de';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,65);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;owned.push(map);return mat(0xffffff,.8,{map,side:THREE.DoubleSide});};
 const stopLabel=label('STOP','#ad4237'),busLabel=label('BUS','#324e65');
 const signFace=(p,y,w,h,m,angle)=>{const g=new THREE.PlaneGeometry(w,h);g.rotateY(angle);g.translate(p.x,y,p.z);put(g,m);};
 const pools=[],roads=layout.streets;
 const piece=(x,z,w,h,d,y,m,angle=0)=>{const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);put(g,m);};
 const runs=roads.flatMap(r=>safeRoadRuns(layout,r));
 for(const [ri,r]of runs.entries()){
  const dx=r.b.x-r.a.x,dz=r.b.z-r.a.z,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,nx=-uz,nz=ux,angle=Math.atan2(ux,uz);
  const at=(t,n=0)=>({x:r.a.x+ux*t+nx*n,z:r.a.z+uz*t+nz*n});
  const junctions=[];
  for(const other of roads){const ox=other.b.x-other.a.x,oz=other.b.z-other.a.z,det=ux*oz-uz*ox;if(Math.abs(det)<.001)continue;const ax=other.a.x-r.a.x,az=other.a.z-r.a.z,t=(ax*oz-az*ox)/det,v=(ax*uz-az*ux)/det;if(t>=0&&t<=len&&v>=0&&v<=1)junctions.push({t,width:other.width});}
  const clear=(t,pad=2)=>t>3&&t<len-3&&!junctions.some(j=>Math.abs(t-j.t)<j.width/2+pad);
  const stripe=(t,n,w,d,m=white)=>{const p=at(t,n);piece(p.x,p.z,w,.009,d,.071,m,angle);};
  for(let t=4;t<len-4;t+=3){if(!clear(t,2.5))continue;if(r.width<5.5){for(const n of [-.10,.10])stripe(t,n,.055,2.7,yellow);}else{for(const n of [-r.width*.25,r.width*.25])stripe(t,n,.07,1.25);}}
  for(const j of junctions)for(const sign of [-1,1]){const t=j.t+sign*(j.width/2+2.1);if(t<2||t>len-2)continue;
   // Stop line across the approaching lane, behind the pedestrian crossing.
   stripe(t,sign*r.width*.25,r.width*.43,.20);
   if(r.width<5.5&&ri%3===0){const p=at(t,sign*(r.width/2+.7));if(onLand(layout,p.x,p.z)){piece(p.x,p.z,.055,1.7,.055,.9,iron);const g=new THREE.CylinderGeometry(.24,.24,.045,8);g.rotateX(Math.PI/2);g.rotateY(angle);g.translate(p.x,1.8,p.z);put(g,red);signFace({x:p.x+ux*.028,z:p.z+uz*.028},1.8,.34,.22,stopLabel,angle);}}
  }
  for(let t=8;t<len-6;t+=16){if(!clear(t,3))continue;const side=Math.floor(t/16)%2?1:-1,p=at(t,side*(r.width/2+.65));if(!onLand(layout,p.x,p.z)||roads.some(o=>{const q=nearestOnSegment(p,o.a,o.b);return Math.hypot(q.x-p.x,q.z-p.z)<o.width/2+.15;}))continue;
   piece(p.x,p.z,.09,3.7,.09,1.9,iron);const q=at(t,side*(r.width/2-.4));piece((p.x+q.x)/2,(p.z+q.z)/2,1.15,.08,.08,3.72,iron,angle);piece(q.x,q.z,.44,.09,.24,3.68,lamp,angle);
   if(time!=='day')pools.push({p:at(t),w:r.width*.98,d:14,angle});
  }
  // Shelters occupy the sidewalk, with a marked curbside boarding zone.
  if(ri%11===0&&len>28){const t=len*.5;if(clear(t,6)){const p=at(t,r.width/2+.85);if(onLand(layout,p.x,p.z)&&!layout.homes.some(h=>Math.abs(h.x-p.x)<h.width/2+2&&Math.abs(h.z-p.z)<(h.depth||h.identity.depth)/2+3)){
   piece(p.x,p.z,1.15,.12,3.3,2.3,roof,angle);
   for(const dt of [-1.45,1.45]){const q=at(t+dt,r.width/2+1.2);piece(q.x,q.z,.07,2.2,.07,1.15,iron);}
   const back=at(t,r.width/2+1.32);piece(back.x,back.z,.05,1.4,2.9,1.35,glass,angle);piece(p.x,p.z,.4,.1,2.2,.52,roof,angle);
   const sign=at(t+2,r.width/2+.55);piece(sign.x,sign.z,.06,2.5,.06,1.3,iron);piece(sign.x,sign.z,.42,.52,.07,2.35,roof,angle);signFace({x:sign.x+ux*.045,z:sign.z+uz*.045},2.35,.39,.48,busLabel,angle);
   stripe(t,r.width/2-.15,.12,6,yellow);for(const dt of [-3,3])stripe(t+dt,r.width/2-.7,1.15,.10,yellow);
  }}}
 }
 if(pools.length){const material=lightPoolMaterial(time==='night'?1:.45),g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);owned.push(g);materials.push(material);const mesh=new THREE.InstancedMesh(g,material,pools.length),dummy=new THREE.Object3D();pools.forEach((s,i)=>{dummy.position.set(s.p.x,.086,s.p.z);dummy.rotation.y=s.angle;dummy.scale.set(s.w,1,s.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.computeBoundingSphere();scene.add(mesh);}
}
