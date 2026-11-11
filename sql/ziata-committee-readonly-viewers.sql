-- ZIATA read-only committee viewers. Run in Supabase SQL Editor.
-- Review the matching accounts before running: exact full_name values required.
create table if not exists public.ziata_committee_viewers (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.ziata_committee_viewers enable row level security;
revoke all on public.ziata_committee_viewers from anon;
grant select on public.ziata_committee_viewers to authenticated;
drop policy if exists ziata_committee_viewers_self on public.ziata_committee_viewers;
create policy ziata_committee_viewers_self on public.ziata_committee_viewers
for select to authenticated using (user_id=auth.uid());
-- Assign only after verifying these four exact account names. Modify names below if needed.
insert into public.ziata_committee_viewers(user_id)
select id from public.profiles
where status='approved' and lower(btrim(full_name)) in
 ('eng. heja','eng. salah','eng. jalal','sabir ahmad')
on conflict (user_id) do nothing;
create or replace function public.ziata_is_committee_viewer()
returns boolean language sql stable security definer set search_path=''
as $$ select exists (
 select 1 from public.ziata_committee_viewers v
 join public.profiles p on p.id=v.user_id
 where v.user_id=(select auth.uid()) and p.status='approved'
) $$;
revoke all on function public.ziata_is_committee_viewer() from public,anon;
grant execute on function public.ziata_is_committee_viewer() to authenticated;
drop policy if exists ziata_committees_viewer_select on public.ziata_committee_records;
create policy ziata_committees_viewer_select on public.ziata_committee_records
for select to authenticated using (public.ziata_is_committee_viewer());
-- Verify the exact matches; should return four names.
select p.id,p.full_name, (v.user_id is not null) as view_only_enabled
from public.profiles p left join public.ziata_committee_viewers v on v.user_id=p.id
where lower(p.full_name) like '%heja%' or lower(p.full_name) like '%salah%'
 or lower(p.full_name) like '%jalal%' or lower(p.full_name) like '%sabir%';
