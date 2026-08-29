import { describe, expect, it } from 'vitest';
import {
  answer,
  ELECTRICIDAD_SLUGS,
  isEmergencyServiceName,
  matchesVoltage,
  pickCatalogItem,
  skipItemPick,
  startAssistant,
  submitPlaceholder,
  visiblePrompt,
  voltageFilterFromChoice,
  type AssistantSession,
} from './diagnosisAssistant';
import type { ServiceItem } from '../types';

function choose(session: AssistantSession, optionId: string): AssistantSession {
  const prompt = visiblePrompt(session);
  if (prompt.kind !== 'buttons') throw new Error(`expected buttons, got ${prompt.kind}`);
  const option = prompt.options.find((item) => item.id === optionId);
  if (!option) throw new Error(`missing option ${optionId}`);
  return answer(session, option.id, option.label);
}

function walk(ids: string[]): AssistantSession {
  return ids.reduce((session, id) => choose(session, id), startAssistant());
}

const tableroMono: ServiceItem = {
  id: 'tm',
  name: 'Colocación de Termomagnética y Diferencial — Circuito monofásico',
  description: 'Tablero mono',
  price: 100,
  category: 'Electricidad',
  subcategoryId: 'tablero-id',
};

const acometidaTri: ServiceItem = {
  id: 'at',
  name: 'Trifásicas — Hasta 10 kW',
  description: 'Acometida tri',
  price: 200,
  category: 'Electricidad',
  subcategoryId: 'acometida-id',
};

describe('matchesVoltage', () => {
  it('reconoce monofásico y trifásico con tilde', () => {
    expect(matchesVoltage('Circuito monofásico', 'mono')).toBe(true);
    expect(matchesVoltage('Circuito trifásico', 'tri')).toBe(true);
    expect(matchesVoltage('Monofásicas — Hasta 10 kW', 'mono')).toBe(true);
    expect(matchesVoltage('Tablero Trifásico — Hasta 10 kvar', 'tri')).toBe(true);
    expect(matchesVoltage('Empotrado de Gabinete', 'mono')).toBe(false);
  });
});

describe('emergency names', () => {
  it('solo marca los ítems de Emergencias dentro de Mantenimiento', () => {
    expect(isEmergencyServiceName('Emergencias Lunes a Viernes — Hasta 5 km')).toBe(true);
    expect(isEmergencyServiceName('Mantenimiento preventivo')).toBe(false);
  });
});

describe('árbol de Electricidad', () => {
  it('abre en Pregunta 0 sin bienvenida genérica', () => {
    const session = startAssistant();
    expect(session.messages[0]?.text).toMatch(/tipo de problema/);
    expect(visiblePrompt(session).kind).toBe('buttons');
  });

  it('Paso 0 Sí corta a emergencia urgente en Mantenimiento', () => {
    const session = walk(['Electricidad', 'yes']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('emergency');
    if (prompt.kind !== 'emergency') return;
    expect(prompt.draft.priority).toBe('urgente');
    expect(prompt.draft.emergency).toBe(true);
    expect(prompt.draft.serviceType).toBe('Electricidad');
    expect(prompt.draft.subcategorySlugs).toEqual([ELECTRICIDAD_SLUGS.mantenimiento]);
    expect(prompt.draft.workMode).toBe('diagnosis');
  });

  it('energía parcial va a cableado/canalización sin preguntar tensión', () => {
    const session = walk(['Electricidad', 'no', 'repair', 'partial']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.subcategorySlugs).toEqual([
      ELECTRICIDAD_SLUGS.cableado,
      ELECTRICIDAD_SLUGS.canalizacion,
    ]);
    expect(session.messages.some((m) => m.text.includes('tensión'))).toBe(false);
  });

  it('corte de distribuidora no ofrece servicio pago', () => {
    const session = walk(['Electricidad', 'no', 'repair', 'none', 'yes']);
    expect(visiblePrompt(session).kind).toBe('outage');
    expect(session.draft).toBeUndefined();
  });

  it('llave quemada deriva a emergencia igual que Paso 0', () => {
    const session = walk(['Electricidad', 'no', 'repair', 'yes', 'hot']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('emergency');
  });

  it('no sé las llaves deja nota para el técnico y pregunta tensión', () => {
    const session = walk(['Electricidad', 'no', 'repair', 'yes', 'unknown', 'unknown']);
    expect(session.step === 'pick-items' || session.step === 'summary').toBe(true);
    const skipped = skipItemPick(session.step === 'pick-items' ? session : walk(['Electricidad', 'no', 'repair', 'yes', 'unknown', 'unknown']));
    const prompt = visiblePrompt(skipped);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.description).toMatch(/no pudo confirmar el estado de las llaves/i);
    expect(prompt.draft.subcategorySlugs).toContain(ELECTRICIDAD_SLUGS.tablero);
  });

  it('220V filtra orientación monofásica', () => {
    expect(voltageFilterFromChoice('220')).toBe('mono');
    expect(voltageFilterFromChoice('380')).toBe('tri');
    expect(voltageFilterFromChoice('both')).toBe('tri');
    expect(voltageFilterFromChoice('unknown')).toBeUndefined();
    expect(matchesVoltage(tableroMono.name, 'mono')).toBe(true);
    expect(matchesVoltage(acometidaTri.name, 'mono')).toBe(false);
  });

  it('instalación de luces no pregunta tensión y ofrece ítems', () => {
    const session = walk(['Electricidad', 'no', 'install', 'luces']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('pick-items');
    if (prompt.kind !== 'pick-items') return;
    expect(prompt.slugs).toEqual([ELECTRICIDAD_SLUGS.luminarias, ELECTRICIDAD_SLUGS.artefactos]);
    expect(session.messages.some((m) => m.text.includes('tensión'))).toBe(false);
  });

  it('puesta a tierra llega a ítem de precio fijo', () => {
    const session = walk(['Electricidad', 'no', 'install', 'tierra']);
    const picked = pickCatalogItem(session, {
      id: 'tierra-1',
      name: 'Hincado de 1,5 m de jabalina + caja de inspección',
      description: 'Jabalina',
      price: 127300,
      category: 'Electricidad',
    });
    const prompt = visiblePrompt(picked);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.workMode).toBe('direct');
    expect(prompt.draft.fixedPriceServiceId).toBe('tierra-1');
  });

  it('cableado pregunta tensión y termina en diagnóstico, no en canalización', () => {
    const session = walk(['Electricidad', 'no', 'install', 'cableado', '220']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.subcategorySlugs).toEqual([ELECTRICIDAD_SLUGS.cableado]);
    expect(prompt.draft.workMode).toBe('diagnosis');
    expect(prompt.draft.description).toMatch(/canalización/i);
  });
});

describe('placeholders de otros rubros', () => {
  it('Plomería va a texto libre + foto sin triaje de electricidad', () => {
    const session = walk(['Plomería']);
    expect(visiblePrompt(session).kind).toBe('placeholder');
    const done = submitPlaceholder(session, 'Se me inundó el baño', 'foto.jpg');
    const prompt = visiblePrompt(done);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.serviceType).toBe('Plomería');
    expect(prompt.draft.workMode).toBe('diagnosis');
    expect(prompt.draft.description).toMatch(/inundó/);
  });

  it('No estoy seguro deriva a diagnóstico general', () => {
    const session = submitPlaceholder(walk(['unsure']), 'No sé si es luz o agua');
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.serviceType).toBe('Mantenimiento general');
  });
});
