import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAppMock = vi.fn();
vi.mock('../../context/AppContext', () => ({ useApp: () => useAppMock() }));

const fetchSettingsMock = vi.fn();
const updateSettingMock = vi.fn();
vi.mock('../../lib/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/settings')>();
  return {
    ...actual,
    fetchSettings: (...args: unknown[]) => fetchSettingsMock(...args),
    updateSetting: (...args: unknown[]) => updateSettingMock(...args),
  };
});

const { SystemSettingsPanel } = await import('./SystemSettingsPanel');

function settingRow(overrides: Record<string, unknown>) {
  return {
    key: 'platform_commission_rate',
    value: 0.17,
    value_type: 'number',
    visibility: 'admin',
    description: 'Porcentaje que retiene la plataforma.',
    version: 1,
    updated_at: '2026-08-24T10:00:00Z',
    updated_by: null,
    ...overrides,
  };
}

const showToastMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAppMock.mockReturnValue({ showToast: showToastMock });
  fetchSettingsMock.mockResolvedValue([
    settingRow({ key: 'platform_commission_rate', value: 0.17 }),
    settingRow({ key: 'settlement_release_days', value: 7, value_type: 'number' }),
    settingRow({ key: 'warranty_days', value: 30 }),
    settingRow({ key: 'urgent_surcharge_percent', value: 0 }),
    settingRow({ key: 'message_max_length', value: 2000 }),
  ]);
});

describe('SystemSettingsPanel — estados de carga y confirmación para cambios sensibles', () => {
  it('muestra "Cargando…" mientras llega la configuración', async () => {
    let resolveFetch: (value: unknown[]) => void = () => {};
    fetchSettingsMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<SystemSettingsPanel />);
    expect(screen.getByText('Cargando configuración…')).toBeInTheDocument();
    resolveFetch([]);
    await waitFor(() => expect(screen.queryByText('Cargando configuración…')).not.toBeInTheDocument());
  });

  it('si fetchSettings falla, avisa por toast en vez de romper la pantalla', async () => {
    fetchSettingsMock.mockRejectedValue(new Error('network'));
    render(<SystemSettingsPanel />);
    await waitFor(() => expect(showToastMock).toHaveBeenCalledWith('No se pudo cargar la configuración.', 'error'));
    expect(screen.getByText('Configuración central')).toBeInTheDocument();
  });

  it('un campo sensible (comisión) NO guarda directo: primero pide confirmación explícita', async () => {
    render(<SystemSettingsPanel />);
    await screen.findByText('Configuración central');

    const commissionInput = screen.getByDisplayValue('0.17');
    fireEvent.change(commissionInput, { target: { value: '0.25' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    // Todavía no debería haber llamado a updateSetting — hace falta confirmar.
    expect(updateSettingMock).not.toHaveBeenCalled();
    expect(screen.getByText(/afecta cálculos reales/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(updateSettingMock).toHaveBeenCalledWith('platform_commission_rate', 0.25));
  });

  it('un campo no sensible (garantía) guarda directo, sin paso de confirmación', async () => {
    render(<SystemSettingsPanel />);
    await screen.findByText('Configuración central');

    const warrantyInput = screen.getByDisplayValue('30');
    fireEvent.change(warrantyInput, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(updateSettingMock).toHaveBeenCalledWith('warranty_days', 45));
    expect(screen.queryByText(/afecta cálculos reales/)).not.toBeInTheDocument();
  });

  it('rechaza un número negativo antes de intentar guardar nada', async () => {
    render(<SystemSettingsPanel />);
    await screen.findByText('Configuración central');

    const warrantyInput = screen.getByDisplayValue('30');
    fireEvent.change(warrantyInput, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    expect(updateSettingMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('Ingresá un número válido (≥ 0).', 'warning');
  });
});
