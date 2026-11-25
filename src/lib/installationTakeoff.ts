import type { ProjectInput, ProjectResult } from './installationProject';

/**
 * Cómputo de materiales de un proyecto (plan-proyecto-instalacion.md, Fase 3B.1).
 *
 * Arma una lista de materiales SUGERIDA a partir de los circuitos y sus secciones calculadas. Es una estimación con
 * reglas simples y declaradas (cada renglón dice cuál usó): el técnico siempre la ajusta con las medidas del plano.
 * No tiene precios; los precios van aparte (listas del técnico).
 */

export type TakeoffOptions = {
  /** Desperdicio de cable (0,10 = 10 %). */
  wasteRate: number;
  /** Largo de una tira de caño, en metros. */
  pipeStripM: number;
  /** Cantidad de puntos de comando (llaves). Por defecto, uno por boca de luz. */
  switches?: number;
  /** Llaves de combinación (una luz comandada desde dos puntos). Por defecto 0: el técnico las carga si las hay. */
  combinationSwitches?: number;
  /** Cable de puesta a tierra (bornera a jabalina), en metros. */
  groundCableM: number;
  /** Sección del cable de puesta a tierra (mm²). */
  groundCableMm2: number;
};

export const DEFAULT_TAKEOFF_OPTIONS: TakeoffOptions = {
  wasteRate: 0.1,
  pipeStripM: 3,
  groundCableM: 6,
  /** Sección del cable de puesta a tierra: igual al PE y nunca menor a 4 mm² (AEA 90364-7-770, 770.14.4.4 y Tabla 770.14.I). */
  groundCableMm2: 4,
};

export type TakeoffGroup = 'Conductores' | 'Canalizaciones' | 'Accesorios de canalización' | 'Cajas' | 'Mecanismos' | 'Luminarias' | 'Tablero y protecciones' | 'Puesta a tierra' | 'Insumos menores';

export type TakeoffLine = {
  /** Identificador estable: sirve para guardar precios y cantidades editadas. */
  key: string;
  group: TakeoffGroup;
  description: string;
  unit: 'm' | 'tira' | 'u' | 'bolsa';
  quantity: number;
  /** Cómo se estimó la cantidad (se muestra al técnico). */
  basis: string;
  /** La línea se muestra aunque la cantidad sea 0 (para que el técnico la complete). */
  keepZero?: boolean;
};

const GROUP_ORDER: TakeoffGroup[] = ['Conductores', 'Canalizaciones', 'Accesorios de canalización', 'Cajas', 'Mecanismos', 'Luminarias', 'Tablero y protecciones', 'Puesta a tierra', 'Insumos menores'];
const mm = (n: number) => String(n).replace('.', ',');

export function computeTakeoff(input: ProjectInput, result: ProjectResult, options: Partial<TakeoffOptions> = {}): TakeoffLine[] {
  const o = { ...DEFAULT_TAKEOFF_OPTIONS, ...options };
  const lines: TakeoffLine[] = [];
  const add = (l: TakeoffLine) => { if (l.quantity > 0 || l.keepZero) lines.push(l); };
  const pts = (...kinds: string[]) => input.circuits.filter((c) => kinds.includes(c.kind)).reduce((s, c) => s + c.points, 0);

  // Conductores: 3 por circuito (fase, neutro y tierra) × largo, agrupados por sección, + desperdicio.
  const cableBySection = new Map<number, number>();
  result.circuits.forEach((r, i) => {
    cableBySection.set(r.sectionMm2, (cableBySection.get(r.sectionMm2) ?? 0) + 3 * input.circuits[i].lengthM);
  });
  cableBySection.set(result.feeder.sectionMm2, (cableBySection.get(result.feeder.sectionMm2) ?? 0) + 3 * input.feeder.lengthM);
  [...cableBySection.entries()].sort((a, b) => a[0] - b[0]).forEach(([section, meters]) => {
    add({ key: `cable-${section}`, group: 'Conductores', description: `Cable unipolar ${mm(section)} mm² IRAM-NM 247-3`, unit: 'm', quantity: Math.ceil(meters * (1 + o.wasteRate)), basis: `3 conductores (F, N, PE) × largo de cada línea de ${mm(section)} mm² + ${Math.round(o.wasteRate * 100)} % de desperdicio` });
  });

  // Canalización: tiras de RSP 20 para los circuitos y RSP 25 para la seccional.
  const circuitMeters = input.circuits.reduce((s, c) => s + c.lengthM, 0);
  const strips20 = Math.ceil(circuitMeters / o.pipeStripM);
  const strips25 = Math.ceil(input.feeder.lengthM / o.pipeStripM);
  add({ key: 'pipe-20', group: 'Canalizaciones', description: `Caño PVC rígido semipesado RSP 20 mm, tira ${o.pipeStripM} m`, unit: 'tira', quantity: strips20, basis: `largo de los circuitos (${circuitMeters} m) / ${o.pipeStripM} m, hacia arriba` });
  add({ key: 'pipe-25', group: 'Canalizaciones', description: `Caño PVC rígido semipesado RSP 25 mm, tira ${o.pipeStripM} m`, unit: 'tira', quantity: strips25, basis: `largo de la seccional (${input.feeder.lengthM} m) / ${o.pipeStripM} m, hacia arriba` });

  // Cajas y mecanismos.
  const lightPoints = pts('IUG', 'IUE');
  const switches = o.switches ?? lightPoints;
  const outletPoints = pts('TUG', 'TUE');
  const acPoints = pts('ACU');
  const rectBoxes = outletPoints + acPoints + switches + (o.combinationSwitches ?? 0);
  const boxes = lightPoints + rectBoxes;
  add({ key: 'box-oct', group: 'Cajas', description: 'Caja octogonal grande plástica (bocas de luz)', unit: 'u', quantity: lightPoints, basis: 'una por boca de iluminación (IUG + IUE)' });
  add({ key: 'box-rect', group: 'Cajas', description: 'Caja rectangular 5 × 10 cm (llaves y tomas)', unit: 'u', quantity: rectBoxes, basis: 'una por toma (TUG, TUE, ACU) y por llave' });

  add({ key: 'conn-20', group: 'Accesorios de canalización', description: 'Conector de caño a caja, 20 mm', unit: 'u', quantity: boxes * 2, basis: '2 por caja (entrada y salida)' });
  add({ key: 'conn-25', group: 'Accesorios de canalización', description: 'Conector de caño a caja, 25 mm', unit: 'u', quantity: 2, basis: '2 en el tablero (seccional)' });
  add({ key: 'coupling-20', group: 'Accesorios de canalización', description: 'Unión caño-caño (cupla), 20 mm', unit: 'u', quantity: strips20, basis: '1 por tira de caño de 20 mm' });
  add({ key: 'coupling-25', group: 'Accesorios de canalización', description: 'Unión caño-caño (cupla), 25 mm', unit: 'u', quantity: strips25, basis: '1 por tira de caño de 25 mm' });
  add({ key: 'bend-20', group: 'Accesorios de canalización', description: 'Curva, 20 mm', unit: 'u', quantity: boxes, basis: '1 por caja' });
  add({ key: 'bend-25', group: 'Accesorios de canalización', description: 'Curva, 25 mm', unit: 'u', quantity: 2, basis: '2 en la seccional' });

  add({ key: 'mech-switch', group: 'Mecanismos', description: 'Módulo interruptor de un punto', unit: 'u', quantity: switches, basis: 'un punto de comando por boca de luz (editable)' });
  add({ key: 'mech-comb', group: 'Mecanismos', description: 'Módulo interruptor de combinación', unit: 'u', quantity: o.combinationSwitches ?? 0, basis: 'luz comandada desde dos puntos: cargá cuántas hay (entre ambas van 3 conductores)', keepZero: true });
  add({ key: 'mech-outlet-10', group: 'Mecanismos', description: 'Módulo tomacorriente 2P+T 10 A', unit: 'u', quantity: outletPoints, basis: 'una por boca TUG/TUE' });
  add({ key: 'mech-outlet-20', group: 'Mecanismos', description: 'Módulo tomacorriente 2P+T 20 A (carga única)', unit: 'u', quantity: acPoints, basis: 'una por boca de carga única (ACU)' });
  add({ key: 'mech-cover', group: 'Mecanismos', description: 'Tapa con bastidor', unit: 'u', quantity: rectBoxes, basis: 'una por caja rectangular' });
  add({ key: 'luminaire', group: 'Luminarias', description: 'Plafón LED de aplicar', unit: 'u', quantity: lightPoints, basis: 'uno por boca de iluminación' });

  // Protecciones: una por circuito (y la de la seccional), agrupadas por corriente, poder de corte y curva.
  const breakers = new Map<string, { description: string; qty: number; assumed: boolean }>();
  for (const l of [...result.circuits, result.feeder]) {
    const kA = mm(l.breakingCapacityA / 1000);
    const key = `itm-${l.breakerA}-${l.breakingCapacityA}-${l.curve}`;
    const cur = breakers.get(key) ?? { description: `Interruptor termomagnético 2P ${l.breakerA} A curva ${l.curve} ${kA} kA`, qty: 0, assumed: l.breakingCapacityAssumed };
    cur.qty += 1;
    breakers.set(key, cur);
  }
  breakers.forEach((b, key) => add({ key, group: 'Tablero y protecciones', description: b.description, unit: 'u', quantity: b.qty, basis: `una por circuito de esa corriente${b.assumed ? ' (poder de corte supuesto: confirmar)' : ''}` }));
  add({ key: 'rcd', group: 'Tablero y protecciones', description: `Interruptor diferencial 2P ≥ ${result.feeder.breakerA} A, 30 mA, tipo ${result.rcd.type}${result.iccA ? `, cortocircuito ≥ ${mm(result.iccA / 1000)} kA` : ''}`, unit: 'u', quantity: 1, basis: 'uno general' });
  add({ key: 'comb', group: 'Tablero y protecciones', description: 'Peine de conexión bipolar', unit: 'u', quantity: 1, basis: 'uno para el tablero' });

  add({ key: 'ground-bar', group: 'Puesta a tierra', description: 'Barra / bornera de puesta a tierra', unit: 'u', quantity: 1, basis: 'una en el tablero' });
  add({ key: 'ground-rod', group: 'Puesta a tierra', description: 'Jabalina lisa 1/2" × 1,5 m', unit: 'u', quantity: 1, basis: 'una' });
  add({ key: 'ground-cable', group: 'Puesta a tierra', description: `Cable unipolar ${mm(o.groundCableMm2)} mm² verde/amarillo (PAT)`, unit: 'm', quantity: o.groundCableM, basis: 'de la bornera a la jabalina (editable)' });

  add({ key: 'tape', group: 'Insumos menores', description: 'Cinta aisladora PVC 19 mm × 20 m', unit: 'u', quantity: 2, basis: 'estimado' });
  add({ key: 'ties', group: 'Insumos menores', description: 'Precintos 200 mm, bolsa de 100 u', unit: 'bolsa', quantity: 1, basis: 'estimado' });

  return lines.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}
