alter table public.technicians
  add column if not exists address text not null default '';
