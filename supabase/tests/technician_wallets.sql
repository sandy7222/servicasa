-- Pruebas rollback-safe del monedero de técnico y del admin.
-- No persiste nada: termina en ROLLBACK.
--
-- Admin:    admin@tecniurbano.com.ar
-- Tecnica:  maria.rodriguez@tecniurbano.com.ar

begin;

create temp table test_results (n numeric, name text, ok boolean, detail text);
grant insert, select, delete on test_results to authenticated;

create temp table test_config (admin_profile_id uuid, maria_profile_id uuid, maria_tech_id uuid);
grant select on test_config to authenticated;
insert into test_config
select
  (select id from profiles where role = 'admin' limit 1),
  '3ef7d581-b040-4669-88bf-d572ab4b4ac4'::uuid,
  'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'::uuid;

insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, assigned_technician_id, assigned_technician_name,
  work_mode, service_status, payment_status
) values
  ('00000000-0000-4000-8000-000000000601', 'TEST wallet A', 'desc', 'Electricidad', 'media', 'completed',
   current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full'),
  ('00000000-0000-4000-8000-000000000602', 'TEST wallet B', 'desc', 'Electricidad', 'media', 'completed',
   current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full');

insert into technician_settlements (id, order_id, technician_id, settlement_type, gross_amount, platform_commission_amount, payment_fee_amount, net_amount, status, released_at)
values
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000601', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'completed_work', 10000, 1700, 300, 8000, 'released', now() - interval '2 day'),
  ('00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000602', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'completed_work', 20000, 3400, 600, 16000, 'released', now() - interval '1 day');

insert into technician_payment_accounts (technician_id, account_holder, cbu_cvu, alias, provider, validation_status)
values ('a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', '0000000000000000000000', 'maria.mp', 'mercadopago', 'approved')
on conflict (technician_id) do update set cbu_cvu = excluded.cbu_cvu;

-- Como María pide 10000: debe reservar solo la liquidación más vieja (8000 no alcanza, así que también la de 16000 → cover 24000).
-- Pedido 10000, primera 8000 running=8000 < 10000, incluye; segunda running=24000, 24000-16000=8000 < 10000, incluye. Cover 24000.

set local role authenticated;
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table req_run (id uuid);
insert into req_run select public.request_technician_payout(10000);

insert into test_results select 1, 'el pedido reserva liquidaciones enteras hasta cubrir como mínimo el monto',
  (select coalesce(sum(net_amount),0) from technician_payout_request_items where request_id = (select id from req_run)) = 24000,
  'cover=' || (select coalesce(sum(net_amount),0)::text from technician_payout_request_items where request_id = (select id from req_run));

insert into test_results select 2, 'saldo disponible queda en 0 porque ambas liquidaciones quedaron reservadas',
  public.technician_wallet_available_guarded('a1df8a0c-fa2b-45da-9d96-d6756c8074c0') = 0,
  'available=' || public.technician_wallet_available_guarded('a1df8a0c-fa2b-45da-9d96-d6756c8074c0')::text;

do $$
begin
  begin
    perform public.request_technician_payout(1);
    insert into test_results values (3, 'pedir de nuevo más que el saldo disponible falla', false, 'no lanzó');
  exception when others then
    insert into test_results values (3, 'pedir de nuevo más que el saldo disponible falla', true, sqlerrm);
  end;
end $$;

insert into test_results select 4, 'el pedido de retiro NO genera fila en notifications',
  not exists (select 1 from notifications where entity_id = (select id from req_run) or dedupe_key ilike '%payout_request%'),
  'ok';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select admin_profile_id::text from test_config), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    perform public.fulfill_technician_payout_request((select id from req_run), '   ', null, null, 'mercadopago');
    insert into test_results values (5, 'cumplir sin referencia real falla', false, 'no lanzó');
  exception when others then
    insert into test_results values (5, 'cumplir sin referencia real falla', true, sqlerrm);
  end;
end $$;

create temp table fulfill_run (request_id uuid, batch_id uuid, paid_amount numeric, settlement_count int);
insert into fulfill_run
select * from public.fulfill_technician_payout_request((select id from req_run), 'MP-TEST-REF-999', null, '4321', 'mercadopago');

insert into test_results select 6, 'cumplir con referencia real cierra el lote y paga 24000',
  (select paid_amount = 24000 and settlement_count = 2 from fulfill_run),
  (select 'paid=' || paid_amount || ' count=' || settlement_count from fulfill_run);

insert into test_results select 7, 'las liquidaciones de prueba quedaron paid con el pedido completado',
  (select status from technician_settlements where id = '00000000-0000-4000-8000-000000000611') = 'paid'
  and (select status from technician_payout_requests where id = (select id from req_run)) = 'completed'
  and (select transfer_reference from technician_payout_requests where id = (select id from req_run)) = 'MP-TEST-REF-999',
  'ok';

do $$
begin
  begin
    perform public.withdraw_admin_earnings(100, '', null);
    insert into test_results values (8, 'retiro admin sin referencia falla', false, 'no lanzó');
  exception when others then
    insert into test_results values (8, 'retiro admin sin referencia falla', true, sqlerrm);
  end;
end $$;

select * from test_results order by n;

rollback;
