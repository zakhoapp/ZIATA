-- ZIATA V68 — Committees migration (run in Supabase SQL Editor)
-- Back up source Google Sheet before importing. No existing table is dropped.
create table if not exists public.ziata_committee_records (
 id bigint generated always as identity primary key,
 staff_name text not null check (char_length(btrim(staff_name)) between 1 and 250),
 committee_type text not null default '' check (char_length(committee_type) <= 250),
 projects_text text not null default '',
 notes text not null default '',
 legacy_sheet_row integer unique,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ziata_committee_records_staff_idx on public.ziata_committee_records (staff_name);
create index if not exists ziata_committee_records_type_idx on public.ziata_committee_records (committee_type);

-- SECURITY DEFINER prevents RLS recursion; search_path is pinned.
create or replace function public.ziata_committees_can_read()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(
    select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'approved'
    and (p.is_admin or exists(
      select 1 from public.user_permissions up
      where up.user_id = p.id and up.system_key = 'committees' and up.can_access = true
    ))
  );
$$;
create or replace function public.ziata_committees_is_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'approved' and p.is_admin = true
  );
$$;
revoke all on function public.ziata_committees_can_read() from public;
revoke all on function public.ziata_committees_is_admin() from public;
grant execute on function public.ziata_committees_can_read() to authenticated;
grant execute on function public.ziata_committees_is_admin() to authenticated;

alter table public.ziata_committee_records enable row level security;
drop policy if exists "ziata_committees_select" on public.ziata_committee_records;
drop policy if exists "ziata_committees_admin_insert" on public.ziata_committee_records;
drop policy if exists "ziata_committees_admin_update" on public.ziata_committee_records;
drop policy if exists "ziata_committees_admin_delete" on public.ziata_committee_records;
create policy "ziata_committees_select" on public.ziata_committee_records
for select to authenticated using (public.ziata_committees_can_read());
create policy "ziata_committees_admin_insert" on public.ziata_committee_records
for insert to authenticated with check (public.ziata_committees_is_admin());
create policy "ziata_committees_admin_update" on public.ziata_committee_records
for update to authenticated using (public.ziata_committees_is_admin())
with check (public.ziata_committees_is_admin());
create policy "ziata_committees_admin_delete" on public.ziata_committee_records
for delete to authenticated using (public.ziata_committees_is_admin());

revoke all on table public.ziata_committee_records from anon;
grant select, insert, update, delete on public.ziata_committee_records to authenticated;
grant usage, select on sequence public.ziata_committee_records_id_seq to authenticated;
-- Only admins can write under RLS even when table privileges are granted.

create or replace function public.ziata_committee_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end;
$$;
drop trigger if exists ziata_committee_updated on public.ziata_committee_records;
create trigger ziata_committee_updated
before update on public.ziata_committee_records
for each row execute function public.ziata_committee_touch();

-- Validation: run after migration; count must match source nonempty Data rows.
select count(*) as migrated_committee_rows from public.ziata_committee_records;
