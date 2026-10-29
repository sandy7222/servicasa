import { describe, expect, it } from 'vitest';
import { pushUrlFor } from './pushRoute';

describe('pushUrlFor', () => {
  it('pedido: cada rol abre su pantalla', () => {
    expect(pushUrlFor('admin', 'order', 'o1')).toBe('/#/hub?order=o1');
    expect(pushUrlFor('technician', 'order', 'o1')).toBe('/#/technician?order=o1');
    expect(pushUrlFor('customer', 'order', 'o1')).toBe('/#/customer/orders/o1');
  });
  it('reclamo y conversación por rol', () => {
    expect(pushUrlFor('customer', 'claim', 'c1')).toBe('/#/customer/reclamos/c1');
    expect(pushUrlFor('technician', 'conversation', 'x')).toBe('/#/technician/conversaciones/x');
    expect(pushUrlFor('admin', 'conversation', 'x')).toBe('/#/admin/conversaciones/x');
  });
  it('avisos de admin: técnicos y empresas', () => {
    expect(pushUrlFor('admin', 'technician', 't1')).toBe('/#/hub?tab=technicians');
    expect(pushUrlFor('admin', 'business_lead', 'b1')).toBe('/#/hub?tab=leads');
  });
  it('sin entidad o tipo desconocido: la pantalla de inicio del rol', () => {
    expect(pushUrlFor('technician', null, null)).toBe('/#/technician');
    expect(pushUrlFor('customer', 'algo_raro', 'z')).toBe('/#/customer');
    expect(pushUrlFor('admin', 'settlement', 's')).toBe('/#/hub');
  });
  it('escapa ids raros', () => {
    expect(pushUrlFor('customer', 'order', 'a b/c')).toBe('/#/customer/orders/a%20b%2Fc');
  });
});
