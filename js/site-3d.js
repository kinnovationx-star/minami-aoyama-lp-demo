import * as THREE from '../vendor/three.module.js';

/* 物件概要の3Dイメージ
   夕景の南青山（航空写真＋OpenStreetMapの建物）に、計画イメージの邸宅を配置する。
   ※ 敷地の正確な位置・形状は非公開のため、位置・建物ともにイメージ。 */

const fig=document.querySelector('#site3d');
const host=fig&&fig.querySelector('.site3d-canvas');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const SITE={lon:139.7161,lat:35.6644};
const LAT0=SITE.lat*Math.PI/180,MX=111320*Math.cos(LAT0),MZ=110540;
const toXZ=(lon,lat)=>[(lon-SITE.lon)*MX,-(lat-SITE.lat)*MZ];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function webgl(){try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}}
if(fig&&host&&webgl())init();

function init(){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setClearColor(0x000000,0);
 host.append(renderer.domElement);fig.classList.add('is-3d');

 const scene=new THREE.Scene();
 scene.fog=new THREE.Fog('#2b2a36',260,720);
 const camera=new THREE.PerspectiveCamera(30,1,1,3000);

 /* ---- 光（夕景） ---- */
 scene.add(new THREE.HemisphereLight('#7f8db3','#3a2c26',.9));
 const sun=new THREE.DirectionalLight('#ffb27a',2.2);
 sun.position.set(-160,70,-40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:10,far:500});
 sun.shadow.bias=-.0005;sun.shadow.normalBias=.4;scene.add(sun);
 const rim=new THREE.DirectionalLight('#9fb6ff',.55);rim.position.set(120,90,140);scene.add(rim);

 /* ---- 地面：高精細航空写真（z18） ---- */
 const n18=2**18,tlon=x=>x/n18*360-180,tlat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n18)))*180/Math.PI;
 const [gx0,gz0]=toXZ(tlon(232802),tlat(103236)),[gx1,gz1]=toXZ(tlon(232814),tlat(103248));
 const groundTex=new THREE.TextureLoader().load('assets/geo/aoyama-aerial-z18.jpg',()=>draw());
 groundTex.colorSpace=THREE.SRGBColorSpace;groundTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(gx1-gx0,gz1-gz0),new THREE.MeshStandardMaterial({map:groundTex,color:'#b3b2bf',roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.set((gx0+gx1)/2,0,(gz0+gz1)/2);ground.receiveShadow=true;scene.add(ground);
 const under=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshBasicMaterial({color:'#262632'}));
 under.rotation.x=-Math.PI/2;under.position.y=-.2;scene.add(under);

 /* ---- 周辺の街並み（夕景の窓明かり） ---- */
 const win=document.createElement('canvas');win.width=win.height=256;
 const w=win.getContext('2d');w.fillStyle='#262b33';w.fillRect(0,0,256,256);
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){const lit=rnd()<.24,b=rnd();
  w.fillStyle=lit?`rgba(255,${190+b*40|0},${120+b*50|0},${.75+b*.25})`:'#141a24';
  w.fillRect(x*64+12,y*64+14,40,34);w.fillStyle='#3a404a';w.fillRect(x*64+8,y*64+56,48,3)}
 const winTex=new THREE.CanvasTexture(win);winTex.colorSpace=THREE.SRGBColorSpace;winTex.wrapS=winTex.wrapT=THREE.RepeatWrapping;winTex.repeat.set(1/4.4,1/12.8);
 const wallMat=new THREE.MeshStandardMaterial({map:winTex,emissiveMap:winTex,emissive:'#ffffff',emissiveIntensity:.2,color:'#6f7888',roughness:.85});
 const roofMat=new THREE.MeshStandardMaterial({color:'#343944',roughness:.95});
 const edgeMat=new THREE.LineBasicMaterial({color:'#7b8496',transparent:true,opacity:.28});

 fetch('assets/geo/aoyama-buildings.json').then(r=>r.json()).then(data=>{
  const walls={p:[],n:[],u:[]},roofs={p:[],n:[]},edges=[];
  data.features.forEach(f=>{if(f.points.length<4)return;
   const pts=f.points.map(p=>toXZ(p[0],p[1]));
   const cx=pts.reduce((a,p)=>a+p[0],0)/pts.length,cz=pts.reduce((a,p)=>a+p[1],0)/pts.length;
   const d=Math.hypot(cx,cz);if(d<15||d>520)return; // 敷地の建物は除き、周辺のみ
   const shape=new THREE.Shape();pts.forEach((p,i)=>i?shape.lineTo(p[0],-p[1]):shape.moveTo(p[0],-p[1]));
   let g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(3,f.height),bevelEnabled:false});
   g.rotateX(-Math.PI/2);if(g.index)g=g.toNonIndexed();
   const P=g.attributes.position.array,N=g.attributes.normal.array,U=g.attributes.uv.array;
   g.groups.forEach(gr=>{for(let i=gr.start;i<gr.start+gr.count;i++){
    if(gr.materialIndex===1){walls.p.push(P[i*3],P[i*3+1],P[i*3+2]);walls.n.push(N[i*3],N[i*3+1],N[i*3+2]);walls.u.push(U[i*2],U[i*2+1])}
    else{roofs.p.push(P[i*3],P[i*3+1],P[i*3+2]);roofs.n.push(N[i*3],N[i*3+1],N[i*3+2])}}});
   const e=new THREE.EdgesGeometry(g,30).attributes.position.array;for(let i=0;i<e.length;i++)edges.push(e[i]);
   g.dispose()});
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(walls.p,3));wg.setAttribute('normal',new THREE.Float32BufferAttribute(walls.n,3));wg.setAttribute('uv',new THREE.Float32BufferAttribute(walls.u,2));
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(roofs.p,3));rg.setAttribute('normal',new THREE.Float32BufferAttribute(roofs.n,3));
  const wm=new THREE.Mesh(wg,wallMat),rm=new THREE.Mesh(rg,roofMat);[wm,rm].forEach(m=>{m.castShadow=true;m.receiveShadow=true;scene.add(m)});
  const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));scene.add(new THREE.LineSegments(eg,edgeMat));
  draw();
 }).catch(()=>{});

 /* ---- 計画イメージの邸宅 ---- */
 const house=new THREE.Group();house.rotation.y=Math.PI/4; // 正面を南東（前面道路側）へ
 scene.add(house);
 const M={
  granite:new THREE.MeshStandardMaterial({color:'#2c2b2d',roughness:.45,metalness:.15}),
  stone:new THREE.MeshStandardMaterial({color:'#e6dccb',roughness:.65}),
  slab:new THREE.MeshStandardMaterial({color:'#f6f2ea',roughness:.5}),
  wood:new THREE.MeshStandardMaterial({color:'#8a5a34',roughness:.55}),
  glow:new THREE.MeshStandardMaterial({color:'#5a3a22',emissive:'#ffad57',emissiveIntensity:1.05,roughness:.25}),
  glowSoft:new THREE.MeshStandardMaterial({color:'#4a3426',emissive:'#ffbf78',emissiveIntensity:.62,roughness:.25}),
  glass:new THREE.MeshStandardMaterial({color:'#bcd2ee',transparent:true,opacity:.28,roughness:.05,metalness:.2,depthWrite:false}),
  leaf:new THREE.MeshStandardMaterial({color:'#3e5a3a',roughness:.9,flatShading:true}),
  trunk:new THREE.MeshStandardMaterial({color:'#4a3626',roughness:1}),
  pave:new THREE.MeshStandardMaterial({color:'#b9b1a3',roughness:.9})};
 const gold=new THREE.LineBasicMaterial({color:'#e7cf98',transparent:true,opacity:.85});
 function box(w,h,d,mat,x,y,z,opt={}){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y+h/2,z);m.castShadow=opt.cast!==false;m.receiveShadow=true;house.add(m);
  if(opt.edge){const l=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),gold);l.position.copy(m.position);house.add(l)}return m}
 /* 敷地（間口約11.3m × 奥行約13.5m） */
 box(11.3,.08,13.5,M.pave,0,0,0,{cast:false});
 const lot=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-5.65,6.75],[5.65,6.75],[5.65,-6.75],[-5.65,-6.75]].map(p=>new THREE.Vector3(p[0],.12,p[1]))),new THREE.LineBasicMaterial({color:'#e7cf98'}));house.add(lot);
 /* 1F：御影石のベース＋ガラスのエントランス */
 box(9.6,3.4,9.4,M.granite,0,0,-1.1,{edge:true});
 box(7.2,2.6,.06,M.glow,.6,.35,3.62,{cast:false});
 box(.5,3.4,.5,M.granite,-3.9,0,3.85);
 /* 2F：トラバーチンのキャンチレバー＋水平連窓 */
 box(10.4,.38,10.2,M.slab,.2,3.4,-.7,{edge:true});
 box(10.0,3.0,9.6,M.stone,.2,3.78,-1.0,{edge:true});
 box(8.4,1.9,.06,M.glow,.4,4.3,3.82,{cast:false});
 box(.06,1.9,6.2,M.glowSoft,5.22,4.3,-1.6,{cast:false});
 /* 3F：セットバック＋木製ルーバー */
 box(10.6,.36,10.0,M.slab,.2,6.78,-.6,{edge:true});
 box(8.0,3.0,7.4,M.glowSoft,-.6,7.14,-1.9);
 for(let i=0;i<14;i++)box(.14,3.0,.32,M.wood,-4.4+i*.6,7.14,2.0);
 box(3.0,3.0,7.4,M.stone,4.1,7.14,-1.9,{edge:true});
 /* 屋上：スラブ＋ガラス手すり＋パーゴラ */
 box(9.2,.34,8.4,M.slab,-.2,10.14,-1.6,{edge:true});
 box(10.2,1.05,.05,M.glass,.2,7.14,4.15,{cast:false});
 box(8.6,1.05,.05,M.glass,-.2,10.48,2.55,{cast:false});
 for(let i=0;i<6;i++)box(.12,.18,4.2,M.wood,-3.4+i*1.2,12.4,-.4);
 box(.16,2.0,.16,M.granite,-3.6,10.48,1.6);box(.16,2.0,.16,M.granite,3.0,10.48,1.6);
 /* ガラスの方立て（ブロンズ） */
 const bronze=new THREE.MeshStandardMaterial({color:'#3b2f25',roughness:.4,metalness:.6});
 function mullions(x0,x1,y,h,z,step){for(let x=x0;x<=x1+.001;x+=step)box(.07,h,.09,bronze,x,y,z,{cast:false})}
 mullions(-3.0,4.2,.35,2.6,3.68,1.2);
 box(7.3,.08,.1,bronze,.6,1.55,3.68,{cast:false});
 mullions(-3.8,4.6,4.3,1.9,3.88,1.05);
 for(let z=-4.6;z<=1.5;z+=1.25){const m=box(.09,1.9,.07,bronze,5.27,4.3,z,{cast:false})}
 /* 植栽とアッパーライト */
 function tree(x,z,s){const t=new THREE.Mesh(new THREE.CylinderGeometry(.08*s,.12*s,1.6*s,6),M.trunk);t.position.set(x,.8*s,z);t.castShadow=true;house.add(t);
  const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.1*s,1),M.leaf);c.position.set(x,2.1*s,z);c.scale.y=1.15;c.castShadow=true;house.add(c);
  const up=new THREE.PointLight('#ffcf8f',6,6,2);up.position.set(x,.3,z+.4);house.add(up)}
 tree(-4.6,5.4,1.15);tree(4.6,5.2,.95);tree(-4.9,-6.0,.9);tree(4.7,-5.8,1.0);
 /* 室内の明かり（周囲の地面を照らす） */
 [[0,1.8,3.2,16],[0,5.4,3.4,14],[-.6,8.6,1.4,10]].forEach(([x,y,z,i])=>{const l=new THREE.PointLight('#ffb870',i,22,2);l.position.set(x,y,z);house.add(l)});
 /* 足元のやわらかな光 */
 const gc=document.createElement('canvas');gc.width=gc.height=128;const g2=gc.getContext('2d'),gr=g2.createRadialGradient(64,64,0,64,64,64);
 gr.addColorStop(0,'rgba(255,196,130,.55)');gr.addColorStop(1,'rgba(255,196,130,0)');g2.fillStyle=gr;g2.fillRect(0,0,128,128);
 const halo=new THREE.Mesh(new THREE.PlaneGeometry(34,34),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(gc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
 halo.rotation.x=-Math.PI/2;halo.position.y=.15;house.add(halo);

 /* ---- カメラ操作（自動回転＋ドラッグ） ---- */
 let angle=Math.PI/4+.5,targetAngle=angle,pitch=.38,dragging=false,lastX=0,lastT=performance.now(),visible=false,raf=0;
 const target=new THREE.Vector3(0,5.5,0);
 fig.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;fig.setPointerCapture(e.pointerId)});
 fig.addEventListener('pointermove',e=>{if(!dragging)return;targetAngle-=(e.clientX-lastX)*.008;lastX=e.clientX;draw()});
 ['pointerup','pointercancel'].forEach(t=>fig.addEventListener(t,()=>{dragging=false}));

 function place(){const mobile=host.clientWidth<600,r=mobile?66:54;
  camera.position.set(target.x+Math.sin(angle)*r*Math.cos(pitch),target.y+r*Math.sin(pitch),target.z+Math.cos(angle)*r*Math.cos(pitch));
  camera.lookAt(target)}
 function draw(){place();renderer.render(scene,camera)}
 function loop(t){raf=0;if(!visible)return;const dt=Math.min(.05,(t-lastT)/1000);lastT=t;
  if(!dragging&&!reduce.matches)targetAngle+=dt*.07;
  angle+=(targetAngle-angle)*.12;draw();raf=requestAnimationFrame(loop)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()}
 new ResizeObserver(resize).observe(host);
 new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible&&!raf){lastT=performance.now();raf=requestAnimationFrame(loop)}},{rootMargin:'100px'}).observe(fig);
 resize();
}
