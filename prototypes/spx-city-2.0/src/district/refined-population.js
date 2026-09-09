import {qualityBlock} from './block-quality.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {silhouetteParts} from './silhouettes.js';
import {windowSignal} from './window-signal.js';

// Window bays are shaded on the actual wall planes, never detached overlay meshes.
// Derivatives filter subpixel bays at skyline distance, with no geometry swaps.
export function facadeSurface(parts){
 const buckets=new Map(),faces=new Map();
 const add=(role,points,normal)=>{if(!buckets.has(role))buckets.set(role,[]);buckets.get(role).push({points,normal});};
 for(const {geometry,role}of parts){const flat=geometry.index?geometry.toNonIndexed():geometry,p=flat.attributes.position;
  for(let i=0;i<p.count;i+=3){const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k)),normal=new THREE.Triangle(...points).getNormal(new THREE.Vector3()),r=role==='wall'?(Math.abs(normal.y)>.35?'roof':Math.abs(normal.y)>.08?'structure':'wall'):role;add(r,points,normal);
   if(r==='wall'){const tangent=new THREE.Vector3(normal.z,0,-normal.x).normalize(),key=[normal.x,normal.y,normal.z,normal.dot(points[0])].map(v=>v.toFixed(3)).join('|');const range=faces.get(key)||[Infinity,-Infinity,Infinity,-Infinity];for(const v of points){const u=v.dot(tangent);range[0]=Math.min(range[0],u);range[1]=Math.max(range[1],u);range[2]=Math.min(range[2],v.y);range[3]=Math.max(range[3],v.y);}faces.set(key,range);}
  }if(flat!==geometry)flat.dispose();geometry.dispose();
 }
 return [...buckets].map(([role,triangles])=>{const positions=[],coords=[],ranges=[],axes=[];
  for(const {points,normal}of triangles){const tangent=new THREE.Vector3(normal.z,0,-normal.x).normalize(),key=[normal.x,normal.y,normal.z,normal.dot(points[0])].map(v=>v.toFixed(3)).join('|'),range=faces.get(key)||[0,1,0,1];for(const p of points){positions.push(...p.toArray());coords.push(p.dot(tangent),p.y);ranges.push(...range);axes.push(tangent.x,tangent.z);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('facadeCoord',new THREE.Float32BufferAttribute(coords,2));g.setAttribute('facadeRange',new THREE.Float32BufferAttribute(ranges,4));g.setAttribute('facadeAxis',new THREE.Float32BufferAttribute(axes,2));g.computeVertexNormals();return {geometry:g,role};
 });
}
export function refinedPopulation(scene,layout,time,owned,materials){
 const groups=new Map(),dummy=new THREE.Object3D();
 for(const w of layout.homes.slice(12)){const key=[w.identity.family,w.identity.silhouette,w.identity.palette%4].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(w);}
 const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.8,...extra});materials.push(m);return m;};
 const walls=new Map(),signalMode={value:2},qualityMode={value:0},proofBlock=qualityBlock(layout);
 for(const homes of groups.values()){
  const representative=[...homes].sort((a,b)=>a.h-b.h)[Math.floor(homes.length/2)],id=representative.identity,palette=id.palette%4;
  const key=id.family+'|'+palette;
  if(!walls.has(key)){
   const m=mat(0xffffff,{vertexColors:true});
   m.onBeforeCompile=s=>{
    s.uniforms.qualityMode=qualityMode;s.uniforms.signalMode=signalMode;s.uniforms.walletGlow={value:time==='day'?.12:time==='night'?.95:.42};s.uniforms.facadeSeed={value:palette};
    s.vertexShader='attribute float proofHome; varying float vProofHome; attribute float activity; attribute float buildingSeed; varying float vBuildingSeed; varying float vActivity; attribute float facadeActive; varying float vFacadeActive; attribute vec3 walletEmission; attribute vec2 facadeCoord; attribute vec4 facadeRange; attribute vec2 facadeAxis; varying vec3 vWalletEmission; varying vec2 vFacadeCoord; varying vec4 vFacadeRange;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     vProofHome=proofHome;vFacadeActive=facadeActive;vActivity=activity;vBuildingSeed=buildingSeed;
     float horizontalScale=length(facadeAxis*vec2(instanceMatrix[0][0],instanceMatrix[2][2]));
     vFacadeCoord=facadeCoord*vec2(horizontalScale,instanceMatrix[1][1]);
     vFacadeRange=facadeRange*vec4(horizontalScale,horizontalScale,instanceMatrix[1][1],instanceMatrix[1][1]);vWalletEmission=walletEmission;`);
    s.fragmentShader='uniform float qualityMode; varying float vProofHome; uniform float signalMode; varying float vBuildingSeed; varying float vActivity; varying float vFacadeActive; uniform float walletGlow; uniform float facadeSeed; varying vec3 vWalletEmission; varying vec2 vFacadeCoord; varying vec4 vFacadeRange;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     float proof=qualityMode*min(1.,vProofHome);
     // Keep a full masonry entrance storey on every low-rise wall, including courtyards.
     float groundStorey=qualityMode*step(1.5,vProofHome)*(1.-smoothstep(1.40,1.48,vFacadeCoord.y));
     float windowWall=vFacadeActive*(1.-groundStorey);
     float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
     diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(luminance),diffuseColor.rgb,1.35)*.80,proof);
     vec2 span=max(vec2(.01),vec2(vFacadeRange.y-vFacadeRange.x,vFacadeRange.w-vFacadeRange.z));
     vec2 count=max(vec2(1.),floor(span/vec2(.40+mod(vBuildingSeed,4.)*.065,.43+mod(vBuildingSeed,3.)*.035)));
     vec2 grid=(vFacadeCoord-vec2(vFacadeRange.x,vFacadeRange.z))/span*count;
     vec2 cell=fract(grid),aa=max(fwidth(grid),vec2(.001));
     vec2 inner=smoothstep(vec2(.18)-aa,vec2(.18)+aa,cell)*(1.-smoothstep(vec2(.82)-aa,vec2(.82)+aa,cell));
     float pane=inner.x*inner.y;
     float illuminated=1.-step(2.,mod(floor(grid.y)*17.+floor(grid.x)*13.+facadeSeed+vBuildingSeed,11.));
     float resolved=1.-smoothstep(.3,1.2,max(aa.x,aa.y));
     float coverage=mix(.4096,pane,resolved)*windowWall;
     float lit=mix(2./11.,illuminated,resolved);
     vec3 glass=mix(vec3(.048,.086,.097),vec3(.188,.242,.216),lit);
     vec2 outer=smoothstep(vec2(.13)-aa,vec2(.13)+aa,cell)*(1.-smoothstep(vec2(.87)-aa,vec2(.87)+aa,cell));
     float border=max(0.,outer.x*outer.y-pane)*resolved*windowWall;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055,.065,.061),border*.8);
     float reflection=(1.-smoothstep(.23,.48,cell.y))*.025*resolved;
     glass+=vec3(reflection*.7,reflection,reflection);
     diffuseColor.rgb=mix(diffuseColor.rgb,glass,coverage);
     float mullion=(1.-smoothstep(.014,.014+aa.x,abs(cell.x-.5)));
     float transom=(1.-smoothstep(.014,.014+aa.y,abs(cell.y-.54)));
     float frame=max(mullion,transom)*pane*resolved*windowWall;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.33,.28),frame*.7);
     float sill=(1.-smoothstep(.022,.022+aa.y,abs(cell.y-.15)))*outer.x*resolved*windowWall;
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.40,.32),sill*.55);
     coverage*=1.-frame*.8;
     vec2 faceUV=(vFacadeCoord-vec2(vFacadeRange.x,vFacadeRange.z))/span;
     vec2 edgeDistance=min(faceUV,1.-faceUV)*span;
     float ribbon=1.-smoothstep(.08,.16,min(edgeDistance.x,edgeDistance.y));
     // Cornice light and short corner returns follow each actual wall / setback.
     // Filter narrow bands at distance without turning the whole facade into a signal.
     float topDistance=max(0.,vFacadeRange.w-vFacadeCoord.y);
     float bandWidth=min(.14,span.y*.035);
     float bandAA=max(.015,fwidth(topDistance));
     float cornice=1.-smoothstep(bandWidth,bandWidth+bandAA,topDistance);
     cornice*=bandWidth/max(bandWidth,bandAA);
     float cornerReturn=(1.-smoothstep(.07,.14,edgeDistance.x))*(1.-smoothstep(.4,.7,topDistance));
     float accent=max(cornice,cornerReturn*.65);
     float activityMask=vActivity*vFacadeActive*(signalMode>1.5?accent:signalMode>.5?ribbon*.8:0.);
     diffuseColor.rgb=mix(diffuseColor.rgb,vWalletEmission,activityMask*.7);
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','totalEmissiveRadiance = vWalletEmission * coverage * mix(.025,walletGlow,lit) + vWalletEmission*activityMask*.85;');
   };m.customProgramCacheKey=()=> 'persistent-facade-bays-v5';walls.set(key,m);
  }
  const parts=facadeSurface(silhouetteParts(id.silhouette,{width:id.width,depth:id.depth,height:representative.h,variant:palette}));
  const bounds=new THREE.Box3();for(const p of parts){p.geometry.computeBoundingBox();bounds.union(p.geometry.boundingBox);}const center=bounds.getCenter(new THREE.Vector3());
  for(const {role,geometry:g}of parts){const base=new THREE.Color(role==='wall'?(id.family==='glass'?[0x71969f,0x93aaa9,0x718a9e,0xa8b3ac]:[0xba8c70,0xd2bd9c,0xd6cdb9,0xaa8771])[palette]:role==='roof'?0x65675e:role==='garden'?0x458a79:0xc5bda5),colors=[],active=[];for(let i=0;i<g.attributes.position.count;i++){colors.push(...base.toArray());active.push(role==='wall'?1:0);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('facadeActive',new THREE.Float32BufferAttribute(active,1));}
  const combined=mergeGeometries(parts.map(p=>p.geometry),false);parts.forEach(p=>p.geometry.dispose());
  for(const g of [combined]){g.translate(-center.x,0,-center.z);owned.push(g);const signals=homes.flatMap(w=>new THREE.Color(windowSignal(w,layout.flowMax,time).color).toArray());g.setAttribute('proofHome',new THREE.InstancedBufferAttribute(new Float32Array(homes.map(w=>layout.geographic?((w.borough&&w.borough!=='manhattan')||['tribeca','village'].includes(w.hood)?2:1):w.block===proofBlock?.id?1:0)),1));g.setAttribute('buildingSeed',new THREE.InstancedBufferAttribute(new Float32Array(homes.map(w=>[...w.a].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,0)%97)),1));g.setAttribute('activity',new THREE.InstancedBufferAttribute(new Float32Array(homes.map(w=>Math.abs(windowSignal(w,layout.flowMax,time).direction))),1));g.setAttribute('walletEmission',new THREE.InstancedBufferAttribute(new Float32Array(signals),3));
   const mesh=new THREE.InstancedMesh(g,walls.get(key),homes.length);mesh.castShadow=true;mesh.receiveShadow=true;
   homes.forEach((w,i)=>{dummy.position.set(w.x,.17,w.z);dummy.scale.set(w.identity.width/id.width,w.h/representative.h,w.identity.depth/id.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);
  }
 }
 return {quality(enabled){qualityMode.value=enabled?1:0;},signal(mode){signalMode.value=({windows:0,edges:1,accents:2,facade:2})[mode]??0;},update(){},get count(){return layout.homes.length-12;},dispose(){}};
}
