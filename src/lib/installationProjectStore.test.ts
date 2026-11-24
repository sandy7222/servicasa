import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; op: string; payload?: unknown; filter?: [string, unknown] };
const calls: Call[] = [];
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

// Cadena mínima de supabase-js: cada paso devuelve el mismo objeto "thenable".
const chain = (table: string, op: string, payload?: unknown): any => {
  const call: Call = { table, op, payload };
  calls.push(call);
  const api: any = {
    select: () => api,
    order: () => api,
    eq: (col: string, val: unknown) => { call.filter = [col, val]; return api; },
    single: () => Promise.resolve(nextResult),
    maybeSingle: () => Promise.resolve(nextResult),
    then: (res: (v: unknown) => unknown) => Promise.resolve(nextResult).then(res),
  };
  return api;
};

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (cols?: string) => chain(table, `select:${cols}`),
      insert: (payload: unknown) => chain(table, 'insert', payload),
      update: (payload: unknown) => chain(table, 'update', payload),
      delete: () => chain(table, 'delete'),
    }),
  },
}));

const { deleteProject, duplicateProject, listProjects, openProject, saveProject } = await import('./installationProjectStore');

beforeEach(() => {
  calls.length = 0;
  nextResult = { data: null, error: null };
});

describe('installationProjectStore', () => {
  it('crea un proyecto nuevo con el técnico, el nombre y el resto como data', async () => {
    nextResult = { data: { id: 'p1' }, error: null };
    const id = await saveProject('tech-1', { name: ' Depto 3B ', rooms: [], circuits: [] } as { name: string });
    expect(id).toBe('p1');
    expect(calls[0]).toMatchObject({ table: 'installation_projects', op: 'insert', payload: { technician_id: 'tech-1', name: 'Depto 3B', data: { rooms: [], circuits: [] } } });
  });

  it('con id actualiza ese proyecto (no crea otro) y sin nombre usa uno por defecto', async () => {
    const id = await saveProject('tech-1', { name: '  ' }, 'p9');
    expect(id).toBe('p9');
    expect(calls[0]).toMatchObject({ op: 'update', filter: ['id', 'p9'], payload: { name: 'Proyecto sin nombre' } });
  });

  it('duplicar guarda una fila nueva llamada "… (copia)"', async () => {
    nextResult = { data: { id: 'p2' }, error: null };
    expect(await duplicateProject('tech-1', { name: 'Casa' })).toBe('p2');
    expect(calls[0]).toMatchObject({ op: 'insert', payload: { name: 'Casa (copia)' } });
  });

  it('abre un proyecto devolviendo data + nombre, y null si no existe', async () => {
    nextResult = { data: { name: 'Casa', data: { iccA: 3250 } }, error: null };
    expect(await openProject('p1')).toEqual({ iccA: 3250, name: 'Casa' });
    nextResult = { data: null, error: null };
    expect(await openProject('nada')).toBeNull();
  });

  it('lista con el formato de la app y propaga los errores', async () => {
    nextResult = { data: [{ id: 'a', name: 'X', updated_at: '2026-11-23T10:00:00Z' }], error: null };
    expect(await listProjects()).toEqual([{ id: 'a', name: 'X', updatedAt: '2026-11-23T10:00:00Z' }]);
    nextResult = { data: null, error: new Error('rls') };
    await expect(listProjects()).rejects.toThrow('rls');
    await expect(deleteProject('a')).rejects.toThrow('rls');
  });
});
