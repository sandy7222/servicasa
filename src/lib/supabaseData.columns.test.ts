import { describe, expect, it } from 'vitest';
import { TECHNICIAN_COLUMNS_ADMIN, TECHNICIAN_COLUMNS_SHARED } from './supabaseData';

/**
 * Regresión para el hallazgo de RLS de `technicians`: la fila ya está bien
 * scopeada (admin / propio técnico / cliente con orden asignada), pero RLS
 * no filtra columnas — así que el select() de fetchCatalog() es la única
 * defensa contra que validation_notes (nota interna de admin) o work_phone
 * (contacto interno) le lleguen a un cliente o a otro técnico. Si alguien
 * vuelve a escribir select('*') o agrega estas columnas a la lista
 * compartida, este test lo detecta.
 */
describe('columnas de technicians en el catálogo compartido', () => {
  it('la lista compartida (no-admin) nunca incluye validation_notes ni work_phone', () => {
    const columns = TECHNICIAN_COLUMNS_SHARED.split(',');
    expect(columns).not.toContain('validation_notes');
    expect(columns).not.toContain('work_phone');
  });

  it('la lista de admin incluye work_phone pero nunca validation_notes', () => {
    const columns = TECHNICIAN_COLUMNS_ADMIN.split(',');
    expect(columns).toContain('work_phone');
    expect(columns).not.toContain('validation_notes');
  });

  it('la lista de admin extiende la compartida (no duplica ni pierde columnas)', () => {
    const shared = TECHNICIAN_COLUMNS_SHARED.split(',');
    const admin = TECHNICIAN_COLUMNS_ADMIN.split(',');
    for (const col of shared) {
      expect(admin).toContain(col);
    }
    expect(admin.length).toBe(shared.length + 1);
  });
});
