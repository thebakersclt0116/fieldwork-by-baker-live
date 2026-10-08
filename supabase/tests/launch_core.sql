-- Fictional identities only. The complete test is rolled back, including auth users.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','fieldwork-test-a@example.invalid',now(),'{"name":"Synthetic A"}'),
('22222222-2222-4222-8222-222222222222','fieldwork-test-b@example.invalid',now(),'{"name":"Synthetic B"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare result bigint;
begin
 if (select count(*) from public.profiles)<>1 then raise exception 'TEST_FAILED: profile isolation'; end if;
 begin
  update public.profiles set role='owner';
  raise exception 'TEST_FAILED: role escalation allowed';
 exception when insufficient_privilege then null; end;
 result:=public.save_entries('[{"id":"synthetic-entry","duration":1,"date":"2026-10-06","status":"VERIFIED"}]',0,'[]');
 if result<>1 then raise exception 'TEST_FAILED: initial version'; end if;
 if (select payload->>'status' from public.entries where id='synthetic-entry')<>'PENDING' then raise exception 'TEST_FAILED: forged approval'; end if;
 begin
  perform public.save_entries('[]',null,'[]');
  raise exception 'TEST_FAILED: null version allowed';
 exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
 begin
  perform public.save_entries('[]',0,'[]');
  raise exception 'TEST_FAILED: stale version allowed';
 exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
 perform public.save_learning('resource-saves','["synthetic"]',0);
 begin
  perform public.save_learning('resource-saves','[]',null);
  raise exception 'TEST_FAILED: null learning version allowed';
 exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
 perform public.save_entries('[]',1,'["synthetic-entry"]');
 if not exists(select 1 from public.entries where id='synthetic-entry' and deleted_at is not null) then raise exception 'TEST_FAILED: soft delete'; end if;
 if (select count(*) from public.entry_versions where entry_id='synthetic-entry')<>1 then raise exception 'TEST_FAILED: immutable history'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.entries) or exists(select 1 from public.entry_versions) or exists(select 1 from public.learning_records) then raise exception 'TEST_FAILED: cross-account data exposed'; end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'TEST_FAILED: second profile isolation'; end if;
end $$;
rollback;
select 'PASS: account isolation, protected roles, approval integrity, concurrent writes, audit history' as verification;
