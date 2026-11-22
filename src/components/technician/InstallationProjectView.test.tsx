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
