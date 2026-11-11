(function(){
'use strict';
const cfg=window.ZIATA_SUPABASE;
if(!cfg){console.error('Missing Supabase config');return;}
const sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.ziataSB=sb;

/* V61: load the user-provided eagle image only after its asset is published.
   Until then all existing logos remain visible; no broken-image placeholders. */
(function installEmblem(){
  const newLogo='/ZIATA/ziata-logo.png';
  const oldLogos=new Set(['logo.webp','logo.png','favicon.png']);
  const apply=()=>{
    for(const img of document.querySelectorAll('img[src]')){
      const src=img.getAttribute('src')||'';
      if(oldLogos.has(src.split('/').pop().split('?')[0]) && !img.dataset.ziEagle){
        img.dataset.ziEagle='1';
        img.src=newLogo;
      }
    }
  };
  const preload=new Image();
  preload.onload=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();};
  preload.src=newLogo;
})();


window.ziataProxy = async (module, payload) => {
  if (!['transactions','engineers'].includes(module)) throw Error('Unsupported module');
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw Error('Login required');
  return fetch(cfg.url + '/functions/v1/ziata-gas-proxy', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':cfg.key},
    body:JSON.stringify({module, ...payload})
  });
};

const keys=['transactions','permits','engineers','projects','committees','letters','advances'];
const names=['برێڤەبرنا مامەلەیان','وەرگرتنا مۆڵەتێ','دەرکەفتنا ئەندازیاران','پولینکرنا پرۆژان','لێژنە و پرۆژە','ئەرشیفا نڤیساران','پێشینەیان'];
const page=location.pathname.split('/').pop()||'index.html';
const cookie=(token)=>{document.cookie='ziata_token='+(token?encodeURIComponent(token):'')+'; Path=/; SameSite=Lax; Secure; Max-Age='+(token?'3600':'0')};
async function session(){const {data}=await sb.auth.getSession();cookie(data.session?.access_token||'');return data.session;}
let contextPromise=null;
async function context(){
 if(contextPromise)return contextPromise;
 contextPromise=(async()=>{
  const s=await session();
  if(!s)return {session:null,profile:null,allowed:[]};
  // Independent requests run concurrently, reducing startup latency.
  const [profileResult,permissionsResult]=await Promise.all([
   sb.from('profiles').select('id,full_name,department,avatar_path,status,is_admin').eq('id',s.user.id).maybeSingle(),
   sb.from('user_permissions').select('system_key,can_access').eq('user_id',s.user.id)
  ]);
  if(profileResult.error)throw profileResult.error;
  const p=profileResult.data;
  if(!p||p.status!=='approved')return {session:s,profile:p,allowed:[]};
  if(permissionsResult.error && !p.is_admin)throw permissionsResult.error;
  return {session:s,profile:p,allowed:p.is_admin?keys:((permissionsResult.data||[]).filter(x=>x.can_access).map(x=>x.system_key))};
 })();
 try{return await contextPromise}catch(e){contextPromise=null;throw e}
}
window.ziataContext=context;
window.ziataLogout=async()=>{await sb.auth.signOut();cookie(null);location.replace('/ZIATA/login.html')};
function node(tag,attrs={},html=''){const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);el.innerHTML=html;return el}
function banner(message){let b=document.getElementById('ziata-auth-banner');if(!b){b=node('div',{id:'ziata-auth-banner',class:'zi-auth-banner'});document.body.prepend(b)}b.textContent=message;}
function secureLinks(allowed){document.querySelectorAll('a[href]').forEach(a=>{const path=new URL(a.href,location.href).pathname.split('/').pop().replace(/\.html$/,'');if(keys.includes(path)&&!allowed.includes(path)){a.hidden=true;a.style.setProperty('display','none','important');a.setAttribute('aria-hidden','true')}})}
async function init(){if(page==='login.html'||page==='register.html'||page==='reset-password.html'||page==='update-password.html')return;let ctx;try{ctx=await context()}catch(e){banner('نەشیام گرێدانێ دگەل Supabase پێک بینم. دووبارە هەوڵ بدە.');return}
if(!ctx.session){location.replace('/ZIATA/login.html?next='+encodeURIComponent(page));return}
if(!ctx.profile||ctx.profile.status!=='approved'){if(page!=='pending.html')location.replace('/ZIATA/pending.html');return}
if(page==='pending.html'){location.replace('/ZIATA/index.html');return}
const module=page.replace(/\.html$/,'');if(module==='committees'&&!ctx.profile.is_admin){location.replace('/ZIATA/my-professional-profile.html');return}if(keys.includes(module)&&!ctx.allowed.includes(module)){location.replace('/ZIATA/index.html');return}
document.documentElement.dataset.ziRole=ctx.profile.is_admin?'admin':'employee';secureLinks(ctx.allowed);
const committeeTile=document.querySelector('.zd-systems a[href="committees.html"]');
if(committeeTile&&!ctx.profile.is_admin){
 committeeTile.href='my-professional-profile.html';
 const heading=committeeTile.querySelector('strong');if(heading)heading.textContent='لێژنە و پرۆژەیێن من';
 const sub=committeeTile.querySelector('small');if(sub)sub.textContent='دەستکاریکرنا پرۆژە و لێژنەیێن خۆ';
 committeeTile.hidden=false;committeeTile.style.removeProperty('display');committeeTile.removeAttribute('aria-hidden');
}
if(!ctx.profile.is_admin){
 for(const link of document.querySelectorAll('.zi-desktop-sidebar a[href="my-professional-profile.html"],.zi-mobile-nav a[href="my-professional-profile.html"]')){
  link.hidden=false;link.style.removeProperty('display');link.removeAttribute('aria-hidden');
 }
}
const ownWork=document.querySelector('#zi-v79-my-work a[href="engineer-profiles.html"]');
if(ownWork&&!ctx.profile.is_admin){ownWork.href='my-professional-profile.html';ownWork.textContent='دەستکاریکرنا پروفایلێ پیشەیی ←';}
const count=document.getElementById('zi-system-count');if(count)count.textContent=ctx.allowed.length+' سیستەم';
const bar=node('div',{class:'zi-profile-menu'},'<button type="button" class="zi-profile-trigger" aria-expanded="false"><span class="zi-avatar-small" aria-hidden="true">👤</span><span class="zi-profile-label"><strong></strong><small>پروفایلێ من</small></span><span class="zi-chevron">⌄</span></button><div class="zi-profile-dropdown" hidden><a href="/ZIATA/profile.html">پروفایلێ من</a>'+(ctx.profile.is_admin?'<a href="/ZIATA/admin.html">برێڤەبرنا فەرمانبەران</a>':'')+'<button type="button" id="zi-logout">چوونا دەرڤە</button></div>');
const trigger=bar.querySelector('.zi-profile-trigger'),dropdown=bar.querySelector('.zi-profile-dropdown');bar.querySelector('strong').textContent=ctx.profile.full_name||ctx.session.user.email?.split('@')[0]||'فەرمانبەر';trigger.onclick=()=>{dropdown.hidden=!dropdown.hidden;trigger.setAttribute('aria-expanded',String(!dropdown.hidden))};document.addEventListener('click',e=>{if(!bar.contains(e.target)){dropdown.hidden=true;trigger.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){dropdown.hidden=true;trigger.setAttribute('aria-expanded','false')}});
const header=document.querySelector('.zi-appbar');if(header)header.appendChild(bar);else{bar.classList.add('zi-profile-standalone');document.body.prepend(bar)}
window.dispatchEvent(new CustomEvent('ziata-ready',{detail:ctx}));
if(ctx.profile.avatar_path){sb.storage.from('avatars').createSignedUrl(ctx.profile.avatar_path,3600).then(({data:avatar})=>{if(avatar?.signedUrl){const img=document.createElement('img');img.src=avatar.signedUrl;img.alt='وێنەیێ پروفایلێ';bar.querySelector('.zi-avatar-small').replaceChildren(img)}}).catch(e=>console.warn('Avatar unavailable',e));}bar.querySelector('#zi-logout').onclick=window.ziataLogout;
}
async function submitAuth(form,mode){const msg=form.querySelector('[role="alert"]');const btn=form.querySelector('button[type="submit"]');msg.textContent='';btn.disabled=true;try{const email=form.email.value.trim(),password=form.password.value;
if(mode==='register'){const name=form.full_name.value.trim();if(name.length<2)throw Error('ناڤێ تە زۆر کورتە');const {error}=await sb.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin+'/ZIATA/login.html'}});if(error)throw error;msg.textContent='حساب هاتە دروستکرن. ئەگەر ئیمەیلێ پشتڕاستکرنێ هات، وێ پشتڕاست بکە. پاشی چاوەڕێی پەسەندکرنا رێڤەبەری بە.';form.reset();}
else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;await session();location.replace('/ZIATA/index.html')}}catch(e){msg.textContent=e.message||'خەلەتی چێبوو'}finally{btn.disabled=false}}
window.ziataAuthSubmit=submitAuth;
window.ziataNames=Object.fromEntries(keys.map((k,i)=>[k,names[i]]));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();