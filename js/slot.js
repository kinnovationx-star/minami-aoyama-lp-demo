/* 物件概要の価格・面積をスロットのように回して止める */
(function(){
 var targets=[].slice.call(document.querySelectorAll('.hero-price-num strong,.estate-price p strong,.estate-area p'));
 if(!targets.length)return;
 var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 var CYCLES=2; // 止まるまでに回る周回数

 function build(el){
  /* 先頭のテキスト（数字・カンマ・小数点）だけをリールに置き換える */
  var node=[].slice.call(el.childNodes).find(function(n){return n.nodeType===3&&/\d/.test(n.textContent)});
  if(!node)return [];
  var text=node.textContent.trim(),frag=document.createDocumentFragment(),reels=[];
  /* 読み上げ用に本来の数字を残し、リールは読み上げ対象から外す */
  var sr=document.createElement('span');sr.className='slot-sr';sr.textContent=text;
  var vis=document.createElement('span');vis.setAttribute('aria-hidden','true');
  frag.appendChild(sr);frag.appendChild(vis);
  text.split('').forEach(function(ch){
   if(!/\d/.test(ch)){var s=document.createElement('span');s.className='slot-sep';s.textContent=ch;vis.appendChild(s);return}
   var d=+ch,wrap=document.createElement('span'),ghost=document.createElement('span'),reel=document.createElement('span');
   wrap.className='slot-digit';ghost.className='slot-ghost';ghost.textContent=ch;reel.className='slot-reel';
   var seq=[],start=(d+3)%10;
   for(var i=0;i<CYCLES*10;i++)seq.push((start+i)%10);
   seq.push(d);
   seq.forEach(function(n){var b=document.createElement('span');b.textContent=n;reel.appendChild(b)});
   wrap.appendChild(ghost);wrap.appendChild(reel);vis.appendChild(wrap);
   reels.push({reel:reel,steps:seq.length-1,total:seq.length});
  });
  el.replaceChild(frag,node);
  return reels;
 }

 var groups=targets.map(function(el){return{el:el,reels:build(el)}});
 if(reduce){groups.forEach(function(g){g.reels.forEach(function(r){r.reel.style.transform='translateY('+(-r.steps/r.total*100)+'%)'})});return}

 function spin(g){
  g.reels.forEach(function(r,i){
   var dur=1300+i*260; // 左から順に止まる
   r.reel.style.transition='transform '+dur+'ms cubic-bezier(.16,.84,.24,1.02)';
   requestAnimationFrame(function(){requestAnimationFrame(function(){r.reel.style.transform='translateY('+(-r.steps/r.total*100)+'%)'})});
  });
 }
 var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(!e.isIntersecting)return;
  groups.filter(function(g){return g.el===e.target}).forEach(spin);io.unobserve(e.target)})},{threshold:.5});
 groups.forEach(function(g){io.observe(g.el)});
})();
