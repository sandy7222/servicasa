/**
 * Motor de cálculo del módulo "Proyecto de instalación" (plan-proyecto-instalacion.md, Fase 1).
 *
 * Aplica el método de proyecto de una instalación eléctrica domiciliaria según la Reglamentación
 * AEA 90364-7-770 (Edición 2026), siguiendo los pasos de los apuntes de clase de Sandy. Es una GUÍA de cálculo:
 * el técnico matriculado revisa, puede corregir cualquier valor y es responsable del proyecto.
 *
 * - Funciones puras, sin red ni base de datos.
 * - Todos los valores técnicos viven en `InstallationRules` (con la cláusula o tabla de la AEA al lado) para que
 *   administración los pueda revisar/actualizar sin tocar la lógica. No se copia el texto de la norma.
 */

// ---------------------------------------------------------------------------------------------------------
// Reglas (valores de la AEA 90364-7-770, Ed. 2026)
// ---------------------------------------------------------------------------------------------------------

export type Grade = 'minimo' | 'medio' | 'elevado' | 'superior';
export type CircuitKind = 'IUG' | 'TUG' | 'IUE' | 'TUE' | 'ACU';
export type RoomType =
  | 'estar' // sala de estar, comedor, escritorio, biblioteca o similares
  | 'dormitorio'
  | 'cocina'
  | 'bano'
  | 'vestibulo' // vestíbulo, garaje, hall, vestidor o similares
  | 'pasillo'
  | 'lavadero'
  | 'balcon'; // balcones, galerías, atrios, espacios y pasillos semicubiertos

export type InstallationRules = {
  /** Tensión de cálculo (V). */
  voltage: number;
  /** 770.8.3.1 / Tabla 770.8.I: límite superior de superficie (m²) de cada grado; superior = sin límite. */
  gradeMaxSurface: { minimo: number; medio: number; elevado: number };
  /** 770.8.3.2 / Tabla 770.8.II: circuitos mínimos de uso general por grado (variante a). */
  minCircuits: Record<Grade, { IUG: number; TUG: number; libre: number }>;
  /** Tabla 770.7.I: máximo de bocas por circuito y máxima corriente asignada de la protección (A). */
  circuitLimits: Record<Exclude<CircuitKind, 'ACU'>, { maxPoints: number; maxProtection: number }>;
  /** Tabla 770.9.I: demanda mínima por circuito. IUG/IUE = factor × bocas × VA por boca; TUG/TUE = VA fijos. */
  demand: { iugFactor: number; iugVaPerPoint: number; iueFactor: number; iueVaPerPoint: number; tugVa: number; tueVa: number };
  /** Tabla 770.9.II: factor de simultaneidad según la cantidad de circuitos de uso general y especial. */
  simultaneity: Array<{ minCircuits: number; factor: number }>;
  /** Tabla 770.13.I: secciones nominales mínimas (mm²). */
  minSection: Record<CircuitKind | 'seccional' | 'principal' | 'pe', number>;
  /** Secciones normalizadas de cobre (mm²) en orden. */
  sections: number[];
  /** Tabla 770.16.I: corriente admisible Iz (A) a 40 °C, cables IRAM-NM 247-3 en cañería, 2 cables cargados + PE. */
  izTwoLoaded: Record<string, number>;
  /** Valores normalizados de corriente asignada de interruptores automáticos (A). */
  breakerRatings: number[];
  /** Resistividad del cobre usada en la caída de tensión (Ω·mm²/m), como en los apuntes. */
  copperResistivity: number;
  /** 770.19.6 (Anexo de fórmulas): factor de potencia en régimen permanente. */
  cosPhi: number;
  /** Tabla 770.19.IV: caída de tensión máxima total (%) — uso general/IUE y uso especial/específico; Nota 1: seccional. */
  maxVoltageDropPct: { general: number; especifico: number; seccional: number; circuitoTerminal: number };
  /** Exigencia térmica K²·S² ≥ I²t: K para cobre/PVC (Tabla 770.15.II). El I²t sale de `i2tMax` o del fabricante. */
  thermal: { k: number };
  /** Paso 6 (770.12.2 a, 770.12.3.1 b1, 770.12.3.3.1, Tabla 770.13.I): canalización y tipo de conductor de cada línea. */
  conduit: { standard: string; circuits: string; feeder: string; conductorStandard: string };
  /** Paso 9 (770.20.4.2): espacio libre al frente del tablero seccional, valor recomendado en la nota (m). */
  boardLocation: { recommendedFrontClearM: number };
  /** Poderes de corte normalizados de los interruptores automáticos (A). */
  breakingCapacities: number[];
  /** Valores por defecto cuando el técnico no carga el dato de su protección (se avisan como "supuestos"). */
  protectionDefaults: { energyClass: EnergyClass; curve: Curve };
  /**
   * I²t máximo orientativo (A²s) de interruptores IEC 60898-1 según poder de corte, clase de limitación y curva.
   * Tabla 770-B.VIII (In ≤ 16 A) y Tabla 770-B.IX (16 A < In ≤ 32 A) de la Guía AEA 90364-7-770 Ed. 2017.
   * A CONFIRMAR con la Ed. 2026. La clase 1 no tiene límite especificado (no figura). El valor real de I²t es un
   * dato garantizado por el fabricante: el técnico puede cargarlo (`i2tOverride`) y se usa en lugar de la tabla.
   */
  i2tMax: {
    upTo16A: Record<string, Partial<Record<2 | 3, Record<Curve, number>>>>;
    from16To32A: Record<string, Partial<Record<2 | 3, Record<Curve, number>>>>;
  };
};

/** Clase de limitación de energía de un interruptor automático (1, 2 o 3). */
export type EnergyClass = 1 | 2 | 3;
/** Curva de disparo instantáneo. */
export type Curve = 'B' | 'C';

export const DEFAULT_RULES: InstallationRules = {
  voltage: 220,
  gradeMaxSurface: { minimo: 60, medio: 130, elevado: 200 },
  minCircuits: {
    minimo: { IUG: 1, TUG: 1, libre: 0 },
    medio: { IUG: 2, TUG: 1, libre: 0 },
    elevado: { IUG: 2, TUG: 3, libre: 0 },
    superior: { IUG: 2, TUG: 3, libre: 1 },
  },
  circuitLimits: {
    IUG: { maxPoints: 15, maxProtection: 16 },
    TUG: { maxPoints: 15, maxProtection: 20 },
    IUE: { maxPoints: 15, maxProtection: 32 },
    TUE: { maxPoints: 15, maxProtection: 32 },
  },
  demand: { iugFactor: 2 / 3, iugVaPerPoint: 60, iueFactor: 2 / 3, iueVaPerPoint: 120, tugVa: 2200, tueVa: 3300 },
  simultaneity: [
    { minCircuits: 10, factor: 0.5 },
    { minCircuits: 6, factor: 0.6 },
    { minCircuits: 3, factor: 0.7 },
    { minCircuits: 0, factor: 1 },
  ],
  minSection: { IUG: 1.5, TUG: 2.5, IUE: 2.5, TUE: 2.5, ACU: 2.5, seccional: 2.5, principal: 4, pe: 2.5 },
  sections: [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35],
  izTwoLoaded: { '1': 11, '1.5': 15, '2.5': 21, '4': 28, '6': 36, '10': 50, '16': 66, '25': 88, '35': 109 },
  breakerRatings: [6, 10, 16, 20, 25, 32, 40, 50, 63],
  copperResistivity: 0.017,
  cosPhi: 0.85,
  // circuitoTerminal: caída propia de cada circuito terminal (criterio de la clase: 1 % seccional + 2 % circuito = 3 %).
  maxVoltageDropPct: { general: 3, especifico: 5, seccional: 1, circuitoTerminal: 2 },
  thermal: { k: 115 },
  conduit: { standard: 'IRAM 62386-21', circuits: 'RSP 20', feeder: 'RSP 25', conductorStandard: 'IRAM-NM-247-3' },
  boardLocation: { recommendedFrontClearM: 0.9 },
  breakingCapacities: [3000, 4500, 6000, 10000],
  protectionDefaults: { energyClass: 3, curve: 'C' },
  i2tMax: {
    upTo16A: {
      '3000': { 2: { B: 31000, C: 37000 }, 3: { B: 15000, C: 18000 } },
      '4500': { 2: { B: 60000, C: 75000 }, 3: { B: 25000, C: 30000 } },
      '6000': { 2: { B: 100000, C: 120000 }, 3: { B: 35000, C: 42000 } },
      '10000': { 2: { B: 240000, C: 290000 }, 3: { B: 70000, C: 84000 } },
    },
    from16To32A: {
      '3000': { 2: { B: 40000, C: 50000 }, 3: { B: 18000, C: 22000 } },
      '4500': { 2: { B: 80000, C: 100000 }, 3: { B: 32000, C: 39000 } },
      '6000': { 2: { B: 130000, C: 160000 }, 3: { B: 45000, C: 55000 } },
      '10000': { 2: { B: 310000, C: 370000 }, 3: { B: 90000, C: 110000 } },
    },
  },
};

/**
 * I²t máximo (A²s) de una protección según la tabla. Devuelve null si no hay dato: clase 1 ("sin límite
 * especificado"), In > 32 A o un poder de corte que la tabla no trae. En esos casos hay que pedírselo al fabricante.
 */
export function i2tLimit(
  breakerA: number,
  breakingCapacityA: number,
  energyClass: EnergyClass,
  curve: Curve,
  rules = DEFAULT_RULES
): { value: number; ref: string } | null {
  if (energyClass === 1 || breakerA > 32) return null;
  const table = breakerA <= 16 ? rules.i2tMax.upTo16A : rules.i2tMax.from16To32A;
  const ref = breakerA <= 16 ? 'Tabla 770-B.VIII' : 'Tabla 770-B.IX';
  const value = table[String(breakingCapacityA)]?.[energyClass]?.[curve];
  return value === undefined ? null : { value, ref };
}

// ---------------------------------------------------------------------------------------------------------
// Entrada del técnico
// ---------------------------------------------------------------------------------------------------------

export type Room = {
  name: string;
  type: RoomType;
  areaM2: number;
  /** Semicubierto (balcón, galería): cuenta el 50 % en la superficie de aplicación. */
  semiCovered?: boolean;
  /** Largo (m) para pasillos y balcones, donde la norma cuenta bocas por largo. Si falta, se usa √superficie. */
  lengthM?: number;
};

export type CircuitInput = {
  id: string;
  kind: CircuitKind;
  /** Bocas que el técnico decidió poner en el circuito (≥ el mínimo que propone la app). */
  points: number;
  /** Potencia del equipo (W o VA) para circuitos de uso específico (ACU). */
  loadVa?: number;
  /** Longitud del circuito (m) desde el tablero hasta la boca más lejana, para la caída de tensión. */
  lengthM: number;
  /** Factor de potencia del circuito; por defecto el de las reglas. */
  cosPhi?: number;
  /** Protección elegida por el técnico (A). Si falta, la app propone la menor válida. */
  breakerA?: number;
  /** Sección elegida por el técnico (mm²). Si falta, la app propone la menor válida. */
  sectionMm2?: number;
} & ProtectionInput;

/**
 * Datos de cortocircuito de la protección (los carga el técnico de la ficha del fabricante). Todos opcionales:
 * si faltan, la app usa valores por defecto y los avisa como supuestos.
 */
export type ProtectionInput = {
  /** Poder de corte (A). Si falta: el menor normalizado ≥ Icc (o el menor de la lista si no hay Icc). */
  breakingCapacityA?: number;
  /** Clase de limitación de energía. Si falta: la de `protectionDefaults`. */
  energyClass?: EnergyClass;
  /** Curva de disparo. Si falta: la de `protectionDefaults`. */
  curve?: Curve;
  /** I²t garantizado por el fabricante (A²s). Si se carga, se usa en lugar de la tabla. */
  i2tOverride?: number;
};

export type ProjectInput = {
  rooms: Room[];
  /** Muros y tabiques (m²) que se suman a la superficie cubierta. */
  wallsM2?: number;
  circuits: CircuitInput[];
  /** Línea seccional (tablero principal → tablero seccional). */
  feeder: { lengthM: number; cosPhi?: number; breakerA?: number; sectionMm2?: number } & ProtectionInput;
  /** Corriente de cortocircuito del punto de suministro (A): dato de la distribuidora. Sin dato, las verificaciones de cortocircuito quedan "sin dato". */
  iccA?: number;
  /** Interruptor diferencial: capacidad de cortocircuito que garantiza el fabricante (A) y tipo. */
  rcd?: { shortCircuitA?: number; type?: 'A' | 'AC' };
  /** Paso 9 (770.20.4): el técnico confirma la ubicación del tablero seccional. Sin dato = "sin confirmar". */
  boardLocation?: { accessible?: boolean; notHidden?: boolean; frontClearM?: number };
  /** Aplicar el factor de simultaneidad de la Tabla 770.9.II a la DPMS del grado (por defecto no, como en los apuntes). */
  applySimultaneity?: boolean;
};

// ---------------------------------------------------------------------------------------------------------
// Paso 1 — Superficie límite de aplicación (770.8.1.1)
// ---------------------------------------------------------------------------------------------------------

/** `wallsM2`: sección horizontal de muros y tabiques, que la norma suma a la superficie cubierta (770.8.1). */
export function applicationSurface(rooms: Room[], wallsM2 = 0): { covered: number; semiCovered: number; sla: number } {
  const covered = round2(rooms.filter((r) => !r.semiCovered).reduce((s, r) => s + r.areaM2, 0) + wallsM2);
  const semiCovered = round2(rooms.filter((r) => r.semiCovered).reduce((s, r) => s + r.areaM2, 0));
  return { covered, semiCovered, sla: round2(covered + semiCovered / 2) };
}

// ---------------------------------------------------------------------------------------------------------
// Paso 2 — Grado de electrificación (770.8.3.1, Tabla 770.8.I)
// ---------------------------------------------------------------------------------------------------------

export function electrificationGrade(sla: number, rules = DEFAULT_RULES): Grade {
  if (sla <= rules.gradeMaxSurface.minimo) return 'minimo';
  if (sla <= rules.gradeMaxSurface.medio) return 'medio';
  if (sla <= rules.gradeMaxSurface.elevado) return 'elevado';
  return 'superior';
}

// ---------------------------------------------------------------------------------------------------------
// Paso 3 — Puntos mínimos de utilización por ambiente (770.8.3.3, Tabla 770.8.III) y circuitos mínimos
// ---------------------------------------------------------------------------------------------------------

export function minPointsForRoom(room: Room, grade: Grade): { IUG: number; TUG: number } {
  const a = room.areaM2;
  const len = room.lengthM ?? Math.sqrt(a);
  const per = (value: number, size: number, min: number) => Math.max(min, Math.ceil(value / size));
  switch (room.type) {
    case 'estar':
      return { IUG: per(a, 18, 1), TUG: per(a, 6, 2) };
    case 'dormitorio':
      if (a < 10) return { IUG: 1, TUG: 2 };
      if (a <= 36) return { IUG: 1, TUG: 3 };
      return { IUG: 2, TUG: 3 };
    case 'cocina':
      // Los módulos de tomacorrientes para artefactos de ubicación fija se indican aparte en la tabla;
      // acá se cuentan las bocas.
      return { IUG: grade === 'minimo' ? 1 : 2, TUG: grade === 'superior' ? 4 : 3 };
    case 'bano':
      return { IUG: 1, TUG: 1 };
    case 'vestibulo':
      return grade === 'minimo' ? { IUG: 1, TUG: 1 } : { IUG: per(a, 12, 1), TUG: per(a, 12, 1) };
    case 'pasillo':
      return { IUG: per(len, 5, 1), TUG: grade === 'minimo' || len <= 2 ? 0 : per(len, 5, 1) };
    case 'lavadero':
      return { IUG: 1, TUG: grade === 'minimo' ? 1 : 2 };
    case 'balcon':
      return { IUG: per(len, 5, 1), TUG: 0 };
  }
}

export function minimumPoints(rooms: Room[], grade: Grade) {
  const perRoom = rooms.map((room) => ({ room: room.name, ...minPointsForRoom(room, grade) }));
  return {
    perRoom,
    IUG: perRoom.reduce((s, r) => s + r.IUG, 0),
    TUG: perRoom.reduce((s, r) => s + r.TUG, 0),
    circuits: DEFAULT_RULES.minCircuits[grade],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Paso 4 — Demanda de potencia máxima simultánea (770.9, Tablas 770.9.I y 770.9.II)
// ---------------------------------------------------------------------------------------------------------

export function circuitDemandVa(c: CircuitInput, rules = DEFAULT_RULES): number {
  switch (c.kind) {
    case 'IUG':
      return round2(rules.demand.iugFactor * c.points * rules.demand.iugVaPerPoint);
    case 'IUE':
      return round2(rules.demand.iueFactor * c.points * rules.demand.iueVaPerPoint);
    case 'TUG':
      return rules.demand.tugVa;
    case 'TUE':
      return rules.demand.tueVa;
    case 'ACU':
      return c.loadVa ?? 0;
  }
}

export function simultaneityFactor(generalAndSpecialCircuits: number, rules = DEFAULT_RULES): number {
  return rules.simultaneity.find((s) => generalAndSpecialCircuits >= s.minCircuits)?.factor ?? 1;
}

export function demand(input: ProjectInput, rules = DEFAULT_RULES) {
  const perCircuit = input.circuits.map((c) => ({ id: c.id, kind: c.kind, va: circuitDemandVa(c, rules) }));
  const general = perCircuit.filter((c) => c.kind !== 'ACU');
  const specific = perCircuit.filter((c) => c.kind === 'ACU');
  const factor = input.applySimultaneity ? simultaneityFactor(general.length, rules) : 1;
  // 770.9.1: la DPMS del grado suma solo los circuitos de uso general y especial.
  const gradeDpms = round2(general.reduce((s, c) => s + c.va, 0) * factor);
  // 770.9.3.1: la carga total suma además los circuitos dedicados a cargas específicas (770.9.2.1).
  const totalDpms = round2(gradeDpms + specific.reduce((s, c) => s + c.va, 0));
  return { perCircuit, factor, gradeDpms, totalDpms };
}

// ---------------------------------------------------------------------------------------------------------
// Pasos 5 a 8 — Protección, sección, caída de tensión y exigencia térmica
// ---------------------------------------------------------------------------------------------------------

export type LineResult = {
  id: string;
  kind: CircuitKind | 'seccional';
  ib: number; // corriente de proyecto I = S / U
  breakerA: number; // In
  sectionMm2: number;
  iz: number;
  /** IB ≤ In ≤ Iz (770.19.3) y In ≤ máximo del tipo de circuito (Tabla 770.7.I). */
  coordinationOk: boolean;
  voltageDropV: number;
  voltageDropPct: number;
  /** La app subió la sección para cumplir la caída de tensión (ej.: seccional 4 → 6 mm²). */
  sectionIncreasedForDrop: boolean;
  /** La app subió la sección para cumplir la exigencia térmica K²·S² ≥ I²t (ej.: IUG 1,5 → 2,5 mm² con térmica de 4,5 kA). */
  sectionIncreasedForThermal: boolean;
  /** K²·S² ≥ I²t. null = sin dato de I²t (clase 1, In > 32 A o poder de corte fuera de tabla): confirmar con el fabricante. */
  thermalOk: boolean | null;
  /** Paso 8 A: poder de corte adoptado (A) y si es un valor supuesto por la app. */
  breakingCapacityA: number;
  breakingCapacityAssumed: boolean;
  /** Poder de corte ≥ Icc. null = no se cargó la Icc. */
  breakingOk: boolean | null;
  /** Clase de limitación y curva adoptadas, y si son supuestas. */
  energyClass: EnergyClass;
  curve: Curve;
  classAssumed: boolean;
  /** I²t usado en el paso 8 B (A²s), su origen y la tabla de la que sale. null = sin dato. */
  i2t: number | null;
  i2tSource: 'fabricante' | 'tabla' | null;
  i2tRef: string | null;
  warnings: string[];
};

function iz(section: number, rules: InstallationRules): number {
  return rules.izTwoLoaded[String(section)] ?? 0;
}

function voltageDrop(lengthM: number, section: number, ib: number, cosPhi: number, rules: InstallationRules): number {
  // ΔU = 2 · ρ · L / S · I · cos φ (monofásico), como en los apuntes de clase.
  return (2 * rules.copperResistivity * lengthM) / section * ib * cosPhi;
}

function sizeLine(args: {
  id: string;
  kind: CircuitKind | 'seccional';
  ib: number;
  lengthM: number;
  cosPhi: number;
  breakerA?: number;
  sectionMm2?: number;
  minSection: number;
  maxProtection?: number;
  /** Límite de caída propio de esta línea (V); para circuitos terminales se verifica después el total. */
  ownDropLimitV?: number;
  iccA?: number;
  protection: ProtectionInput;
  rules: InstallationRules;
}): LineResult {
  const { rules } = args;
  const warnings: string[] = [];
  const breakerA = args.breakerA ?? rules.breakerRatings.find((r) => r >= args.ib) ?? rules.breakerRatings[rules.breakerRatings.length - 1];

  let section =
    args.sectionMm2 ??
    rules.sections.find((s) => s >= args.minSection && iz(s, rules) >= breakerA) ??
    rules.sections[rules.sections.length - 1];
  if (section < args.minSection) warnings.push(`La sección es menor que la mínima de la Tabla 770.13.I (${args.minSection} mm²).`);

  let increased = false;
  if (args.ownDropLimitV !== undefined && args.sectionMm2 === undefined) {
    while (voltageDrop(args.lengthM, section, args.ib, args.cosPhi, rules) > args.ownDropLimitV) {
      const next = rules.sections.find((s) => s > section);
      if (!next) break;
      section = next;
      increased = true;
    }
  }

  // Paso 8 A — poder de corte: el técnico lo carga; si no, el menor normalizado ≥ Icc (o el menor de la lista sin Icc).
  const { iccA, protection } = args;
  const breakingAssumed = protection.breakingCapacityA === undefined;
  const breakingCapacityA =
    protection.breakingCapacityA ??
    rules.breakingCapacities.find((c) => iccA === undefined || c >= iccA) ??
    rules.breakingCapacities[rules.breakingCapacities.length - 1];
  const breakingOk = iccA === undefined ? null : breakingCapacityA >= iccA;
  if (breakingOk === false) {
    warnings.push(`El poder de corte (${breakingCapacityA} A) es menor que la Icc (${iccA} A): elegir una protección de mayor poder de corte.`);
  }

  // Paso 8 B — exigencia térmica: el I²t es el del fabricante si lo cargó el técnico; si no, el de la tabla.
  const energyClass = protection.energyClass ?? rules.protectionDefaults.energyClass;
  const curve = protection.curve ?? rules.protectionDefaults.curve;
  const classAssumed = protection.energyClass === undefined;
  let i2t: number | null = null;
  let i2tSource: 'fabricante' | 'tabla' | null = null;
  let i2tRef: string | null = null;
  if (protection.i2tOverride !== undefined) {
    i2t = protection.i2tOverride;
    i2tSource = 'fabricante';
  } else {
    const fromTable = i2tLimit(breakerA, breakingCapacityA, energyClass, curve, rules);
    if (fromTable) {
      i2t = fromTable.value;
      i2tSource = 'tabla';
      i2tRef = fromTable.ref;
    }
  }

  // Si no verifica y el técnico no fijó la sección, se sube a la siguiente normalizada (igual que con la caída).
  let increasedForThermal = false;
  if (i2t !== null && args.sectionMm2 === undefined) {
    while (rules.thermal.k ** 2 * section ** 2 < i2t) {
      const next = rules.sections.find((s) => s > section);
      if (!next) break;
      section = next;
      increasedForThermal = true;
    }
  }

  const izValue = iz(section, rules);
  const coordinationOk =
    args.ib <= breakerA && breakerA <= izValue && (args.maxProtection === undefined || breakerA <= args.maxProtection);
  if (!coordinationOk) warnings.push('No cumple IB ≤ In ≤ Iz o supera la protección máxima del tipo de circuito.');

  const drop = voltageDrop(args.lengthM, section, args.ib, args.cosPhi, rules);
  const thermalOk = i2t === null ? null : rules.thermal.k ** 2 * section ** 2 >= i2t;
  if (thermalOk === false) warnings.push('No verifica la exigencia térmica K²·S² ≥ I²t.');
  if (thermalOk === null) warnings.push('Sin dato de I²t para esta protección (clase 1, más de 32 A o poder de corte fuera de tabla): confirmar con el fabricante.');

  return {
    id: args.id,
    kind: args.kind,
    ib: round2(args.ib),
    breakerA,
    sectionMm2: section,
    iz: izValue,
    coordinationOk,
    voltageDropV: round3(drop),
    voltageDropPct: round2((drop / rules.voltage) * 100),
    sectionIncreasedForDrop: increased,
    sectionIncreasedForThermal: increasedForThermal,
    thermalOk,
    breakingCapacityA,
    breakingCapacityAssumed: breakingAssumed,
    breakingOk,
    energyClass,
    curve,
    classAssumed,
    i2t,
    i2tSource,
    i2tRef,
    warnings,
  };
}

export type ProjectResult = ReturnType<typeof calculateProject>;

/** Corre los 8 pasos. Cualquier valor que el técnico fije (protección, sección) se respeta y se verifica. */
export function calculateProject(input: ProjectInput, rules = DEFAULT_RULES) {
  const surface = applicationSurface(input.rooms, input.wallsM2 ?? 0);
  const grade = electrificationGrade(surface.sla, rules);
  const minimums = minimumPoints(input.rooms, grade);
  const dem = demand(input, rules);

  const warnings: string[] = [];
  const count = (k: CircuitKind) => input.circuits.filter((c) => c.kind === k).length;
  if (count('IUG') < rules.minCircuits[grade].IUG) warnings.push(`El grado ${grade} pide al menos ${rules.minCircuits[grade].IUG} circuito(s) IUG.`);
  if (count('TUG') < rules.minCircuits[grade].TUG) warnings.push(`El grado ${grade} pide al menos ${rules.minCircuits[grade].TUG} circuito(s) TUG.`);
  const pointsOf = (k: CircuitKind) => input.circuits.filter((c) => c.kind === k).reduce((s, c) => s + c.points, 0);
  if (pointsOf('IUG') < minimums.IUG) warnings.push(`Faltan bocas IUG: hay ${pointsOf('IUG')} y el mínimo es ${minimums.IUG}.`);
  if (pointsOf('TUG') < minimums.TUG) warnings.push(`Faltan bocas TUG: hay ${pointsOf('TUG')} y el mínimo es ${minimums.TUG}.`);
  for (const c of input.circuits) {
    if (c.kind !== 'ACU' && c.points > rules.circuitLimits[c.kind].maxPoints) {
      warnings.push(`El circuito ${c.id} supera las ${rules.circuitLimits[c.kind].maxPoints} bocas de la Tabla 770.7.I.`);
    }
  }

  const v = rules.voltage;
  const feederDropLimit = (rules.maxVoltageDropPct.seccional / 100) * v;
  const feeder = sizeLine({
    id: 'seccional',
    kind: 'seccional',
    ib: dem.totalDpms / v,
    lengthM: input.feeder.lengthM,
    cosPhi: input.feeder.cosPhi ?? rules.cosPhi,
    breakerA: input.feeder.breakerA,
    sectionMm2: input.feeder.sectionMm2,
    minSection: rules.minSection.seccional,
    ownDropLimitV: feederDropLimit,
    iccA: input.iccA,
    protection: input.feeder,
    rules,
  });
  if (feeder.voltageDropV > feederDropLimit) {
    feeder.warnings.push(`La caída en la seccional supera el ${rules.maxVoltageDropPct.seccional} % recomendado (${round2(feederDropLimit)} V).`);
  }

  const circuits = input.circuits.map((c) => {
    const demandVa = dem.perCircuit.find((p) => p.id === c.id)?.va ?? 0;
    const limitPct = c.kind === 'ACU' || c.kind === 'TUE' ? rules.maxVoltageDropPct.especifico : rules.maxVoltageDropPct.general;
    const totalLimitV = (limitPct / 100) * v;
    const line = sizeLine({
      id: c.id,
      kind: c.kind,
      ib: demandVa / v,
      lengthM: c.lengthM,
      cosPhi: c.cosPhi ?? rules.cosPhi,
      breakerA: c.breakerA,
      sectionMm2: c.sectionMm2,
      minSection: rules.minSection[c.kind],
      maxProtection: c.kind === 'ACU' ? undefined : rules.circuitLimits[c.kind].maxProtection,
      // Para el circuito terminal se busca que el TOTAL (seccional + circuito) quede dentro del límite.
      ownDropLimitV: Math.min((rules.maxVoltageDropPct.circuitoTerminal / 100) * v, Math.max(0, totalLimitV - feeder.voltageDropV)),
      iccA: input.iccA,
      protection: c,
      rules,
    });
    const totalDropV = round3(feeder.voltageDropV + line.voltageDropV);
    const ownLimitV = (rules.maxVoltageDropPct.circuitoTerminal / 100) * v;
    if (line.voltageDropV > ownLimitV) line.warnings.push(`La caída propia del circuito (${line.voltageDropV} V) supera el ${rules.maxVoltageDropPct.circuitoTerminal} % (${round2(ownLimitV)} V).`);
    const totalDropOk = totalDropV <= totalLimitV;
    if (!totalDropOk) line.warnings.push(`La caída total (${totalDropV} V) supera el ${limitPct} % (${round2(totalLimitV)} V).`);
    return { ...line, demandVa, totalDropV, totalDropLimitV: round2(totalLimitV), totalDropOk };
  });

  // Interruptor diferencial: su capacidad de cortocircuito (dato del fabricante) debe cubrir la Icc.
  const rcdType = input.rcd?.type ?? 'A';
  const rcdShortCircuitA = input.rcd?.shortCircuitA;
  const rcdOk = input.iccA === undefined || rcdShortCircuitA === undefined ? null : rcdShortCircuitA >= input.iccA;
  const rcd = { type: rcdType, shortCircuitA: rcdShortCircuitA ?? null, iccA: input.iccA ?? null, ok: rcdOk };
  if (rcdOk === false) {
    warnings.push(`El diferencial aguanta ${rcdShortCircuitA} A de cortocircuito y la Icc es ${input.iccA} A: elegir un diferencial con capacidad suficiente o confirmar con el fabricante la protección de respaldo.`);
  } else if (input.iccA !== undefined && rcdShortCircuitA === undefined) {
    warnings.push('Cargá la capacidad de cortocircuito del diferencial (ficha del fabricante) para verificarla contra la Icc.');
  }

  // Valores que la app supuso por falta de dato: se muestran en la memoria para confirmarlos con el fabricante.
  const assumptions: string[] = [];
  for (const l of [feeder, ...circuits]) {
    const parts: string[] = [];
    if (l.breakingCapacityAssumed) parts.push(`poder de corte ${l.breakingCapacityA} A`);
    if (l.classAssumed && l.i2tSource === 'tabla') parts.push(`clase ${l.energyClass}, curva ${l.curve}`);
    if (parts.length > 0) assumptions.push(`${l.id === 'seccional' ? 'Seccional' : l.id}: ${parts.join(', ')} (supuesto: confirmar con la ficha del fabricante).`);
  }

  // Paso 6 — Canalizaciones y conductores: caño y conductor de cada línea; el PE iguala a la fase y no baja del mínimo.
  const conduits = [
    { line: feeder, label: 'Seccional', conduit: rules.conduit.feeder },
    ...circuits.map((c) => ({ line: c, label: c.id, conduit: rules.conduit.circuits })),
  ].map(({ line, label, conduit }) => {
    const pe = Math.max(line.sectionMm2, rules.minSection.pe);
    if (line.sectionMm2 > 16) warnings.push(`${label}: con más de 16 mm² la sección del conductor de protección (PE) se verifica aparte (770.12.3.3.1).`);
    return { id: label, conduit: `${rules.conduit.standard}, ${conduit}`, conductorStandard: rules.conduit.conductorStandard, phaseNeutralMm2: line.sectionMm2, peMm2: pe };
  });

  // Paso 9 — Ubicación del tablero seccional (770.20.4): lo confirma el técnico, la app no lo puede medir.
  const loc = input.boardLocation ?? {};
  const frontOk = loc.frontClearM === undefined ? null : loc.frontClearM >= rules.boardLocation.recommendedFrontClearM;
  const boardChecks = [
    { label: 'Accesible', ref: '770.20.4.1', ok: loc.accessible ?? null },
    { label: 'No cubierto ni oculto (fuera del giro de puertas)', ref: '770.20.4.1', ok: loc.notHidden ?? null },
    { label: `Espacio libre al frente (recomendado ${String(rules.boardLocation.recommendedFrontClearM).replace('.', ',')} m)`, ref: '770.20.4.2', ok: frontOk },
  ];
  const boardOk = boardChecks.some((c) => c.ok === false) ? false : boardChecks.every((c) => c.ok === true) ? true : null;
  if (boardOk === false) warnings.push('La ubicación del tablero seccional no cumple 770.20.4: moverlo a un lugar accesible, a la vista y con espacio libre al frente.');
  const boardLocation = { checks: boardChecks, ok: boardOk, frontClearM: loc.frontClearM ?? null };

  return { surface, grade, minimums, demand: dem, feeder, circuits, conduits, boardLocation, rcd, assumptions, iccA: input.iccA ?? null, warnings };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
