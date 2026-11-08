-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Tarjetas linkeables del panel del cliente ("Solicitar Servicio", "Mis
-- Solicitudes", "Garantía", "Soporte", etc.) — editables libremente por el
-- admin (agregar/quitar/reordenar/relinkear), reemplazan las 2 cápsulas
-- hardcodeadas del header de CustomerView. Ver pedido de Sandy del 16/9
-- (editor de página).

create table customer_home_cards (
  id uuid primary key default gen_random_uuid(),
  icon text not null,
  title text not null,
  description text,
  link_path text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column customer_home_cards.icon is 'Nombre de ícono de lucide-react (ej: "Wrench") elegido en la grilla de íconos del editor de admin.';
comment on column customer_home_cards.link_path is 'Ruta interna a la que navega la tarjeta (ej: /customer/solicitar).';
comment on column customer_home_cards.display_order is 'Orden de aparición entre las tarjetas activas (ascendente).';

alter table customer_home_cards enable row level security;

create policy customer_home_cards_select_anon
  on customer_home_cards for select
  to anon
  using (is_active = true);

create policy customer_home_cards_select_authenticated
  on customer_home_cards for select
  to authenticated
  using (true);

create policy customer_home_cards_write_admin
  on customer_home_cards for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create trigger customer_home_cards_set_updated_at
  before update on customer_home_cards
  for each row execute function set_updated_at();

create index customer_home_cards_active_idx on customer_home_cards (is_active);

alter publication supabase_realtime add table customer_home_cards;

-- Semilla: las 2 cápsulas que ya existían en el header, para que el
-- rollout no rompa el acceso a "Solicitar un servicio" / "Reclamos y
-- garantías" mientras el admin no cargue nada más.
insert into customer_home_cards (icon, title, link_path, display_order) values
  ('Wrench', 'Solicitar un servicio', '/customer/solicitar', 0),
  ('ShieldAlert', 'Reclamos y garantías', '/customer/reclamos', 1);
