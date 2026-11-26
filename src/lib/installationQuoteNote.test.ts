import { describe, expect, it } from 'vitest';
import { calculateBudget } from './installationBudget';
import { arsMoney, buildQuoteNoteHtml, esc, QUOTE_WARRANTY_TEXT, type QuoteNoteData } from './installationQuoteNote';

const result = calculateBudget({
  materials: 787626.73, supplies: 94710, officialHourlyRate: 7828, helperHourlyRate: 5696, visit: 60000,
  tools: [{ name: 'Amoladora', originValue: 483644.9, hoursOnSite: 16 }],
  tasks: [{ name: 'Obra', officialHours: 78, helperHours: 66 }],
});
const base: QuoteNoteData = {
  logoUrl: 'https://app.test/logo.png', date: '24/11/2026', projectName: 'Depto 3B',
  technician: { name: 'Juan Pérez' }, client: {}, scope: ['Instalación completa'], exclusions: 'IVA', options: [{ label: 'Opción 1', result }],
};

describe('buildQuoteNoteHtml', () => {
  it('no imprime teléfono ni correo del técnico: el contacto es por la app', () => {
    const technician = { name: 'Juan Pérez', phone: '1133334444', email: 'juan@correo.com' };
    const html = buildQuoteNoteHtml({ ...base, technician });
    expect(html).toContain('Por la app TecniUrbano');
    expect(html).not.toContain('1133334444');
    expect(html).not.toContain('juan@correo.com');
  });

  const html = buildQuoteNoteHtml(base);
  it('lleva el logo, la fecha, el total y el anticipo con su porcentaje', () => {
    expect(html).toContain('src="https://app.test/logo.png"');
    expect(html).toContain('24/11/2026');
    expect(html).toContain(arsMoney(result.total));
    expect(html).toMatch(/\(\d+,\d %\)/);
  });
  it('incluye la garantía a cargo del técnico y aclara que la obra se cobra fuera de la plataforma', () => {
    expect(html).toContain('a cargo del técnico independiente');
    expect(html).toContain('30 días posteriores a su finalización');
    expect(html).toContain('fuera de la plataforma');
    expect(QUOTE_WARRANTY_TEXT).toContain('responsabilidad del técnico independiente');
  });
  it('deja líneas en blanco para lo que falta y muestra las condiciones', () => {
    expect(html).toContain('______');
    expect(html).toContain('sin IVA');
    expect(html).toContain('10 días corridos');
    expect(html).toContain('<b>No incluye:</b> IVA');
  });
  it('escapa el texto del usuario (no se cuela HTML)', () => {
    const bad = buildQuoteNoteHtml({ ...base, projectName: '<script>alert(1)</script>', client: { name: '"><img src=x onerror=1>' } });
    expect(bad).not.toContain('<script>');
    expect(bad).not.toContain('<img src=x');
    expect(esc(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
  it('no repite el nombre del proyecto si ya está en el domicilio', () => {
    const h = buildQuoteNoteHtml({ ...base, projectName: 'Constitución 1734', client: { address: 'Constitución 1734, CABA' } });
    expect(h.match(/Constitución 1734/g)).toHaveLength(2); // domicilio + título de la pestaña
  });
  it('con dos opciones muestra dos columnas', () => {
    const two = buildQuoteNoteHtml({ ...base, options: [{ label: 'Por precio', result }, { label: 'Por calidad', result }] });
    expect(two).toContain('<th>Por precio</th><th>Por calidad</th>');
  });
});
