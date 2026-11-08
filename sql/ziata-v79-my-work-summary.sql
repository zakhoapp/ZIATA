-- ZIATA V79: personal dashboard assignment counters.
-- Run in Supabase SQL Editor after sql/ziata-v68-committees.sql.
-- Counts are computed server-side for the signed-in approved profile only.
-- Name matching is temporary until each engineer has a stable employee ID.
create or replace function public.ziata_my_work_summary()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  current_name text;
  matched_records integer := 0;
  committee_count integer := 0;
  project_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select p.full_name into current_name
    from public.profiles p
   where p.id = auth.uid() and p.status = 'approved';
  if current_name is null or pg_catalog.btrim(current_name) = '' then
    raise exception 'Approved profile with full name required' using errcode = '42501';
  end if;

  -- Match the approved account's name, normalizing case and repeated whitespace.
  with matched as (
    select r.committee_type, r.projects_text
      from public.ziata_committee_records r
     where pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(r.staff_name), '[[:space:]]+', ' ', 'g'))
         = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(current_name), '[[:space:]]+', ' ', 'g'))
  )
  select count(*) into matched_records from matched;

  with matched as (
    select r.committee_type, r.projects_text
      from public.ziata_committee_records r
     where pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(r.staff_name), '[[:space:]]+', ' ', 'g'))
         = pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(current_name), '[[:space:]]+', ' ', 'g'))
  )
  select
    (select count(distinct pg_catalog.lower(pg_catalog.btrim(v)))::integer
       from matched m cross join lateral
       pg_catalog.regexp_split_to_table(coalesce(m.committee_type,''), E'[\\n\\r;؛]+') v
      where pg_catalog.btrim(v) <> ''),
    (select count(distinct pg_catalog.lower(pg_catalog.btrim(v)))::integer
       from matched m cross join lateral
       pg_catalog.regexp_split_to_table(coalesce(m.projects_text,''), E'[\\n\\r]+') v
      where pg_catalog.btrim(v) <> '')
  into committee_count, project_count;

  return pg_catalog.jsonb_build_object(
    'committee_count', coalesce(committee_count,0),
    'project_count', coalesce(project_count,0),
    'matched_records', matched_records
  );
end;
$$;
revoke all on function public.ziata_my_work_summary() from public, anon;
grant execute on function public.ziata_my_work_summary() to authenticated;
