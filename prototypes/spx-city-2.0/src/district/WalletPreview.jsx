import React, {useState} from 'react';

// Match City 1.0: request a preview only for the selected wallet, never on hover.
export default function WalletPreview({address}) {
 const [failed,setFailed]=useState(false);
 if(!/^0x[0-9a-f]{40}$/i.test(address||''))return null;
 const hex=address.slice(2),label=`${address.slice(0,6)}…${address.slice(-4)}`;
 return <a className="district-zerion" href={`https://app.zerion.io/${address}/overview`} target="_blank" rel="noopener noreferrer" aria-label={`Open wallet ${label} in Zerion (new tab)`}>
  <div className="district-zerion-preview" style={{background:`linear-gradient(135deg,#${hex.slice(0,6)},#${hex.slice(6,12)},#${hex.slice(12,18)})`}}>
   {!failed&&<img src={`https://render.zerion.io/preview?address=${address}`} alt="Zerion wallet portfolio preview" onError={()=>setFailed(true)}/>}
   <span>{label}</span>
  </div>
  <div className="district-zerion-link">Open in Zerion <span aria-hidden="true">↗</span></div>
 </a>;
}
