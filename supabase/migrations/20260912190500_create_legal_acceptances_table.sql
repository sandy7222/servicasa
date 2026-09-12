-- Evidencia técnica de aceptación de Términos y Condiciones (charla con
-- Sandy, 12/9: cómo probar que un cliente o técnico aceptó las condiciones
-- de la plataforma). Registro append-only: no hay policy de UPDATE ni
-- DELETE para nadie (ni siquiera el dueño de la fila), a propósito — el
-- valor de esto como evidencia depende de que nadie pueda editarlo después.
-- Solo el código server-side con supabaseAdmin (api/legal/accept-terms.ts)
-- inserta filas, nunca el cliente/browser directamente.
--
-- document_hash es el SHA-256 (hex, 64 caracteres) del texto exacto que la
-- persona vio en el momento de aceptar (ver src/lib/legalTerms.ts +
-- src/lib/legalAcceptance.ts) — si el texto legal cambia más adelante, el
-- hash de una aceptación vieja sigue probando exactamente qué versión leyó
-- esa persona, incluso si document_version no se hubiera actualizado a mano.

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('cliente', 'tecnico')),
  document_slug text not null check (document_slug in ('terminos_cliente', 'terminos_tecnico')),
  document_version text not null,
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index legal_acceptances_user_idx on public.legal_acceptances (user_id);

-- RLS: cada usuario puede ver sus propias aceptaciones (por si alguna vez
-- hace falta mostrárselas desde su cuenta), pero no puede insertar, editar
-- ni borrar nada — mismo patrón que public.payment_transactions.
alter table public.legal_acceptances enable row level security;

create policy "legal_acceptances_select_own"
  on public.legal_acceptances for select
  to authenticated
  using (auth.uid() = user_id);
