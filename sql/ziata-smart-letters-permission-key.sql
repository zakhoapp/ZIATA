-- Run in Supabase SQL Editor: permit the new smart-letter-notifications system key.
-- Keeps existing permissions; does not grant anyone access automatically.
do $$
declare
  col_type text;
  c record;
begin
  select format_type(a.atttypid,a.atttypmod) into col_type
  from pg_attribute a
  where a.attrelid='public.user_permissions'::regclass
    and a.attname='system_key' and not a.attisdropped;
  if col_type is null then raise exception 'user_permissions.system_key not found'; end if;
  if col_type not in ('text','character varying') then
    raise exception 'Unexpected system_key type: %. Inspect column before migration.',col_type;
  end if;
  -- Replace only check constraints explicitly referencing system_key.
  for c in
    select conname from pg_constraint
    where conrelid='public.user_permissions'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) like '%system_key%'
  loop
    execute format('alter table public.user_permissions drop constraint %I',c.conname);
  end loop;
  alter table public.user_permissions
  add constraint user_permissions_system_key_allowed
  check (system_key in (
    'transactions','permits','engineers','projects','committees',
    'letters','advances','smart-letter-notifications'
  ));
end $$;
-- Confirm the allowed values and then save permissions again in Admin.
