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
const SAFETY_STOP_MESSAGE =
  'Esto puede ser una emergencia eléctrica. Si podés hacerlo sin riesgo, cortá la llave térmica general y no uses esa instalación.\n\nSi hay riesgo activo — fuego o chispas en curso — no es algo que nosotros resolvamos: contactá a bomberos o a la empresa distribuidora, según corresponda.\n\nAtendemos en horario comercial. No ofrecemos servicio de emergencia.';
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
    case 'placeholder':
      return { kind: 'placeholder', question: PLACEHOLDER_PROMPT };
    case 'pick-items':
      return pickPrompt(session);
    case 'summary':
      return { kind: 'summary', draft: session.draft! };
    case 'outage':
      return { kind: 'outage', message: OUTAGE_MESSAGE };
    case 'safety-stop':
      return { kind: 'safety-stop', message: SAFETY_STOP_MESSAGE };
  }
}

function pickPrompt(session: AssistantSession): VisiblePrompt {
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
  const withMsg = push({ ...session, draft: undefined, step: 'safety-stop' }, 'assistant', SAFETY_STOP_MESSAGE);
  return { ...withMsg, step: 'safety-stop', draft: undefined };
}

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
      if (rubro !== 'Electricidad') {
        next = push({ ...next, step: 'placeholder' }, 'assistant', PLACEHOLDER_PROMPT);
        return { ...next, step: 'placeholder' };
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
    serviceType: 'Electricidad',
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
