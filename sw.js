/* ZIATA V54 — targeted notification navigation; no private data caching. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const HOME = '/ZIATA/index.html';
const PERMITS = '/ZIATA/permits.html';
const ANNOUNCEMENT = '/ZIATA/notification.html';
function validId(value) {
  const s = String(value ?? '');
  return /^[1-9][0-9]{0,14}$/.test(s) ? s : null;
}
function safeTarget(input) {
  try {
    const url=new URL(String(input||HOME),self.location.origin);
    if(url.origin!==self.location.origin)return new URL(HOME,self.location.origin).href;
    let path=url.pathname;
    // Existing push payloads still contain Netlify-style root links.
    if(path==='/notification.html')path=ANNOUNCEMENT;
    if(path==='/permits.html')path=PERMITS;
    if(path==='/admin.html')path='/ZIATA/admin.html';
    if(path==='/index.html')path=HOME;
    if(path===ANNOUNCEMENT){
      const id=validId(url.searchParams.get('id'));
      return new URL(ANNOUNCEMENT+(id?'?id='+id:''),self.location.origin).href;
    }
    if(path===PERMITS){
      const id=validId(url.searchParams.get('request'));
      return new URL(PERMITS+(id?'?request='+id:''),self.location.origin).href;
    }
    if(path==='/ZIATA/admin.html')return new URL(path,self.location.origin).href;
    return new URL(HOME,self.location.origin).href;
  }catch(_){return new URL(HOME,self.location.origin).href;}
}
function notificationTarget(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const d = p.data && typeof p.data === 'object' ? p.data : {};
  const record = p.record && typeof p.record === 'object' ? p.record : {};
  const id = validId(p.request_id ?? p.requestId ?? p.leave_request_id ?? d.request_id ?? d.requestId ?? d.leave_request_id ?? record.request_id ?? record.leave_request_id);
  if (id) return safeTarget(PERMITS + '?request=' + id);
  const rawUrl = p.url || p.click_url || p.target_url || d.url || d.click_url || record.url;
  if (rawUrl) return safeTarget(rawUrl);
  // If the notification is explicitly about leave but lacks a request ID,
  // open the permits page rather than the home page.
  const kind = String(p.type || p.kind || d.type || p.category || '').toLowerCase();
  if (kind.includes('leave') || kind.includes('permit')) return safeTarget(PERMITS);
  return safeTarget(HOME);
}
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = {body: event.data ? event.data.text() : ''}; }
  const title = String(payload.title || 'ZIATA');
  const body = String(payload.body || 'ئاگەهداریەکا نوی');
  const target = notificationTarget(payload);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/ZIATA/icons/icon-192.png?v=63',
    badge: '/ZIATA/icons/icon-192.png?v=63',
    tag: 'ziata-' + (payload.notification_id || Date.now()),
    data: {url: target}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = safeTarget(event.notification.data?.url);
    const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      try {
        if (client.navigate) {
          const navigated = await client.navigate(target);
          if (navigated) { await navigated.focus(); return; }
        }
      } catch (_) { /* Open a new window if navigation fails. */ }
    }
    await self.clients.openWindow(target);
  })());
});
