-- ZIATA V80: stable account UUID bindings for committee and project assignments.
-- Run after V68. Never guess identity from names; admin links each record to a profile UUID.
alter table public.ziata_committee_records
  add column if not exists employee_id uuid references public.profiles(id) on delete set null;
create index if not exists ziata_committee_records_employee_id_idx
  on public.ziata_committee_records(employee_id);

-- Replace V79 name-based lookup. Security definer deliberately ignores any caller-supplied user ID.
create or replace function public.ziata_my_work_summary()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  record_count integer := 0;
  committee_count integer := 0;
  project_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.status='approved'
  ) then
    raise exception 'Approved account required' using errcode='42501';
  end if;

  select count(*)::integer into record_count
  from public.ziata_committee_records r
  where r.employee_id=auth.uid();

  select count(distinct lower(btrim(part)))::integer into committee_count
  from public.ziata_committee_records r
  cross join lateral regexp_split_to_table(coalesce(r.committee_type,''), E'[\\n\\r;؛]+') as part
  where r.employee_id=auth.uid() and btrim(part)<>'';

  select count(distinct lower(btrim(part)))::integer into project_count
  from public.ziata_committee_records r
  cross join lateral regexp_split_to_table(coalesce(r.projects_text,''), E'[\\n\\r]+') as part
  where r.employee_id=auth.uid() and btrim(part)<>'';

  return jsonb_build_object(
    'committee_count',coalesce(committee_count,0),
    'project_count',coalesce(project_count,0),
    'matched_records',record_count,
    'identity_source','employee_id'
  );
end;
$$;
revoke all on function public.ziata_my_work_summary() from public,anon;
grant execute on function public.ziata_my_work_summary() to authenticated;

-- Admin-only updates are already enforced by V68 RLS on ziata_committee_records.
-- Existing unlinked rows intentionally remain NULL pending explicit administrator selection.
select count(*) as unlinked_records from public.ziata_committee_records where employee_id is null;
