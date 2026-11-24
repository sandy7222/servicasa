import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Plus, Printer, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  calculateProject,
  minimumPoints,
  applicationSurface,
  electrificationGrade,
  DEFAULT_RULES,
  type CircuitInput,
  type CircuitKind,
  type Curve,
  type EnergyClass,
  type ProjectInput,
  type ProtectionInput,
  type Room,
  type RoomType,
} from '../../lib/installationProject';

/**
 * "Proyecto de instalación" (plan-proyecto-instalacion.md, Fase 2): herramienta OPCIONAL para técnicos de
 * Electricidad. Calcula una instalación domiciliaria según AEA 90364-7-770 con el motor de
 * src/lib/installationProject.ts. Es una guía: el técnico matriculado verifica y es responsable del proyecto.
 *
 * Esta primera versión guarda el proyecto en el dispositivo (localStorage). Guardarlo en la cuenta, adjuntar el
 * plano y "Pasar a presupuesto" son los pasos siguientes del plan.
 */

const STORAGE_KEY = 'tu:installation-project:v1';

const ROOM_TYPES: Array<[RoomType, string]> = [
  ['estar', 'Estar / comedor / escritorio'],
  ['dormitorio', 'Dormitorio'],
  ['cocina', 'Cocina'],
  ['bano', 'Baño'],
  ['vestibulo', 'Vestíbulo / hall / garaje'],
  ['pasillo', 'Pasillo'],
  ['lavadero', 'Lavadero'],
  ['balcon', 'Balcón / galería (semicubierto)'],
];

const CIRCUIT_KINDS: Array<[CircuitKind, string]> = [
  ['IUG', 'IUG — Iluminación uso general'],
  ['TUG', 'TUG — Tomacorrientes uso general'],
  ['IUE', 'IUE — Iluminación uso especial'],
  ['TUE', 'TUE — Tomacorrientes uso especial'],
  ['ACU', 'ACU — Carga única (ej. aire acondicionado)'],
];

const GRADE_LABEL = { minimo: 'Mínimo', medio: 'Medio', elevado: 'Elevado', superior: 'Superior' } as const;

type Draft = { name: string } & ProjectInput;

const EMPTY: Draft = {
  name: '',
  rooms: [{ name: 'Ambiente 1', type: 'dormitorio', areaM2: 12 }],
  wallsM2: 0,
  circuits: [],
  feeder: { lengthM: 10 },
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Draft) };
  } catch {
    /* sin almacenamiento: arranca vacío */
  }
  return EMPTY;
}

const num = (value: string): number => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const optNum = (value: string): number | undefined => (value.trim() === '' ? undefined : num(value));
const fmt = (n: number, digits = 2) => n.toLocaleString('es-AR', { maximumFractionDigits: digits });

/**
 * Datos de cortocircuito de una protección (paso 8): el técnico los toma de la ficha del fabricante. Si los deja en
 * "auto", la app usa valores por defecto y los avisa como supuestos en la memoria.
 */
const ProtectionFields: React.FC<{
  value: ProtectionInput;
  onChange: (patch: Partial<ProtectionInput>) => void;
  className: string;
  label: string;
}> = ({ value, onChange, className, label }) => (
  <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
    <label className="text-[10px] text-slate-500">{label}: poder de corte A
      <select className={className} value={value.breakingCapacityA ?? ''} onChange={(e) => onChange({ breakingCapacityA: e.target.value === '' ? undefined : Number(e.target.value) })}>
        <option value="">auto (≥ Icc)</option>
        {DEFAULT_RULES.breakingCapacities.map((c) => <option key={c} value={c}>{c.toLocaleString('es-AR')}</option>)}
      </select>
    </label>
    <label className="text-[10px] text-slate-500">Clase de limitación
      <select className={className} value={value.energyClass ?? ''} onChange={(e) => onChange({ energyClass: e.target.value === '' ? undefined : (Number(e.target.value) as EnergyClass) })}>
        <option value="">auto (3)</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
    </label>
    <label className="text-[10px] text-slate-500">Curva
      <select className={className} value={value.curve ?? ''} onChange={(e) => onChange({ curve: e.target.value === '' ? undefined : (e.target.value as Curve) })}>
        <option value="">auto (C)</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
    </label>
    <label className="text-[10px] text-slate-500">I²t del fabricante (A²s)
      <input className={className} inputMode="decimal" value={value.i2tOverride ?? ''} placeholder="tabla" onChange={(e) => onChange({ i2tOverride: e.target.value.trim() === '' ? undefined : Number(e.target.value.replace(',', '.')) || undefined })} />
    </label>
  </div>
);

const Mark: React.FC<{ ok: boolean | null; label: string }> = ({ ok, label }) =>
  ok === null ? <span className="text-slate-400" aria-label={`${label}: sin dato`}>—</span>
  : ok ? <CheckCircle2 className="inline w-4 text-emerald-600" aria-label={`${label}: verifica`} />
  : <AlertTriangle className="inline w-4 text-rose-600" aria-label={`${label}: no verifica`} />;

export const InstallationProjectView: React.FC = () => {
  const { navigate } = useApp();
  const [draft, setDraft] = useState<Draft>(loadDraft);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignorar */
    }
  }, [draft]);

  const result = useMemo(() => (draft.circuits.length > 0 ? calculateProject(draft) : null), [draft]);
  const preview = useMemo(() => {
    const surface = applicationSurface(draft.rooms, draft.wallsM2 ?? 0);
    const grade = electrificationGrade(surface.sla);
    return { surface, grade, minimums: minimumPoints(draft.rooms, grade) };
  }, [draft.rooms, draft.wallsM2]);

  const setRoom = (i: number, patch: Partial<Room>) =>
    setDraft((d) => ({ ...d, rooms: d.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const setCircuit = (i: number, patch: Partial<CircuitInput>) =>
    setDraft((d) => ({ ...d, circuits: d.circuits.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  /** Arma los circuitos mínimos del grado con las bocas mínimas de la norma (el técnico después ajusta). */
  const suggestCircuits = () => {
    const { minimums } = preview;
    const circuits: CircuitInput[] = [];
    for (let i = 0; i < minimums.circuits.IUG; i++) {
      circuits.push({ id: `IUG${i + 1}`, kind: 'IUG', points: i === 0 ? minimums.IUG : 1, lengthM: 10 });
    }
    for (let i = 0; i < minimums.circuits.TUG; i++) {
      circuits.push({ id: `TUG${i + 1}`, kind: 'TUG', points: i === 0 ? minimums.TUG : 1, lengthM: 10 });
    }
    setDraft((d) => ({ ...d, circuits }));
  };

  const input = 'w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs';

  return (
    <main className="min-h-screen bg-slate-100/70 dark:bg-slate-900/80 pb-12 print:bg-white">
      <div className="bg-[#0F172A] text-white border-b border-slate-800 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-5 flex gap-3 items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center"><Calculator className="w-5" /></div>
            <div>
              <h1 className="font-bold">Proyecto de instalación</h1>
              <p className="text-xs text-slate-400">Cálculo de instalación domiciliaria según AEA 90364-7-770.</p>
            </div>
          </div>
          <button onClick={() => navigate('/technician')} aria-label="Volver a la Terminal de Campo" className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 text-[11px] text-amber-900 dark:text-amber-200">
          Cálculo orientativo según AEA 90364-7-770 (Ed. 2026). El técnico matriculado verifica los resultados y es responsable del proyecto. Podés corregir cualquier valor.
        </p>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2 print:hidden">
          <label className="block text-xs font-bold" htmlFor="ip-name">Nombre del proyecto</label>
          <input id="ip-name" className={input} value={draft.name} placeholder="Ej.: Depto. 3er piso — Pérez" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </section>

        {/* 1. Ambientes */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 print:hidden">
          <h2 className="text-sm font-bold">1. Ambientes</h2>
          {draft.rooms.map((room, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[2fr_2fr_1fr_1fr_auto_auto] gap-2 items-end rounded-lg bg-slate-50 dark:bg-slate-950 p-2">
              <label className="text-[10px] text-slate-500">Nombre<input className={input} value={room.name} onChange={(e) => setRoom(i, { name: e.target.value })} /></label>
              <label className="text-[10px] text-slate-500">Tipo
                <select className={input} value={room.type} onChange={(e) => setRoom(i, { type: e.target.value as RoomType, semiCovered: e.target.value === 'balcon' ? true : room.semiCovered })}>
                  {ROOM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-slate-500">m²<input className={input} inputMode="decimal" value={room.areaM2} onChange={(e) => setRoom(i, { areaM2: num(e.target.value) })} /></label>
              <label className="text-[10px] text-slate-500">Largo m<input className={input} inputMode="decimal" value={room.lengthM ?? ''} placeholder="opc." onChange={(e) => setRoom(i, { lengthM: optNum(e.target.value) })} /></label>
              <label className="text-[10px] text-slate-500 flex items-center gap-1 pb-1.5"><input type="checkbox" checked={Boolean(room.semiCovered)} onChange={(e) => setRoom(i, { semiCovered: e.target.checked })} />Semicub.</label>
              <button type="button" aria-label="Quitar ambiente" onClick={() => setDraft((d) => ({ ...d, rooms: d.rooms.filter((_, j) => j !== i) }))} className="pb-1.5 text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" onClick={() => setDraft((d) => ({ ...d, rooms: [...d.rooms, { name: `Ambiente ${d.rooms.length + 1}`, type: 'dormitorio', areaM2: 10 }] }))} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-teal-700"><Plus className="w-3.5" />Agregar ambiente</button>
            <label className="text-[10px] text-slate-500 w-40">Muros y tabiques (m²)<input className={input} inputMode="decimal" value={draft.wallsM2 ?? 0} onChange={(e) => setDraft((d) => ({ ...d, wallsM2: num(e.target.value) }))} /></label>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            SLA = {fmt(preview.surface.covered)} + {fmt(preview.surface.semiCovered)} / 2 = <strong>{fmt(preview.surface.sla)} m²</strong> → grado <strong>{GRADE_LABEL[preview.grade]}</strong>. Mínimo: {preview.minimums.circuits.IUG} circuito(s) IUG y {preview.minimums.circuits.TUG} TUG; {preview.minimums.IUG} bocas IUG y {preview.minimums.TUG} TUG.
          </p>
        </section>

        {/* 3. Circuitos */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">2. Circuitos y línea seccional</h2>
            <button type="button" onClick={suggestCircuits} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white"><Sparkles className="w-3.5" />Proponer circuitos mínimos</button>
          </div>
          {draft.circuits.map((c, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-end rounded-lg bg-slate-50 dark:bg-slate-950 p-2">
              <label className="text-[10px] text-slate-500">Nombre<input className={input} value={c.id} onChange={(e) => setCircuit(i, { id: e.target.value })} /></label>
              <label className="text-[10px] text-slate-500">Tipo
                <select className={input} value={c.kind} onChange={(e) => setCircuit(i, { kind: e.target.value as CircuitKind })}>
                  {CIRCUIT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-slate-500">Bocas<input className={input} inputMode="numeric" value={c.points} onChange={(e) => setCircuit(i, { points: Math.max(0, Math.round(num(e.target.value))) })} /></label>
              <label className="text-[10px] text-slate-500">Potencia W{c.kind === 'ACU' ? '' : ' (no aplica)'}<input className={input} inputMode="decimal" disabled={c.kind !== 'ACU'} value={c.loadVa ?? ''} onChange={(e) => setCircuit(i, { loadVa: optNum(e.target.value) })} /></label>
              <label className="text-[10px] text-slate-500">Largo m<input className={input} inputMode="decimal" value={c.lengthM} onChange={(e) => setCircuit(i, { lengthM: num(e.target.value) })} /></label>
              <label className="text-[10px] text-slate-500">cos φ<input className={input} inputMode="decimal" value={c.cosPhi ?? ''} placeholder="0,85" onChange={(e) => setCircuit(i, { cosPhi: optNum(e.target.value) })} /></label>
              <label className="text-[10px] text-slate-500">ITM A<input className={input} inputMode="numeric" value={c.breakerA ?? ''} placeholder="auto" onChange={(e) => setCircuit(i, { breakerA: optNum(e.target.value) })} /></label>
              <label className="text-[10px] text-slate-500">Sección mm²<input className={input} inputMode="decimal" value={c.sectionMm2 ?? ''} placeholder="auto" onChange={(e) => setCircuit(i, { sectionMm2: optNum(e.target.value) })} /></label>
              <button type="button" aria-label="Quitar circuito" onClick={() => setDraft((d) => ({ ...d, circuits: d.circuits.filter((_, j) => j !== i) }))} className="pb-1.5 text-rose-600"><Trash2 className="w-4 h-4" /></button>
              <ProtectionFields label="ITM" value={c} onChange={(patch) => setCircuit(i, patch)} className={input} />
            </div>
          ))}
          <button type="button" onClick={() => setDraft((d) => ({ ...d, circuits: [...d.circuits, { id: `CT${d.circuits.length + 1}`, kind: 'ACU', points: 1, loadVa: 2600, lengthM: 5, cosPhi: 0.85 }] }))} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-teal-700"><Plus className="w-3.5" />Agregar circuito</button>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            <label className="text-[10px] text-slate-500">Seccional: largo m<input className={input} inputMode="decimal" value={draft.feeder.lengthM} onChange={(e) => setDraft((d) => ({ ...d, feeder: { ...d.feeder, lengthM: num(e.target.value) } }))} /></label>
            <label className="text-[10px] text-slate-500">ITM A<input className={input} inputMode="numeric" value={draft.feeder.breakerA ?? ''} placeholder="auto" onChange={(e) => setDraft((d) => ({ ...d, feeder: { ...d.feeder, breakerA: optNum(e.target.value) } }))} /></label>
            <label className="text-[10px] text-slate-500">Sección mm²<input className={input} inputMode="decimal" value={draft.feeder.sectionMm2 ?? ''} placeholder="auto" onChange={(e) => setDraft((d) => ({ ...d, feeder: { ...d.feeder, sectionMm2: optNum(e.target.value) } }))} /></label>
            <ProtectionFields label="Seccional" value={draft.feeder} onChange={(patch) => setDraft((d) => ({ ...d, feeder: { ...d.feeder, ...patch } }))} className={input} />
          </div>
        </section>

        {/* Cortocircuito (paso 8 A) */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2 print:hidden">
          <h2 className="text-sm font-bold">3. Cortocircuito</h2>
          <p className="text-[11px] text-slate-500">La corriente de cortocircuito (Icc) la informa la distribuidora para el punto de conexión. Con ese dato se verifica que cada protección pueda cortarla. Sin Icc, esa verificación queda "sin dato".</p>
          <div className="grid grid-cols-3 gap-2 max-w-xl">
            <label className="text-[10px] text-slate-500">Icc del suministro (A)<input className={input} inputMode="decimal" value={draft.iccA ?? ''} placeholder="sin dato" onChange={(e) => setDraft((d) => ({ ...d, iccA: optNum(e.target.value) }))} /></label>
            <label className="text-[10px] text-slate-500">Diferencial: capacidad de cortocircuito (A)<input className={input} inputMode="decimal" value={draft.rcd?.shortCircuitA ?? ''} placeholder="ficha" onChange={(e) => setDraft((d) => ({ ...d, rcd: { ...d.rcd, shortCircuitA: optNum(e.target.value) } }))} /></label>
            <label className="text-[10px] text-slate-500">Diferencial: tipo
              <select className={input} value={draft.rcd?.type ?? 'A'} onChange={(e) => setDraft((d) => ({ ...d, rcd: { ...d.rcd, type: e.target.value as 'A' | 'AC' } }))}>
                <option value="A">A</option>
                <option value="AC">AC</option>
              </select>
            </label>
          </div>
        </section>

        {/* Resultados */}
        {!result ? (
          <p className="text-xs text-slate-500 print:hidden">Cargá los ambientes y tocá "Proponer circuitos mínimos" (o agregalos a mano) para ver el cálculo.</p>
        ) : (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4 text-xs print:border-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Memoria de cálculo{draft.name ? ` — ${draft.name}` : ''}</h2>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-bold print:hidden"><Printer className="w-3.5" />Imprimir / PDF</button>
            </div>

            {result.warnings.length > 0 && (
              <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 space-y-1">
                {result.warnings.map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="w-3.5 shrink-0 mt-0.5" />{w}</li>)}
              </ul>
            )}

            <div>
              <h3 className="font-bold">Pasos 1 y 2 — Superficie y grado (770.8)</h3>
              <p>SLA = {fmt(result.surface.covered)} m² cubiertos + {fmt(result.surface.semiCovered)} m² semicubiertos / 2 = <strong>{fmt(result.surface.sla)} m²</strong>. Grado de electrificación: <strong>{GRADE_LABEL[result.grade]}</strong>.</p>
            </div>

            <div>
              <h3 className="font-bold">Paso 3 — Puntos mínimos por ambiente (Tabla 770.8.III)</h3>
              <table className="w-full text-left">
                <thead className="text-slate-500"><tr><th>Ambiente</th><th>IUG mín.</th><th>TUG mín.</th></tr></thead>
                <tbody>{result.minimums.perRoom.map((r) => <tr key={r.room} className="border-t border-slate-100 dark:border-slate-800"><td>{r.room}</td><td>{r.IUG}</td><td>{r.TUG}</td></tr>)}</tbody>
              </table>
            </div>

            <div>
              <h3 className="font-bold">Paso 4 — Demanda de potencia (770.9)</h3>
              <p>{result.demand.perCircuit.map((c) => `${c.id} (${c.kind}): ${fmt(c.va)} VA`).join(' · ')}</p>
              <p>DPMS del grado (uso general y especial{result.demand.factor !== 1 ? `, × ${result.demand.factor}` : ''}): <strong>{fmt(result.demand.gradeDpms)} VA</strong>. DPMS total (con cargas específicas): <strong>{fmt(result.demand.totalDpms)} VA</strong>.</p>
            </div>

            <div className="overflow-x-auto">
              <h3 className="font-bold">Pasos 5, 7 y 8 — Protecciones, conductores, caída de tensión, cortocircuito y exigencia térmica</h3>
              <table className="w-full text-left">
                <thead className="text-slate-500">
                  <tr><th>Línea</th><th>I = S/U</th><th>ITM In</th><th>Iz</th><th>Sección</th><th>ΔU línea</th><th>ΔU total</th><th>Poder de corte (8 A)</th><th>I²t (8 B)</th><th>Térmica</th></tr>
                </thead>
                <tbody>
                  {[{ ...result.feeder, totalDropV: result.feeder.voltageDropV, totalDropOk: result.feeder.warnings.length === 0, demandVa: 0, totalDropLimitV: 0 }, ...result.circuits].map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="font-semibold">{l.id === 'seccional' ? 'Seccional' : `${l.id} (${l.kind})`}</td>
                      <td>{fmt(l.ib)} A</td>
                      <td className={l.coordinationOk ? '' : 'text-rose-700 font-bold'}>{l.breakerA} A</td>
                      <td>{l.iz} A</td>
                      <td>{fmt(l.sectionMm2, 1)} mm²{l.sectionIncreasedForDrop ? ' ↑ caída' : ''}{l.sectionIncreasedForThermal ? ' ↑ térmica' : ''}</td>
                      <td>{fmt(l.voltageDropV, 3)} V</td>
                      <td className={l.totalDropOk ? '' : 'text-rose-700 font-bold'}>{l.id === 'seccional' ? '—' : `${fmt(l.totalDropV, 3)} V`}</td>
                      <td>{fmt(l.breakingCapacityA, 0)} A{l.breakingCapacityAssumed ? '*' : ''} <Mark ok={l.breakingOk} label="Poder de corte" /></td>
                      <td title={l.i2tRef ?? ''}>{l.i2t === null ? 'sin dato' : `${fmt(l.i2t, 0)} A²s${l.i2tSource === 'fabricante' ? ' (fabricante)' : ''}`}{l.i2tRef ? ` · ${l.i2tRef}` : ''}{l.classAssumed && l.i2tSource === 'tabla' ? ` · clase ${l.energyClass}*, curva ${l.curve}*` : ''}</td>
                      <td><Mark ok={l.thermalOk} label="Exigencia térmica" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-slate-500">↑ = la app subió la sección para cumplir la caída de tensión o la exigencia térmica. * = valor supuesto por la app (confirmar con la ficha del fabricante); el I²t real es un dato garantizado por el fabricante. ITM bipolar; ID 30 mA aguas arriba de los circuitos terminales (770.18).</p>
              <p>
                <strong>Icc:</strong> {result.iccA === null ? 'sin dato' : `${fmt(result.iccA, 0)} A`}. <strong>Diferencial</strong> (tipo {result.rcd.type}): {result.rcd.shortCircuitA === null ? 'capacidad de cortocircuito sin dato' : `${fmt(result.rcd.shortCircuitA, 0)} A`} <Mark ok={result.rcd.ok} label="Diferencial" />
              </p>
              {result.assumptions.length > 0 && (
                <ul className="mt-1 text-[10px] text-slate-500 list-disc pl-4">
                  {result.assumptions.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
              {[result.feeder, ...result.circuits].flatMap((l) => l.warnings.map((w) => `${l.id}: ${w}`)).map((w) => <p key={w} className="text-rose-700">{w}</p>)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
