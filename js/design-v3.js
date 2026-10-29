const siteTrack=document.querySelector('.site-carousel');
const siteSlides=[...siteTrack.querySelectorAll('.site-slide')];
const sitePrev=document.querySelector('[data-site-step="-1"]'),siteNext=document.querySelector('[data-site-step="1"]');
let siteIndex=0,siteTick=false;
function siteState(){siteTick=false;siteIndex=Math.round(siteTrack.scrollLeft/siteTrack.clientWidth);document.querySelector('.site-current').textContent=String(siteIndex+1).padStart(2,'0');sitePrev.disabled=siteIndex===0;siteNext.disabled=siteIndex===siteSlides.length-1;}
function siteMove(step){siteTrack.scrollTo({left:Math.max(0,Math.min(siteSlides.length-1,siteIndex+step))*siteTrack.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
document.querySelectorAll('[data-site-step]').forEach(b=>b.addEventListener('click',()=>siteMove(Number(b.dataset.siteStep))));
siteTrack.tabIndex=0;siteTrack.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();siteMove(e.key==='ArrowRight'?1:-1)}});siteTrack.addEventListener('scroll',()=>{if(!siteTick){siteTick=true;requestAnimationFrame(siteState)}},{passive:true});new ResizeObserver(()=>{siteTrack.scrollTo({left:siteIndex*siteTrack.clientWidth,behavior:'instant'});siteState()}).observe(siteTrack);siteState();
