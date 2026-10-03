/**
 * Preguntas frecuentes del panel de ayuda (botones, sin IA, gratis y sin cupos).
 * SOLO hechos confirmados — ver docs/base-conocimiento-centro-de-ayuda.md. Lo
 * marcado con ❓ ahí (reembolsos, cancelaciones, zonas, horarios) NO va acá.
 * Término oficial: "Visita de Presupuesto" (nunca "seña").
 */
export type FaqCta = 'order' | 'whatsapp';

export type FaqItem = {
  id: string;
  question: string;
  answer: (visitPrice: string) => string;
  cta?: FaqCta;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'visita',
    question: '¿Qué es la Visita de Presupuesto?',
    answer: () =>
      'Es el servicio en el que un técnico va a tu domicilio, revisa el problema, te da su diagnóstico y presupuesta la solución. Se paga por adelantado, con Mercado Pago, y no es una seña: es el cobro de esa visita.',
    cta: 'order',
  },
  {
    id: 'precio',
    question: '¿Cuánto cuesta la visita?',
    answer: (price) =>
      `La Visita de Presupuesto cuesta hoy ${price}. El trabajo que el técnico te presupueste después (una reparación, una instalación) se cobra aparte.`,
    cta: 'order',
  },
  {
    id: 'aparte',
    question: '¿Se descuenta del trabajo?',
    answer: () =>
      'No. La Visita de Presupuesto y el trabajo son dos cobros distintos: lo que el técnico proponga tiene su propio presupuesto y se cobra aparte de la visita.',
  },
  {
    id: 'rechazo',
    question: '¿Qué pasa si rechazo el presupuesto?',
    answer: () =>
      'La Visita de Presupuesto no se devuelve ni se descuenta, porque corresponde a la visita que hizo el técnico. Si tuviste algún problema con la visita, podés abrir un reclamo dentro de las 48 horas.',
  },
  {
    id: 'formulario',
    question: '¿Cómo completo el pedido?',
    answer: () =>
      'Elegí si no sabés qué necesitás (Visita de Presupuesto) o si ya sabés qué trabajo de precio fijo querés. Después completá: rubro, prioridad, descripción (qué pasa y desde cuándo), dirección (calle, altura o "s/n", localidad y provincia), fecha y franja horaria. Ojo: en "localidad" va el nombre de la localidad, no la altura. La foto se adjunta desde "Armar mi pedido".',
    cta: 'order',
  },
  {
    id: 'estado',
    question: '¿Cómo sigo el estado de mi visita?',
    answer: () =>
      'Entrando a tu cuenta ves el estado, el técnico y el presupuesto, y te llegan avisos en la campanita (técnico asignado, en camino, presupuesto enviado). Si pediste sin cuenta, usá el link de seguimiento que recibís al pagar. Te avisamos cuando el técnico sale, llega y termina; no hay mapa en vivo.',
  },
  {
    id: 'tecnico',
    question: '¿Cuándo puedo escribirle al técnico?',
    answer: () =>
      'Cuando el técnico acepta tu pedido, en tu orden aparece su presentación con un botón para escribirle y coordinar la visita. Mientras seguimos buscando técnico todavía no hay a quién escribirle; si no ves el botón, es porque aún no hay técnico confirmado.',
  },
  {
    id: 'reclamo',
    question: '¿Cómo abro un reclamo?',
    answer: () =>
      'Desde "Reclamos y garantías" tocá "Abrir reclamo". Tenés hasta 48 horas después del servicio y la garantía es de 30 días. Para que te entiendan rápido, contá qué pasó, cuándo y qué solución esperás.',
  },
  {
    id: 'calificar',
    question: '¿Cómo califico al técnico?',
    answer: () =>
      'Cuando termina el servicio, en tu pedido aparece "Calificá este servicio". Tu opinión nos ayuda a mejorar.',
  },
  {
    id: 'pagos',
    question: '¿Cómo se paga?',
    answer: () =>
      'Todos los pagos se hacen de forma segura con Mercado Pago desde la app. Nunca compartas datos de tarjeta por chat.',
  },
  {
    id: 'rubros',
    question: '¿Qué servicios ofrecen?',
    answer: () =>
      'Plomería, Electricidad, Reparaciones del hogar, Cerrajería, Refrigeración y Soldadura. Al armar tu pedido ves el catálogo completo de cada rubro.',
    cta: 'order',
  },
  {
    id: 'emergencia',
    question: '¿Atienden emergencias?',
    answer: () =>
      'No ofrecemos servicio de emergencia: atendemos en horario comercial. Si hay riesgo (fuego, chispas, olor a gas), cortá la energía si podés hacerlo sin riesgo y contactá a bomberos o a la empresa distribuidora.',
  },
];

export function formatPrice(amount: number): string {
  return `$${new Intl.NumberFormat('es-AR').format(amount)}`;
}
