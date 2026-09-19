// Textos de Términos y Condiciones (cliente y técnico) — ver plan-terminos-y-condiciones.md.
//
// Estas constantes son la ÚNICA fuente de verdad del texto legal: las
// páginas públicas (/terminos_y_condiciones/cliente y /terminos_y_condiciones/tecnico)
// las renderizan tal cual, y el mismo string se hashea (SHA-256, ver
// src/lib/legalAcceptance.ts) en el momento de aceptar en el formulario de
// registro — así el hash que queda guardado en legal_acceptances corresponde
// exactamente al texto que la persona vio, no a una copia aparte que se
// pueda desincronizar con el tiempo.
//
// Cada vez que se cambie el contenido de un texto, hay que bumpear su
// *_VERSION (fecha ISO del cambio) para que quede claro en los registros
// viejos qué versión aceptó cada quien — el hash ya lo garantiza
// criptográficamente, la versión es para que un humano lo lea fácil.
//
// IMPORTANTE: este texto es un borrador técnico, no una redacción validada
// por un abogado. Antes de considerarlo definitivo hay que revisarlo con un
// abogado (ver charla del 12/9 sobre responsabilidad frente al consumidor —
// Art. 40 Ley 24.240 — y la calificación laboral del vínculo con el técnico).

export const TERMS_CLIENTE_VERSION = '2026-09-12';
export const TERMS_TECNICO_VERSION = '2026-09-12';

export const TERMS_CLIENTE_TEXT = `Última actualización: 12 de septiembre de 2026.

1. Quiénes somos y qué hace TecniUrbano
TecniUrbano (en adelante, "la Plataforma") es una plataforma tecnológica que conecta a personas que necesitan un servicio de reparación, mantenimiento o instalación en su hogar ("el Cliente") con técnicos independientes que ofrecen esos servicios ("el Técnico"). TecniUrbano no presta los servicios de reparación, mantenimiento o instalación: actúa como intermediario tecnológico entre el Cliente y el Técnico, facilitando el contacto, el presupuesto, el turno, el pago y el seguimiento del trabajo. El Técnico que acepta y ejecuta un pedido es un prestador de servicios independiente, ajeno a la estructura de personal de TecniUrbano.

2. Cómo funciona el servicio
El Cliente describe el problema o el trabajo que necesita a través de la Plataforma (incluyendo, si corresponde, fotos y el asistente de diagnóstico). Según el caso, se genera un precio fijo del catálogo o se coordina una visita de diagnóstico con un Técnico, quien presenta un presupuesto antes de ejecutar el trabajo. El pedido queda confirmado recién cuando el Cliente revisa el detalle y lo envía o acepta el presupuesto desde su cuenta: el asistente de diagnóstico orienta y arma un borrador, pero no confirma ni contrata el trabajo por sí solo.

3. Precios y pagos
Los precios publicados en el catálogo aplican a los ítems elegidos. Si el trabajo requiere diagnóstico en el domicilio, el costo de esa visita y el presupuesto del trabajo se informan antes de confirmar cada etapa. Todos los pagos se procesan de forma segura a través de Mercado Pago desde la Plataforma. El Cliente puede indicar una franja horaria preferida para el turno; esa preferencia se coordina con el Técnico asignado y no garantiza un horario exacto.

4. Responsabilidad por la ejecución del trabajo
La ejecución material del servicio (calidad del trabajo, materiales utilizados, tiempos de ejecución en el domicilio) es responsabilidad del Técnico independiente que lo lleva a cabo. TecniUrbano pone a disposición del Cliente los canales de reclamo, seguimiento y garantía descriptos en esta sección, y colabora activamente en la resolución de cualquier inconveniente, sin perjuicio de las responsabilidades que la normativa de defensa del consumidor vigente pudiera atribuir a cada parte de la cadena de intermediación.

5. Garantía y reclamos
Si el trabajo no queda bien, se soluciona sin cargo dentro de los 30 días posteriores a su finalización. Para abrir un reclamo, el Cliente tiene hasta 48 horas después de finalizado el servicio; el reclamo se carga y se sigue desde la cuenta del Cliente en la Plataforma.

6. Cancelaciones
El Cliente puede cancelar un pedido antes de que el Técnico inicie el trabajo. Las condiciones de reembolso dependen de la etapa en la que se encuentre el pedido (por ejemplo, si ya se abonó una seña de visita de diagnóstico) y se informan en el detalle del pedido antes de confirmar la cancelación.

7. Datos personales
Los datos que el Cliente comparte con la Plataforma (incluidos los de un pedido o una foto de diagnóstico) se usan para coordinar el servicio, la garantía y la atención al Cliente, conforme a la Ley 25.326 de Protección de Datos Personales. Esos datos se comparten con el Técnico asignado en la medida necesaria para ejecutar el trabajo solicitado.

8. Modificaciones a estos Términos
TecniUrbano puede actualizar estos Términos y Condiciones. Los cambios se publican en esta misma página con su fecha de actualización; el uso continuado de la Plataforma después de una actualización implica su aceptación.

9. Jurisdicción y contacto
Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier duda o reclamo, el Cliente puede escribir a hola@tecniurbano.online.`;

export const TERMS_TECNICO_TEXT = `Última actualización: 12 de septiembre de 2026.

1. Qué es TecniUrbano para el Técnico
TecniUrbano (en adelante, "la Plataforma") es una herramienta tecnológica que conecta a técnicos independientes ("el Técnico") con personas que necesitan un servicio de reparación, mantenimiento o instalación en su hogar ("el Cliente"). La Plataforma facilita el contacto con el Cliente, la gestión de presupuestos y turnos, el cobro del trabajo y la comunicación entre las partes. TecniUrbano no es empleador del Técnico: el vínculo entre el Técnico y TecniUrbano es un vínculo comercial de prestación de servicios independiente, no una relación de dependencia laboral.

2. Naturaleza del vínculo
El Técnico presta sus servicios de forma independiente, con sus propios medios, conocimientos técnicos y bajo su propio criterio profesional para la ejecución material del trabajo. El Técnico puede aceptar o rechazar los pedidos que se le asignen o que estén disponibles en la Plataforma, y puede prestar servicios similares a través de otras plataformas o por cuenta propia, sin exclusividad hacia TecniUrbano.

3. Requisitos para operar en la Plataforma
Para operar en la Plataforma, el Técnico debe mantener una inscripción fiscal vigente (monotributo o responsable inscripto, según corresponda) y emitir la factura correspondiente por cada trabajo directamente al Cliente que lo recibió, por el valor total del servicio prestado. El Técnico debe además mantener actualizados sus datos de cobro (CBU o CVU) para recibir las liquidaciones que le correspondan.

4. Comisión de la Plataforma
TecniUrbano cobra una comisión por el servicio de intermediación tecnológica prestado al Técnico, que se descuenta al momento de liquidar cada trabajo. TecniUrbano emite al Técnico el comprobante correspondiente a esa comisión. El Cliente paga el valor total del servicio a través de la Plataforma; TecniUrbano liquida al Técnico el monto que le corresponde una vez descontada la comisión.

5. Uso de la cuenta
La cuenta del Técnico en la Plataforma es personal e intransferible. El Técnico es responsable de la información que carga en su perfil (rubros, zona de trabajo, disponibilidad) y de mantenerla actualizada.

6. Suspensión o baja de la cuenta
TecniUrbano puede suspender o dar de baja la cuenta de un Técnico ante incumplimientos graves de estos Términos, reclamos fundados y reiterados de Clientes, o irregularidades en la información fiscal declarada. Salvo en casos de urgencia o riesgo para Clientes, se notificará al Técnico el motivo de la medida.

7. Datos personales
Los datos que el Técnico comparte con la Plataforma se usan para gestionar su cuenta, asignarle pedidos y procesar sus liquidaciones, conforme a la Ley 25.326 de Protección de Datos Personales.

8. Modificaciones a estos Términos
TecniUrbano puede actualizar estos Términos y Condiciones. Los cambios se publican en esta misma página con su fecha de actualización; el uso continuado de la Plataforma después de una actualización implica su aceptación.

9. Jurisdicción y contacto
Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier duda, el Técnico puede escribir a hola@tecniurbano.online.`;

// Política de Privacidad — texto público en /politica-de-privacidad. Distinta
// de los Términos y Condiciones de arriba: los Términos son el contrato del
// servicio, esto es la declaración de qué datos personales recolectamos, para
// qué y con quién los compartimos (lo que pide Play Console en su formulario
// de "Seguridad de los datos", y lo que exige la Ley 25.326 de Protección de
// Datos Personales). No lleva mecanismo de aceptación con hash como los
// Términos: es información, no una cláusula contractual que haga falta
// probar que alguien aceptó puntualmente.
export const PRIVACY_POLICY_VERSION = '2026-09-19';

export const PRIVACY_POLICY_TEXT = `Última actualización: 19 de septiembre de 2026.

Esta Política de Privacidad describe qué datos personales recolecta TecniUrbano ("la Plataforma") a través del sitio tecniurbano.online y de la aplicación para Android, para qué los usamos, con quién los compartimos y qué derechos tenés sobre ellos. Aplica a clientes, técnicos independientes y visitantes del sitio.

1. Qué datos recolectamos
Datos de cuenta: nombre, correo electrónico, teléfono y contraseña (esta última nunca queda visible para nosotros: la protege nuestro proveedor de autenticación).
Datos de perfil del Técnico: dirección o zona de trabajo declarada, rubros, documentación de validación (por ejemplo DNI o CUIT) y datos bancarios (CBU, CVU o alias) para poder liquidarle sus pagos.
Datos del pedido: dirección del domicilio donde se presta el servicio, descripción del problema, fotos que se suben al asistente de diagnóstico, y el historial de mensajes dentro de la conversación de ese pedido.
Datos de ubicación: la localidad y la zona de cobertura que el Técnico configura manualmente en su perfil. No rastreamos la ubicación de nadie en segundo plano ni de forma continua.
Datos de pago: los pagos se procesan a través de Mercado Pago. TecniUrbano no almacena números de tarjeta; solo recibe la confirmación y el estado del pago.
Datos técnicos: dirección IP, tipo de dispositivo y navegador, y la fecha y hora en que se aceptaron los Términos y Condiciones (esto se guarda como evidencia técnica de esa aceptación).
Preferencias locales: ajustes como el modo claro u oscuro se guardan en tu propio dispositivo, nunca en nuestros servidores.

2. Para qué usamos estos datos
Para coordinar el servicio entre el Cliente y el Técnico: asignación, presupuesto, seguimiento del trabajo y firma de conformidad.
Para procesar pagos y liquidaciones.
Para validar la identidad e idoneidad de los técnicos antes de habilitarlos en la Plataforma.
Para atender reclamos, garantías e incidencias.
Para enviar notificaciones relacionadas con tus propios pedidos (nunca publicidad de terceros).
Para cumplir obligaciones legales, impositivas y contables.
Para prevenir fraude y uso indebido de la Plataforma.

3. Con quién compartimos tus datos
No vendemos datos personales a nadie. Los compartimos únicamente con los proveedores que necesitamos para operar la Plataforma:
Supabase, que aloja la base de datos, la autenticación y el almacenamiento de archivos.
Mercado Pago, para procesar cobros y pagos.
Vercel, para el hosting del sitio web.
También se comparten entre las partes de un mismo pedido: el Cliente ve el nombre y los datos de contacto del Técnico asignado, y viceversa, en la medida necesaria para coordinar el servicio. Y, cuando la ley lo exige, con autoridades competentes.

4. Cuánto tiempo conservamos tus datos
Conservamos los datos mientras la cuenta esté activa, y el tiempo adicional que exijan las obligaciones legales, impositivas o de defensa ante reclamos que correspondan. Si pedís la baja de tu cuenta, te informamos qué información podemos eliminar y cuál debemos conservar por esas obligaciones.

5. Tus derechos
De acuerdo a la Ley 25.326 de Protección de Datos Personales de la República Argentina, tenés derecho a acceder, rectificar, actualizar y solicitar la supresión de tus datos personales. La Agencia de Acceso a la Información Pública (AAIP), como órgano de control de esa ley, tiene la facultad de atender denuncias y reclamos por su incumplimiento. Para ejercer cualquiera de estos derechos, escribinos a hola@tecniurbano.online.

6. Seguridad
Usamos conexiones cifradas (HTTPS) y reglas de acceso a nivel de base de datos para que cada usuario solo pueda ver la información que le corresponde. Ningún sistema es infalible, pero trabajamos activamente para proteger tu información.

7. Menores de edad
La Plataforma está destinada a personas con capacidad legal para contratar. No dirigimos el servicio a menores de edad ni recolectamos deliberadamente datos de menores.

8. Cambios a esta política
Podemos actualizar esta Política de Privacidad. Cuando el cambio sea significativo, lo vamos a anunciar en la Plataforma. La fecha de la última actualización figura al principio de este documento.

9. Contacto
Ante cualquier consulta sobre esta política o sobre tus datos personales, escribinos a hola@tecniurbano.online.`;
