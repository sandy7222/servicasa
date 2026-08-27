-- Número de ficha correlativo para clientes y técnicos (ej. CLI-0001,
-- TEC-0001) — más fácil de decir por teléfono, buscar en una planilla o usar
-- como referencia contable/interna que el UUID. Se guarda como entero simple
-- (el formato "CLI-000X" se arma en el frontend); no reemplaza el id interno,
-- es un campo de visualización aparte.
--
-- Ejecutar en el SQL Editor.

begin;

alter table public.customers add column if not exists customer_number integer;
alter table public.technicians add column if not exists technician_number integer;

-- Numerar lo que ya existe, en orden de creación.
with numbered as (
  select id, row_number() over (order by created_at) as rn
  from public.customers
  where customer_number is null
)
update public.customers c set customer_number = numbered.rn
from numbered where numbered.id = c.id;

with numbered as (
  select id, row_number() over (order by created_at) as rn
  from public.technicians
  where technician_number is null
)
update public.technicians t set technician_number = numbered.rn
from numbered where numbered.id = t.id;

-- Secuencias para que los próximos registros se numeren solos, arrancando
-- después del máximo ya asignado.
create sequence if not exists public.customers_customer_number_seq owned by public.customers.customer_number;
select setval('public.customers_customer_number_seq', coalesce((select max(customer_number) from public.customers), 0));
alter table public.customers alter column customer_number set default nextval('public.customers_customer_number_seq');
alter table public.customers alter column customer_number set not null;
alter table public.customers add constraint customers_customer_number_key unique (customer_number);

create sequence if not exists public.technicians_technician_number_seq owned by public.technicians.technician_number;
select setval('public.technicians_technician_number_seq', coalesce((select max(technician_number) from public.technicians), 0));
alter table public.technicians alter column technician_number set default nextval('public.technicians_technician_number_seq');
alter table public.technicians alter column technician_number set not null;
alter table public.technicians add constraint technicians_technician_number_key unique (technician_number);

commit;

select 'customers' as tabla, count(*), min(customer_number), max(customer_number) from public.customers
union all
select 'technicians', count(*), min(technician_number), max(technician_number) from public.technicians;
