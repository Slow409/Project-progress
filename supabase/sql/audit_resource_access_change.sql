create or replace function public.audit_resource_access_change()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
begin
 if old.access_enabled is distinct from new.access_enabled then
   insert into public.resource_access_events(
     project_id,resource_id,event_type,email,actor_user_id
   ) values (
     new.project_id,new.id,
     case when new.access_enabled then 'access_enabled' else 'access_disabled' end,
     new.email,auth.uid()
   );
 end if;
 return new;
end;
$fn$;
drop trigger if exists audit_resource_access_change on public.resources;
create trigger audit_resource_access_change
after update of access_enabled on public.resources
for each row execute function public.audit_resource_access_change();