create or replace function private.is_orphan_media_path(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select (select auth.uid()) is not null and not exists (
    select 1 from public.media m where m.storage_path=p_path
  );
$fn$;
revoke all on function private.is_orphan_media_path(text) from public, anon;
grant execute on function private.is_orphan_media_path(text) to authenticated;
drop policy if exists task_media_cleanup_orphan on storage.objects;
create policy task_media_cleanup_orphan on storage.objects
for delete to authenticated using (
  bucket_id='task-media' and owner_id=(select auth.uid()::text)
  and private.is_orphan_media_path(name)
);