-- ZIATA: allow approved employees to read their own official committee records.
-- Preserves existing admin/committee read policy.
create or replace function public.ziata_can_read_my_committee_record(p_employee_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select p_employee_id = (select auth.uid()) and exists (
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.status='approved'
 );
$$;
revoke all on function public.ziata_can_read_my_committee_record(uuid) from public,anon;
grant execute on function public.ziata_can_read_my_committee_record(uuid) to authenticated;
alter table public.ziata_committee_records enable row level security;
drop policy if exists "ziata_employee_own_committee_select" on public.ziata_committee_records;
create policy "ziata_employee_own_committee_select"
on public.ziata_committee_records for select to authenticated
using (public.ziata_can_read_my_committee_record(employee_id));
grant select on public.ziata_committee_records to authenticated;
-- Existing committee permission-based SELECT remains in effect for full catalog.
