-- ZIATA secretary notification senders. Run in Supabase SQL Editor.
-- Grant secretary access by inserting their auth.users UUID into this table.
create table if not exists public.ziata_notification_senders (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now(),
 granted_by uuid references auth.users(id)
);
alter table public.ziata_notification_senders enable row level security;
drop policy if exists "notification senders read self" on public.ziata_notification_senders;
create policy "notification senders read self" on public.ziata_notification_senders
for select to authenticated using (
 user_id=auth.uid() or exists (
  select 1 from public.profiles p
  where p.id=auth.uid() and p.is_admin=true and p.status='approved'
 )
);
drop policy if exists "notification senders admin insert" on public.ziata_notification_senders;
create policy "notification senders admin insert" on public.ziata_notification_senders
for insert to authenticated with check (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true and p.status='approved')
);
drop policy if exists "notification senders admin delete" on public.ziata_notification_senders;
create policy "notification senders admin delete" on public.ziata_notification_senders
for delete to authenticated using (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_admin=true and p.status='approved')
);
grant select,insert,delete on public.ziata_notification_senders to authenticated;

-- IMPORTANT: Edge Function ziata-announcements must also authorize approved
-- secretary senders for BOTH action='users' and action='send'.
-- Check server-side using the authenticated user's JWT; never trust a client role flag.
-- Example authorization predicate inside the function (after JWT validation):
-- const { data: sender } = await adminClient.from('ziata_notification_senders')
--   .select('user_id').eq('user_id', user.id).maybeSingle();
-- const authorized = profile?.status === 'approved' && (profile.is_admin || !!sender);
-- if (!authorized) return new Response(JSON.stringify({error:'Forbidden'}), {status:403});
-- Do NOT grant access to other admin actions.
