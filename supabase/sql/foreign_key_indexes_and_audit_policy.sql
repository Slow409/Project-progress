-- Performance hardening applied to Supabase on 2026-11-04.
-- Wrap auth.uid() in a scalar SELECT so it is evaluated once per statement.
drop policy if exists resource_access_events_owner_insert on public.resource_access_events;
create policy resource_access_events_owner_insert on public.resource_access_events
for insert to authenticated with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = resource_access_events.project_id
      and p.owner_user_id = (select auth.uid())
  )
);
drop policy if exists resource_access_events_owner_select on public.resource_access_events;
create policy resource_access_events_owner_select on public.resource_access_events
for select to authenticated using (
  exists (
    select 1 from public.projects p
    where p.id = resource_access_events.project_id
      and p.owner_user_id = (select auth.uid())
  )
);
create index if not exists media_author_user_id_idx on public.media(author_user_id);
create index if not exists media_progress_update_id_idx on public.media(progress_update_id);
create index if not exists media_resource_id_idx on public.media(resource_id);
create index if not exists media_task_id_idx on public.media(task_id);
create index if not exists plan_imports_imported_by_idx on public.plan_imports(imported_by);
create index if not exists plan_task_revisions_import_id_idx on public.plan_task_revisions(import_id);
create index if not exists progress_updates_author_user_id_idx on public.progress_updates(author_user_id);
create index if not exists progress_updates_resource_id_idx on public.progress_updates(resource_id);
create index if not exists projects_owner_user_id_idx on public.projects(owner_user_id);
create index if not exists resource_access_events_actor_user_id_idx on public.resource_access_events(actor_user_id);
create index if not exists resource_access_events_resource_id_idx on public.resource_access_events(resource_id);
create index if not exists resources_auth_user_id_idx on public.resources(auth_user_id);
create index if not exists tasks_first_import_id_idx on public.tasks(first_import_id);
create index if not exists tasks_last_import_id_idx on public.tasks(last_import_id);
