(function(){
    window._startNameTypewriter=(function(){
        var el=document.getElementById('display-name');
        var cursor=document.getElementById('tw-cursor');
        if(!el)return function(){};
        var name='Francisco';
        var idx=0;
        var timer=null;
        function tick(){
            idx++;
            el.textContent=name.slice(0,idx);
            if(idx<name.length){
                timer=setTimeout(tick,105);
            }else{
                setTimeout(function(){if(cursor)cursor.style.display='none';},900);
            }
        }
        return function(){
            clearTimeout(timer);
            idx=0;
            el.textContent='';
            if(cursor)cursor.style.display='inline-block';
            setTimeout(tick,700);
        };
    })();

    var overlay=document.getElementById('overlay');
    var mainContent=document.getElementById('main-content');

    function onEnter(){
        sessionStorage.setItem('site_entered','1');
        overlay.style.opacity='0';
        setTimeout(function(){
            overlay.style.display='none';
            mainContent.classList.add('visible');
            document.title='Francisco | Portfolio';
            window._startNameTypewriter();
        },800);
    }

    if(sessionStorage.getItem('site_entered')){
        overlay.style.display='none';
        mainContent.classList.add('visible');
        document.title='Francisco | Portfolio';
        window._startNameTypewriter();
    }else{
        overlay.addEventListener('click',onEnter,{once:true});
    }
})();
