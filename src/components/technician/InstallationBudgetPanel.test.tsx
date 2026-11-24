import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calculateProject, type ProjectInput } from '../../lib/installationProject';
import { InstallationBudgetPanel, EMPTY_BUDGET } from './InstallationBudgetPanel';

const project: ProjectInput = {
  rooms: [{ name: 'Habitación', type: 'dormitorio', areaM2: 16 }],
  circuits: [{ id: 'CT1', kind: 'IUG', points: 5, lengthM: 11, breakerA: 10 }],
  feeder: { lengthM: 11, breakerA: 25 },
};
const result = calculateProject(project);
const budget = { ...EMPTY_BUDGET, prices: [{ tape: { unitPrice: 1000 } }, { tape: { unitPrice: 2000 } }] as typeof EMPTY_BUDGET.prices, supplies: [{ name: 'Discos', amount: 5000 }] };

describe('InstallationBudgetPanel — pasar a presupuesto', () => {
  it('pasa a la orden elegida los materiales con precio y los insumos (sin mano de obra)', async () => {
    const onPass = vi.fn().mockResolvedValue(undefined);
    render(<InstallationBudgetPanel project={project} result={result} value={budget} onChange={vi.fn()} quoteOrders={[{ id: 'o1', title: 'Depto 3B', clientName: 'Gómez' }]} onPassToQuote={onPass} />);
    const button = screen.getByRole('button', { name: /Pasar materiales al presupuesto/ });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Orden/), { target: { value: 'o1' } });
    fireEvent.click(button);
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1));
    const [orderId, items] = onPass.mock.calls[0];
    expect(orderId).toBe('o1');
    expect(items).toEqual([
      { item_type: 'material', description: 'Cinta aisladora PVC 19 mm × 20 m', quantity: 2, unit: 'unidad', unit_price: 1000 },
      { item_type: 'material', description: 'Insumo: Discos', quantity: 1, unit: 'unidad', unit_price: 5000 },
    ]);
  });

  it('sin órdenes editables avisa y no ofrece el botón', () => {
    render(<InstallationBudgetPanel project={project} result={result} value={budget} onChange={vi.fn()} quoteOrders={[]} onPassToQuote={vi.fn()} />);
    expect(screen.getByText(/No tenés órdenes con un presupuesto que se pueda editar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pasar materiales/ })).not.toBeInTheDocument();
  });
});

describe('InstallationBudgetPanel — composición interna', () => {
  const withLabor = { ...budget, tasks: [{ name: 'Obra', officialHours: 10, helperHours: 5 }], officialRate: 8000, helperRate: 6000, visit: 20000, tools: [{ name: 'Amoladora', originValue: 100000, hoursOnSite: 40 }] };

  it('muestra cada componente con su porcentaje y a dónde va cada peso del precio', () => {
    render(<InstallationBudgetPanel project={project} result={result} value={withLabor} onChange={vi.fn()} />);
    expect(screen.getByText(/Composición del precio \(uso interno/)).toBeInTheDocument();
    expect(screen.getByText('COSTO DIRECTO (lo que cuesta hacer la obra)')).toBeInTheDocument();
    expect(screen.getByText('A dónde va cada peso del precio')).toBeInTheDocument();
    expect(screen.getByText('Mano de obra y visita (con cargas)')).toBeInTheDocument();
    expect(screen.getByText('Depreciación por herramienta')).toBeInTheDocument();
  });

  it('el botón abre el documento interno para imprimir', () => {
    const written: string[] = [];
    const fake = { document: { open: vi.fn(), write: (h: string) => written.push(h), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(fake as unknown as Window);
    render(<InstallationBudgetPanel project={project} result={result} value={withLabor} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir composición para imprimir/ }));
    expect(open).toHaveBeenCalled();
    expect(written[0]).toContain('Documento interno');
    expect(written[0]).toContain('Amoladora');
    open.mockRestore();
  });
});

describe('InstallationBudgetPanel — rollo cerrado', () => {
  it('el total por rollos reemplaza cantidad × precio y se conserva al editar el precio', () => {
    let current = { ...EMPTY_BUDGET, prices: [{ 'cable-1.5': { unitPrice: 1000 } }, {}] as typeof EMPTY_BUDGET.prices };
    const onChange = vi.fn((next: typeof current) => { current = next; });
    const { rerender } = render(<InstallationBudgetPanel project={project} result={result} value={current} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Total por rollos de Cable unipolar 1,5 mm² IRAM-NM 247-3 en Por precio/), { target: { value: '422148' } });
    expect(onChange).toHaveBeenCalled();
    expect(current.prices[0]['cable-1.5']).toEqual({ unitPrice: 1000, lumpTotal: 422148 });
    rerender(<InstallationBudgetPanel project={project} result={result} value={current} onChange={onChange} />);
    expect(screen.getAllByText('422.148,00').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/Precio de Cable unipolar 1,5 mm² IRAM-NM 247-3 en Por precio/), { target: { value: '' } });
    expect(current.prices[0]['cable-1.5']).toEqual({ lumpTotal: 422148 }); // el rollo sigue
  });
});
