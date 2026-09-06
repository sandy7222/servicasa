import { describe, expect, it } from 'vitest';
import { formatElapsedTime, getOrderElapsedSeconds, getTimerStatusLabel, isOrderPaymentSettled, orderRequiresPaymentGate } from './workTimer';
import type { ServiceOrder } from '../types';

function baseOrder(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return {
    id: 'order-1',
    status: 'assigned',
    workElapsedSeconds: 0,
    workStartedAt: undefined,
    ...overrides,
  } as ServiceOrder;
}

describe('isOrderPaymentSettled — gate único para asignar Y para arrancar/reanudar el cronómetro (assigned/paused -> in_progress)', () => {
  it('una orden sin workMode (legacy, creada fuera del flujo de pago) siempre está saldada', () => {
    expect(isOrderPaymentSettled(baseOrder({ workMode: undefined }))).toBe(true);
  });

  it('precio fijo (direct): requiere paid_in_full exacto, ningún otro estado alcanza', () => {
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'direct', paymentStatus: 'paid_in_full' }))).toBe(true);
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'direct', paymentStatus: 'pending' }))).toBe(false);
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'direct', paymentStatus: 'deposit_paid' }))).toBe(false);
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'direct', paymentStatus: 'balance_pending' }))).toBe(false);
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'direct', paymentStatus: 'refunded' }))).toBe(false);
  });

  it('diagnóstico: la seña (deposit_paid) ya alcanza — el primer viaje es a diagnosticar, antes de que exista presupuesto', () => {
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'diagnosis', quoteStatus: undefined, paymentStatus: 'deposit_paid' }))).toBe(true);
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'diagnosis', quoteStatus: 'accepted', paymentStatus: 'paid_in_full' }))).toBe(true);
    // sin ningún pago todavía, ni siquiera la seña
    expect(isOrderPaymentSettled(baseOrder({ workMode: 'diagnosis', paymentStatus: 'pending' }))).toBe(false);
  });
});

describe('orderRequiresPaymentGate', () => {
  it('solo diagnosis y direct pasan por el gate de pago', () => {
    expect(orderRequiresPaymentGate({ workMode: 'diagnosis' })).toBe(true);
    expect(orderRequiresPaymentGate({ workMode: 'direct' })).toBe(true);
    expect(orderRequiresPaymentGate({ workMode: undefined })).toBe(false);
  });
});

describe('getTimerStatusLabel — antes era un binario EN CURSO/PAUSADO que mostraba "pausado" para cualquier cosa que no fuera in_progress', () => {
  it('estados terminales/activos, uno a uno', () => {
    expect(getTimerStatusLabel(baseOrder({ status: 'in_progress' }))).toBe('EN CURSO');
    expect(getTimerStatusLabel(baseOrder({ status: 'paused' }))).toBe('PAUSADO');
    expect(getTimerStatusLabel(baseOrder({ status: 'completed' }))).toBe('FINALIZADO');
    expect(getTimerStatusLabel(baseOrder({ status: 'cancelled' }))).toBe('CANCELADA');
  });

  it('assigned + todavía no respondió la asignación: PENDIENTE, no PAUSADO', () => {
    expect(getTimerStatusLabel(baseOrder({ status: 'assigned', technicianResponseStatus: 'pending' }))).toBe('PENDIENTE');
  });

  it('assigned + diagnóstico + llegó (esperando que el cliente pague el presupuesto): PRESUPUESTANDO', () => {
    expect(
      getTimerStatusLabel(
        baseOrder({ status: 'assigned', technicianResponseStatus: 'accepted', workMode: 'diagnosis', arrivedAt: new Date().toISOString() })
      )
    ).toBe('PRESUPUESTANDO');
  });

  it('assigned + salió hacia el domicilio pero todavía no llegó: EN CAMINO', () => {
    expect(
      getTimerStatusLabel(
        baseOrder({ status: 'assigned', technicianResponseStatus: 'accepted', travelStartedAt: new Date().toISOString() })
      )
    ).toBe('EN CAMINO');
  });

  it('assigned + aceptó pero todavía no salió: ASIGNADA', () => {
    expect(getTimerStatusLabel(baseOrder({ status: 'assigned', technicianResponseStatus: 'accepted' }))).toBe('ASIGNADA');
  });

  it('directo llegado (arrivedAt no aplica fuera de diagnóstico) sigue como EN CAMINO, no PRESUPUESTANDO', () => {
    expect(
      getTimerStatusLabel(
        baseOrder({ status: 'assigned', technicianResponseStatus: 'accepted', workMode: 'direct', travelStartedAt: new Date().toISOString(), arrivedAt: new Date().toISOString() })
      )
    ).toBe('EN CAMINO');
  });
});

describe('getOrderElapsedSeconds', () => {
  it('orden no en curso: devuelve el acumulado guardado, sin sumar nada en vivo', () => {
    const order = baseOrder({ status: 'paused', workElapsedSeconds: 120, workStartedAt: new Date().toISOString() });
    expect(getOrderElapsedSeconds(order)).toBe(120);
  });

  it('orden en curso: suma el tiempo transcurrido desde work_started_at al acumulado', () => {
    const startedAt = new Date(Date.now() - 30_000).toISOString(); // hace 30s
    const order = baseOrder({ status: 'in_progress', workElapsedSeconds: 100, workStartedAt: startedAt });
    const elapsed = getOrderElapsedSeconds(order, Date.now());
    expect(elapsed).toBeGreaterThanOrEqual(129);
    expect(elapsed).toBeLessThanOrEqual(131);
  });

  it('work_started_at inválido no rompe el cálculo — devuelve el acumulado', () => {
    const order = baseOrder({ status: 'in_progress', workElapsedSeconds: 50, workStartedAt: 'fecha-invalida' });
    expect(getOrderElapsedSeconds(order)).toBe(50);
  });
});

describe('formatElapsedTime', () => {
  it('formatea HH:MM:SS con ceros a la izquierda', () => {
    expect(formatElapsedTime(0)).toBe('00:00:00');
    expect(formatElapsedTime(65)).toBe('00:01:05');
    expect(formatElapsedTime(3661)).toBe('01:01:01');
  });

  it('nunca devuelve negativos aunque el input lo sea', () => {
    expect(formatElapsedTime(-50)).toBe('00:00:00');
  });
});
