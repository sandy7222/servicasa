-- Aceptación de la Política de Privacidad junto con los Términos y Condiciones.
-- legal_acceptances solo admitía 'terminos_cliente' y 'terminos_tecnico' en document_slug;
-- se suma 'politica_privacidad'. Aditiva: las filas existentes no cambian.
-- El código guarda la privacidad en modo "mejor esfuerzo": si esta migración todavía no está
-- aplicada, el registro de la cuenta sigue funcionando y solo se omite esa fila.

alter table public.legal_acceptances drop constraint if exists legal_acceptances_document_slug_check;
alter table public.legal_acceptances
  add constraint legal_acceptances_document_slug_check
  check (document_slug in ('terminos_cliente', 'terminos_tecnico', 'politica_privacidad'));
