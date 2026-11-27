-- Apply in a tested database before publishing the matching frontend.
begin;
create table public.project_memberships (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('observer','managing','controlling')),
  created_at timestamptz not null default now(),
  primary key(project_id,user_id)
);
create index project_memberships_user_idx on public.project_memberships(user_id,project_id);
alter table public.project_memberships enable row level security;
revoke all on public.project_memberships from anon, authenticated;
grant select, delete on public.project_memberships to authenticated;
create function private.project_member_role(p_project uuid) returns text
language sql stable security definer set search_path='' as $$
  select m.role from public.project_memberships m where m.project_id=p_project and m.user_id=(select auth.uid())
$$;
revoke all on function private.project_member_role(uuid) from public, anon;
grant execute on function private.project_member_role(uuid) to authenticated;
create policy memberships_read on public.project_memberships for select to authenticated using (user_id=(select auth.uid()) or public.is_project_owner(project_id) or private.project_member_role(project_id) in ('observer','managing'));
create policy memberships_revoke on public.project_memberships for delete to authenticated using (public.is_project_owner(project_id));
create policy projects_member_read on public.projects for select to authenticated using (private.project_member_role(id) is not null);
create policy tasks_member_read on public.tasks for select to authenticated using (private.project_member_role(project_id) is not null);
create policy resources_member_read on public.resources for select to authenticated using (private.project_member_role(project_id) is not null);
create policy links_member_read on public.task_resources for select to authenticated using (exists(select 1 from public.tasks t where t.id=task_id and private.project_member_role(t.project_id) is not null));
create policy reports_member_read on public.progress_updates for select to authenticated using (private.project_member_role(project_id) is not null);
create policy media_member_read on public.media for select to authenticated using (private.project_member_role(project_id) is not null);
create policy revisions_member_read on public.plan_task_revisions for select to authenticated using (private.project_member_role(project_id) is not null);
-- Full operational PM read access for Observer and Managing Level, never finance.
create policy plan_imports_reader_select on public.plan_imports for select to authenticated using (private.project_member_role(project_id) in ('observer','managing'));
create policy plan_import_changes_reader_select on public.plan_import_changes for select to authenticated using (exists(select 1 from public.plan_imports pi where pi.id=import_id and private.project_member_role(pi.project_id) in ('observer','managing')));
create policy checkpoints_reader_select on public.project_checkpoints for select to authenticated using (private.project_member_role(project_id) in ('observer','managing'));
create policy snapshots_reader_select on public.weekly_snapshots for select to authenticated using (private.project_member_role(project_id) in ('observer','managing'));
create policy resource_access_events_reader_select on public.resource_access_events for select to authenticated using (private.project_member_role(project_id) in ('observer','managing'));
create policy member_media_read on storage.objects for select to authenticated using (bucket_id='task-media' and exists(select 1 from public.media m where m.storage_path=objects.name and private.project_member_role(m.project_id) is not null));
-- A project-level reader role overrides any old resource assignment on the same project.
create policy memberships_reports_read_only on public.progress_updates as restrictive for insert to authenticated with check (public.is_project_owner(project_id) or private.project_member_role(project_id) is null);
create policy memberships_media_read_only on public.media as restrictive for insert to authenticated with check (public.is_project_owner(project_id) or private.project_member_role(project_id) is null);
create policy memberships_storage_read_only on storage.objects as restrictive for insert to authenticated with check (
  bucket_id <> 'task-media' or not exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[1] and private.project_member_role(p.id) is not null and not public.is_project_owner(p.id))
);
create policy memberships_storage_delete_read_only on storage.objects as restrictive for delete to authenticated using (
  bucket_id <> 'task-media' or not exists(select 1 from public.projects p where p.id::text=(storage.foldername(name))[1] and private.project_member_role(p.id) is not null and not public.is_project_owner(p.id))
);
create function private.assign_project_role(p_project_id uuid,p_email text,p_role text) returns void
language plpgsql security definer set search_path='' as $$
declare target_id uuid; target_email text;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.projects p where p.id=p_project_id and p.owner_user_id=(select auth.uid())) then
    raise exception 'Nur der Projektmanager kann Rollen zuweisen' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('observer','managing','controlling') then raise exception 'Ungültige Rolle'; end if;
  select u.id,u.email into target_id,target_email from auth.users u where lower(u.email)=lower(trim(p_email));
  if target_id is null then raise exception 'Für diese E-Mail besteht noch kein Benutzerkonto'; end if;
  if target_id=(select auth.uid()) then raise exception 'Die Eigentümerrolle bleibt bestehen'; end if;
  insert into public.project_memberships(project_id,user_id,email,role) values(p_project_id,target_id,target_email,p_role)
  on conflict(project_id,user_id) do update set role=excluded.role,email=excluded.email;
end $$;
revoke all on function private.assign_project_role(uuid,text,text) from public, anon;
grant execute on function private.assign_project_role(uuid,text,text) to authenticated;
create function public.assign_project_role(p_project_id uuid,p_email text,p_role text) returns void
language sql security invoker set search_path='' as $$ select private.assign_project_role(p_project_id,p_email,p_role) $$;
revoke all on function public.assign_project_role(uuid,text,text) from public, anon;
grant execute on function public.assign_project_role(uuid,text,text) to authenticated;
-- Financial data is physically separated from operational reports and never queried by observer/management.
create table public.project_financials (
 project_id uuid not null references public.projects(id) on delete cascade,
 snapshot_date date not null,
 budget numeric(16,2) not null check(budget>=0 and budget<100000000000000),
 planned_value numeric(16,2) not null check(planned_value>=0 and planned_value<100000000000000),
 earned_value numeric(16,2) not null check(earned_value>=0 and earned_value<100000000000000),
 actual_cost numeric(16,2) not null check(actual_cost>=0 and actual_cost<100000000000000),
 primary key(project_id,snapshot_date)
);
alter table public.project_financials enable row level security;
revoke all on public.project_financials from anon,authenticated;
grant select,insert,update on public.project_financials to authenticated;
create policy financial_read on public.project_financials for select to authenticated using (public.is_project_owner(project_id) or private.project_member_role(project_id)='controlling');
create policy financial_insert on public.project_financials for insert to authenticated with check (public.is_project_owner(project_id) or private.project_member_role(project_id)='controlling');
create policy financial_update on public.project_financials for update to authenticated using (public.is_project_owner(project_id) or private.project_member_role(project_id)='controlling') with check (public.is_project_owner(project_id) or private.project_member_role(project_id)='controlling');

alter table public.tasks add column planned_work_hours numeric check(planned_work_hours>=0 and planned_work_hours<1000000000);
create function public.apply_modular_project_plan(p_project_id uuid,p_file_name text,p_plan jsonb,p_resources jsonb,p_assignments jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; tz text;
begin
  if not public.is_project_owner(p_project_id) then raise exception 'Nur PM'; end if;
  result:=public.apply_project_xml_plan_with_resources(p_project_id,p_file_name,p_plan,p_resources,p_assignments);
  select timezone into tz from public.projects where id=p_project_id;
  update public.tasks t set
    baseline_start=coalesce(t.baseline_start, nullif(x.value->>'baselineStart','')::timestamp at time zone tz),
    baseline_finish=coalesce(t.baseline_finish, nullif(x.value->>'baselineFinish','')::timestamp at time zone tz),
    planned_work_hours=coalesce((x.value->>'workHours')::numeric,t.planned_work_hours)
  from jsonb_array_elements(p_plan) x where t.project_id=p_project_id and t.project_task_uid=(x.value->>'uid')::integer;
  return result;
end $$;
revoke all on function public.apply_modular_project_plan(uuid,text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.apply_modular_project_plan(uuid,text,jsonb,jsonb,jsonb) to authenticated;

create table public.project_issues (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=5000),
 status text not null default 'open' check(status in ('open','in_progress','closed')),
 due_date date, created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index project_issues_project_idx on public.project_issues(project_id);
alter table public.project_issues enable row level security;
revoke all on public.project_issues from anon,authenticated;
grant select,insert on public.project_issues to authenticated;
grant update(status,due_date) on public.project_issues to authenticated;
create policy issues_read on public.project_issues for select to authenticated using (public.is_project_owner(project_id) or private.project_member_role(project_id) is not null or exists(select 1 from public.tasks t where t.id=task_id and t.project_id=project_issues.project_id));
create policy issues_insert on public.project_issues for insert to authenticated with check (created_by=(select auth.uid()) and status='open' and exists(select 1 from public.tasks t where t.id=task_id and t.project_id=project_issues.project_id and t.active and not t.is_summary) and (public.is_project_owner(project_id) or (private.project_member_role(project_id) is null and private.has_assigned_task_access(task_id))));
create policy issues_pm_update on public.project_issues for update to authenticated using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
commit;
