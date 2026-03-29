(function(){
var DISCORD_ID='748831508776878110';
var WS_URL='wss://api.lanyard.rest/socket';
var REST_URL='https://api.lanyard.rest/v1/users/'+DISCORD_ID;
var HEARTBEAT_MS=30000;
var RECONNECT_BASE=2000;
var RECONNECT_MAX=30000;

// ── FIX: defer all DOM access and logic until the document is fully parsed ──
// Previously all getElementById calls ran immediately when the <script> tag was
// evaluated, which is BEFORE the Discord HTML elements exist in the DOM, so
// every element reference was null and nothing ever rendered.
function init(){

var pfpEl=document.getElementById('discord-pfp');
var decoEl=document.getElementById('discord-decoration');
var skeletonEl=document.getElementById('hero-pfp-skeleton');
var dotEl=document.getElementById('discord-dot');
var statusEl=document.getElementById('discord-status');
var activityEl=document.getElementById('discord-activity');

var ws=null,heartbeatTimer=null,reconnectTimer=null;
var reconnectDelay=RECONNECT_BASE;
var avatarCached=null,initialised=false,elapsedTimer=null;

var fallbackTimer=setTimeout(doRestFallback,5000);

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
}

/* ── Avatar decoration (animated PNG overlay) ── */
function applyDecoration(user){
    if(!decoEl)return;
    var deco=user&&user.avatar_decoration_data;
    if(!deco||!deco.asset){
        decoEl.style.display='none';
        decoEl.classList.remove('show');
        return;
    }
    // passthrough=true preserves animated frames
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

/* ── Status text label ── */
function applyStatus(status){
    if(!statusEl)return;
    var colors={online:'#23a55a',idle:'#f0b232',dnd:'#f23f43',offline:'#80848e',streaming:'#593695'};
    var labels={online:'Online',idle:'Idle',dnd:'Do Not Disturb',offline:'Offline',streaming:'Streaming'};
    var c=colors[status]||colors.offline;
    statusEl.innerHTML='<span style="display:inline-flex;align-items:center;gap:5px;">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+c+';box-shadow:0 0 5px '+c+';display:inline-block;flex-shrink:0;"></span>'
        +'<span style="font-size:0.70rem;color:rgba(255,255,255,0.45);">'+labels[status]+'</span>'
        +'</span>';
}

/* ── Profile badges (public_flags bitmask + guild tag) ── */
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
    var badgesEl=document.getElementById('discord-badges');
    if(!badgesEl)return;

    // Remove previously injected real Discord badges; keep the static custom-badge-pill
    badgesEl.querySelectorAll('.dc-real-badge').forEach(function(el){el.remove();});

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
        badgesEl.appendChild(wrap);
    });

    // Guild / Clan tag chip
    var guild=user&&user.primary_guild;
    applyGuildTag(guild, badgesEl);
}

/* ── Guild / Clan tag chip ── */
function applyGuildTag(guild, badgesEl){
    var prev=document.getElementById('dc-guild-tag');
    if(prev)prev.remove();
    if(!guild||!guild.tag||!guild.identity_enabled)return;

    var chip=document.createElement('div');
    chip.id='dc-guild-tag';
    chip.className='custom-badge dc-real-badge';
    chip.setAttribute('data-tip','Clan · '+esc(guild.tag));
    chip.style.cssText='display:inline-flex;align-items:center;gap:4px;width:auto;height:22px;'
        +'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.13);'
        +'border-radius:6px;padding:0 6px;cursor:default;flex-shrink:0;'
        +'transition:background 0.2s,border-color 0.2s;';
    chip.onmouseenter=function(){chip.style.background='rgba(255,255,255,0.13)';chip.style.borderColor='rgba(255,255,255,0.25)';};
    chip.onmouseleave=function(){chip.style.background='rgba(255,255,255,0.07)';chip.style.borderColor='rgba(255,255,255,0.13)';};

    // Guild badge icon (16px)
    if(guild.badge&&guild.identity_guild_id){
        var gIcon=document.createElement('img');
        gIcon.draggable=false;
        gIcon.alt='';
        gIcon.src='https://cdn.discordapp.com/clan-badges/'+guild.identity_guild_id+'/'+guild.badge+'.png?size=16';
        gIcon.style.cssText='width:14px;height:14px;object-fit:contain;border-radius:2px;flex-shrink:0;';
        gIcon.onerror=function(){gIcon.style.display='none';};
        chip.appendChild(gIcon);
    }

    var tagText=document.createElement('span');
    tagText.textContent=guild.tag;
    tagText.style.cssText='font-size:0.58rem;font-weight:700;letter-spacing:0.5px;color:rgba(255,255,255,0.65);line-height:1;';
    chip.appendChild(tagText);

    if(badgesEl)badgesEl.appendChild(chip);
}

/* ── Nameplate collectible ── */
function applyNameplate(user){
    // Clean up any previous nameplate
    var prev=document.getElementById('dc-nameplate-wrap');
    if(prev)prev.remove();

    var np=user&&user.collectibles&&user.collectibles.nameplate;
    if(!np||!np.asset)return;

    // Asset path e.g. "nameplates/lunar_eclipse/moonlit_charm/"
    var url='https://cdn.discordapp.com/collectibles-assets/'+np.asset+'nameplate.png?passthrough=false&size=160';

    var wrap=document.createElement('div');
    wrap.id='dc-nameplate-wrap';
    wrap.style.cssText='display:inline-flex;align-items:center;gap:5px;margin-top:5px;';

    var plate=document.createElement('img');
    plate.draggable=false;
    plate.alt='';
    plate.src=url;
    plate.style.cssText='height:18px;width:auto;max-width:120px;object-fit:contain;'
        +'opacity:0.70;filter:drop-shadow(0 0 4px rgba(255,255,255,0.18));pointer-events:none;'
        +'border-radius:3px;';
    plate.onerror=function(){wrap.remove();};
    wrap.appendChild(plate);

    // Insert below the subtitle ".subtitle-text" line
    var subtitle=document.querySelector('.subtitle-text');
    if(subtitle&&subtitle.parentNode){
        subtitle.parentNode.insertBefore(wrap,subtitle.nextSibling);
    }
}

/* ── Activity ── */
function setActivity(html){
    if(!activityEl)return;
    if(html){
        activityEl.innerHTML=html;
        activityEl.style.display='block';  // FIX: override inline display:none from HTML
    } else {
        activityEl.innerHTML='';
        activityEl.style.display='none';
    }
}

function applyActivity(activities,spotify){
    if(elapsedTimer){clearInterval(elapsedTimer);elapsedTimer=null;}
    if(!activityEl)return;
    var acts=activities||[];
    var spA=null,custom=null,game=null,stream=null;
    for(var i=0;i<acts.length;i++){
        var a=acts[i];
        if(a.type===2&&!spA)spA=a;
        if(a.type===4&&!custom)custom=a;
        if(a.type===1&&!stream)stream=a;
        if(a.type===0&&!game)game=a;
    }
    if(spotify&&spotify.song){
        var ms=spotify.timestamps&&spotify.timestamps.start;
        function refreshSp(){
            setActivity('<span>🎵</span><span style="margin-left:5px;font-weight:600;color:rgba(255,255,255,0.88);">'+esc(spotify.song)+'</span><span style="color:rgba(255,255,255,0.55);"> — '+esc(spotify.artist)+'</span>'+(ms?'<span style="color:rgba(255,255,255,0.35);font-size:0.60rem;"> · '+fmtElapsed(ms)+'</span>':''));
        }
        refreshSp();
        if(ms)elapsedTimer=setInterval(refreshSp,5000);
        return;
    }
    if(custom){
        var emoji='';
        if(custom.emoji){
            if(custom.emoji.id)emoji='<img src="https://cdn.discordapp.com/emojis/'+custom.emoji.id+'.webp?size=20" style="width:15px;height:15px;vertical-align:middle;margin-right:4px;" alt="">';
            else if(custom.emoji.name)emoji=esc(custom.emoji.name)+' ';
        }
        setActivity('<span style="color:rgba(255,255,255,0.82);font-weight:500;">'+emoji+esc(custom.state||'')+'</span>');
        return;
    }
    if(spA){
        setActivity('<span>🎵</span><span style="margin-left:5px;font-weight:600;color:rgba(255,255,255,0.88);">'+esc(spA.details||'')+'</span><span style="color:rgba(255,255,255,0.55);"> — '+esc(spA.state||'')+'</span>');
        return;
    }
    if(stream){setActivity('<span style="color:#a07fff;">🔴</span><span style="margin-left:5px;color:rgba(255,255,255,0.82);font-weight:500;">'+esc(stream.name||'Streaming')+'</span>');return;}
    if(game){setActivity('<span>🎮</span><span style="margin-left:5px;color:rgba(255,255,255,0.82);font-weight:500;">'+esc(game.name)+(game.details?' — '+esc(game.details):'')+'</span>');return;}
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
}

/* ── REST fallback ── */
function doRestFallback(){
    if(initialised)return;
    fetch(REST_URL)
        .then(function(r){return r.ok?r.json():Promise.reject();})
        .then(function(j){if(!initialised&&j&&j.data)render(j.data);})
        .catch(function(){if(!initialised)renderOffline();});
}

function renderOffline(){
    if(skeletonEl)skeletonEl.style.display='none';
    if(pfpEl){pfpEl.onload=function(){pfpEl.style.display='block';};pfpEl.src='https://cdn.discordapp.com/embed/avatars/'+(parseInt(DISCORD_ID.slice(-4))%6)+'.png';}
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
                clearTimeout(fallbackTimer);
                if(msg.t==='INIT_STATE'){var p=msg.d&&msg.d[DISCORD_ID];if(p)render(p);}
                else if(msg.t==='PRESENCE_UPDATE'){if(msg.d)render(msg.d);}
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

} // end init()

// ── Run after DOM is fully parsed ──
if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
}else{
    // Script loaded after DOM is ready (e.g. defer, or late dynamic load)
    init();
}

})();
