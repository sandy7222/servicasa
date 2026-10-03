/**
 * Avisos de seguridad del chat: texto FIJO, detectado por palabras clave ANTES de
 * llamar a ninguna IA (la IA nunca improvisa sobre emergencias). Los textos de
 * electricidad, plomería y cerrajería son los mismos del asistente de diagnóstico
 * (src/lib/diagnosisAssistant.ts): si cambian allá, cambiarlos acá.
 */
export type SafetyCategory = 'electricidad' | 'gas' | 'plomeria' | 'cerrajeria';

const MESSAGES: Record<SafetyCategory, string> = {
  electricidad:
    'Esto puede ser una emergencia eléctrica. Si podés hacerlo sin riesgo, cortá la llave térmica general y no uses esa instalación.\n\nSi hay riesgo activo — fuego o chispas en curso — no es algo que nosotros resolvamos: contactá a bomberos o a la empresa distribuidora, según corresponda.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.',
  gas:
    'Si hay olor a gas: no prendas luces ni fuego, ventilá y salí del lugar. Llamá a la empresa de gas o a bomberos desde afuera.\n\nNo hacemos trabajos de gas ni ofrecemos servicio de emergencia.',
  plomeria:
    'Si hay una pérdida activa, cerrá la llave de paso general si podés hacerlo sin riesgo. Si el agua está tocando instalaciones eléctricas o no podés cortarla, contactá a bomberos o a un servicio de emergencia de tu zona.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.',
  cerrajeria:
    'Si hay una persona trabada o un riesgo de seguridad ahora mismo, contactá a policía o bomberos según corresponda.\n\nAtendemos en horario comercial. No ofrecemos apertura de emergencia 24 hs.',
};

const RULES: Array<[SafetyCategory, RegExp]> = [
  ['gas', /\b(olor a gas|huele a gas|oler a gas|perdida de gas|fuga de gas|escape de gas)\b/],
  [
    'electricidad',
    /(olor a quemado|huele a quemado|huele a cable|chispa|chisporrote|me dio (la )?(corriente|patada)|electrocut|cable (pelado|expuesto|quemado)|incendio|se prendio fuego|humo (en|del|de) (el |la )?(tablero|enchufe|toma|termica)|(tablero|enchufe|toma|termica).{0,25}(humo|quemad|derrit|caliente))/,
  ],
  [
    'plomeria',
    /(inundacion|se inunda|se esta inundando|perdida (fuerte|grande|activa)|cano roto|agua.{0,30}(tablero|enchufe|toma de corriente))/,
  ],
  [
    'cerrajeria',
    /((persona|nene|nena|chico|chica|bebe|nino|nina|abuelo|abuela).{0,25}(trabad|encerrad|atrapad)|quedo encerrad)/,
  ],
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function detectSafety(text: string): { category: SafetyCategory; message: string } | null {
  const t = normalize(text);
  for (const [category, re] of RULES) {
    if (re.test(t)) return { category, message: MESSAGES[category] };
  }
  return null;
}

const HANDOFF_RE =
  /(hablar con (una |un )?(persona|alguien|humano|operador|asesor)|atencion (humana|personal)|quiero (que me )?(llamen|contacten|llamar)|comunicarme con (una |un )?(persona|alguien))/;

/** El visitante pide una persona: no se llama a la IA, se ofrece WhatsApp. */
export function wantsHuman(text: string): boolean {
  return HANDOFF_RE.test(normalize(text));
}
