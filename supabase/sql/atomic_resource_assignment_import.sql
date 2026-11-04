-- Transactional resource/assignment import applied to Supabase.
create unique index if not exists resources_project_uid_unique_idx on public.resources(project_id,project_resource_uid) where project_resource_uid is not null;
grant delete on public.task_resources to authenticated;
CREATE OR REPLACE FUNCTION public.apply_project_xml_plan_with_resources(p_project_id uuid, p_file_name text, p_plan jsonb, p_resources jsonb, p_assignments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_result jsonb;
  v_item jsonb;
  v_resource record;
  v_inserted integer := 0;
  v_links integer := 0;
  v_removed integer := 0;
begin
  if auth.uid() is null or not public.is_project_owner(p_project_id) then
    raise exception 'Nur Projektverantwortliche dürfen Ressourcen importieren.';
  end if;
  if jsonb_typeof(p_resources) <> 'array' or jsonb_typeof(p_assignments) <> 'array'
     or jsonb_array_length(p_resources) > 5000 or jsonb_array_length(p_assignments) > 20000 then
    raise exception 'Ungültige Ressourcen- oder Zuordnungsliste.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_resources) x
    where jsonb_typeof(x) <> 'object'
      or coalesce(x->>'uid','') !~ '^[1-9][0-9]{0,8}$'
      or length(coalesce(x->>'name','')) not between 1 and 250
  ) or exists (
    select 1 from jsonb_array_elements(p_resources) x group by x->>'uid' having count(*) > 1
  ) then raise exception 'Ungültige oder doppelte Ressourcen-UID.'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) x
    where jsonb_typeof(x) <> 'object'
      or coalesce(x->>'taskUid','') !~ '^[1-9][0-9]{0,8}$'
      or coalesce(x->>'resourceUid','') !~ '^[1-9][0-9]{0,8}$'
      or not exists(select 1 from jsonb_array_elements(p_plan) t where t->>'uid' = x->>'taskUid')
      or not exists(select 1 from jsonb_array_elements(p_resources) r where r->>'uid' = x->>'resourceUid')
  ) or exists (
    select 1 from jsonb_array_elements(p_assignments) x
    group by x->>'taskUid',x->>'resourceUid' having count(*) > 1
  ) then raise exception 'Ungültige oder doppelte Ressourcenzuordnungen.'; end if;

  -- Task upsert preserves task UUIDs, and the entire RPC is atomic.
  v_result := public.apply_project_xml_plan(p_project_id,p_file_name,p_plan);
  for v_item in select value from jsonb_array_elements(p_resources) loop
    select id into v_resource
      from public.resources
      where project_id=p_project_id and project_resource_uid=(v_item->>'uid')::integer for update;
    if v_resource.id is null then
      insert into public.resources(project_id,project_resource_uid,name,access_enabled)
      values(p_project_id,(v_item->>'uid')::integer,v_item->>'name',false);
      v_inserted := v_inserted + 1;
    else
      -- Identity and access fields are deliberately left untouched.
      update public.resources set name=v_item->>'name' where id=v_resource.id
         and name is distinct from v_item->>'name';
    end if;
  end loop;

  -- Retired assignment links are removed; historical progress/media records remain unchanged.
  delete from public.task_resources tr
  using public.tasks t, public.resources r
  where tr.task_id=t.id and tr.resource_id=r.id and t.project_id=p_project_id
    and r.project_id=p_project_id
    and not exists (
      select 1 from jsonb_array_elements(p_assignments) a
      where (a->>'taskUid')::integer=t.project_task_uid
        and (a->>'resourceUid')::integer=r.project_resource_uid
    );
  get diagnostics v_removed = row_count;

  insert into public.task_resources(task_id,resource_id)
  select t.id,r.id
  from jsonb_array_elements(p_assignments) a
  join public.tasks t on t.project_id=p_project_id and t.project_task_uid=(a->>'taskUid')::integer
  join public.resources r on r.project_id=p_project_id and r.project_resource_uid=(a->>'resourceUid')::integer
  on conflict do nothing;
  get diagnostics v_links = row_count;

  return v_result || jsonb_build_object(
    'resourcesAdded',v_inserted,'assignmentsAdded',v_links,'assignmentsRemoved',v_removed
  );
end
$function$
;
revoke all on function public.apply_project_xml_plan_with_resources(uuid,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.apply_project_xml_plan_with_resources(uuid,text,jsonb,jsonb,jsonb) to authenticated;
