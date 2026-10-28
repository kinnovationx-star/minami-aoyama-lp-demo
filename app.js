/* お問い合わせフォームは contact.html に移動。ページ内にフォームがある場合のみ処理する */
(function(){var form=document.querySelector('form');if(!form)return;form.addEventListener('submit',function(e){e.preventDefault();var s=document.querySelector('.form-status');if(s)s.textContent='デモのため送信は行いません。';});})();
