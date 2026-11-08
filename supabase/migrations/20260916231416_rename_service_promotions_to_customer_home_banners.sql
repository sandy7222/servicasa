-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Renombra service_promotions -> customer_home_banners y lo extiende para
-- soportar el editor de página del admin (banners con imagen/gif/video,
-- link y orden configurables). Ver pedido de Sandy del 13-16/9.

alter table service_promotions rename to customer_home_banners;
alter table customer_home_banners rename column image_url to media_url;

alter table customer_home_banners
  add column media_type text not null default 'image',
  add column link_path text,
  add column cta_label text,
  add column display_order integer not null default 0;

alter table customer_home_banners
  add constraint customer_home_banners_media_type_check
  check (media_type in ('image', 'gif', 'video'));

comment on column customer_home_banners.media_url is 'Ruta (subida desde el panel) o URL del archivo mostrado en el banner.';
comment on column customer_home_banners.media_type is 'Tipo de archivo en media_url: image, gif o video.';
comment on column customer_home_banners.link_path is 'Ruta interna a la que navega el botón del banner (ej: /customer/solicitar). Si es null, se usa un valor por defecto en el frontend.';
comment on column customer_home_banners.cta_label is 'Texto del botón del banner. Si es null, se usa "Ver servicios" por defecto.';
comment on column customer_home_banners.display_order is 'Orden de aparición entre los banners activos (ascendente).';

-- Asigna orden inicial a las filas existentes según su fecha de creación.
with ordered as (
  select id, row_number() over (order by created_at asc) - 1 as rn
  from customer_home_banners
)
update customer_home_banners b
set display_order = ordered.rn
from ordered
where ordered.id = b.id;

-- Renombra índice/trigger/políticas para mantener la convención de nombres.
alter index service_promotions_active_idx rename to customer_home_banners_active_idx;
alter trigger service_promotions_set_updated_at on customer_home_banners rename to customer_home_banners_set_updated_at;
alter policy service_promotions_select_anon on customer_home_banners rename to customer_home_banners_select_anon;
alter policy service_promotions_select_authenticated on customer_home_banners rename to customer_home_banners_select_authenticated;
alter policy service_promotions_write_admin on customer_home_banners rename to customer_home_banners_write_admin;
