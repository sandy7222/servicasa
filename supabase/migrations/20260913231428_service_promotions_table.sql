-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.


create table public.service_promotions (
  id uuid primary key default gen_random_uuid(),
  rubro text not null,
  badge_label text not null default 'Promo del mes',
  title text not null,
  description text not null,
  is_active boolean not null default true,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.service_promotions is 'Promociones/ofertas del mes gestionadas por el admin, mostradas en el dashboard del cliente cuando no tiene un servicio en curso (ver CustomerView.tsx). No reemplaza precios reales de servicios, es solo contenido promocional informativo.';

alter table public.service_promotions enable row level security;

create policy service_promotions_select_anon
  on public.service_promotions for select
  to anon
  using (is_active = true);

create policy service_promotions_select_authenticated
  on public.service_promotions for select
  to authenticated
  using (true);

create policy service_promotions_write_admin
  on public.service_promotions for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create trigger service_promotions_set_updated_at
  before update on public.service_promotions
  for each row execute function public.set_updated_at();

create index service_promotions_active_idx on public.service_promotions (is_active, created_at desc);

alter publication supabase_realtime add table public.service_promotions;
