import { describe, expect, it } from 'vitest';
import {
  applicationSurface,
  calculateProject,
  circuitDemandVa,
  DEFAULT_RULES,
  electrificationGrade,
  minPointsForRoom,
  simultaneityFactor,
  type ProjectInput,
} from './installationProject';

/**
 * Caso de prueba = el ejemplo resuelto en clase por Sandy (departamento en 3er piso: habitación 16 m², baño 6 m²,
 * balcón semicubierto 2,5 m²; plano 1:50). Los resultados esperados son los de sus apuntes.
 * En clase se usó 0,66 en lugar de 2/3 para la demanda de IUG: se reproduce con esa regla.
 */
const CLASS_RULES = { ...DEFAULT_RULES, demand: { ...DEFAULT_RULES.demand, iugFactor: 0.66 } };

const classExample: ProjectInput = {
  rooms: [
    { name: 'Habitación', type: 'dormitorio', areaM2: 16 },
    { name: 'Baño', type: 'bano', areaM2: 6 },
    { name: 'Balcón', type: 'balcon', areaM2: 2.5, semiCovered: true },
  ],
  wallsM2: 1.56, // cubierta total de los apuntes: 23,56 m²
  circuits: [
    { id: 'CT1', kind: 'IUG', points: 4, lengthM: 4, breakerA: 10 },
    { id: 'CT2', kind: 'TUG', points: 4, lengthM: 7.5, breakerA: 16 },
    { id: 'CT3', kind: 'ACU', points: 1, loadVa: 2600, lengthM: 2, cosPhi: 0.75, breakerA: 16 },
  ],
  feeder: { lengthM: 20, breakerA: 25 },
};

describe('Proyecto de instalación — ejemplo de clase', () => {
  const r = calculateProject(classExample, CLASS_RULES);

  it('paso 1: SLA = cubierta + semicubierta / 2 = 24,81 m²', () => {
    expect(r.surface).toEqual({ covered: 23.56, semiCovered: 2.5, sla: 24.81 });
  });

  it('paso 2: grado de electrificación mínimo', () => {
    expect(r.grade).toBe('minimo');
  });

  it('paso 3: las bocas del proyecto cubren los mínimos (sin avisos)', () => {
    expect(r.minimums.IUG).toBe(3); // habitación 1 + baño 1 + balcón 1
    expect(r.minimums.TUG).toBe(4); // habitación 3 + baño 1
    expect(r.warnings).toEqual([]);
  });

  it('paso 4: DPMS del grado = 158,4 + 2.200 = 2.358,4 VA; total con el ACU = 4.958,4 VA', () => {
    expect(r.demand.perCircuit.find((c) => c.id === 'CT1')?.va).toBe(158.4);
    expect(r.demand.gradeDpms).toBe(2358.4);
    expect(r.demand.totalDpms).toBe(4958.4);
  });

  it('paso 5: corrientes, protecciones y secciones', () => {
    const [iug, tug, acu] = r.circuits;
    expect(iug).toMatchObject({ ib: 0.72, breakerA: 10, sectionMm2: 1.5, iz: 15, coordinationOk: true });
    expect(tug).toMatchObject({ ib: 10, breakerA: 16, sectionMm2: 2.5, iz: 21, coordinationOk: true });
    expect(acu).toMatchObject({ ib: 11.82, breakerA: 16, sectionMm2: 2.5, iz: 21, coordinationOk: true });
    expect(r.feeder.ib).toBeCloseTo(22.5, 1);
    expect(r.feeder.breakerA).toBe(25);
  });

  it('paso 7: la seccional con 4 mm² no cumple el 1 % y pasa a 6 mm² (≈ 2,19 V)', () => {
    expect(r.feeder.sectionIncreasedForDrop).toBe(true);
    expect(r.feeder.sectionMm2).toBe(6);
    expect(r.feeder.voltageDropV).toBeGreaterThan(2.1);
    expect(r.feeder.voltageDropV).toBeLessThanOrEqual(2.2);
  });

  it('paso 7: caídas por circuito y totales dentro de los límites', () => {
    const [iug, tug, acu] = r.circuits;
    expect(iug.voltageDropV).toBeCloseTo(0.056, 2);
    expect(tug.voltageDropV).toBeCloseTo(0.867, 2);
    expect(acu.voltageDropV).toBeCloseTo(0.24, 2);
    expect(tug.totalDropV).toBeCloseTo(3.04, 1); // apuntes: 3,06 V (con I seccional 22,8 A)
    for (const c of r.circuits) expect(c.totalDropOk).toBe(true);
  });

  it('paso 8: exigencia térmica K²·S² ≥ I²t verifica en todos', () => {
    expect(r.circuits.every((c) => c.thermalOk)).toBe(true);
    expect(r.feeder.thermalOk).toBe(true);
  });
});

describe('reglas sueltas', () => {
  it('grados según superficie (Tabla 770.8.I)', () => {
    expect(electrificationGrade(60)).toBe('minimo');
    expect(electrificationGrade(60.1)).toBe('medio');
    expect(electrificationGrade(130)).toBe('medio');
    expect(electrificationGrade(150)).toBe('elevado');
    expect(electrificationGrade(201)).toBe('superior');
  });

  it('IUG según la norma usa 2/3 (no 0,66): 4 bocas = 160 VA', () => {
    expect(circuitDemandVa({ id: 'x', kind: 'IUG', points: 4, lengthM: 1 })).toBe(160);
  });

  it('factor de simultaneidad (Tabla 770.9.II)', () => {
    expect(simultaneityFactor(2)).toBe(1);
    expect(simultaneityFactor(4)).toBe(0.7);
    expect(simultaneityFactor(7)).toBe(0.6);
    expect(simultaneityFactor(12)).toBe(0.5);
  });

  it('puntos mínimos por ambiente (Tabla 770.8.III)', () => {
    expect(minPointsForRoom({ name: 'Living', type: 'estar', areaM2: 20 }, 'medio')).toEqual({ IUG: 2, TUG: 4 });
    expect(minPointsForRoom({ name: 'Dorm', type: 'dormitorio', areaM2: 9 }, 'minimo')).toEqual({ IUG: 1, TUG: 2 });
    expect(minPointsForRoom({ name: 'Dorm', type: 'dormitorio', areaM2: 40 }, 'minimo')).toEqual({ IUG: 2, TUG: 3 });
    expect(minPointsForRoom({ name: 'Pasillo', type: 'pasillo', areaM2: 6, lengthM: 6 }, 'medio')).toEqual({ IUG: 2, TUG: 2 });
  });

  it('sin protecciones fijadas, la app propone la menor válida', () => {
    const r = calculateProject({ ...classExample, circuits: classExample.circuits.map(({ breakerA, ...c }) => c), feeder: { lengthM: 20 } }, CLASS_RULES);
    expect(r.circuits.map((c) => c.breakerA)).toEqual([6, 10, 16]);
    expect(r.feeder.breakerA).toBe(25);
  });

  it('avisa si faltan bocas o se pasa del máximo por circuito', () => {
    const r = calculateProject({
      ...classExample,
      circuits: [
        { id: 'CT1', kind: 'IUG', points: 2, lengthM: 4 },
        { id: 'CT2', kind: 'TUG', points: 16, lengthM: 7.5 },
      ],
    });
    expect(r.warnings.join(' ')).toMatch(/Faltan bocas IUG/);
    expect(r.warnings.join(' ')).toMatch(/supera las 15 bocas/);
  });

  it('superficie: muros suman a la cubierta', () => {
    expect(applicationSurface([{ name: 'A', type: 'estar', areaM2: 10 }], 2).sla).toBe(12);
  });
});
