import { describe, expect, it } from 'vitest';
import { mergePublicTechnicians, TECHNICIAN_COLUMNS_ADMIN, TECHNICIAN_COLUMNS_SHARED } from './supabaseData';

/**
 * Regresión para el hallazgo de RLS de `technicians`: la fila ya está bien
 * scopeada (admin / propio técnico / cliente con orden asignada), pero RLS
 * no filtra columnas — así que el select() de fetchCatalog() es la única
 * defensa contra que validation_notes (nota interna de admin), work_phone
 * (contacto interno) o work_zone_* (zona de trabajo declarada — ver
 * plan-zona-trabajo-agenda.md) le lleguen a un cliente o a otro técnico. Si
 * alguien vuelve a escribir select('*') o agrega estas columnas a la lista
 * compartida, este test lo detecta.
 */
const ADMIN_ONLY_COLUMNS = [
  'work_phone',
  'address',
  'work_zone_lat',
  'work_zone_lng',
  'work_zone_radius_km',
  'work_zone_city',
  'work_zone_province',
  'is_available',
];

describe('columnas de technicians en el catálogo compartido', () => {
  it('la lista compartida (no-admin) nunca incluye validation_notes ni las columnas solo-admin', () => {
    const columns = TECHNICIAN_COLUMNS_SHARED.split(',');
    expect(columns).not.toContain('validation_notes');
    for (const col of ADMIN_ONLY_COLUMNS) {
      expect(columns).not.toContain(col);
    }
  });

  it('la lista de admin incluye las columnas solo-admin pero nunca validation_notes', () => {
    const columns = TECHNICIAN_COLUMNS_ADMIN.split(',');
    for (const col of ADMIN_ONLY_COLUMNS) {
      expect(columns).toContain(col);
    }
    expect(columns).not.toContain('validation_notes');
  });

  it('la lista de admin extiende la compartida (no duplica ni pierde columnas)', () => {
    const shared = TECHNICIAN_COLUMNS_SHARED.split(',');
    const admin = TECHNICIAN_COLUMNS_ADMIN.split(',');
    for (const col of shared) {
      expect(admin).toContain(col);
    }
    expect(admin.length).toBe(shared.length + ADMIN_ONLY_COLUMNS.length);
  });
});

describe('mergePublicTechnicians', () => {
  const own = [{ id: 'a', name: 'Beto', phone: '111', email: 'beto@x.com' }] as never;

  it('suma los técnicos visibles solo por sus datos públicos, sin teléfono ni correo', () => {
    const publicRows = [{ id: 'b', name: 'Ana', phone: '222', email: 'ana@x.com' }] as never;
    const merged = mergePublicTechnicians(own, publicRows);
    expect(merged.map((t) => t.name)).toEqual(['Ana', 'Beto']);
    expect(merged[0].phone).toBe('');
    expect(merged[0].email).toBe('');
  });

  it('no pisa la fila propia, que conserva sus datos de contacto', () => {
    const merged = mergePublicTechnicians(own, [{ id: 'a', name: 'Beto' }] as never);
    expect(merged).toHaveLength(1);
    expect(merged[0].phone).toBe('111');
  });
});
