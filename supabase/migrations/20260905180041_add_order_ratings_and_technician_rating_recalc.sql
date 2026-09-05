-- Fase 1 del plan de calificaciones (plan-calificaciones-tecnicos.md).
-- Crea order_ratings, RLS, trigger de recalculo de technicians.rating
-- (bayesiano P=4 + ventana N=25), fix de lock_technician_admin_fields
-- para que el recalculo no se revierta, y total_ratings_count en
-- technician_public_view.

-- 1) Tabla order_ratings ------------------------------------------------

create table public.order_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete restrict,
  technician_id uuid not null references public.technicians(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  unique (order_id)
);

comment on table public.order_ratings is
  'Calificacion del cliente (1-5 estrellas) a la orden completada. Una por orden. '
  'technician_id se snapshotea desde service_orders.assigned_technician_id al insertar.';

alter table public.order_ratings enable row level security;

-- 2) RLS ------------------------------------------------------------------
-- Mismo idioma que las policies existentes de service_orders/order_signatures:
-- comparar contra profiles.customer_id / profiles.technician_id del usuario autenticado.

create policy order_ratings_select on public.order_ratings
for select
using (
  (select is_admin())
  or customer_id = (select profiles.customer_id from public.profiles where profiles.id = auth.uid())
  or technician_id = (select profiles.technician_id from public.profiles where profiles.id = auth.uid())
);

-- INSERT: solo el cliente dueno de la orden, orden completed con este
-- tecnico asignado, y dentro de los 30 dias desde completed_at.
create policy order_ratings_insert on public.order_ratings
for insert
with check (
  customer_id = (select profiles.customer_id from public.profiles where profiles.id = auth.uid())
  and exists (
    select 1 from public.service_orders o
    where o.id = order_ratings.order_id
      and o.customer_id = order_ratings.customer_id
      and o.assigned_technician_id = order_ratings.technician_id
      and o.status = 'completed'
      and o.completed_at is not null
      and o.completed_at >= now() - interval '30 days'
  )
);

-- UPDATE: solo el cliente dueno, y solo dentro de las 48hs desde el alta
-- (created_at es inmutable, protegido por el trigger de abajo).
create policy order_ratings_update on public.order_ratings
for update
using (
  customer_id = (select profiles.customer_id from public.profiles where profiles.id = auth.uid())
  and created_at >= now() - interval '48 hours'
)
with check (
  customer_id = (select profiles.customer_id from public.profiles where profiles.id = auth.uid())
);

-- Sin policy de DELETE: nadie borra una calificacion (v1). La baja GDPR
-- futura es anonimizar, no queda contemplada en este plan.

-- 3) Inmutabilidad de campos clave en UPDATE ------------------------------
-- El cliente solo puede tocar stars/comment dentro de la ventana de 48h;
-- order_id/technician_id/customer_id/created_at no cambian nunca (salvo admin).

create function public.order_ratings_protect_immutable() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
as $$
begin
  if not (select is_admin()) then
    new.order_id := old.order_id;
    new.technician_id := old.technician_id;
    new.customer_id := old.customer_id;
    new.created_at := old.created_at;
  end if;
  new.edited_at := now();
  return new;
end;
$$;

create trigger order_ratings_before_update
  before update on public.order_ratings
  for each row execute function public.order_ratings_protect_immutable();

-- 4) Recalculo de technicians.rating --------------------------------------
-- Bayesiano: (P*5 + suma de estrellas de las ultimas N calificaciones) / (P + cantidad).
-- P=4, N=25 (confirmado en Fase 0). SECURITY DEFINER porque el INSERT lo
-- dispara el cliente, que no tiene permiso para tocar technicians.rating
-- directamente (ver punto 5, fix de lock_technician_admin_fields).

create function public.recalc_technician_rating() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
as $$
declare
  v_p constant numeric := 4;
  v_n constant integer := 25;
  v_technician_id uuid;
  v_new_rating numeric;
begin
  v_technician_id := coalesce(new.technician_id, old.technician_id);

  select round((v_p * 5 + coalesce(sum(r.stars), 0)) / (v_p + count(r.stars)), 2)
    into v_new_rating
  from (
    select stars
    from public.order_ratings
    where technician_id = v_technician_id
    order by created_at desc
    limit v_n
  ) r;

  -- Bandera de transaccion: le dice a lock_technician_admin_fields que este
  -- UPDATE puntual (solo columna rating) viene del recalculo, no de un
  -- intento directo del cliente/tecnico de pisar el valor.
  perform set_config('app.rating_recalc', 'on', true);

  update public.technicians
  set rating = v_new_rating
  where id = v_technician_id;

  return coalesce(new, old);
end;
$$;

create trigger order_ratings_recalc_technician_rating
  after insert or update on public.order_ratings
  for each row execute function public.recalc_technician_rating();

-- 5) Fix de lock_technician_admin_fields ----------------------------------
-- Antes: revertia CUALQUIER cambio a rating (y otros campos admin) si
-- quien ejecuta el UPDATE no es admin. auth.uid() no cambia por que la
-- funcion que llama sea SECURITY DEFINER (es el JWT de la sesion), asi que
-- sin este fix el UPDATE de arriba se revertia en silencio: la calificacion
-- quedaba guardada en order_ratings pero technicians.rating nunca cambiaba.
-- Fix: dejar pasar el UPDATE cuando la bandera de transaccion esta prendida.
-- Los demas campos (validation_status, is_enabled, etc.) siguen protegidos
-- igual que antes porque el UPDATE del recalculo solo toca `rating`.

create or replace function public.lock_technician_admin_fields() returns trigger
    language plpgsql
    set search_path to 'public'
as $$
begin
  if (select is_admin()) or coalesce(current_setting('app.rating_recalc', true), 'off') = 'on' then
    return new;
  end if;

  new.validation_status := old.validation_status;
  new.validation_notes := old.validation_notes;
  new.validated_at := old.validated_at;
  new.validated_by := old.validated_by;
  new.is_enabled := old.is_enabled;
  new.rating := old.rating;
  new.active_orders_count := old.active_orders_count;
  new.completed_orders_count := old.completed_orders_count;
  return new;
end;
$$;

-- 6) total_ratings_count en technician_public_view ------------------------
-- Mismo shape que la vista actual (restore_technician_public_view_security_invoker),
-- solo se agrega la columna nueva. El resto del SELECT/WHERE queda identico.

create or replace view public.technician_public_view
with (security_invoker = true) as
select
  t.id,
  t.name,
  coalesce((
    select string_agg(c.name, ', ' order by c.name)
    from public.technician_specialties ts
    join public.categories c on c.id = ts.category_id
    where ts.technician_id = t.id
  ), t.specialty) as specialty,
  t.rating,
  t.completed_orders_count,
  t.public_avatar_path,
  t.bio,
  t.education_level,
  t.degree_title,
  t.institution_name,
  t.validation_status,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'issuing_entity', m.issuing_entity,
      'license_number', m.license_number,
      'specialty', m.specialty
    ) order by m.created_at desc)
    from public.technician_matriculas m
    where m.technician_id = t.id and m.validation_status = 'approved'
  ), '[]'::jsonb) as validated_licenses,
  (select count(*) from public.order_ratings orr where orr.technician_id = t.id) as total_ratings_count
from public.technicians t
where (select is_admin())
  or (t.id in (select profiles.technician_id from public.profiles where profiles.id = (select auth.uid())))
  or (exists (
    select 1 from public.service_orders o
    join public.profiles p on p.id = (select auth.uid())
    where o.assigned_technician_id = t.id and o.customer_id = p.customer_id
  ));
