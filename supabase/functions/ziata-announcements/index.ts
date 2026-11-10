import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const allowedOrigins = new Set(['https://ziata.netlify.app', 'https://zakhoapp.github.io']);

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://ziata.netlify.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
  if (!allowedOrigins.has(origin)) return respond({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'POST only' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { data: { user }, error: authErr } = await client.auth.getUser(token);
    if (authErr || !user) return respond({ error: 'Login required' }, 401);

    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: profile, error: profileErr } = await db.from('profiles')
      .select('is_admin,status').eq('id', user.id).single();
    if (profileErr || !profile || profile.status !== 'approved') {
      return respond({ error: 'Approved account required' }, 403);
    }

    // Secretary permission is explicitly granted in ziata_notification_senders.
    // Existing admins remain authorized without requiring a separate grant.
    if (profile.is_admin !== true) {
      const { data: sender, error: senderErr } = await db
        .from('ziata_notification_senders')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (senderErr) {
        console.error('Notification permission lookup failed', senderErr);
        return respond({ error: 'Permission check failed' }, 500);
      }
      if (!sender) return respond({ error: 'Notification sender permission required' }, 403);
    }

    const input = await req.json();
    if (input.action === 'push_stats') {
      const { data: people, error: peopleError } = await db.from('profiles')
        .select('id,full_name').eq('status','approved').order('full_name').limit(2000);
      if (peopleError) throw peopleError;
      const { data: devices, error: devicesError } = await db.from('ziata_push_subscriptions')
        .select('user_id').limit(10000);
      if (devicesError) throw devicesError;
      const registered = new Set((devices || []).map(d => d.user_id));
      const employees = (people || []).map(p => ({
        id:p.id, full_name:p.full_name,
        push_registered:registered.has(p.id)
      }));
      return respond({
        total:employees.length,
        registered:employees.filter(p=>p.push_registered).length,
        unregistered:employees.filter(p=>!p.push_registered).length,
        employees,
        note:'Registration only; delivery and device permission are not verified.'
      });
    }
    if (input.action === 'users') {
      const { data, error } = await db.from('profiles')
        .select('id,full_name').eq('status', 'approved').order('full_name').limit(2000);
      if (error) throw error;
      return respond({ users: data });
    }
    if (input.action !== 'send') return respond({ error: 'Invalid action' }, 400);

    const title = String(input.title || '').trim();
    const body = String(input.body || '').trim();
    if (!title || title.length > 90 || !body || body.length > 5000) {
      return respond({ error: 'Invalid title or body' }, 400);
    }

    const { data: profiles, error: pe } = await db.from('profiles')
      .select('id').eq('status', 'approved').limit(2000);
    if (pe) throw pe;
    const approved = new Set((profiles || []).map(x => x.id));
    let ids: string[] = [];
    if (input.scope === 'all') ids = [...approved];
    else if (input.scope === 'selected' && Array.isArray(input.user_ids)) {
      ids = [...new Set(input.user_ids.filter((x: unknown) =>
        typeof x === 'string' && approved.has(x as string)))];
    } else return respond({ error: 'Invalid recipients' }, 400);

    if (ids.length === 0 || ids.length > 2000) return respond({ error: 'No valid recipients' }, 400);

    const { data: announcement, error: ae } = await db.from('ziata_announcements')
      .insert({ title, body, created_by: user.id }).select('id').single();
    if (ae || !announcement) throw ae || Error('Insert failed');

    const { error: re } = await db.from('ziata_announcement_recipients')
      .insert(ids.map(id => ({ announcement_id: announcement.id, user_id: id })));
    if (re) throw re;

    const { data: subs, error: se } = await db.from('ziata_push_subscriptions')
      .select('id,user_id,subscription').in('user_id', ids).limit(5000);
    if (se) throw se;

    const pub = Deno.env.get('VAPID_PUBLIC_KEY');
    const priv = Deno.env.get('VAPID_PRIVATE_KEY');
    let sent = 0, failed = 0;
    const expired: number[] = [];
    if (pub && priv) {
      webpush.setVapidDetails(
        Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com', pub, priv
      );
      const devices = subs || [];
      for (let i = 0; i < devices.length; i += 10) {
        await Promise.all(devices.slice(i, i + 10).map(async s => {
          try {
            await webpush.sendNotification(s.subscription, JSON.stringify({
              title, body: body.slice(0, 180),
              url: `${origin === 'https://zakhoapp.github.io' ? '/ZIATA' : ''}/notification.html?id=${announcement.id}`,
              notification_id: `announcement-${announcement.id}`,
              kind: 'announcement'
            }), { TTL: 86400 });
            sent++;
          } catch (e) {
            failed++;
            if ([404, 410].includes(Number((e as { statusCode?: number }).statusCode))) expired.push(s.id);
          }
        }));
      }
      if (expired.length) await db.from('ziata_push_subscriptions').delete().in('id', expired);
    }
    return respond({ announcement_id: announcement.id, recipients: ids.length, sent, failed });
  } catch (e) {
    console.error(e);
    return respond({ error: 'Server error; check function logs' }, 500);
  }
});
