import { describe, expect, it } from 'vitest';
import { calculateProject, type ProjectInput } from './installationProject';
import { computeTakeoff } from './installationTakeoff';

// Proyecto del TP N° 1 (Icc 3.250 A).
const tp: ProjectInput = {
  rooms: [{ name: 'Habitación', type: 'dormitorio', areaM2: 16 }],
  circuits: [
    { id: 'CT1', kind: 'IUG', points: 5, lengthM: 11, breakerA: 10 },
    { id: 'CT2', kind: 'TUG', points: 11, lengthM: 12, breakerA: 16 },
    { id: 'CT3', kind: 'ACU', points: 1, loadVa: 2600, lengthM: 11, breakerA: 16 },
  ],
  feeder: { lengthM: 11, breakerA: 25 },
  iccA: 3250,
  rcd: { shortCircuitA: 6000 },
};
const take = (input = tp, opts = {}) => computeTakeoff(input, calculateProject(input), opts);
const qty = (lines: ReturnType<typeof take>, key: string) => lines.find((l) => l.key === key)?.quantity;

describe('computeTakeoff — proyecto del TP N° 1', () => {
  const lines = take();

  it('cables por sección: 3 conductores × largo + 10 % (IUG sube a 2,5 mm² por la térmica de 4,5 kA)', () => {
    // 2,5 mm²: IUG + TUG + ACU = 3 × (11 + 12 + 11) = 102 m → 112,2 → 113 m. Seccional 4 mm²: 3 × 11 = 33 → 36,3 → 37 m.
    expect(qty(lines, 'cable-2.5')).toBe(113);
    expect(qty(lines, 'cable-4')).toBe(37);
    expect(qty(lines, 'cable-1.5')).toBeUndefined();
  });

  it('caños en tiras de 3 m: RSP 20 para circuitos (34 m → 12) y RSP 25 para la seccional (11 m → 4)', () => {
    expect(qty(lines, 'pipe-20')).toBe(12);
    expect(qty(lines, 'pipe-25')).toBe(4);
  });

  it('cajas y mecanismos salen de las bocas', () => {
    expect(qty(lines, 'box-oct')).toBe(5);
    expect(qty(lines, 'box-rect')).toBe(17); // 11 TUG + 1 ACU + 5 llaves
    expect(qty(lines, 'mech-outlet-10')).toBe(11);
    expect(qty(lines, 'mech-outlet-20')).toBe(1);
    expect(qty(lines, 'mech-cover')).toBe(17);
    expect(qty(lines, 'luminaire')).toBe(5);
  });

  it('protecciones agrupadas por corriente, con 4,5 kA y curva C como en la memoria', () => {
    expect(lines.find((l) => l.key === 'itm-10-4500-C')?.description).toBe('Interruptor termomagnético 2P 10 A curva C 4,5 kA');
    expect(qty(lines, 'itm-16-4500-C')).toBe(2);
    expect(qty(lines, 'itm-25-4500-C')).toBe(1);
    expect(lines.find((l) => l.key === 'rcd')?.description).toContain('cortocircuito ≥ 3,25 kA');
  });

  it('puesta a tierra e insumos', () => {
    expect(qty(lines, 'ground-rod')).toBe(1);
    expect(qty(lines, 'ground-cable')).toBe(6);
    expect(qty(lines, 'tape')).toBe(2);
  });

  it('las líneas salen ordenadas por rubro y cada una explica su regla', () => {
    expect(lines[0].group).toBe('Conductores');
    expect(lines.every((l) => l.basis.length > 0 && l.quantity > 0)).toBe(true);
  });
});

describe('opciones', () => {
  it('las llaves y el desperdicio se pueden cambiar', () => {
    const lines = take(tp, { switches: 6, wasteRate: 0 });
    expect(qty(lines, 'mech-switch')).toBe(6);
    expect(qty(lines, 'box-rect')).toBe(18); // el TP tenía 18
    expect(qty(lines, 'cable-2.5')).toBe(102);
  });
});
