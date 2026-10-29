import * as THREE from '../vendor/three.module.js';

/* 青山の航空写真ストーリー
   - 地面：国土地理院の航空写真（同梱）。広域=z16、物件周辺=z18の高精細画像を重ねる
   - 建物：OpenStreetMapの形状を白い模型調で立体化（影・輪郭線つき）
   - ラベル：HTMLで重ね、重なりは優先度順に間引く
   - WebGLが使えない環境では、同じ写真とラベルを平面地図で表示する */

const section=document.querySelector('#location'),stage=section.querySelector('.aerial-stage'),host=stage.querySelector('.aerial-canvas'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

const zoom=16,n=2**zoom,lat0=35.6654,lon0=139.7142,meters=40075016.686*Math.cos(lat0*Math.PI/180)/n;
function tile(lon,lat){return[(lon+180)/360*n,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n]}
const center=tile(lon0,lat0),tx=Math.floor(center[0]),ty=Math.floor(center[1]),count=9,half=count*meters/2;
const originX=tx-Math.floor(count/2),originY=ty-Math.floor(count/2); // 広域画像の左上タイル(z16)
/* 高精細画像（z18 タイル 232802..232813 × 103236..103247）を z16 座標で表したもの */
const DETAIL={x0:232802/4,y0:103236/4,x1:232814/4,y1:103248/4,src:'assets/geo/aoyama-aerial-z18.jpg'};
function point(lon,lat,y=0){const t=tile(lon,lat);return new THREE.Vector3((t[0]-(tx+.5))*meters,y,(t[1]-(ty+.5))*meters)}

const STATION={lon:139.7123934,lat:35.6652299},SITE={lon:139.7161,lat:35.6644};
const FILTER='saturate(1.28) contrast(1.06) brightness(1.04)';
let renderer,scene,camera,mapTexture,buildings,ready=false,progress=0,scheduled=false,active=-1;

/* ---- ラベル ---- */
/* 地図アイコン（Apple マップ風）。色とアイコンは種別ごと */
const ICON={
 home:'<path d="M12 4 3.5 11H6v8h4.5v-5h3v5H18v-8h2.5z"/>',
 train:'<path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-2.2 2.9L19.5 20h-2.3l-1.5-3H8.3l-1.5 3H4.5l1.7-3.1A3 3 0 0 1 4 14V6a3 3 0 0 1 3-3zm-.5 3.5v4h11v-4zm1.8 6.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm7.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/>',
 school:'<path d="M12 4 1.5 9.5 12 15l8.5-4.4V16H22V9.5zM5.5 12.9V16c1.7 1.7 4 2.6 6.5 2.6s4.8-.9 6.5-2.6v-3.1L12 16.3z"/>',
 med:'<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>',
 shop:'<path d="M7 8V7a5 5 0 0 1 10 0v1h3l-1.2 12.5H5.2L4 8zm2 0h6V7a3 3 0 0 0-6 0z"/>',
 park:'<path d="M12 2.5c3.3 0 5.6 2.5 5.6 5.5a5.6 5.6 0 0 1-1 3.2A4.6 4.6 0 0 1 14 19.6h-1V22h-2v-2.4h-1A4.6 4.6 0 0 1 7.4 11.2a5.6 5.6 0 0 1-1-3.2c0-3 2.3-5.5 5.6-5.5z"/>',
 pub:'<path d="M12 2.5 3 7v2h18V7zM5 10.5h2.5v7H5zm5.75 0h2.5v7h-2.5zm5.75 0H19v7h-2.5zM3 19h18v2.5H3z"/>'};
const CATS={
 home:{color:'#c9a45c'},
 train:{color:'#3f7fe0'},
 school:{color:'#d9853b'},
 med:{color:'#e5534b'},
 shop:{color:'#e2a72e'},
 park:{color:'#3fae5a'},
 pub:{color:'#7d8ea3'}};
/* 位置はOpenStreetMap（© OpenStreetMap contributors）の登録位置。上から優先して表示 */
const POIS=[
 ['南青山三丁目','home',SITE.lon,SITE.lat],
 ['表参道駅','train',STATION.lon,STATION.lat],
 ['外苑前駅','train',139.717882,35.670465],
 ['乃木坂駅','train',139.726342,35.666699],
 ['港区立青南小学校','school',139.715947,35.663468],
 ['港区立青山中学校','school',139.722425,35.674037],
 ['港区立青山小学校','school',139.718957,35.67005],
 ['表参道ヒルズ','shop',139.708868,35.667256],
 ['成城石井','shop',139.716564,35.669441],
 ['伊藤病院','med',139.710645,35.666294],
 ['都立青山公園','park',139.725199,35.663614],
 ['外苑前郵便局','pub',139.716493,35.66921],
 ['表参道交番','pub',139.712355,35.66546],
 ['青南いきいきプラザ','pub',139.717323,35.666461],
 ['南青山保育園','school',139.718339,35.664993],
 ['青南幼稚園','school',139.716993,35.663516],
 ['都立青山高校','school',139.715787,35.672569],
 ['青山学院','school',139.710435,35.660125],
 ['北青山病院','med',139.71005,35.664821],
 ['赤坂消防署','pub',139.720882,35.668987],
 ['南青山三丁目緑地','park',139.716913,35.667865],
 ['南青山四丁目緑地','park',139.720403,35.665821]
].map(([name,cat,lon,lat])=>({name,cat,lon,lat,type:'poi',chapters:[2]}));
const labelDefs=[
 {name:'南青山三丁目',en:'',sub:'物件所在エリア',lon:SITE.lon,lat:SITE.lat,type:'primary',chapters:[1]},
 {name:'表参道駅',en:'',sub:'銀座線・半蔵門線・千代田線',lon:STATION.lon,lat:STATION.lat,type:'station',chapters:[1]},
];

const layer=stage.querySelector('.aerial-labels');
const labels=labelDefs.map((d,i)=>{const el=document.createElement('div');
 el.className=`geo-label ${d.type}${d.cat==='home'?' poi-home':''}`;
 if(d.type==='station')el.innerHTML=`<i class="pin"></i><span>${d.en?`<em>${d.en}</em>`:''}${d.name}</span><small>${d.sub}</small>`;
 else if(d.type==='primary')el.innerHTML=`<span>${d.en?`<em>${d.en}</em>`:''}${d.name}</span><small>${d.sub}</small>`;
 else if(d.type==='poi'){el.style.setProperty('--c',CATS[d.cat].color);el.innerHTML=`<i class="poi-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[d.cat]}</svg></i><span class="poi-name">${d.name}</span>`}
 else el.innerHTML=`<span>${d.name}</span>`;
 layer.append(el);
 return{...d,el,priority:i,pos:point(d.lon,d.lat,d.type==='area'?40:d.type==='poi'?14:22)}});

/* 駅→三丁目の線と距離 */
const svgNS='http://www.w3.org/2000/svg';
const route=document.createElementNS(svgNS,'svg');
route.setAttribute('class','geo-route');
route.innerHTML=`<line class="geo-route-glow"/><line class="geo-route-line"/><circle class="geo-route-dot a" r="5"/><circle class="geo-route-dot b" r="5"/>`;
layer.append(route);
const routeGlow=route.querySelector('.geo-route-glow'),routeLine=route.querySelector('.geo-route-line'),dotA=route.querySelector('.a'),dotB=route.querySelector('.b');
const routeLabel=document.createElement('div');
routeLabel.className='geo-route-label';
routeLabel.innerHTML=`<b>徒歩約7分</b><small>約560m（80m／分換算）</small>`;
layer.append(routeLabel);
const stationPos=point(STATION.lon,STATION.lat,8),sitePos=point(SITE.lon,SITE.lat,8);

/* ---- 航空写真の読み込み（同梱画像 → 失敗時のみ国土地理院タイル） ---- */
const canvas=document.createElement('canvas');
canvas.width=canvas.height=count*256;
const ctx=canvas.getContext('2d');
ctx.fillStyle='#263138';ctx.fillRect(0,0,canvas.width,canvas.height);
const detailCanvas=document.createElement('canvas');
detailCanvas.width=detailCanvas.height=3072;
const dctx=detailCanvas.getContext('2d');
let loaded=0,failed=0,detailReady=false,detailTexture,flat=null;
const total=count*count;
function paint(c,im,x,y,w,h){c.save();c.filter=FILTER;c.drawImage(im,x,y,w,h);c.restore()}
function loadRemoteTiles(){loaded=0;failed=0;for(let y=0;y<count;y++)for(let x=0;x<count;x++){const im=new Image();im.crossOrigin='anonymous';
 im.onload=()=>{paint(ctx,im,x*256,y*256,256,256);loaded++;if(mapTexture)mapTexture.needsUpdate=true;status();requestDraw()};
 im.onerror=()=>{failed++;status()};
 im.src=`https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${zoom}/${originX+x}/${originY+y}.jpg`}}
function loadImages(){
 const base=new Image();
 base.onload=()=>{paint(ctx,base,0,0,canvas.width,canvas.height);loaded=total;if(mapTexture)mapTexture.needsUpdate=true;status();requestDraw()};
 base.onerror=loadRemoteTiles;
 base.src='assets/geo/aoyama-aerial-tiles.jpg';
 const detail=new Image();
 detail.onload=()=>{paint(dctx,detail,0,0,3072,3072);detailReady=true;if(detailTexture)detailTexture.needsUpdate=true;
  if(flat){flat.detail.getContext('2d').drawImage(detailCanvas,0,0);flat.detail.style.opacity='1'}requestDraw()};
 detail.src=DETAIL.src}
function status(){const el=stage.querySelector('.aerial-loading');
 if(loaded>total*.7){el.hidden=true;stage.classList.add('map-ready')}
 else if(loaded+failed===total){el.textContent='航空写真の一部を読み込めませんでした。再読み込みしてください。'}
 else el.textContent='AOYAMA / 航空写真を読み込み中'}

/* ---- 3D ---- */
function ring(lon,lat,r,color){const mesh=new THREE.Mesh(new THREE.RingGeometry(r*.84,r,100),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.4,side:THREE.DoubleSide,depthWrite:false}));
 mesh.rotation.x=-Math.PI/2;mesh.position.copy(point(lon,lat,3));scene.add(mesh);return mesh}
let stationRing,siteRing,areaMeshes=[],glow,beam,sun,buildingMat,edgeMat,detailMat;
function webglAvailable(){if(/[?&]flat=1/.test(location.search))return false;try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')))}catch(e){return false}}

try{
 if(!webglAvailable())throw Error('no webgl');
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor('#1a2429');
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 host.append(renderer.domElement);
 scene=new THREE.Scene();scene.fog=new THREE.Fog('#202b30',2600,5600);
 camera=new THREE.PerspectiveCamera(42,1,1,7000);
 const aniso=Math.min(16,renderer.capabilities.getMaxAnisotropy());
 mapTexture=new THREE.CanvasTexture(canvas);mapTexture.colorSpace=THREE.SRGBColorSpace;mapTexture.anisotropy=aniso;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(half*2,half*2),new THREE.MeshBasicMaterial({map:mapTexture}));
 ground.rotation.x=-Math.PI/2;scene.add(ground);
 /* 高精細レイヤー */
 detailTexture=new THREE.CanvasTexture(detailCanvas);detailTexture.colorSpace=THREE.SRGBColorSpace;detailTexture.anisotropy=aniso;
 const dw=(DETAIL.x1-DETAIL.x0)*meters,dh=(DETAIL.y1-DETAIL.y0)*meters;
 detailMat=new THREE.MeshBasicMaterial({map:detailTexture,transparent:true,opacity:0,depthWrite:false});
 const detailPlane=new THREE.Mesh(new THREE.PlaneGeometry(dw,dh),detailMat);
 detailPlane.rotation.x=-Math.PI/2;
 detailPlane.position.set(((DETAIL.x0+DETAIL.x1)/2-(tx+.5))*meters,.4,((DETAIL.y0+DETAIL.y1)/2-(ty+.5))*meters);
 scene.add(detailPlane);
 /* 影を受ける透明な面 */
 const shadowPlane=new THREE.Mesh(new THREE.PlaneGeometry(dw,dh),new THREE.ShadowMaterial({opacity:.32,depthWrite:false}));
 shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.copy(detailPlane.position);shadowPlane.position.y=.8;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
 /* 光 */
 scene.add(new THREE.HemisphereLight('#f4f7fb','#6f6a60',1.55));
 sun=new THREE.DirectionalLight('#fff3df',2.3);
 const sc=point(139.7135,35.6648);
 sun.target.position.copy(sc);sun.position.set(sc.x-520,900,sc.z+360);
 sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
 Object.assign(sun.shadow.camera,{left:-650,right:650,top:650,bottom:-650,near:100,far:2400});
 sun.shadow.bias=-.0004;sun.shadow.normalBias=.6;
 scene.add(sun,sun.target);
 buildings=new THREE.Group();scene.add(buildings);
 buildingMat=new THREE.MeshLambertMaterial({vertexColors:true});
 edgeMat=new THREE.LineBasicMaterial({color:'#6e6a62',transparent:true,opacity:.42});
 stationRing=ring(STATION.lon,STATION.lat,65,'#f5e6c4');
 siteRing=ring(SITE.lon,SITE.lat,120,'#d7c9a4');
 for(const d of [{lon:SITE.lon,lat:SITE.lat,rx:220,rz:250,color:'#b7aa84'},{lon:139.7147,lat:35.6682,rx:310,rz:175,color:'#bdcbd2'},{lon:139.7087,lat:35.6684,rx:245,rz:260,color:'#93b7aa'},{lon:139.7184,lat:35.6622,rx:280,rz:190,color:'#c3b3bf'}]){
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,80),new THREE.MeshBasicMaterial({color:d.color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;mesh.scale.set(d.rx,d.rz,1);mesh.position.copy(point(d.lon,d.lat,5));scene.add(mesh);areaMeshes.push(mesh)}
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
 const gc=glowCanvas.getContext('2d'),gradient=gc.createRadialGradient(64,64,0,64,64,64);
 gradient.addColorStop(0,'rgba(240,254,255,1)');gradient.addColorStop(.12,'rgba(194,239,255,.9)');gradient.addColorStop(.35,'rgba(98,194,255,.45)');gradient.addColorStop(1,'rgba(32,140,255,0)');
 gc.fillStyle=gradient;gc.fillRect(0,0,128,128);
 glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.8}));
 glow.position.copy(point(SITE.lon,SITE.lat,65));glow.scale.set(340,260,1);scene.add(glow);
 beam=new THREE.Mesh(new THREE.CylinderGeometry(2,17,350,24,1,true),new THREE.MeshBasicMaterial({color:'#a7dcff',transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
 beam.position.copy(point(SITE.lon,SITE.lat,175));scene.add(beam);
 ready=true;
}catch(e){ready=false;if(renderer&&renderer.domElement)renderer.domElement.remove()}

/* ---- WebGLが使えない場合の平面地図 ---- */
if(!ready){
 stage.classList.add('fallback-flat');
 const wrap=document.createElement('div');wrap.className='flat-map';
 canvas.className='flat-base';
 const dimg=document.createElement('canvas');dimg.className='flat-detail';
 dimg.width=dimg.height=3072;
 wrap.append(canvas,dimg);host.append(wrap);
 const dx=(DETAIL.x0-originX)*256,dy=(DETAIL.y0-originY)*256,ds=(DETAIL.x1-DETAIL.x0)*256;
 Object.assign(dimg.style,{left:dx+'px',top:dy+'px',width:ds+'px',height:ds+'px',opacity:'0'});
 flat={wrap,detail:dimg};
}
function px(lon,lat){const t=tile(lon,lat);return{x:(t[0]-originX)*256,y:(t[1]-originY)*256}}

loadImages();

/* ---- 建物（白い模型調・1つのメッシュに結合） ---- */
if(ready)fetch('assets/geo/aoyama-buildings.json').then(r=>{if(!r.ok)throw Error('geometry');return r.json()}).then(data=>{
 const pos=[],nor=[],col=[],edges=[];
 const roofC=new THREE.Color('#f3f0ea'),wallA=new THREE.Color('#e4e0d8'),wallB=new THREE.Color('#cfc9be'),tmp=new THREE.Color();
 let num=0;
 data.features.forEach(f=>{if(f.points.length<4)return;
  const shape=new THREE.Shape();
  f.points.forEach((p,i)=>{const v=point(p[0],p[1]);i?shape.lineTo(v.x,-v.z):shape.moveTo(v.x,-v.z)});
  const height=Math.max(3,f.height);
  let g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});
  g.rotateX(-Math.PI/2);
  if(g.index)g=g.toNonIndexed();
  g.computeVertexNormals();
  const P=g.attributes.position.array,N=g.attributes.normal.array;
  const shade=.93+((num*37)%17)/240; // 建物ごとにごくわずかな明暗差
  for(let i=0;i<P.length;i+=3){pos.push(P[i],P[i+1],P[i+2]);nor.push(N[i],N[i+1],N[i+2]);
   if(N[i+1]>.6)tmp.copy(roofC);else tmp.copy(wallB).lerp(wallA,clamp(P[i+1]/height));
   tmp.multiplyScalar(shade);col.push(tmp.r,tmp.g,tmp.b)}
  const e=new THREE.EdgesGeometry(g,25).attributes.position.array;
  for(let i=0;i<e.length;i++)edges.push(e[i]);
  g.dispose();num++});
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 const mesh=new THREE.Mesh(geo,buildingMat);mesh.castShadow=true;mesh.receiveShadow=true;
 const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
 buildings.add(mesh,new THREE.LineSegments(eg,edgeMat));
 stage.dataset.buildings=String(num);requestDraw()
}).catch(()=>{});

const chapters=[
 ['AOYAMA, FROM ABOVE','青山を、見渡す。','街の広がりから、この土地の魅力へ。'],
 ['OMOTESANDO / ACCESS','表参道駅 徒歩約7分','銀座線・半蔵門線・千代田線の3路線。']];

function getProgress(){if(section.dataset.preview)return Number(section.dataset.preview);
 if(reduce.matches)return progress;
 const r=section.getBoundingClientRect();
 return clamp(-r.top/Math.max(1,section.offsetHeight-stage.offsetHeight))}

/* 平面地図の視点：章ごとに中心と倍率を補間 */
function flatView(p,W,H){
 const mobile=W<760,s0=Math.max(W,H)/canvas.width*1.25;
 const st=px(STATION.lon,STATION.lat),si=px(SITE.lon,SITE.lat),c0={x:canvas.width/2,y:canvas.height/2};
 const mid={x:lerp(st.x,si.x,.5),y:lerp(st.y,si.y,.5)};
 const p1=smooth(clamp(p/.7)),p2=0;
 const cx=lerp(lerp(c0.x,mid.x,p1),si.x+(mobile?30:20),p2),cy=lerp(lerp(c0.y,mid.y,p1)-lerp(0,mobile?40:70,p1),si.y-(mobile?130:110),p2);
 const s=s0*lerp(lerp(1,mobile?2.6:2.8,p1),mobile?2.1:2.3,p2);
 return{cx,cy,s}}

function draw(){scheduled=false;progress=getProgress();
 const chapter=progress<.4?0:1;
 if(chapter!==active){active=chapter;stage.dataset.chapter=chapter;
  stage.querySelector('.aerial-kicker').textContent=chapters[chapter][0];
  stage.querySelector('.aerial-title').textContent=chapters[chapter][1];
  stage.querySelector('.aerial-description').textContent=chapters[chapter][2];
  stage.querySelectorAll('[data-geo-chapter]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===chapter)))}
 stage.querySelector('.aerial-progress span').style.width=`${progress*100}%`;
 const visibility=section.getBoundingClientRect();
 if(visibility.top>innerHeight||visibility.bottom<0)return;
 const W=host.clientWidth,H=host.clientHeight,mobile=W<760;
 let proj;
 if(ready){
  const p1=smooth(clamp(progress/.7)),p2=0;
  const mid=stationPos.clone().lerp(sitePos,.55);
  const look1x=lerp(0,mid.x,p1),look1z=lerp(0,mid.z,p1);
  const lookX=lerp(look1x,sitePos.x+(mobile?40:10),p2),lookZ=lerp(look1z,sitePos.z-(mobile?300:150),p2)-lerp(0,mobile?130:210,p1)*(1-p2);
  const height=lerp(lerp(mobile?1600:1800,mobile?1350:620,p1),mobile?3000:1150,p2);
  const distance=lerp(lerp(mobile?850:750,mobile?760:820,p1),mobile?700:520,p2);
  const sway=lerp(-280,140,progress)*(1-p2*.7)*(mobile?.35:1);
  camera.position.set(lookX+sway,height,lookZ+distance);
  camera.lookAt(lookX,0,lookZ);
  scene.fog.near=Math.max(2600,height*1.6);scene.fog.far=scene.fog.near+3000;camera.far=Math.max(7000,height*3);camera.updateProjectionMatrix();
  stationRing.material.opacity=clamp((progress-.15)*3)*.8;
  stationRing.scale.setScalar(1+.16*Math.sin(progress*16));
  siteRing.material.opacity=clamp((progress-.4)*3)*.6;
  siteRing.scale.setScalar(1+.08*Math.sin(progress*20));
  areaMeshes.forEach((m,i)=>m.material.opacity=(i===0?clamp((progress-.4)/.3):clamp((.3-progress)/.3))*.3);
  glow.material.opacity=lerp(.8,.3,p2);
  detailMat.opacity=detailReady?1:0;
  buildings.scale.y=lerp(.75,1.1,p1);
  edgeMat.opacity=lerp(.15,.4,p1);
  renderer.render(scene,camera);
  proj=pos=>{const v=pos.clone().project(camera);return{x:(v.x*.5+.5)*W,y:(-v.y*.5+.5)*H,ok:v.z<1}};
 }else{
  const v=flatView(progress,W,H);
  flat.wrap.style.transform=`translate(${W/2}px,${H/2}px) scale(${v.s}) translate(${-v.cx}px,${-v.cy}px)`;
  proj=d=>{const q=px(d.lon,d.lat);return{x:W/2+(q.x-v.cx)*v.s,y:H/2+(q.y-v.cy)*v.s,ok:true}};
 }
 placeLabels(chapter,proj,W,H);
 /* 駅→三丁目の線 */
 const a=ready?proj(stationPos):proj(STATION),b=ready?proj(sitePos):proj(SITE),showRoute=chapter===1&&a.ok&&b.ok;
 route.style.opacity=showRoute?'1':'0';routeLabel.style.opacity=showRoute?'1':'0';
  if(showRoute){[routeGlow,routeLine].forEach(l=>{l.setAttribute('x1',a.x);l.setAttribute('y1',a.y);l.setAttribute('x2',b.x);l.setAttribute('y2',b.y)});
  dotA.setAttribute('cx',a.x);dotA.setAttribute('cy',a.y);dotB.setAttribute('cx',b.x);dotB.setAttribute('cy',b.y);
  routeLabel.style.transform=`translate(${(a.x+b.x)/2}px,${(a.y+b.y)/2}px) translate(-50%,-50%)`}}

/* ラベル配置：優先度順に置き、見出し・凡例・既存ラベルと重なるものは隠す */
function placeLabels(chapter,proj,W,H){
 const sr=stage.getBoundingClientRect(),boxes=[];
 const block=el=>{if(!el)return;const b=el.getBoundingClientRect();if(!b.width)return;boxes.push({l:b.left-sr.left-10,r:b.right-sr.left+10,t:b.top-sr.top-10,b:b.bottom-sr.top+10})};
 block(stage.querySelector('.aerial-heading'));
 const hit=r=>boxes.some(o=>r.l<o.r&&r.r>o.l&&r.t<o.b&&r.b>o.t);
 for(const d of labels){
  const v=ready?proj(d.pos):proj(d);
  const show=d.chapters.includes(chapter)&&(chapter!==0||stage.classList.contains('map-ready'));
  const poi=d.type==='poi',ic=poi?d.el.firstElementChild.offsetWidth/2:0;
  if(!show||!v.ok||v.x<8||v.x>W-8||v.y<70||v.y>H-100){d.el.style.opacity='0';continue}
  const w=d.el.offsetWidth,h=d.el.offsetHeight;
  let r,flip=false;
  if(poi){r={l:v.x-ic,r:v.x-ic+w,t:v.y-h/2,b:v.y+h/2};
   const alt={l:v.x+ic-w,r:v.x+ic,t:r.t,b:r.b};
   /* 右にはみ出す・重なる場合は名前を左側へ */
   if(r.r>W-4||hit(r)){if(alt.l>=4&&!hit(alt)){r=alt;flip=true}}
   d.el.classList.toggle('flip',flip);
   d.el.style.transform=`translate(${flip?v.x+ic-w:v.x-ic}px,${v.y}px) translate(0,-50%)`;
  }else{r={l:v.x-w/2,r:v.x+w/2,t:v.y-h,b:v.y};d.el.style.transform=`translate(${v.x}px,${v.y}px) translate(-50%,-100%)`}
  const key=d.type==='primary'||d.type==='station'||d.cat==='home';
  if(!key&&(r.l<4||r.r>W-4||hit(r))){d.el.style.opacity='0';continue}
  boxes.push({l:r.l-4,r:r.r+4,t:r.t-3,b:r.b+3});d.el.style.opacity='1'}}

function requestDraw(){if(!scheduled){scheduled=true;requestAnimationFrame(draw)}}
function resize(){if(ready){renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix()}requestDraw()}
new ResizeObserver(resize).observe(host);
addEventListener('scroll',requestDraw,{passive:true});
reduce.addEventListener('change',resize);
stage.querySelectorAll('[data-geo-chapter]').forEach((b,i)=>b.addEventListener('click',()=>{const p=[0,1][i];
 if(reduce.matches){progress=p;requestDraw()}
 else scrollTo({top:scrollY+section.getBoundingClientRect().top+(section.offsetHeight-stage.offsetHeight)*p,behavior:'smooth'})}));
resize();
