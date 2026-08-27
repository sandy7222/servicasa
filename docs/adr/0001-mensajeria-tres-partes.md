# ADR 0001 — Sistema de mensajería admin ↔ técnico ↔ cliente

**Fecha:** 23/8/2026
**Estado:** propuesta, esperando aprobación de Sandy antes de tocar código.
**Contexto:** Fase 3 de `ROADMAP-TERMINACION.md`.

## Problema

Hoy no existe ningún canal de conversación real entre admin, técnico y cliente. Lo único parecido que existe en el código:

1. **`order_events`** — un log de una sola vía (timeline de una orden: "asignada", "iniciada", etc.), pensado para trazabilidad automática, no para que dos personas conversen.
2. **`support_case_messages`** (recién conectado en la Fase 2) — un hilo de mensajes, pero **atado a un caso de Reclamos y Garantías**: tiene su propio ciclo de vida (`case_type`, `status: open/in_progress/resolved/closed`, `resolution_type`), y su RLS asume que "cliente" y "técnico" son exactamente los de `support_cases.customer_id`/`technician_id`. No es una conversación general, es el hilo de un expediente de reclamo.

Ninguno de los dos sirve para "el cliente le pregunta algo al técnico sobre el horario de mañana" o "el admin le avisa algo a un cliente" sin que eso sea, técnicamente, un reclamo.

## Alternativa A — Extender `support_case_messages` para todo uso

Reutilizar la tabla que ya existe: cualquier conversación (tenga o no que ver con un reclamo) se modela como una fila de `support_cases` con mensajes adentro.

**A favor:** cero tablas nuevas, RLS y UI ya probadas anoche en vivo (Fase 2).

**En contra:**
- Fuerza a crear un "caso" (con estado, prioridad, tipo de reclamo) para cualquier intercambio de mensajes, aunque no sea un reclamo — es exactamente lo que la meta original de esta fase quiere evitar ("que toda comunicación normal parezca un reclamo").
- El RLS de `support_cases` asume una sola relación fija por caso (un `customer_id`, un `technician_id`). No modela bien una conversación de tres partes a la vez, ni "el admin le escribe a un cliente sin que haya ni orden ni reclamo de por medio".
- Mezclaría dos ciclos de vida distintos (expediente de reclamo vs. charla cotidiana) en la misma tabla, lo que con el tiempo hace más difícil auditar reclamos reales.

## Alternativa B — Sistema general (`conversations` / `conversation_participants` / `messages` / `message_reads`)

Un modelo de conversaciones genérico, donde una conversación puede (opcionalmente) estar asociada a una orden o a un reclamo, o no estar asociada a nada (contacto directo).

```
conversations            (id, order_id?, case_id?, subject, created_by, created_at, last_message_at)
conversation_participants(id, conversation_id, profile_id, role, added_at)
messages                 (id, conversation_id, sender_id, sender_role, body, is_internal, created_at)
message_reads            (id, message_id, profile_id, read_at)
```

**A favor:**
- Separa "expediente de reclamo" (sigue viviendo en `support_cases`) de "conversación" — cada cosa en su tabla, con su propio ciclo de vida.
- Modela de entrada lo que pide el resto de la fase: bandeja con filtros por orden/reclamo/contacto, contador de no leídos por usuario (`message_reads`), vínculo desde ficha de cliente/técnico/orden/reclamo.
- `case_id` opcional en `conversations` deja la puerta abierta a que, más adelante, Reclamos también use esta misma bandeja sin perder su auditoría — tal como pide el criterio de aceptación de esta fase — sin tener que decidirlo ahora.

**En contra:**
- 4 tablas nuevas en vez de 0, más superficie de RLS para escribir y probar bien.
- No reutiliza la UI de mensajes que ya armamos y probamos anoche para Reclamos — habría una segunda bandeja de mensajes con otro componente.

## Recomendación

**Alternativa B**, tal como ya sugería el roadmap. La razón principal no es técnica sino de producto: un reclamo es un expediente con estado y resolución, una conversación cotidiana no lo es, y forzar todo a través de `support_cases` iba a ensuciar exactamente el módulo que recién terminamos de probar anoche.

**Decisión de alcance que te pido confirmar, no la tomo sola:** para esta fase, `support_cases`/`support_case_messages` **no se tocan** — siguen siendo el sistema de reclamos, tal cual quedó anoche verificado. La bandeja nueva (`conversations`) cubre lo que hoy no existe: charla ligada a una orden, y contacto directo. Unificar Reclamos dentro de la bandeja general queda como una fase posterior, deliberadamente pospuesta — tocar `support_case_messages` ahora, recién horneado y probado, iría contra la idea de "lo que ya funciona, se blinda" que charlamos ayer.

## Matriz de permisos (RLS) propuesta

| Tabla | Admin | Cliente | Técnico |
| --- | --- | --- | --- |
| `conversations` (SELECT) | Todas | Solo donde es `conversation_participants` | Solo donde es `conversation_participants` |
| `conversations` (INSERT) | Sí, cualquiera | Solo si él mismo queda como participante, y **el otro extremo declarado es admin o el técnico de una orden propia** (nunca un tercero arbitrario) | Igual que cliente, espejado |
| `conversation_participants` (SELECT) | Todas | Solo filas de conversaciones donde participa | Solo filas de conversaciones donde participa |
| `conversation_participants` (INSERT) | Sí | Solo agregándose a sí mismo al crear, nunca a un tercero | Igual |
| `messages` (SELECT) | Todos, incluidas notas internas | Solo de sus conversaciones, `is_internal = false` | Solo de sus conversaciones, `is_internal = false` |
| `messages` (INSERT) | Sí, cualquier conversación, notas internas incluidas | Solo en conversaciones propias, nunca `is_internal = true` | Igual |
| `message_reads` (SELECT/INSERT) | Total | Solo las propias (marcar como leído un mensaje propio) | Solo las propias |

**Punto que necesito que definas vos, porque es una decisión de producto, no técnica:** ¿un cliente puede iniciar una conversación directa con un técnico sin que un admin esté ya en el medio (por ejemplo, para coordinar el horario de una visita), o toda conversación cliente↔técnico tiene que incluir a admin como tercero visible desde el vamos? La tabla de arriba asume la segunda opción (más conservadora, evita contacto no supervisado), pero es tu llamada.

## Qué pasa después de tu aprobación

Una vez que confirmes Alternativa B (o pidas ajustes) y contestes la pregunta de arriba, implemento por etapas, tal como pediste:

1. Esquema (`conversations`, `conversation_participants`, `messages`, `message_reads`) + RLS + pruebas negativas, mismo patrón que `support_cases` anoche.
2. Biblioteca de datos (`src/lib/conversations.ts`, espejando `supportCases.ts`).
3. Bandeja (lista de conversaciones, filtros por orden/reclamo/contacto).
4. Hilo Realtime (usando Supabase Realtime, ya usado en `AppContext.tsx` para `postgres_changes`).
5. Contadores de no leídos (Header + por rol).
