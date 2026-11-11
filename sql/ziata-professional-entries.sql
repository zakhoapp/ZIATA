-- Run once in Supabase SQL Editor before using the professional profile editor.
create table if not exists public.ziata_professional_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 entry_type text not null check (entry_type in ('project','committee')),
 title text not null check (char_length(btrim(title)) between 2 and 250),
 role_name text not null default '',
 project_name text not null default '',
 start_date date,
 end_date date,
 work_status text not null default 'active' check (work_status in ('active','completed','paused')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ziata_professional_entries_dates check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists ziata_professional_entries_user_idx on public.ziata_professional_entries(user_id,entry_type);
alter table public.ziata_professional_entries enable row level security;
drop policy if exists "Read professional entries" on public.ziata_professional_entries;
create policy "Read professional entries" on public.ziata_professional_entries
 for select to authenticated using (
 exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved')
 );
drop policy if exists "Add own professional entries" on public.ziata_professional_entries;
create policy "Add own professional entries" on public.ziata_professional_entries
 for insert to authenticated with check (
 user_id=(select auth.uid()) and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved')
 );
drop policy if exists "Edit own professional entries" on public.ziata_professional_entries;
create policy "Edit own professional entries" on public.ziata_professional_entries
 for update to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
drop policy if exists "Delete own professional entries" on public.ziata_professional_entries;
create policy "Delete own professional entries" on public.ziata_professional_entries
 for delete to authenticated using (user_id=(select auth.uid()));
revoke all on public.ziata_professional_entries from anon;
grant select,insert,update,delete on public.ziata_professional_entries to authenticated;
-- Prevent changing ownership or creation time through UPDATE.
create or replace function public.ziata_professional_entry_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id then raise exception 'Cannot transfer ownership'; end if;
 new.created_at=old.created_at;
 new.updated_at=now();
 return new;
end $$;
drop trigger if exists ziata_professional_entry_guard_trigger on public.ziata_professional_entries;
create trigger ziata_professional_entry_guard_trigger
before update on public.ziata_professional_entries
for each row execute function public.ziata_professional_entry_guard();
