-- Fase 3, Tanda 1 (decisiones 6, 7, 3, 8 parcial) - ver ADR en la sesion.
-- conversations.case_id no lo usa ningun codigo hoy (reclamos tiene su
-- propio esquema separado: support_case_messages/support_case_history),
-- asi que este ajuste no afecta nada activo.

-- Decision 7: solo admin puede abrir conversaciones de reclamo/garantia
-- (case_id no nulo). En conversaciones sin reclamo (incluidas las de
-- orden), cualquiera puede seguir abriendo como hasta ahora.
drop policy if exists "conversations_insert_self" on public.conversations;
create policy "conversations_insert_self"
on public.conversations
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (case_id is null or is_admin())
);

-- Decision 6: la ventana de mensajeria tecnico<->cliente sobre una orden
-- se abre cuando el tecnico marca salida (work_started_at) y se cierra al
-- completarse. No aplica a conversaciones donde participa un admin
-- (decision 3: admin<->tecnico sin restriccion de horario) ni a
-- conversaciones sin orden ligada (contacto directo con admin).
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
on public.messages
for insert
to authenticated
with check (
  is_internal = false
  and sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.profile_id = auth.uid()
  )
  and (
    exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = messages.conversation_id and cp2.role = 'admin'
    )
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.order_id is null
    )
    or exists (
      select 1 from public.conversations c
      join public.service_orders so on so.id = c.order_id
      where c.id = messages.conversation_id
        and so.work_started_at is not null
        and so.status <> 'completed'
    )
  )
);

-- Decision 8 (parcial): columna dedicada para el motivo de pausa - hoy
-- solo queda como texto suelto en order_events.description.
alter table public.service_orders add column pause_reason text;
