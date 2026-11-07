import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

const { SplitEarningsReport, reportToCsv } = await import('./SplitEarningsReport');

const report = {
  month: '2026-11',
  rows: [
    { id: 'p1', orderId: 'o1', orderTitle: 'Tablero', technicianId: 't1', technicianName: 'Walter', capturedAt: '2026-11-10T15:00:00Z', status: 'approved', amount: 1000, commission: 170, mpFee: 41, technicianNet: 789 },
    { id: 'p2', orderId: 'o2', orderTitle: 'Enchufe "doble"', technicianId: 't2', technicianName: 'Ana', capturedAt: '2026-11-12T15:00:00Z', status: 'approved', amount: 2000, commission: 340, mpFee: 82, technicianNet: 1578 },
  ],
  totals: { count: 2, amount: 3000, commission: 510, mpFee: 123, technicianNet: 2367 },
};
const empty = { month: '2026-11', rows: [], totals: { count: 0, amount: 0, commission: 0, mpFee: 0, technicianNet: 0 } };

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('SplitEarningsReport', () => {
  it('admin: muestra la comisión a facturar por técnico', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => report });
    render(<SplitEarningsReport mode="admin" />);
    expect(await screen.findByText('Walter')).toBeInTheDocument();
    expect(screen.getByText('Comisión a facturar')).toBeInTheDocument();
    expect(screen.getAllByText(/510/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Descargar planilla/ })).toBeInTheDocument();
  });

  it('técnico sin cobros repartidos: no muestra nada', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => empty });
    const { container } = render(<SplitEarningsReport mode="technician" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('técnico con cobros: ve lo que le quedó y no tiene descarga', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...report, rows: [report.rows[0]], totals: { count: 1, amount: 1000, commission: 170, mpFee: 41, technicianNet: 789 } }) });
    render(<SplitEarningsReport mode="technician" />);
    expect(await screen.findByText('Te quedó')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument();
  });

  it('la planilla usa ";" y coma decimal, escapa comillas y suma el total', () => {
    const csv = reportToCsv(report as never);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toContain('Comisión TecniUrbano');
    expect(lines[2]).toContain('"Enchufe ""doble"""');
    expect(lines[2]).toContain('2000,00;340,00;82,00;1578,00');
    expect(lines[3]).toBe('Total (sin devueltos);;;;3000,00;510,00;123,00;2367,00');
  });
});
