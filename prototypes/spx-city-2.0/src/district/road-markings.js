// Crossings follow the four sidewalk approaches, leaving junction centers clear.
export function roadMarkings(layout){
 const {cols,rows,cellW,cellD,road,sidewalk}=layout,left=-cols*cellW/2,markings=[],crossings=[];
 const stripeDepth=sidewalk*.8,offset=road/2+sidewalk/2,count=Math.max(5,Math.round(road/.3)),pitch=road/count,stripeWidth=pitch*.62;
 const crossing=(x,z,axis)=>{const stripes=Array.from({length:count},(_,i)=>{const t=-road/2+(i+.5)*pitch;return axis==='x'?{x:x+t,z,w:stripeWidth,d:stripeDepth}:{x,z:z+t,w:stripeDepth,d:stripeWidth};});crossings.push({x,z,axis,stripes});markings.push(...stripes.map(s=>({...s,type:'zebra'})));};
 for(let c=0;c<=cols;c++)for(let r=0;r<=rows;r++){
  const x=left+c*cellW,z=r*cellD;
  if(c>0&&c<cols){if(r>0)crossing(x,z-offset,'x');if(r<rows)crossing(x,z+offset,'x');}
  if(r>0&&r<rows){if(c>0)crossing(x-offset,z,'z');if(c<cols)crossing(x+offset,z,'z');}
 }
 const margin=road/2+sidewalk+.45;
 for(let c=0;c<=cols;c++)for(let r=0;r<rows;r++)for(let d=margin+.4;d<cellD-margin-.4;d+=2)markings.push({x:left+c*cellW,z:r*cellD+d,w:.035,d:.8,type:'lane'});
 for(let r=0;r<=rows;r++)for(let c=0;c<cols;c++)for(let d=margin+.4;d<cellW-margin-.4;d+=2)markings.push({x:left+c*cellW+d,z:r*cellD,w:.8,d:.035,type:'lane'});
 return {crossings,markings};
}
