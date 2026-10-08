-- Fictional accounts and provider IDs only; all changes roll back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','billing-owner@example.invalid',now(),'{"name":"Fictional Billing Owner"}'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','billing-stranger@example.invalid',now(),'{"name":"Fictional Stranger"}');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.link_billing_customer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','cus_FictionalTest');
select public.link_billing_customer('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','cus_FictionalLive');
select public.apply_billing_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','cus_FictionalTest','sub_FictionalTest','professional_monthly','active',1792000000,false,100,'evt_FictionalTest');
do $$ declare first_claim jsonb; retry_claim jsonb; result jsonb; begin
 if (select subscription_status from public.profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')='active' then raise exception 'TEST_FAILED: sandbox granted live access'; end if;
 first_claim:=public.claim_billing_checkout('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','individual_monthly','https://www.fieldworkbybaker.com');
 retry_claim:=public.claim_billing_checkout('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','individual_monthly','https://fictional.vercel.app');
 if first_claim is distinct from retry_claim then raise exception 'TEST_FAILED: checkout retry changed provider claim'; end if;
 begin
  perform public.claim_billing_checkout('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','professional_monthly','https://www.fieldworkbybaker.com');
  raise exception 'TEST_FAILED: concurrent different-plan checkout';
 exception when others then if sqlerrm<>'CHECKOUT_ALREADY_OPEN' then raise; end if; end;
 perform public.apply_billing_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','cus_FictionalLive','sub_FictionalLive','individual_monthly','active',1792000000,false,200,'evt_FictionalActive');
 if (select subscription_status from public.profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'active' then raise exception 'TEST_FAILED: live subscription not saved'; end if;
 result:=public.apply_billing_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','cus_FictionalLive','sub_FictionalLive','individual_monthly','canceled',1792000000,false,201,'evt_FictionalActive');
 if result->>'duplicate'<>'true' then raise exception 'TEST_FAILED: repeated event not deduplicated'; end if;
 perform public.apply_billing_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','cus_FictionalLive','sub_FictionalLive','individual_monthly','past_due',1792000000,false,300,'evt_FictionalPastDue');
 result:=public.apply_billing_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','live','cus_FictionalLive','sub_FictionalLive','individual_monthly','active',1792000000,false,250,'evt_FictionalOlder');
 if result->>'stale'<>'true' or (select subscription_status from public.profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'past_due' then raise exception 'TEST_FAILED: old snapshot restored access'; end if;
 begin
  perform public.apply_billing_snapshot('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','live','cus_FictionalLive','sub_FictionalLive','individual_monthly','active',1792000000,false,400,'evt_FictionalWrongOwner');
  raise exception 'TEST_FAILED: customer ownership changed';
 exception when others then if sqlerrm<>'BILLING_CUSTOMER_CONFLICT' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$ begin
 if exists(select 1 from public.billing_customers) or exists(select 1 from public.billing_subscriptions) then raise exception 'TEST_FAILED: stranger read billing'; end if;
 if has_function_privilege('authenticated','public.apply_billing_snapshot(uuid,text,text,text,text,text,bigint,boolean,bigint,text)','execute') or has_function_privilege('anon','public.link_billing_customer(uuid,text,text)','execute') or has_table_privilege('authenticated','public.billing_subscriptions','update') then raise exception 'TEST_FAILED: customer can grant paid access'; end if;
end $$;
rollback;
select 'PASS: sandbox isolation, live state, stale/duplicate delivery, checkout retry, ownership and write restrictions' as verification;
