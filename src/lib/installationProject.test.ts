import { describe, expect, it } from 'vitest';
import {
  applicationSurface,
  calculateProject,
  circuitDemandVa,
  DEFAULT_RULES,
  electrificationGrade,
  i2tLimit,
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
    { id: 'CT3', kind: 'ACU', points: 1, loadVa: 2600, lengthM: 2, cosPhi: 0.85, breakerA: 16 },
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
    expect(acu.voltageDropV).toBeCloseTo(0.272, 2);
    expect(tug.totalDropV).toBeCloseTo(3.04, 1); // apuntes: 3,06 V (con I seccional 22,8 A)
    for (const c of r.circuits) expect(c.totalDropOk).toBe(true);
  });

  it('paso 8: exigencia térmica K²·S² ≥ I²t verifica en todos', () => {
    expect(r.circuits.every((c) => c.thermalOk)).toBe(true);
    expect(r.feeder.thermalOk).toBe(true);
  });
});

/**
 * Caso de prueba 2 = Trabajo Práctico N° 1 de Sandy (departamento en Constitución 1734, validado el 23/11/2026).
 * Icc = 3.250 A (dato del profesor). Memoria: TP1_memoria_AEA (puntos 5, 7 y 8).
 */
const tpInput: ProjectInput = {
  rooms: classExample.rooms,
  wallsM2: classExample.wallsM2,
  circuits: [
    { id: 'CT1', kind: 'IUG', points: 5, lengthM: 11, breakerA: 10 },
    { id: 'CT2', kind: 'TUG', points: 11, lengthM: 12, breakerA: 16 },
    { id: 'CT3', kind: 'ACU', points: 1, loadVa: 2600, lengthM: 11, breakerA: 16 },
  ],
  feeder: { lengthM: 11, breakerA: 25 },
  iccA: 3250,
  rcd: { shortCircuitA: 6000 },
};

describe('Proyecto de instalación — TP N° 1 (Icc = 3.250 A)', () => {
  const r = calculateProject(tpInput, CLASS_RULES);
  const [iug, tug, acu] = r.circuits;

  it('8 A: propone térmicas de 4,5 kA (3 kA no alcanzan para 3.250 A) y verifica', () => {
    for (const l of [iug, tug, acu, r.feeder]) {
      expect(l).toMatchObject({ breakingCapacityA: 4500, breakingCapacityAssumed: true, breakingOk: true });
    }
  });

  it('8 B: el I²t sale de las tablas 770-B.VIII (30.000) y 770-B.IX (39.000)', () => {
    expect(iug).toMatchObject({ i2t: 30000, i2tSource: 'tabla', i2tRef: 'Tabla 770-B.VIII' });
    expect(r.feeder).toMatchObject({ i2t: 39000, i2tSource: 'tabla', i2tRef: 'Tabla 770-B.IX' });
  });

  it('8 B: IUG con 1,5 mm² no verifica (29.756 < 30.000) y la app sube a 2,5 mm²', () => {
    expect(iug.sectionIncreasedForThermal).toBe(true);
    expect(iug.sectionMm2).toBe(2.5);
    expect(iug.thermalOk).toBe(true);
    expect(iug.iz).toBe(21);
  });

  it('8 B: TUG y ACU (2,5 mm²) y la seccional (4 mm², 211.600 ≥ 39.000) verifican sin cambios', () => {
    expect(tug).toMatchObject({ sectionMm2: 2.5, sectionIncreasedForThermal: false, thermalOk: true });
    expect(acu).toMatchObject({ sectionMm2: 2.5, sectionIncreasedForThermal: false, thermalOk: true });
    expect(r.feeder).toMatchObject({ sectionMm2: 4, sectionIncreasedForThermal: false, sectionIncreasedForDrop: false, thermalOk: true });
  });

  it('paso 7: caídas de la memoria (seccional 1,81 V; IUG 0,11 V; TUG 1,39 V; ACU 1,50 V)', () => {
    expect(r.feeder.voltageDropV).toBeCloseTo(1.81, 1);
    expect(iug.voltageDropV).toBeCloseTo(0.11, 2);
    expect(tug.voltageDropV).toBeCloseTo(1.39, 2);
    expect(acu.voltageDropV).toBeCloseTo(1.5, 2);
    for (const c of r.circuits) expect(c.totalDropOk).toBe(true);
  });

  it('diferencial de 6 kA verifica; de 3 kA no verifica; sin dato queda sin verificar', () => {
    expect(r.rcd.ok).toBe(true);
    const low = calculateProject({ ...tpInput, rcd: { shortCircuitA: 3000 } }, CLASS_RULES);
    expect(low.rcd.ok).toBe(false);
    expect(low.warnings.join(' ')).toMatch(/diferencial aguanta 3000 A/);
    const none = calculateProject({ ...tpInput, rcd: undefined }, CLASS_RULES);
    expect(none.rcd.ok).toBeNull();
    expect(none.warnings.join(' ')).toMatch(/capacidad de cortocircuito del diferencial/);
  });

  it('una térmica de 3 kA elegida a mano no verifica contra 3.250 A', () => {
    const r2 = calculateProject({ ...tpInput, circuits: tpInput.circuits.map((c) => ({ ...c, breakingCapacityA: 3000 })) }, CLASS_RULES);
    expect(r2.circuits.every((c) => c.breakingOk === false && c.breakingCapacityAssumed === false)).toBe(true);
    expect(r2.circuits[0].warnings.join(' ')).toMatch(/poder de corte \(3000 A\) es menor que la Icc/);
  });

  it('avisa los valores supuestos para confirmar con el fabricante', () => {
    expect(r.assumptions.join(' ')).toMatch(/CT1: poder de corte 4500 A, clase 3, curva C/);
  });

  it('con el I²t del fabricante (20.000) el IUG se queda en 1,5 mm²', () => {
    const r3 = calculateProject(
      { ...tpInput, circuits: tpInput.circuits.map((c) => (c.id === 'CT1' ? { ...c, i2tOverride: 20000 } : c)) },
      CLASS_RULES
    );
    expect(r3.circuits[0]).toMatchObject({ sectionMm2: 1.5, sectionIncreasedForThermal: false, i2tSource: 'fabricante', thermalOk: true });
  });

  it('si el técnico fija 1,5 mm² con la térmica de 4,5 kA, avisa que no verifica y no la cambia', () => {
    const r4 = calculateProject(
      { ...tpInput, circuits: tpInput.circuits.map((c) => (c.id === 'CT1' ? { ...c, sectionMm2: 1.5 } : c)) },
      CLASS_RULES
    );
    expect(r4.circuits[0]).toMatchObject({ sectionMm2: 1.5, thermalOk: false, sectionIncreasedForThermal: false });
    expect(r4.circuits[0].warnings.join(' ')).toMatch(/exigencia térmica/);
  });
});

describe('Cortocircuito — casos sueltos', () => {
  it('tablas de I²t máximo (Tablas 770-B.VIII y 770-B.IX, clase 3, curva C)', () => {
    expect(i2tLimit(10, 3000, 3, 'C')).toEqual({ value: 18000, ref: 'Tabla 770-B.VIII' });
    expect(i2tLimit(16, 4500, 3, 'C')?.value).toBe(30000);
    expect(i2tLimit(25, 4500, 3, 'C')).toEqual({ value: 39000, ref: 'Tabla 770-B.IX' });
    expect(i2tLimit(32, 6000, 3, 'C')?.value).toBe(55000);
    expect(i2tLimit(10, 4500, 3, 'B')?.value).toBe(25000);
    expect(i2tLimit(10, 4500, 2, 'C')?.value).toBe(75000);
  });

  it('clase 1 y más de 32 A no tienen valor en la tabla (sin dato)', () => {
    expect(i2tLimit(10, 4500, 1, 'C')).toBeNull();
    expect(i2tLimit(40, 4500, 3, 'C')).toBeNull();
  });

  it('sin Icc las verificaciones de cortocircuito quedan "sin dato" y el ejemplo de clase sigue igual', () => {
    const r = calculateProject(classExample, CLASS_RULES);
    expect(r.iccA).toBeNull();
    expect(r.circuits.every((c) => c.breakingOk === null && c.breakingCapacityA === 3000 && c.i2t === 18000)).toBe(true);
  });

  it('clase 1 sin dato del fabricante: el térmico queda "sin dato" (no "verifica")', () => {
    const r = calculateProject({ ...classExample, circuits: classExample.circuits.map((c) => ({ ...c, energyClass: 1 as const })) }, CLASS_RULES);
    expect(r.circuits.every((c) => c.thermalOk === null)).toBe(true);
    expect(r.circuits[0].warnings.join(' ')).toMatch(/Sin dato de I²t/);
  });

  it('la Icc propone el menor poder de corte normalizado que la cubre', () => {
    const at = (icc: number) => calculateProject({ ...classExample, iccA: icc }, CLASS_RULES).circuits[0].breakingCapacityA;
    expect(at(2500)).toBe(3000);
    expect(at(3000)).toBe(3000);
    expect(at(3250)).toBe(4500);
    expect(at(6000)).toBe(6000);
    expect(at(8000)).toBe(10000);
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

  it('caída propia del circuito ≤ 2 % Un (pizarrón del 16/11): un TUG largo sube de sección', () => {
    const r = calculateProject(
      {
        ...classExample,
        circuits: [
          { id: 'CT1', kind: 'IUG', points: 4, lengthM: 4, breakerA: 10 },
          { id: 'CT2', kind: 'TUG', points: 4, lengthM: 45, breakerA: 16 }, // 45 m: con 2,5 mm² da 5,2 V > 2 % (4,4 V)
        ],
      },
      CLASS_RULES
    );
    const tug = r.circuits.find((c) => c.id === 'CT2')!;
    expect(tug.sectionIncreasedForDrop).toBe(true);
    expect(tug.sectionMm2).toBeGreaterThan(2.5);
    expect(tug.voltageDropV).toBeLessThanOrEqual(4.4);
  });

  it('si el técnico fija una sección que no cumple el 2 %, se avisa', () => {
    const r = calculateProject(
      { ...classExample, circuits: [{ id: 'CT2', kind: 'TUG', points: 4, lengthM: 45, breakerA: 16, sectionMm2: 2.5 }] },
      CLASS_RULES
    );
    expect(r.circuits[0].warnings.join(' ')).toMatch(/supera el 2 %/);
  });

  it('superficie: muros suman a la cubierta', () => {
    expect(applicationSurface([{ name: 'A', type: 'estar', areaM2: 10 }], 2).sla).toBe(12);
  });
});

describe('Paso 6 — canalizaciones y conductores (TP N° 1)', () => {
  const r = calculateProject(tpInput);
  const by = (id: string) => r.conduits.find((c) => c.id === id)!;

  it('circuitos en RSP 20 y seccional en RSP 25, con conductores IRAM-NM-247-3', () => {
    expect(by('CT1').conduit).toBe('IRAM 62386-21, RSP 20');
    expect(by('Seccional').conduit).toBe('IRAM 62386-21, RSP 25');
    expect(by('CT2').conductorStandard).toBe('IRAM-NM-247-3');
    expect(r.conduits).toHaveLength(4);
  });
  it('fase/neutro con la sección calculada y PE igual a la fase (mínimo 2,5 mm²)', () => {
    expect([by('CT1').phaseNeutralMm2, by('CT1').peMm2]).toEqual([2.5, 2.5]); // IUG subió a 2,5 por la térmica
    expect([by('CT2').phaseNeutralMm2, by('CT2').peMm2]).toEqual([2.5, 2.5]);
    expect([by('Seccional').phaseNeutralMm2, by('Seccional').peMm2]).toEqual([4, 4]);
  });
  it('con 1,5 mm² fijo el PE no baja de 2,5 mm² (como en el TP original)', () => {
    const fixed = calculateProject({ ...tpInput, circuits: tpInput.circuits.map((c) => (c.id === 'CT1' ? { ...c, sectionMm2: 1.5 } : c)) });
    const ct1 = fixed.conduits.find((c) => c.id === 'CT1')!;
    expect([ct1.phaseNeutralMm2, ct1.peMm2]).toEqual([1.5, 2.5]);
  });
});

describe('Paso 9 — ubicación del tablero seccional (770.20.4)', () => {
  it('sin datos queda "sin confirmar" (no verifica ni falla)', () => {
    const b = calculateProject(tpInput).boardLocation;
    expect(b.ok).toBeNull();
    expect(b.checks.map((c) => c.ok)).toEqual([null, null, null]);
  });
  it('accesible, a la vista y con 0,90 m libres: verifica', () => {
    const b = calculateProject({ ...tpInput, boardLocation: { accessible: true, notHidden: true, frontClearM: 0.9 } }).boardLocation;
    expect(b.ok).toBe(true);
    expect(b.checks[2].ref).toBe('770.20.4.2');
  });
  it('detrás del giro de la puerta no verifica y avisa (caso de la consigna del TP)', () => {
    const r = calculateProject({ ...tpInput, boardLocation: { accessible: true, notHidden: false, frontClearM: 0.9 } });
    expect(r.boardLocation.ok).toBe(false);
    expect(r.warnings.some((w) => w.includes('770.20.4'))).toBe(true);
  });
  it('con menos de 0,90 m libres al frente no verifica (valor recomendado de la nota)', () => {
    expect(calculateProject({ ...tpInput, boardLocation: { accessible: true, notHidden: true, frontClearM: 0.6 } }).boardLocation.ok).toBe(false);
  });
});
