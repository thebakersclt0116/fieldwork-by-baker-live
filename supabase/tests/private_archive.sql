-- Fictional database metadata only. No file bytes are uploaded; all rows roll back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('33333333-3333-4333-8333-333333333333','archive-test-a@example.invalid',now(),'{"name":"Synthetic Archive A"}'),
('44444444-4444-4444-8444-444444444444','archive-test-b@example.invalid',now(),'{"name":"Synthetic Archive B"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 if public.prepare_original(repeat('a',64)) is not true then raise exception 'TEST_FAILED: upload reservation'; end if;
 if public.prepare_original(repeat('a',64)) is not true then raise exception 'TEST_FAILED: retry reservation'; end if;
 begin
  perform public.record_original(repeat('a',64),'synthetic.txt',5,'text/plain','supporting-document');
  raise exception 'TEST_FAILED: nonexistent object accepted';
 exception when others then if sqlerrm<>'ORIGINAL_NOT_VERIFIED' then raise; end if; end;
 begin
  perform public.record_import(jsonb_build_object('id','synthetic-batch','state','prepared','sourceHash',repeat('a',64)));
  raise exception 'TEST_FAILED: unverified import accepted';
 exception when others then if sqlerrm<>'ORIGINAL_NOT_VERIFIED' then raise; end if; end;
end $$;
reset role;
-- Metadata simulates an already stored immutable object; no actual storage upload occurs.
insert into storage.objects(bucket_id,name,metadata) values('fieldwork-originals','33333333-3333-4333-8333-333333333333/'||repeat('a',64),'{"size":5}');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$ declare prepared jsonb; begin
 perform public.record_original(repeat('a',64),'synthetic.txt',5,'text/plain','supporting-document');
 if (select count(*) from public.source_documents)<>1 then raise exception 'TEST_FAILED: document metadata'; end if;
 prepared:=jsonb_build_object('id','synthetic-batch','state','prepared','sourceHash',repeat('a',64));
 perform public.record_import(prepared);perform public.record_import(prepared);
 begin
  perform public.record_import(prepared||'{"changed":true}'::jsonb);
  raise exception 'TEST_FAILED: immutable journal overwrite';
 exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
 perform public.record_import(prepared||'{"state":"committed"}'::jsonb);
 if (select count(*) from public.import_journals)<>2 then raise exception 'TEST_FAILED: journal history'; end if;
 begin
  update public.source_documents set original_filename='changed';
  raise exception 'TEST_FAILED: metadata overwrite';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.source_documents) or exists(select 1 from public.import_journals) or exists(select 1 from storage.objects where bucket_id='fieldwork-originals') then raise exception 'TEST_FAILED: cross-account archive access'; end if;
 begin
  perform public.record_original(repeat('a',64),'synthetic.txt',5,'text/plain','supporting-document');
  raise exception 'TEST_FAILED: foreign original accepted';
 exception when others then if sqlerrm<>'ORIGINAL_NOT_VERIFIED' then raise; end if; end;
end $$;
rollback;
select 'PASS: private original scope, upload reservation, immutable import history, cross-account isolation' as verification;
