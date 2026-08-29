# Changelog

Registro de cambios funcionales relevantes de TecniUrbano. No reemplaza `git log`
(los detalles de implementación están en los commits y las migraciones) — es un
resumen de qué cambió para el negocio y qué evidencia lo respalda.

## 2026-08-29 — Fase 6 ampliada: alta y perfil de técnico, Tanda 2 (flujo visible)

Segunda tanda, sobre el schema/backend de la Tanda 1. Esta es la que cambia el
flujo real que usan técnicos y admin.

**"Ser técnico" ahora es un alta real** — pide contraseña y rubros (checkboxes
de categorías reales, no un `<select>` de un solo valor) y crea la cuenta +
ficha del técnico al enviar el formulario (`self_register_technician`), sin
esperar ningún paso de admin. Se loguea al toque en `/technician`. Si Supabase
pide confirmar el email antes de dar sesión, se avisa igual que en el alta de
cliente (mismo patrón que `registerCustomer`).

**"Mi perfil profesional" ahora es editable** — teléfono laboral, formación,
título, institución, presentación, dirección y email pasan de ser de solo
lectura a editables por el propio técnico. La contrapartida: "Editar Técnico"
(admin) dejó de exponer esos mismos campos — ya no hay dos pantallas
escribiendo el mismo dato, que era justo el bug que motivó que antes fueran
de solo lectura para el técnico. CBU sigue en su propia sección (ya era
editable desde la Tanda 1's fix).

**Panel "Solicitudes 'Ser técnico'" pasa a ser bitácora de solo lectura** — sin
botones de Aprobar/Rechazar (ya no hace falta: la cuenta ya existe para
cuando el admin ve la fila). La aprobación real del perfil sigue pasando por
"Validación de técnicos", sin cambios ahí.

**Verificado de punta a punta con una cuenta de prueba real** (creada por el
formulario público real, no simulada): alta con rubro "Plomería" → ficha
`technicians` creada con `validation_status='pending'`, 6 requisitos
sembrados, `technician_specialties` correcto, redirigido a `/technician`
automáticamente; edité "Mi perfil profesional" (teléfono laboral, dirección,
formación, título, institución, presentación) y confirmé cada campo escrito
en la base; confirmé desde el admin que "Solicitudes" la muestra sin botones
de acción, "Validación de técnicos" la lista como pendiente, y "Editar
Técnico" ya no tiene los campos removidos. Cuenta de prueba (`auth.users`
incluido) borrada al terminar — 4 técnicos reales sin residuo.

Código removido en el proceso (quedaba muerto tras el cambio de flujo):
`submitTechnicianApplication`/`persistCreateTechnicianApplication`,
`reviewTechnicianApplication`/`persistReviewTechnicianApplication`,
`TechnicianApplicationInput`, `handleApproveApplication`, los 5 campos de
"perfil profesional" en `TechnicianInput` y en el UPDATE de
`persistUpdateTechnician`.

**Verificación:** `tsc --noEmit`, `vitest run` (69/69), `npm run build`.

## 2026-08-29 — Fase 6 ampliada: alta y perfil de técnico, Tanda 1 (schema y backend)

Primera de dos tandas del rediseño de alta y perfil de técnico, a partir de una
auditoría que encontró aprobaciones de requisitos sin datos reales detrás
(`education_verified` aprobado con `education_level`/`degree_title`/`institution_name`
en `null`). Esta tanda es toda de base y backend — sin cambios de flujo visibles
todavía (eso es la Tanda 2: alta automática de cuenta, "Mi perfil profesional"
editable, panel de solicitudes de solo lectura).

**Múltiples rubros por técnico**
- Tabla nueva `technician_specialties(technician_id, category_id)` (no array de
  texto) + RLS (`technician_specialties_select_scoped`, `technician_specialties_write_admin`).
- Backfill de los 4 técnicos existentes por coincidencia de nombre de categoría
  contra el texto libre de `technicians.specialty` (un caso, "Pintor", no
  matcheaba ninguna categoría por texto y se corrigió a mano a "Reparaciones del
  hogar" — verificado registro por registro contra la base real).
- `technicians.specialty` queda como columna de compatibilidad (ya no se
  escribe) — el código ahora arma ese string uniendo los nombres reales de
  `technician_specialties` con `, `.
- Migrados a la tabla nueva: alta y edición de técnico (Admin Hub), matching de
  elegibilidad para reasignación automática (`offer_to_next_eligible_technician`),
  `technician_public_view` (ficha pública que ve el cliente), y las listas de
  `TechnicianValidation`/`TechnicianReviewCard`.
- Verificado en vivo: edité a Carlos Méndez desde el Admin Hub agregándole
  "Cerrajería" y confirmé el cambio contra la base real antes de revertirlo.

**Columna `technicians.address`** — nueva, para la dirección propia del técnico
(hasta ahora no existía; solo había `zone`/`province`). Se llena desde la Tanda 2
(alta automática y "Mi perfil profesional"); el formulario de admin no la toca.

**Bug real corregido: CBU editado no volvía a pending**
- `lock_technician_review_fields` solo reseteaba `validation_status` a
  `pending` en INSERT, nunca en UPDATE — un técnico ya aprobado podía cambiar su
  CBU sin que nadie lo revisara de nuevo.
- Ahora un UPDATE no-admin en `technician_payment_accounts` fuerza
  `validation_status` a `pending` y además resetea el requisito puntual
  (`technician_requirements.status = 'bank_account_valid'`) — no toca
  `is_enabled` ni el resto del perfil, tal como se pidió.
- La función necesitó `SECURITY DEFINER` para poder escribir esa segunda tabla
  bajo el rol del propio técnico — se detectó con una prueba con rollback que
  falló antes de agregarlo (el UPDATE cruzado quedaba bloqueado por RLS, sin
  error visible) y se volvió a probar después, confirmando el fix real.
- Verificado con dos pruebas con rollback contra Carlos Méndez: (1) admin
  aprueba CBU → técnico edita CBU → ambos estados vuelven a `pending`; (2)
  admin edita un dato no sensible (alias) → el estado aprobado no se toca.

**Alta automática (backend, todavía sin UI)** — `self_register_technician(...)`
(`SECURITY DEFINER`): crea `technicians` + `technician_specialties` + siembra
`technician_requirements` + promueve el perfil a `role='technician'`, en un
solo paso atómico. Probado con rollback: alta completa de un usuario existente
(Julián, cliente) con doble rol preservado (mantiene su ficha de cliente),
rubro múltiple con matrícula requerida detectada correctamente, y los dos
guardas de seguridad (una cuenta admin no puede autoconvertirse; una cuenta que
ya tiene ficha de técnico no puede duplicarla).

**Bucket `technician-documents` acepta imágenes** — sumados `image/jpeg` e
`image/png` a `allowed_mime_types` (antes solo `application/pdf`), mismo
criterio que `technician-avatars`. Se actualizaron los dos checks del lado del
cliente que rechazaban no-PDF antes de llegar a Storage
(`ProfessionalProfile.tsx`, `TechnicianReviewCard.tsx`).

**Migraciones aplicadas** (`ayszrtieplmqscqtabsu`): `create_technician_specialties`,
`add_technicians_address_column`, `fix_payment_account_edit_resets_requirement`,
`fix_lock_technician_review_fields_security_definer`, `create_self_register_technician`,
`allow_image_uploads_technician_documents_bucket`, `backfill_technician_specialties`,
`reoffer_uses_technician_specialties`, `technician_public_view_uses_specialties_table`.

**Verificación:** `tsc --noEmit`, `vitest run` (69/69), `npm run build`, todos
en verde. Commit `d4037f7`.
