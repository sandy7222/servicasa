import type { OrderPriority, ServiceItem, ServiceType, WorkMode } from '../types';

/** Stable slugs from the live `subcategories` table (Electricidad). */
export const ELECTRICIDAD_SLUGS = {
  acometidas: 'acometidas',
  cableado: 'cableado-y-re-cableado',
  canalizacion: 'canalizacion',
  cctv: 'cctv',
  artefactos: 'colocacion-de-artefactos',
  luminarias: 'colocacion-de-luminarias',
  correccion: 'correccion-de-potencia',
  proyecto: 'proyecto-electrico',
  tierra: 'puesta-a-tierra',
  tablero: 'tablero-domiciliario',
} as const;

export const PLOMERIA_SLUGS = {
  griferia: 'reparaciones-y-griferia',
  destapaciones: 'destapaciones',
  instalaciones: 'instalaciones',
  tanques: 'limpieza-de-tanques',
  reformas: 'reformas',
} as const;

export const CERRAJERIA_SLUGS = {
  aperturas: 'aperturas',
  cerraduras: 'cerraduras',
  llaves: 'llaves',
  herrajes: 'herrajes-de-seguridad',
} as const;

export const REFRIGERACION_SLUGS = {
  visita: 'visita-tecnica',
  instalacion: 'instalacion-estandar',
  preinstall: 'pre-instalacion-y-desinstalacion',
  limpieza: 'limpieza-y-mantenimiento',
  fugas: 'deteccion-y-reparacion-de-fugas',
  recambios: 'recambios',
} as const;

export const SOLDADURA_SLUGS = {
  comunes: 'trabajos-comunes',
  estructuras: 'estructuras-metalicas',
} as const;

export const REPARACIONES_SLUGS = {
  pinturaInterior: 'pintura-interior',
  pinturaExterior: 'pintura-exterior',
  revoques: 'revoques-y-tabiques',
  pisos: 'pisos-y-revestimientos',
  impermeabilizacion: 'impermeabilizacion',
  aberturas: 'aberturas-y-vanos',
  otros: 'otros-trabajos',
} as const;

export type RubroChoice =
  | 'Electricidad'
  | 'Plomería'
  | 'Refrigeración'
  | 'Soldadura'
  | 'Cerrajería'
  | 'Reparaciones del hogar'
  | 'unsure';

export type VoltageChoice = '220' | '380' | 'both' | 'unknown';
export type VoltageFilter = 'mono' | 'tri';

export type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string };

export type OptionButton = { id: string; label: string };

export type VisiblePrompt =
  | {
      kind: 'buttons';
      question: string;
      options: OptionButton[];
    }
  | {
      kind: 'placeholder';
      question: string;
    }
  | {
      kind: 'pick-items';
      question: string;
      slugs: string[];
      voltage?: VoltageFilter;
      allowUnsure: boolean;
    }
  | {
      kind: 'summary';
      draft: AssistantDraft;
    }
  | {
      kind: 'outage';
      message: string;
    }
  | {
      kind: 'safety-stop';
      message: string;
    };

export type AssistantDraft = {
  serviceType: ServiceType;
  workMode: WorkMode;
  title: string;
  description: string;
  priority: OrderPriority;
  subcategorySlugs: string[];
  fixedPriceServiceId?: string;
  quantity: number;
  photoName?: string;
  /** Ruta temporal en el bucket diagnosis-photos (`pending/<draftId>/photo.jpg`)
   * de la foto ya subida desde el asistente — ver diagnosisPhotoUpload.ts. */
  photoStoragePath?: string;
};

type Answers = {
  rubro?: RubroChoice;
  safety?: 'yes' | 'no';
  workType?: 'repair' | 'install';
  energy?: 'yes' | 'none' | 'partial';
  neighbors?: 'yes' | 'no';
  breaker?: 'tripping' | 'hot' | 'unknown';
  voltage?: VoltageChoice;
  voltageContext?: 'tablero' | 'cableado' | 'acometida' | 'proyecto';
  installKind?:
    | 'cableado'
    | 'tierra'
    | 'tablero'
    | 'luces'
    | 'cctv'
    | 'acometida'
    | 'proyecto'
    | 'other';
  freeText?: string;
  photoName?: string;
  photoStoragePath?: string;
  selectedServiceId?: string;
  quantity: number;
  plumbKind?: 'leak' | 'clog' | 'no-water' | 'install' | 'tank' | 'renovation' | 'other';
  plumbWhere?: 'bath' | 'kitchen' | 'tank' | 'outside' | 'unknown';
  lockKind?: 'open' | 'lock' | 'keys' | 'hardware' | 'other';
  fridgeKind?: 'broken' | 'install' | 'clean' | 'leak' | 'uninstall' | 'other';
  weldKind?: 'common' | 'structure' | 'other';
  homeKind?: 'paint-in' | 'paint-out' | 'walls' | 'floors' | 'humidity' | 'openings' | 'other';
  pickSlugs?: string[];
  pickTitle?: string;
  pickAllowUnsure?: boolean;
};

type StepId =
  | 'rubro'
  | 'elec-safety'
  | 'elec-work-type'
  | 'elec-energy'
  | 'elec-neighbors'
  | 'elec-breaker'
  | 'elec-voltage'
  | 'elec-install'
  | 'plumb-safety'
  | 'plumb-kind'
  | 'plumb-where'
  | 'lock-safety'
  | 'lock-kind'
  | 'fridge-safety'
  | 'fridge-kind'
  | 'weld-safety'
  | 'weld-kind'
  | 'home-safety'
  | 'home-kind'
  | 'placeholder'
  | 'pick-items'
  | 'summary'
  | 'outage'
  | 'safety-stop';

export type AssistantSession = {
  step: StepId;
  messages: ChatMessage[];
  answers: Answers;
  draft?: AssistantDraft;
};

const RUBRO_OPTIONS: OptionButton[] = [
  { id: 'Electricidad', label: 'Electricidad' },
  { id: 'Plomería', label: 'Plomería' },
  { id: 'Refrigeración', label: 'Refrigeración y aire acondicionado' },
  { id: 'Soldadura', label: 'Soldadura' },
  { id: 'Cerrajería', label: 'Cerrajería' },
  { id: 'Reparaciones del hogar', label: 'Reparaciones generales del hogar' },
  { id: 'unsure', label: 'No estoy seguro' },
];

const VOLTAGE_OPTIONS: OptionButton[] = [
  { id: '220', label: '220V' },
  { id: '380', label: '380V' },
  { id: 'both', label: 'Las dos' },
  { id: 'unknown', label: 'No sé' },
];

const Q_RUBRO = '¿Qué tipo de problema tenés?';
const Q_SAFETY =
  '¿Sentís olor a quemado, ves chispas o humo, o escuchás un zumbido raro en algún tablero o enchufe?';
const Q_WORK = '¿Qué necesitás: reparar algo que no funciona, o instalar algo nuevo?';
const Q_ENERGY = '¿Tenés energía eléctrica en la vivienda ahora mismo?';
const Q_NEIGHBORS = '¿Tus vecinos también se quedaron sin luz?';
const Q_BREAKER = '¿Cómo están las llaves de la caja térmica/disyuntor?';
const Q_VOLTAGE = '¿Sabés qué tensión te llega: 220V, 380V, las dos, o no sabés?';
const Q_INSTALL = '¿Qué tipo de instalación necesitás?';
const PLACEHOLDER_PROMPT =
  'Contanos con tus palabras qué pasa. Si tenés una foto, adjuntarla ayuda al técnico.';
const Q_PLUMB_SAFETY =
  '¿Hay una pérdida de agua activa que no podés cortar, o se está inundando?';
const Q_PLUMB_KIND = '¿Qué está pasando?';
const Q_PLUMB_WHERE = '¿Dónde se nota el problema?';
const Q_LOCK_SAFETY =
  '¿Hay alguien trabado adentro o afuera, o una emergencia de seguridad ahora mismo?';
const Q_LOCK_KIND = '¿Qué necesitás?';
const Q_FRIDGE_SAFETY =
  '¿Hay olor a gas, chispas en el equipo, o un aparato que no corta y se calienta mucho?';
const Q_FRIDGE_KIND = '¿Qué necesitás con el equipo?';
const Q_WELD_SAFETY =
  '¿Hay riesgo estructural (techo, escalera o soporte comprometido) o un trabajo en altura sin seguridad?';
const Q_WELD_KIND = '¿Qué tipo de trabajo de soldadura necesitás?';
const Q_HOME_SAFETY =
  '¿Hay peligro de derrumbe, humedad sobre instalaciones eléctricas, o vapores de pintura en un ambiente cerrado con personas vulnerables?';
const Q_HOME_KIND = '¿Qué trabajo del hogar necesitás?';
const SAFETY_STOP_MESSAGE =
  'Esto puede ser una emergencia eléctrica. Si podés hacerlo sin riesgo, cortá la llave térmica general y no uses esa instalación.\n\nSi hay riesgo activo — fuego o chispas en curso — no es algo que nosotros resolvamos: contactá a bomberos o a la empresa distribuidora, según corresponda.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.';
const PLUMB_SAFETY_STOP =
  'Si hay una pérdida activa, cerrá la llave de paso general si podés hacerlo sin riesgo. Si el agua está tocando instalaciones eléctricas o no podés cortarla, contactá a bomberos o a un servicio de emergencia de tu zona.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.';
const LOCK_SAFETY_STOP =
  'Si hay una persona trabada o un riesgo de seguridad ahora mismo, contactá a policía o bomberos según corresponda.\n\nAtendemos en horario comercial. No ofrecemos apertura de emergencia 24 hs.';
const FRIDGE_SAFETY_STOP =
  'Si hay olor a gas, chispas o un aparato que no corta y se calienta, desenchufalo si podés sin riesgo y ventilá. No sigas usándolo.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.';
const WELD_SAFETY_STOP =
  'Si hay riesgo estructural o un trabajo en altura sin seguridad, no lo intentes vos. Ante un peligro inminente, contactá a un servicio de emergencia.\n\nAtendemos en horario comercial.';
const HOME_SAFETY_STOP =
  'Si hay peligro de derrumbe, humedad sobre instalaciones eléctricas o vapores de pintura con personas vulnerables, no sigas. Ventilá y cortá la luz si el agua llegó a tomas o tableros.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.';
const OUTAGE_MESSAGE =
  'Si también se quedó sin luz el vecindario, es un corte de la empresa distribuidora — no un problema que un técnico nuestro pueda resolver en tu casa. Reportalo a tu distribuidora (Edenor, Edesur u otra, según tu zona). No vamos a cobrarte una visita que no te va a solucionar nada.';

let messageSeq = 0;
const nid = () => `m-${++messageSeq}-${Math.random().toString(36).slice(2, 7)}`;

function push(session: AssistantSession, role: ChatMessage['role'], text: string): AssistantSession {
  return {
    ...session,
    messages: [...session.messages, { id: nid(), role, text }],
  };
}

function serviceTypeForRubro(rubro: RubroChoice): ServiceType {
  if (rubro === 'unsure') return 'Mantenimiento general';
  return rubro;
}

export function voltageFilterFromChoice(choice: VoltageChoice): VoltageFilter | undefined {
  if (choice === '220') return 'mono';
  if (choice === '380' || choice === 'both') return 'tri';
  return undefined;
}

export function matchesVoltage(name: string, filter: VoltageFilter): boolean {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const isMono = normalized.includes('monofasic');
  const isTri = normalized.includes('trifasic');
  if (filter === 'mono') return isMono && !isTri;
  return isTri && !isMono;
}

export function voltageLabel(choice?: VoltageChoice): string | undefined {
  if (choice === '220') return '220V (orientación monofásica)';
  if (choice === '380') return '380V (orientación trifásica)';
  if (choice === 'both') return '220V y 380V';
  if (choice === 'unknown') return 'el cliente no confirma la tensión; lo verifica el técnico en la visita';
  return undefined;
}

function naturalDescription(parts: string[]): string {
  return parts.filter(Boolean).join('\n');
}

export function startAssistant(): AssistantSession {
  messageSeq = 0;
  return {
    step: 'rubro',
    messages: [{ id: nid(), role: 'assistant', text: Q_RUBRO }],
    answers: { quantity: 1 },
  };
}

export function visiblePrompt(session: AssistantSession): VisiblePrompt {
  switch (session.step) {
    case 'rubro':
      return { kind: 'buttons', question: Q_RUBRO, options: RUBRO_OPTIONS };
    case 'elec-safety':
      return {
        kind: 'buttons',
        question: Q_SAFETY,
        options: [
          { id: 'yes', label: 'Sí' },
          { id: 'no', label: 'No' },
        ],
      };
    case 'elec-work-type':
      return {
        kind: 'buttons',
        question: Q_WORK,
        options: [
          { id: 'repair', label: 'Reparar algo que no funciona' },
          { id: 'install', label: 'Instalar algo nuevo' },
        ],
      };
    case 'elec-energy':
      return {
        kind: 'buttons',
        question: Q_ENERGY,
        options: [
          { id: 'yes', label: 'Sí, hay energía' },
          { id: 'none', label: 'No, nada de nada' },
          { id: 'partial', label: 'Parcial (solo en algunos ambientes o tomas)' },
        ],
      };
    case 'elec-neighbors':
      return {
        kind: 'buttons',
        question: Q_NEIGHBORS,
        options: [
          { id: 'yes', label: 'Sí, también se quedaron sin luz' },
          { id: 'no', label: 'No, solo mi casa' },
        ],
      };
    case 'elec-breaker':
      return {
        kind: 'buttons',
        question: Q_BREAKER,
        options: [
          { id: 'tripping', label: 'Bajadas (las subí y vuelven a bajar)' },
          { id: 'hot', label: 'Una está quemada o caliente' },
          { id: 'unknown', label: 'No sé cómo revisarlas' },
        ],
      };
    case 'elec-voltage':
      return { kind: 'buttons', question: Q_VOLTAGE, options: VOLTAGE_OPTIONS };
    case 'elec-install':
      return {
        kind: 'buttons',
        question: Q_INSTALL,
        options: [
          { id: 'cableado', label: 'Cableado nuevo o recablear la casa' },
          { id: 'tierra', label: 'Puesta a tierra (jabalina)' },
          { id: 'tablero', label: 'Tablero nuevo o ampliar el que tengo' },
          { id: 'luces', label: 'Luces, apliques, arañas, ventiladores, extractores' },
          { id: 'cctv', label: 'Cámaras de seguridad' },
          { id: 'acometida', label: 'Más potencia para casa/local (acometida)' },
          { id: 'proyecto', label: 'Obra nueva o remodelación completa' },
          { id: 'other', label: 'Otra cosa / no estoy seguro' },
        ],
      };
    case 'plumb-safety':
      return yesNoPrompt(Q_PLUMB_SAFETY);
    case 'plumb-kind':
      return {
        kind: 'buttons',
        question: Q_PLUMB_KIND,
        options: [
          { id: 'leak', label: 'Hay una pérdida o gotea' },
          { id: 'clog', label: 'Está tapado el desagüe' },
          { id: 'no-water', label: 'No llega agua o llega muy poca' },
          { id: 'install', label: 'Quiero instalar o cambiar algo' },
          { id: 'tank', label: 'Limpieza o revisión de tanque' },
          { id: 'renovation', label: 'Reforma de baño o cocina' },
          { id: 'other', label: 'Otra cosa / no estoy seguro' },
        ],
      };
    case 'plumb-where':
      return {
        kind: 'buttons',
        question: Q_PLUMB_WHERE,
        options: [
          { id: 'bath', label: 'Baño' },
          { id: 'kitchen', label: 'Cocina' },
          { id: 'tank', label: 'Tanque o reserva' },
          { id: 'outside', label: 'Patio, jardín o medidor' },
          { id: 'unknown', label: 'No sé / en más de un lugar' },
        ],
      };
    case 'lock-safety':
      return yesNoPrompt(Q_LOCK_SAFETY);
    case 'lock-kind':
      return {
        kind: 'buttons',
        question: Q_LOCK_KIND,
        options: [
          { id: 'open', label: 'Abrir una puerta o cerradura' },
          { id: 'lock', label: 'Cambiar o reparar una cerradura' },
          { id: 'keys', label: 'Copiar o hacer llaves' },
          { id: 'hardware', label: 'Herrajes o seguridad extra' },
          { id: 'other', label: 'Otra cosa / no estoy seguro' },
        ],
      };
    case 'fridge-safety':
      return yesNoPrompt(Q_FRIDGE_SAFETY);
    case 'fridge-kind':
      return {
        kind: 'buttons',
        question: Q_FRIDGE_KIND,
        options: [
          { id: 'broken', label: 'No enfría o anda mal' },
          { id: 'install', label: 'Instalar un equipo nuevo' },
          { id: 'clean', label: 'Limpieza o mantenimiento' },
          { id: 'leak', label: 'Hay una fuga de gas' },
          { id: 'uninstall', label: 'Desinstalar o pasar de lugar' },
          { id: 'other', label: 'Otra cosa / no estoy seguro' },
        ],
      };
    case 'weld-safety':
      return yesNoPrompt(Q_WELD_SAFETY);
    case 'weld-kind':
      return {
        kind: 'buttons',
        question: Q_WELD_KIND,
        options: [
          { id: 'common', label: 'Reja, portón, baranda u otro trabajo común' },
          { id: 'structure', label: 'Estructura metálica o refuerzo' },
          { id: 'other', label: 'Otra cosa / no estoy seguro' },
        ],
      };
    case 'home-safety':
      return yesNoPrompt(Q_HOME_SAFETY);
    case 'home-kind':
      return {
        kind: 'buttons',
        question: Q_HOME_KIND,
        options: [
          { id: 'paint-in', label: 'Pintura interior' },
          { id: 'paint-out', label: 'Pintura exterior' },
          { id: 'walls', label: 'Revoques, tabiques o paredes' },
          { id: 'floors', label: 'Pisos o revestimientos' },
          { id: 'humidity', label: 'Humedad o impermeabilización' },
          { id: 'openings', label: 'Aberturas o vanos' },
          { id: 'other', label: 'Otra cosa / no estoy seguro' },
        ],
      };
    case 'placeholder':
      return { kind: 'placeholder', question: PLACEHOLDER_PROMPT };
    case 'pick-items':
      return pickPrompt(session);
    case 'summary':
      return { kind: 'summary', draft: session.draft! };
    case 'outage':
      return { kind: 'outage', message: OUTAGE_MESSAGE };
    case 'safety-stop':
      return { kind: 'safety-stop', message: safetyMessageFor(session.answers.rubro) };
  }
}

function yesNoPrompt(question: string): VisiblePrompt {
  return {
    kind: 'buttons',
    question,
    options: [
      { id: 'yes', label: 'Sí' },
      { id: 'no', label: 'No' },
    ],
  };
}

function safetyMessageFor(rubro?: RubroChoice): string {
  if (rubro === 'Plomería') return PLUMB_SAFETY_STOP;
  if (rubro === 'Cerrajería') return LOCK_SAFETY_STOP;
  if (rubro === 'Refrigeración') return FRIDGE_SAFETY_STOP;
  if (rubro === 'Soldadura') return WELD_SAFETY_STOP;
  if (rubro === 'Reparaciones del hogar') return HOME_SAFETY_STOP;
  return SAFETY_STOP_MESSAGE;
}

function pickPrompt(session: AssistantSession): VisiblePrompt {
  if (session.answers.pickSlugs?.length) {
    return {
      kind: 'pick-items',
      question: session.answers.pickTitle
        ? 'Elegí el trabajo más parecido. Vas a ver el precio antes de confirmar.'
        : 'Elegí un ítem si lo reconocés, o dejá el diagnóstico para el técnico.',
      slugs: session.answers.pickSlugs,
      allowUnsure: session.answers.pickAllowUnsure !== false,
    };
  }
  const { installKind, voltage, voltageContext, breaker } = session.answers;
  if (installKind === 'luces') {
    return {
      kind: 'pick-items',
      question: 'Elegí el trabajo más parecido. Vas a ver el precio antes de confirmar.',
      slugs: [ELECTRICIDAD_SLUGS.luminarias, ELECTRICIDAD_SLUGS.artefactos],
      allowUnsure: true,
    };
  }
  if (installKind === 'cctv') {
    return {
      kind: 'pick-items',
      question: '¿Qué instalación de cámaras se parece más a lo que necesitás?',
      slugs: [ELECTRICIDAD_SLUGS.cctv],
      allowUnsure: true,
    };
  }
  if (installKind === 'tierra') {
    return {
      kind: 'pick-items',
      question: 'Este es el servicio de puesta a tierra del catálogo.',
      slugs: [ELECTRICIDAD_SLUGS.tierra],
      allowUnsure: false,
    };
  }
  const filter = voltageFilterFromChoice(voltage ?? 'unknown');
  if (voltageContext === 'tablero' || breaker) {
    const slugs: string[] = [ELECTRICIDAD_SLUGS.tablero, ELECTRICIDAD_SLUGS.acometidas];
    if (filter === 'tri') slugs.push(ELECTRICIDAD_SLUGS.correccion);
    return {
      kind: 'pick-items',
      question: filter
        ? 'Estos son los ítems que coinciden con esa tensión. Si no estás seguro, que lo vea el técnico.'
        : 'El técnico confirma la tensión en la visita. ¿Querés elegir un ítem ahora o dejarlo para el diagnóstico?',
      slugs,
      voltage: filter,
      allowUnsure: true,
    };
  }
  if (voltageContext === 'acometida') {
    return {
      kind: 'pick-items',
      question: 'Elegí la acometida más parecida, o dejá que el técnico lo defina en la visita.',
      slugs: filter === 'tri' ? [ELECTRICIDAD_SLUGS.acometidas, ELECTRICIDAD_SLUGS.correccion] : [ELECTRICIDAD_SLUGS.acometidas],
      voltage: filter,
      allowUnsure: true,
    };
  }
  return {
    kind: 'pick-items',
    question: 'Elegí un ítem si lo reconocés, o dejá el diagnóstico para el técnico.',
    slugs: [ELECTRICIDAD_SLUGS.tablero],
    voltage: filter,
    allowUnsure: true,
  };
}

function diagnosisDraft(
  answers: Answers,
  title: string,
  slugs: string[],
  extraLines: string[]
): AssistantDraft {
  return {
    serviceType: serviceTypeForRubro(answers.rubro ?? 'Electricidad'),
    workMode: 'diagnosis',
    title,
    description: naturalDescription(extraLines),
    priority: 'media',
    subcategorySlugs: slugs,
    quantity: answers.quantity,
    photoName: answers.photoName,
    photoStoragePath: answers.photoStoragePath,
  };
}

function placeholderDraft(answers: Answers): AssistantDraft {
  const rubro = answers.rubro ?? 'unsure';
  const type = serviceTypeForRubro(rubro);
  const label = rubro === 'unsure' ? 'Diagnóstico general' : `Diagnóstico — ${type}`;
  return {
    serviceType: type,
    workMode: 'diagnosis',
    title: label,
    description: naturalDescription([
      answers.freeText?.trim() || 'El cliente no pudo clasificar el problema en el cuestionario.',
      answers.photoName ? `Foto adjunta: ${answers.photoName}` : '',
    ]),
    priority: 'media',
    subcategorySlugs: [],
    quantity: 1,
    photoName: answers.photoName,
    photoStoragePath: answers.photoStoragePath,
  };
}

function repairContextLines(answers: Answers): string[] {
  const lines: string[] = ['Pedido armado con el asistente de diagnóstico (Electricidad, reparación).'];
  if (answers.energy === 'yes') lines.push('Hay energía en la vivienda.');
  if (answers.energy === 'none') lines.push('No hay energía en la vivienda (solo esa casa).');
  if (answers.energy === 'partial') {
    lines.push('Energía parcial: solo en algunos ambientes o tomas. Revisar cableado y canalización en el lugar.');
  }
  if (answers.breaker === 'tripping') lines.push('Las llaves térmicas bajan y vuelven a bajar al subirlas.');
  if (answers.breaker === 'unknown') {
    lines.push('Nota para el técnico: el cliente no pudo confirmar el estado de las llaves; revisar en el lugar.');
  }
  const voltage = voltageLabel(answers.voltage);
  if (voltage) lines.push(`Tensión declarada: ${voltage}.`);
  return lines;
}

function goSummary(session: AssistantSession, draft: AssistantDraft, assistantText: string): AssistantSession {
  const withMsg = push({ ...session, answers: session.answers, draft, step: 'summary' }, 'assistant', assistantText);
  return { ...withMsg, step: 'summary', draft };
}

function goSafetyStop(session: AssistantSession): AssistantSession {
  const message = safetyMessageFor(session.answers.rubro);
  const withMsg = push({ ...session, draft: undefined, step: 'safety-stop' }, 'assistant', message);
  return { ...withMsg, step: 'safety-stop', draft: undefined };
}

function goPlaceholder(session: AssistantSession): AssistantSession {
  const withMsg = push({ ...session, step: 'placeholder' }, 'assistant', PLACEHOLDER_PROMPT);
  return { ...withMsg, step: 'placeholder' };
}

function goPick(
  session: AssistantSession,
  slugs: string[],
  title: string,
  allowUnsure = true
): AssistantSession {
  const picking: AssistantSession = {
    ...session,
    step: 'pick-items',
    answers: { ...session.answers, pickSlugs: slugs, pickTitle: title, pickAllowUnsure: allowUnsure },
  };
  const prompt = visiblePrompt(picking);
  const question = prompt.kind === 'pick-items' ? prompt.question : title;
  return push(picking, 'assistant', question);
}

function goDiagnosis(session: AssistantSession, title: string, slugs: string[], extra: string[]): AssistantSession {
  return goSummary(
    session,
    diagnosisDraft(session.answers, title, slugs, extra),
    'Queda como visita de diagnóstico. El técnico confirma el detalle en el lugar.'
  );
}

const TRADE_ENTRY: Record<Exclude<RubroChoice, 'Electricidad' | 'unsure'>, StepId> = {
  Plomería: 'plumb-safety',
  Cerrajería: 'lock-safety',
  Refrigeración: 'fridge-safety',
  Soldadura: 'weld-safety',
  'Reparaciones del hogar': 'home-safety',
};

const TRADE_ENTRY_QUESTION: Record<Exclude<RubroChoice, 'Electricidad' | 'unsure'>, string> = {
  Plomería: Q_PLUMB_SAFETY,
  Cerrajería: Q_LOCK_SAFETY,
  Refrigeración: Q_FRIDGE_SAFETY,
  Soldadura: Q_WELD_SAFETY,
  'Reparaciones del hogar': Q_HOME_SAFETY,
};

function afterVoltage(session: AssistantSession): AssistantSession {
  const { voltageContext, installKind } = session.answers;
  if (voltageContext === 'cableado' || installKind === 'cableado') {
    return goSummary(
      session,
      diagnosisDraft(session.answers, 'Cableado o recableado', [ELECTRICIDAD_SLUGS.cableado], [
        'Pedido armado con el asistente (instalación de cableado). El detalle de canalización lo define el técnico en la cotización.',
        voltageLabel(session.answers.voltage) ? `Tensión declarada: ${voltageLabel(session.answers.voltage)}.` : '',
      ]),
      'Queda como visita de diagnóstico de cableado. El tipo de canalización lo resuelve el técnico, no hace falta que lo elijas vos.'
    );
  }
  if (voltageContext === 'proyecto' || installKind === 'proyecto') {
    return goSummary(
      session,
      diagnosisDraft(session.answers, 'Proyecto eléctrico — obra o remodelación', [ELECTRICIDAD_SLUGS.proyecto], [
        'Pedido armado con el asistente (obra nueva o remodelación completa).',
        voltageLabel(session.answers.voltage) ? `Tensión declarada: ${voltageLabel(session.answers.voltage)}.` : '',
      ]),
      'Queda como diagnóstico de proyecto eléctrico. El técnico arma el presupuesto en el lugar.'
    );
  }
  return { ...session, step: 'pick-items' };
}

export function answer(session: AssistantSession, optionId: string, optionLabel: string): AssistantSession {
  if (session.step === 'summary' || session.step === 'outage' || session.step === 'safety-stop') return session;

  let next: AssistantSession = push(session, 'user', optionLabel);

  switch (session.step) {
    case 'rubro': {
      const rubro = optionId as RubroChoice;
      next = { ...next, answers: { ...next.answers, rubro } };
      if (rubro === 'unsure') return goPlaceholder(next);
      if (rubro !== 'Electricidad') {
        const step = TRADE_ENTRY[rubro];
        const question = TRADE_ENTRY_QUESTION[rubro];
        next = push({ ...next, step }, 'assistant', question);
        return { ...next, step };
      }
      next = push({ ...next, step: 'elec-safety' }, 'assistant', Q_SAFETY);
      return { ...next, step: 'elec-safety' };
    }
    case 'elec-safety': {
      next = { ...next, answers: { ...next.answers, safety: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') return goSafetyStop(next);
      next = push({ ...next, step: 'elec-work-type' }, 'assistant', Q_WORK);
      return { ...next, step: 'elec-work-type' };
    }
    case 'elec-work-type': {
      next = { ...next, answers: { ...next.answers, workType: optionId as 'repair' | 'install' } };
      if (optionId === 'repair') {
        next = push({ ...next, step: 'elec-energy' }, 'assistant', Q_ENERGY);
        return { ...next, step: 'elec-energy' };
      }
      next = push({ ...next, step: 'elec-install' }, 'assistant', Q_INSTALL);
      return { ...next, step: 'elec-install' };
    }
    case 'elec-energy': {
      next = { ...next, answers: { ...next.answers, energy: optionId as Answers['energy'] } };
      if (optionId === 'partial') {
        return goSummary(
          next,
          diagnosisDraft(next.answers, 'Pérdida parcial de energía', [ELECTRICIDAD_SLUGS.cableado, ELECTRICIDAD_SLUGS.canalizacion], [
            ...repairContextLines({ ...next.answers, energy: 'partial' }),
          ]),
          'Con energía parcial conviene una visita de diagnóstico de cableado/canalización. El técnico ve el detalle en el lugar.'
        );
      }
      if (optionId === 'none') {
        next = push({ ...next, step: 'elec-neighbors' }, 'assistant', Q_NEIGHBORS);
        return { ...next, step: 'elec-neighbors' };
      }
      next = push({ ...next, step: 'elec-breaker' }, 'assistant', Q_BREAKER);
      return { ...next, step: 'elec-breaker' };
    }
    case 'elec-neighbors': {
      next = { ...next, answers: { ...next.answers, neighbors: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') {
        const withMsg = push({ ...next, step: 'outage' }, 'assistant', OUTAGE_MESSAGE);
        return { ...withMsg, step: 'outage' };
      }
      next = push({ ...next, step: 'elec-breaker' }, 'assistant', Q_BREAKER);
      return { ...next, step: 'elec-breaker' };
    }
    case 'elec-breaker': {
      next = { ...next, answers: { ...next.answers, breaker: optionId as Answers['breaker'] } };
      if (optionId === 'hot') {
        return goSafetyStop(next);
      }
      next = {
        ...next,
        answers: { ...next.answers, voltageContext: 'tablero' },
      };
      next = push({ ...next, step: 'elec-voltage' }, 'assistant', Q_VOLTAGE);
      return { ...next, step: 'elec-voltage' };
    }
    case 'elec-voltage': {
      next = { ...next, answers: { ...next.answers, voltage: optionId as VoltageChoice } };
      const progressed = afterVoltage(next);
      if (progressed.step === 'pick-items') {
        const prompt = visiblePrompt(progressed);
        const question = prompt.kind === 'pick-items' ? prompt.question : Q_VOLTAGE;
        return push({ ...progressed, step: 'pick-items' }, 'assistant', question);
      }
      return progressed;
    }
    case 'elec-install': {
      next = { ...next, answers: { ...next.answers, installKind: optionId as Answers['installKind'] } };
      if (optionId === 'other') {
        next = push({ ...next, step: 'placeholder' }, 'assistant', PLACEHOLDER_PROMPT);
        return { ...next, step: 'placeholder' };
      }
      if (optionId === 'luces' || optionId === 'cctv' || optionId === 'tierra') {
        const picking = { ...next, step: 'pick-items' as const };
        const prompt = visiblePrompt(picking);
        const question = prompt.kind === 'pick-items' ? prompt.question : Q_INSTALL;
        return push(picking, 'assistant', question);
      }
      const voltageContext =
        optionId === 'cableado'
          ? 'cableado'
          : optionId === 'acometida'
            ? 'acometida'
            : optionId === 'proyecto'
              ? 'proyecto'
              : 'tablero';
      next = { ...next, answers: { ...next.answers, voltageContext } };
      next = push({ ...next, step: 'elec-voltage' }, 'assistant', Q_VOLTAGE);
      return { ...next, step: 'elec-voltage' };
    }
    case 'plumb-safety': {
      next = { ...next, answers: { ...next.answers, safety: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') return goSafetyStop(next);
      next = push({ ...next, step: 'plumb-kind' }, 'assistant', Q_PLUMB_KIND);
      return { ...next, step: 'plumb-kind' };
    }
    case 'plumb-kind': {
      const plumbKind = optionId as NonNullable<Answers['plumbKind']>;
      next = { ...next, answers: { ...next.answers, plumbKind } };
      if (plumbKind === 'other') return goPlaceholder(next);
      if (plumbKind === 'leak') {
        next = push({ ...next, step: 'plumb-where' }, 'assistant', Q_PLUMB_WHERE);
        return { ...next, step: 'plumb-where' };
      }
      if (plumbKind === 'clog') {
        return goPick(next, [PLOMERIA_SLUGS.destapaciones], 'Destapación');
      }
      if (plumbKind === 'no-water') {
        return goDiagnosis(next, 'Falta de agua o baja presión', [PLOMERIA_SLUGS.instalaciones, PLOMERIA_SLUGS.destapaciones], [
          'Pedido armado con el asistente (Plomería). El cliente no tiene agua o llega muy poca.',
        ]);
      }
      if (plumbKind === 'install') {
        return goPick(next, [PLOMERIA_SLUGS.instalaciones, PLOMERIA_SLUGS.griferia], 'Instalación o cambio de plomería');
      }
      if (plumbKind === 'tank') {
        return goPick(next, [PLOMERIA_SLUGS.tanques], 'Limpieza o revisión de tanque');
      }
      return goDiagnosis(next, 'Reforma de baño o cocina', [PLOMERIA_SLUGS.reformas], [
        'Pedido armado con el asistente (Plomería, reforma). El técnico cotiza en el lugar.',
      ]);
    }
    case 'plumb-where': {
      const plumbWhere = optionId as NonNullable<Answers['plumbWhere']>;
      next = { ...next, answers: { ...next.answers, plumbWhere } };
      const whereLabel =
        plumbWhere === 'bath'
          ? 'baño'
          : plumbWhere === 'kitchen'
            ? 'cocina'
            : plumbWhere === 'tank'
              ? 'tanque o reserva'
              : plumbWhere === 'outside'
                ? 'exterior / medidor'
                : 'ubicación no confirmada';
      if (plumbWhere === 'tank') {
        return goPick(next, [PLOMERIA_SLUGS.tanques, PLOMERIA_SLUGS.griferia], `Pérdida en ${whereLabel}`);
      }
      return goPick(next, [PLOMERIA_SLUGS.griferia], `Pérdida en ${whereLabel}`);
    }
    case 'lock-safety': {
      next = { ...next, answers: { ...next.answers, safety: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') return goSafetyStop(next);
      next = push({ ...next, step: 'lock-kind' }, 'assistant', Q_LOCK_KIND);
      return { ...next, step: 'lock-kind' };
    }
    case 'lock-kind': {
      const lockKind = optionId as NonNullable<Answers['lockKind']>;
      next = { ...next, answers: { ...next.answers, lockKind } };
      if (lockKind === 'other') return goPlaceholder(next);
      if (lockKind === 'open') return goPick(next, [CERRAJERIA_SLUGS.aperturas], 'Apertura');
      if (lockKind === 'lock') return goPick(next, [CERRAJERIA_SLUGS.cerraduras], 'Cambio o reparación de cerradura');
      if (lockKind === 'keys') return goPick(next, [CERRAJERIA_SLUGS.llaves], 'Llaves');
      return goPick(next, [CERRAJERIA_SLUGS.herrajes], 'Herrajes de seguridad');
    }
    case 'fridge-safety': {
      next = { ...next, answers: { ...next.answers, safety: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') return goSafetyStop(next);
      next = push({ ...next, step: 'fridge-kind' }, 'assistant', Q_FRIDGE_KIND);
      return { ...next, step: 'fridge-kind' };
    }
    case 'fridge-kind': {
      const fridgeKind = optionId as NonNullable<Answers['fridgeKind']>;
      next = { ...next, answers: { ...next.answers, fridgeKind } };
      if (fridgeKind === 'other') return goPlaceholder(next);
      if (fridgeKind === 'broken') return goPick(next, [REFRIGERACION_SLUGS.visita, REFRIGERACION_SLUGS.recambios], 'Visita técnica de refrigeración');
      if (fridgeKind === 'install') return goPick(next, [REFRIGERACION_SLUGS.instalacion], 'Instalación de equipo');
      if (fridgeKind === 'clean') return goPick(next, [REFRIGERACION_SLUGS.limpieza], 'Limpieza y mantenimiento');
      if (fridgeKind === 'leak') return goPick(next, [REFRIGERACION_SLUGS.fugas], 'Detección de fugas');
      return goPick(next, [REFRIGERACION_SLUGS.preinstall], 'Desinstalación o traslado');
    }
    case 'weld-safety': {
      next = { ...next, answers: { ...next.answers, safety: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') return goSafetyStop(next);
      next = push({ ...next, step: 'weld-kind' }, 'assistant', Q_WELD_KIND);
      return { ...next, step: 'weld-kind' };
    }
    case 'weld-kind': {
      const weldKind = optionId as NonNullable<Answers['weldKind']>;
      next = { ...next, answers: { ...next.answers, weldKind } };
      if (weldKind === 'other') return goPlaceholder(next);
      if (weldKind === 'structure') return goPick(next, [SOLDADURA_SLUGS.estructuras], 'Estructura metálica');
      return goPick(next, [SOLDADURA_SLUGS.comunes], 'Trabajo de soldadura');
    }
    case 'home-safety': {
      next = { ...next, answers: { ...next.answers, safety: optionId as 'yes' | 'no' } };
      if (optionId === 'yes') return goSafetyStop(next);
      next = push({ ...next, step: 'home-kind' }, 'assistant', Q_HOME_KIND);
      return { ...next, step: 'home-kind' };
    }
    case 'home-kind': {
      const homeKind = optionId as NonNullable<Answers['homeKind']>;
      next = { ...next, answers: { ...next.answers, homeKind } };
      if (homeKind === 'other') return goPlaceholder(next);
      if (homeKind === 'paint-in') return goPick(next, [REPARACIONES_SLUGS.pinturaInterior], 'Pintura interior');
      if (homeKind === 'paint-out') return goPick(next, [REPARACIONES_SLUGS.pinturaExterior], 'Pintura exterior');
      if (homeKind === 'walls') return goPick(next, [REPARACIONES_SLUGS.revoques], 'Revoques y tabiques');
      if (homeKind === 'floors') return goPick(next, [REPARACIONES_SLUGS.pisos], 'Pisos y revestimientos');
      if (homeKind === 'humidity') return goPick(next, [REPARACIONES_SLUGS.impermeabilizacion], 'Impermeabilización');
      return goPick(next, [REPARACIONES_SLUGS.aberturas], 'Aberturas y vanos');
    }
    case 'placeholder':
    case 'pick-items':
      return session;
  }
}

export function submitPlaceholder(
  session: AssistantSession,
  text: string,
  photoName?: string,
  photoStoragePath?: string
): AssistantSession {
  if (session.step !== 'placeholder') return session;
  const trimmed = text.trim();
  if (!trimmed) return session;
  let next = push(session, 'user', photoName ? `${trimmed} (foto: ${photoName})` : trimmed);
  next = { ...next, answers: { ...next.answers, freeText: trimmed, photoName, photoStoragePath } };
  const draft = placeholderDraft(next.answers);
  return goSummary(next, draft, 'Armé un pedido de diagnóstico general. Revisá la descripción antes de enviarlo.');
}

export function pickCatalogItem(
  session: AssistantSession,
  service: ServiceItem,
  quantity = 1
): AssistantSession {
  if (session.step !== 'pick-items') return session;
  let next = push(session, 'user', service.name);
  next = { ...next, answers: { ...next.answers, selectedServiceId: service.id, quantity } };
  const draft: AssistantDraft = {
    serviceType: serviceTypeForRubro(next.answers.rubro ?? 'Electricidad'),
    workMode: 'direct',
    title: service.name,
    description: naturalDescription([
      service.description,
      ...repairContextLines(next.answers).slice(1),
      voltageLabel(next.answers.voltage) ? `Tensión declarada: ${voltageLabel(next.answers.voltage)}.` : '',
    ]),
    priority: 'media',
    subcategorySlugs: [],
    fixedPriceServiceId: service.id,
    quantity,
  };
  return goSummary(next, draft, `Precio de catálogo: se va a precargar este ítem. Revisá la descripción antes de confirmar.`);
}

export function skipItemPick(session: AssistantSession): AssistantSession {
  if (session.step !== 'pick-items') return session;
  let next = push(session, 'user', 'Que lo vea el técnico / no estoy seguro');
  if (next.answers.pickSlugs?.length && next.answers.pickTitle) {
    return goDiagnosis(next, next.answers.pickTitle, next.answers.pickSlugs, [
      `Pedido armado con el asistente (${next.answers.rubro ?? 'diagnóstico'}). El cliente no eligió un ítem exacto.`,
    ]);
  }
  const { installKind, voltageContext, breaker } = next.answers;
  if (installKind === 'luces') {
    return goSummary(
      next,
      diagnosisDraft(next.answers, 'Colocación de luces o artefactos', [ELECTRICIDAD_SLUGS.luminarias, ELECTRICIDAD_SLUGS.artefactos], [
        'El cliente pidió luces, apliques, ventiladores o extractores y no eligió un ítem exacto.',
      ]),
      'Queda como diagnóstico de luminarias/artefactos.'
    );
  }
  if (installKind === 'cctv') {
    return goSummary(
      next,
      diagnosisDraft(next.answers, 'Instalación de cámaras (CCTV)', [ELECTRICIDAD_SLUGS.cctv], [
        'El cliente pidió cámaras de seguridad y no eligió un kit exacto.',
      ]),
      'Queda como diagnóstico de CCTV.'
    );
  }
  if (voltageContext === 'acometida' || installKind === 'acometida') {
    return goSummary(
      next,
      diagnosisDraft(next.answers, 'Acometida / más potencia', [ELECTRICIDAD_SLUGS.acometidas], [
        'Pedido de acometida. El técnico confirma tensión y kW en la visita.',
        voltageLabel(next.answers.voltage) ? `Tensión declarada: ${voltageLabel(next.answers.voltage)}.` : '',
      ]),
      'Queda como diagnóstico de acometida.'
    );
  }
  return goSummary(
    next,
    diagnosisDraft(
      next.answers,
      breaker === 'unknown' ? 'Revisión de tablero domiciliario' : 'Tablero domiciliario',
      [ELECTRICIDAD_SLUGS.tablero],
      repairContextLines(next.answers)
    ),
    'Queda como visita de diagnóstico de tablero. El técnico confirma en el lugar.'
  );
}

export function updateDraftDescription(session: AssistantSession, description: string): AssistantSession {
  if (!session.draft) return session;
  return { ...session, draft: { ...session.draft, description } };
}

export function updateDraftQuantity(session: AssistantSession, quantity: number): AssistantSession {
  if (!session.draft) return session;
  const qty = Math.min(20, Math.max(1, quantity));
  return {
    ...session,
    answers: { ...session.answers, quantity: qty },
    draft: { ...session.draft, quantity: qty },
  };
}

export function filterServicesForPrompt(
  services: readonly ServiceItem[],
  slugsById: Map<string, string>,
  prompt: Extract<VisiblePrompt, { kind: 'pick-items' }>
): ServiceItem[] {
  return services.filter((service) => {
    if (service.active === false) return false;
    const slug = service.subcategoryId ? slugsById.get(service.subcategoryId) : undefined;
    if (!slug || !prompt.slugs.includes(slug)) return false;
    if (prompt.voltage && !matchesVoltage(service.name, prompt.voltage)) return false;
    return true;
  });
}

export function optionLabel(options: OptionButton[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}
