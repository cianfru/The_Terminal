export function segmentDistance(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;const t=l?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l)):0;return Math.hypot(x-ax-t*dx,z-az-t*dz);}
export function clearOfPath(p,points,clearance){return points.every((v,i)=>!i||segmentDistance(p[0],p[1],points[i-1].x,points[i-1].z,v.x,v.z)>=clearance);}
