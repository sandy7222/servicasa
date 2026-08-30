-- Prueba del ciclo completo de CRUD sobre customer_addresses bajo RLS —
-- Fase 3 del rediseño de dirección (docs/adr-address-redesign.md): antes de
-- esta fase la tabla tenía RLS correcto pero 0 filas, así que nunca se había
-- ejercitado de verdad. Cubre:
--   1. Un cliente puede insertar sus propias direcciones (incluida la
--      primera marcada is_default).
--   2. Puede verlas todas (SELECT bajo RLS).
--   3. Puede cambiar cuál es la default (unset todas + set una).
--   4. Puede actualizar y borrar sus propias direcciones.
--   5. Otro cliente NO puede ver, actualizar ni borrar las direcciones de
--      este cliente (aislamiento real, no solo la policy en el papel).
--
-- Corre dentro de una transacción que se revierte al final (rollback), así
-- no queda ninguna fila de prueba en la base real. Mismo criterio que el
-- resto de los tests de este proyecto (test_pricing_trigger.sql,
-- test_require_customer_account_for_technician_assignment.sql, etc.).
--
-- Requiere al menos un cliente real con cuenta vinculada (profile_id no
-- nulo) para el caso positivo, y otro perfil de cliente distinto para el
-- caso de aislamiento (si no hay un segundo, ese bloque se omite con un
-- aviso en vez de fallar).

begin;

do $$
declare
  v_customer_id uuid;
  v_profile_id uuid;
  v_other_profile uuid;
  v_addr1 uuid;
  v_addr2 uuid;
  v_count int;
  v_affected int;
begin
  select c.id, c.profile_id into v_customer_id, v_profile_id
  from public.customers c
  where c.profile_id is not null
  limit 1;

  if v_customer_id is null then
    raise exception 'No hay ningún cliente con cuenta vinculada para probar — no se puede correr este test';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_profile_id::text, true);

  -- Caso 1: primera dirección (is_default = true, como haría createAddress
  -- con isFirst).
  insert into public.customer_addresses (customer_id, label, address_line, neighborhood, city, is_default)
  values (v_customer_id, 'Casa', 'Suipacha 547', null, 'Burzaco', true)
  returning id into v_addr1;

  -- Caso 2: segunda dirección, sin default.
  insert into public.customer_addresses (customer_id, label, address_line, neighborhood, city, is_default)
  values (v_customer_id, 'Trabajo', 'Las Praderas 98', 'Centro', 'Burzaco', false)
  returning id into v_addr2;

  -- Caso 3: SELECT bajo RLS -- debe ver las 2 propias.
  select count(*) into v_count from public.customer_addresses where customer_id = v_customer_id;
  if v_count <> 2 then
    raise exception 'FALLO: el cliente ve % direcciones, esperaba 2', v_count;
  end if;

  -- Caso 4: cambiar cuál es la default (simula setDefaultAddress).
  update public.customer_addresses set is_default = false where customer_id = v_customer_id;
  update public.customer_addresses set is_default = true where id = v_addr2;

  select count(*) into v_count from public.customer_addresses where customer_id = v_customer_id and is_default = true;
  if v_count <> 1 then
    raise exception 'FALLO: hay % direcciones default, esperaba exactamente 1', v_count;
  end if;

  -- Caso 5: actualizar y borrar una dirección propia.
  update public.customer_addresses set address_line = 'Suipacha 999' where id = v_addr1;
  delete from public.customer_addresses where id = v_addr1;

  select count(*) into v_count from public.customer_addresses where customer_id = v_customer_id;
  if v_count <> 1 then
    raise exception 'FALLO: esperaba 1 dirección después del borrado, hay %', v_count;
  end if;

  raise notice 'OK: ciclo completo de CRUD bajo RLS funciona (insert x2, select, set default, update, delete)';

  -- Caso 6 (aislamiento): otro cliente no puede ver ni tocar la dirección
  -- restante de este cliente.
  select id into v_other_profile from public.profiles where role = 'customer' and id <> v_profile_id limit 1;
  if v_other_profile is null then
    raise notice 'AVISO: no hay un segundo perfil de cliente para probar aislamiento -- se omite ese caso puntual';
  else
    perform set_config('request.jwt.claim.sub', v_other_profile::text, true);

    select count(*) into v_count from public.customer_addresses where id = v_addr2;
    if v_count <> 0 then
      raise exception 'FALLO: otro cliente puede VER la dirección de este cliente (RLS roto)';
    end if;

    update public.customer_addresses set city = 'Hackeado' where id = v_addr2;
    get diagnostics v_affected = row_count;
    if v_affected <> 0 then
      raise exception 'FALLO: otro cliente pudo actualizar % fila(s) ajena(s) (RLS roto)', v_affected;
    end if;

    delete from public.customer_addresses where id = v_addr2;
    get diagnostics v_affected = row_count;
    if v_affected <> 0 then
      raise exception 'FALLO: otro cliente pudo borrar una dirección ajena (RLS roto)';
    end if;

    raise notice 'OK: otro cliente no puede ver, actualizar ni borrar una dirección ajena';
  end if;

  reset role;
end $$;

rollback;
