import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelpHub, type HelpMode } from './HelpHub';
import { FAQ_ITEMS, formatPrice } from '../../lib/helpFaq';
import { whatsappUrl } from '../../lib/appLinks';

function Harness({ onStartOrder = () => {}, initial = 'home' as HelpMode, role = null as string | null, onNavigate = () => {} }) {
  const [mode, setMode] = useState<HelpMode>(initial);
  return <HelpHub mode={mode} onModeChange={setMode} onStartOrder={onStartOrder} onClose={() => {}} visitPrice={50000} role={role} onNavigate={onNavigate} />;
}

describe('preguntas frecuentes (contenido)', () => {
  it('usa el término oficial y nunca llama "seña" a la visita', () => {
    const all = FAQ_ITEMS.map((i) => `${i.question} ${i.answer(formatPrice(50000))}`).join(' ');
    expect(all).toContain('Visita de Presupuesto');
    expect(all.replace('no es una seña', '')).not.toMatch(/\bse(ñ|n)a\b/i);
  });
  it('el precio sale del valor vigente, no escrito a mano', () => {
    const price = FAQ_ITEMS.find((i) => i.id === 'precio')!.answer('$99.999');
    expect(price).toContain('$99.999');
  });
  it('no promete ubicación del técnico ni reembolsos', () => {
    const all = FAQ_ITEMS.map((i) => i.answer('$1')).join(' ').toLowerCase();
    expect(all).toContain('no hay mapa en vivo');
    expect(all).not.toMatch(/te devolvemos|reembolso total|seguí al técnico en el mapa/);
  });
});

describe('whatsappUrl', () => {
  it('arma el link solo con un número válido', () => {
    expect(whatsappUrl(undefined)).toBeNull();
    expect(whatsappUrl('12')).toBeNull();
    expect(whatsappUrl('+54 9 11 1234-5678', 'Hola')).toBe('https://wa.me/5491112345678?text=Hola');
  });
});

describe('HelpHub', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('el menú ofrece las tres opciones', () => {
    render(<Harness />);
    expect(screen.getByText('Armar mi pedido')).toBeTruthy();
    expect(screen.getByText('Preguntas frecuentes')).toBeTruthy();
    expect(screen.getByText('Escribir una consulta')).toBeTruthy();
  });

  it('"Armar mi pedido" lanza el asistente de siempre', () => {
    const onStartOrder = vi.fn();
    render(<Harness onStartOrder={onStartOrder} />);
    fireEvent.click(screen.getByText('Armar mi pedido'));
    expect(onStartOrder).toHaveBeenCalledTimes(1);
  });

  it('preguntas frecuentes: elegir una muestra la respuesta con el precio vigente y se puede volver', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Preguntas frecuentes'));
    fireEvent.click(screen.getByText('¿Cuánto cuesta la visita?'));
    expect(screen.getByText(/cuesta hoy \$50\.000/)).toBeTruthy();
    fireEvent.click(screen.getByText('Otra pregunta'));
    expect(screen.getByText('¿Qué es la Visita de Presupuesto?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Volver al menú'));
    expect(screen.getByText('Escribir una consulta')).toBeTruthy();
  });

  it('reclamos: el cliente con cuenta va directo a Reclamos y garantías', () => {
    const onNavigate = vi.fn();
    render(<Harness role="customer" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Preguntas frecuentes'));
    fireEvent.click(screen.getByText('¿Cómo abro un reclamo?'));
    fireEvent.click(screen.getByText('Ir a Reclamos y garantías'));
    expect(onNavigate).toHaveBeenCalledWith('/customer/reclamos');
  });

  it('reclamos: el visitante sin cuenta recibe la opción de ingresar', () => {
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Preguntas frecuentes'));
    fireEvent.click(screen.getByText('¿Cómo abro un reclamo?'));
    fireEvent.click(screen.getByText('Ingresar para abrir un reclamo'));
    expect(onNavigate).toHaveBeenCalledWith('/auth');
  });

  it('consulta con IA: manda el historial y muestra la respuesta, con aviso de que es una IA', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: 'ai', reply: 'Con gusto te explico.' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness initial="ai" />);
    expect(screen.getByText(/una IA/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: '¿Cómo pido una visita?' } });
    fireEvent.click(screen.getByLabelText('Enviar'));
    await waitFor(() => expect(screen.getByText('Con gusto te explico.')).toBeTruthy());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages).toEqual([{ role: 'user', content: '¿Cómo pido una visita?' }]);
    vi.unstubAllGlobals();
  });

  it('si el servidor falla, avisa sin romper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    render(<Harness initial="ai" />);
    fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: 'hola' } });
    fireEvent.click(screen.getByLabelText('Enviar'));
    await waitFor(() => expect(screen.getByText(/no puedo responder/i)).toBeTruthy());
    vi.unstubAllGlobals();
  });

  it('un aviso de seguridad se muestra con el texto fijo que manda el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: 'safety', reply: 'Esto puede ser una emergencia eléctrica.' }), { status: 200 })));
    render(<Harness initial="ai" />);
    fireEvent.change(screen.getByLabelText('Tu consulta'), { target: { value: 'huele a quemado' } });
    fireEvent.click(screen.getByLabelText('Enviar'));
    await waitFor(() => expect(screen.getByText(/emergencia eléctrica/)).toBeTruthy());
    vi.unstubAllGlobals();
  });
});
