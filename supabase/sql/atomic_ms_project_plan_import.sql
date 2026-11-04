-- Canonical server function deployed to Supabase.
CREATE OR REPLACE FUNCTION public.apply_project_xml_plan(p_project_id uuid, p_file_name text, p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_import_id uuid;
  v_count integer;
  v_timezone text;
  v_added integer := 0;
  v_changed integer := 0;
  v_retired integer := 0;
  v_t record;
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
  v_parent integer;
  v_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  if v_actor is null or not exists (
    select 1 from public.projects where id = p_project_id and owner_user_id = v_actor
  ) then
    raise exception 'Nur Projektverantwortliche dürfen Pläne importieren.';
  end if;
  select timezone into v_timezone from public.projects where id=p_project_id;
  if jsonb_typeof(p_plan) <> 'array' then
    raise exception 'Der Projektplan muss eine Liste von Vorgängen enthalten.';
  end if;
  v_count := jsonb_array_length(p_plan);
  if v_count < 1 or v_count > 5000 then
    raise exception 'Ein Plan muss 1 bis 5000 Vorgänge enthalten.';
  end if;
  if length(coalesce(p_file_name, '')) < 1 or length(p_file_name) > 255 then
    raise exception 'Ungültiger Dateiname.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_plan) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(item->>'uid','') !~ '^[1-9][0-9]{0,8}$'
      or length(coalesce(item->>'name','')) not between 1 and 500
      or coalesce(item->>'level','') !~ '^[1-9][0-9]?$'
      or (item ? 'parentUid' and item->>'parentUid' is not null
          and item->>'parentUid' !~ '^[1-9][0-9]{0,8}$')
      or (item ? 'start' and item->>'start' is not null
          and item->>'start' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T')
      or (item ? 'finish' and item->>'finish' is not null
          and item->>'finish' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T')
  ) then
    raise exception 'Projektplan enthält ungültige Pflichtfelder.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_plan) item
    group by item->>'uid' having count(*) > 1
  ) then
    raise exception 'Vorgangs-UIDs müssen eindeutig sein.';
  end if;
  insert into public.plan_imports(project_id,imported_by,file_name,status,source_project_name,summary)
  values(p_project_id,v_actor,p_file_name,'preview',null,jsonb_build_object('taskCount',v_count))
  returning id into v_import_id;

  for v_t in select x.value as item from jsonb_array_elements(p_plan) with ordinality x(value,ordinality) order by x.ordinality loop
    select * into v_old from public.tasks
      where project_id=p_project_id and project_task_uid=(v_t.item->>'uid')::integer for update;
    v_parent := nullif(v_t.item->>'parentUid','')::integer;
    if v_parent = (v_t.item->>'uid')::integer then
      raise exception 'Ein Vorgang darf nicht sein eigener übergeordneter Vorgang sein.';
    end if;
    insert into public.tasks(project_id,project_task_uid,wbs,name,parent_task_uid,outline_level,is_summary,plan_start,plan_finish,active,first_import_id,last_import_id)
    values (
      p_project_id,(v_t.item->>'uid')::integer,nullif(v_t.item->>'wbs',''),v_t.item->>'name',
      v_parent,(v_t.item->>'level')::integer,coalesce((v_t.item->>'summary')::boolean,false),
      (nullif(v_t.item->>'start','')::timestamp at time zone v_timezone),
      (nullif(v_t.item->>'finish','')::timestamp at time zone v_timezone),
      true,v_import_id,v_import_id
    )
    on conflict(project_id,project_task_uid) do update set
      wbs=excluded.wbs,name=excluded.name,parent_task_uid=excluded.parent_task_uid,
      outline_level=excluded.outline_level,is_summary=excluded.is_summary,
      plan_start=excluded.plan_start,plan_finish=excluded.plan_finish,
      active=true,last_import_id=v_import_id,
      plan_revision=case when (
        public.tasks.wbs,public.tasks.name,public.tasks.parent_task_uid,
        public.tasks.outline_level,public.tasks.is_summary,public.tasks.plan_start,
        public.tasks.plan_finish,public.tasks.active
      ) is distinct from (
        excluded.wbs,excluded.name,excluded.parent_task_uid,excluded.outline_level,
        excluded.is_summary,excluded.plan_start,excluded.plan_finish,true
      ) then public.tasks.plan_revision + 1 else public.tasks.plan_revision end
    returning * into v_new;
    if not found then raise exception 'Vorgang konnte nicht gespeichert werden.'; end if;
    if v_old.id is null then
      v_added := v_added + 1;
    elsif (v_old.wbs,v_old.name,v_old.parent_task_uid,v_old.outline_level,v_old.is_summary,v_old.plan_start,v_old.plan_finish,v_old.active)
      is distinct from (v_new.wbs,v_new.name,v_new.parent_task_uid,v_new.outline_level,v_new.is_summary,v_new.plan_start,v_new.plan_finish,v_new.active) then
      v_changed := v_changed + 1;
    end if;
  end loop;
  -- Preserve all task UUIDs, progress updates, and media foreign keys.
  update public.tasks t set active=false,last_import_id=v_import_id,plan_revision=plan_revision+1
    where t.project_id=p_project_id and t.active
      and not exists(select 1 from jsonb_array_elements(p_plan) item where (item->>'uid')::integer=t.project_task_uid);
  get diagnostics v_retired = row_count;
  update public.plan_imports
    set status='applied',applied_at=now(),change_count=v_added+v_changed+v_retired,
        new_task_count=v_added,changed_task_count=v_changed,removed_task_count=v_retired,
        summary=jsonb_build_object('taskCount',v_count,'preservesReports',true)
    where id=v_import_id;
  return jsonb_build_object('importId',v_import_id,'added',v_added,'changed',v_changed,'inactive',v_retired);
end;
$function$
;
REVOKE ALL ON FUNCTION public.apply_project_xml_plan(uuid,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_project_xml_plan(uuid,text,jsonb) TO authenticated;
