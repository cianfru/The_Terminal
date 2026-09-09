import * as THREE from 'three';
// World projection is 1 unit = 100 m. Dimensions from NYC DOT; tower height approx 84 m.
export const BRIDGE_DIMENSIONS={length:6016*.3048/100,mainSpan:1595.5*.3048/100,clearance:135*.3048/100,tower:.84,width:.259};
export function bridgeRoadHeight(z){const a=Math.abs(z),anchor=5.26,half=BRIDGE_DIMENSIONS.length/2;return a<=anchor?BRIDGE_DIMENSIONS.clearance:.025+(BRIDGE_DIMENSIONS.clearance-.025)*(1-Math.min(1,(a-anchor)/(half-anchor)));}
export function buildBridge(span,{put,mats,rod}){
 const D=BRIDGE_DIMENSIONS,dx=span.bx-span.ax,dz=span.bz-span.az,angle=Math.atan2(dx,dz),cx=(span.ax+span.bx)/2,cz=(span.az+span.bz)/2;
 const local=(x,y,z)=>[cx+Math.sin(angle)*z+Math.cos(angle)*x,y,cz+Math.cos(angle)*z-Math.sin(angle)*x];
 const place=(g,x,y,z,m)=>{g.rotateY(angle);g.translate(...local(x,y,z));put(g,m);};
 const box=(x,y,z,w,h,d,m)=>place(new THREE.BoxGeometry(w,h,d),x,y,z,m);
 const half=D.length/2,deck=D.clearance,top=D.tower,towerZ=D.mainSpan/2;
 // Continuous roads: suspended span, stone-supported approaches, then ground-level intersections.
 const segments=120,step=D.length/segments;
 for(let i=0;i<segments;i++){
  const za=-half+i*step,zb=za+step,ya=bridgeRoadHeight(za),yb=bridgeRoadHeight(zb),z=(za+zb)/2;
  const g=new THREE.BoxGeometry(D.width,.018,Math.hypot(step,yb-ya)+.003);g.rotateX(-Math.atan2(yb-ya,step));place(g,0,(ya+yb)/2,z,mats.asphalt);
  // Raised central promenade and parapets follow the exact same ramp slope.
  for(const xx of [-D.width*.49,0,D.width*.49]){
   const pg=new THREE.BoxGeometry(xx===0?.048:.008,.025,Math.hypot(step,yb-ya)+.003);pg.rotateX(-Math.atan2(yb-ya,step));place(pg,xx,(ya+yb)/2+.022,z,xx===0?mats.stone:mats.steel);
  }
  if(i%2===0)for(const xx of [-.083,.083])box(xx,(ya+yb)/2+.012,z,.004,.002,.07,mats.paint);
  if(Math.abs(z)>5.2){box(0,(ya+yb)/4-.04,z,D.width+.045,(ya+yb)/2+.08,step+.004,mats.stone);}
 }
 for(const side of [-1,1]){
  box(0,.016,side*(half+1.2),D.width,.025,2.4,mats.asphalt);
  box(0,.016,side*(half+2.3),2.2,.025,D.width,mats.asphalt);
  for(const xx of [-.48,.48])box(xx,.028,side*(half+2.3),.48,.014,.55,mats.stone);
  // Anchorage blocks and stone viaduct supports reach below local terrain height.
  box(0,.12,side*5.15,.48,.38,.52,mats.stone);
 }
 for(const z of [-towerZ,towerZ]){
  const width=.4,sh=new THREE.Shape();sh.moveTo(-width/2,-.25);sh.lineTo(width/2,-.25);sh.lineTo(width/2,top);sh.lineTo(-width/2,top);sh.closePath();
  for(const x of [-.1,.1]){const hole=new THREE.Path();hole.moveTo(x-.06,deck+.01);hole.lineTo(x-.06,.63);hole.quadraticCurveTo(x-.06,.7,x,.755);hole.quadraticCurveTo(x+.06,.7,x+.06,.63);hole.lineTo(x+.06,deck+.01);hole.closePath();sh.holes.push(hole);}
  const g=new THREE.ExtrudeGeometry(sh,{depth:.18,bevelEnabled:false});g.translate(0,0,-.09);place(g,0,0,z,mats.stone);
  for(const y of [.15,.78,.83])box(0,y,z,.435,.025,.23,mats.stone);
  for(let y=.03;y<.78;y+=.055)box(0,y,z,.404,.003,.184,mats.mortar);
 }
 const end=5.26,topCable=.79,mid=deck+.035;
 const cable=z=>Math.abs(z)<=towerZ?mid+(topCable-mid)*(z/towerZ)**2:topCable+(deck-topCable)*(Math.abs(z)-towerZ)/(end-towerZ);
 for(const side of [-1,1])for(const lane of [-1,1]){
  const x=side*.096+lane*.011;
  for(let i=0;i<120;i++){const a=-end+2*end*i/120,b=-end+2*end*(i+1)/120;rod(local(x,cable(a),a),local(x,cable(b),b),.0035,mats.steel);if(i%2===0)rod(local(x,deck+.02,a),local(x,cable(a),a),.0014,mats.steel);}
  for(const z of [-towerZ,towerZ])for(const dir of [-1,1])for(let i=1;i<=10;i++)rod(local(x,.78,z),local(x,deck+.03,z+dir*i*.21),.0017,mats.steel);
 }
 return {center:[cx,0,cz],local};
}
