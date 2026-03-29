(function(){
var DISCORD_ID='748831508776878110';
var WS_URL='wss://api.lanyard.rest/socket';
var REST_URL='https://api.lanyard.rest/v1/users/'+DISCORD_ID;
var HEARTBEAT_MS=30000;
var RECONNECT_BASE=2000;
var RECONNECT_MAX=30000;

var pfpEl=document.getElementById('discord-pfp');
var decoEl=document.getElementById('discord-decoration');
var skeletonEl=document.getElementById('hero-pfp-skeleton');
var dotEl=document.getElementById('discord-dot');
var statusEl=document.getElementById('discord-status');
var activityEl=document.getElementById('discord-activity');

var ws=null,heartbeatTimer=null,reconnectTimer=null;
var reconnectDelay=RECONNECT_BASE;
var avatarCached=null,initialised=false,elapsedTimer=null;

/* ── Instant pre-render from sessionStorage cache ── */
/* On repeat visits the avatar + status dot show immediately instead of    */
/* waiting up to 5 s for the WebSocket/REST round-trip to complete.        */
(function preRender(){
    try{
        /* Try localStorage first (persists across sessions), fallback to sessionStorage */
        var cached=localStorage.getItem('dc_cache')||sessionStorage.getItem('dc_cache');
        if(!cached)return;
        var d=JSON.parse(cached);
        if(d.avatar&&pfpEl){
            pfpEl.onload=function(){pfpEl.style.display='block';if(skeletonEl)skeletonEl.style.display='none';};
            pfpEl.onerror=function(){pfpEl.style.display='none';if(skeletonEl)skeletonEl.style.display='block';};
            pfpEl.style.display='none';
            pfpEl.src=d.avatar;
            avatarCached=d.avatar;
            if(pfpEl.complete&&pfpEl.naturalWidth){pfpEl.style.display='block';if(skeletonEl)skeletonEl.style.display='none';}
        }
        if(d.status){applyDot(d.status);applyStatus(d.status);}
    }catch(e){}
})();

/* ── Fire REST immediately in parallel with WebSocket ── */
/* First visit has no cache — this ensures Discord info appears fast (~200ms) */
/* without waiting for the WS handshake. If WS wins, REST result is ignored.  */
(function immediateRest(){
    if(initialised)return;
    fetch(REST_URL)
        .then(function(r){return r.ok?r.json():Promise.reject();})
        .then(function(j){if(!initialised&&j&&j.success&&j.data)render(j.data);})
        .catch(function(){});
})();

/* Safety net: if both REST and WS fail, show offline after 5s */
var fallbackTimer=setTimeout(function(){if(!initialised)renderOffline();},5000);

/* ── Utilities ── */
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function pad(n){return n<10?'0'+n:''+n;}
function fmtElapsed(ms){
    if(!ms)return '';
    var s=Math.max(0,Math.floor((Date.now()-ms)/1000)),m=Math.floor(s/60),h=Math.floor(m/60);
    return h>0?h+':'+pad(m%60)+':'+pad(s%60)+' elapsed':m+':'+pad(s%60)+' elapsed';
}

/* ── Avatar ── */
function resolveAvatar(user){
    if(!user||!user.avatar)return 'https://cdn.discordapp.com/embed/avatars/'+(parseInt(DISCORD_ID.slice(-4))%6)+'.png';
    return 'https://cdn.discordapp.com/avatars/'+DISCORD_ID+'/'+user.avatar+'.'+(user.avatar.startsWith('a_')?'gif':'webp')+'?size=128';
}
function applyAvatar(user){
    var url=resolveAvatar(user);
    if(avatarCached===url)return;
    avatarCached=url;
    if(!pfpEl)return;
    pfpEl.onload=function(){pfpEl.style.display='block';if(skeletonEl)skeletonEl.style.display='none';};
    pfpEl.onerror=function(){pfpEl.style.display='none';if(skeletonEl)skeletonEl.style.display='block';};
    pfpEl.style.display='none';
    pfpEl.src=url;
    /* Handle already-cached images where 'load' fires before handler attaches */
    if(pfpEl.complete&&pfpEl.naturalWidth){pfpEl.style.display='block';if(skeletonEl)skeletonEl.style.display='none';}
}

/* ── Avatar decoration ── */
function applyDecoration(user){
    if(!decoEl)return;
    var deco=user&&user.avatar_decoration_data;
    if(!deco||!deco.asset){decoEl.style.display='none';decoEl.classList.remove('show');return;}
    var url='https://cdn.discordapp.com/avatar-decoration-presets/'+deco.asset+'.png?size=96&passthrough=true';
    if(decoEl.getAttribute('src')===url)return;
    decoEl.onload=function(){decoEl.style.display='block';decoEl.classList.add('show');};
    decoEl.onerror=function(){decoEl.style.display='none';decoEl.classList.remove('show');};
    decoEl.src=url;
}

/* ── Banner ── */
function applyBanner(user){
    var bannerEl=document.getElementById('discord-banner');
    var bannerImg=document.getElementById('discord-banner-img');
    if(!bannerEl)return;
    if(user&&user.banner&&bannerImg){
        var url='https://cdn.discordapp.com/banners/'+DISCORD_ID+'/'+user.banner+'.'+(user.banner.startsWith('a_')?'gif':'webp')+'?size=480';
        bannerImg.style.display='block';
        bannerImg.onerror=function(){bannerImg.style.display='none';if(user.banner_color)bannerEl.style.background=user.banner_color;};
        if(bannerImg.src!==url)bannerImg.src=url;
    } else {
        if(bannerImg)bannerImg.style.display='none';
        if(user&&user.banner_color)bannerEl.style.background=user.banner_color;
    }
}

/* ── Status dot (SVG) ── */
function applyDot(status){
    if(!dotEl)return;
    var bg=getComputedStyle(document.documentElement).getPropertyValue('--dot-bg').trim()||'rgba(8,8,12,0.95)';
    var shapes={
        online:'<circle cx="8" cy="8" r="5" fill="#23a55a"/>',
        idle:'<path fill="#f0b232" d="M8 3a5 5 0 1 0 0 10A3.5 3.5 0 0 1 8 3Z"/>',
        dnd:'<circle cx="8" cy="8" r="5" fill="#f23f43"/><rect x="4.5" y="7.25" width="7" height="1.5" rx="0.75" fill="#fff"/>',
        offline:'<circle cx="8" cy="8" r="3.5" stroke="#80848e" stroke-width="1.5" fill="none"/>',
        streaming:'<circle cx="8" cy="8" r="5" fill="#593695"/><polygon points="6,5.5 11,8 6,10.5" fill="#fff"/>'
    };
    dotEl.innerHTML='<rect x="0" y="0" width="16" height="16" rx="8" fill="'+bg+'"/>'+(shapes[status]||shapes.offline);
    window._lastDiscordStatus=status;
}

/* ── Status text ── */
var _offlineSince=null,_offlineTimer=null;
function _fmtOffline(ms){
    var s=Math.floor((Date.now()-ms)/1000);
    if(s<60)return 'offline for a moment';
    var m=Math.floor(s/60);
    if(m<60)return 'offline for '+m+'m';
    var h=Math.floor(m/60);
    if(h<24)return 'offline for '+h+'h';
    return 'offline for '+(Math.floor(h/24))+'d';
}
function applyStatus(status){
    if(!statusEl)return;
    var colors={online:'#23a55a',idle:'#f0b232',dnd:'#f23f43',offline:'#80848e',streaming:'#593695'};
    var c=colors[status]||colors.offline;
    if(_offlineTimer){clearInterval(_offlineTimer);_offlineTimer=null;}
    function _dot(label){
        statusEl.innerHTML='<span style="display:inline-flex;align-items:center;gap:5px;">'
            +'<span style="width:8px;height:8px;border-radius:50%;background:'+c+';box-shadow:0 0 5px '+c+';display:inline-block;flex-shrink:0;"></span>'
            +'<span style="font-size:0.70rem;color:rgba(255,255,255,0.45);">'+label+'</span>'
            +'</span>';
    }
    if(status==='online'){_offlineSince=null;_dot('active');}
    else if(status==='idle'){_offlineSince=null;_dot('away');}
    else if(status==='dnd'){_offlineSince=null;_dot('busy');}
    else if(status==='streaming'){_offlineSince=null;_dot('streaming');}
    else{
        if(!_offlineSince)_offlineSince=Date.now();
        _dot(_fmtOffline(_offlineSince));
        _offlineTimer=setInterval(function(){_dot(_fmtOffline(_offlineSince));},60000);
    }
}

/* ── Profile badges ── */
var BADGE_FLAGS=[
    {flag:1,       src:'6de6d34650760ba5551a79732e98ed60', tip:'Discord Staff'},
    {flag:2,       src:'848f79194d4be5ff5f81505cbd0ce1e6', tip:'Partnered Server Owner'},
    {flag:4,       src:'df199d2050d3ed4ebf84d64ae83989f8', tip:'HypeSquad Events'},
    {flag:8,       src:'43651ad8e2a8d1f9e5a7f4a3c4e40c54', tip:'Bug Hunter Level 1'},
    {flag:64,      src:'8a88d63823d8a71cd5e390baa45efa02', tip:'HypeSquad Bravery'},
    {flag:128,     src:'011940fd013da3f7fb926e4a1cd2e618', tip:'HypeSquad Brilliance'},
    {flag:256,     src:'3aa41de486fa12454c3761e8e223442e', tip:'HypeSquad Balance'},
    {flag:512,     src:'28a406d085f0f6d2e2e5d6ad9c0ec3de', tip:'Early Supporter'},
    {flag:16384,   src:'2717692c7dca7289b35297368a940dd0', tip:'Bug Hunter Level 2'},
    {flag:131072,  src:'e4b12c334162003e4ae5c7ee0e7ef3e5', tip:'Verified Bot Developer'},
    {flag:4194304, src:'a7f0b8de8d64ba2c36b77fbb25f2b97e', tip:'Active Developer'}
];

function applyBadges(user){
    // Target the pill element so Discord badges sit alongside the static ones
    var pillEl=document.getElementById('custom-badge-pill');
    if(!pillEl)return;
    // Remove any previously injected Discord badges from the pill
    pillEl.querySelectorAll('.dc-real-badge').forEach(function(el){el.remove();});
    var flags=(user&&user.public_flags)||0;
    var earned=BADGE_FLAGS.filter(function(b){return flags&b.flag;});
    earned.forEach(function(b){
        var wrap=document.createElement('div');
        wrap.className='custom-badge dc-real-badge';
        wrap.setAttribute('data-tip',b.tip);
        wrap.style.cssText='width:22px;height:22px;flex-shrink:0;';
        var img=document.createElement('img');
        img.draggable=false;
        img.alt=b.tip;
        img.src='https://cdn.discordapp.com/badge-icons/'+b.src+'.png';
        img.style.cssText='width:22px;height:22px;display:block;object-fit:contain;';
        img.onerror=function(){wrap.style.display='none';};
        wrap.appendChild(img);
        pillEl.appendChild(wrap);
    });
    // Clan tag intentionally not shown
}

/* ── Nameplate ── */
function applyNameplate(user){
    var prev=document.getElementById('dc-nameplate-wrap');
    if(prev)prev.remove();
    var np=user&&user.collectibles&&user.collectibles.nameplate;
    if(!np||!np.asset)return;
    var url='https://cdn.discordapp.com/collectibles-assets/'+np.asset+'nameplate.png?passthrough=false&size=160';
    var wrap=document.createElement('div');
    wrap.id='dc-nameplate-wrap';
    wrap.style.cssText='display:inline-flex;align-items:center;gap:5px;margin-top:5px;';
    var plate=document.createElement('img');
    plate.draggable=false; plate.alt=''; plate.src=url;
    plate.style.cssText='height:18px;width:auto;max-width:120px;object-fit:contain;opacity:0.70;filter:drop-shadow(0 0 4px rgba(255,255,255,0.18));pointer-events:none;border-radius:3px;';
    plate.onerror=function(){wrap.remove();};
    wrap.appendChild(plate);
    var subtitle=document.querySelector('.subtitle-text');
    if(subtitle&&subtitle.parentNode)subtitle.parentNode.insertBefore(wrap,subtitle.nextSibling);
}

/* ── Activity ── */
function setActivity(html){
    if(!activityEl)return;
    if(html){activityEl.innerHTML=html;activityEl.style.display='block';}
    else{activityEl.innerHTML='';activityEl.style.display='none';}
}

function applyActivity(activities,spotify){
    if(elapsedTimer){clearInterval(elapsedTimer);elapsedTimer=null;}
    if(!activityEl)return;
    var acts=activities||[];
    var spA=null,custom=null,game=null,stream=null,watch=null;
    for(var i=0;i<acts.length;i++){
        var a=acts[i];
        if(a.type===2&&!spA)spA=a;
        if(a.type===4&&!custom)custom=a;
        if(a.type===1&&!stream)stream=a;
        if(a.type===0&&!game)game=a;
        if(a.type===3&&!watch)watch=a;
    }
    function lbl(text){return '<span style="font-size:0.58rem;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-right:5px;">'+text+'</span>';}
    function main_(text){return '<span style="font-weight:600;color:rgba(255,255,255,0.88);">'+text+'</span>';}
    function sub_(text){return '<span style="color:rgba(255,255,255,0.45);">'+text+'</span>';}
    function elapsed_(ms){return ms?'<span style="color:rgba(255,255,255,0.30);font-size:0.60rem;margin-left:4px;">'+fmtElapsed(ms)+'</span>':'';}

    if(spotify&&spotify.song){
        var ms=spotify.timestamps&&spotify.timestamps.start;
        function refreshSp(){
            setActivity(lbl('listening')+main_(esc(spotify.song))+' '+sub_('— '+esc(spotify.artist))+elapsed_(ms));
        }
        refreshSp();
        if(ms)elapsedTimer=setInterval(refreshSp,5000);
        return;
    }
    if(stream){
        setActivity(lbl('streaming')+main_(esc(stream.name||'live')));
        return;
    }
    if(spA){
        setActivity(lbl('listening')+main_(esc(spA.details||spA.name))+' '+sub_('— '+esc(spA.state||'')));
        return;
    }
    if(watch){
        setActivity(lbl('watching')+main_(esc(watch.name))+(watch.details?' '+sub_('— '+esc(watch.details)):''));
        return;
    }
    if(game){
        var ms2=game.timestamps&&game.timestamps.start;
        setActivity(lbl('playing')+main_(esc(game.name))+(game.details?' '+sub_('— '+esc(game.details)):'')+elapsed_(ms2));
        return;
    }
    if(custom){
        var emoji='';
        if(custom.emoji){
            if(custom.emoji.id)emoji='<img src="https://cdn.discordapp.com/emojis/'+custom.emoji.id+'.webp?size=20" style="width:15px;height:15px;vertical-align:middle;margin-right:4px;" alt="">';
            else if(custom.emoji.name)emoji=esc(custom.emoji.name)+' ';
        }
        if(custom.state)setActivity('<span style="color:rgba(255,255,255,0.75);">'+emoji+esc(custom.state)+'</span>');
        else setActivity('');
        return;
    }
    setActivity('');
}

/* ── Master render ── */
function render(data){
    if(!data)return;
    var user=data.discord_user||{};
    var status=data.discord_status||'offline';
    var activities=data.activities||[];
    var spotify=data.spotify||null;
    applyAvatar(user);
    applyDecoration(user);
    applyBanner(user);
    applyDot(status);
    applyStatus(status);
    applyActivity(activities,spotify);
    applyBadges(user);
    applyNameplate(user);
    window._lastDiscordStatus=status;
    initialised=true;
    clearTimeout(fallbackTimer);
    /* Persist avatar + status to both storages:
       sessionStorage → instant pre-render within same tab session
       localStorage   → instant pre-render on return visits across sessions */
    try{
        var cacheData=JSON.stringify({avatar:resolveAvatar(user),status:status});
        sessionStorage.setItem('dc_cache',cacheData);
        localStorage.setItem('dc_cache',cacheData);
    }catch(e){}
}

/* ── REST fallback (kept for legacy WS onclose path) ── */
function doRestFallback(){
    if(initialised)return;
    fetch(REST_URL)
        .then(function(r){return r.ok?r.json():Promise.reject('http-error');})
        .then(function(j){
            if(!initialised&&j&&j.success&&j.data){render(j.data);}
            else if(!initialised){renderOffline();}
        })
        .catch(function(){if(!initialised)renderOffline();});
}

function renderOffline(){
    if(skeletonEl)skeletonEl.style.display='none';
    if(pfpEl){
        pfpEl.onload=function(){pfpEl.style.display='block';};
        pfpEl.src='https://cdn.discordapp.com/embed/avatars/'+(parseInt(DISCORD_ID.slice(-4))%6)+'.png';
        if(pfpEl.complete&&pfpEl.naturalWidth)pfpEl.style.display='block';
    }
    applyDot('offline');
    applyStatus('offline');
    setActivity('');
    initialised=true;
}

window._refreshDiscordDot=function(){applyDot(window._lastDiscordStatus||'offline');};

/* ── WebSocket ── */
function connect(){
    if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
    try{ws=new WebSocket(WS_URL);}catch(e){scheduleReconnect();return;}
    ws.onopen=function(){reconnectDelay=RECONNECT_BASE;};
    ws.onmessage=function(evt){
        var msg;try{msg=JSON.parse(evt.data);}catch(e){return;}
        switch(msg.op){
            case 1:
                var interval=(msg.d&&msg.d.heartbeat_interval)||HEARTBEAT_MS;
                startHeartbeat(interval);
                ws.send(JSON.stringify({op:2,d:{subscribe_to_id:DISCORD_ID}}));
                break;
            case 0:
                // KEY FIX: do NOT clearTimeout(fallbackTimer) here unconditionally.
                // The old code killed the REST fallback the moment ANY op:0 arrived,
                // even when INIT_STATE returned no data for this user (user not in
                // Lanyard's server). Now clearTimeout only runs inside render(),
                // so if p is undefined the REST fallback still fires after 5 s.
                if(msg.t==='INIT_STATE'){
                    var p=msg.d&&msg.d[DISCORD_ID];
                    if(p)render(p);
                    // no data for this user → fallbackTimer still live → REST fires
                }
                else if(msg.t==='PRESENCE_UPDATE'){
                    if(msg.d)render(msg.d);
                }
                break;
        }
    };
    ws.onerror=function(){};
    ws.onclose=function(){stopHeartbeat();if(!initialised)doRestFallback();scheduleReconnect();};
}

function startHeartbeat(i){stopHeartbeat();heartbeatTimer=setInterval(function(){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({op:3}));},i);}
function stopHeartbeat(){if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}}
function scheduleReconnect(){if(reconnectTimer)return;reconnectTimer=setTimeout(function(){reconnectTimer=null;connect();},reconnectDelay);reconnectDelay=Math.min(reconnectDelay*2,RECONNECT_MAX);}

connect();
})();
