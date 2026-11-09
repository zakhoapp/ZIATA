-- Run in Supabase SQL Editor before using Edit/Delete in ZIATA System 7.
-- Only approved admins or approved users with advances permission may edit/delete.
create table if not exists public.ziata_advance_audit (
 id bigint generated always as identity primary key,
 advance_id uuid not null,
 action text not null check(action in ('UPDATE','DELETE')),
 old_record jsonb not null,
 new_record jsonb,
 actor uuid not null,
 acted_at timestamptz not null default now()
);
alter table public.ziata_advance_audit enable row level security;
revoke all on public.ziata_advance_audit from anon, authenticated;
create or replace function public.ziata_manage_advance(
 p_id uuid,
 p_action text,
 p_advance integer default null,
 p_amount numeric default null,
 p_installment boolean default null,
 p_installment_no integer default null,
 p_notes text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_old public.ziata_advances%rowtype; v_new jsonb;
begin
 if auth.uid() is null or not coalesce(public.ziata_advance_allowed(),false) then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_action not in ('UPDATE','DELETE') then raise exception 'Invalid action'; end if;
 select * into v_old from public.ziata_advances where id=p_id for update;
 if not found then raise exception 'Advance not found'; end if;
 if p_action='DELETE' then
   delete from public.ziata_advances where id=p_id;
   insert into public.ziata_advance_audit(advance_id,action,old_record,actor)
   values(p_id,'DELETE',to_jsonb(v_old),auth.uid());
 else
   if p_advance is null or p_advance<1 or p_amount is null or p_amount<=0
     or (coalesce(p_installment,false) and (p_installment_no is null or p_installment_no<1))
     then raise exception 'Invalid advance fields'; end if;
   update public.ziata_advances set
     advance_number=p_advance,amount_iqd=p_amount,has_installment=coalesce(p_installment,false),
     installment_number=case when coalesce(p_installment,false) then p_installment_no else null end,
     notes=nullif(trim(coalesce(p_notes,'')),'')
   where id=p_id;
   select to_jsonb(a) into v_new from public.ziata_advances a where id=p_id;
   insert into public.ziata_advance_audit(advance_id,action,old_record,new_record,actor)
   values(p_id,'UPDATE',to_jsonb(v_old),v_new,auth.uid());
 end if;
end $$;
revoke all on function public.ziata_manage_advance(uuid,text,integer,numeric,boolean,integer,text) from public,anon;
grant execute on function public.ziata_manage_advance(uuid,text,integer,numeric,boolean,integer,text) to authenticated;
