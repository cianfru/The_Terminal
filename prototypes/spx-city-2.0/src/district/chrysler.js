import * as THREE from 'three';
// Seven overlapping stainless arches, triangular windows and the long needle.
export function chryslerCrown(w,{put,box,cyl,metal,dark,ground}){
 const h=w.h;
 for(let i=0;i<7;i++){
  const r=.72-i*.085,y=ground+h*(.775+i*.024),rise=h*.047,depth=.62-i*.062;
  for(const side of [-1,1]){
   const shape=new THREE.Shape();shape.moveTo(-r,0);shape.lineTo(r,0);for(let j=0;j<=32;j++){const a=j/32*Math.PI;shape.lineTo(Math.cos(a)*r,Math.sin(a)*rise);}shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false});g.translate(w.x,y,w.z+side*depth);put(g,metal);
   for(let j=0;j<5;j++){const a=(j+1)/6*Math.PI,x=w.x+Math.cos(a)*r*.72,yy=y+Math.sin(a)*rise*.72;const tri=new THREE.BufferGeometry();tri.setAttribute('position',new THREE.Float32BufferAttribute([x-.028,yy+.04,w.z+side*(depth+.027),x+.028,yy+.04,w.z+side*(depth+.027),x,yy-.04,w.z+side*(depth+.027)],3));tri.computeVertexNormals();put(tri,dark);}
  }
  box(w.x,y+rise*.22,w.z,r*1.35,rise*.35,depth*2,metal);
 }
 cyl(w.x,ground+h*.965,w.z,.018,.032,h*.07,metal,12);
 for(const dx of [-.85,.85])box(w.x+dx,ground+h*.73,w.z+.63,.35,.055,.18,metal);
}
