-- Resource authorization used by RLS and server-side import.
-- Apply with a database migration role. Avoid exposed SECURITY DEFINER functions.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.has_assigned_task_access(p_task_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
 select (select auth.uid()) is not null and exists (
   select 1 from public.task_resources tr
   join public.tasks t on t.id = tr.task_id
   join public.resources r on r.id = tr.resource_id and r.project_id = t.project_id
   where tr.task_id = p_task_id and r.auth_user_id = (select auth.uid()) and r.access_enabled
 );
$fn$;
revoke all on function private.has_assigned_task_access(uuid) from public, anon;
grant execute on function private.has_assigned_task_access(uuid) to authenticated;
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
using (public.is_project_owner(project_id) or private.has_assigned_task_access(id));

-- Table GRANT and per-row authorization are separate layers.
grant insert,update on public.tasks, public.resources, public.projects, public.task_resources to authenticated;
grant insert on public.progress_updates, public.media to authenticated;

-- Historical evidence must disappear when a resource's access is revoked.
drop policy if exists progress_select on public.progress_updates;
create policy progress_select on public.progress_updates for select to authenticated
using (
 public.is_project_owner(project_id)
 or exists (select 1 from public.resources r join public.task_resources tr on tr.resource_id = r.id
    where r.project_id = progress_updates.project_id and r.id = progress_updates.resource_id
    and tr.task_id = progress_updates.task_id
    and r.auth_user_id = (select auth.uid()) and r.access_enabled)
);
drop policy if exists media_select on public.media;
create policy media_select on public.media for select to authenticated
using (
 public.is_project_owner(project_id)
 or exists (select 1 from public.resources r join public.task_resources tr on tr.resource_id = r.id
    where r.project_id = media.project_id and r.id = media.resource_id
    and tr.task_id = media.task_id
    and r.auth_user_id = (select auth.uid()) and r.access_enabled)
);
