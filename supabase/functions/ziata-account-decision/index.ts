import { withSupabase } from 'npm:@supabase/server@^1'

const cors = {
  'Access-Control-Allow-Origin': 'https://zakhoapp.github.io',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })
const isUUID = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const handler = withSupabase({ auth: 'user' }, async (request, ctx) => {
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  let input: { user_id?: unknown; status?: unknown }
  try { input = await request.json() } catch { return respond({ error: 'Invalid JSON' }, 400) }
  const targetId = input.user_id
  const status = input.status
  if (!isUUID(targetId) || !['approved', 'rejected'].includes(String(status))) {
    return respond({ error: 'Invalid account or decision' }, 400)
  }

  const actor = ctx.userClaims?.id
  if (!actor) return respond({ error: 'Unauthorized' }, 401)
  const { data: admin, error: adminError } = await ctx.supabaseAdmin
    .from('profiles').select('id,is_admin,status').eq('id', actor).maybeSingle()
  if (adminError || !admin || admin.status !== 'approved' || admin.is_admin !== true) {
    return respond({ error: 'Admin only' }, 403)
  }
  const { data: target, error: targetError } = await ctx.supabaseAdmin
    .from('profiles').select('id,full_name,status,is_admin').eq('id', targetId).maybeSingle()
  if (targetError || !target) return respond({ error: 'Employee not found' }, 404)
  if (target.is_admin || actor === target.id) return respond({ error: 'Cannot change administrator' }, 403)
  if (target.status === status) return respond({ changed: false, email_sent: false, already_set: true })

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from) return respond({ error: 'Email service not configured; account not changed' }, 503)
  const { data: authResult, error: emailLookupError } =
    await ctx.supabaseAdmin.auth.admin.getUserById(targetId)
  const email = authResult?.user?.email
  if (emailLookupError || !email) return respond({ error: 'Employee email unavailable; account not changed' }, 422)

  const { data: changed, error: changeError } = await ctx.supabaseAdmin
    .from('profiles').update({ status }).eq('id', targetId).eq('status', target.status)
    .select('id,status')
  if (changeError) return respond({ error: 'Could not update account: ' + changeError.message }, 500)
  if (changed?.length !== 1) return respond({ error: 'Account was changed concurrently; refresh and retry' }, 409)

  const person = String(target.full_name || 'فەرمانبەر').slice(0, 120)
  const approved = status === 'approved'
  const subject = approved ? 'ZIATA — Account Approved' : 'ZIATA — Account Rejected'
  const body = approved
    ? `بەرێز ${person}،\n\nحسابێ تە ل سیستەمێ ZIATA هاتە پەسەندکرن.\nنوکە دشێی بچیە ژوورڤە و سیستەمێن بۆ تە رێپێدای بکاربینی.\n\nhttps://zakhoapp.github.io/ZIATA/login.html\n\nZIATA · کاروبارێن تەکنیکی`
    : `بەرێز ${person}،\n\nداخوازیا دروستکرنا حسابێ تە ل سیستەمێ ZIATA نەهاتە پەسەندکرن.\nبۆ زانیاریێن پتر پەیوەندیێ ب رێڤەبەریێ بکە.\n\nZIATA · کاروبارێن تەکنیکی`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject, text: body }),
    })
    if (!response.ok) {
      console.error('ZIATA email delivery rejected', response.status, (await response.text()).slice(0, 350))
      return respond({ changed: true, email_sent: false, warning: 'Account updated, but email provider rejected the message' }, 200)
    }
    return respond({ changed: true, email_sent: true })
  } catch (e) {
    console.error('ZIATA email delivery failed', e)
    return respond({ changed: true, email_sent: false, warning: 'Account updated, but email delivery failed' }, 200)
  }
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  return handler(req)
})
