import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {motion,AnimatePresence} from 'framer-motion';
import {ArrowUpRight,ArrowDownRight,ArrowRight,Check,ChevronDown,Download,Expand,Info,Layers,MapPin,MousePointer2,MoveHorizontal,RotateCcw,Search,Sun,Sunset,Moon,X} from 'lucide-react';
import snapshot from './sample.json';
import {LANDMARKS} from './landmarks.js';
import Harbor from './Harbor.jsx';
const Flypass=React.lazy(()=>import('./Flypass.jsx'));
const Cinematic=React.lazy(()=>import('./Cinematic.jsx'));
const VisualProof=React.lazy(()=>import('./VisualProof.jsx'));
const Catalogue=React.lazy(()=>import('./Catalogue.jsx'));
const District=React.lazy(()=>import('./District.jsx'));
const FullCity=React.lazy(()=>import('./FullCity.jsx'));
import {buildModel,PRESETS} from './model.js';
import {createCityStudy} from './scene.js';
import './style.css';

const model=buildModel(snapshot),fmt=n=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n),short=a=>a.slice(0,6)+'…'+a.slice(-4);
const Button=({children,className='',...props})=><motion.button whileHover={{scale:1.025}} whileTap={{scale:.97}} className={className} {...props}>{children}</motion.button>;
function App(){
 const [landmarks,setLandmarks]=useState(false),[harbor,setHarbor]=useState(false),[fullCity,setFullCity]=useState(null),[district,setDistrict]=useState(()=>new URLSearchParams(location.search).has('district'));
 const mount=useRef(),api=useRef(),[mode,setMode]=useState('proposed'),[view,setView]=useState('skyline'),[time,setTime]=useState('dusk'),[split,setSplit]=useState(.5),[signal,setSignal]=useState(true),[stats,setStats]=useState(null),[wallet,setWallet]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState(false),[query,setQuery]=useState(''),[findMessage,setFindMessage]=useState(''),[exporting,setExporting]=useState(false),[exportMessage,setExportMessage]=useState('');
 useEffect(()=>{let alive=true;try{api.current=createCityStudy(mount.current,model,snapshot,{onStats:s=>alive&&setStats(s),onSelect:w=>alive&&setWallet(w),onReady:()=>alive&&setReady(true),onError:e=>alive&&setError(e)});}catch(e){setError(e.message);}return()=>{alive=false;api.current?.dispose();};},[]);
 useEffect(()=>{
 const previous=document.activeElement;
 const key=e=>{if(e.key==='Escape'){setInfo(false);setWallet(null);api.current?.select(null);}if(info&&e.key==='Tab'){const nodes=[...document.querySelectorAll('.info-modal button,.info-modal input,.info-modal a')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 if(info)requestAnimationFrame(()=>document.querySelector('.info-modal button')?.focus());
 document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(info)previous?.focus?.();};
 },[info]);
 useEffect(()=>{api.current?.setPaused(harbor||fullCity!==null||district);},[harbor,fullCity,district]);
 const treatment=v=>{setMode(v);api.current?.setMode(v);};
 const camera=v=>{setView(v);api.current?.setCamera(v);};
 const lighting=v=>{setTime(v);requestAnimationFrame(()=>api.current?.setTime(v));};
 const toggleSignal=()=>{setSignal(v=>{api.current?.setSignal(!v);return !v;});};
 const find=e=>{e.preventDefault();const q=query.trim().toLowerCase();if(!q)return;const match=model.find(w=>w.a.toLowerCase()===q);if(match){setWallet(match);api.current?.focus(match);setFindMessage('');}else setFindMessage('This address is not in the 96-wallet study sample.');};
 const closeWallet=()=>{setWallet(null);api.current?.select(null);};
 const exportViews=async()=>{
  if(!api.current||exporting)return;setExporting(true);setExportMessage('');
  try{const images=await api.current.capture();const bitmaps=await Promise.all(images.map(x=>createImageBitmap(x.blob)));const tileW=1440,tileH=Math.round(tileW*bitmaps[0].height/bitmaps[0].width),bar=62,header=160;
   const cv=document.createElement('canvas');cv.width=tileW*2;cv.height=header+(tileH+bar)*3;const g=cv.getContext('2d');g.fillStyle='#171c20';g.fillRect(0,0,cv.width,cv.height);g.fillStyle='#eeeadd';g.font='48px Georgia';g.fillText('SPX City / A new perspective',42,65);g.font='22px sans-serif';g.fillStyle='#b4bdb8';g.fillText(`96 real wallets · snapshot ${snapshot.snapshotDate} · same heights, parcels and cameras · ${time}`,42,112);
   for(let i=0;i<images.length;i++){const col=i%2,row=Math.floor(i/2),x=col*tileW,y=header+row*(tileH+bar);g.fillStyle='#e9e6d9';g.font='22px sans-serif';g.fillText(`${Object.values(PRESETS)[row].label} / ${col?'Proposed direction':'Production forms & materials'}`,x+30,y+40);g.drawImage(bitmaps[i],x,y+bar,tileW,tileH);bitmaps[i].close();}
   const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
   if(import.meta.env.DEV){
    const base64=b=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(b);});
    const files=await Promise.all([...images,{name:'spx-city-matched-views.png',blob}].map(async x=>({name:x.name,base64:await base64(x.blob)})));
    const response=await fetch('/__study-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images:files,metadata:{snapshot:snapshot.snapshotDate,commit:snapshot.commit,sample:96,time,signal,stats,createdAt:new Date().toISOString()}})});if(!response.ok)throw Error('Could not save local review images');
    setExportMessage('Six matched views saved in the review folder.');
   }else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='spx-city-matched-views.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setExportMessage('Six matched views exported.');}
  }catch(e){setExportMessage('Export failed: '+e.message);}finally{setExporting(false);}
 };
 return <div className={`app relative flex min-h-screen flex-col time-${time}`}>
  <header className="topbar flex items-center justify-between gap-4">
   <a className="wordmark flex items-center gap-3" href="#" onClick={e=>{e.preventDefault();camera('skyline');}} aria-label="SPX City home"><span className="citymark" aria-hidden="true"><i/><i/><i/><i/></span><span>SPX<span className="wordmark-light">CITY</span></span></a>
   <div className="study-tag"><span className="status-dot"/> A NEW PERSPECTIVE <span className="slash">/</span> STUDY 03</div>
   <div className="flex items-center gap-2"><Button className="icon-btn" onClick={()=>setInfo(true)} aria-label="About this study"><Info size={17}/></Button><Button className="export-btn flex items-center gap-2" onClick={exportViews} disabled={!ready||exporting}><Download size={15}/><span>{exporting?'Preparing…':'Export views'}</span></Button></div>
  </header>
  <main className="stage-wrap relative flex-1">
   <div ref={mount} className="scene" role="img" aria-label="Interactive waterfront neighborhood. Each of 96 buildings represents a real SPX wallet. Drag to orbit, scroll to zoom, or click to inspect."/>
   <div className="top-scrim"/>
   <div className="scene-heading pointer-events-none"><div className="eyebrow"><span className="fine-line"/> THE WALLET NEIGHBORHOOD</div><h1>Every wallet.<br/><em>A place in the skyline.</em></h1><p>Real holders. A more human city.</p></div>
   <div className="landmark-entry"><Button onClick={()=>setDistrict(true)}>New landmark district ↗</Button><Button onClick={()=>setFullCity(false)}>Study 03 · Full city ↗</Button><Button onClick={()=>setFullCity(true)}>Activity map ↗</Button><Button onClick={()=>setLandmarks(v=>!v)}>NYC landmarks <ArrowUpRight size={13}/></Button><Button onClick={()=>setHarbor(true)}>Explore the harbor <ArrowUpRight size={13}/></Button></div>
   {landmarks&&<aside className="landmark-library"><div className="flex items-center justify-between"><span className="eyebrow">12 ICONS / 12 LARGEST WALLETS</span><Button className="icon-btn" aria-label="Close landmark library" onClick={()=>setLandmarks(false)}><X size={16}/></Button></div><p>Ranked by SPX balance in this snapshot.</p>{LANDMARKS.map(l=>{const w=model.find(w=>w.landmark===l.id);return <Button key={l.id} onClick={()=>{setWallet(w);api.current?.focus(w);setLandmarks(false);setView('custom');}}><span className="landmark-rank">{String(l.balanceRank).padStart(2,'0')}</span><span><strong>{l.name}</strong><small>{l.detail}</small></span><span>{fmt(w.bal)}</span></Button>;})}</aside>}
   <div className="scene-tools flex items-center gap-2">
    <div className="lighting flex items-center" role="group" aria-label="Lighting">
     {[['day',Sun,'Daylight'],['dusk',Sunset,'Dusk'],['night',Moon,'Night']].map(([key,Icon,label])=><Button key={key} className={time===key?'active':''} onClick={()=>lighting(key)} aria-label={label} aria-pressed={time===key}><Icon size={16}/></Button>)}
    </div>
    <Button className={'layer-btn flex items-center gap-2 '+(signal?'selected':'')} onClick={toggleSignal} aria-pressed={signal}><Layers size={15}/><span>Wallet light</span></Button>
   </div>
   <div className="compass" aria-hidden="true"><span>N</span><svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 2L22 29L14 23Z" fill="currentColor"/><path d="M14 2L6 29L14 23Z" fill="none" stroke="currentColor"/></svg></div>
   {mode==='compare'&&<><div className="compare-label baseline">PRODUCTION FORMS</div><div className="compare-label proposal">PROPOSED DIRECTION</div><div className="wipe" style={{left:`${split*100}%`}}><div className="wipe-knob"><MoveHorizontal size={18}/></div></div><input className="wipe-range" type="range" min="5" max="95" value={split*100} aria-label="Comparison divider" onChange={e=>{const s=+e.target.value/100;setSplit(s);api.current?.setSplit(s);}}/></>}
   {!ready&&!error&&<div className="loading-overlay"><span className="loader"/><p>Building your neighborhood</p><small>96 real wallets. One shared view.</small></div>}
   {error&&<div className="loading-overlay error"><h2>Unable to render the study</h2><p>{error}</p><Button onClick={()=>location.reload()}>Reload</Button></div>}
   <div className="scene-bottom">
    <div className="location-label"><MapPin size={13}/><span>WATERFRONT STUDY</span><span className="subtle"> / STAGED PARCELS</span></div>
    <div className="scene-legend">{signal?<><span className="legend-dot adding"/> Adding <span className="legend-dot reducing"/> Reducing <span className="legend-divider">/</span><span className="age-ramp"/> Newer → older</>:<><span className="legend-dot warm"/> Architectural lighting · data colors hidden</>}</div>
    <div className="orbit-hint"><MousePointer2 size={13}/><span>Drag to orbit · Scroll to zoom · Select a building</span></div>
   </div>
   <AnimatePresence>{wallet&&<motion.aside className="wallet-panel" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:20}}>
    <div className="flex items-center justify-between"><div className="eyebrow">YOUR PLACE IN THE CITY</div><Button className="icon-btn" onClick={closeWallet} aria-label="Close wallet"><X size={17}/></Button></div>
    <div className="wallet-glyph" aria-hidden="true">▥</div><h2>{short(wallet.a)}</h2><p className="wallet-kind">{wallet.landmark?LANDMARKS.find(l=>l.id===wallet.landmark).name:wallet.identity.name}</p>
    <dl><div><dt>{wallet.balanceRank?`SPX held · #${wallet.balanceRank}`:'SPX held'}</dt><dd>{fmt(wallet.bal)}</dd></div><div><dt>Holding age</dt><dd>{Math.round(wallet.days)} <small>days</small></dd></div><div><dt>30-day net flow</dt><dd className={wallet.d30>0?'positive':wallet.d30<0?'negative':''}>{wallet.d30>0?'+':''}{fmt(wallet.d30)}</dd></div></dl>
    {!wallet.landmark&&<div className="design-traits"><span>YOUR BUILDING’S CHARACTER</span><p>{['Recessed entry','Raised stoop','Canopy entrance','Shopfront'][wallet.identity.entrance]} · {['Sash windows','Arched windows','Shuttered windows','Tall windows','Divided windows'][wallet.identity.windows]} · {wallet.identity.balconies?'Balconies':'Clean facade'}</p><small>Design stays with your wallet. Trading changes the light.</small></div>}
    <Button className="focus-btn" onClick={()=>{api.current?.focus(wallet);setView('custom');}}>Explore this building <ArrowRight size={16}/></Button>
    <a className="wallet-link" href={`https://etherscan.io/address/${wallet.a}`} target="_blank" rel="noreferrer">View wallet on Etherscan <ArrowUpRight size={13}/></a>
    <p className="wallet-caption">Windows show age; roof edges show flow. Building traits are seeded by wallet address and versioned independently of trading data. Height = size × holding time, on the production compressed scale. Architecture and street address are illustrative.</p>
   </motion.aside>}</AnimatePresence>
  </main>
  <section className="control-deck">
   <div className="camera-control"><span className="deck-label">THE VIEW</span><div className="view-buttons flex items-center gap-1">{Object.entries(PRESETS).map(([k,v],i)=><Button key={k} className={view===k?'active':''} onClick={()=>camera(k)} aria-pressed={view===k}><span className="view-number">0{i+1}</span>{v.label}</Button>)}<Button className="reset-btn" onClick={()=>camera(view in PRESETS?view:'skyline')} aria-label="Reset camera"><RotateCcw size={14}/></Button></div></div>
   <div className="treatment-control"><span className="deck-label">THE TREATMENT</span><div className="treatment-buttons flex items-center" role="group" aria-label="Treatment">{[['production','Production'],['compare','Compare'],['proposed','Proposed']].map(([k,l])=><Button key={k} className={mode===k?'active':''} onClick={()=>treatment(k)} aria-pressed={mode===k}>{mode===k&&<span className="tiny-dot"/>}{l}</Button>)}</div></div>
   <div className="performance"><span className="deck-label">LIVE RENDER</span><div><span className="status-dot"/><strong>{stats?.fps||'—'}</strong><span>FPS</span><span className="perf-separator">/</span><span>{stats?.drawCalls||'—'} calls</span></div></div>
  </section>
  <footer className="footer flex items-center justify-between gap-4"><div><span className="footer-count">96</span> real wallets <span className="footer-dot">·</span> Same data. Same camera. <a className="source-credit" href="https://spx6900rainbow.xyz" target="_blank" rel="noreferrer">By SPX6900 Rainbow ↗</a></div><Button className="text-btn" onClick={()=>setInfo(true)}>Inside the study <ArrowUpRight size={13}/></Button><span className="snapshot">SNAPSHOT {snapshot.snapshotDate}</span></footer>
  {exportMessage&&<div className="toast" role="status">{exportMessage}<Button onClick={()=>setExportMessage('')} aria-label="Dismiss export status"><X size={14}/></Button></div>}
  <AnimatePresence>{info&&<motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setInfo(false)}><section className="info-modal" role="dialog" aria-modal="true" aria-label="Inside the study" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><span className="eyebrow">SPX CITY / DESIGN STUDY 03</span><Button className="icon-btn" onClick={()=>setInfo(false)} aria-label="Close study details"><X size={18}/></Button></div><h2>A new perspective.<br/><em>The same underlying truth.</em></h2><p>This neighborhood is a fixed, stratified sample of 96 real wallets from the {snapshot.population.toLocaleString()} eligible SPX holders in the {snapshot.snapshotDate} repository snapshot.</p><div className="study-facts"><div><Check size={16}/><p><strong>Matched comparison</strong>Identical wallets, calculated heights, lot positions and camera. Drag the divider to compare, or inspect either treatment in full.</p></div><div><Check size={16}/><p><strong>Production baseline</strong>The current production building geometry, facade functions, material families and data color bins, composed on the study blocks. This is a controlled material/form comparison, not a screenshot of the entire live city.</p></div><div><Check size={16}/><p><strong>Honest design freedom</strong>Parcels, piers, trees and architectural styles are illustrative. No invented wallets or transactions. The 12 largest eligible wallets by SPX balance carry unique New York landmark architecture; the other 84 draw from 50 architectural types with address-seeded facade, roof, entrance, window and balcony traits. Assignments are fixed to this snapshot and do not indicate owner identity or location. In the proposed view, windows show age and roof edges show flow, including small moves; in production, a flow color replaces age once it clears the inherited color bin.</p></div></div><form onSubmit={find} className="search-form"><Search size={16}/><input aria-label="Find wallet in study sample" placeholder="Find a sample wallet · 0x…" value={query} onChange={e=>setQuery(e.target.value)}/><Button type="submit">Find <ArrowRight size={14}/></Button></form>{findMessage&&<p className="find-message" role="status">{findMessage}</p>}{wallet&&<Button className="text-btn" onClick={()=>setInfo(false)}>Show selected wallet <ArrowRight size={13}/></Button>}<p className="info-foot">Performance shown is this 96-wallet study in this browser. Full-city and physical mobile benchmarks are a later validation step. <a href={`https://github.com/cianfru/The_Terminal/tree/${snapshot.commit}`} target="_blank" rel="noreferrer">Source snapshot ↗</a></p></section></motion.div>}</AnimatePresence>
 {district&&<React.Suspense fallback={<div className="full-city">Loading district…</div>}><District onClose={()=>setDistrict(false)}/></React.Suspense>}
 {fullCity!==null&&<React.Suspense fallback={<div className="full-city">Loading city…</div>}><FullCity initialActivity={fullCity} onClose={()=>setFullCity(null)}/></React.Suspense>}
 {harbor&&<Harbor onClose={()=>setHarbor(false)}/>}
 </div>;
}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('flypass')?<React.Suspense fallback={<p>Preparing the flight…</p>}><Flypass/></React.Suspense>:new URLSearchParams(location.search).has('intro')?<React.Suspense fallback={<p>Preparing SPX City 2.0…</p>}><Cinematic/></React.Suspense>:new URLSearchParams(location.search).has('proof')?<React.Suspense fallback={<p>Rendering architecture comparison…</p>}><VisualProof/></React.Suspense>:new URLSearchParams(location.search).has('catalogue')?<React.Suspense fallback={<p>Building silhouette catalogue…</p>}><Catalogue/></React.Suspense>:<App/>);
