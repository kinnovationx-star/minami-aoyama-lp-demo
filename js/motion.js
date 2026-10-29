const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const menuButton=document.querySelector('.menu-btn'),menu=document.querySelector('#mobile-menu');
function closeMenu(){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.textContent='MENU ＋'}
menuButton?.addEventListener('click',()=>{menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden));menuButton.textContent=menu.hidden?'MENU ＋':'CLOSE −'});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){closeMenu();menuButton.focus()}});
const chapters=[['ノワール','石の陰影を、住まいの表情に。'],['カーブ','やわらかな輪郭が、街に溶け込む。'],['テラス','緑と、空と、暮らす。'],['ラティス','木の奥に、自分だけの静けさを。'],['コンクリート','余白と質感がつくる、端正な一邸。'],['トラバーチン','淡い石の表情を、日常に。']];
const plans=document.querySelector('#plans'),scene=document.querySelector('.pin-scene'),slides=[...document.querySelectorAll('.pin-slide')],dots=[...document.querySelectorAll('[data-chapter]')];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));let selected=-1;
function paintPlans(progress){const pos=progress*5,index=Math.round(pos);slides.forEach((s,i)=>{let opacity=clamp(1-Math.abs(pos-i));s.style.opacity=opacity;s.style.zIndex=i===index?2:1;s.style.transform=`scale(${1+(1-opacity)*.045})`;s.setAttribute('aria-hidden',String(i!==index))});document.querySelector('.pin-progress span').style.width=`${progress*100}%`;if(index===selected)return;selected=index;document.querySelector('#pin-title').textContent=chapters[index][0];document.querySelector('#pin-description').textContent=chapters[index][1];document.querySelector('#pin-number').textContent=String(index+1).padStart(2,'0');dots.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)))}
dots.forEach((b,i)=>b.addEventListener('click',()=>{if(reduce.matches){paintPlans(i/5);return}const travel=plans.offsetHeight-scene.offsetHeight;window.scrollTo({top:scrollY+plans.getBoundingClientRect().top+travel*i/5,behavior:'smooth'})}));
const parallax=[...document.querySelectorAll('[data-parallax]')].map(el=>({el,target:el.querySelector('.living-image,.terrace-image')||el.querySelector('img')})).filter(x=>x.target);
let ticking=false;
function draw(){ticking=false;if(!reduce.matches){const rect=plans.getBoundingClientRect();paintPlans(clamp(-rect.top/Math.max(1,plans.offsetHeight-scene.offsetHeight)));parallax.forEach(({el,target})=>{const r=el.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const p=clamp((innerHeight/2-r.top-r.height/2)/innerHeight,-1,1);target.style.transform=`translate3d(0,${p*38}px,0) scale(1.10)`})}}
function schedule(){if(!ticking){ticking=true;requestAnimationFrame(draw)}}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);paintPlans(0);schedule();
if(!reduce.matches){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.photo-intro h2,.living-caption h2,.estate-group,.estate-heading h2,.atmosphere-copy,.land-photo-reveal,.volume-box').forEach(el=>{el.classList.add('reveal-ready');io.observe(el)})}
let heroIndex=0,heroPaused=false,autoEnabled=true;const heroSlide=document.querySelector('#hero-slide'),heroFiles=[6,2,1,4,3,5];
function moveHero(step){heroIndex=(heroIndex+step+6)%6;heroSlide.src=`assets/plan-${heroFiles[heroIndex]}.webp`;heroSlide.alt=`参考外観CG：${chapters[heroFiles[heroIndex]-1][0]}`;document.querySelector('#hero-number').textContent=`0${heroIndex+1} / 06`}
document.querySelectorAll('[data-hero-step]').forEach(b=>b.addEventListener('click',()=>moveHero(Number(b.dataset.heroStep))));document.querySelector('#hero-pause')?.addEventListener('click',e=>{heroPaused=!heroPaused;e.target.textContent=heroPaused?'再生':'停止';e.target.setAttribute('aria-pressed',String(heroPaused))});
let lifeIndex=0,lifePaused=false;const lifeImages=[...document.querySelectorAll('.mizota-images img')];document.querySelector('#living-pause')?.addEventListener('click',e=>{lifePaused=!lifePaused;e.target.textContent=lifePaused?'スライド再生':'スライド停止';e.target.setAttribute('aria-pressed',String(lifePaused))});
function canAuto(){return autoEnabled&&!reduce.matches&&!document.hidden&&document.querySelector('.hero').getBoundingClientRect().bottom>0}
if(heroSlide)setInterval(()=>{if(canAuto()&&!heroPaused)moveHero(1)},5000);
if(lifeImages.length)setInterval(()=>{if(!canAuto()||lifePaused)return;lifeIndex=(lifeIndex+1)%lifeImages.length;lifeImages.forEach((el,i)=>el.classList.toggle('active',i===lifeIndex))},6500);
reduce.addEventListener('change',()=>{document.querySelectorAll('.reveal-ready').forEach(el=>el.classList.add('is-visible'));parallax.forEach(({target})=>target.style.transform='');schedule()});
window.addEventListener('message',e=>{if(e.source!==parent)return;if(e.data?.type==='wireframe-color')document.body.classList.toggle('monochrome',!e.data.color);if(e.data?.type==='wireframe-motion')autoEnabled=e.data.motion;if(e.data?.type==='wireframe-jump')document.getElementById(e.data.id)?.scrollIntoView({behavior:reduce.matches?'instant':'smooth'})});
