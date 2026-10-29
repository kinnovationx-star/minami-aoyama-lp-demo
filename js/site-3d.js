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
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',logarithmicDepthBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setClearColor(0x000000,0);
 host.append(renderer.domElement);fig.classList.add('is-3d');

 const scene=new THREE.Scene();
 scene.fog=new THREE.Fog('#2b2a36',260,720);
 const camera=new THREE.PerspectiveCamera(30,1,.3,7000);

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

 /* ---- 遠景のスカイライン（簡略化した街並み）とランドマーク ---- */
 {const P=[],N=[],U=[],RP=[],RN=[];
  function prism(cx,cz,ring,y0,y1){ // ring: [[x,z],...] 反時計回り
   for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];
    const ax=cx+a[0],az=cz+a[1],bx=cx+b[0],bz=cz+b[1],len=Math.hypot(bx-ax,bz-az);
    const nx=(bz-az)/len,nz=-(bx-ax)/len;
    const q=[[ax,y0,az,0,y0],[bx,y0,bz,len,y0],[bx,y1,bz,len,y1],[ax,y0,az,0,y0],[bx,y1,bz,len,y1],[ax,y1,az,0,y1]];
    q.forEach(v=>{P.push(v[0],v[1],v[2]);N.push(nx,0,nz);U.push(v[3],v[4])})}
   for(let i=1;i<ring.length-1;i++)[ring[0],ring[i],ring[i+1]].forEach(v=>{RP.push(cx+v[0],y1,cz+v[1]);RN.push(0,1,0)})}
  const rect=(w,d,r)=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>[x*Math.cos(r)-z*Math.sin(r),x*Math.sin(r)+z*Math.cos(r)]);
  const ngon=(rad,n)=>Array.from({length:n},(_,i)=>{const a=-i/n*Math.PI*2;return[Math.cos(a)*rad,Math.sin(a)*rad]});
  let sd=11;const R=()=>(sd=(sd*16807)%2147483647)/2147483647;
  for(let i=0;i<950;i++){const r=520+Math.pow(R(),.85)*1350,a=R()*Math.PI*2,x=Math.sin(a)*r,z=Math.cos(a)*r;
   const h=10+Math.pow(R(),2.4)*(r>900?85:55);prism(x,z,rect(14+R()*26,14+R()*26,R()*Math.PI),0,h)}
  const tower=(lon,lat,ring,h)=>{const [x,z]=toXZ(lon,lat);prism(x,z,ring,0,h);return[x,z]};
  const mori=tower(139.7292,35.6604,ngon(40,14),228);prism(mori[0],mori[1],ngon(32,14),228,240);
  const mid=tower(139.7314,35.6655,rect(62,44,.3),200);prism(mid[0],mid[1],rect(50,34,.3),200,248);
  [[139.6917,35.6896,243],[139.6950,35.6915,223],[139.6940,35.6930,210],[139.6975,35.6890,200]].forEach(([lo,la,h])=>tower(lo,la,rect(52,42,.2),h));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(RP,3));rg.setAttribute('normal',new THREE.Float32BufferAttribute(RN,3));
  scene.add(new THREE.Mesh(g,wallMat),new THREE.Mesh(rg,roofMat));
  /* 航空障害灯 */
  const red=new THREE.MeshBasicMaterial({color:'#ff4a3a'});
  [[mori,241],[mid,249]].forEach(([p,h])=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1.6,8,8),red);m.position.set(p[0],h,p[1]);scene.add(m)});
 }

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

 /* ---- 3つの視点をスライドで切り替え ---- */
 const SLIDES=[
  {en:'EXTERIOR',jp:'南青山の街並みに建つ、邸宅のイメージ',fog:[340,2700]},
  {en:'ROOFTOP VIEW',jp:'屋上から望む、青山の夕景',fog:[300,3000]},
  {en:'AERIAL',jp:'南青山三丁目を、俯瞰する',fog:[260,900]}];
 house.updateMatrixWorld(true);
 const roofEye=house.localToWorld(new THREE.Vector3(2.6,21,1.2)); // 眺望イメージの視点（屋上テラス）
 const viewDir=Math.atan2(1280,170); // 六本木ヒルズ・東京ミッドタウン方面（東南東）
 /* 眺望スライド用の手すり（視点の手前に置く） */
 const rail=new THREE.Group();
 {const glass=new THREE.Mesh(new THREE.BoxGeometry(9,1.05,.04),M.glass),top=new THREE.Mesh(new THREE.BoxGeometry(9,.06,.12),new THREE.MeshStandardMaterial({color:'#6b5338',roughness:.35,metalness:.7}));
  glass.position.y=.52;top.position.y=1.08;const deck=new THREE.Mesh(new THREE.BoxGeometry(9,.12,3.2),new THREE.MeshStandardMaterial({color:'#7d6a58',roughness:.8}));deck.position.set(0,-.06,-1.6);
  rail.add(glass,top,deck);
  const d=2.4;rail.position.set(roofEye.x+Math.sin(viewDir)*d,roofEye.y-1.62,roofEye.z+Math.cos(viewDir)*d);rail.rotation.y=viewDir;rail.visible=false;scene.add(rail)} // 六本木ヒルズ・東京ミッドタウン方面（東南東）
 let current=0,yaw=0,tYaw=0,since=0,clock=0,trans=1,from=null,dragging=false,downX=0,lastX=0,downT=0,visible=false,raf=0,lastT=performance.now(),pausedUntil=0;
 function view(i,t){const mobile=host.clientWidth<600,v={pos:new THREE.Vector3(),target:new THREE.Vector3(),fov:30};
  if(i===0){const a=Math.PI/4+.42+yaw,r=46;v.pos.set(Math.sin(a)*r,mobile?12:11,Math.cos(a)*r);v.target.set(0,mobile?7:7.5,0);v.fov=mobile?50:32}
  else if(i===1){const a=viewDir+yaw*.8+Math.sin(t*.12)*.05;v.pos.copy(roofEye);v.target.set(roofEye.x+Math.sin(a)*300,-18,roofEye.z+Math.cos(a)*300);v.fov=mobile?70:58}
  else{const a=Math.PI/4+.5+t*.07+yaw,r=mobile?66:54,pt=.38;v.pos.set(Math.sin(a)*r*Math.cos(pt),5.5+r*Math.sin(pt),Math.cos(a)*r*Math.cos(pt));v.target.set(0,5.5,0);v.fov=30}
  return v}
 const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
 function apply(){const v=view(current,clock);
  if(trans<1&&from){const k=ease(trans);v.pos.lerpVectors(from.pos,v.pos,k);v.target.lerpVectors(from.target,v.target,k);v.fov=from.fov+(v.fov-from.fov)*k}
  camera.position.copy(v.pos);camera.lookAt(v.target);if(camera.fov!==v.fov){camera.fov=v.fov;camera.updateProjectionMatrix()}
  const f=SLIDES[current].fog;scene.fog.near+=(f[0]-scene.fog.near)*.08;scene.fog.far+=(f[1]-scene.fog.far)*.08;
  rail.visible=current===1&&trans>.55;wallMat.emissiveIntensity+=((current===1?.55:.2)-wallMat.emissiveIntensity)*.08}
 function draw(){apply();renderer.render(scene,camera)}

 /* UI */
 const tag=fig.querySelector('.site3d-tag'),hint=fig.querySelector('.site3d-hint');
 const ui=document.createElement('div');ui.className='site3d-ui';
 ui.innerHTML=`<button class="site3d-arrow prev" type="button" aria-label="前の視点">←</button><div class="site3d-dots">${SLIDES.map((s,i)=>`<button type="button" aria-label="${s.jp}"><span>${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div><button class="site3d-arrow next" type="button" aria-label="次の視点">→</button>`;
 fig.append(ui);
 const dots=[...ui.querySelectorAll('.site3d-dots button')];
 function label(){tag.innerHTML=`<span>${SLIDES[current].en}</span><b>${SLIDES[current].jp}</b>`;dots.forEach((d,i)=>d.setAttribute('aria-current',String(i===current)));fig.dataset.view=current}
 function go(i,user){i=(i+SLIDES.length)%SLIDES.length;if(i===current)return;const v=view(current,clock);
  from={pos:camera.position.clone(),target:v.target.clone(),fov:camera.fov};
  if(trans<1){const d=new THREE.Vector3();camera.getWorldDirection(d);from.target.copy(camera.position).addScaledVector(d,from.pos.distanceTo(v.target))}
  current=i;yaw=tYaw=0;trans=0;since=0;if(user)pausedUntil=clock+14;label();
  if(reduce.matches){trans=1;draw()}}
 ui.querySelector('.prev').addEventListener('click',e=>{e.stopPropagation();go(current-1,true)});
 ui.querySelector('.next').addEventListener('click',e=>{e.stopPropagation();go(current+1,true)});
 dots.forEach((d,i)=>d.addEventListener('click',e=>{e.stopPropagation();go(i,true)}));
 fig.addEventListener('pointerdown',e=>{if(e.target.closest('.site3d-ui'))return;dragging=true;downX=lastX=e.clientX;downT=performance.now();fig.setPointerCapture(e.pointerId)});
 fig.addEventListener('pointermove',e=>{if(!dragging)return;tYaw-=(e.clientX-lastX)*.006;tYaw=current===2?tYaw:clamp(tYaw,-.8,.8);lastX=e.clientX;pausedUntil=clock+14;if(!raf)draw()});
 ['pointerup','pointercancel'].forEach(t=>fig.addEventListener(t,e=>{if(!dragging)return;dragging=false;
  const dx=e.clientX-downX;if(e.pointerType==='touch'&&Math.abs(dx)>70&&performance.now()-downT<380){tYaw=yaw;go(current+(dx<0?1:-1),true)}}));
 fig.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(current+1,true);if(e.key==='ArrowLeft')go(current-1,true)});

 function loop(t){raf=0;if(!visible)return;const dt=Math.min(.05,(t-lastT)/1000);lastT=t;
  if(!reduce.matches){clock+=dt;since+=dt}
  if(trans<1)trans=Math.min(1,trans+dt/1.8);
  yaw+=(tYaw-yaw)*.12;
  if(!reduce.matches&&!dragging&&since>7.5&&clock>pausedUntil)go(current+1,false);
  draw();raf=requestAnimationFrame(loop)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()}
 new ResizeObserver(resize).observe(host);
 new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible&&!raf){lastT=performance.now();raf=requestAnimationFrame(loop)}},{rootMargin:'100px'}).observe(fig);
 label();resize();
}
