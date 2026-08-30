insert into system_settings (key, value, value_type, visibility, description)
values (
  'visit_settlement_commission_rate',
  '0.15'::jsonb,
  'number',
  'admin',
  'Porcentaje que retiene la plataforma sobre la liquidación de la visita de diagnóstico (0.15 = 15%). Propia y separada de platform_commission_rate (17%, solo para completed_work). Usada por el trigger que crea la liquidación ''visita'' al iniciarse el trabajo (assigned -> in_progress).'
);

update system_settings
set description = 'Monto único de seña para la visita de diagnóstico (ARS). Se cobra aparte del presupuesto final, sin descuento entre ambos.'
where key = 'visit_deposit_amount';
