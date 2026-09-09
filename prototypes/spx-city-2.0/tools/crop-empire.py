# Extract the central landmark from the source's surrounding city block.
import json,struct,sys
b=open(sys.argv[1],'rb').read();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);base=28+n
prim=j['meshes'][0]['primitives'][0]
def read(idx,fmt):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];o=base+v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',struct.calcsize(fmt));return [struct.unpack_from(fmt,b,o+i*stride) for i in range(a['count'])]
p=read(prim['attributes']['POSITION'],'<fff');a=j['accessors'][prim['indices']];inds=[x[0]for x in read(prim['indices'],'<I' if a['componentType']==5125 else '<H')]
inside=lambda q:-1.55<=q[0]<=1.45 and -1.12<=q[1]<=1.02 and q[2]<=.05
tri=[inds[i:i+3]for i in range(0,len(inds),3) if all(inside(p[k]) for k in inds[i:i+3])]
used=sorted({k for t in tri for k in t});mapping={k:i for i,k in enumerate(used)};points=[p[k]for k in used];index=[mapping[k]for t in tri for k in t]
pb=b''.join(struct.pack('<fff',*q)for q in points);ib=struct.pack('<'+'I'*len(index),*index);binary=pb+ib
out={'asset':{'version':'2.0','generator':'SPX City crop; Brian Trepanier CC BY 4.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'rotation':j['nodes'][0]['rotation'],'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1}]}],'buffers':[{'byteLength':len(binary)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(pb)},{'buffer':0,'byteOffset':len(pb),'byteLength':len(ib)}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(points),'type':'VEC3','min':[min(q[i]for q in points)for i in range(3)],'max':[max(q[i]for q in points)for i in range(3)]},{'bufferView':1,'componentType':5125,'count':len(index),'type':'SCALAR'}]}
s=json.dumps(out,separators=(',',':')).encode();s+=b' '*(-len(s)%4);open(sys.argv[2],'wb').write(struct.pack('<III',0x46546c67,2,28+len(s)+len(binary))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(binary),0x004e4942)+binary);print(len(tri),'triangles',len(binary),'bytes')
