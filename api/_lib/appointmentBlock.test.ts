import { describe, expect, it } from 'vitest';
import { resolveAppointmentBlock } from './appointmentBlock';

describe('resolveAppointmentBlock', () => {
  it('reconoce las 3 etiquetas con horario fijo que ofrece el selector del cliente', () => {
    expect(resolveAppointmentBlock('Mañana (08–12 h)')).toBe('morning');
    expect(resolveAppointmentBlock('Mediodía (12–15 h)')).toBe('midday');
    expect(resolveAppointmentBlock('Tarde (15–19 h)')).toBe('afternoon');
  });

  it('"A coordinar" y cualquier texto no reconocido caen en unscheduled', () => {
    expect(resolveAppointmentBlock('A coordinar')).toBe('unscheduled');
    expect(resolveAppointmentBlock('')).toBe('unscheduled');
    expect(resolveAppointmentBlock('cualquier cosa que mande un cliente viejo')).toBe('unscheduled');
  });
});
