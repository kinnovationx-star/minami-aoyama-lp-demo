/* 物件概要の画像スライダー（フェード切替・スワイプ・自動送り） */
(function(){
 var root=document.getElementById('views');if(!root)return;
 var slides=[].slice.call(root.querySelectorAll('.view-slide')).filter(function(f){return true});
 var dots=root.querySelector('.view-dots'),cur=0,timer=null,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 slides.forEach(function(s,i){var b=document.createElement('button');b.type='button';b.setAttribute('aria-label',(i+1)+'枚目');b.addEventListener('click',function(){go(i,true)});dots.appendChild(b)});
 function go(i,user){cur=(i+slides.length)%slides.length;
  slides.forEach(function(s,k){s.classList.toggle('is-active',k===cur);s.setAttribute('aria-hidden',k!==cur)});
  [].forEach.call(dots.children,function(d,k){d.setAttribute('aria-current',k===cur)});
  if(user)restart()}
 function restart(){clearInterval(timer);if(!reduce)timer=setInterval(function(){go(cur+1)},6000)}
 root.querySelector('.prev').addEventListener('click',function(){go(cur-1,true)});
 root.querySelector('.next').addEventListener('click',function(){go(cur+1,true)});
 var x0=null;root.addEventListener('pointerdown',function(e){x0=e.clientX});
 root.addEventListener('pointerup',function(e){if(x0===null)return;var dx=e.clientX-x0;x0=null;if(Math.abs(dx)>50)go(cur+(dx<0?1:-1),true)});
 root.addEventListener('keydown',function(e){if(e.key==='ArrowRight')go(cur+1,true);if(e.key==='ArrowLeft')go(cur-1,true)});
 go(0);restart();
})();
