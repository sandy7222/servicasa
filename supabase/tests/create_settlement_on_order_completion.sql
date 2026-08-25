-- Pruebas en vivo (rollback-safe) del trigger que crea la liquidación
-- cuando una orden queda 'completed' Y 'paid_in_full' (lo que pase último).
-- Termina en ROLLBACK — no persiste nada en producción.
--
-- La prueba de punta a punta con una orden real (creación, asignación por
-- el modal de admin, confirmación de pago, finalización) se hizo aparte,
-- en vivo, con datos reales limpiados después — ver ROADMAP-TERMINACION.md,
-- séptima actualización, para el detalle completo de esa corrida.
--
-- Tecnico: maria.rodriguez@tecniurbano.com.ar (technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Cliente: julian.albarracin@gmail.com        (customer 98f00edc-f715-4db8-86ac-9b11df7e1363)
-- Servicio real del catálogo usado para respetar el trigger de precios:
--   3796594a-a421-43fc-bcf3-7f513dff8c76 "Mantenimiento Preventivo Integral" — $25.000

begin;

create temp table test_results (n int, name text, ok boolean, detail text);

insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, assigned_technician_id, assigned_technician_name,
  work_mode, service_status, payment_status, total_quoted_amount, total_paid_amount,
  fixed_price_service_id, fixed_price_quantity
) values (
  '00000000-0000-4000-8000-000000000901', 'TEST idempotencia liquidacion', 'desc', 'Mantenimiento general', 'media', 'assigned',
  current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
  'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'direct', 'pending', 'pending', 25000, 0,
  '3796594a-a421-43fc-bcf3-7f513dff8c76', 1
);

insert into payment_transactions (order_id, payment_type, provider, status, amount, mp_fee_amount)
values ('00000000-0000-4000-8000-000000000901', 'full_advance', 'mercadopago', 'approved', 25000, 437.5);

-- Primero se confirma el pago (orden todavía 'assigned', no 'completed').
update service_orders set payment_status = 'paid_in_full', total_paid_amount = 25000
where id = '00000000-0000-4000-8000-000000000901';

insert into test_results select 1, 'con solo el pago confirmado (orden aun no completada), NO se crea liquidación todavía',
  not exists (select 1 from technician_settlements where order_id = '00000000-0000-4000-8000-000000000901'),
  'ok';

-- Recién al completarse (pasando por in_progress, como en el flujo real)
-- se crea la liquidación.
update service_orders set status = 'in_progress' where id = '00000000-0000-4000-8000-000000000901';
update service_orders set status = 'completed' where id = '00000000-0000-4000-8000-000000000901';

insert into test_results select 2, 'al completarse (ya con el pago confirmado) se crea la liquidación con technician_id correcto',
  exists (select 1 from technician_settlements where order_id = '00000000-0000-4000-8000-000000000901' and technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

insert into test_results select 3, 'los montos son correctos: gross=25000, fee=437.50, comisión 17%=4250, neto=20312.50',
  (select gross_amount = 25000 and payment_fee_amount = 437.5 and platform_commission_amount = 4250 and net_amount = 20312.5
   from technician_settlements where order_id = '00000000-0000-4000-8000-000000000901'),
  (select 'gross=' || gross_amount || ' fee=' || payment_fee_amount || ' commission=' || platform_commission_amount || ' net=' || net_amount
   from technician_settlements where order_id = '00000000-0000-4000-8000-000000000901');

-- Idempotencia: tocar la fila de nuevo después de cumplidas las 2
-- condiciones (incluso re-setear las mismas 2 columnas) no debe duplicar.
update service_orders set client_phone = '999' where id = '00000000-0000-4000-8000-000000000901';
update service_orders set status = 'completed', payment_status = 'paid_in_full' where id = '00000000-0000-4000-8000-000000000901';

insert into test_results select 4, 'tocar la fila de nuevo tras cumplidas las 2 condiciones NO duplica la liquidación',
  (select count(*) from technician_settlements where order_id = '00000000-0000-4000-8000-000000000901') = 1,
  (select count(*)::text from technician_settlements where order_id = '00000000-0000-4000-8000-000000000901');

select * from test_results order by n;

rollback;
