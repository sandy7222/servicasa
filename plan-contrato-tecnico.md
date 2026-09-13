# Plan: módulo "Contratos" (contrato de prestación de servicios del técnico)

Rama de trabajo: sobre la rama principal activa, sin rama propia (cambio acotado a un solo commit).

## 1. Contexto

Charla con Sandy del 13/9/2026: además de la evidencia técnica de aceptación de Términos y
Condiciones (ver plan-terminos-y-condiciones.md) y de exigir monotributo + doble facturación
(técnico→cliente, plataforma→técnico), Sandy pidió un módulo en el panel de administrador para
generar e imprimir, en el momento que haga falta, un Contrato de Prestación de Servicios
Independientes con un técnico puntual — con sus datos precargados automáticamente en vez de
tipearlos a mano cada vez.

Antes de construirlo se le preguntó a Sandy dos decisiones de diseño (ver historial de la
conversación): (a) qué hacer con que el sistema hoy no le pide DNI ni CUIT/monotributo al técnico
al suscribirse — eligió agregar esos dos campos a la ficha del técnico, editables desde el panel;
y (b) dónde debía vivir el módulo — eligió una pestaña nueva "Contratos" en el Hub de Admin.

## 2. Diseño

- **Datos nuevos del técnico**: `dni` y `cuit` (ambos `text`, nullable) en `public.technicians`
  (migración `20260913140000_technician_contract_fields.sql`). No se piden al suscribirse — se
  cargan a mano, ya sea desde el modal "Editar Técnico" (Hub → Técnicos) o directamente desde el
  propio módulo Contratos cuando hacen falta para completar el contrato de ese técnico.
- **Identidad de "LA PLATAFORMA"**: dos settings nuevos, `platform_legal_name` y
  `platform_legal_cuit` (mismo mecanismo que el resto de `system_settings`, visibilidad `admin`),
  para que la razón social/CUIT de quien opera TecniUrbano se cargue una sola vez desde el propio
  módulo Contratos y se reuse en todos los contratos siguientes.
- **Texto del contrato**: única fuente de verdad en `src/lib/contractDocument.ts`
  (`buildTechnicianContractText`), que arma el texto a partir del técnico elegido, la comisión de
  plataforma (`platform_commission_rate`, ya existente) y los datos de la Plataforma. Cualquier
  dato que falte se deja como placeholder entre corchetes (`[Completar DNI]`, etc.) en vez de
  imprimir un contrato con huecos silenciosos. El contrato formaliza en un papel firmable lo mismo
  que ya dice `TERMS_TECNICO_TEXT` (vínculo comercial independiente, sin exclusividad, facturación
  directa al cliente, comisión de la Plataforma) — lo complementa, no lo reemplaza. Mismo criterio
  que los Términos y Condiciones: es un borrador técnico, no una redacción validada por un
  abogado — pendiente esa revisión antes de usarlo para firmar de verdad.
- **UI**: pestaña nueva "Contratos" en el Hub de Admin (`TechnicianContractPanel.tsx`), con buscador
  de técnico a la izquierda y, a la derecha, una vista previa del contrato ya completado más el
  botón "Imprimir". Si al técnico elegido le falta DNI o CUIT, aparece un aviso con esos dos campos
  para completarlos ahí mismo (llama al mismo `updateTechnician` que ya usa el modal de edición).
- **Impresión**: técnica clásica de `visibility: hidden` en `src/index.css` — el botón "Imprimir"
  agrega la clase `printing-contract` a `<body>` justo antes de `window.print()` (y se saca sola al
  terminar, con el evento `afterprint`); mientras esa clase está puesta, todo queda oculto salvo el
  nodo `.printable-contract`, que se reposiciona para ocupar toda la hoja. Así sale solo el
  contrato, sin el resto del Hub de Admin alrededor.

## 3. Alcance y lo que quedó afuera (a propósito)

- No se tocó el formulario de alta de técnico (`apply`) ni el de creación manual ("Nuevo Técnico")
  para pedir DNI/CUIT ahí — quedan opcionales, cargados on-demand cuando hace falta el contrato.
- El contrato no queda registrado en ninguna tabla (a diferencia de `legal_acceptances`): es un
  documento para imprimir y firmar en papel, no un click-wrap con evidencia digital. Si más
  adelante se quiere firma digital o un registro de qué contratos se generaron, es un paso aparte.
- No se revisó el texto legal con un abogado — mismo estado que `legalTerms.ts`.

## 4. Verificación

- `tsc --noEmit` limpio sobre todos los archivos tocados y los dos nuevos.
- Migración aplicada y verificada contra el proyecto real (`ayszrtieplmqscqtabsu`); `get_advisors`
  sin hallazgos nuevos.
- `git diff -b --stat` confirmó, antes de commitear, que el diff de los archivos existentes
  correspondía exactamente a estos cambios.
