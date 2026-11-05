# Borrador: cláusula de cobros, comisión y liquidaciones (Términos y Condiciones para técnicos)

> **Estado:** borrador aprobado en principio por Sandy el 4/11/2026. **No es asesoramiento legal**: revisarlo con un abogado antes de publicarlo. Lo que está entre [corchetes] falta definir. Reemplazaría o ampliaría la cláusula 4 actual de `TERMS_TECNICO_TEXT` (src/lib/legalTerms.ts); al publicarlo hay que subir `TERMS_TECNICO_VERSION` y resolver la re-aceptación de los técnicos existentes.

## Cláusula X. Cobros, comisión y liquidaciones

**X.1. Medio de cobro.** Los pagos de los Clientes se procesan a través de Mercado Pago. Para recibir pagos de trabajos por la Plataforma, el Técnico debe tener una cuenta de Mercado Pago a su nombre, con la identidad verificada, y vincularla a TecniUrbano desde su perfil.

**X.2. Autorización para cobrar en su nombre.** Al vincular su cuenta, el Técnico autoriza a TecniUrbano a crear, en su nombre y a través de su cuenta de Mercado Pago, los cobros de los trabajos que realice por la Plataforma, y a descontar la comisión prevista en X.4. El Técnico puede revocar esta autorización en cualquier momento desde su cuenta de Mercado Pago. Mientras esté revocada, no podrá recibir pagos de trabajos por la Plataforma.

**X.3. Visita de Presupuesto.** El pago de la Visita de Presupuesto lo recibe TecniUrbano, porque al momento del pago todavía no hay un técnico asignado. Cuando la visita comienza, TecniUrbano registra la liquidación a favor del Técnico, por el valor de la visita menos la comisión prevista en X.4 y menos el cargo que cobre Mercado Pago por ese pago. La liquidación se transfiere a la cuenta bancaria o virtual (CBU/CVU) que el Técnico haya cargado, dentro de los [7] días de iniciada la visita.

**X.4. Comisión.** TecniUrbano cobra una comisión por su servicio de intermediación tecnológica, que hoy es del **17% (diecisiete por ciento)** del valor de cada Visita de Presupuesto y de cada trabajo cobrado por la Plataforma. En los trabajos, la comisión se descuenta automáticamente en el momento del pago, y Mercado Pago acredita el resto en la cuenta del Técnico. El cargo propio de Mercado Pago lo asume el Técnico. TecniUrbano emite al Técnico el comprobante correspondiente a su comisión.

**X.5. Modificación de la comisión.** TecniUrbano puede modificar el porcentaje de la comisión. Todo cambio se comunicará al Técnico con al menos **[30] días de anticipación**, por correo electrónico y dentro de la Plataforma, y **solo se aplicará a los trabajos y visitas que se contraten después** de que entre en vigencia. Si el Técnico no está de acuerdo con el nuevo porcentaje, puede dejar de operar en la Plataforma antes de esa fecha, sin penalidad.

**X.6. Pago reservado hasta la conformidad.** El pago de un trabajo puede quedar reservado en el medio de pago del Cliente hasta que este firme la conformidad y el Técnico cierre el trabajo. Recién entonces se cobra y se acredita. Si la reserva vence sin que se haya completado ese paso (hasta [7] días), [A DEFINIR: se cobra igual / se cancela y se gestiona por otra vía].

**X.7. Reembolsos y contracargos.** Si corresponde devolver un pago, Mercado Pago descuenta el reembolso en proporción de la cuenta del Técnico y de la de TecniUrbano, según sus propias reglas. Si el Técnico no tiene saldo suficiente, deberá cubrir su parte por el medio que TecniUrbano le indique.

**X.8. Facturación.** El Técnico factura al Cliente el valor total de cada trabajo. TecniUrbano factura al Técnico únicamente su comisión.

**X.9. Mercado Pago.** El uso de Mercado Pago se rige también por sus propios términos y condiciones. TecniUrbano no es responsable de demoras, bloqueos o retenciones que aplique Mercado Pago por sus políticas.

## Texto de la casilla al vincular la cuenta de Mercado Pago

> ☐ Autorizo a TecniUrbano a cobrar en mi nombre los trabajos que realice por la Plataforma y a descontar su comisión, según la cláusula X de los Términos y Condiciones para técnicos. Sé que puedo revocar esta autorización desde mi cuenta de Mercado Pago.

## Pendiente de definir
1. Preaviso de cambio de comisión (propuesto: 30 días).
2. Plazo para pagar la liquidación de la visita (hoy: 7 días desde que empieza).
3. Qué pasa si la reserva del trabajo vence sin conformidad (¿se cobra o se cancela?).
4. Si reemplaza o amplía la cláusula 4 actual.
