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
