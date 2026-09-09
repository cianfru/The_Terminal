import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const exportDir=fileURLToPath(new URL('./review/',import.meta.url));
const names=new Set(['spx-city-matched-views.png',...['skyline','neighborhood','building'].flatMap(v=>['production','proposed'].map(t=>`spx-city-${v}-${t}.png`))]);
// Local development convenience: the normal Export views button also saves the review files.
// This middleware is not part of the production bundle, and accepts only these seven PNG names.
const localExports={name:'study-review-export',configureServer(server){server.middlewares.use('/__harbor-export',async(req,res)=>{try{if(req.method!=='POST')throw Error('POST required');let body='';for await(const chunk of req){body+=chunk;if(body.length>20000000)throw Error('Too large');}const d=JSON.parse(body);if(!['spx-city-liberty.png','spx-city-bridge.png','spx-city-map.png','spx-city-park.png','spx-city-bethesda.png'].includes(d.name)||typeof d.base64!=='string')throw Error('Invalid image');await mkdir(exportDir,{recursive:true});await writeFile(`${exportDir}/${d.name}`,Buffer.from(d.base64,'base64'));res.end('Saved');}catch(e){res.statusCode=400;res.end(e.message);}});server.middlewares.use('/__mobile-review',(req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>SPX City mobile layout review</title><body style="margin:0;background:#141d20;display:grid;place-items:center;min-height:100vh"><iframe title="390px mobile layout" src="/" style="width:390px;height:844px;border:1px solid #657166;border-radius:20px"></iframe></body>');});server.middlewares.use('/__study-export',async(req,res)=>{
 if(req.method!=='POST'){res.statusCode=405;res.end();return;}
 try{let body='';for await(const chunk of req){body+=chunk;if(body.length>50_000_000)throw Error('Export too large');}
  const data=JSON.parse(body);if(!Array.isArray(data.images)||data.images.length!==7)throw Error('Expected seven images');
  if(data.images.some(x=>!names.has(x.name)||typeof x.base64!=='string'))throw Error('Invalid image');
  await mkdir(exportDir,{recursive:true});for(const x of data.images)await writeFile(`${exportDir}/${x.name}`,Buffer.from(x.base64,'base64'));
  await writeFile(`${exportDir}/capture-metadata.json`,JSON.stringify(data.metadata,null,2));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true}));
 }catch(e){res.statusCode=400;res.end(e.message);}
 });}};
export default defineConfig({base:'./',plugins:[tailwindcss(),localExports],server:{port:5178,strictPort:true}});
