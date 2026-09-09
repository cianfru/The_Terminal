import * as THREE from 'three';
export function facade(kind,variant=0){
 const size=256,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
 const e=document.createElement('canvas');e.width=e.height=size;const eg=e.getContext('2d');
 const n=document.createElement('canvas');n.width=n.height=size;const ng=n.getContext('2d');
 let seed=981+variant*741;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const glass=kind==='glass',stone=kind==='concrete';
 const palettes=glass?['#839392','#789397','#889595']:stone?['#c2b9a5','#b8b0a2','#c4bca9','#d3cfc0','#a6a49a','#b2b5ac','#c9baa2','#d0c5ae','#9eacaa','#c4beb0']:['#805c48','#ba9878','#c3baa4','#839286','#b89489','#b0aaa0','#6c7777','#e0ccb0','#a5654f','#806b63'];
 g.fillStyle=palettes[variant%palettes.length];g.fillRect(0,0,size,size);
 eg.fillStyle='#000';eg.fillRect(0,0,size,size);ng.fillStyle='#8080ff';ng.fillRect(0,0,size,size);
 for(let i=0;i<17000;i++){g.fillStyle=`rgba(${rand()>.5?'255,245,221':'40,24,15'},${rand()*.08})`;g.fillRect(rand()*size,rand()*size,1+rand()*2,1);}
 if(!glass){for(let y=0;y<size;y+=8){g.fillStyle=stone?'rgba(43,39,30,.1)':'rgba(217,199,171,.2)';g.fillRect(0,y,size,1);for(let x=(y%16?12:0);x<size;x+=24)g.fillRect(x,y,1,8);}}
 const cell=64;g.scale(.5,.5);eg.scale(.5,.5);ng.scale(.5,.5);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const ox=x*cell,oy=y*cell;
  if(glass){
   g.fillStyle=`rgba(33,53,57,${.22+rand()*.22})`;g.fillRect(ox+2,oy+3,60,57);
   const gradient=g.createLinearGradient(ox,0,ox+64,0);gradient.addColorStop(0,'rgba(201,219,214,.17)');gradient.addColorStop(.5,'rgba(28,59,68,.12)');gradient.addColorStop(1,'rgba(199,207,190,.15)');g.fillStyle=gradient;g.fillRect(ox+2,oy+3,60,57);
   g.fillStyle='#a3aca7';g.fillRect(ox,oy,2,64);g.fillRect(ox,oy,64,2);
   g.fillStyle='rgba(34,49,50,.55)';g.fillRect(ox,oy+48,64,11);
   ng.fillStyle='#7680ef';ng.fillRect(ox,oy,3,64);
   if(rand()>.64){eg.fillStyle=`rgba(255,235,191,${.3+rand()*.5})`;eg.fillRect(ox+4,oy+7,56,39);}
  }else{
   g.fillStyle='rgba(33,27,21,.52)';g.fillRect(ox+14,oy+13,36,45);
   g.fillStyle=stone?'#dfd6be':'#bfaa8d';g.fillRect(ox+12,oy+10,40,4);g.fillRect(ox+12,oy+57,40,4);
   if(Math.floor(variant/1000)%5===1){g.fillStyle=stone?'#e4dac4':'#c1ab8c';g.beginPath();g.arc(ox+32,oy+18,17,Math.PI,0);g.fill();}
   g.fillStyle='#25383b';g.fillRect(ox+18,oy+17,28,37);
   g.fillStyle='rgba(139,165,164,.5)';g.fillRect(ox+19,oy+18,26,12);
   g.fillStyle='#a9a18d';g.fillRect(ox+31,oy+17,2,37);g.fillRect(ox+18,oy+34,28,2);
   if(Math.floor(variant/1000)%5===2){g.fillStyle='#475f55';g.fillRect(ox+7,oy+18,8,35);g.fillRect(ox+49,oy+18,8,35);}
   if(Math.floor(variant/1000)%5===4){g.fillStyle='#b9b49e';g.fillRect(ox+22,oy+17,2,37);g.fillRect(ox+40,oy+17,2,37);}
   ng.fillStyle='#6680ea';ng.fillRect(ox+14,oy+13,3,45);ng.fillStyle='#808fe9';ng.fillRect(ox+14,oy+13,36,3);
   if(rand()>.47){eg.fillStyle=`rgba(255,230,183,${.3+rand()*.65})`;eg.fillRect(ox+19,oy+19,11,14);eg.fillRect(ox+34,oy+19,11,14);eg.fillRect(ox+19,oy+37,11,15);eg.fillRect(ox+34,oy+37,11,15);}
  }
 }
 const tex=(cv,color)=>{const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;};
 return {map:tex(c,true),emissiveMap:tex(e,true),normalMap:tex(n,false)};
}
export function environment(time="dusk"){
 const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d'),dusk=time==='dusk',night=time==='night';
 const stops=night?[[0,'#0f202d'],[.48,'#344c5b'],[.55,'#182d35'],[1,'#0e1b20']]:dusk?[[0,'#394963'],[.28,'#7e8495'],[.43,'#d3a090'],[.5,'#efba85'],[.57,'#ad8970'],[1,'#423f43']]:[[0,'#5787ad'],[.32,'#a0c1d3'],[.49,'#d4e0de'],[.55,'#a4b8bb'],[1,'#53635f']];
 const gr=g.createLinearGradient(0,0,0,512);for(const [at,color]of stops)gr.addColorStop(at,color);g.fillStyle=gr;g.fillRect(0,0,1024,512);
 if(!night){const y=dusk?249:185,r=dusk?190:150,sun=g.createRadialGradient(720,y,0,720,y,r);sun.addColorStop(0,dusk?'rgba(255,214,154,.95)':'rgba(247,252,255,.8)');sun.addColorStop(.12,dusk?'rgba(255,185,111,.65)':'rgba(243,250,255,.25)');sun.addColorStop(1,'rgba(255,210,150,0)');g.fillStyle=sun;g.fillRect(0,0,1024,512);}
 const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}
