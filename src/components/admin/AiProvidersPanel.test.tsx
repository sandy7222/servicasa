import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  list: vi.fn(),
  reveal: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
  importEnv: vi.fn(),
  setEnabled: vi.fn(),
  setOrder: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ showToast: m.toast }) }));
vi.mock('../../lib/aiAdminClient', async (orig) => ({
  ...(await orig<typeof import('../../lib/aiAdminClient')>()),
  aiAdmin: { list: m.list, reveal: m.reveal, save: m.save, test: m.test, importEnv: m.importEnv, setEnabled: m.setEnabled, setOrder: m.setOrder, remove: m.remove },
}));

import { AiProvidersPanel } from './AiProvidersPanel';

const provider = { id: 'p1', label: 'Groq', preset: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b', reasoningEffort: 'none', enabled: true, priority: 10, keyHint: '1234' };

describe('AiProvidersPanel', () => {
  beforeEach(() => {
    Object.values(m).forEach((fn) => fn.mockReset());
    m.list.mockResolvedValue({ providers: [provider], env: [] });
    m.save.mockResolvedValue({ id: 'p1' });
    m.test.mockResolvedValue({ ok: true, ms: 800, message: 'Funciona: el proveedor respondió.' });
  });
  afterEach(() => cleanup());

  it('la clave actual aparece tapada con puntos y solo se ve el final', async () => {
    render(<AiProvidersPanel />);
    const key = await screen.findByLabelText('API key actual');
    expect(key.textContent).toMatch(/^•+1234$/);
    expect(m.reveal).not.toHaveBeenCalled();
  });

  it('el ojito muestra la clave completa y al tocarlo de nuevo la tapa', async () => {
    m.reveal.mockResolvedValue('gsk_CLAVE_COMPLETA_1234');
    render(<AiProvidersPanel />);
    await screen.findByLabelText('API key actual');
    fireEvent.click(screen.getByLabelText('Mostrar la clave'));
    await waitFor(() => expect(screen.getByLabelText('API key actual').textContent).toBe('gsk_CLAVE_COMPLETA_1234'));
    fireEvent.click(screen.getByLabelText('Ocultar la clave'));
    expect(screen.getByLabelText('API key actual').textContent).toMatch(/^•+1234$/);
  });

  it('cambiar la clave: la edición no muestra la actual y manda solo la nueva', async () => {
    render(<AiProvidersPanel />);
    fireEvent.click(await screen.findByText('Editar o cambiar clave'));
    const input = screen.getByLabelText('API key') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: 'gsk_NUEVA_CLAVE_5678' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', apiKey: 'gsk_NUEVA_CLAVE_5678', model: 'qwen/qwen3.8-27b' })));
  });

  it('agregar otro proveedor: elegir DeepSeek completa dirección y modelo', async () => {
    m.list.mockResolvedValue({ providers: [], env: [] });
    render(<AiProvidersPanel />);
    fireEvent.click(await screen.findByText('Agregar proveedor'));
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'deepseek' } });
    expect((screen.getByLabelText('Dirección (URL de la API)') as HTMLInputElement).value).toBe('https://api.deepseek.com/v1');
    expect((screen.getByLabelText('Modelo') as HTMLInputElement).value).toBe('deepseek-chat');
    expect(screen.getByText(/China/)).toBeTruthy();
  });

  it('probar muestra el resultado', async () => {
    render(<AiProvidersPanel />);
    fireEvent.click(await screen.findByText('Probar'));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Funciona'));
  });

  it('ofrece importar la clave de Vercel solo si hay una y todavía no está en el panel', async () => {
    m.list.mockResolvedValue({ providers: [], env: [{ name: 'groq', label: 'Groq', variable: 'GROQ_API_KEY', hint: '9999' }] });
    m.importEnv.mockResolvedValue({ id: 'p1' });
    render(<AiProvidersPanel />);
    fireEvent.click(await screen.findByText('Importar la clave de Groq a este panel'));
    await waitFor(() => expect(m.importEnv).toHaveBeenCalled());
  });
});
