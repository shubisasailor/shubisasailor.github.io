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

var fallbackTimer=setTimeout(doRestFallback,5000);

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function pad(n){return n<10?'0'+n:''+n;}
function fmtElapsed(ms){if(!ms)return '';var s=Math.max(0,Math.floor((Date.now()-ms)/1000)),m=Math.floor(s/60),h=Math.floor(m/60);return h>0?h+':'+pad(m%60)+':'+pad(s%60)+' elapsed':m+':'+pad(s%60)+' elapsed';}

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

function applyDecoration(user){
    if(!decoEl)return;
    var deco=user&&user.avatar_decoration_data;
    if(!deco||!deco.asset){decoEl.style.display='none';return;}
    var url='https://cdn.discordapp.com/avatar-decoration-presets/'+deco.asset+'.png?size=96&passthrough=true';
    if(decoEl.getAttribute('src')===url)return;
    decoEl.onload=function(){decoEl.style.display='block';};
    decoEl.onerror=function(){decoEl.style.display='none';};
    decoEl.src=url;
}

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

function setActivity(html){
    if(!activityEl)return;
    if(html){activityEl.innerHTML=html;activityEl.style.display='block';}
    else{activityEl.innerHTML='';activityEl.style.display='none';}
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
    window._lastDiscordStatus=status;
    initialised=true;
}

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
})();
