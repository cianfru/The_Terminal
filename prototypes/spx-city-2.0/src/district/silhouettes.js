import * as THREE from 'three';
const names=['Classic rectangular tower','Tapered tower','Stepped Art Deco tower','Spire tower','Geometric crown tower','Pencil tower','Rounded-corner tower','Cylindrical tower','Elliptical tower','Twisted tower','Faceted tower','Triangular tower','Flatiron wedge','Octagonal tower','Hexagonal tower','Cross-shaped tower','H-shaped tower','Twin-tower building','Split tower','Bridged twin tower','Cantilever tower','Stacked-box tower','Terraced tower','Pyramid-top tower','Sloped-roof skyscraper','Curved-roof tower','Domed tower','Needle tower','Broadcast tower','Podium-and-tower','Mega-podium complex','U-shaped residential tower','Courtyard block','Pre-war apartment block','Brownstone row','SoHo cast-iron block','Warehouse / loft','Beaux-Arts commercial','Brutalist slab','Brutalist stepped block','International-style office','Curtain-wall tower','Exoskeleton tower','Diagrid tower','Vertical-rib tower','Horizontal-band tower','Balcony tower','Green terraced tower','Retro-futurist tower','Monolithic supertall'];
const high=new Set([1,2,3,4,5,9,18,19,27,49]);
const ordinary=new Set([0,6,7,8,10,13,14,17,20,23,24,29,40,41,44]);
const low=new Set([11,12,30,34,35,36,37,38,39,48]);
export const SILHOUETTES=names.map((name,id)=>({id,name,group:high.has(id)?'Expressive high-rise':ordinary.has(id)?'Ordinary tower':low.has(id)?'Low-rise / special':'Mid-rise / residential'}));
// Iconic crowns remain available in the catalogue, but reserved landmark replicas
// do not enter the ordinary Manhattan assignment pool.
export const MANHATTAN_FAMILIES=[0,1,2,5,6,7,8,9,10,13,14,15,16,17,18,19,20,21,22,23,24,25,29,38,39,40,41,42,43,44,45,46,47,48];
export function silhouetteParts(id,{width=2.3,depth=2.5,height=12,variant=0}={}){
 const parts=[],v=((variant%3)+3)%3,A=width,B=depth,H=height;
 const put=(g,role='wall')=>{parts.push({geometry:g,role});};
 const box=(x,y,z,w,h,d,role='wall')=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);put(g,role);};
 const b=(x,y,z,w,h,d,role)=>box(x*A,y*H,z*B,w*A,h*H,d*B,role);
 const cylinder=(y,h,rx,rz,n=24,top=1,rotation=0,role='wall')=>{const g=new THREE.CylinderGeometry(rx*A*top,rx*A,h*H,n);g.scale(1,1,rz*B/(rx*A));g.rotateY(rotation);g.translate(0,y*H,0);put(g,role);};
 const beam=(a,b,r=.018,role='structure')=>{const p=new THREE.Vector3(a[0]*A,a[1]*H,a[2]*B),q=new THREE.Vector3(b[0]*A,b[1]*H,b[2]*B),d=q.clone().sub(p),g=new THREE.CylinderGeometry(r*A,r*A,d.length(),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());put(g,role);};
 const prism=(points,lo,hi,scale=1)=>{const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x*A*scale,-z*B*scale)));const g=new THREE.ExtrudeGeometry(shape,{depth:(hi-lo)*H,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,lo*H,0);put(g);};
 const slab=(lo=0,hi=1,w=.84,d=.84,x=0,z=0)=>b(x,(lo+hi)/2,z,w,hi-lo,d);
 const steps=(n=4)=>{for(let k=0;k<n;k++){const lo=k/n,hi=(k+1)/n,s=1-k*.13;slab(lo,hi,s,s);}};
 const crown=(base=.8)=>{slab(0,base);cylinder((1+base)/2,1-base,.5,.5,4,0,Math.PI/4);};
 const podium=()=>slab(0,.12,1,1);
 switch(id){
 case 0:slab(0,1,.82,.92);break;
 case 1:cylinder(.5,1,.5,.5,4,.48+v*.07,Math.PI/4);break;
 case 2:steps(5+v);break;
 case 3:slab(0,.55);slab(.55,.72,.68,.68);slab(.72,.84,.46,.46);cylinder(.88,.08,.2,.2,8,.6);cylinder(.96,.08,.035,.035,8,0,0,'structure');break;
 case 4:slab(0,.7);for(let k=0;k<5;k++)cylinder(.73+k*.048,.06,.35-k*.055,.35-k*.055,4,.6,Math.PI/4);cylinder(.975,.05,.025,.025,6,0,0,'structure');break;
 case 5:podium();slab(.12,1,.4+v*.05,.45);break;
 case 6:{const shape=new THREE.Shape(),w=A*.48,d=B*.48,r=Math.min(A,B)*(.12+v*.035);shape.moveTo(-w+r,-d);shape.lineTo(w-r,-d);shape.quadraticCurveTo(w,-d,w,-d+r);shape.lineTo(w,d-r);shape.quadraticCurveTo(w,d,w-r,d);shape.lineTo(-w+r,d);shape.quadraticCurveTo(-w,d,-w,d-r);shape.lineTo(-w,-d+r);shape.quadraticCurveTo(-w,-d,-w+r,-d);const g=new THREE.ExtrudeGeometry(shape,{depth:H,bevelEnabled:false,curveSegments:5});g.rotateX(-Math.PI/2);put(g);break;}
 case 7:cylinder(.5,1,.48,.48,32);break;
 case 8:cylinder(.5,1,.48,.29,32);break;
 case 9:for(let k=0;k<18;k++){const g=new THREE.BoxGeometry(A*.67,H/18+.008,B*.67);g.rotateY(k*(.025+v*.009));g.translate(0,H*(k+.5)/18,0);put(g);}break;
 case 10:cylinder(.28,.56,.5,.5,5,.92);cylinder(.78,.44,.46,.46,5,.45,Math.PI/5);break;
 case 11:prism([[-.48,.4],[.48,.4],[0,-.5]],0,1);break;
 case 12:prism([[-.5,.47],[.5,.47],[-.36,-.48]],0,1);break;
 case 13:cylinder(.5,1,.5,.5,8);break;
 case 14:cylinder(.5,1,.5,.5,6);break;
 case 15:slab(0,1,.34,1);slab(0,1,1,.34);break;
 case 16:slab(0,1,.26,1,-.35);slab(0,1,.26,1,.35);slab(0,.86,.7,.28);break;
 case 17:podium();slab(.12,.96,.34,.72,-.29);slab(.12,1,.34,.72,.29);break;
 case 18:slab(0,.52);slab(.52,1,.3,.74,-.29);slab(.52,.93,.3,.74,.29);break;
 case 19:podium();slab(.12,1,.28,.8,-.34);slab(.12,1,.28,.8,.34);slab(.76,.84,.8,.48);break;
 case 20:podium();slab(.12,.58,.7,.82,-.06);slab(.58,1,.8,.85,.055);break;
 case 21:for(let k=0;k<4;k++)slab(k/4,(k+1)/4,.7,.72,(k%2?1:-1)*.13,(k<2?1:-1)*.1);break;
 case 22:for(let k=0;k<5;k++)slab(k/5,(k+1)/5,1-k*.13,.94,-k*.065);break;
 case 23:crown(.78+v*.035);break;
 case 24:{slab(0,.68);const g=new THREE.BoxGeometry(A*.84,H*.32,B*.84),p=g.attributes.position;for(let k=0;k<p.count;k++)if(p.getY(k)>0)p.setY(k,p.getY(k)-((p.getX(k)/A)+.42)*H*.25);g.computeVertexNormals();g.translate(0,H*.84,0);put(g);break;}
 case 25:slab(0,.8);for(let k=0;k<12;k++){const x=(k+.5)/12-.5,top=.8+.2*Math.sqrt(Math.max(0,1-4*x*x));b(x*.84,(.8+top)/2,0,.84/12,top-.8,.84);}break;
 case 26:slab(0,.78);{const g=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2);g.scale(A*.43,H*.22,B*.43);g.translate(0,H*.78,0);put(g);}break;
 case 27:slab(0,.65,.72,.72);cylinder(.78,.26,.29,.29,8,.14);cylinder(.955,.09,.028,.028,6,0,0,'structure');break;
 case 28:slab(0,.73);slab(.73,.83,.4,.4);cylinder(.915,.17,.02,.02,6,1,0,'structure');for(const y of [.85,.9])b(0,y,0,.36,.008,.035,'structure');break;
 case 29:podium();slab(.12,1,.56,.6,0,-.12);break;
 case 30:slab(0,.22,1,1);slab(.22,1,.3,.36,-.28,-.23);slab(.22,.8,.3,.36,.28,-.23);slab(.22,.62,.7,.3,0,.29);break;
 case 31:slab(0,1,.23,1,-.38);slab(0,1,.23,1,.38);slab(0,.86,.55,.23,0,-.38);break;
 case 32:for(const x of [-.38,.38])slab(0,1,.24,1,x);for(const z of [-.38,.38])slab(0,.88,.52,.24,0,z);break;
 case 33:slab(0,.87,1,.72);for(const x of [-.34,0,.34])slab(.87,1,.25,.55,x);break;
 case 34:for(let k=0;k<3;k++){slab(0,.86,.3,.88,(k-1)*.34);b((k-1)*.34,.88,0,.32,.06,.92,'structure');}break;
 case 35:slab(0,.93,1,.82);b(0,.965,0,1,.07,.9,'structure');for(let k=0;k<5;k++)b((k-2)*.22,.46,.43,.025,.92,.055,'structure');break;
 case 36:slab(0,.73,1,1);for(let k=0;k<4;k++){const x=(k-1.5)*.25;for(let j=0;j<4;j++)b(x+(j-1.5)*.06,.76+j*.05,0,.06,.08,1,'structure');}break;
 case 37:slab(0,.18,1,1);slab(.18,.86,.88,.88);slab(.86,.94,1,1);slab(.94,1,.76,.76);break;
 case 38:slab(0,1,1,.43);for(const x of [-.42,.42])slab(0,.94,.13,.65,x);break;
 case 39:for(let k=0;k<4;k++)slab(k/4,(k+1)/4,1-k*.16,1,-k*.08);break;
 case 40:slab(0,.94,.88,.82);slab(.94,1,.64,.63);for(let k=0;k<6;k++)for(const z of [-.42,.42])b((k-2.5)*.16,.47,z,.018,.94,.02,'structure');break;
 case 41:slab(0,1,.72,1);slab(0,.86,.18,.88,.45);break;
 case 42:slab(0,1,.82,.8);for(const z of [-.42,.42])for(let k=0;k<3;k++){beam([-.44,k/3,z],[.44,(k+1)/3,z],.025);beam([.44,k/3,z],[-.44,(k+1)/3,z],.025);}break;
 case 43:cylinder(.5,1,.46,.46,8);for(let k=0;k<4;k++)for(const z of [-.47,.47]){beam([0,k/4,z],[.44,(k+.5)/4,z]);beam([.44,(k+.5)/4,z],[0,(k+1)/4,z]);beam([0,k/4,z],[-.44,(k+.5)/4,z]);beam([-.44,(k+.5)/4,z],[0,(k+1)/4,z]);}break;
 case 44:slab(0,1,.8,.78);for(let k=0;k<7;k++)for(const z of [-.43,.43])b((k-3)*.13,.5,z,.035,1,.1,'structure');break;
 // The body ends inside the top band, leaving one exposed roof surface.
 case 45:slab(0,.988,.82,.8);for(let k=1;k<=12;k++)b(0,k/12-.012,0,.97,.024,.96,'structure');break;
 case 46:slab(0,1,.75,.65);for(let k=0;k<10;k++)for(const z of [-.4,.4])b(k%2?.08:-.08,(k+.6)/10,z,.78,.024,.19,'structure');break;
 case 47:for(let k=0;k<5;k++){const w=1-k*.14;slab(k/5,(k+1)/5-.012,w,w);b(0,(k+1)/5-.007,0,w,.014,w,'garden');}break;
 case 48:cylinder(.5,.76,.22,.22,20);for(const y of [.22,.5,.8])cylinder(y,.16,.5,.5,24,.88);cylinder(.95,.1,.35,.35,24,.7);break;
 case 49:slab(0,1,.78,.9);break;
 default:throw new Error('Unknown silhouette '+id);
 }
 // Normalize to the assigned envelope: exotic forms cannot spill into streets.
 const bounds=new THREE.Box3();for(const {geometry:g}of parts){g.computeBoundingBox();bounds.union(g.boundingBox);}const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 for(const {geometry:g}of parts){g.translate(-center.x,-bounds.min.y,-center.z);g.scale(Math.min(1,A/size.x),H/size.y,Math.min(1,B/size.z));}
 return parts;
}
