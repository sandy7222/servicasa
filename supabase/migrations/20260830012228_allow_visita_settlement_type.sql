-- technician_settlements_settlement_type_check solo permitía
-- 'completed_work' y 'rejected_visit'; la nueva liquidación 'visita'
-- (create_visit_settlement_on_started) necesita el tercer valor.
alter table public.technician_settlements
  drop constraint technician_settlements_settlement_type_check;
alter table public.technician_settlements
  add constraint technician_settlements_settlement_type_check
  check (settlement_type = any (array['completed_work'::text, 'rejected_visit'::text, 'visita'::text]));
