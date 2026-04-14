(function(){
    var BG_MAP={overview:'bg-index',about:'bg-about',contact:'bg-contact'};
    var SUFFIX_MAP={overview:'Portfolio',about:'About',contact:'Contact'};
    var TAB_ORDER=['overview','about','contact'];
    var currentTab='overview';

    window.switchTab=function(tab){
        if(tab===currentTab)return;
        if(!document.getElementById('panel-'+tab))return;
        var prevTabEl=document.getElementById('tab-'+currentTab);
        var nextTabEl=document.getElementById('tab-'+tab);
        if(prevTabEl)prevTabEl.classList.remove('active');
        if(nextTabEl)nextTabEl.classList.add('active');
        var prevPanel=document.getElementById('panel-'+currentTab);
        var nextPanel=document.getElementById('panel-'+tab);
        if(prevPanel)prevPanel.classList.remove('active');
        if(nextPanel)nextPanel.classList.add('active');
        var prevBg=document.getElementById(BG_MAP[currentTab]);
        var nextBg=document.getElementById(BG_MAP[tab]);
        if(prevBg)prevBg.style.opacity='0';
        if(nextBg)nextBg.style.opacity='1';
        document.title='Shub | '+(SUFFIX_MAP[tab]||tab);
        var url=tab==='overview'?'./':tab+'.html';
        history.pushState({tab:tab},'',url);
        currentTab=tab;
    };

    window.addEventListener('popstate',function(e){
        if(e.state&&e.state.tab)window.switchTab(e.state.tab);
    });

    document.addEventListener('keydown',function(e){
        var tag=document.activeElement&&document.activeElement.tagName;
        if(tag==='INPUT'||tag==='TEXTAREA')return;
        var idx=TAB_ORDER.indexOf(currentTab);
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){
            e.preventDefault();
            window.switchTab(TAB_ORDER[(idx+1)%TAB_ORDER.length]);
        }else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){
            e.preventDefault();
            window.switchTab(TAB_ORDER[(idx-1+TAB_ORDER.length)%TAB_ORDER.length]);
        }
    });

    document.querySelectorAll('.nav-tab').forEach(function(el){
        el.setAttribute('tabindex','0');
        el.setAttribute('role','tab');
        el.addEventListener('keydown',function(e){
            if(e.key==='Enter'||e.key===' '){
                e.preventDefault();
                window.switchTab(el.id.replace('tab-',''));
            }
        });
    });

    document.title='Shub | Portfolio';
})();
