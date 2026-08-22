-- ServiCasa — agrega "provincia" a clientes y órdenes.
-- Motivo: el formulario de pedido (logueado e invitado) solo pedía
-- domicilio y barrio/localidad. Sin provincia no hay forma confiable de
-- saber a qué zona enviar al técnico (ej. "Glew" existe en Buenos Aires,
-- pero el nombre de la localidad solo no lo distingue de otras zonas).
--
-- customers.province: valor por defecto del cliente (se pre-completa en el
-- formulario si ya tiene cuenta).
-- service_orders.client_province: dato real de ESTA visita, igual que
-- client_address/client_neighborhood ya son por-orden y no por-cliente
-- (alguien puede pedir un servicio para la casa de un familiar).
--
-- Ambas columnas nullable: no se completan retroactivamente en órdenes
-- viejas, solo quedan obligatorias de acá en adelante en los formularios de
-- pedido (validación del lado del cliente y del servidor en
-- api/orders/guest-checkout.ts).
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

alter table public.customers
  add column if not exists province text;

alter table public.service_orders
  add column if not exists client_province text;

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'customers' and column_name = 'province')
    or (table_name = 'service_orders' and column_name = 'client_province'));
