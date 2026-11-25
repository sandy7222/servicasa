import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isElectrician } from '../../lib/technicianTools';

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ navigate: vi.fn() }) }));

const { InstallationProjectView } = await import('./InstallationProjectView');

// El entorno de tests no trae localStorage: uno en memoria.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

beforeEach(() => {
  localStorage.clear();
});

describe('isElectrician', () => {
  it('solo técnicos con la especialidad Electricidad (con o sin acento)', () => {
    expect(isElectrician({ specialty: 'Plomería', specialties: [{ id: '1', name: 'Electricidad' }] })).toBe(true);
    expect(isElectrician({ specialty: 'ELÉCTRICA', specialties: [] })).toBe(true);
    expect(isElectrician({ specialty: 'Plomería', specialties: [{ id: '2', name: 'Gas' }] })).toBe(false);
    expect(isElectrician(undefined)).toBe(false);
  });
});

describe('InstallationProjectView', () => {
  it('con el ejemplo de clase muestra SLA, grado, DPMS y la seccional subida a 6 mm²', () => {
    localStorage.setItem(
      'tu:installation-project:v1',
      JSON.stringify({
        name: 'Ejemplo de clase',
        rooms: [
          { name: 'Habitación', type: 'dormitorio', areaM2: 16 },
          { name: 'Baño', type: 'bano', areaM2: 6 },
          { name: 'Balcón', type: 'balcon', areaM2: 2.5, semiCovered: true },
        ],
        wallsM2: 1.56,
        circuits: [
          { id: 'CT1', kind: 'IUG', points: 4, lengthM: 4, breakerA: 10 },
          { id: 'CT2', kind: 'TUG', points: 4, lengthM: 7.5, breakerA: 16 },
          { id: 'CT3', kind: 'ACU', points: 1, loadVa: 2600, lengthM: 2, cosPhi: 0.85, breakerA: 16 },
        ],
        feeder: { lengthM: 20, breakerA: 25 },
      })
    );
    render(<InstallationProjectView />);
    expect(screen.getByText(/Memoria de cálculo — Ejemplo de clase/)).toBeInTheDocument();
    expect(screen.getAllByText(/24,81 m²/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mínimo').length).toBeGreaterThan(0);
    expect(screen.getByText(/4\.960 VA|4960 VA/)).toBeInTheDocument(); // DPMS total con 2/3 (160 + 2.200 + 2.600)
    expect(screen.getByText(/6 mm² ↑/)).toBeInTheDocument();
  });

  it('con la Icc del TP N° 1 muestra el 8 A (4.500 A), el 8 B (30.000 A²s, tabla) y el IUG subido a 2,5 mm² por la térmica', () => {
    localStorage.setItem(
      'tu:installation-project:v1',
      JSON.stringify({
        name: 'TP N° 1',
        rooms: [{ name: 'Habitación', type: 'dormitorio', areaM2: 16 }],
        circuits: [
          { id: 'CT1', kind: 'IUG', points: 5, lengthM: 11, breakerA: 10 },
          { id: 'CT2', kind: 'TUG', points: 11, lengthM: 12, breakerA: 16 },
          { id: 'CT3', kind: 'ACU', points: 1, loadVa: 2600, lengthM: 11, breakerA: 16 },
        ],
        feeder: { lengthM: 11, breakerA: 25 },
        iccA: 3250,
        rcd: { shortCircuitA: 3000 },
      })
    );
    render(<InstallationProjectView />);
    expect(screen.getByDisplayValue('3250')).toBeInTheDocument(); // Icc cargada
    expect(screen.getByText(/2,5 mm² ↑ térmica/)).toBeInTheDocument();
    expect(screen.getAllByText(/30\.000 A²s · Tabla 770-B\.VIII/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/39\.000 A²s · Tabla 770-B\.IX/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\.500 A\*/).length).toBeGreaterThan(0); // poder de corte supuesto
    expect(screen.getByText(/El diferencial aguanta 3000 A de cortocircuito/)).toBeInTheDocument();
  });

  it('el presupuesto de obra muestra el precio total con mano de obra, herramientas y precios cargados', () => {
    const budget = {
      qty: {},
      listNames: ['Por precio', 'Por calidad / marca'],
      prices: [{ tape: { unitPrice: 1000 } }, { tape: { unitPrice: 2000 } }],
      supplies: [{ name: 'Discos', amount: 5000 }],
      tools: [{ name: 'Amoladora', originValue: 100000, hoursOnSite: 40 }],
      tasks: [{ name: 'Caños', officialHours: 10, helperHours: 5 }],
      officialRate: 8000,
      helperRate: 6000,
      visit: 20000,
      rules: {},
    };
    localStorage.setItem(
      'tu:installation-project:v1',
      JSON.stringify({
        name: 'Obra',
        rooms: [{ name: 'Habitación', type: 'dormitorio', areaM2: 16 }],
        circuits: [{ id: 'CT1', kind: 'IUG', points: 5, lengthM: 11, breakerA: 10 }],
        feeder: { lengthM: 11, breakerA: 25 },
        budget,
      })
    );
    render(<InstallationProjectView />);
    // Solo la cinta tiene precio (2 u): materiales 2.000 / 4.000. Insumos 5.000. Depreciación 100.000 × 0,18 × 40 / 400 = 1.800.
    // MO = 10 × 8.000 + 5 × 6.000 = 110.000 → con cargas 165.000. Directo = 2.000 + 5.000 + 1.800 + 165.000 + 20.000 = 193.800.
    expect(screen.getByText('Presupuesto de obra')).toBeInTheDocument();
    // Lista 1: GG 19.380 + beneficio 21.318 → 234.498,00. Lista 2 (materiales 4.000): directo 195.800 → 236.918,00.
    const total = screen.getByText('PRECIO TOTAL').closest('tr');
    expect(total).toHaveTextContent('234.498,00');
    expect(total).toHaveTextContent('236.918,00');
  });

  it('"Abrir nota para imprimir" arma la nota con el cliente, el logo y la garantía', () => {
    localStorage.setItem(
      'tu:installation-project:v1',
      JSON.stringify({
        name: 'Obra',
        rooms: [{ name: 'Habitación', type: 'dormitorio', areaM2: 16 }],
        circuits: [{ id: 'CT1', kind: 'IUG', points: 5, lengthM: 11, breakerA: 10 }],
        feeder: { lengthM: 11, breakerA: 25 },
        budget: { clientName: 'María Gómez', visit: 1000 },
      })
    );
    const written: string[] = [];
    const fakeWindow = { document: { open: vi.fn(), write: (h: string) => written.push(h), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window);
    render(<InstallationProjectView />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir nota para imprimir/ }));
    expect(open).toHaveBeenCalled();
    expect(written[0]).toContain('María Gómez');
    expect(written[0]).toContain('fuera de la plataforma');
    expect(written[0]).toContain('<img');
    open.mockRestore();
  });

  it('"Cargar ejemplo (TP N° 1)" arma el proyecto del departamento con grado Mínimo y el precio de la obra', () => {
    render(<InstallationProjectView />);
    fireEvent.click(screen.getByRole('button', { name: /Cargar ejemplo/ }));
    expect(screen.getByText(/Memoria de cálculo — TP N° 1/)).toBeInTheDocument();
    expect(screen.getAllByText(/37,94 m²/).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('3250')).toBeInTheDocument();
    expect(screen.getByText('PRECIO TOTAL').closest('tr')).toHaveTextContent('2.932.453,63'); // el ejemplo reproduce la memoria del TP al centavo
  });

  it('con el ejemplo muestra el recorrido de los 15 pasos y los pasos 6 y 9 de la memoria', () => {
    render(<InstallationProjectView />);
    expect(screen.getByText(/Recorrido del trabajo \(2 de 15 listos\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cargar ejemplo/ }));
    expect(screen.getByText(/Recorrido del trabajo \(14 de 15 listos\)/)).toBeInTheDocument(); // falta solo el nombre del cliente de la nota
    expect(screen.getByText('Falta el nombre del cliente')).toBeInTheDocument();
    expect(screen.getByText(/Paso 6 — Canalizaciones y conductores/)).toBeInTheDocument();
    expect(screen.getAllByText('IRAM 62386-21, RSP 25').length).toBeGreaterThan(0);
    expect(screen.getByText(/Paso 9 — Ubicación del tablero seccional/)).toBeInTheDocument();
    expect(screen.getByText(/4\. Ubicación del tablero seccional/)).toBeInTheDocument();
  });

  it('"Proponer circuitos mínimos" arma los circuitos del grado con las bocas mínimas', () => {
    render(<InstallationProjectView />);
    expect(screen.queryByText(/Memoria de cálculo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Proponer circuitos mínimos/ }));
    expect(screen.getByText(/Memoria de cálculo/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('IUG1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TUG1')).toBeInTheDocument();
  });

  it('muestra la leyenda de responsabilidad del técnico', () => {
    render(<InstallationProjectView />);
    expect(screen.getByText(/es responsable del proyecto/)).toBeInTheDocument();
  });
});
