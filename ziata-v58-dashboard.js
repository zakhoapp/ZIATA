(()=>{'use strict';const $=id=>document.getElementById(id);let started=false;async function refresh(){if(!window.ziataSB||!window.ziataContext)return;const c=await window.ziataContext();if(!c.session?.user)return;const sb=window.ziataSB;const {data,error}=await sb.from('ziata_announcement_recipients').select('announcement_id,is_read,ziata_announcements(id,title,body,created_at)').eq('user_id',c.session.user.id).limit(100);const root=$('zi-v58-list');if(!root)return;root.replaceChildren();if(error){root.textContent='نەشیا ئاگەهداریان بخوینیت: '+error.message;return}const rows=(data||[]).filter(r=>r.ziata_announcements).sort((a,b)=>new Date(b.ziata_announcements.created_at)-new Date(a.ziata_announcements.created_at));$('zi-v58-unread').textContent=rows.filter(r=>!r.is_read).length+' نەخوینـدی';if(!rows.length){root.textContent='هیچ ئاگەهداریەک نینە';return}for(const r of rows){const n=r.ziata_announcements,a=document.createElement('a');a.href='notification.html?id='+encodeURIComponent(n.id);a.className='zi-v58-entry'+(r.is_read?'':' unread');const title=document.createElement('strong'),body=document.createElement('p'),time=document.createElement('small');title.textContent=n.title;body.textContent=n.body.slice(0,160);time.textContent=new Date(n.created_at).toLocaleString();a.append(title,body,time);root.append(a)}}async function start(){if(started||!$('zi-v58-list'))return;started=true;try{await refresh()}catch(e){$('zi-v58-list').textContent=e.message}document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});setInterval(()=>{if(!document.hidden)refresh()},30000)}
// Unified top bell for announcement and leave notifications.
function setupTopBell(){
 const toggle=$('zi-notice-toggle'),popup=$('zi-notice-popover'),close=$('zi-notice-close');
 if(!toggle||!popup||toggle.dataset.bound)return;
 toggle.dataset.bound='1';
 const count=()=>{const a=Number(($('zi-v58-unread')?.textContent||'').match(/[0-9]+/)?.[0]||0);
   const b=Number($('zi-v55-count')?.textContent||0);
   const n=Math.max(0,a)+Math.max(0,b),badge=$('zi-notice-badge');
   if(badge){badge.textContent=n>99?'99+':String(n);badge.hidden=n===0;}
   toggle.setAttribute('aria-label',n?'ئاگەهداریان، '+n+' نەخوینـدی':'ئاگەهداریان');
 };
 const setOpen=(open)=>{popup.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)refresh().catch(()=>{});};
 toggle.addEventListener('click',()=>setOpen(popup.hidden));
 close?.addEventListener('click',()=>setOpen(false));
 document.addEventListener('click',e=>{if(!popup.hidden&&!$('zi-notice-toolbar')?.contains(e.target))setOpen(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!popup.hidden){setOpen(false);toggle.focus();}});
 const observer=new MutationObserver(count);
 for(const id of ['zi-v58-unread','zi-v55-count']){const node=$(id);if(node)observer.observe(node,{childList:true,characterData:true,subtree:true});}
 count();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupTopBell);
else setupTopBell();
window.addEventListener('ziata-ready',start);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(window.ziataContext)start()});else if(window.ziataContext)start()})();