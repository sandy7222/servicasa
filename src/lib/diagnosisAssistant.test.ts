import { describe, expect, it } from 'vitest';
import {
  answer,
  CERRAJERIA_SLUGS,
  ELECTRICIDAD_SLUGS,
  matchesVoltage,
  pickCatalogItem,
  PLOMERIA_SLUGS,
  REFRIGERACION_SLUGS,
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

describe('árbol de Electricidad', () => {
  it('abre en Pregunta 0 sin bienvenida genérica', () => {
    const session = startAssistant();
    expect(session.messages[0]?.text).toMatch(/tipo de problema/);
    expect(visiblePrompt(session).kind).toBe('buttons');
  });

  it('Paso 0 Sí corta el cuestionario sin armar pedido', () => {
    const session = walk(['Electricidad', 'yes']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('safety-stop');
    expect(session.draft).toBeUndefined();
    if (prompt.kind !== 'safety-stop') return;
    expect(prompt.message).toMatch(/cortá la llave térmica/i);
    expect(prompt.message).toMatch(/bomberos/i);
    expect(prompt.message).toMatch(/horario comercial/i);
    expect(prompt.message).not.toMatch(/urgente/i);
    expect(prompt.message).not.toMatch(/subcategor/i);
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

  it('llave quemada corta igual que Paso 0, sin pedido', () => {
    const session = walk(['Electricidad', 'no', 'repair', 'yes', 'hot']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('safety-stop');
    expect(session.draft).toBeUndefined();
    if (prompt.kind !== 'safety-stop') return;
    expect(prompt.message).toMatch(/bomberos/i);
    expect(prompt.message).toMatch(/horario comercial/i);
    expect(prompt.message).not.toMatch(/urgente/i);
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

describe('árbol de Plomería', () => {
  it('usa triaje propio y no el de electricidad', () => {
    const session = walk(['Plomería']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('buttons');
    if (prompt.kind !== 'buttons') return;
    expect(prompt.question).toMatch(/pérdida de agua/i);
    expect(prompt.question).not.toMatch(/quemado/);
  });

  it('pérdida activa corta sin armar pedido', () => {
    const session = walk(['Plomería', 'yes']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('safety-stop');
    expect(session.draft).toBeUndefined();
    if (prompt.kind !== 'safety-stop') return;
    expect(prompt.message).toMatch(/llave de paso/i);
    expect(prompt.message).toMatch(/horario comercial/i);
  });

  it('destapación ofrece ítems de esa subcategoría', () => {
    const session = walk(['Plomería', 'no', 'clog']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('pick-items');
    if (prompt.kind !== 'pick-items') return;
    expect(prompt.slugs).toEqual([PLOMERIA_SLUGS.destapaciones]);
  });

  it('pérdida en baño va a grifería y skip arma diagnóstico', () => {
    const skipped = skipItemPick(walk(['Plomería', 'no', 'leak', 'bath']));
    const prompt = visiblePrompt(skipped);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.serviceType).toBe('Plomería');
    expect(prompt.draft.subcategorySlugs).toContain(PLOMERIA_SLUGS.griferia);
  });
});

describe('árboles de los demás rubros', () => {
  it('Cerrajería con persona trabada corta sin pedido', () => {
    const session = walk(['Cerrajería', 'yes']);
    expect(visiblePrompt(session).kind).toBe('safety-stop');
    expect(session.draft).toBeUndefined();
  });

  it('Cerrajería — abrir puerta ofrece aperturas', () => {
    const session = walk(['Cerrajería', 'no', 'open']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('pick-items');
    if (prompt.kind !== 'pick-items') return;
    expect(prompt.slugs).toEqual([CERRAJERIA_SLUGS.aperturas]);
  });

  it('Refrigeración — equipo que no enfría ofrece visita técnica', () => {
    const session = walk(['Refrigeración', 'no', 'broken']);
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('pick-items');
    if (prompt.kind !== 'pick-items') return;
    expect(prompt.slugs).toContain(REFRIGERACION_SLUGS.visita);
  });

  it('Soldadura y Reparaciones tienen triaje propio', () => {
    expect(visiblePrompt(walk(['Soldadura'])).kind).toBe('buttons');
    expect(visiblePrompt(walk(['Reparaciones del hogar'])).kind).toBe('buttons');
    const paint = skipItemPick(walk(['Reparaciones del hogar', 'no', 'paint-in']));
    const prompt = visiblePrompt(paint);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.serviceType).toBe('Reparaciones del hogar');
  });

  it('No estoy seguro deriva a diagnóstico general', () => {
    const session = submitPlaceholder(walk(['unsure']), 'No sé si es luz o agua');
    const prompt = visiblePrompt(session);
    expect(prompt.kind).toBe('summary');
    if (prompt.kind !== 'summary') return;
    expect(prompt.draft.serviceType).toBe('Mantenimiento general');
  });
});
