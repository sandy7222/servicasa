# Plan: presupuesto de obra dentro de la plataforma (opción B)

**Objetivo (Sandy, 25/11/2026):** que el presupuesto que arma el electricista con la herramienta
"Proyecto de instalación" no sirva para arreglar la obra por fuera. El técnico lo manda **solo por la app**,
el cliente lo ve en la app y, si está conforme, **paga por la plataforma**.

Reemplaza la decisión del 24/11 (opción A: obras especiales cobradas fuera de la plataforma).

## Decisiones de Sandy (25/11/2026) — no volver a preguntar

1. **Comisión solo sobre la mano de obra** (17 %, el valor de `platform_commission_rate`, nunca escrito en el código).
   Los materiales, insumos y la depreciación de herramientas no pagan comisión.
2. **Pago en dos partes:**
   - **Anticipo** = lo que ya calcula la herramienta (visita + 50 % de materiales e insumos + depreciación),
     menos la visita si ya se pagó por la plataforma. Se le libera al técnico **enseguida** para comprar materiales.
   - **Saldo** = total − anticipo. Queda **retenido** hasta que el cliente firma conforme al terminar.
   - La comisión se descuenta **del saldo**: el saldo siempre contiene toda la mano de obra, así que alcanza.
3. **El teléfono y el correo del técnico no se le muestran al cliente** (ni en pantalla, ni en la nota PDF, ni por la base).

## Lo que ya existe (no duplicar)

- `order_quotes` ya tiene `subtotal_labor`, `subtotal_materials`, `total_amount`, `visit_deposit_credit`, `remaining_amount`
  y estados draft/sent/accepted/rejected. Avisos `quote_sent`, `quote_accepted`, `quote_rejected` ya llegan al celular.
- `order_quote_items` acepta `item_type` labor/material, pero el trigger `apply_catalog_price_to_quote_item`
  exige que la mano de obra venga del catálogo.
- `payment_transactions.payment_type`: visit_deposit, balance_payment, full_advance, extra_payment.
- `technician_settlements` (liquidaciones, pago manual desde el panel) y el cobro repartido de MP
  (`plan-cobro-repartido.md`, **interruptor apagado**).
- Herramienta: `installationBudget.ts` (total, anticipo, saldo), `installationQuoteNote.ts` (nota PDF),
  `installationQuoteItems.ts` (`PASS_TO_QUOTE_ENABLED = false`).

## Fase 0 — Cerrar la fuga de contacto del técnico (independiente, va primero)

Hallazgo 25/11: la política `technicians_select_scoped` deja que el cliente de una orden lea **la fila entera**
del técnico asignado, con `phone`, `work_phone` y `email`. La app no los muestra, pero cualquiera con su sesión
puede pedirlos a la base.

- [x] 0.1 Ver qué pantallas leen esas columnas (admin, el propio técnico, el cliente) antes de tocar nada.
- [x] 0.2 Migración: el cliente solo ve los datos públicos del técnico (nombre, foto, especialidad, calificación),
      por una vista o función segura; teléfono y correo solo para el propio técnico y el admin.
- [x] 0.3 La nota PDF de la herramienta deja de imprimir teléfono y correo: "Contacto por la app TecniUrbano".
- [x] 0.4 Tests + probar como cliente que la consulta directa ya no devuelve el teléfono.
- [ ] 0.5 Sandy: entrar como cliente con una orden y comprobar que se sigue viendo bien la ficha pública de su técnico.

## Fase 1 — Presupuesto de obra en la base

- [ ] 1.1 Marcar el tipo de presupuesto: `order_quotes.quote_kind` ('standard' | 'obra').
- [ ] 1.2 Columnas de la obra: `advance_amount` (anticipo), `commission_base` (= mano de obra), y el detalle
      de la herramienta guardado como foto fija (lo que vio el cliente no puede cambiar después de enviado).
- [ ] 1.3 Para `quote_kind = 'obra'` el trigger acepta ítems de mano de obra libres (vienen de la herramienta).
      Para el presupuesto común no cambia nada.
- [ ] 1.4 Solo el técnico asignado a la orden puede crear o enviar el presupuesto de obra (RLS + chequeo en la función).

## Fase 2 — Enviar desde la herramienta y verlo como cliente

- [ ] 2.1 En la herramienta: botón **"Enviar al cliente por la app"**, elegir la orden (solo órdenes asignadas a ese técnico).
      Reemplaza a "pasar a presupuesto" (que queda borrado).
- [ ] 2.2 La nota PDF para imprimir queda solo como copia interna del técnico, marcada "no válida como presupuesto:
      el presupuesto oficial está en la app".
- [ ] 2.3 Pantalla del cliente: resumen de la obra (materiales, mano de obra, total), anticipo y saldo,
      garantía y pago protegido, botones **Aceptar y pagar el anticipo** / **Rechazar**.

## Fase 3 — Cobro en dos partes

- [ ] 3.1 Pago del anticipo (Mercado Pago, como hoy). Al aprobarse: liquidación al técnico **liberada al instante**,
      sin comisión (solo el costo de MP).
- [ ] 3.2 Pago del saldo antes de terminar la obra; queda retenido hasta la firma de conformidad.
- [ ] 3.3 Al firmar conforme: liquidación del saldo con la comisión del 17 % sobre `commission_base`.
- [ ] 3.4 Al empezar, todo se cobra a la cuenta de la plataforma y se liquida a mano (como la visita).
      El reparto automático de MP se suma cuando se prenda el interruptor del cobro repartido.

## Fase 4 — Reglas, pruebas y salida

- [ ] 4.1 Cláusula en los términos del técnico: prohibido cobrar por fuera a clientes que llegaron por la plataforma.
- [ ] 4.2 Tests de montos (anticipo, saldo, comisión solo sobre mano de obra) con el ejemplo del TP.
- [ ] 4.3 Prueba real de Sandy con una orden de prueba (técnico y cliente propios).
- [ ] 4.4 Antes de cobrar la primera obra real: contador (facturación de materiales) y abogado (términos).

## Pendientes para decidir más adelante (no bloquean las fases 0 a 2)

- Qué pasa si el cliente no paga el saldo o no firma conforme (¿plazo?, ¿reclamo?).
- Quién paga el costo de Mercado Pago de cada parte.
- Cuotas: si se ofrecen, quién absorbe el recargo.

## Bitácora

| Fecha | Qué |
|---|---|
| 25/11/2026 | Plan escrito con las decisiones de Sandy. Hallazgo de la fuga de teléfono/correo del técnico (Fase 0). |
| 26/11/2026 | Fase 0 aplicada (migración `20261126035805_hide_technician_private_data`). La fuga incluía también DNI, CUIT, domicilio y zona de trabajo. Verificado en la base real: el cliente lee 0 fichas completas y sigue viendo los datos públicos de sus técnicos. |
