-- ServiCasa — categoría original del tarifario en `services` + vínculo de
-- order_quote_items al catálogo real de servicios (antes solo apuntaba a
-- service_categories, un catálogo mucho más chico y ajeno al tarifario).
-- Ejecutar UNA sola vez en el SQL Editor.

begin;

-- 1) Categoría original del tarifario (ver tarifario_electricidad_seed.json,
--    campo `categoria`, no `subcategoria` — ese nivel más fino del JSON
--    fuente sigue viviendo solo en el nombre del ítem, ej. 'Trifásicas —').
--    Nullable: los otros rubros (Plomería, Cerrajería, etc.) todavía no tienen
--    su propio tarifario cargado en `services`.
alter table public.services add column if not exists subcategoria text;

-- 2) Backfill de los 104 ítems de Electricidad que sí vienen del tarifario.
--    Mapeo id -> categoría reconstruido 1:1 contra el JSON original por nombre
--    (`subcategoria — detalle` del JSON, con fallback a `detalle` solo para
--    los ítems donde el import no conservó el prefijo). Validado: en los 104
--    casos el precio en base es exactamente el precio del JSON x 1.18 (el
--    markup aplicado al importar), así que no hay ambigüedad de matching.
update public.services set subcategoria = 'Acometidas' where id in (
  '7936dda9-7806-45c8-a876-6a0affaa071f',
  '415c393f-99f2-47ac-97d2-8c45c7acfaf5',
  '42b0a311-d172-4166-867a-7231b6331470',
  '3ffd6f95-3076-48ec-b4d4-690cbd5843c1'
);

update public.services set subcategoria = 'Cableado y Re-Cableado' where id in (
  '4ba6233e-d081-43b5-a487-17ff784d8746',
  'bf22ef8e-2f16-41bd-ba77-0868ca3b5ac9',
  '96d8d834-3409-4f74-b7df-36b78f8b0d36',
  '314dcaab-f1b3-45ce-81f2-ee0f913d8390',
  '20432d41-1428-4895-89de-4d76419bd06a',
  '3145e24e-0d69-45b0-90fb-64655401af2f',
  'cdb9b2f0-2fd2-4afe-afdd-10dfc478851f',
  'fb9a9a53-e898-4572-ae14-34a9b208e080',
  '47390129-3c9b-497e-b801-28733acd3c5d',
  '77d35ea2-046a-47a1-8be2-fa15da341bd4'
);

update public.services set subcategoria = 'Canalización' where id in (
  '5ea3ea9e-6d33-49b2-af76-037122924d93',
  '8f2f865d-87d8-4370-a6b3-ff476dca4ea7',
  '7815cbeb-f868-437e-b1b4-b0d879b17cab',
  '012e173c-4d33-4df6-a866-5ca654ca6d87',
  '6cf05e08-33c8-4a34-8759-efce56349f57',
  'cd28f611-38ef-40ed-a7fc-280e9371032c',
  '62b923f5-84ed-4c5c-9ac7-ce5ce5cd0fa8',
  '6070a460-770c-4bf8-9ca5-62917d6ccdcd',
  '0344f388-45dc-41d2-ab1c-ac44d62706b5',
  '3834b768-5838-4d24-937a-37a59404394e',
  'c8d9fe3c-4421-49be-aa78-8e7161931155',
  '5d4568be-bf05-43dd-9daa-c41d3d6ca5c5',
  '2d54c18f-209d-4100-96a7-38a60df80168',
  'fb94ba6f-3865-48b0-9116-f2973b9de665',
  '1451bbbe-b26e-4e4f-94e1-1d4e8a2e2756',
  '23dd3f2c-476a-480b-9b45-a8903dd00e70',
  '81f16f22-fb6a-46f3-80ce-96ab39be9d24',
  'b7bca317-e423-4a45-ad47-d92325e55224',
  '99db873b-07d5-4c81-a02d-4ff34a59b7ce',
  '49321724-0498-4b07-9c5e-d9f9f128f135',
  '8784f5e5-1dd0-4528-97f9-8726ef4ff28b',
  '15f0ce10-0916-46db-b04c-5972bda7a789',
  'f7d36ebf-798e-4a46-b29d-a02ddddfd8c8',
  '7c407920-d652-49fc-8f6a-1dae60c2e2da',
  '8ef5776a-53d3-4684-a68f-2e4bc864078b',
  '9d759564-23ac-4244-800c-eda70da5b7d0',
  '5232a806-9861-4437-825a-499b3ff34f3f',
  'c77848a2-6675-455e-af99-cc7e84554f7e',
  '5ec92fb0-315e-48d4-9587-253333b345b3',
  'be5ed6e2-7879-4587-9680-d8ecf2e220b8',
  '446c52b8-4237-4b0d-88e9-b0423d3d4ce1',
  '92550432-7bc6-4949-a504-29cb5567fce2',
  'bc37515d-0389-45c4-89dc-c10a4805ee20',
  '4be163bb-51bf-4387-ae5d-3771a7643f33'
);

update public.services set subcategoria = 'CCTV' where id in (
  '4ae94a61-80bc-459e-aca4-5752a9cc1ece',
  '1608bfd9-cb56-454a-98c0-1a9ae1eae14b',
  '9cf49388-0361-4f7b-9ea2-46aaf52ad50b',
  'e756f025-8adc-4a47-ad93-2d13f738763c',
  'a8b3b7bc-89a1-4fa9-b9ba-4d46b3f79dd4',
  '6ffe93b9-52e8-425b-849f-e2e6eb25187d',
  '98b293df-ed0f-48ae-9db1-56552376d4ef',
  'dc11a196-5455-40b0-a5d6-fa9621d8b058',
  '8e872628-83ba-4c5d-b8f9-73f9d6ff2019',
  'b6085c3f-ad98-4ee8-9267-935df870f3d8'
);

update public.services set subcategoria = 'Colocación de Luminarias' where id in (
  '6ccc9603-7adf-4ff0-b1a3-13c2d808ed61',
  '4ab259a7-2614-4f88-accd-e089fed8c50d',
  '1dd21120-b04b-4dec-8fe1-0b2848f13fe2',
  '386c88ec-fc3f-494e-81c9-2d94f00ff68a',
  '842e9a22-1f32-4d67-8615-b4d889daee9f',
  'a189c618-2c6b-414e-a473-1b91dbec03d0',
  'd17c1549-473f-40c8-8bf3-3b40365ff103',
  '0deffc76-08c3-4728-86e1-7b382979cd67',
  'd58b9e1b-928f-4605-ae3f-269e8356dd6e',
  '3e249873-451d-490c-b4f2-1590d4c15959'
);

update public.services set subcategoria = 'Colocación de Artefactos' where id in (
  '041205ce-606a-4d51-b656-258d7d9ed74b',
  '9485712a-ba00-4e66-958f-cd3ce53d9245',
  '5a6db621-755c-4a0c-a4df-02d00ef297ee',
  'e3a7aaf6-4c77-45b8-a96a-e840740bbe8f',
  '95ca1c2c-2d97-4ff7-b0ee-8f96813837e4',
  'a33b5f10-2e73-4655-b764-146fe2ccd66f'
);

update public.services set subcategoria = 'Corrección de Potencia' where id in (
  'd351cd17-975e-40ec-b82e-b0c4c9e9b996',
  'dc4a3711-e388-4c1e-be93-aed1d9963873',
  'daaa025c-5d08-46c6-a9c9-44fd0ed0a501',
  '2d8d2446-f4da-42ed-bcbd-310777600e9a',
  '5dd5eec7-14f2-4a8b-b8cc-e40b93957848',
  '9cc3bf57-305f-46d8-b888-a603f77ef023',
  '9d121cd8-48c6-4792-8f02-8dcc11135b57',
  'd9fc714f-51de-42a4-9aac-5a271db0b802'
);

update public.services set subcategoria = 'Mantenimiento' where id in (
  'ea833370-6284-4265-a5b7-4254530ba134',
  'f6c8aa7b-ae9b-4313-a11e-167085753f10',
  '68e9e152-26c1-46f6-b197-37e4ff32393f',
  '4d804dda-68d1-4882-950b-69d742aeb6db',
  'dd9835f6-f8a5-4471-847b-9cdb3b38dd14',
  '792a24a6-fc41-4562-9418-11d6beb8d1f8',
  'eda8a4f0-7ce5-41cf-9a73-3d3b038b729c',
  '08b7dbfa-3b01-4f05-8434-b71861676714'
);

update public.services set subcategoria = 'Personal Contratado' where id in (
  '509849d3-9bf7-4eff-b6e7-b48ba85d532a',
  '5cba02d2-7eff-4ecd-b1c7-d5b34c6082c0',
  '4d463123-c7ee-433e-ba5b-9c62ef14ae0e',
  '7bbc958d-fbb5-47d9-9f5e-25f040f4ab30'
);

update public.services set subcategoria = 'Proyecto Eléctrico' where id in (
  '40a7b2d3-e142-4e3a-a00a-4b97363f2792',
  'f8337136-7983-4f42-97cf-1ffd1dc4ebaa',
  'f98da643-dbf4-43e8-aa3e-ac75ceae96f2',
  '44fd09b9-8d5a-443c-93d0-2b01497a6c3d'
);

update public.services set subcategoria = 'Puesta a Tierra' where id in (
  '36b420f5-750a-480f-90df-4c4701613699'
);

update public.services set subcategoria = 'Tablero Domiciliario' where id in (
  '45a603c5-4283-4602-ae19-21b9967585c9',
  '76a44cd8-0042-4ac0-87ad-e42667fabf5f',
  '4d01ba67-8f2e-4ce1-8cf5-e39ed4b0a695',
  '762bab31-e2e4-49ea-91bf-b42d80094c3d',
  '67b8357a-1054-41f6-af25-4d04c332602f'
);


-- 'Electricidad e Instalaciones Seguras' (id 17ad8361-9fe9-4cd0-9532-680d23a60b11)
-- queda sin subcategoria a propósito: no existe en el tarifario original, es
-- un ítem genérico agregado aparte. Revisar si corresponde asignarle una.

-- 3) Vínculo real de order_quote_items al catálogo de servicios. Se agrega
--    como columna nueva y opcional -- no se toca category_id -- para no
--    romper el presupuesto de rubros que todavía cotizan contra
--    service_categories (Refrigeración, Cerrajería, Soldadura).
alter table public.order_quote_items add column if not exists service_id uuid references public.services(id);

commit;

select
  (select count(*) from public.services where category = 'Electricidad' and subcategoria is not null) as items_con_subcategoria,
  (select count(*) from public.services where category = 'Electricidad' and subcategoria is null) as items_sin_subcategoria,
  (select count(distinct subcategoria) from public.services where category = 'Electricidad') as categorias_distintas;
