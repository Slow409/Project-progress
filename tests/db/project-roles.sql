-- All identifiers and accounts below are synthetic, created in CI only.
\set ON_ERROR_STOP on
insert into auth.users values('30000000-0000-0000-0000-000000000001','pm@example.invalid'),('30000000-0000-0000-0000-000000000002','observer@example.invalid'),('30000000-0000-0000-0000-000000000003','managing@example.invalid'),('30000000-0000-0000-0000-000000000004','controlling@example.invalid'),('30000000-0000-0000-0000-000000000005','resource@example.invalid');
insert into public.projects(id,owner_user_id) values('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001');
insert into public.tasks(id,project_id,project_task_uid) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1);
-- Observer deliberately also has an old resource assignment.
insert into public.resources(id,project_id,auth_user_id) values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
insert into public.task_resources values('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001');
insert into public.plan_imports values('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.plan_import_changes values('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001');
insert into public.weekly_snapshots values('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.progress_updates(project_id,task_id,resource_id,author_user_id) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',false);
select public.assign_project_role('10000000-0000-0000-0000-000000000001','observer@example.invalid','observer');
select public.assign_project_role('10000000-0000-0000-0000-000000000001','managing@example.invalid','managing');
select public.assign_project_role('10000000-0000-0000-0000-000000000002','managing@example.invalid','managing');
select public.assign_project_role('10000000-0000-0000-0000-000000000001','controlling@example.invalid','controlling');
insert into public.project_financials(project_id,snapshot_date,budget,planned_value,earned_value,actual_cost) values('10000000-0000-0000-0000-000000000001',current_date,100,50,40,45),('10000000-0000-0000-0000-000000000002',current_date,200,100,90,95);
do $$ begin
  if (select count(*) from public.project_financials)<>2 then raise exception 'PM finance visibility'; end if;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',false);
do $$ declare affected integer; begin
  if (select count(*) from public.projects)<>1 or (select count(*) from public.tasks)<>1 then raise exception 'Observer scope'; end if;
  if (select count(*) from public.project_memberships where project_id='10000000-0000-0000-0000-000000000001')<>3 then raise exception 'Observer administration visibility'; end if;
  if (select count(*) from public.plan_imports)<>1 or (select count(*) from public.plan_import_changes)<>1 or (select count(*) from public.weekly_snapshots)<>1 then raise exception 'Observer history visibility'; end if;
  if (select count(*) from public.project_financials)<>0 then raise exception 'Observer finance access'; end if;
  update public.tasks set active=false where id='20000000-0000-0000-0000-000000000001'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Observer task write'; end if;
  begin
    insert into public.progress_updates(project_id,task_id,resource_id,author_user_id) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
    raise exception 'Observer report write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name,owner_id) values('task-media','10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/synthetic.jpg','30000000-0000-0000-0000-000000000002');
    raise exception 'Observer media write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.project_financials(project_id,snapshot_date,budget,planned_value,earned_value,actual_cost) values('10000000-0000-0000-0000-000000000001',current_date+1,100,50,40,45);
    raise exception 'Observer finance write unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.assign_project_role('10000000-0000-0000-0000-000000000001','resource@example.invalid','controlling');
    raise exception 'Observer role assignment unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
do $$ declare affected integer; begin
  if (select count(*) from public.projects)<>2 or (select count(*) from public.tasks)<>2 then raise exception 'Managing scope'; end if;
  if (select count(*) from public.project_financials)<>0 then raise exception 'Managing finance access'; end if;
  if (select count(*) from public.project_memberships)<>4 then raise exception 'Managing administration visibility'; end if;
  delete from public.project_memberships where user_id='30000000-0000-0000-0000-000000000002'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Managing role deletion'; end if;
  update public.tasks set active=false where id='20000000-0000-0000-0000-000000000001'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Managing task write'; end if;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',false);
do $$ begin
  if (select count(*) from public.project_financials)<>1 then raise exception 'Controlling finance scope'; end if;
end $$;
insert into public.project_financials(project_id,snapshot_date,budget,planned_value,earned_value,actual_cost) values('10000000-0000-0000-0000-000000000001',current_date+1,100,50,40,45);
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000005',false);
do $$ begin
  if (select count(*) from public.project_financials)<>0 then raise exception 'Resource finance access'; end if;
  if (select count(*) from public.project_memberships)<>0 then raise exception 'Unassigned membership access'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from public.project_financials;
    raise exception 'Anonymous finance access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
