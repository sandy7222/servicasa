-- Módulo "Contratos" del Hub de Admin (charla con Sandy, 13/9): genera e
-- imprime un Contrato de Prestación de Servicios Independientes prellenado
-- con los datos del técnico. Dos cosas nuevas hacían falta para eso:
--
-- 1) DNI y CUIT/monotributo del técnico. Hoy no se piden al suscribirse
--    (ver TechnicianRegistrationInput en src/types/index.ts) — se cargan a
--    mano desde "Editar Técnico" o desde el propio módulo Contratos, la
--    primera vez que hacen falta para armar el contrato de ese técnico.
--
-- 2) La identidad legal de quien opera la Plataforma (Sandy, como
--    monotributista), para que aparezca del lado de "LA PLATAFORMA" en el
--    contrato sin volver a tipearla cada vez. Se guarda como dos settings
--    nuevos, admin-only, vacíos hasta que se completan una vez desde el
--    módulo Contratos (ver src/lib/settings.ts).
alter table public.technicians
  add column if not exists dni text,
  add column if not exists cuit text;

insert into public.system_settings (key, value, value_type, visibility, description) values
  ('platform_legal_name', '""', 'text', 'admin',
   'Nombre/razón social de quien opera TecniUrbano. Aparece como "LA PLATAFORMA" en el Contrato de Prestación de Servicios que se genera e imprime desde el módulo Contratos del Hub de Admin.'),
  ('platform_legal_cuit', '""', 'text', 'admin',
   'CUIT de quien opera TecniUrbano. Aparece en el Contrato de Prestación de Servicios que se genera e imprime desde el módulo Contratos del Hub de Admin.')
on conflict (key) do nothing;
