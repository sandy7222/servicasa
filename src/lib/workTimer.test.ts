import { describe, expect, it } from 'vitest';
import { canExecutePaidWork, formatElapsedTime, getOrderElapsedSeconds, isOrderPaymentSettled, orderRequiresPaymentGate } from './workTimer';
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

describe('canExecutePaidWork — nunca dejar trabajar sin pago confirmado', () => {
  it('una orden sin workMode (legacy, creada fuera del flujo de pago) siempre puede trabajar', () => {
    expect(canExecutePaidWork(baseOrder({ workMode: undefined }))).toBe(true);
  });

  it('precio fijo (direct): requiere paid_in_full exacto, ningún otro estado alcanza', () => {
    expect(canExecutePaidWork(baseOrder({ workMode: 'direct', paymentStatus: 'paid_in_full' }))).toBe(true);
    expect(canExecutePaidWork(baseOrder({ workMode: 'direct', paymentStatus: 'pending' }))).toBe(false);
    expect(canExecutePaidWork(baseOrder({ workMode: 'direct', paymentStatus: 'deposit_paid' }))).toBe(false);
    expect(canExecutePaidWork(baseOrder({ workMode: 'direct', paymentStatus: 'balance_pending' }))).toBe(false);
    expect(canExecutePaidWork(baseOrder({ workMode: 'direct', paymentStatus: 'refunded' }))).toBe(false);
  });

  it('diagnóstico: requiere presupuesto aceptado Y saldo pagado — ninguna de las dos sola alcanza', () => {
    expect(canExecutePaidWork(baseOrder({ workMode: 'diagnosis', quoteStatus: 'accepted', paymentStatus: 'paid_in_full' }))).toBe(true);
    // presupuesto aceptado pero el saldo todavía no se pagó
    expect(canExecutePaidWork(baseOrder({ workMode: 'diagnosis', quoteStatus: 'accepted', paymentStatus: 'balance_pending' }))).toBe(false);
    // saldo ya pagado pero el presupuesto no fue aceptado (no debería pasar, pero el gate igual lo bloquea)
    expect(canExecutePaidWork(baseOrder({ workMode: 'diagnosis', quoteStatus: 'sent', paymentStatus: 'paid_in_full' }))).toBe(false);
    // solo la seña de la visita, todavía no es el saldo
    expect(canExecutePaidWork(baseOrder({ workMode: 'diagnosis', quoteStatus: 'accepted', paymentStatus: 'deposit_paid' }))).toBe(false);
  });
});

describe('isOrderPaymentSettled — mismo criterio que canExecutePaidWork para el gate de asignación', () => {
  it('direct necesita paid_in_full', () => {
    expect(isOrderPaymentSettled({ workMode: 'direct', paymentStatus: 'paid_in_full' })).toBe(true);
    expect(isOrderPaymentSettled({ workMode: 'direct', paymentStatus: 'deposit_paid' })).toBe(false);
  });

  it('diagnosis alcanza con la seña (deposit_paid) o con todo pagado', () => {
    expect(isOrderPaymentSettled({ workMode: 'diagnosis', paymentStatus: 'deposit_paid' })).toBe(true);
    expect(isOrderPaymentSettled({ workMode: 'diagnosis', paymentStatus: 'paid_in_full' })).toBe(true);
    expect(isOrderPaymentSettled({ workMode: 'diagnosis', paymentStatus: 'pending' })).toBe(false);
  });

  it('sin workMode (orden admin fuera del flujo de pago) se trata como saldada', () => {
    expect(isOrderPaymentSettled({ workMode: undefined, paymentStatus: 'pending' })).toBe(true);
  });
});

describe('orderRequiresPaymentGate', () => {
  it('solo diagnosis y direct pasan por el gate de pago', () => {
    expect(orderRequiresPaymentGate({ workMode: 'diagnosis' })).toBe(true);
    expect(orderRequiresPaymentGate({ workMode: 'direct' })).toBe(true);
    expect(orderRequiresPaymentGate({ workMode: undefined })).toBe(false);
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
