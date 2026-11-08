/* ZIATA V66 — read-only admin dashboard, sourced from authenticated Supabase queries. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let running = false, ready = false, canRefresh = false;
  const bangkok = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  function todayLocal() {
    const p = Object.fromEntries(bangkok.formatToParts(new Date()).map(x => [x.type, x.value]));
    return p.year + '-' + p.month + '-' + p.day;
  }
  const setNumber = (id, value) => { const el = $(id); if (el) el.textContent = value == null ? '—' : String(value); };
  function issue(message) {
    const el = $('zi-v66-error');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }
  function decisionOf(item) {
    const list = Array.isArray(item.ziata_leave_decisions) ? item.ziata_leave_decisions : [];
    return list.find(x => x.role === 'deputy')?.decision || null;
  }
  function statusOf(decision) {
    return decision === 'approved' ? 'پەسەندکری' :
      decision === 'rejected' ? 'رەتکری' : 'چاوەڕێی بڕیارێ';
  }
  function renderRecent(rows) {
    const root = $('zi-v66-recent');
    if (!root) return;
    root.replaceChildren();
    if (!rows.length) { root.textContent = 'هێشتا داخوازەک نەهاتیە تۆمارکرن'; return; }
    for (const item of rows.slice(0, 5)) {
      const a = document.createElement('a');
      a.className = 'zi-v66-recent-row';
      a.href = 'permits.html?request=' + encodeURIComponent(item.id);
      const info = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.employee_name || 'فەرمانبەر';
      const sub = document.createElement('small');
      sub.textContent = 'داخواز #' + item.id + ' · ' + (item.start_date || '—');
      const badge = document.createElement('em');
      const decision = decisionOf(item);
      badge.className = 'zi-v66-status ' + (decision || 'pending');
      badge.textContent = statusOf(decision);
      info.append(title, sub); a.append(info, badge); root.append(a);
    }
  }
  async function getCount(sb, status) {
    const { count, error } = await sb.from('profiles')
      .select('id', { count: 'exact', head: true }).eq('status', status);
    if (error) throw error;
    return count;
  }
  // Fetch a limited number of records; never represent a truncated result as exact.
  async function getLeaves(sb) {
    const {data, error} = await sb.from('ziata_leave_requests')
      .select('id,employee_name,leave_type,start_date,end_date,created_at,ziata_leave_decisions(role,decision)')
      .order('created_at', {ascending:false}).limit(1000);
    if (error) throw error;
    return data || [];
  }
  async function refresh() {
    if (running || !canRefresh || document.hidden) return;
    running = true;
    const button = $('zi-v66-refresh');
    if (button) button.disabled = true;
    issue('');
    try {
      const sb = window.ziataSB;
      const results = await Promise.allSettled([
        getCount(sb, 'approved'),
        getCount(sb, 'pending'),
        getLeaves(sb)
      ]);
      const failures = [];
      const ids = ['zi-v66-active', 'zi-v66-pending-accounts'];
      for (let i=0;i<2;i++) {
        const result = results[i];
        if (result.status === 'fulfilled') setNumber(ids[i], result.value);
        else { setNumber(ids[i], null); failures.push(result.reason?.message || 'نەشیا حسابان بخوینیت'); }
      }
      const leaves = results[2];
      if (leaves.status === 'fulfilled') {
        const rows = leaves.value;
        const truncated = rows.length >= 1000;
        const pending = rows.filter(x => !['approved','rejected'].includes(decisionOf(x))).length;
        const today = todayLocal();
        const approvedToday = rows.filter(x =>
          decisionOf(x) === 'approved' && x.start_date && x.start_date <= today &&
          (x.end_date || x.start_date) >= today
        ).length;
        setNumber('zi-v66-pending-leave', truncated ? pending + '+' : pending);
        setNumber('zi-v66-today', truncated ? approvedToday + '+' : approvedToday);
        renderRecent(rows);
        if (truncated) failures.push('ئامارێن مولەتان نێزیکی ن؛ بتنێ 1000 داخوازێن دوماهیێ هاتنە خوێندن.');
      } else {
        setNumber('zi-v66-pending-leave', null);
        setNumber('zi-v66-today', null);
        $('zi-v66-recent').textContent = 'زانیاریێن مولەتان نەهاتنە بارکرن';
        failures.push(leaves.reason?.message || 'نەشیا مولەتان بخوینیت');
      }
      $('zi-v66-updated').textContent = 'دوماهیک نویکرن: ' +
        new Intl.DateTimeFormat('ku', {timeZone:'Asia/Baghdad', hour:'2-digit', minute:'2-digit'}).format(new Date());
      if (failures.length) issue('هندەک ئامار نەهاتنە بارکرن: ' + failures.join(' · '));
    } finally {
      running = false;
      if (button) button.disabled = false;
    }
  }
  async function start() {
    if (ready || !$('zi-v66-admin') || !window.ziataContext || !window.ziataSB) return;
    let ctx;
    try {ctx = await window.ziataContext();} catch (e) {return;}
    if (!ctx.session?.user || !ctx.profile?.is_admin || ctx.profile.status !== 'approved') return;
    ready = true;
    canRefresh = true;
    $('zi-v66-admin').hidden = false;
    $('zi-v66-refresh').addEventListener('click', refresh);
    document.addEventListener('visibilitychange', () => {if (!document.hidden) refresh();});
    setInterval(() => {if (!document.hidden) refresh();}, 60000);
    await refresh();
  }
  window.addEventListener('ziata-ready', start);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
