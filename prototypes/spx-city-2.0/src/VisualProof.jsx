import React,{useEffect,useState} from 'react';
import * as THREE from 'three';
import snapshot from './fullcity/wallets.json';
import {cohort} from './district/model.js';
import {geographicLayout} from './district/geography.js';
import {populationArchitecture} from './district/population-lod.js';
import {studyArchitecture} from './fullcity/study-architecture.js';
import './visual-proof.css';
const layout=geographicLayout(cohort(snapshot,true));
const flowMax=Math.max(...layout.homes.map(w=>Math.abs(w.flow)),1);
const samples=[['Manhattan','midtown'],['The Bronx','bronx']].map(([name,id])=>{
 const blocks=layout.blocks.filter(b=>(b.hood===id||b.borough===id)&&b.homes.length>=8&&!layout.homes.some(w=>w.landmark&&w.block===b.id));
 const b=blocks[0];if(!b)throw new Error('No occupied comparison block for '+name);
 return {name,block:b,homes:layout.homes.filter(w=>w.block===b.id).map(w=>({...w,x:w.x-b.x,z:w.z-b.z}))};
});
function renderProof(time,close){
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1050,700);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const results=[];
 try{for(const sample of samples){for(const refined of [false,true]){
 const scene=new THREE.Scene(),owned=[],materials=[],b=sample.block;
 scene.background=new THREE.Color(time==='day'?0xcbd8d8:time==='dusk'?0xb8afa1:0x25353f);
 scene.add(new THREE.HemisphereLight(time==='night'?0x8faac9:0xe5edf0,0x77715e,time==='night'?.8:1.7));
 const sun=new THREE.DirectionalLight(time==='dusk'?0xffd09a:0xfff4df,time==='night'?.45:3);sun.position.set(-30,45,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:150});sun.shadow.normalBias=.04;scene.add(sun);
 const mat=c=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.9});materials.push(m);return m;};
 const box=(w,h,d,x,y,z,m)=>{const g=new THREE.BoxGeometry(w,h,d);owned.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=true;scene.add(o);};
 const road=mat(0x555e5e),paving=mat(0xbab8a7),soil=mat(0x626e4a),leaves=mat(0x647653),trunk=mat(0x645a49);
 box(b.w+8,.14,b.d+8,0,-.18,0,road);box(b.w,.2,b.d,0,-.03,0,paving);
 for(const x of [-b.w/2+.45,b.w/2-.45])for(const z of [-b.d/2+1,b.d/2-1]){box(.65,.09,.85,x,.11,z,soil);box(.1,.65,.1,x,.45,z,trunk);const g=new THREE.IcosahedronGeometry(.43,1);owned.push(g);const mesh=new THREE.Mesh(g,leaves);mesh.scale.y=1.4;mesh.position.set(x,1,z);mesh.castShadow=true;scene.add(mesh);}
 const maxH=Math.max(...sample.homes.map(w=>w.h)),camera=new THREE.PerspectiveCamera(32,1.5,.1,500),target=new THREE.Vector3(0,maxH*.32,0),span=Math.max(b.w,b.d,maxH*1.2),offset=new THREE.Vector3(span*1.1,span*.95,span*1.45).multiplyScalar(close?.65:1);
 camera.position.copy(target).add(offset);camera.lookAt(target);
 let population;
 if(refined){const architecture=studyArchitecture(scene,time,owned,materials);for(const w of sample.homes)architecture.emit(w,12,w.h,w.x,w.z,99,{natural:true,rotation:0,manhattan:true,flowMax,refined:true});architecture.finish();}
 else{population=populationArchitecture(scene,{homes:sample.homes,ordinaryHomes:sample.homes,flowMax},time,owned,materials);for(let i=1;i<=sample.homes.length;i++)population.update(camera.position,i*110,24);}
 renderer.render(scene,camera);results.push({name:sample.name,refined,count:sample.homes.length,url:renderer.domElement.toDataURL('image/png')});
 population?.dispose();for(const resource of new Set([...owned,...materials]))resource.dispose();renderer.renderLists.dispose();
 }}return results;}finally{renderer.dispose();renderer.forceContextLoss();}
}
export default function VisualProof(){const [time,setTime]=useState('dusk'),[close,setClose]=useState(false),[images,setImages]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;setImages([]);const timer=setTimeout(()=>{try{const result=renderProof(time,close);if(active)setImages(result);}catch(e){setError(e.message);}},60);return()=>{active=false;clearTimeout(timer);};},[time,close]);
 return <div className="visual-proof"><header><a href="/">SPX CITY</a><span>VISUAL CALIBRATION / 01</span><a href="/?district=1&geography=1">Return to city ↗</a></header><main><p className="proof-eyebrow">A CONTROLLED ARCHITECTURE STUDY</p><h1>Architecture first.<br/><em>Light with restraint.</em></h1><p className="proof-intro">Two occupied blocks. The same real wallets, proportions, camera and lighting in each pair. A quieter façade treatment, with recessed windows and detail that stays visible at both distances.</p><nav aria-label="Comparison settings">{['day','dusk','night'].map(t=><button key={t} aria-pressed={time===t} onClick={()=>setTime(t)}>{t}</button>)}<span/>{[false,true].map(c=><button key={String(c)} aria-pressed={close===c} onClick={()=>setClose(c)}>{c?'Close':'Wide'}</button>)}</nav>{error?<p role="alert">{error}</p>:!images.length?<p role="status">Rendering matched views…</p>:samples.map(sample=><section key={sample.name}><h2>{sample.name} <small>{sample.homes.length} real wallets · unchanged placement</small></h2><div className="proof-pair">{images.filter(i=>i.name===sample.name).map(i=><figure key={String(i.refined)}><figcaption><b>{i.refined?'02 / Proposed restraint':'01 / Previous city treatment'}</b><span>{i.refined?'Neutral glazing · fewer lit panes · persistent detail':'Existing materials and distance detail'}</span></figcaption><img src={i.url} alt={`${i.name}, ${i.refined?'proposed':'current'} treatment, ${time}, ${close?'close':'wide'} view`}/></figure>)}</div></section>)}<footer>This is a static visual proof, not a full-city performance test. The approved palette is now applied to the city. The proposed façade detail is held constant in both views; the city uses shared surface shading to keep the rendering cost bounded.<br/><a href="/">Revisit the original waterfront study ↗</a></footer></main></div>;
}
