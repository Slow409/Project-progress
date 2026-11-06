-- Expose ancestor names only for tasks the caller already has permission to read.
-- Ancestor rows, reports, assignments and media remain protected by existing RLS.
create or replace function private.task_project_area(p_task_id uuid)
returns text language sql stable security definer set search_path = ''
as $function$
  with recursive ancestors as (
    select t.id, t.project_id, t.parent_task_uid, array[t.id] as visited,
           array[]::text[] as names
    from public.tasks t
    where t.id = p_task_id and (select auth.uid()) is not null
      and (exists(select 1 from public.projects p where p.id=t.project_id and p.owner_user_id=(select auth.uid()))
           or private.has_assigned_task_access(t.id))
    union all
    select p.id, p.project_id, p.parent_task_uid, a.visited || p.id,
           array[p.name] || a.names
    from ancestors a join public.tasks p
      on p.project_id=a.project_id and p.project_task_uid=a.parent_task_uid
    where not p.id=any(a.visited)
  )
  select coalesce(nullif(array_to_string(a.names, ' / '), ''), p.name)
  from ancestors a join public.projects p on p.id=a.project_id
  order by cardinality(a.visited) desc limit 1;
$function$;
revoke all on function private.task_project_area(uuid) from public, anon;
grant execute on function private.task_project_area(uuid) to authenticated;

create or replace function public.get_task_project_areas(p_project_id uuid)
returns table(task_id uuid, project_area text)
language sql stable security invoker set search_path = ''
as $function$
  select t.id, private.task_project_area(t.id)
  from public.tasks t where t.project_id=p_project_id;
$function$;
revoke all on function public.get_task_project_areas(uuid) from public, anon;
grant execute on function public.get_task_project_areas(uuid) to authenticated;
